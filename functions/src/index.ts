import { onRequest } from 'firebase-functions/v2/https'
import { allSecrets } from './config/secrets'
import { createFunctionsApp } from './http/app'
import { onGoogleBusinessReviewWebhook } from './https/on-review-webhook'
import { onGoogleBusinessReviewNotification } from './pubsub/on-review-notification'

const app = createFunctionsApp()

export { onGoogleBusinessReviewNotification, onGoogleBusinessReviewWebhook }

export const googleBusinessApi = onRequest(
  { secrets: allSecrets, cors: true, region: 'us-central1', invoker: 'public' },
  app,
)
