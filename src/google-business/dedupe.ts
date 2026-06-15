import { GoogleBusinessRepository } from './firestore'
import { GoogleBusinessReviewDoc } from './types'

export type DedupeResult =
  | { action: 'ignored'; reason: string }
  | { action: 'proceed' }

export async function shouldSkipReviewReply(input: {
  review?: GoogleBusinessReviewDoc | null
  reviewName: string
  googleAlreadyResponded?: boolean
  repository?: Pick<GoogleBusinessRepository, 'hasPublishedLog'>
}): Promise<DedupeResult> {
  if (input.googleAlreadyResponded) {
    return { action: 'ignored', reason: 'review_already_responded_on_google' }
  }

  if (input.review?.internalStatus === 'published') {
    return { action: 'ignored', reason: 'internal_status_published' }
  }

  if (input.review?.replyComment?.trim()) {
    return { action: 'ignored', reason: 'reply_comment_present' }
  }

  const repository = input.repository ?? new GoogleBusinessRepository()

  if (await repository.hasPublishedLog(input.reviewName)) {
    return { action: 'ignored', reason: 'published_log_exists' }
  }

  return { action: 'proceed' }
}
