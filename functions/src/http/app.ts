import cors from 'cors'
import express, { Request, Response } from 'express'
import { getService } from '../lib/service-factory'
import {
  extractPubSubMessageId,
  normalizeReviewNotification,
  parseWebhookBody,
} from '../pubsub/parse-review-notification'

function requireClientId(req: Request, res: Response): string | null {
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId.trim() : ''
  if (!clientId) {
    res.status(400).json({ message: 'clientId é obrigatório' })
    return null
  }
  return clientId
}

export function createFunctionsApp(): express.Express {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/google-business/oauth/start', async (req, res) => {
    try {
      const clientId = requireClientId(req, res)
      if (!clientId) return
      res.json(await getService().startOAuth(clientId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.get('/google-business/oauth/callback', async (req, res) => {
    try {
      const code = typeof req.query.code === 'string' ? req.query.code : ''
      const state = typeof req.query.state === 'string' ? req.query.state : ''
      const svc = getService()
      const { clientId } = await svc.handleOAuthCallback(code, state)
      res.redirect(svc.getSuccessRedirectUrl(clientId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(400).send(`Erro OAuth: ${message}`)
    }
  })

  app.get('/google-business/status', async (req, res) => {
    try {
      const clientId = requireClientId(req, res)
      if (!clientId) return
      res.json(await getService().getConnectionStatus(clientId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.post('/google-business/webhooks/reviews', async (req, res) => {
    try {
      const payload =
        req.body && Object.keys(req.body as object).length
          ? parseWebhookBody(req.body)
          : normalizeReviewNotification({})

      if (!payload.reviewName && !payload.locationName && !payload.eventType) {
        res.status(400).json({ message: 'Payload inválido' })
        return
      }

      const messageId =
        extractPubSubMessageId(req.body) || req.header('x-message-id') || undefined
      const result = await getService().receiveReviewNotification(payload, {
        source: 'http',
        messageId,
      })
      res.status(200).json(result)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.get('/google-business/accounts', async (req, res) => {
    try {
      const clientId = requireClientId(req, res)
      if (!clientId) return
      res.json(await getService().listAccounts(clientId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.get('/google-business/locations', async (req, res) => {
    try {
      const clientId = requireClientId(req, res)
      if (!clientId) return
      const accountId =
        typeof req.query.accountId === 'string' ? req.query.accountId : undefined
      res.json(await getService().listLocations(clientId, accountId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  app.post('/google-business/notifications/setup', async (req, res) => {
    try {
      const clientId = requireClientId(req, res)
      if (!clientId) return
      res.json(await getService().setupReviewNotifications(clientId))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({ message })
    }
  })

  return app
}
