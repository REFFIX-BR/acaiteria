import express from 'express'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)
router.use(tenantGuard)

// KPIs: Vendas por período e faturamento total
router.get('/kpis', async (req: AuthRequest, res, next) => {
  try {
    const { period, startDate, endDate } = req.query
    const tenantId = req.user!.tenantId

    // Calcular vendas do período (incluindo transações e pedidos entregues)
    let periodStart: Date | null = null
    let periodEnd: Date | null = null

    if (period === 'custom' && startDate && endDate) {
      periodStart = new Date(startDate as string)
      periodEnd = new Date(endDate as string)
    } else {
      const now = new Date()
      switch (period) {
        case 'today':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          break
        case 'week':
          const weekStart = new Date(now)
          weekStart.setDate(now.getDate() - now.getDay() + 1) // Segunda-feira
          weekStart.setHours(0, 0, 0, 0)
          periodStart = weekStart
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekStart.getDate() + 6)
          weekEnd.setHours(23, 59, 59, 999)
          periodEnd = weekEnd
          break
        case 'month':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
          break
        case 'year':
          periodStart = new Date(now.getFullYear(), 0, 1)
          periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
          break
      }
    }

    // Vendas do período: transações + pedidos entregues
    let periodSales = 0

    if (periodStart && periodEnd) {
      // Transações de receita no período
      const transactionsResult = await query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE tenant_id = $1 AND type = 'income' AND deleted_at IS NULL
         AND date >= $2 AND date <= $3`,
        [tenantId, periodStart, periodEnd]
      )
      periodSales += parseFloat(transactionsResult.rows[0]?.total || '0')

      // Pedidos entregues no período
      const ordersResult = await query(
        `SELECT COALESCE(SUM(total), 0) as total
         FROM orders
         WHERE tenant_id = $1 AND status = 'delivered' AND deleted_at IS NULL
         AND delivered_at >= $2 AND delivered_at <= $3`,
        [tenantId, periodStart, periodEnd]
      )
      periodSales += parseFloat(ordersResult.rows[0]?.total || '0')
    }

    // Faturamento total (todas as transações de receita + todos os pedidos entregues)
    const totalRevenueResult = await query(
      `SELECT 
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tenant_id = $1 AND type = 'income' AND deleted_at IS NULL) +
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE tenant_id = $1 AND status = 'delivered' AND deleted_at IS NULL) as total_revenue`,
      [tenantId]
    )
    const totalRevenue = parseFloat(totalRevenueResult.rows[0]?.total_revenue || '0')

    res.json({
      periodSales,
      totalRevenue,
    })
  } catch (error) {
    next(error)
  }
})

// Resumo financeiro (entradas vs saídas)
router.get('/financial-summary', async (req: AuthRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query
    const tenantId = req.user!.tenantId

    let sql = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses
      FROM transactions
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `

    const params: any[] = [tenantId]

    if (startDate) {
      sql += ` AND date >= $${params.length + 1}`
      params.push(startDate)
    }

    if (endDate) {
      sql += ` AND date <= $${params.length + 1}`
      params.push(endDate)
    }

    const result = await query(sql, params)
    const income = parseFloat(result.rows[0]?.total_income || '0')
    const expenses = parseFloat(result.rows[0]?.total_expenses || '0')

    // Adicionar receita de pedidos entregues
    let ordersSql = `
      SELECT COALESCE(SUM(total), 0) as total
      FROM orders
      WHERE tenant_id = $1 AND status = 'delivered' AND deleted_at IS NULL
    `
    const ordersParams: any[] = [tenantId]

    if (startDate) {
      ordersSql += ` AND delivered_at >= $${ordersParams.length + 1}`
      ordersParams.push(startDate)
    }

    if (endDate) {
      ordersSql += ` AND delivered_at <= $${ordersParams.length + 1}`
      ordersParams.push(endDate)
    }

    const ordersResult = await query(ordersSql, ordersParams)
    const ordersIncome = parseFloat(ordersResult.rows[0]?.total || '0')
    const totalIncome = income + ordersIncome

    res.json({
      summary: {
        income: totalIncome,
        expenses,
        profit: totalIncome - expenses,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Produtos mais vendidos
router.get('/top-products', async (req: AuthRequest, res, next) => {
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
       ORDER BY total_revenue DESC
       LIMIT 5`,
      [req.user!.tenantId]
    )

    res.json({ products: result.rows })
  } catch (error) {
    next(error)
  }
})

// Produtos com estoque baixo
router.get('/low-stock', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, current_stock, min_stock
       FROM products
       WHERE tenant_id = $1 AND deleted_at IS NULL
       AND current_stock <= min_stock
       ORDER BY current_stock ASC`,
      [req.user!.tenantId]
    )

    res.json({ products: result.rows })
  } catch (error) {
    next(error)
  }
})

// Dados do gráfico de vendas
router.get('/sales-chart', async (req: AuthRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query
    const tenantId = req.user!.tenantId

    let sql = `
      SELECT 
        DATE(COALESCE(delivered_at, created_at)) as date,
        SUM(total) as sales
      FROM orders
      WHERE tenant_id = $1 AND status = 'delivered' AND deleted_at IS NULL
    `

    const params: any[] = [tenantId]

    if (startDate) {
      sql += ` AND COALESCE(delivered_at, created_at) >= $${params.length + 1}`
      params.push(startDate)
    }

    if (endDate) {
      sql += ` AND COALESCE(delivered_at, created_at) <= $${params.length + 1}`
      params.push(endDate)
    }

    sql += ` GROUP BY DATE(COALESCE(delivered_at, created_at)) ORDER BY date`

    const ordersResult = await query(sql, params)
    
    // Adicionar transações de receita
    let transactionsSql = `
      SELECT 
        DATE(date) as date,
        SUM(amount) as sales
      FROM transactions
      WHERE tenant_id = $1 AND type = 'income' AND deleted_at IS NULL
    `
    const transactionsParams: any[] = [tenantId]

    if (startDate) {
      transactionsSql += ` AND date >= $${transactionsParams.length + 1}`
      transactionsParams.push(startDate)
    }

    if (endDate) {
      transactionsSql += ` AND date <= $${transactionsParams.length + 1}`
      transactionsParams.push(endDate)
    }

    transactionsSql += ` GROUP BY DATE(date) ORDER BY date`
    const transactionsResult = await query(transactionsSql, transactionsParams)

    // Combinar resultados
    const salesMap = new Map<string, number>()
    
    ordersResult.rows.forEach((row: any) => {
      const date = row.date
      const existing = salesMap.get(date) || 0
      salesMap.set(date, existing + parseFloat(row.sales || '0'))
    })

    transactionsResult.rows.forEach((row: any) => {
      const date = row.date
      const existing = salesMap.get(date) || 0
      salesMap.set(date, existing + parseFloat(row.sales || '0'))
    })

    const chart = Array.from(salesMap.entries())
      .map(([date, sales]) => ({ date, sales }))
      .sort((a, b) => a.date.localeCompare(b.date))

    res.json({ chart })
  } catch (error) {
    next(error)
  }
})

export { router as dashboardRoutes }

