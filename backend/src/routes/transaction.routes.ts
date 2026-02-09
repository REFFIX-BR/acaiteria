import express from 'express'
import { z } from 'zod'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)
router.use(tenantGuard)

const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.string().min(1),
  amount: z.number().min(0),
  description: z.string().optional(),
  date: z.string(),
  time: z.string().optional(), // HH:mm ou HH:mm:ss - horário da operação
})

// Listar transações
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { type, category, startDate, endDate } = req.query

    let sql = `
      SELECT * FROM transactions
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `

    const params: any[] = [req.user!.tenantId]
    let paramCount = 2

    if (type) {
      sql += ` AND type = $${paramCount++}`
      params.push(type)
    }

    if (category) {
      sql += ` AND category = $${paramCount++}`
      params.push(category)
    }

    if (startDate) {
      sql += ` AND date >= $${paramCount++}`
      params.push(startDate)
    }

    if (endDate) {
      sql += ` AND date <= $${paramCount++}`
      params.push(endDate)
    }

    sql += ` ORDER BY date DESC, time DESC, created_at DESC`

    const result = await query(sql, params)
    res.json({ transactions: result.rows })
  } catch (error) {
    next(error)
  }
})

// Criar transação
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createTransactionSchema.parse(req.body)

    const timeValue = data.time && /^\d{1,2}:\d{2}(:\d{2})?$/.test(data.time) ? data.time : '00:00'

    const result = await query(
      `INSERT INTO transactions (tenant_id, type, category, amount, description, date, time, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [
        req.user!.tenantId,
        data.type,
        data.category,
        data.amount,
        data.description || null,
        data.date,
        timeValue.length === 5 ? timeValue + ':00' : timeValue,
      ]
    )

    res.status(201).json({ id: result.rows[0].id, message: 'Transaction created successfully' })
  } catch (error) {
    next(error)
  }
})

// Deletar transação
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'UPDATE transactions SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id',
      [req.params.id, req.user!.tenantId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    res.json({ message: 'Transaction deleted successfully' })
  } catch (error) {
    next(error)
  }
})

export { router as transactionRoutes }

