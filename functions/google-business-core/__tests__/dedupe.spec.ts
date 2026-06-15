import { shouldSkipReviewReply } from '../dedupe'
import { GoogleBusinessReviewDoc } from '../types'

describe('shouldSkipReviewReply', () => {
  const reviewName = 'accounts/1/locations/2/reviews/3'

  const baseReview: GoogleBusinessReviewDoc = {
    id: reviewName,
    clientId: 'client-a',
    googleAccountId: '1',
    locationId: '2',
    reviewId: '3',
    reviewName,
    replyStatus: 'not_responded',
    internalStatus: 'not_responded',
    requiresApproval: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastSyncedAt: '2026-01-01T00:00:00.000Z',
  }

  it('ignora quando Google já respondeu', async () => {
    const result = await shouldSkipReviewReply({
      review: baseReview,
      reviewName,
      googleAlreadyResponded: true,
    })

    expect(result).toEqual({
      action: 'ignored',
      reason: 'review_already_responded_on_google',
    })
  })

  it('ignora quando internalStatus é published', async () => {
    const result = await shouldSkipReviewReply({
      review: { ...baseReview, internalStatus: 'published' },
      reviewName,
    })

    expect(result.action).toBe('ignored')
    expect(result.reason).toBe('internal_status_published')
  })

  it('ignora quando replyComment já existe', async () => {
    const result = await shouldSkipReviewReply({
      review: { ...baseReview, replyComment: 'Obrigado!' },
      reviewName,
    })

    expect(result.action).toBe('ignored')
    expect(result.reason).toBe('reply_comment_present')
  })

  it('ignora quando já existe log published', async () => {
    const result = await shouldSkipReviewReply({
      review: baseReview,
      reviewName,
      repository: {
        hasPublishedLog: jest.fn().mockResolvedValue(true),
      } as never,
    })

    expect(result.action).toBe('ignored')
    expect(result.reason).toBe('published_log_exists')
  })

  it('prossegue quando nenhuma regra bloqueia', async () => {
    const result = await shouldSkipReviewReply({
      review: baseReview,
      reviewName,
      repository: {
        hasPublishedLog: jest.fn().mockResolvedValue(false),
      } as never,
    })

    expect(result).toEqual({ action: 'proceed' })
  })
})
