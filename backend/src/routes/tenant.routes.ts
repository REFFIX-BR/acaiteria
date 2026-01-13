import express from 'express'
import { z } from 'zod'
import { query } from '../db/connection.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

// Buscar tenant por slug (público)
router.get('/slug/:slug', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, slug, logo, primary_color, secondary_color FROM tenants WHERE slug = $1 AND deleted_at IS NULL',
      [req.params.slug]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    res.json({ tenant: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

// Atualizar tenant (autenticado)
router.put('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, logo, primaryColor, secondaryColor } = req.body

    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (name) {
      updates.push(`name = $${paramCount++}`)
      values.push(name)
    }
    if (logo !== undefined) {
      updates.push(`logo = $${paramCount++}`)
      values.push(logo)
    }
    if (primaryColor) {
      updates.push(`primary_color = $${paramCount++}`)
      values.push(primaryColor)
    }
    if (secondaryColor) {
      updates.push(`secondary_color = $${paramCount++}`)
      values.push(secondaryColor)
    }

    updates.push('updated_at = NOW()')
    values.push(req.user.tenantId)

    await query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${paramCount++}`,
      values
    )

    res.json({ message: 'Tenant updated successfully' })
  } catch (error) {
    next(error)
  }
})

export { router as tenantRoutes }

