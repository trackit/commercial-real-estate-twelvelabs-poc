import { Request, Response, NextFunction } from 'express'

export interface ApiError extends Error {
  statusCode?: number
  code?: string
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err.message)

  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'
  const code = err.code || 'INTERNAL_ERROR'

  res.status(statusCode).json({
    error: true,
    message,
    code,
  })
}

export function createError(message: string, statusCode: number, code?: string): ApiError {
  const error: ApiError = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    error: true,
    message: 'Not found',
    code: 'NOT_FOUND',
  })
}
