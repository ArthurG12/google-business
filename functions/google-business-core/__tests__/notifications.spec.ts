import { buildPubSubTopicResource } from '../constants'

describe('buildPubSubTopicResource', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('monta o resource name do tópico Pub/Sub', () => {
    process.env.FIREBASE_PROJECT_ID = 'therme-gas'
    process.env.GOOGLE_PUBSUB_TOPIC = 'google-business-reviews'

    expect(buildPubSubTopicResource()).toBe(
      'projects/therme-gas/topics/google-business-reviews',
    )
  })

  it('falha sem project id', () => {
    delete process.env.FIREBASE_PROJECT_ID
    delete process.env.GOOGLE_CLOUD_PROJECT
    delete process.env.GCLOUD_PROJECT
    delete process.env.GCP_PROJECT

    expect(() => buildPubSubTopicResource()).toThrow(/FIREBASE_PROJECT_ID/)
  })
})
