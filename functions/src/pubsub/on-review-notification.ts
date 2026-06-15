import { onMessagePublished } from 'firebase-functions/v2/pubsub'
import { allSecrets } from '../config/secrets'
import { getService } from '../lib/service-factory'
import { parsePubSubMessageData } from './parse-review-notification'

const PUBSUB_TOPIC = process.env.GOOGLE_PUBSUB_TOPIC || 'google-business-reviews'

export const onGoogleBusinessReviewNotification = onMessagePublished(
  {
    topic: PUBSUB_TOPIC,
    secrets: allSecrets,
    region: 'us-central1',
  },
  async (event) => {
    const payload = parsePubSubMessageData(event.data.message.data)
    const messageId = event.data.message.messageId

    console.log('Pub/Sub review notification received', {
      messageId,
      eventType: payload.eventType,
      reviewName: payload.reviewName,
      locationName: payload.locationName,
    })

    const result = await getService().receiveReviewNotification(payload, {
      source: 'pubsub',
      messageId,
    })

    console.log('Pub/Sub review notification stored', result)
    return result
  },
)
