import express from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

// Rota pública: buscar horários de funcionamento por slug do tenant
router.get('/operating-hours/public/:tenantSlug', async (req, res, next) => {
  try {
    // Primeiro busca o tenant pelo slug
    const tenantResult = await query(
      'SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL',
      [req.params.tenantSlug]
    )

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    const tenantId = tenantResult.rows[0].id

    // Busca os horários de funcionamento
    const result = await query(
      'SELECT day, enabled, start_time as "startTime", end_time as "endTime" FROM operating_hours WHERE tenant_id = $1 ORDER BY day',
      [tenantId]
    )

    res.json({ hours: result.rows })
  } catch (error) {
    next(error)
  }
})

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

// --- Senha do Resumo Financeiro (proteger visibilidade no dashboard) ---

// Verifica se o tenant tem senha configurada para o resumo financeiro
router.get('/financial-summary-password-status', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT financial_summary_password_hash FROM dashboard_settings WHERE tenant_id = $1',
      [req.user!.tenantId]
    )
    const hasPassword = result.rows.length > 0 && !!result.rows[0].financial_summary_password_hash
    res.json({ hasPassword })
  } catch (error) {
    next(error)
  }
})

const setPasswordSchema = z.object({
  action: z.literal('set'),
  newPassword: z.string().min(4, 'Senha deve ter no mínimo 4 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { message: 'As senhas não coincidem', path: ['confirmPassword'] })

const verifyPasswordSchema = z.object({
  action: z.literal('verify'),
  password: z.string().min(1, 'Digite a senha'),
})

router.post('/financial-summary-password', async (req: AuthRequest, res, next) => {
  try {
    const body = req.body as { action: string }
    if (body.action === 'set') {
      const data = setPasswordSchema.parse(req.body)
      const hash = await bcrypt.hash(data.newPassword, 10)
      await query(
        `INSERT INTO dashboard_settings (tenant_id, financial_summary_password_hash, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (tenant_id) DO UPDATE
         SET financial_summary_password_hash = EXCLUDED.financial_summary_password_hash,
             updated_at = NOW()`,
        [req.user!.tenantId, hash]
      )
      return res.json({ success: true, message: 'Senha definida com sucesso' })
    }
    if (body.action === 'verify') {
      const data = verifyPasswordSchema.parse(req.body)
      const result = await query(
        'SELECT financial_summary_password_hash FROM dashboard_settings WHERE tenant_id = $1',
        [req.user!.tenantId]
      )
      if (result.rows.length === 0 || !result.rows[0].financial_summary_password_hash) {
        return res.status(400).json({ error: 'Nenhuma senha configurada', valid: false })
      }
      const valid = await bcrypt.compare(data.password, result.rows[0].financial_summary_password_hash)
      return res.json({ valid })
    }
    return res.status(400).json({ error: 'Ação inválida' })
  } catch (error) {
    next(error)
  }
})

export { router as settingsRoutes }

