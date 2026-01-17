import express from 'express'
import { z } from 'zod'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'
import { getWhatsAppInstanceByTenant } from '../db/storage.js'
import { getWhatsAppInstanceManager } from '../lib/whatsapp/whatsappInstanceManager.js'

const router = express.Router()

router.use(authenticate)
router.use(tenantGuard)

const createOrderSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerEmail: z.string().email().optional(),
  items: z.array(z.object({
    menuItemId: z.string(),
    menuItemName: z.string(),
    size: z.string().optional(),
    additions: z.array(z.string()),
    complements: z.array(z.string()),
    fruits: z.array(z.string()),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    totalPrice: z.number().min(0),
  })),
  subtotal: z.number().min(0),
  total: z.number().min(0),
  paymentMethod: z.enum(['cash', 'card', 'pix', 'other']).optional(),
  deliveryType: z.enum(['pickup', 'delivery']),
  deliveryAddress: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(['digital', 'counter']).default('digital'),
})

// Listar pedidos
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status, source } = req.query

    let sql = `
      SELECT o.*,
      COALESCE(
        json_agg(
          jsonb_build_object(
            'id', oi.id,
            'menuItemId', oi.menu_item_id,
            'menuItemName', oi.menu_item_name,
            'size', oi.size,
            'additions', oi.additions,
            'complements', oi.complements,
            'fruits', oi.fruits,
            'quantity', oi.quantity,
            'unitPrice', oi.unit_price,
            'totalPrice', oi.total_price
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.tenant_id = $1 AND o.deleted_at IS NULL
    `

    const params: any[] = [req.user!.tenantId]
    let paramCount = 2

    if (status) {
      sql += ` AND o.status = $${paramCount++}`
      params.push(status)
    }

    if (source) {
      sql += ` AND o.source = $${paramCount++}`
      params.push(source)
    }

    sql += ` GROUP BY o.id ORDER BY o.created_at DESC`

    const result = await query(sql, params)
    res.json({ orders: result.rows })
  } catch (error) {
    next(error)
  }
})

// Criar pedido
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body)

    // Criar pedido
    const orderResult = await query(
      `INSERT INTO orders (tenant_id, customer_name, customer_phone, customer_email, subtotal, total, status, payment_method, delivery_type, delivery_address, notes, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING id`,
      [
        req.user!.tenantId,
        data.customerName,
        data.customerPhone,
        data.customerEmail || null,
        data.subtotal,
        data.total,
        data.paymentMethod || null,
        data.deliveryType,
        data.deliveryAddress || null,
        data.notes || null,
        data.source,
      ]
    )

    const orderId = orderResult.rows[0].id

    // Criar itens do pedido
    for (const item of data.items) {
      // Se menuItemId não for UUID válido, usar NULL (itens podem não estar no banco ainda)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const menuItemId = uuidRegex.test(item.menuItemId) ? item.menuItemId : null
      
      await query(
        `INSERT INTO order_items (order_id, menu_item_id, menu_item_name, size, additions, complements, fruits, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          orderId,
          menuItemId,
          item.menuItemName,
          item.size || null,
          item.additions,
          item.complements,
          item.fruits,
          item.quantity,
          item.unitPrice,
          item.totalPrice,
        ]
      )
    }

    // Criar ou atualizar cliente
    await query(
      `INSERT INTO customers (tenant_id, name, phone, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (tenant_id, phone) DO UPDATE
       SET name = EXCLUDED.name, email = COALESCE(EXCLUDED.email, customers.email), updated_at = NOW()`,
      [req.user!.tenantId, data.customerName, data.customerPhone, data.customerEmail || null]
    )

    res.status(201).json({ id: orderId, message: 'Order created successfully' })
  } catch (error) {
    next(error)
  }
})

// Atualizar status do pedido
router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const { status } = req.body
    const validStatuses = ['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled']

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    // Validar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(req.params.id)) {
      return res.status(400).json({ 
        error: 'Invalid order ID format. Order must be created in the backend first.',
        details: 'The provided ID is not a valid UUID. Please ensure the order was created via the API.'
      })
    }

    const updates: string[] = ['status = $1', 'updated_at = NOW()']
    const params: any[] = [status]

    if (status === 'accepted') {
      updates.push('accepted_at = NOW()')
    } else if (status === 'ready') {
      updates.push('ready_at = NOW()')
    } else if (status === 'delivered') {
      updates.push('delivered_at = NOW()')

      // Criar transação de entrada no fluxo de caixa
      const orderResult = await query(
        'SELECT total FROM orders WHERE id = $1 AND tenant_id = $2',
        [req.params.id, req.user!.tenantId]
      )

      if (orderResult.rows.length > 0) {
        await query(
          `INSERT INTO transactions (tenant_id, type, category, amount, description, date, created_at, updated_at)
           VALUES ($1, 'income', 'Vendas', $2, $3, CURRENT_DATE, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [
            req.user!.tenantId,
            orderResult.rows[0].total,
            `Pedido #${req.params.id} - ${req.body.customerName || 'Cliente'} (${req.body.deliveryType || 'Retirada'})`,
          ]
        )
      }
    }

    params.push(req.params.id, req.user!.tenantId)

    // Buscar dados do pedido antes de atualizar (para obter número do cliente)
    const orderQueryResult = await query(
      `SELECT customer_name, customer_phone, total, delivery_type, status as old_status 
       FROM orders 
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.user!.tenantId]
    )

    if (orderQueryResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Order not found',
        details: 'The order does not exist in the database. Please ensure the order was created via the API first.',
        orderId: req.params.id
      })
    }

    const orderData = orderQueryResult.rows[0]
    const oldStatus = orderData.old_status

    console.log(`[Order] Atualizando status do pedido #${req.params.id}:`, {
      oldStatus,
      newStatus: status,
      statusChanged: oldStatus !== status,
      hasCustomerPhone: !!orderData.customer_phone,
      customerPhone: orderData.customer_phone,
    })

    // Atualizar status do pedido
    const result = await query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = $${params.length - 1} AND tenant_id = $${params.length} AND deleted_at IS NULL RETURNING id`,
      params
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Enviar notificação via WhatsApp se o status mudou e há número do cliente
    if (oldStatus !== status && orderData.customer_phone) {
      console.log(`[Order] Tentando enviar notificação WhatsApp para pedido #${req.params.id}`)
      try {
        // Buscar instância WhatsApp do tenant
        const whatsappInstance = await getWhatsAppInstanceByTenant(req.user!.tenantId)
        
        console.log(`[Order] Instância WhatsApp encontrada:`, {
          hasInstance: !!whatsappInstance,
          instanceName: whatsappInstance?.instanceName,
          status: whatsappInstance?.status,
          hasInstanceToken: !!whatsappInstance?.instanceToken,
          instanceTokenPreview: whatsappInstance?.instanceToken?.substring(0, 20),
        })
        
        // Aceitar instância se estiver 'connected' ou 'created' (pode estar conectada mas status não atualizado)
        const isValidStatus = whatsappInstance?.status === 'connected' || whatsappInstance?.status === 'created'
        
        if (whatsappInstance && isValidStatus && whatsappInstance.instanceToken) {
          // Criar mensagem baseada no status
          const statusMessages: Record<string, string> = {
            accepted: `✅ Pedido #${req.params.id.substring(0, 8)} aceito!\n\nOlá ${orderData.customer_name}, seu pedido foi aceito e está em preparação. Entraremos em contato em breve.`,
            preparing: `👨‍🍳 Pedido #${req.params.id.substring(0, 8)} em preparação!\n\nOlá ${orderData.customer_name}, seu pedido está sendo preparado. Em breve estará pronto!`,
            ready: `🚀 Pedido #${req.params.id.substring(0, 8)} pronto!\n\nOlá ${orderData.customer_name}, seu pedido está pronto para ${orderData.delivery_type === 'delivery' ? 'entrega' : 'retirada'}!`,
            delivered: `✅ Pedido #${req.params.id.substring(0, 8)} entregue!\n\nOlá ${orderData.customer_name}, seu pedido foi entregue. Obrigado pela preferência!`,
            cancelled: `❌ Pedido #${req.params.id.substring(0, 8)} cancelado\n\nOlá ${orderData.customer_name}, lamentamos informar que seu pedido foi cancelado. Entre em contato conosco para mais informações.`,
          }

          const message = statusMessages[status] || `📦 Atualização do Pedido #${req.params.id.substring(0, 8)}\n\nOlá ${orderData.customer_name}, o status do seu pedido foi atualizado para: ${status}`

          console.log(`[Order] Enviando mensagem WhatsApp:`, {
            instanceName: whatsappInstance.instanceName,
            customerPhone: orderData.customer_phone,
            messagePreview: message.substring(0, 100),
            status,
          })

          // Enviar mensagem via WhatsApp (não bloquear se falhar)
          const manager = getWhatsAppInstanceManager()
          const sendResult = await manager.sendTextMessage(
            whatsappInstance.instanceName,
            whatsappInstance.instanceToken,
            orderData.customer_phone,
            message
          )
          
          console.log(`[Order] Resultado do envio:`, sendResult)

          if (sendResult.success) {
            console.log(`[Order] ✅ Notificação WhatsApp enviada para pedido #${req.params.id}`)
          } else {
            console.warn(`[Order] ⚠️  Erro ao enviar notificação WhatsApp:`, sendResult.error)
          }
        } else {
          console.log(`[Order] ⚠️  WhatsApp não configurado ou não conectado para o tenant:`, {
            hasInstance: !!whatsappInstance,
            instanceStatus: whatsappInstance?.status,
            hasToken: !!whatsappInstance?.instanceToken,
            tenantId: req.user!.tenantId,
          })
        }
      } catch (whatsappError) {
        // Não bloquear a atualização do pedido se houver erro no WhatsApp
        console.error(`[Order] ❌ Erro ao enviar notificação WhatsApp:`, whatsappError)
      }
    }

    res.json({ message: 'Order status updated successfully' })
  } catch (error) {
    next(error)
  }
})

export { router as orderRoutes }

