import { onRequest } from 'firebase-functions/v2/https'
import { allSecrets, applySecretsToProcessEnv } from '../config/secrets'
import { getService } from '../lib/service-factory'
import {
  extractPubSubMessageId,
  normalizeReviewNotification,
  parseWebhookBody,
} from '../pubsub/parse-review-notification'

function isAuthorized(req: { header(name: string): string | undefined }): boolean {
  applySecretsToProcessEnv()
  const configured = process.env.WEBHOOK_SECRET || ''
  if (!configured) {
    return true
  }

  const header =
    req.header('x-webhook-secret') ||
    req.header('authorization')?.replace(/^Bearer\s+/i, '')
  return header === configured
}

export const onGoogleBusinessReviewWebhook = onRequest(
  {
    secrets: allSecrets,
    region: 'us-central1',
    invoker: 'public',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ message: 'Use POST' })
      return
    }

    if (!isAuthorized(req)) {
      res.status(401).json({ message: 'Webhook secret inválido' })
      return
    }

    try {
      const payload =
        req.body && Object.keys(req.body as object).length
          ? parseWebhookBody(req.body)
          : normalizeReviewNotification({})

      if (!payload.reviewName && !payload.locationName && !payload.eventType) {
        res.status(400).json({
          message:
            'Payload inválido. Envie JSON Google (review/location/type) ou envelope Pub/Sub push.',
        })
        return
      }

      const messageId =
        extractPubSubMessageId(req.body) || req.header('x-message-id') || undefined

      console.log('HTTP review webhook received', {
        messageId,
        eventType: payload.eventType,
        reviewName: payload.reviewName,
        locationName: payload.locationName,
      })

      const result = await getService().receiveReviewNotification(payload, {
        source: 'http',
        messageId,
      })

      res.status(200).json(result)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('HTTP review webhook failed', { message })
      res.status(500).json({ message })
    }
  },
)
