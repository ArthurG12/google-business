export type GoogleBusinessConnectionStatus = 'connected' | 'disconnected' | 'error'

export interface GoogleBusinessProfileConfig {
  businessName?: string
  toneOfVoice?: string
  businessType?: string
  languageRestrictions?: string
}

export interface GoogleBusinessConnectionDoc {
  id: string
  clientId: string
  status: GoogleBusinessConnectionStatus
  encryptedRefreshToken: string
  googleAccountId?: string
  googleAccountName?: string
  selectedAccountId?: string
  selectedLocationId?: string
  businessProfile?: GoogleBusinessProfileConfig
  authorizedAt?: string
  createdAt?: string
  updatedAt: string
  lastError?: string
}

export interface GoogleBusinessOAuthStateDoc {
  id: string
  clientId: string
  createdAt: string
  expiresAt: string
}

export interface GoogleBusinessAccountDoc {
  id: string
  clientId: string
  accountId: string
  accountName: string
  type?: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface GoogleBusinessLocationDoc {
  id: string
  clientId: string
  googleAccountId: string
  locationId: string
  locationName: string
  storeCode?: string
  title?: string
  address?: string
  status: 'active' | 'inactive'
  syncedAt: string
}

export type ReviewReplyStatus = 'pending' | 'responded' | 'not_responded'
export type ReviewInternalStatus =
  | 'pending_approval'
  | 'published'
  | 'ignored'
  | 'not_responded'
export type ReplyOrigin = 'manual' | 'template' | 'ai' | 'auto'

export interface GoogleBusinessReviewDoc {
  id: string
  clientId: string
  googleAccountId: string
  locationId: string
  reviewId: string
  reviewName: string
  reviewerName?: string
  starRating?: number
  comment?: string
  createTime?: string
  updateTime?: string
  replyComment?: string
  replyUpdateTime?: string
  replyStatus: ReviewReplyStatus
  internalStatus: ReviewInternalStatus
  suggestedReply?: string
  requiresApproval: boolean
  createdAt: string
  updatedAt: string
  lastSyncedAt: string
}

export type ReplyPublicationStatus = 'success' | 'failed' | 'pending_approval' | 'ignored'

export interface GoogleBusinessReplyLogDoc {
  id: string
  clientId: string
  googleAccountId: string
  locationId: string
  reviewId: string
  reviewName: string
  replyText: string
  origin: ReplyOrigin
  status: ReplyPublicationStatus
  publishedAt?: string
  errorMessage?: string
  createdAt: string
}

export interface CompanyAiSettingsDoc {
  id: string
  clientId: string
  businessName?: string
  businessType?: string
  toneOfVoice?: string
  languageRestrictions?: string
  createdAt: string
  updatedAt: string
}

export type NotificationEventStatus = 'received' | 'processed' | 'failed'

export interface ReviewNotificationPayload {
  eventType?: string
  reviewName?: string
  locationName?: string
  accountName?: string
}

export interface GoogleBusinessNotificationEventDoc {
  id: string
  source: string
  messageId?: string
  eventType?: string
  reviewName?: string
  locationName?: string
  accountName?: string
  clientId?: string
  locationId?: string
  rawPayload: ReviewNotificationPayload
  status: NotificationEventStatus
  createdAt: string
  processedAt?: string
  processResult?: unknown
  errorMessage?: string
}
