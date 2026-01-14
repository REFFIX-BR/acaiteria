import { Router, Request, Response } from 'express'
import { authenticate, AuthRequest, tenantGuard } from '../middleware/auth.js'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { planOrdersService } from '../services/planOrdersService.js'
import { getPagHiperTransactionStatus } from '../lib/paghiper/paghiperClient.js'
import { getPlanOrder } from '../db/storage.js'
import { errorHandler } from '../middleware/errorHandler.js'

const router = Router()

// Rota de teste para verificar se o router está funcionando
router.get('/test', (req, res) => {
  console.log('[Payment] Rota /test chamada')
  res.json({ message: 'Payment routes working!', timestamp: new Date().toISOString() })
})

// Rota de teste POST sem autenticação
router.post('/test', (req, res) => {
  console.log('[Payment] Rota POST /test chamada:', req.body)
  res.json({ message: 'Payment POST routes working!', body: req.body, timestamp: new Date().toISOString() })
})

// Rate limiter público (para webhook e status)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // mais permissivo para webhooks
})

// Schema de validação para pagamento (apenas PIX e Boleto)
const paymentSchema = z.object({
  method: z.enum(['pix', 'boleto']),
  planType: z.enum(['basic', 'premium', 'enterprise']),
  customerName: z.string().min(1, 'Nome é obrigatório'),
  customerEmail: z.string().email('Email inválido'),
  customerDocument: z.string().min(11, 'CPF/CNPJ inválido').max(18),
  customerPhone: z.string().min(10, 'Telefone inválido'),
})

// Helper para tratar erros
function handlePlanOrderError(res: Response, error: any) {
  console.error('[Payment] Erro:', error)
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: error.errors,
    })
  }
  return res.status(500).json({
    success: false,
    error: error.message || 'Erro ao processar pedido',
  })
}

// Helper para parsear data do webhook
function parseWebhookDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

/**
 * POST /api/payment/process
 * Processa checkout e cria cobrança na PagHiper
 */
router.post(
  '/process',
  (req, res, next) => {
    console.log('[Payment] Rota /process chamada:', {
      method: req.method,
      path: req.path,
      url: req.url,
      headers: req.headers,
    })
    next()
  },
  authenticate,
  tenantGuard,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
      }

      const validation = paymentSchema.safeParse(req.body)
      
      if (!validation.success) {
        return handlePlanOrderError(res, validation.error)
      }

      const { method, planType, customerName, customerEmail, customerDocument, customerPhone } = validation.data

      // Obter URL base para o webhook
      const protocol = req.protocol
      const host = req.get('host')
      const baseUrl = `${protocol}://${host}`

      // Processar checkout
      const result = await planOrdersService.checkout(
        req.user.tenantId,
        {
          customerName,
          customerEmail,
          customerDocument,
          customerPhone,
          paymentMethod: method,
          planType,
        },
        baseUrl
      )

      res.json({
        success: true,
        orderId: result.order.id,
        paymentInstructions: result.paymentInstructions,
        message: 'Cobrança criada com sucesso',
      })
    } catch (error) {
      return handlePlanOrderError(res, error)
    }
  }
)

/**
 * Webhook PagHiper movido para paghiper.routes.ts
 * Acesse em: POST /api/paghiper/webhook
 */

/**
 * GET /api/payment/orders/:id/status
 * Endpoint público para verificar status do pedido (usado para polling no frontend)
 */
/**
 * GET /api/payment/orders/:id/status
 * Endpoint público para verificar status do pedido (usado para polling no frontend)
 */
router.get(
  '/orders/:id/status',
  publicLimiter,
  async (req: Request, res: Response) => {
    try {
      const order = await planOrdersService.getById(req.params.id)
      if (!order) {
        return res.status(404).json({ error: 'Pedido não encontrado.' })
      }
      
      // Se o pedido está pago, verificar se a assinatura foi ativada
      // Se não foi, tentar ativar novamente como fallback
      if (order.status === 'paid' && order.paidAt) {
        try {
          const fullOrder = await getPlanOrder(req.params.id)
          if (fullOrder) {
            // Tentar obter tenantId do metadata
            let tenantIdFromMetadata: string | undefined = undefined
            if (fullOrder.paghiperResponse && typeof fullOrder.paghiperResponse === 'object') {
              const metadata = fullOrder.paghiperResponse as any
              if (metadata.tenantId && typeof metadata.tenantId === 'string') {
                tenantIdFromMetadata = metadata.tenantId
              }
            }
            
            // Se temos tenantId, verificar se a assinatura está ativa
            if (tenantIdFromMetadata || fullOrder.tenantId) {
              const { getTenantSubscription } = await import('../db/storage.js')
              const subscription = await getTenantSubscription(tenantIdFromMetadata || fullOrder.tenantId)
              // Se não há assinatura ou está inativa, tentar ativar novamente
              if (!subscription || !subscription.isActive) {
                console.log('[Plan Order Status] Fallback: Assinatura não encontrada ou inativa, tentando ativar...')
                await planOrdersService.updateStatus(req.params.id, 'paid', {
                  paidAt: order.paidAt ? new Date(order.paidAt) : new Date(),
                })
                console.log('[Plan Order Status] Fallback: Tentativa de reativação da assinatura executada para pedido:', req.params.id)
              }
            } else {
              // Se não temos tenantId, tentar ativar de qualquer forma
              console.log('[Plan Order Status] Fallback: TenantId não encontrado no metadata, tentando ativar...')
              await planOrdersService.updateStatus(req.params.id, 'paid', {
                paidAt: order.paidAt ? new Date(order.paidAt) : new Date(),
              })
            }
          }
        } catch (error) {
          // Não falhar a resposta se houver erro ao tentar reativar
          console.warn('[Plan Order Status] Fallback: Erro ao tentar reativar assinatura:', error)
        }
      }
      
      // Retornar apenas informações básicas do status
      return res.json({
        id: order.id,
        status: order.status,
        paidAt: order.paidAt,
        cancelledAt: order.cancelledAt,
      })
    } catch (error) {
      return handlePlanOrderError(res, error)
    }
  }
)

/**
 * GET /api/payment/methods
 * Retorna métodos de pagamento disponíveis (apenas PIX e Boleto)
 */
router.get(
  '/methods',
  authenticate,
  tenantGuard,
  async (req: AuthRequest, res) => {
    try {
      res.json({
        methods: [
          {
            id: 'pix',
            name: 'PIX',
            icon: 'pix',
            available: true,
          },
          {
            id: 'boleto',
            name: 'Boleto Bancário',
            icon: 'boleto',
            available: true,
          },
        ],
      })
    } catch (error) {
      console.error('Erro ao buscar métodos de pagamento:', error)
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar métodos de pagamento',
      })
    }
  }
)

export default router

