export function getGoogleCloudProjectId(): string {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    ''
  )
}

export function buildPubSubTopicResource(topicName?: string): string {
  const projectId = getGoogleCloudProjectId()
  const topic = topicName || getGoogleBusinessConfig().PUBSUB_TOPIC

  if (!projectId) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT ou FIREBASE_PROJECT_ID é obrigatório para configurar notificações Pub/Sub',
    )
  }

  if (!topic) {
    throw new Error('GOOGLE_PUBSUB_TOPIC é obrigatório para configurar notificações Pub/Sub')
  }

  return `projects/${projectId}/topics/${topic}`
}

export const DEFAULT_REVIEW_NOTIFICATION_TYPES = ['NEW_REVIEW', 'UPDATED_REVIEW'] as const

export function getGoogleBusinessConfig() {
  return {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_BUSINESS_CLIENT_ID || '',
    CLIENT_SECRET:
      process.env.GOOGLE_CLIENT_SECRET ||
      process.env.GOOGLE_BUSINESS_CLIENT_SECRET ||
      '',
    REDIRECT_URI:
      process.env.GOOGLE_REDIRECT_URI ||
      process.env.GOOGLE_BUSINESS_REDIRECT_URI ||
      '',
    SCOPE:
      process.env.GOOGLE_BUSINESS_SCOPE ||
      'https://www.googleapis.com/auth/business.manage',
    API_KEY: process.env.GOOGLE_BUSINESS_API_KEY || '',
    SUCCESS_REDIRECT_URL:
      process.env.GOOGLE_BUSINESS_SUCCESS_URL ||
      'https://app.botpress.cloud',
    PUBSUB_TOPIC: process.env.GOOGLE_PUBSUB_TOPIC || 'google-business-reviews',
    OAUTH_STATE_TTL_MS: 15 * 60 * 1000,
  } as const
}

/** @deprecated use getGoogleBusinessConfig() */
export const GOOGLE_BUSINESS_CONFIG = getGoogleBusinessConfig()

export function getTokenEncryptionKey(): string {
  return (
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.CRYPTO_SECRET ||
    ''
  )
}

export function getOpenAiApiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.GOOGLE_BUSINESS_OPENAI_API_KEY || ''
}

export const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}
