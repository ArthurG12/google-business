import { NextFunction, Request, Response } from 'express'
import { GOOGLE_BUSINESS_CONFIG } from '../google-business/constants'

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const configuredKey = GOOGLE_BUSINESS_CONFIG.API_KEY
  if (!configuredKey) {
    next()
    return
  }

  const headerKey = req.header('x-api-key')
  const queryKey = typeof req.query.apiKey === 'string' ? req.query.apiKey : undefined

  if (headerKey === configuredKey || queryKey === configuredKey) {
    next()
    return
  }

  res.status(401).json({ message: 'API key inválida para Google Business' })
}
