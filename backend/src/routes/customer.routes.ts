import express from 'express'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)
router.use(tenantGuard)

// Listar clientes
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM customers WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [req.user!.tenantId]
    )

    res.json({ customers: result.rows })
  } catch (error) {
    next(error)
  }
})

export { router as customerRoutes }

