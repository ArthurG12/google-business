import { ReviewNotificationPayload } from '../../google-business-core/types'

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

export function normalizeReviewNotification(
  raw: Record<string, unknown>,
): ReviewNotificationPayload {
  return {
    eventType: pickString(raw.type, raw.eventType, raw.notificationType),
    reviewName: pickString(raw.reviewName, raw.review_name, raw.review),
    locationName: pickString(raw.locationName, raw.location_name, raw.location),
    accountName: pickString(raw.accountName, raw.account_name, raw.account),
  }
}

export function parsePubSubMessageData(data?: string): ReviewNotificationPayload {
  if (!data) {
    return {}
  }

  try {
    const decoded = Buffer.from(data, 'base64').toString('utf8')
    const parsed = JSON.parse(decoded) as Record<string, unknown>
    return normalizeReviewNotification(parsed)
  } catch {
    return {}
  }
}

export function parseWebhookBody(body: unknown): ReviewNotificationPayload {
  if (!body || typeof body !== 'object') {
    return {}
  }

  const record = body as Record<string, unknown>

  if (record.message && typeof record.message === 'object') {
    const message = record.message as Record<string, unknown>
    if (typeof message.data === 'string') {
      return parsePubSubMessageData(message.data)
    }
  }

  return normalizeReviewNotification(record)
}

export function extractPubSubMessageId(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined
  }

  const message = (body as Record<string, unknown>).message
  if (!message || typeof message !== 'object') {
    return undefined
  }

  const messageId = (message as Record<string, unknown>).messageId
  return typeof messageId === 'string' ? messageId : undefined
}
