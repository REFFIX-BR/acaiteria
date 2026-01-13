import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.js'
import { query } from '../db/connection.js'

export async function tenantGuard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Verificar se o tenant existe e está ativo
  const result = await query(
    'SELECT id FROM tenants WHERE id = $1 AND deleted_at IS NULL',
    [req.user.tenantId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Tenant not found' })
  }

  next()
}


