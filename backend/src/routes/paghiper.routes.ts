import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { getPagHiperTransactionStatus } from '../lib/paghiper/paghiperClient.js'
import { planOrdersService } from '../services/planOrdersService.js'
import { getPlanOrder } from '../db/storage.js'

const router = Router()

// Rate limiter público (para webhook)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // mais permissivo para webhooks
})

// Helper para parsear data do webhook
function parseWebhookDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

// Helper para tratar erros
function handlePlanOrderError(res: Response, error: any) {
  console.error('[PagHiper Webhook] Erro:', error)
  return res.status(500).json({
    success: false,
    error: error.message || 'Erro ao processar webhook',
  })
}

/**
 * POST /api/paghiper/webhook
 * Webhook da PagHiper para notificações de status de pagamento
 */
router.post(
  '/webhook',
  publicLimiter,
  async (req: Request, res: Response) => {
    try {
      console.log('[PagHiper Webhook] Headers:', JSON.stringify(req.headers, null, 2))
      console.log('[PagHiper Webhook] Body:', JSON.stringify(req.body, null, 2))
      
      const rawPayload = (req.body ?? {}) as Record<string, any>
      
      // A PagHiper envia a apiKey no body como forma de autenticação
      const providedApiKey = rawPayload.apiKey
      const expectedApiKey = process.env.PAGHIPER_API_KEY
      
      console.log('[PagHiper Webhook] API Key validation:', {
        expectedApiKey: expectedApiKey ? `${expectedApiKey.substring(0, 15)}...` : 'não configurado',
        providedApiKey: providedApiKey ? `${providedApiKey.substring(0, 15)}...` : 'não fornecido',
        match: expectedApiKey === providedApiKey,
      })

      // Validar a API Key
      if (expectedApiKey) {
        if (!providedApiKey || expectedApiKey !== providedApiKey) {
          console.error('[PagHiper Webhook] API Key inválida ou ausente')
          return res.status(403).json({ error: 'API Key inválida.' })
        }
      } else {
        console.warn('[PagHiper Webhook] PAGHIPER_API_KEY não configurado - aceitando webhook sem validação')
      }
      
      const payload = {
        transaction_id:
          rawPayload.transaction_id ??
          rawPayload.transactionId ??
          rawPayload.transaction ??
          rawPayload.transaction_code ??
          rawPayload.code ??
          undefined,
        order_id: rawPayload.order_id ?? rawPayload.orderId ?? rawPayload.order ?? rawPayload.order_id_custom ?? undefined,
        status:
          rawPayload.status ??
          rawPayload.status_pagamento ??
          rawPayload.status_transaction ??
          rawPayload.transaction_status ??
          rawPayload.status_situacao ??
          '',
        paid_date: rawPayload.paid_date ?? rawPayload.payment_date ?? rawPayload.data_pagamento ?? undefined,
      }

      // A PagHiper não envia order_id nem status diretamente
      // Precisamos buscar o pedido pelo transaction_id
      if (!payload.transaction_id) {
        return res.status(400).json({ error: 'transaction_id obrigatório' })
      }

      // Buscar o pedido pelo transaction_id
      console.log('[PagHiper Webhook] Buscando pedido para transaction_id:', payload.transaction_id)
      const planOrders = await planOrdersService.list({ page: 1, pageSize: 1000 })
      console.log('[PagHiper Webhook] Total de pedidos encontrados:', planOrders.data.length)
      
      const order = planOrders.data.find(o => o.paghiperTransactionId === payload.transaction_id)
      
      if (!order) {
        console.error('[PagHiper Webhook] Pedido não encontrado para transaction_id:', payload.transaction_id)
        return res.status(404).json({ error: 'Pedido não encontrado' })
      }

      console.log('[PagHiper Webhook] Pedido encontrado:', {
        orderId: order.id,
        status: order.status,
        transactionId: order.paghiperTransactionId,
      })

      // Se o pedido já está pago, não atualizar novamente
      if (order.status === 'paid') {
        console.log('[PagHiper Webhook] Pedido já está pago. Ignorando webhook.')
        return res.json({ 
          status: 'ok', 
          message: 'Pedido já está pago. Webhook ignorado.' 
        })
      }

      const orderId = order.id
      
      // Consultar o status na API da PagHiper
      let statusFromApi: string | undefined
      let paidDateFromApi: string | undefined
      try {
        const paymentMethod = order.paymentMethod as 'pix' | 'boleto'
        if (paymentMethod && (paymentMethod === 'pix' || paymentMethod === 'boleto')) {
          const transactionStatus = await getPagHiperTransactionStatus(payload.transaction_id, paymentMethod)
          statusFromApi = transactionStatus?.status
          paidDateFromApi = transactionStatus?.paidDate
        } else {
          console.warn('[PagHiper Webhook] PaymentMethod inválido:', order.paymentMethod)
          // Tentar inferir do endpoint do webhook ou usar PIX como padrão
          const inferredMethod = 'pix'
          const transactionStatus = await getPagHiperTransactionStatus(payload.transaction_id, inferredMethod)
          statusFromApi = transactionStatus?.status
          paidDateFromApi = transactionStatus?.paidDate
        }
        console.log('[PagHiper Webhook] Status consultado na API:', {
          status: statusFromApi,
          paidDate: paidDateFromApi,
        })
      } catch (error) {
        console.error('[PagHiper Webhook] Erro ao consultar status na API:', error)
        // Continuar mesmo se falhar a consulta
      }

      // IMPORTANTE: Só atualizar o status se tivermos confirmação explícita da API
      let nextStatus: 'pending' | 'paid' | 'cancelled' | 'expired' | 'failed' | null = null
      
      if (statusFromApi) {
        const statusNormalized = statusFromApi.toLowerCase()
        switch (statusNormalized) {
          case 'paid':
          case 'completed':
          case 'settled':
            nextStatus = 'paid'
            break
          case 'cancelled':
          case 'refunded':
            nextStatus = 'cancelled'
            break
          case 'expired':
            nextStatus = 'expired'
            break
          case 'failed':
          case 'chargeback':
            nextStatus = 'failed'
            break
          case 'pending':
          case 'waiting_payment':
            nextStatus = 'pending'
            break
          default:
            console.warn('[PagHiper Webhook] Status desconhecido da API:', statusFromApi)
            nextStatus = null
        }
      } else {
        console.log('[PagHiper Webhook] Não foi possível consultar status na API. Webhook registrado mas status não atualizado.')
        return res.json({ 
          status: 'ok', 
          message: 'Webhook recebido mas status não atualizado (não foi possível consultar status na API)' 
        })
      }
      
      if (nextStatus === null) {
        console.log('[PagHiper Webhook] Status não atualizado - status inválido ou desconhecido')
        return res.json({ 
          status: 'ok', 
          message: 'Webhook recebido mas status não atualizado (status inválido)' 
        })
      }

      const paidAt =
        nextStatus === 'paid' && (paidDateFromApi || payload.paid_date)
          ? parseWebhookDate(paidDateFromApi || payload.paid_date) ?? new Date()
          : undefined

      const cancelledAt = nextStatus === 'cancelled' ? new Date() : undefined

      console.log('[PagHiper Webhook] Atualizando pedido:', {
        orderId,
        nextStatus,
        paidAt: paidAt?.toISOString(),
        cancelledAt: cancelledAt?.toISOString(),
      })

      try {
        // Preparar dados de atualização, preservando tenantId
        const updateData: any = {}
        
        if (payload.transaction_id) {
          updateData.paghiperTransactionId = payload.transaction_id
        }
        
        // Preservar tenantId do metadata original
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
          let tenantIdFromOriginal: string | undefined = undefined
          if (order.paghiperResponse && typeof order.paghiperResponse === 'object') {
            const originalMetadata = order.paghiperResponse as any
            if (originalMetadata.tenantId && typeof originalMetadata.tenantId === 'string') {
              tenantIdFromOriginal = originalMetadata.tenantId
            }
          }
          
          const webhookResponse: any = JSON.parse(JSON.stringify(req.body))
          
          // Preservar tenantId se existir
          if (tenantIdFromOriginal) {
            webhookResponse.tenantId = tenantIdFromOriginal
          }
          
          updateData.paghiperResponse = webhookResponse
        }
        
        if (paidAt) {
          updateData.paidAt = paidAt
        }
        
        if (cancelledAt) {
          updateData.cancelledAt = cancelledAt
        }
        
        await planOrdersService.updateStatus(orderId, nextStatus, updateData)
        
        console.log('[PagHiper Webhook] Pedido atualizado com sucesso')
      } catch (updateError) {
        console.error('[PagHiper Webhook] Erro ao atualizar pedido:', updateError)
        throw updateError
      }

      console.info('[paghiper] webhook recebido', {
        orderId,
        status: nextStatus,
        transactionId: payload.transaction_id,
      })

      return res.json({ status: 'ok' })
    } catch (error) {
      return handlePlanOrderError(res, error)
    }
  }
)

export default router

