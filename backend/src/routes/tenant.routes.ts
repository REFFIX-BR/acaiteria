import express from 'express'
import { z } from 'zod'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'
import { getTenantSubscription } from '../db/storage.js'

const router = express.Router()

// Buscar dados completos do tenant atual (autenticado)
router.get('/me', authenticate, tenantGuard, async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId

    // Buscar dados do tenant
    const tenantResult = await query(
      `SELECT id, name, slug, logo, primary_color, secondary_color, created_at
       FROM tenants 
       WHERE id = $1 AND deleted_at IS NULL`,
      [tenantId]
    )

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    const tenant = tenantResult.rows[0]

    // Buscar subscription do tenant
    const subscription = await getTenantSubscription(tenantId)

    // Formatar resposta
    const response: any = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo: tenant.logo,
      primaryColor: tenant.primary_color,
      secondaryColor: tenant.secondary_color,
      createdAt: tenant.created_at,
    }

    if (subscription) {
      response.subscription = {
        id: subscription.id,
        planType: subscription.planType,
        trialStartDate: subscription.trialStartDate,
        trialEndDate: subscription.trialEndDate,
        subscriptionStartDate: subscription.subscriptionStartDate,
        subscriptionEndDate: subscription.subscriptionEndDate,
        isActive: subscription.isActive,
        isTrial: subscription.isTrial,
      }
    }

    res.json({ tenant: response })
  } catch (error) {
    next(error)
  }
})

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
    values.push(req.user!.tenantId)

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

