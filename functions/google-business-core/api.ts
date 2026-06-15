import axios from 'axios'
import { google } from 'googleapis'
import {
  buildPubSubTopicResource,
  DEFAULT_REVIEW_NOTIFICATION_TYPES,
  STAR_RATING_MAP,
} from './constants'
import { GoogleBusinessOAuth } from './oauth'
import { GoogleBusinessRepository } from './firestore'
import {
  GoogleBusinessAccountDoc,
  GoogleBusinessLocationDoc,
  GoogleBusinessReviewDoc,
} from './types'

export interface GoogleAccountSummary {
  accountId: string
  accountName: string
  type?: string
}

export interface GoogleLocationSummary {
  locationId: string
  googleAccountId: string
  title: string
  storeCode?: string
  address?: string
}

export interface GoogleNotificationSetting {
  accountId: string
  pubsubTopic?: string
  notificationTypes: string[]
}

export interface GoogleReviewSummary {
  reviewId: string
  reviewName: string
  reviewerName?: string
  starRating?: number
  comment?: string
  createTime?: string
  updateTime?: string
  replyComment?: string
  replyUpdateTime?: string
  replyStatus: 'responded' | 'not_responded'
}

export class GoogleBusinessApi {
  constructor(
    private readonly oauth = new GoogleBusinessOAuth(),
    private readonly repository = new GoogleBusinessRepository(),
  ) {}

  async listAccounts(clientId: string): Promise<GoogleAccountSummary[]> {
    const accessToken = await this.oauth.getAccessTokenForClient(clientId)
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })

    const accountManagement = google.mybusinessaccountmanagement({ version: 'v1', auth })
    const response = await accountManagement.accounts.list()
    const accounts = response.data.accounts ?? []
    const now = new Date().toISOString()

    const summaries: GoogleAccountSummary[] = []

    for (const account of accounts) {
      const accountId = this.extractId(account.name)
      const summary: GoogleAccountSummary = {
        accountId,
        accountName: account.accountName || account.name || '',
        type: account.type || undefined,
      }
      summaries.push(summary)

      const doc: GoogleBusinessAccountDoc = {
        id: `${clientId}__${accountId}`,
        clientId,
        accountId,
        accountName: summary.accountName,
        type: summary.type,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }
      await this.repository.upsertAccount(doc)
    }

    return summaries
  }

  async listLocations(
    clientId: string,
    accountId: string,
  ): Promise<GoogleLocationSummary[]> {
    const accessToken = await this.oauth.getAccessTokenForClient(clientId)
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })

    const businessInfo = google.mybusinessbusinessinformation({ version: 'v1', auth })
    const parent = accountId.startsWith('accounts/') ? accountId : `accounts/${accountId}`

    const response = await businessInfo.accounts.locations.list({
      parent,
      readMask: 'name,title,storeCode,storefrontAddress',
    })

    const locations = response.data.locations ?? []
    const googleAccountId = this.extractId(parent)
    const now = new Date().toISOString()
    const summaries: GoogleLocationSummary[] = []

    for (const location of locations) {
      const locationId = this.extractId(location.name)
      const summary: GoogleLocationSummary = {
        locationId,
        googleAccountId,
        title: location.title || locationId,
        storeCode: location.storeCode || undefined,
        address: this.formatAddress(location.storefrontAddress),
      }
      summaries.push(summary)

      const doc: GoogleBusinessLocationDoc = {
        id: `${clientId}__${locationId}`,
        clientId,
        googleAccountId,
        locationId,
        locationName: summary.title,
        storeCode: summary.storeCode,
        title: summary.title,
        address: summary.address,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        syncedAt: now,
      }
      await this.repository.upsertLocation(doc)
    }

    return summaries
  }

  async listReviews(
    clientId: string,
    accountId: string,
    locationId: string,
  ): Promise<GoogleReviewSummary[]> {
    const accessToken = await this.oauth.getAccessTokenForClient(clientId)
    const normalizedAccountId = accountId.replace(/^accounts\//, '')
    const normalizedLocationId = locationId.replace(/^locations\//, '')

    const url = `https://mybusiness.googleapis.com/v4/accounts/${normalizedAccountId}/locations/${normalizedLocationId}/reviews`
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 20000,
    })

    const reviews = response.data.reviews ?? []
    const now = new Date().toISOString()
    const summaries: GoogleReviewSummary[] = []

    for (const review of reviews) {
      const reviewId = this.extractId(review.reviewId || review.name)
      const reviewName =
        review.name ||
        `accounts/${normalizedAccountId}/locations/${normalizedLocationId}/reviews/${reviewId}`
      const starRating = this.parseStarRating(review.starRating)
      const replyComment = review.reviewReply?.comment
      const summary: GoogleReviewSummary = {
        reviewId,
        reviewName,
        reviewerName: review.reviewer?.displayName,
        starRating,
        comment: review.comment,
        createTime: review.createTime,
        updateTime: review.updateTime,
        replyComment,
        replyUpdateTime: review.reviewReply?.updateTime,
        replyStatus: replyComment ? 'responded' : 'not_responded',
      }
      summaries.push(summary)

      await this.repository.upsertReview(this.toReviewDoc({
        clientId,
        googleAccountId: normalizedAccountId,
        locationId: normalizedLocationId,
        summary,
        now,
      }))
    }

    return summaries
  }

  async getReviewByName(
    clientId: string,
    reviewName: string,
  ): Promise<GoogleReviewSummary | null> {
    const accessToken = await this.oauth.getAccessTokenForClient(clientId)
    const url = `https://mybusiness.googleapis.com/v4/${reviewName.replace(/^\//, '')}`

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 20000,
      })
      const review = response.data
      const reviewId = this.extractId(review.reviewId || review.name)
      const replyComment = review.reviewReply?.comment

      return {
        reviewId,
        reviewName: review.name || reviewName,
        reviewerName: review.reviewer?.displayName,
        starRating: this.parseStarRating(review.starRating),
        comment: review.comment,
        createTime: review.createTime,
        updateTime: review.updateTime,
        replyComment,
        replyUpdateTime: review.reviewReply?.updateTime,
        replyStatus: replyComment ? 'responded' : 'not_responded',
      }
    } catch {
      return null
    }
  }

  async getNotificationSetting(
    clientId: string,
    accountId: string,
  ): Promise<GoogleNotificationSetting> {
    const accessToken = await this.oauth.getAccessTokenForClient(clientId)
    const normalizedAccountId = accountId.replace(/^accounts\//, '')
    const url = `https://mybusinessnotifications.googleapis.com/v1/accounts/${normalizedAccountId}/notificationSetting`

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 20000,
    })

    return {
      accountId: normalizedAccountId,
      pubsubTopic: response.data.pubsubTopic || undefined,
      notificationTypes: response.data.notificationTypes ?? [],
    }
  }

  async updateNotificationSetting(
    clientId: string,
    accountId: string,
    input?: {
      pubsubTopic?: string
      notificationTypes?: string[]
    },
  ): Promise<GoogleNotificationSetting> {
    const accessToken = await this.oauth.getAccessTokenForClient(clientId)
    const normalizedAccountId = accountId.replace(/^accounts\//, '')
    const pubsubTopic = input?.pubsubTopic || buildPubSubTopicResource()
    const notificationTypes =
      input?.notificationTypes?.length
        ? input.notificationTypes
        : [...DEFAULT_REVIEW_NOTIFICATION_TYPES]

    const url = `https://mybusinessnotifications.googleapis.com/v1/accounts/${normalizedAccountId}/notificationSetting`
    const response = await axios.patch(
      url,
      {
        name: `accounts/${normalizedAccountId}/notificationSetting`,
        pubsubTopic,
        notificationTypes,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          updateMask: 'pubsubTopic,notificationTypes',
        },
        timeout: 20000,
      },
    )

    return {
      accountId: normalizedAccountId,
      pubsubTopic: response.data.pubsubTopic || pubsubTopic,
      notificationTypes: response.data.notificationTypes ?? notificationTypes,
    }
  }

  async publishReviewReply(
    clientId: string,
    accountId: string,
    locationId: string,
    reviewId: string,
    reply: string,
  ): Promise<void> {
    const accessToken = await this.oauth.getAccessTokenForClient(clientId)
    const normalizedAccountId = accountId.replace(/^accounts\//, '')
    const normalizedLocationId = locationId.replace(/^locations\//, '')
    const normalizedReviewId = reviewId.replace(/^reviews\//, '')

    const url = `https://mybusiness.googleapis.com/v4/accounts/${normalizedAccountId}/locations/${normalizedLocationId}/reviews/${normalizedReviewId}/reply`

    await axios.put(
      url,
      { comment: reply },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      },
    )
  }

  toReviewDoc(input: {
    clientId: string
    googleAccountId: string
    locationId: string
    summary: GoogleReviewSummary
    now: string
    internalStatus?: GoogleBusinessReviewDoc['internalStatus']
    suggestedReply?: string
    requiresApproval?: boolean
  }): GoogleBusinessReviewDoc {
    const alreadyResponded = !!input.summary.replyComment?.trim()
    return {
      id: input.summary.reviewName,
      clientId: input.clientId,
      googleAccountId: input.googleAccountId,
      locationId: input.locationId,
      reviewId: input.summary.reviewId,
      reviewName: input.summary.reviewName,
      reviewerName: input.summary.reviewerName,
      starRating: input.summary.starRating,
      comment: input.summary.comment,
      createTime: input.summary.createTime,
      updateTime: input.summary.updateTime,
      replyComment: input.summary.replyComment,
      replyUpdateTime: input.summary.replyUpdateTime,
      replyStatus: input.summary.replyStatus === 'responded' ? 'responded' : 'not_responded',
      internalStatus:
        input.internalStatus ||
        (alreadyResponded ? 'ignored' : 'not_responded'),
      suggestedReply: input.suggestedReply,
      requiresApproval: input.requiresApproval ?? false,
      createdAt: input.now,
      updatedAt: input.now,
      lastSyncedAt: input.now,
    }
  }

  private extractId(name?: string | null): string {
    if (!name) return ''
    const parts = name.split('/')
    return parts[parts.length - 1] || name
  }

  private formatAddress(
    address: {
      addressLines?: string[] | null
      locality?: string | null
      administrativeArea?: string | null
      postalCode?: string | null
    } | null | undefined,
  ): string | undefined {
    if (!address) return undefined
    const lines = address.addressLines ?? []
    const parts = [
      ...lines,
      address.locality,
      address.administrativeArea,
      address.postalCode,
    ].filter(Boolean)
    return parts.length ? parts.join(', ') : undefined
  }

  private parseStarRating(value?: string): number | undefined {
    if (!value) return undefined
    return STAR_RATING_MAP[value] ?? (Number(value) || undefined)
  }
}
