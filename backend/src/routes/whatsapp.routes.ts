import { Router, Request, Response as ExpressResponse } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { tenantGuard } from '../middleware/tenantGuard.js'
import { z } from 'zod'
import { getWhatsAppInstanceManager } from '../lib/whatsapp/whatsappInstanceManager.js'
import { errorHandler } from '../middleware/errorHandler.js'
import {
  getWhatsAppInstanceByTenant,
  getWhatsAppInstanceByName,
  createWhatsAppInstance,
  updateWhatsAppInstanceStatus,
  deleteWhatsAppInstance,
} from '../db/storage.js'
import { query } from '../db/connection.js'

const router = Router()

// Schema de validação para criação de instância
const createInstanceSchema = z.object({
  instanceName: z.string().min(1, 'Nome da instância é obrigatório'),
  useQRCode: z.boolean().optional().default(true),
  phoneNumber: z.string().optional(),
})

// Schema de validação para pairing code
const pairingCodeSchema = z.object({
  instanceName: z.string().min(1, 'Nome da instância é obrigatório'),
  phoneNumber: z.string().min(10, 'Número de telefone inválido'),
})

/**
 * POST /api/whatsapp/instances/create
 * Cria uma nova instância WhatsApp
 */
router.post(
  '/instances/create',
  authenticate,
  tenantGuard,
  async (req: AuthRequest, res: ExpressResponse) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
      }

      const validation = createInstanceSchema.safeParse(req.body)
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validation.error.errors,
        })
      }

      const { instanceName, useQRCode, phoneNumber } = validation.data
      const tenantId = req.user.tenantId

      // Verificar se já existe instância para este tenant
      const existingInstance = await getWhatsAppInstanceByTenant(tenantId)
      
      if (existingInstance) {
        // Verificar se a instância ainda existe na Evolution API
        try {
          const manager = getWhatsAppInstanceManager()
          const status = await manager.getConnectionState(existingInstance.instanceName)
          
          // Se a instância existe na API, retornar erro de conflito
          if (status.status !== 'disconnected') {
            return res.status(409).json({
              success: false,
              error: 'Já existe uma instância WhatsApp para este tenant',
              instanceName: existingInstance.instanceName,
            })
          }
          
          // Se não existe na API, remover do banco e permitir criar nova
          await deleteWhatsAppInstance(existingInstance.id)
        } catch (error) {
          // Se não conseguir verificar, assumir que não existe e remover do banco
          await deleteWhatsAppInstance(existingInstance.id)
        }
      }

      const manager = getWhatsAppInstanceManager()
      
      // Tentar criar instância na Evolution API (com retry em caso de 409)
      let result = await manager.createInstance({
        instanceName,
        qrcode: useQRCode,
        number: phoneNumber,
      })

      // Se der erro 409 (Conflict), tentar deletar e recriar
      if (!result.success) {
        // Verificar se é erro de conflito (instância já existe na API)
        const isConflict = result.error?.toLowerCase().includes('conflict') || 
                          result.error?.toLowerCase().includes('409') ||
                          result.error?.toLowerCase().includes('already exists')
        
        if (isConflict) {
          try {
            console.log('[WhatsApp] Instância já existe na API, tentando deletar e recriar...')
            await manager.deleteInstance(instanceName)
            await new Promise(resolve => setTimeout(resolve, 2000))
            result = await manager.createInstance({
              instanceName,
              qrcode: useQRCode,
              number: phoneNumber,
            })
          } catch (retryError) {
            console.warn('[WhatsApp] Erro ao tentar recriar instância:', retryError)
          }
        }
      }

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Não foi possível criar a instância',
        })
      }

      // Salvar instância no banco de dados (ou atualizar se já existir)
      // Capturar token da instância se foi retornado na criação
      const instanceToken = result.instanceToken || null
      
      let dbInstance
      try {
        dbInstance = await createWhatsAppInstance({
          tenantId,
          instanceName,
          phoneNumber: phoneNumber || null,
          status: 'created',
          instanceToken: instanceToken || null,
        })
      } catch (error: any) {
        // Se der erro de duplicata, buscar a instância existente
        if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
          console.log('[WhatsApp] Instância já existe no banco, buscando existente...')
          
          // Tentar buscar pelo nome primeiro (mais específico)
          let existingInstance = await getWhatsAppInstanceByName(instanceName)
          
          // Se não encontrar pelo nome, tentar pelo tenant
          if (!existingInstance) {
            existingInstance = await getWhatsAppInstanceByTenant(tenantId)
          }
          
          // Se ainda não encontrar, buscar diretamente no banco (pode estar com soft delete)
          if (!existingInstance) {
            const directResult = await query(
              `SELECT * FROM whatsapp_instances 
               WHERE tenant_id = $1 AND instance_name = $2
               ORDER BY created_at DESC 
               LIMIT 1`,
              [tenantId, instanceName]
            )
            
            if (directResult.rows.length > 0) {
              // Se encontrou mas está com deleted_at, restaurar
              const row = directResult.rows[0]
              if (row.deleted_at) {
                await query(
                  `UPDATE whatsapp_instances 
                   SET deleted_at = NULL, updated_at = NOW() 
                   WHERE id = $1`,
                  [row.id]
                )
              }
              existingInstance = await getWhatsAppInstanceByName(instanceName)
            }
          }
          
          if (existingInstance && existingInstance.instanceName === instanceName) {
            dbInstance = existingInstance
            // Atualizar status, phone e token se necessário
            await updateWhatsAppInstanceStatus(existingInstance.id, 'created', instanceToken || undefined)
            if (phoneNumber && phoneNumber !== existingInstance.phoneNumber) {
              await query(
                'UPDATE whatsapp_instances SET phone_number = $1, updated_at = NOW() WHERE id = $2',
                [phoneNumber, existingInstance.id]
              )
            }
            console.log('[WhatsApp] Instância existente encontrada e atualizada:', existingInstance.id)
          } else {
            console.error('[WhatsApp] Erro: Instância duplicada mas não encontrada no banco')
            throw error
          }
        } else {
          throw error
        }
      }

      // Obter código de conexão
      let connectionCode = null
      try {
        // Se for QR Code, aguardar mais tempo (5 segundos) para garantir que a instância está pronta
        if (useQRCode) {
          console.log('[WhatsApp] Aguardando 5 segundos antes de obter QR Code...')
          await new Promise(resolve => setTimeout(resolve, 5000))
        } else {
          // Se for pairing code, aguardar 5 segundos
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
        
        console.log('[WhatsApp] Tentando obter código de conexão...')
        connectionCode = await manager.getConnectionCode(instanceName)
        console.log('[WhatsApp] Código de conexão obtido:', {
          hasQrcode: !!connectionCode?.qrcode,
          hasPairingCode: !!connectionCode?.pairingCode,
        })
      } catch (error) {
        console.warn('[WhatsApp] Erro ao obter código de conexão:', error)
        // Não falhar se não conseguir obter o código imediatamente
        // O frontend pode tentar novamente depois
      }

      res.json({
        success: true,
        instance: {
          id: dbInstance.id,
          instanceName: dbInstance.instanceName,
          status: dbInstance.status,
        },
        connectionCode,
      })
    } catch (error) {
      return errorHandler(error as Error, req, res, () => {})
    }
  }
)

/**
 * GET /api/whatsapp/instances/:instanceName/connect
 * Obtém código de conexão (QR Code ou Pairing Code)
 */
router.get(
  '/instances/:instanceName/connect',
  authenticate,
  tenantGuard,
  async (req: AuthRequest, res: ExpressResponse) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
      }

      const { instanceName } = req.params

      const manager = getWhatsAppInstanceManager()
      const connectionCode = await manager.getConnectionCode(instanceName)

      res.json({
        success: true,
        connectionCode,
      })
    } catch (error) {
      return errorHandler(error as Error, req, res, () => {})
    }
  }
)

/**
 * POST /api/whatsapp/instances/connect-pairing
 * Conecta via Pairing Code (cria instância e obtém código em um único passo)
 */
router.post(
  '/instances/connect-pairing',
  authenticate,
  tenantGuard,
  async (req: AuthRequest, res: ExpressResponse) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
      }

      const validation = pairingCodeSchema.safeParse(req.body)
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validation.error.errors,
        })
      }

      const { instanceName, phoneNumber } = validation.data
      const tenantId = req.user.tenantId

      // Verificar se já existe instância para este tenant (similar à rota de criação)
      const existingInstance = await getWhatsAppInstanceByTenant(tenantId)
      
      if (existingInstance) {
        // Verificar se a instância ainda existe na Evolution API
        try {
          const manager = getWhatsAppInstanceManager()
          const status = await manager.getConnectionState(existingInstance.instanceName)
          
          // Se a instância existe na API, retornar erro de conflito
          if (status.status !== 'disconnected') {
            return res.status(409).json({
              success: false,
              error: 'Já existe uma instância WhatsApp para este tenant',
              instanceName: existingInstance.instanceName,
            })
          }
          
          // Se não existe na API, remover do banco e permitir criar nova
          await deleteWhatsAppInstance(existingInstance.id)
        } catch (error) {
          // Se não conseguir verificar, assumir que não existe e remover do banco
          await deleteWhatsAppInstance(existingInstance.id)
        }
      }

      const manager = getWhatsAppInstanceManager()
      const result = await manager.connectWithPairingCode(instanceName, phoneNumber)

      // Extrair connectionCode e instanceToken
      const { instanceToken, ...connectionCode } = result

      // Salvar instância no banco de dados (similar à rota de criação)
      let dbInstance
      try {
        dbInstance = await createWhatsAppInstance({
          tenantId,
          instanceName,
          phoneNumber: phoneNumber || null,
          status: 'created',
          instanceToken: instanceToken || null,
        })
      } catch (error: any) {
        // Se der erro de duplicata, buscar a instância existente
        if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
          console.log('[WhatsApp] Instância já existe no banco, buscando existente...')
          
          let existingInstance = await getWhatsAppInstanceByName(instanceName)
          
          if (!existingInstance) {
            existingInstance = await getWhatsAppInstanceByTenant(tenantId)
          }
          
          if (!existingInstance) {
            const directResult = await query(
              `SELECT * FROM whatsapp_instances 
               WHERE tenant_id = $1 AND instance_name = $2
               ORDER BY created_at DESC 
               LIMIT 1`,
              [tenantId, instanceName]
            )
            
            if (directResult.rows.length > 0) {
              const row = directResult.rows[0]
              if (row.deleted_at) {
                await query(
                  `UPDATE whatsapp_instances 
                   SET deleted_at = NULL, updated_at = NOW() 
                   WHERE id = $1`,
                  [row.id]
                )
              }
              existingInstance = await getWhatsAppInstanceByName(instanceName)
            }
          }
          
          if (existingInstance && existingInstance.instanceName === instanceName) {
            dbInstance = existingInstance
            // Atualizar status e token se necessário
            await updateWhatsAppInstanceStatus(existingInstance.id, 'created', instanceToken || undefined)
            if (phoneNumber && phoneNumber !== existingInstance.phoneNumber) {
              await query(
                'UPDATE whatsapp_instances SET phone_number = $1, updated_at = NOW() WHERE id = $2',
                [phoneNumber, existingInstance.id]
              )
            }
            console.log('[WhatsApp] Instância existente encontrada e atualizada:', existingInstance.id)
          } else {
            console.error('[WhatsApp] Erro: Instância duplicada mas não encontrada no banco')
            throw error
          }
        } else {
          throw error
        }
      }

      res.json({
        success: true,
        instance: {
          id: dbInstance.id,
          instanceName: dbInstance.instanceName,
          status: dbInstance.status,
        },
        connectionCode,
      })
    } catch (error) {
      return errorHandler(error as Error, req, res, () => {})
    }
  }
)

/**
 * GET /api/whatsapp/instances/:instanceName/status
 * Verifica status da conexão
 */
router.get(
  '/instances/:instanceName/status',
  authenticate,
  tenantGuard,
  async (req: AuthRequest, res: ExpressResponse) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
      }

      const { instanceName } = req.params
      const tenantId = req.user.tenantId

      // Buscar instância no banco para obter o token específico
      const dbInstance = await getWhatsAppInstanceByName(instanceName)
      if (!dbInstance || dbInstance.tenantId !== tenantId) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada',
        })
      }

      // Verificar se tem token da instância (obrigatório para o endpoint de status)
      if (!dbInstance.instanceToken) {
        return res.status(400).json({
          success: false,
          error: 'Token da instância não encontrado. Recrie a instância.',
        })
      }

      const manager = getWhatsAppInstanceManager()
      // Usar token específico da instância
      const status = await manager.getConnectionState(instanceName, dbInstance.instanceToken)
      
      // Atualizar status no banco de dados se mudou
      const newStatus = status.status === 'connected' || status.status === 'open' 
        ? 'connected' 
        : status.status === 'connecting' 
        ? 'connecting' 
        : 'disconnected'
      
      if (dbInstance.status !== newStatus) {
        await updateWhatsAppInstanceStatus(dbInstance.id, newStatus)
      }

      res.json({
        success: true,
        status: status.status,
        instanceName: status.instanceName,
        isConnected: status.status === 'connected' || status.status === 'open',
      })
    } catch (error) {
      return errorHandler(error as Error, req, res, () => {})
    }
  }
)

/**
 * POST /api/whatsapp/instances/:instanceName/logout
 * Desconecta uma instância (logout do WhatsApp)
 */
router.post(
  '/instances/:instanceName/logout',
  authenticate,
  tenantGuard,
  async (req: AuthRequest, res: ExpressResponse) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
      }

      const { instanceName } = req.params

      const manager = getWhatsAppInstanceManager()
      const token = await manager.authenticate()
      if (!token) {
        return res.status(500).json({
          success: false,
          error: 'Não foi possível autenticar no Manager API',
        })
      }

      // Tentar múltiplos endpoints de logout
      const logoutEndpoints = [
        `${process.env.EVOLUTION_API_URL}/instance/logout/${instanceName}`,
        `${process.env.EVOLUTION_API_URL}/instances/logout/${instanceName}`,
      ]

      let success = false
      for (const endpoint of logoutEndpoints) {
        try {
          const fetchResponse = await manager.authenticatedRequest(endpoint, {
            method: 'POST',
          })

          if (fetchResponse.ok) {
            success = true
            break
          }
        } catch (error) {
          continue
        }
      }

      if (!success) {
        return res.status(500).json({
          success: false,
          error: 'Não foi possível desconectar a instância',
        })
      }

      res.json({
        success: true,
        message: 'Instância desconectada com sucesso',
      })
    } catch (error) {
      return errorHandler(error as Error, req, res, () => {})
    }
  }
)

/**
 * DELETE /api/whatsapp/instances/:instanceName
 * Deleta uma instância
 */
router.delete(
  '/instances/:instanceName',
  authenticate,
  tenantGuard,
  async (req: AuthRequest, res: ExpressResponse) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
      }

      const { instanceName } = req.params
      const tenantId = req.user.tenantId

      // Verificar se a instância existe no banco de dados
      const dbInstance = await getWhatsAppInstanceByName(instanceName)
      if (!dbInstance || dbInstance.tenantId !== tenantId) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada',
        })
      }

      // Deletar na Evolution API primeiro
      // Usar token da instância se disponível (obrigatório para api.reffix.com.br)
      const manager = getWhatsAppInstanceManager()
      const deletedInAPI = await manager.deleteInstance(instanceName, dbInstance.instanceToken || undefined)

      // Deletar do banco de dados (soft delete)
      await deleteWhatsAppInstance(dbInstance.id)

      if (!deletedInAPI) {
        // Se não deletou na API mas deletou do banco, avisar
        return res.status(207).json({
          success: true,
          message: 'Instância removida do sistema, mas pode não ter sido deletada na Evolution API',
          deletedInAPI: false,
        })
      }

      res.json({
        success: true,
        message: 'Instância deletada com sucesso na Evolution API e no sistema',
        deletedInAPI: true,
      })
    } catch (error) {
      return errorHandler(error as Error, req, res, () => {})
    }
  }
)

/**
 * POST /api/whatsapp/campaigns/send
 * Envia campanha WhatsApp para todos os clientes do banco
 */
const sendCampaignSchema = z.object({
  campaignId: z.string(),
  message: z.string().min(1),
  imageUrl: z.string().url().optional(),
  sendInterval: z.number().min(15).default(15),
})

router.post(
  '/campaigns/send',
  authenticate,
  tenantGuard,
  async (req: AuthRequest, res: ExpressResponse) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
      }

      const validation = sendCampaignSchema.safeParse(req.body)
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validation.error.errors,
        })
      }

      const { campaignId, message, imageUrl, sendInterval } = validation.data
      const tenantId = req.user.tenantId

      // Buscar instância WhatsApp do tenant
      const whatsappInstance = await getWhatsAppInstanceByTenant(tenantId)
      
      if (!whatsappInstance || !whatsappInstance.instanceToken) {
        return res.status(400).json({
          success: false,
          error: 'Instância WhatsApp não configurada ou não conectada',
        })
      }

      const isValidStatus = whatsappInstance.status === 'connected' || whatsappInstance.status === 'created'
      if (!isValidStatus) {
        return res.status(400).json({
          success: false,
          error: 'Instância WhatsApp não está conectada',
        })
      }

      // Buscar todos os clientes do banco de dados
      const customersResult = await query(
        `SELECT id, name, phone FROM customers 
         WHERE tenant_id = $1 AND deleted_at IS NULL AND phone IS NOT NULL AND phone != ''`,
        [tenantId]
      )

      const customers = customersResult.rows
      
      if (customers.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum cliente encontrado no banco de dados',
        })
      }

      console.log(`[WhatsApp Campaign] Enviando campanha para ${customers.length} clientes`)

      // Enviar mensagens em background (não bloquear a resposta)
      const manager = getWhatsAppInstanceManager()
      let sent = 0
      let failed = 0

      // Processar envios em lote com intervalo
      const sendPromises = customers.map(async (customer, index) => {
        // Aguardar intervalo entre envios (exceto o primeiro)
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, sendInterval * 1000))
        }

        try {
          const result = await manager.sendTextMessage(
            whatsappInstance.instanceName,
            whatsappInstance.instanceToken!,
            customer.phone,
            message
          )

          if (result.success) {
            sent++
            console.log(`[WhatsApp Campaign] Mensagem enviada para ${customer.name} (${customer.phone})`)
          } else {
            failed++
            console.error(`[WhatsApp Campaign] Erro ao enviar para ${customer.name}:`, result.error)
          }
        } catch (error) {
          failed++
          console.error(`[WhatsApp Campaign] Erro ao enviar para ${customer.name}:`, error)
        }
      })

      // Aguardar todos os envios e atualizar status da campanha
      Promise.all(sendPromises)
        .then(async () => {
          // Atualizar status da campanha para 'sent' e métricas
          try {
            await query(
              `UPDATE campaigns 
               SET status = 'sent', 
                   sent = sent + $1, 
                   delivered = delivered + $2, 
                   failed = failed + $3,
                   updated_at = NOW()
               WHERE id = $4 AND tenant_id = $5`,
              [sent, sent, failed, campaignId, tenantId]
            )
            console.log(`[WhatsApp Campaign] Campanha ${campaignId} atualizada: status=sent, sent=${sent}, failed=${failed}`)
          } catch (error) {
            console.error('[WhatsApp Campaign] Erro ao atualizar campanha:', error)
          }
        })
        .catch(error => {
          console.error('[WhatsApp Campaign] Erro ao processar envios:', error)
        })

      // Atualizar status da campanha para 'sent' imediatamente (antes dos envios terminarem)
      try {
        await query(
          `UPDATE campaigns 
           SET status = 'sent', updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          [campaignId, tenantId]
        )
        console.log(`[WhatsApp Campaign] Status da campanha ${campaignId} atualizado para 'sent'`)
      } catch (error) {
        console.error('[WhatsApp Campaign] Erro ao atualizar status da campanha:', error)
      }

      // Retornar resposta imediata com status inicial
      res.json({
        success: true,
        message: 'Campanha iniciada',
        total: customers.length,
        sent: 0, // Será atualizado conforme os envios são processados
        failed: 0,
        processing: true,
      })
    } catch (error) {
      return errorHandler(error as Error, req, res, () => {})
    }
  }
)

export default router

