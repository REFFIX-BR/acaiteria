import express from 'express'
import { z } from 'zod'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)
router.use(tenantGuard)

const createCampaignSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['promotion', 'whatsapp']),
  status: z.enum(['active', 'paused', 'completed']).default('active'),
  description: z.string().optional(),
  discount: z.number().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
})

// Listar campanhas
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM campaigns WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [req.user!.tenantId]
    )

    res.json({ campaigns: result.rows })
  } catch (error) {
    next(error)
  }
})

// Criar campanha
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createCampaignSchema.parse(req.body)

    const result = await query(
      `INSERT INTO campaigns (tenant_id, name, type, status, description, discount, start_date, end_date, sent, delivered, failed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, 0, NOW(), NOW())
       RETURNING id`,
      [
        req.user!.tenantId,
        data.name,
        data.type,
        data.status,
        data.description || null,
        data.discount || null,
        data.startDate,
        data.endDate || null,
      ]
    )

    res.status(201).json({ id: result.rows[0].id, message: 'Campaign created successfully' })
  } catch (error) {
    next(error)
  }
})

// Atualizar campanha
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = createCampaignSchema.partial().parse(req.body)

    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (data.name) {
      updates.push(`name = $${paramCount++}`)
      values.push(data.name)
    }
    if (data.status) {
      updates.push(`status = $${paramCount++}`)
      values.push(data.status)
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramCount++}`)
      values.push(data.description)
    }
    if (data.discount !== undefined) {
      updates.push(`discount = $${paramCount++}`)
      values.push(data.discount)
    }
    if (data.startDate) {
      updates.push(`start_date = $${paramCount++}`)
      values.push(data.startDate)
    }
    if (data.endDate !== undefined) {
      updates.push(`end_date = $${paramCount++}`)
      values.push(data.endDate)
    }

    updates.push('updated_at = NOW()')
    values.push(req.params.id, req.user!.tenantId)

    const result = await query(
      `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramCount++} AND tenant_id = $${paramCount++} AND deleted_at IS NULL RETURNING id`,
      values
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    res.json({ message: 'Campaign updated successfully' })
  } catch (error) {
    next(error)
  }
})

// Deletar campanha
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'UPDATE campaigns SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id',
      [req.params.id, req.user!.tenantId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    res.json({ message: 'Campaign deleted successfully' })
  } catch (error) {
    next(error)
  }
})

export { router as campaignRoutes }

