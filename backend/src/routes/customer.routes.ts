import express from 'express'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'
import { errorHandler } from '../middleware/errorHandler.js'

const router = express.Router()

router.use(authenticate)
router.use(tenantGuard)

// Schema de validação para criação de cliente
const createCustomerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
})

// Listar clientes
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, phone, email, created_at, updated_at FROM customers WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [req.user!.tenantId]
    )

    // Converter para formato esperado pelo frontend
    const customers = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email || undefined,
      createdAt: row.created_at,
    }))

    res.json({ customers })
  } catch (error) {
    next(error)
  }
})

// Criar cliente
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' })
    }

    const validation = createCustomerSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validation.error.errors,
      })
    }

    const { name, phone, email } = validation.data
    const tenantId = req.user.tenantId

    // Verificar se já existe cliente com mesmo telefone no tenant
    const existing = await query(
      'SELECT id FROM customers WHERE tenant_id = $1 AND phone = $2 AND deleted_at IS NULL',
      [tenantId, phone]
    )

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Cliente com este telefone já está cadastrado',
      })
    }

    // Inserir cliente
    const result = await query(
      `INSERT INTO customers (tenant_id, name, phone, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, name, phone, email, created_at, updated_at`,
      [tenantId, name, phone, email || null]
    )

    const customer = result.rows[0]

    res.status(201).json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || undefined,
        createdAt: customer.created_at,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Atualizar cliente
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' })
    }

    const validation = createCustomerSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validation.error.errors,
      })
    }

    const { id } = req.params
    const { name, phone, email } = validation.data
    const tenantId = req.user.tenantId

    // Verificar se o cliente existe e pertence ao tenant
    const existing = await query(
      'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' })
    }

    // Verificar se outro cliente já tem este telefone
    const phoneCheck = await query(
      'SELECT id FROM customers WHERE tenant_id = $1 AND phone = $2 AND id != $3 AND deleted_at IS NULL',
      [tenantId, phone, id]
    )

    if (phoneCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Cliente com este telefone já está cadastrado',
      })
    }

    // Atualizar cliente
    const result = await query(
      `UPDATE customers 
       SET name = $1, phone = $2, email = $3, updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5 AND deleted_at IS NULL
       RETURNING id, name, phone, email, created_at, updated_at`,
      [name, phone, email || null, id, tenantId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' })
    }

    const customer = result.rows[0]

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || undefined,
        createdAt: customer.created_at,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Deletar cliente (soft delete)
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' })
    }

    const { id } = req.params
    const tenantId = req.user.tenantId

    // Soft delete
    const result = await query(
      'UPDATE customers SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id',
      [id, tenantId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' })
    }

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export { router as customerRoutes }

