import express from 'express'
import { z } from 'zod'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)
router.use(tenantGuard)

const createProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  currentStock: z.number().min(0),
  minStock: z.number().min(0),
  unit: z.string().default('unidade'),
  price: z.number().min(0),
})

// Listar produtos
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM products WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name',
      [req.user!.tenantId]
    )

    res.json({ products: result.rows })
  } catch (error) {
    next(error)
  }
})

// Criar produto
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createProductSchema.parse(req.body)

    const result = await query(
      `INSERT INTO products (tenant_id, name, category, current_stock, min_stock, unit, price, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [
        req.user!.tenantId,
        data.name,
        data.category,
        data.currentStock,
        data.minStock,
        data.unit,
        data.price,
      ]
    )

    res.status(201).json({ id: result.rows[0].id, message: 'Product created successfully' })
  } catch (error) {
    next(error)
  }
})

// Atualizar produto
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = createProductSchema.partial().parse(req.body)

    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (data.name) {
      updates.push(`name = $${paramCount++}`)
      values.push(data.name)
    }
    if (data.category) {
      updates.push(`category = $${paramCount++}`)
      values.push(data.category)
    }
    if (data.currentStock !== undefined) {
      updates.push(`current_stock = $${paramCount++}`)
      values.push(data.currentStock)
    }
    if (data.minStock !== undefined) {
      updates.push(`min_stock = $${paramCount++}`)
      values.push(data.minStock)
    }
    if (data.unit) {
      updates.push(`unit = $${paramCount++}`)
      values.push(data.unit)
    }
    if (data.price !== undefined) {
      updates.push(`price = $${paramCount++}`)
      values.push(data.price)
    }

    updates.push('updated_at = NOW()')
    values.push(req.params.id, req.user!.tenantId)

    const result = await query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount++} AND tenant_id = $${paramCount++} AND deleted_at IS NULL RETURNING id`,
      values
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' })
    }

    res.json({ message: 'Product updated successfully' })
  } catch (error) {
    next(error)
  }
})

// Deletar produto
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'UPDATE products SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id',
      [req.params.id, req.user!.tenantId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' })
    }

    res.json({ message: 'Product deleted successfully' })
  } catch (error) {
    next(error)
  }
})

export { router as productRoutes }

