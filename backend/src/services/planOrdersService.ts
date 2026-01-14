import {
  createPlanOrder,
  updatePlanOrder,
  getPlanOrder,
  listPlanOrders,
  getTenantSubscription,
  createTenantSubscription,
  updateTenantSubscription,
  type PlanOrder,
  type PlanOrderStatus,
  type UpdatePlanOrderData,
} from '../db/storage.js'
import { createPagHiperCharge, getPagHiperTransactionStatus } from '../lib/paghiper/paghiperClient.js'
import type { PlanType } from '../db/storage.js'

interface CheckoutPayload {
  customerName: string
  customerEmail: string
  customerDocument: string
  customerPhone: string
  paymentMethod: 'pix' | 'boleto'
  planType: PlanType
}

interface PlanInfo {
  id: string
  name: string
  price: number
  validityDays: number
}

/**
 * Serviço para gerenciar pedidos de planos e assinaturas
 */
export class PlanOrdersService {
  private plans: Map<PlanType, PlanInfo> = new Map([
    ['basic', { id: 'basic', name: 'Plano Completo', price: 3.00, validityDays: 30 }], // Mínimo R$ 3,00 para PIX
    ['premium', { id: 'premium', name: 'Plano Premium', price: 149.90, validityDays: 30 }],
    ['enterprise', { id: 'enterprise', name: 'Plano Enterprise', price: 299.90, validityDays: 30 }],
  ])

  /**
   * Busca informações de um plano
   */
  private getPlan(planType: PlanType): PlanInfo {
    const plan = this.plans.get(planType)
    if (!plan) {
      throw new Error(`Plano ${planType} não encontrado`)
    }
    return plan
  }

  /**
   * Processa checkout - cria pedido e cobrança na PagHiper
   */
  async checkout(
    tenantId: string,
    payload: CheckoutPayload,
    baseUrl: string
  ): Promise<{
    order: PlanOrder
    paymentInstructions: {
      pix?: { qrcodeImage?: string | null; pixCode?: string | null }
      boleto?: { digitableLine?: string | null; url?: string | null; pdfUrl?: string | null }
    }
  }> {
    const plan = this.getPlan(payload.planType)
    const amountNumber = plan.price
    const validityDays = plan.validityDays

    // Validar valor mínimo PIX (R$ 3,00)
    if (payload.paymentMethod === 'pix' && amountNumber < 3.0) {
      throw new Error('Valor mínimo para PIX é R$ 3,00')
    }

    // Salvar tenantId no paghiperResponse como metadata
    const orderMetadata: any = {}
    if (tenantId) {
      orderMetadata.tenantId = tenantId
    }

    // Criar pedido no banco
    const order = await createPlanOrder({
      tenantId,
      planType: payload.planType,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerDocument: payload.customerDocument,
      customerPhone: payload.customerPhone,
      paymentMethod: payload.paymentMethod,
      status: 'pending',
      amount: amountNumber.toFixed(2),
      validityDays,
      paghiperResponse: Object.keys(orderMetadata).length > 0 ? orderMetadata : null,
    })

    console.info('[plan-orders] Pedido criado:', {
      orderId: order.id,
      planType: payload.planType,
      paymentMethod: payload.paymentMethod,
      customer: payload.customerEmail,
      tenantId,
    })

    try {
      const notificationUrl = `${baseUrl.replace(/\/$/, '')}/api/paghiper/webhook`
      const amountCents = Math.round(amountNumber * 100)

      const charge = await createPagHiperCharge({
        orderId: order.id,
        planName: plan.name,
        amountCents,
        paymentMethod: payload.paymentMethod,
        customer: {
          name: payload.customerName,
          email: payload.customerEmail,
          document: payload.customerDocument,
          phone: payload.customerPhone,
        },
        notificationUrl,
        validityDays: plan.validityDays,
      })

      // Preservar o tenantId do metadata original ao atualizar com a resposta da PagHiper
      let paghiperResponseToSave: any = charge.raw
      if (orderMetadata.tenantId && paghiperResponseToSave && typeof paghiperResponseToSave === 'object') {
        paghiperResponseToSave = JSON.parse(JSON.stringify(paghiperResponseToSave))
        paghiperResponseToSave.tenantId = orderMetadata.tenantId
        console.log('[plan-orders] Preservando tenantId na resposta da PagHiper:', orderMetadata.tenantId)
      } else if (orderMetadata.tenantId) {
        paghiperResponseToSave = {
          ...(paghiperResponseToSave || {}),
          tenantId: orderMetadata.tenantId,
        }
      }

      const updated = await updatePlanOrder(order.id, {
        paghiperOrderId: charge.paghiperOrderId ?? undefined,
        paghiperTransactionId: charge.transactionId ?? undefined,
        paghiperResponse: paghiperResponseToSave,
        dueDate: charge.dueDate ?? undefined,
      })

      return {
        order: updated,
        paymentInstructions: charge.paymentInstructions,
      }
    } catch (error) {
      console.error('[plan-orders] Erro ao criar cobrança na PagHiper:', error)
      // Atualizar status para failed
      await updatePlanOrder(order.id, {
        status: 'failed',
      })
      throw error
    }
  }

  /**
   * Atualiza status do pedido e ativa assinatura se pago
   */
  async updateStatus(
    id: string,
    status: PlanOrderStatus,
    updates: UpdatePlanOrderData
  ): Promise<PlanOrder> {
    // Atualizar pedido
    const updated = await updatePlanOrder(id, {
      status,
      ...updates,
    })

    // Se o pedido foi pago, ativar/renovar assinatura
    if (status === 'paid') {
      await this.activateSubscription(updated)
    }

    return updated
  }

  /**
   * Ativa ou renova assinatura do tenant após pagamento confirmado
   */
  private async activateSubscription(order: PlanOrder): Promise<void> {
    try {
      // Obter tenantId do metadata
      let tenantIdFromMetadata: string | undefined = undefined

      if (order.paghiperResponse && typeof order.paghiperResponse === 'object') {
        const metadata = order.paghiperResponse as any
        if (metadata.tenantId && typeof metadata.tenantId === 'string') {
          tenantIdFromMetadata = metadata.tenantId
          console.log('[PlanOrderService] TenantId encontrado no metadata do pedido:', tenantIdFromMetadata)
        }
      }

      // Se não temos tenantId, usar do pedido diretamente
      const tenantId = tenantIdFromMetadata || order.tenantId

      if (!tenantId) {
        console.error('[PlanOrderService] TenantId não encontrado')
        return
      }

      // Buscar assinatura existente
      let subscription = await getTenantSubscription(tenantId)

      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + (order.validityDays || 30))

      if (!subscription) {
        // Criar nova assinatura
        subscription = await createTenantSubscription({
          tenantId,
          planType: order.planType,
          startDate,
          endDate,
        })
        console.log('[PlanOrderService] Assinatura criada para tenant:', tenantId)
      } else {
        // Atualizar assinatura existente (renovação)
        subscription = await updateTenantSubscription(subscription.id, {
          planType: order.planType,
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          isActive: true,
          isTrial: false,
        })
        console.log('[PlanOrderService] Assinatura atualizada para tenant:', tenantId)
      }
    } catch (error) {
      console.error('[PlanOrderService] Erro ao ativar assinatura:', error)
      // Não lançar erro para não quebrar o webhook
    }
  }

  /**
   * Busca pedido por ID
   */
  async getById(id: string): Promise<PlanOrder | null> {
    return getPlanOrder(id)
  }

  /**
   * Lista pedidos
   */
  async list(options: {
    tenantId?: string
    page?: number
    pageSize?: number
  }): Promise<{ data: PlanOrder[]; total: number }> {
    return listPlanOrders(options)
  }
}

// Instância singleton
export const planOrdersService = new PlanOrdersService()

