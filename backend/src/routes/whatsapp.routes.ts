import { Router, Request, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { tenantGuard } from '../middleware/tenantGuard.js'
import { z } from 'zod'
import { getWhatsAppInstanceManager } from '../lib/whatsapp/whatsappInstanceManager.js'
import { errorHandler } from '../middleware/errorHandler.js'

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
  async (req: AuthRequest, res: Response) => {
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

      const manager = getWhatsAppInstanceManager()
      const result = await manager.createInstance({
        instanceName,
        qrcode: useQRCode,
        number: phoneNumber,
      })

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Não foi possível criar a instância',
        })
      }

      // Obter código de conexão
      let connectionCode = null
      try {
        // Se for QR Code, aguardar um pouco antes de obter
        if (useQRCode) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          // Se for pairing code, aguardar mais tempo
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
        
        connectionCode = await manager.getConnectionCode(instanceName)
      } catch (error) {
        console.warn('[WhatsApp] Erro ao obter código de conexão:', error)
        // Não falhar se não conseguir obter o código imediatamente
      }

      res.json({
        success: true,
        instanceName,
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
  async (req: AuthRequest, res: Response) => {
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
  async (req: AuthRequest, res: Response) => {
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

      const manager = getWhatsAppInstanceManager()
      const connectionCode = await manager.connectWithPairingCode(instanceName, phoneNumber)

      res.json({
        success: true,
        instanceName,
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
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
      }

      const { instanceName } = req.params

      const manager = getWhatsAppInstanceManager()
      const status = await manager.getConnectionState(instanceName)

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
  async (req: AuthRequest, res: Response) => {
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
          const response = await manager.authenticatedRequest(endpoint, {
            method: 'POST',
          })

          if (response.ok) {
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
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
      }

      const { instanceName } = req.params

      const manager = getWhatsAppInstanceManager()
      const deleted = await manager.deleteInstance(instanceName)

      if (!deleted) {
        return res.status(500).json({
          success: false,
          error: 'Não foi possível deletar a instância',
        })
      }

      res.json({
        success: true,
        message: 'Instância deletada com sucesso',
      })
    } catch (error) {
      return errorHandler(error as Error, req, res, () => {})
    }
  }
)

export default router

