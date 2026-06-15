import { randomUUID } from 'crypto'
import { GoogleBusinessApi } from './api'
import { GoogleBusinessAutomation } from './automation'
import { getGoogleBusinessConfig } from './constants'
import { shouldSkipReviewReply } from './dedupe'
import { formatGoogleBusinessApiError } from './errors'
import { GoogleBusinessRepository } from './firestore'
import { GoogleBusinessOAuth } from './oauth'
import {
  CompanyAiSettingsDoc,
  ReplyOrigin,
  ReviewNotificationPayload,
} from './types'

export class GoogleBusinessService {
  constructor(
    private readonly oauth = new GoogleBusinessOAuth(),
    private readonly api = new GoogleBusinessApi(),
    private readonly automation = new GoogleBusinessAutomation(),
    private readonly repository = new GoogleBusinessRepository(),
  ) {}

  startOAuth(clientId: string) {
    if (!clientId?.trim()) {
      throw new Error('clientId é obrigatório')
    }
    return this.oauth.buildAuthorizationUrl(clientId.trim())
  }

  handleOAuthCallback(code: string, state: string) {
    if (!code || !state) {
      throw new Error('code e state são obrigatórios')
    }

    return this.oauth.handleCallback(code, state).then(async (result) => {
      if (process.env.GOOGLE_BUSINESS_SKIP_NOTIFICATION_SETUP === 'true') {
        return result
      }

      try {
        await this.setupReviewNotifications(result.clientId)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const connection = await this.repository.getConnection(result.clientId)
        if (connection) {
          await this.repository.saveConnection({
            ...connection,
            lastError: `OAuth ok, mas falha ao configurar notificações Pub/Sub: ${message}`,
            updatedAt: new Date().toISOString(),
          })
        }
      }

      return result
    })
  }

  async getReviewNotificationSetting(clientId: string, accountId: string) {
    return this.api.getNotificationSetting(clientId, accountId)
  }

  async setupReviewNotifications(clientId: string, accountId?: string) {
    if (accountId) {
      const setting = await this.api.updateNotificationSetting(clientId, accountId)
      return {
        configured: [setting],
        pubsubTopic: setting.pubsubTopic,
      }
    }

    const accounts = await this.api.listAccounts(clientId)
    if (!accounts.length) {
      throw new Error('Nenhuma conta Google Business encontrada para configurar notificações')
    }

    const configured = []
    const errors: string[] = []

    for (const account of accounts) {
      try {
        configured.push(
          await this.api.updateNotificationSetting(clientId, account.accountId),
        )
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${account.accountId}: ${message}`)
      }
    }

    if (!configured.length) {
      throw new Error(
        errors.length
          ? `Falha ao configurar notificações: ${errors.join('; ')}`
          : 'Nenhuma conta configurada',
      )
    }

    return {
      configured,
      pubsubTopic: configured[0]?.pubsubTopic,
      errors: errors.length ? errors : undefined,
    }
  }

  getSuccessRedirectUrl(clientId: string): string {
    const base = getGoogleBusinessConfig().SUCCESS_REDIRECT_URL
    return `${base}?googleBusiness=connected&clientId=${encodeURIComponent(clientId)}`
  }

  async getConnectionStatus(clientId: string) {
    const connection = await this.repository.getConnection(clientId)
    if (!connection) {
      return { clientId, status: 'disconnected' as const, connected: false }
    }

    return {
      clientId,
      status: connection.status,
      connected: connection.status === 'connected',
      googleAccountId: connection.googleAccountId,
      googleAccountName: connection.googleAccountName,
      selectedAccountId: connection.selectedAccountId,
      selectedLocationId: connection.selectedLocationId,
      authorizedAt: connection.authorizedAt,
      businessProfile: connection.businessProfile,
      lastError: connection.lastError,
    }
  }

  private async resolveAccounts(clientId: string) {
    let apiError: Error | undefined

    try {
      const accounts = await this.api.listAccounts(clientId)
      if (accounts.length) {
        return accounts
      }
    } catch (error: unknown) {
      apiError = formatGoogleBusinessApiError(error)
    }

    const cached = await this.repository.listAccountsByClient(clientId)
    if (cached.length) {
      return cached.map((doc) => ({
        accountId: doc.accountId,
        accountName: doc.accountName,
        type: doc.type,
      }))
    }

    if (apiError) {
      throw apiError
    }

    return []
  }

  listAccounts(clientId: string) {
    return this.resolveAccounts(clientId)
  }

  async listLocations(clientId: string, accountId?: string) {
    if (accountId) {
      return this.api.listLocations(clientId, accountId)
    }

    const accounts = await this.resolveAccounts(clientId)
    if (!accounts.length) {
      return []
    }

    const summaries = []
    for (const account of accounts) {
      const locations = await this.api.listLocations(clientId, account.accountId)
      summaries.push(...locations)
    }

    return summaries
  }

  async listReviews(clientId: string, locationId: string, accountId?: string) {
    const connection = await this.repository.getConnection(clientId)
    const resolvedAccountId =
      accountId || connection?.selectedAccountId || connection?.googleAccountId

    if (!resolvedAccountId) {
      throw new Error('accountId é obrigatório na primeira sincronização de avaliações')
    }

    const googleReviews = await this.api.listReviews(
      clientId,
      resolvedAccountId,
      locationId,
    )

    return googleReviews.map((review) => ({
      reviewId: review.reviewId,
      reviewName: review.reviewName,
      reviewerName: review.reviewerName,
      starRating: review.starRating,
      comment: review.comment,
      createTime: review.createTime,
      replyComment: review.replyComment,
      replyStatus: review.replyStatus,
    }))
  }

  async getStoredReviews(clientId: string, locationId: string) {
    const reviews = await this.repository.listReviewsByLocation(
      clientId,
      locationId.replace(/^locations\//, ''),
    )

    return reviews.map((review) => ({
      reviewId: review.reviewId,
      reviewName: review.reviewName,
      reviewerName: review.reviewerName,
      starRating: review.starRating,
      comment: review.comment,
      createTime: review.createTime,
      replyComment: review.replyComment,
      replyStatus: review.replyStatus,
      internalStatus: review.internalStatus,
      suggestedReply: review.suggestedReply,
      requiresApproval: review.requiresApproval,
    }))
  }

  async updateCompanyAiSettings(
    clientId: string,
    settings: Partial<Omit<CompanyAiSettingsDoc, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>>,
  ) {
    const now = new Date().toISOString()
    const existing = await this.repository.getCompanyAiSettings(clientId)
    const doc: CompanyAiSettingsDoc = {
      id: clientId,
      clientId,
      ...settings,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }
    await this.repository.upsertCompanyAiSettings(doc)
    return doc
  }

  async generateReviewReply(clientId: string, locationId: string, reviewId: string) {
    const review = await this.repository.getReview(reviewId)
    if (!review || review.clientId !== clientId) {
      throw new Error('Avaliação não encontrada')
    }

    const connection = await this.repository.getConnection(clientId)
    const aiSettings = await this.repository.getCompanyAiSettings(clientId)
    const suggestion = await this.automation.generateSuggestedReply({
      starRating: review.starRating,
      comment: review.comment,
      reviewerName: review.reviewerName,
      aiSettings,
      businessProfile: connection?.businessProfile,
      alreadyResponded: !!review.replyComment?.trim(),
    })

    await this.repository.upsertReview({
      ...review,
      suggestedReply: suggestion.reply,
      requiresApproval: suggestion.requiresApproval,
      internalStatus: suggestion.internalStatus,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return suggestion
  }

  /** Alias legado */
  suggestReply(clientId: string, locationId: string, reviewId: string) {
    return this.generateReviewReply(clientId, locationId, reviewId)
  }

  async publishReply(input: {
    clientId: string
    accountId?: string
    locationId: string
    reviewId: string
    reply: string
    origin?: ReplyOrigin
    force?: boolean
  }) {
    const review = await this.repository.getReview(input.reviewId)
    if (!review || review.clientId !== input.clientId) {
      throw new Error('Avaliação não encontrada')
    }

    const reviewName = review.reviewName || input.reviewId
    const dedupe = await shouldSkipReviewReply({
      review,
      reviewName,
      googleAlreadyResponded: !!review.replyComment?.trim(),
      repository: this.repository,
    })

    if (dedupe.action === 'ignored' && !input.force) {
      await this.repository.saveReplyLog({
        id: randomUUID(),
        clientId: input.clientId,
        googleAccountId: review.googleAccountId,
        locationId: review.locationId,
        reviewId: review.reviewId,
        reviewName,
        replyText: input.reply,
        origin: input.origin || 'manual',
        status: 'ignored',
        errorMessage: dedupe.reason,
        createdAt: new Date().toISOString(),
      })
      return {
        success: false,
        ignored: true,
        reason: dedupe.reason,
        reviewId: input.reviewId,
      }
    }

    const connection = await this.repository.getConnection(input.clientId)
    const resolvedAccountId =
      input.accountId ||
      review.googleAccountId ||
      connection?.selectedAccountId ||
      connection?.googleAccountId

    if (!resolvedAccountId) {
      throw new Error('accountId é obrigatório quando a conexão não possui conta selecionada')
    }

    const aiSettings = await this.repository.getCompanyAiSettings(input.clientId)
    const suggestion = await this.automation.generateSuggestedReply({
      starRating: review.starRating,
      comment: review.comment,
      reviewerName: review.reviewerName,
      aiSettings,
      businessProfile: connection?.businessProfile,
    })

    if (suggestion.requiresApproval && !input.force && input.origin !== 'manual') {
      throw new Error('Avaliações de 1 a 3 estrelas exigem aprovação humana antes da publicação')
    }

    const logId = randomUUID()
    const createdAt = new Date().toISOString()

    try {
      await this.api.publishReviewReply(
        input.clientId,
        resolvedAccountId,
        input.locationId,
        input.reviewId,
        input.reply,
      )

      await this.repository.upsertReview({
        ...review,
        replyComment: input.reply,
        replyStatus: 'responded',
        replyUpdateTime: createdAt,
        suggestedReply: input.reply,
        requiresApproval: false,
        internalStatus: 'published',
        lastSyncedAt: createdAt,
        updatedAt: createdAt,
      })

      await this.repository.saveReplyLog({
        id: logId,
        clientId: input.clientId,
        googleAccountId: resolvedAccountId.replace(/^accounts\//, ''),
        locationId: input.locationId.replace(/^locations\//, ''),
        reviewId: input.reviewId,
        reviewName,
        replyText: input.reply,
        origin: input.origin || 'manual',
        status: 'success',
        publishedAt: createdAt,
        createdAt,
      })

      return { success: true, reviewId: input.reviewId, publishedAt: createdAt }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      await this.repository.saveReplyLog({
        id: logId,
        clientId: input.clientId,
        googleAccountId: resolvedAccountId.replace(/^accounts\//, ''),
        locationId: input.locationId.replace(/^locations\//, ''),
        reviewId: input.reviewId,
        reviewName,
        replyText: input.reply,
        origin: input.origin || 'manual',
        status: 'failed',
        errorMessage: message,
        createdAt,
      })
      throw error
    }
  }

  async autoProcessReview(
    clientId: string,
    accountId: string,
    locationId: string,
    reviewId: string,
  ) {
    const suggestion = await this.generateReviewReply(clientId, locationId, reviewId)

    if (!suggestion.autoPublishAllowed) {
      const review = await this.repository.getReview(reviewId)
      await this.repository.saveReplyLog({
        id: randomUUID(),
        clientId,
        googleAccountId: accountId.replace(/^accounts\//, ''),
        locationId: locationId.replace(/^locations\//, ''),
        reviewId,
        reviewName: review?.reviewName || reviewId,
        replyText: suggestion.reply,
        origin: suggestion.origin,
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
      })

      return {
        published: false,
        requiresApproval: true,
        suggestedReply: suggestion.reply,
        internalStatus: suggestion.internalStatus,
      }
    }

    const result = await this.publishReply({
      clientId,
      accountId,
      locationId,
      reviewId,
      reply: suggestion.reply,
      origin: suggestion.origin,
    })

    return {
      published: true,
      requiresApproval: false,
      ...result,
    }
  }

  async receiveReviewNotification(
    payload: ReviewNotificationPayload,
    meta: { source: string; messageId?: string },
  ) {
    const now = new Date().toISOString()
    const eventId = meta.messageId
      ? meta.messageId.replace(/[^A-Za-z0-9_\-@.]/g, '_').slice(0, 1500)
      : randomUUID()

    let clientId: string | undefined
    let locationId: string | undefined

    if (payload.locationName) {
      const location = await this.repository.findLocationByResourceName(payload.locationName)
      if (location) {
        clientId = location.clientId
        locationId = location.locationId
      }
    }

    const eventDoc = {
      id: eventId,
      source: meta.source,
      messageId: meta.messageId,
      eventType: payload.eventType,
      reviewName: payload.reviewName,
      locationName: payload.locationName,
      accountName: payload.accountName,
      clientId,
      locationId,
      rawPayload: payload,
      status: 'received' as const,
      createdAt: now,
    }

    await this.repository.saveNotificationEvent(eventDoc)

    const autoProcess = process.env.GOOGLE_BUSINESS_AUTO_PROCESS_NOTIFICATIONS === 'true'

    if (autoProcess && clientId && payload.reviewName && payload.locationName) {
      try {
        const result = await this.processReviewNotification(payload)
        await this.repository.saveNotificationEvent({
          ...eventDoc,
          status: 'processed',
          processedAt: now,
          processResult: result,
        })
        return { received: true, eventId, processed: true, clientId, locationId, result }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        await this.repository.saveNotificationEvent({
          ...eventDoc,
          status: 'failed',
          processedAt: now,
          errorMessage: message,
        })
        return { received: true, eventId, processed: false, clientId, locationId, error: message }
      }
    }

    return { received: true, eventId, processed: false, clientId, locationId }
  }

  async processReviewNotification(payload: ReviewNotificationPayload) {
    const reviewName = payload.reviewName
    if (!reviewName) {
      throw new Error('reviewName ausente no evento Pub/Sub')
    }

    const locationResource = payload.locationName
    if (!locationResource) {
      throw new Error('locationName ausente no evento Pub/Sub')
    }

    const location = await this.repository.findLocationByResourceName(locationResource)
    if (!location) {
      throw new Error(`Localização não encontrada para ${locationResource}`)
    }

    const clientId = location.clientId
    const accountId = location.googleAccountId
    const locationId = location.locationId

    const googleReview = await this.api.getReviewByName(clientId, reviewName)
    if (!googleReview) {
      throw new Error(`Não foi possível buscar review completa: ${reviewName}`)
    }

    const now = new Date().toISOString()
    const alreadyResponded = !!googleReview.replyComment?.trim()
    const existing = await this.repository.getReviewByName(reviewName)
    const reviewDoc = this.api.toReviewDoc({
      clientId,
      googleAccountId: accountId,
      locationId,
      summary: googleReview,
      now,
      internalStatus: alreadyResponded
        ? 'ignored'
        : existing?.internalStatus || 'not_responded',
    })

    await this.repository.upsertReview(reviewDoc)

    const dedupe = await shouldSkipReviewReply({
      review: reviewDoc,
      reviewName,
      googleAlreadyResponded: alreadyResponded,
      repository: this.repository,
    })

    if (dedupe.action === 'ignored') {
      await this.repository.upsertReview({
        ...reviewDoc,
        internalStatus: 'ignored',
        updatedAt: now,
      })
      await this.repository.saveReplyLog({
        id: randomUUID(),
        clientId,
        googleAccountId: accountId,
        locationId,
        reviewId: googleReview.reviewId,
        reviewName,
        replyText: '',
        origin: 'auto',
        status: 'ignored',
        errorMessage: dedupe.reason,
        createdAt: now,
      })
      return { processed: true, published: false, ignored: true, reason: dedupe.reason }
    }

    const connection = await this.repository.getConnection(clientId)
    const aiSettings = await this.repository.getCompanyAiSettings(clientId)
    const suggestion = await this.automation.generateSuggestedReply({
      starRating: googleReview.starRating,
      comment: googleReview.comment,
      reviewerName: googleReview.reviewerName,
      aiSettings,
      businessProfile: connection?.businessProfile,
    })

    await this.repository.upsertReview({
      ...reviewDoc,
      suggestedReply: suggestion.reply,
      requiresApproval: suggestion.requiresApproval,
      internalStatus: suggestion.internalStatus,
      updatedAt: now,
    })

    if (!suggestion.autoPublishAllowed) {
      await this.repository.saveReplyLog({
        id: randomUUID(),
        clientId,
        googleAccountId: accountId,
        locationId,
        reviewId: googleReview.reviewId,
        reviewName,
        replyText: suggestion.reply,
        origin: suggestion.origin,
        status: 'pending_approval',
        createdAt: now,
      })
      return {
        processed: true,
        published: false,
        requiresApproval: true,
        suggestedReply: suggestion.reply,
      }
    }

    const publishResult = await this.publishReply({
      clientId,
      accountId,
      locationId,
      reviewId: googleReview.reviewId,
      reply: suggestion.reply,
      origin: suggestion.origin,
    })

    return {
      processed: true,
      published: true,
      ...publishResult,
    }
  }
}
