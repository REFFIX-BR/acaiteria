import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err)

  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'

  // Erro do PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry' })
  }

  if (err.code === '23503') {
    return res.status(400).json({ error: 'Foreign key constraint violation' })
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}


