import express from 'express'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)
router.use(tenantGuard)

// Resumo financeiro
router.get('/financial-summary', async (req: AuthRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query

    let sql = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as profit
      FROM transactions
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `

    const params: any[] = [req.user!.tenantId]

    if (startDate) {
      sql += ` AND date >= $${params.length + 1}`
      params.push(startDate)
    }

    if (endDate) {
      sql += ` AND date <= $${params.length + 1}`
      params.push(endDate)
    }

    const result = await query(sql, params)
    res.json({ summary: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

// Produtos mais vendidos
router.get('/top-products', async (req: any, res, next) => {
  try {
    const result = await query(
      `SELECT 
        oi.menu_item_id,
        oi.menu_item_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.tenant_id = $1 AND o.status = 'delivered' AND o.deleted_at IS NULL
       GROUP BY oi.menu_item_id, oi.menu_item_name
       ORDER BY total_quantity DESC
       LIMIT 5`,
      [req.user!.tenantId]
    )

    res.json({ products: result.rows })
  } catch (error) {
    next(error)
  }
})

// Dados do gráfico de vendas
router.get('/sales-chart', async (req: any, res, next) => {
  try {
    const { startDate, endDate } = req.query

    let sql = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(total) as revenue
      FROM orders
      WHERE tenant_id = $1 AND status = 'delivered' AND deleted_at IS NULL
    `

    const params: any[] = [req.user!.tenantId]

    if (startDate) {
      sql += ` AND created_at >= $${params.length + 1}`
      params.push(startDate)
    }

    if (endDate) {
      sql += ` AND created_at <= $${params.length + 1}`
      params.push(endDate)
    }

    sql += ` GROUP BY DATE(created_at) ORDER BY date`

    const result = await query(sql, params)
    res.json({ chart: result.rows })
  } catch (error) {
    next(error)
  }
})

export { router as dashboardRoutes }

