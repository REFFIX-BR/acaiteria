import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../db/connection.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    tenantId: string
    role: string
  }
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.substring(7)

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string
      tenantId: string
    }

    // Buscar usuário no banco
    const result = await query(
      'SELECT id, email, tenant_id, role FROM users WHERE id = $1 AND deleted_at IS NULL',
      [decoded.userId]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' })
    }

    const user = result.rows[0]

    req.user = {
      id: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      role: user.role,
    }

    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    next()
  }
}

// Re-export tenantGuard para facilitar imports
export { tenantGuard } from './tenantGuard.js'


