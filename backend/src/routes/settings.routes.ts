import express from 'express'
import { z } from 'zod'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)
router.use(tenantGuard)

const companySettingsSchema = z.object({
  tradeName: z.string().optional(),
  contactPhone: z.string().optional(),
  cnpj: z.string().optional(),
  adminEmail: z.union([
    z.string().email(),
    z.literal(''),
    z.undefined(),
  ]).optional(),
})

const operatingHoursSchema = z.array(z.object({
  day: z.string(),
  enabled: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
}))

// Obter configurações da empresa
router.get('/company', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM company_settings WHERE tenant_id = $1',
      [req.user!.tenantId]
    )

    if (result.rows.length === 0) {
      return res.json({ settings: null })
    }

    res.json({ settings: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

// Salvar configurações da empresa
router.post('/company', async (req: AuthRequest, res, next) => {
  try {
    const data = companySettingsSchema.parse(req.body)

    await query(
      `INSERT INTO company_settings (tenant_id, trade_name, contact_phone, cnpj, admin_email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (tenant_id) DO UPDATE
       SET trade_name = EXCLUDED.trade_name,
           contact_phone = EXCLUDED.contact_phone,
           cnpj = EXCLUDED.cnpj,
           admin_email = EXCLUDED.admin_email,
           updated_at = NOW()`,
      [
        req.user!.tenantId,
        data.tradeName,
        data.contactPhone || null,
        data.cnpj || null,
        data.adminEmail || null,
      ]
    )

    res.json({ message: 'Company settings saved successfully' })
  } catch (error) {
    next(error)
  }
})

// Obter horários de funcionamento
router.get('/operating-hours', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM operating_hours WHERE tenant_id = $1 ORDER BY day',
      [req.user!.tenantId]
    )

    res.json({ hours: result.rows })
  } catch (error) {
    next(error)
  }
})

// Salvar horários de funcionamento
router.post('/operating-hours', async (req: AuthRequest, res, next) => {
  try {
    const data = operatingHoursSchema.parse(req.body)

    // Deletar horários existentes
    await query(
      'DELETE FROM operating_hours WHERE tenant_id = $1',
      [req.user!.tenantId]
    )

    // Inserir novos horários
    for (const hour of data) {
      await query(
        `INSERT INTO operating_hours (tenant_id, day, enabled, start_time, end_time, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (tenant_id, day) DO UPDATE
         SET enabled = EXCLUDED.enabled,
             start_time = EXCLUDED.start_time,
             end_time = EXCLUDED.end_time,
             updated_at = NOW()`,
        [
          req.user!.tenantId,
          hour.day,
          hour.enabled,
          hour.startTime,
          hour.endTime,
        ]
      )
    }

    res.json({ message: 'Operating hours saved successfully' })
  } catch (error) {
    next(error)
  }
})

export { router as settingsRoutes }

