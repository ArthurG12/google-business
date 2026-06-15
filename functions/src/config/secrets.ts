import { defineSecret, defineString } from 'firebase-functions/params'

export const googleClientId = defineSecret('GOOGLE_CLIENT_ID')
export const googleClientSecret = defineSecret('GOOGLE_CLIENT_SECRET')
export const googleRedirectUri = defineSecret('GOOGLE_REDIRECT_URI')
export const openAiApiKey = defineSecret('OPENAI_API_KEY')
export const tokenEncryptionKey = defineSecret('TOKEN_ENCRYPTION_KEY')

export const googlePubsubTopic = defineString('GOOGLE_PUBSUB_TOPIC', {
  default: 'google-business-reviews',
})
export const webhookSecret = defineString('WEBHOOK_SECRET', { default: '' })
export const firebaseProjectId = defineString('FIREBASE_PROJECT_ID', {
  default: 'therme-gas',
})

export const allSecrets = [
  googleClientId,
  googleClientSecret,
  googleRedirectUri,
  openAiApiKey,
  tokenEncryptionKey,
]

export function applySecretsToProcessEnv(): void {
  process.env.GOOGLE_CLIENT_ID = googleClientId.value()
  process.env.GOOGLE_CLIENT_SECRET = googleClientSecret.value()
  process.env.GOOGLE_REDIRECT_URI = googleRedirectUri.value()
  process.env.OPENAI_API_KEY = openAiApiKey.value()
  process.env.TOKEN_ENCRYPTION_KEY = tokenEncryptionKey.value()
  process.env.GOOGLE_PUBSUB_TOPIC = googlePubsubTopic.value()
  process.env.WEBHOOK_SECRET = webhookSecret.value()
  process.env.FIREBASE_PROJECT_ID = firebaseProjectId.value()
  process.env.GOOGLE_CLOUD_PROJECT =
    process.env.GOOGLE_CLOUD_PROJECT || firebaseProjectId.value()
}
