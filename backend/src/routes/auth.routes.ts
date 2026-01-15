import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { query } from '../db/connection.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  tenantName: z.string().min(1),
  tenantSlug: z.string().min(1),
})

// Login
router.post('/login', async (req, res, next) => {
  try {
    console.log('[Auth] Login attempt:', { email: req.body?.email, hasPassword: !!req.body?.password })
    
    let email: string
    let password: string
    
    try {
      const parsed = loginSchema.parse(req.body)
      email = parsed.email
      password = parsed.password
    } catch (validationError: any) {
      console.error('[Auth] Erro de validação:', validationError.errors)
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: validationError.errors 
      })
    }
    
    console.log('[Auth] Email validado:', email)

    console.log('[Auth] Buscando usuário no banco...')
    const result = await query(
      'SELECT u.id, u.email, u.password_hash, u.name, u.tenant_id, u.role, t.name as tenant_name, t.slug as tenant_slug FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.email = $1 AND u.deleted_at IS NULL AND t.deleted_at IS NULL',
      [email]
    )
    console.log('[Auth] Resultado da query:', { rowsFound: result.rows.length })

    if (result.rows.length === 0) {
      console.log('[Auth] Usuário não encontrado')
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]
    console.log('[Auth] Usuário encontrado:', { id: user.id, email: user.email })
    
    console.log('[Auth] Comparando senha...')
    const isValid = await bcrypt.compare(password, user.password_hash)
    console.log('[Auth] Senha válida:', isValid)

    if (!isValid) {
      console.log('[Auth] Senha inválida')
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Atualizar last_login
    console.log('[Auth] Atualizando last_login...')
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    )

    console.log('[Auth] Gerando token JWT...')
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    console.log('[Auth] Token gerado com sucesso')

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenant_id,
        tenantName: user.tenant_name,
        tenantSlug: user.tenant_slug,
      },
    })
  } catch (error: any) {
    console.error('[Auth] Erro no login:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    next(error)
  }
})

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, tenantName, tenantSlug } = registerSchema.parse(req.body)

    // Verificar se email já existe
    const emailCheck = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    // Verificar se slug já existe
    const slugCheck = await query(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug]
    )

    if (slugCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Slug already taken' })
    }

    // Criar tenant
    const tenantResult = await query(
      `INSERT INTO tenants (name, slug, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id`,
      [tenantName, tenantSlug]
    )

    const tenantId = tenantResult.rows[0].id

    // Criar subscription (trial de 7 dias)
    const trialEndDate = new Date()
    trialEndDate.setDate(trialEndDate.getDate() + 7)

    await query(
      `INSERT INTO subscriptions (tenant_id, plan_type, trial_start_date, trial_end_date, is_active, is_trial, created_at, updated_at)
       VALUES ($1, 'trial', NOW(), $2, true, true, NOW(), NOW())`,
      [tenantId, trialEndDate]
    )

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10)

    // Criar usuário
    const userResult = await query(
      `INSERT INTO users (email, password_hash, name, tenant_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'owner', NOW(), NOW())
       RETURNING id, email, name, role`,
      [email, passwordHash, name, tenantId]
    )

    const user = userResult.rows[0]

    const token = jwt.sign(
      { userId: user.id, tenantId },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId,
        tenantName,
        tenantSlug,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await query(
      `SELECT u.id, u.email, u.name, u.role, u.tenant_id, t.name as tenant_name, t.slug as tenant_slug, t.logo, t.primary_color, t.secondary_color
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1 AND u.deleted_at IS NULL AND t.deleted_at IS NULL`,
      [req.user.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

export { router as authRoutes }


