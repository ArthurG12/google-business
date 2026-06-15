import cors from 'cors'
import express, { Request, Response } from 'express'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  extractPubSubMessageId,
  normalizeReviewNotification,
  parseWebhookBody,
} from '../google-business/parse-review-notification'
import { GoogleBusinessService } from '../google-business/service'
import { checkGoogleBusinessConfig, isGoogleBusinessReady } from '../google-business/config-check'
import { apiKeyMiddleware } from './api-key-middleware'

const service = new GoogleBusinessService()

function requireClientId(req: Request, res: Response): string | null {
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId.trim() : ''
  if (!clientId) {
    res.status(400).json({ message: 'clientId é obrigatório' })
    return null
  }
  return clientId
}

function requireParam(
  _req: Request,
  res: Response,
  name: string,
  value: string | undefined,
): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    res.status(400).json({ message: `${name} é obrigatório` })
    return null
  }
  return trimmed
}

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/api/v1/google-business/panel', (_req, res) => {
    const panelPath = join(process.cwd(), 'public', 'panel.html')
    res.type('html').send(readFileSync(panelPath, 'utf8'))
  })

  app.get('/api/v1/google-business/health', (_req, res) => {
    const checks = checkGoogleBusinessConfig()
    res.json({
      ok: isGoogleBusinessReady(),
      checks,
    })
  })

  app.get('/api/v1/google-business/oauth/callback', async (req, res) => {
    try {
      const code = typeof req.query.code === 'string' ? req.query.code : ''
      const state = typeof req.query.state === 'string' ? req.query.state : ''
      const { clientId } = await service.handleOAuthCallback(code, state)
      res.redirect(service.getSuccessRedirectUrl(clientId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(400).send(`Erro OAuth: ${message}`)
    }
  })

  app.get('/api/v1/google-business/oauth/start', apiKeyMiddleware, async (req, res) => {
    try {
      const clientId = requireClientId(req, res)
      if (!clientId) return
      const result = await service.startOAuth(clientId)
      res.json(result)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.get('/api/v1/google-business/status', apiKeyMiddleware, async (req, res) => {
    try {
      const clientId = requireClientId(req, res)
      if (!clientId) return
      res.json(await service.getConnectionStatus(clientId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.get('/api/v1/google-business/accounts', apiKeyMiddleware, async (req, res) => {
    try {
      const clientId = requireClientId(req, res)
      if (!clientId) return
      res.json(await service.listAccounts(clientId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.get('/api/v1/google-business/locations', apiKeyMiddleware, async (req, res) => {
    try {
      const clientId = requireClientId(req, res)
      if (!clientId) return
      const accountId =
        typeof req.query.accountId === 'string' ? req.query.accountId : undefined
      res.json(await service.listLocations(clientId, accountId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.get('/api/v1/google-business/locations/:locationId/reviews', apiKeyMiddleware, async (req, res) => {
    try {
      const clientId = requireClientId(req, res)
      if (!clientId) return
      const locationId = requireParam(req, res, 'locationId', req.params.locationId)
      if (!locationId) return
      const accountId =
        typeof req.query.accountId === 'string' ? req.query.accountId : undefined
      res.json(await service.listReviews(clientId, locationId, accountId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.post(
    '/api/v1/google-business/locations/:locationId/reviews/:reviewId/suggest-reply',
    apiKeyMiddleware,
    async (req, res) => {
      try {
        const clientId = requireClientId(req, res)
        if (!clientId) return
        const locationId = requireParam(req, res, 'locationId', req.params.locationId)
        if (!locationId) return
        const reviewId = requireParam(req, res, 'reviewId', req.params.reviewId)
        if (!reviewId) return
        res.json(await service.suggestReply(clientId, locationId, reviewId))
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        res.status(500).json({ message })
      }
    },
  )

  app.post(
    '/api/v1/google-business/locations/:locationId/reviews/:reviewId/reply',
    apiKeyMiddleware,
    async (req, res) => {
      try {
        const clientId = requireClientId(req, res)
        if (!clientId) return
        const locationId = requireParam(req, res, 'locationId', req.params.locationId)
        if (!locationId) return
        const reviewId = requireParam(req, res, 'reviewId', req.params.reviewId)
        if (!reviewId) return
        const reply = typeof req.body?.reply === 'string' ? req.body.reply : ''
        if (!reply.trim()) {
          res.status(400).json({ message: 'reply é obrigatório' })
          return
        }
        res.json(
          await service.publishReply({
            clientId,
            accountId: typeof req.body?.accountId === 'string' ? req.body.accountId : undefined,
            locationId,
            reviewId,
            reply,
            origin: 'manual',
            force: !!req.body?.force,
          }),
        )
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        res.status(500).json({ message })
      }
    },
  )

  app.post('/api/v1/google-business/webhooks/reviews', async (req, res) => {
    try {
      const payload =
        req.body && Object.keys(req.body).length
          ? parseWebhookBody(req.body)
          : normalizeReviewNotification({})

      if (!payload.reviewName && !payload.locationName && !payload.eventType) {
        res.status(400).json({ message: 'Payload inválido' })
        return
      }

      const messageId =
        extractPubSubMessageId(req.body) ||
        req.header('x-message-id') ||
        undefined

      const result = await service.receiveReviewNotification(payload, {
        source: 'http',
        messageId,
      })

      res.status(200).json(result)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.post(
    '/api/v1/google-business/locations/:locationId/reviews/:reviewId/auto-reply',
    apiKeyMiddleware,
    async (req, res) => {
      try {
        const clientId = requireClientId(req, res)
        if (!clientId) return
        const accountId =
          typeof req.query.accountId === 'string' ? req.query.accountId : ''
        if (!accountId) {
          res.status(400).json({ message: 'accountId é obrigatório' })
          return
        }
        const locationId = requireParam(req, res, 'locationId', req.params.locationId)
        if (!locationId) return
        const reviewId = requireParam(req, res, 'reviewId', req.params.reviewId)
        if (!reviewId) return
        res.json(await service.autoProcessReview(clientId, accountId, locationId, reviewId))
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        res.status(500).json({ message })
      }
    },
  )

  return app
}
