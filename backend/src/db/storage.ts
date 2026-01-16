import { pool, query } from './connection.js'
import type { PoolClient } from 'pg'

export type PlanOrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired' | 'failed'
export type PlanOrderPaymentMethod = 'pix' | 'boleto'
export type PlanType = 'basic' | 'premium' | 'enterprise'

export interface PlanOrder {
  id: string
  tenantId: string
  planType: PlanType
  customerName: string
  customerEmail: string
  customerDocument?: string | null
  customerPhone?: string | null
  paymentMethod: PlanOrderPaymentMethod
  status: PlanOrderStatus
  amount: string
  validityDays: number
  paghiperOrderId?: string | null
  paghiperTransactionId?: string | null
  paghiperResponse?: any
  dueDate?: Date | null
  paidAt?: Date | null
  cancelledAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreatePlanOrderData {
  tenantId: string
  planType: PlanType
  customerName: string
  customerEmail: string
  customerDocument?: string
  customerPhone?: string
  paymentMethod: PlanOrderPaymentMethod
  status: PlanOrderStatus
  amount: string
  validityDays: number
  paghiperResponse?: any
}

export interface UpdatePlanOrderData {
  status?: PlanOrderStatus
  paghiperOrderId?: string
  paghiperTransactionId?: string
  paghiperResponse?: any
  dueDate?: Date
  paidAt?: Date
  cancelledAt?: Date
}

export interface Subscription {
  id: string
  tenantId: string
  planType: PlanType
  trialStartDate: Date
  trialEndDate: Date
  subscriptionStartDate?: Date | null
  subscriptionEndDate?: Date | null
  isActive: boolean
  isTrial: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Cria um novo pedido de plano
 */
export async function createPlanOrder(
  data: CreatePlanOrderData
): Promise<PlanOrder> {
  const result = await query(
    `INSERT INTO plan_orders (
      tenant_id, plan_type, customer_name, customer_email, customer_document, customer_phone,
      payment_method, status, amount, validity_days, paghiper_response
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      data.tenantId,
      data.planType,
      data.customerName,
      data.customerEmail,
      data.customerDocument || null,
      data.customerPhone || null,
      data.paymentMethod,
      data.status,
      data.amount,
      data.validityDays,
      data.paghiperResponse ? JSON.stringify(data.paghiperResponse) : null,
    ]
  )

  return mapPlanOrderFromDb(result.rows[0])
}

/**
 * Atualiza um pedido de plano
 */
export async function updatePlanOrder(
  id: string,
  updates: UpdatePlanOrderData
): Promise<PlanOrder> {
  const updatesList: string[] = []
  const values: any[] = []
  let paramIndex = 1

  if (updates.status !== undefined) {
    updatesList.push(`status = $${paramIndex++}`)
    values.push(updates.status)
  }

  if (updates.paghiperOrderId !== undefined) {
    updatesList.push(`paghiper_order_id = $${paramIndex++}`)
    values.push(updates.paghiperOrderId)
  }

  if (updates.paghiperTransactionId !== undefined) {
    updatesList.push(`paghiper_transaction_id = $${paramIndex++}`)
    values.push(updates.paghiperTransactionId)
  }

  if (updates.paghiperResponse !== undefined) {
    updatesList.push(`paghiper_response = $${paramIndex++}`)
    values.push(
      updates.paghiperResponse
        ? JSON.stringify(updates.paghiperResponse)
        : null
    )
  }

  if (updates.dueDate !== undefined) {
    updatesList.push(`due_date = $${paramIndex++}`)
    values.push(updates.dueDate)
  }

  if (updates.paidAt !== undefined) {
    updatesList.push(`paid_at = $${paramIndex++}`)
    values.push(updates.paidAt)
  }

  if (updates.cancelledAt !== undefined) {
    updatesList.push(`cancelled_at = $${paramIndex++}`)
    values.push(updates.cancelledAt)
  }

  if (updatesList.length === 0) {
    throw new Error('Nenhum campo para atualizar')
  }

  updatesList.push(`updated_at = NOW()`)
  values.push(id)

  const result = await query(
    `UPDATE plan_orders SET ${updatesList.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
    values
  )

  if (result.rows.length === 0) {
    throw new Error('Pedido não encontrado')
  }

  return mapPlanOrderFromDb(result.rows[0])
}

/**
 * Busca um pedido por ID
 */
export async function getPlanOrder(id: string): Promise<PlanOrder | null> {
  const result = await query(
    `SELECT * FROM plan_orders WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapPlanOrderFromDb(result.rows[0])
}

/**
 * Lista pedidos com paginação
 */
export async function listPlanOrders(options: {
  tenantId?: string
  page?: number
  pageSize?: number
}): Promise<{ data: PlanOrder[]; total: number }> {
  const page = options.page || 1
  const pageSize = options.pageSize || 50
  const offset = (page - 1) * pageSize

  let whereClause = 'deleted_at IS NULL'
  const queryParams: any[] = []
  let paramIndex = 1

  if (options.tenantId) {
    whereClause += ` AND tenant_id = $${paramIndex++}`
    queryParams.push(options.tenantId)
  }

  const dataResult = await query(
    `SELECT * FROM plan_orders WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...queryParams, pageSize, offset]
  )

  const countResult = await query(
    `SELECT COUNT(*) as total FROM plan_orders WHERE ${whereClause}`,
    queryParams
  )

  return {
    data: dataResult.rows.map(mapPlanOrderFromDb),
    total: parseInt(countResult.rows[0].total),
  }
}

/**
 * Busca assinatura do tenant
 */
export async function getTenantSubscription(
  tenantId: string
): Promise<Subscription | null> {
  const result = await query(
    `SELECT * FROM subscriptions WHERE tenant_id = $1`,
    [tenantId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapSubscriptionFromDb(result.rows[0])
}

/**
 * Cria uma nova assinatura
 */
export async function createTenantSubscription(data: {
  tenantId: string
  planType: PlanType
  startDate: Date
  endDate: Date
}): Promise<Subscription> {
  // Buscar dados do trial do tenant (se existir)
  const tenantResult = await query(
    `SELECT created_at FROM tenants WHERE id = $1`,
    [data.tenantId]
  )

  if (tenantResult.rows.length === 0) {
    throw new Error('Tenant não encontrado')
  }

  const tenantCreatedAt = new Date(tenantResult.rows[0].created_at)
  const trialEndDate = new Date(tenantCreatedAt)
  trialEndDate.setDate(trialEndDate.getDate() + 7)

  const result = await query(
    `INSERT INTO subscriptions (
      tenant_id, plan_type, trial_start_date, trial_end_date,
      subscription_start_date, subscription_end_date, is_active, is_trial
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      data.tenantId,
      data.planType,
      tenantCreatedAt,
      trialEndDate,
      data.startDate,
      data.endDate,
      true,
      false,
    ]
  )

  return mapSubscriptionFromDb(result.rows[0])
}

/**
 * Atualiza uma assinatura existente
 */
export async function updateTenantSubscription(
  id: string,
  updates: {
    planType?: PlanType
    subscriptionStartDate?: Date
    subscriptionEndDate?: Date
    isActive?: boolean
    isTrial?: boolean
  }
): Promise<Subscription> {
  const updatesList: string[] = []
  const values: any[] = []
  let paramIndex = 1

  if (updates.planType !== undefined) {
    updatesList.push(`plan_type = $${paramIndex++}`)
    values.push(updates.planType)
  }

  if (updates.subscriptionStartDate !== undefined) {
    updatesList.push(`subscription_start_date = $${paramIndex++}`)
    values.push(updates.subscriptionStartDate)
  }

  if (updates.subscriptionEndDate !== undefined) {
    updatesList.push(`subscription_end_date = $${paramIndex++}`)
    values.push(updates.subscriptionEndDate)
  }

  if (updates.isActive !== undefined) {
    updatesList.push(`is_active = $${paramIndex++}`)
    values.push(updates.isActive)
  }

  if (updates.isTrial !== undefined) {
    updatesList.push(`is_trial = $${paramIndex++}`)
    values.push(updates.isTrial)
  }

  if (updatesList.length === 0) {
    throw new Error('Nenhum campo para atualizar')
  }

  updatesList.push(`updated_at = NOW()`)
  values.push(id)

  const result = await query(
    `UPDATE subscriptions SET ${updatesList.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  )

  if (result.rows.length === 0) {
    throw new Error('Assinatura não encontrada')
  }

  return mapSubscriptionFromDb(result.rows[0])
}

// ============================================
// WHATSAPP INSTANCES
// ============================================

export interface WhatsAppInstance {
  id: string
  tenantId: string
  instanceName: string
  phoneNumber?: string | null
  status: 'created' | 'connected' | 'disconnected' | 'connecting'
  integration: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateWhatsAppInstanceData {
  tenantId: string
  instanceName: string
  phoneNumber?: string | null
  status?: 'created' | 'connected' | 'disconnected' | 'connecting'
  integration?: string
}

/**
 * Busca instância WhatsApp por tenant
 */
export async function getWhatsAppInstanceByTenant(tenantId: string): Promise<WhatsAppInstance | null> {
  const result = await query(
    `SELECT * FROM whatsapp_instances 
     WHERE tenant_id = $1 AND deleted_at IS NULL 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [tenantId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapWhatsAppInstanceFromDb(result.rows[0])
}

/**
 * Busca instância WhatsApp por nome
 */
export async function getWhatsAppInstanceByName(instanceName: string): Promise<WhatsAppInstance | null> {
  const result = await query(
    `SELECT * FROM whatsapp_instances 
     WHERE instance_name = $1 AND deleted_at IS NULL 
     LIMIT 1`,
    [instanceName]
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapWhatsAppInstanceFromDb(result.rows[0])
}

/**
 * Cria uma nova instância WhatsApp
 */
export async function createWhatsAppInstance(
  data: CreateWhatsAppInstanceData
): Promise<WhatsAppInstance> {
  const result = await query(
    `INSERT INTO whatsapp_instances (
      tenant_id, instance_name, phone_number, status, integration
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      data.tenantId,
      data.instanceName,
      data.phoneNumber || null,
      data.status || 'created',
      data.integration || 'WHATSAPP-BAILEYS',
    ]
  )

  return mapWhatsAppInstanceFromDb(result.rows[0])
}

/**
 * Atualiza status da instância
 */
export async function updateWhatsAppInstanceStatus(
  id: string,
  status: 'created' | 'connected' | 'disconnected' | 'connecting'
): Promise<WhatsAppInstance> {
  const result = await query(
    `UPDATE whatsapp_instances 
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [status, id]
  )

  if (result.rows.length === 0) {
    throw new Error('Instância não encontrada')
  }

  return mapWhatsAppInstanceFromDb(result.rows[0])
}

/**
 * Deleta instância (soft delete)
 */
export async function deleteWhatsAppInstance(id: string): Promise<void> {
  await query(
    `UPDATE whatsapp_instances 
     SET deleted_at = NOW()
     WHERE id = $1`,
    [id]
  )
}

/**
 * Mapeia resultado do banco para WhatsAppInstance
 */
function mapWhatsAppInstanceFromDb(row: any): WhatsAppInstance {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    instanceName: row.instance_name,
    phoneNumber: row.phone_number,
    status: row.status,
    integration: row.integration,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

/**
 * Mapeia resultado do banco para PlanOrder
 */
function mapPlanOrderFromDb(row: any): PlanOrder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planType: row.plan_type,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerDocument: row.customer_document,
    customerPhone: row.customer_phone,
    paymentMethod: row.payment_method,
    status: row.status,
    amount: row.amount,
    validityDays: row.validity_days,
    paghiperOrderId: row.paghiper_order_id,
    paghiperTransactionId: row.paghiper_transaction_id,
    paghiperResponse: row.paghiper_response,
    dueDate: row.due_date ? new Date(row.due_date) : null,
    paidAt: row.paid_at ? new Date(row.paid_at) : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

/**
 * Mapeia resultado do banco para Subscription
 */
function mapSubscriptionFromDb(row: any): Subscription {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planType: row.plan_type,
    trialStartDate: new Date(row.trial_start_date),
    trialEndDate: new Date(row.trial_end_date),
    subscriptionStartDate: row.subscription_start_date
      ? new Date(row.subscription_start_date)
      : null,
    subscriptionEndDate: row.subscription_end_date
      ? new Date(row.subscription_end_date)
      : null,
    isActive: row.is_active,
    isTrial: row.is_trial,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

