import * as bp from '.botpress'
import { gbGet, gbPost } from './client/backend-client'

const API_PREFIX = '/api/v1/google-business'

function requireBackend(ctx: { ctx: { configuration: Record<string, unknown> } }) {
  const backendUrl = String(ctx.ctx.configuration.backendUrl || '').trim()
  const clientId = String(ctx.ctx.configuration.clientId || '').trim()
  if (!backendUrl) {
    throw new Error('backendUrl é obrigatório na configuração da integração')
  }
  if (!clientId) {
    throw new Error('clientId é obrigatório na configuração da integração')
  }
  const apiKey =
    typeof ctx.ctx.configuration.apiKey === 'string'
      ? ctx.ctx.configuration.apiKey
      : undefined
  return { backendUrl, clientId, apiKey }
}

export default new bp.Integration({
  register: async ({ ctx, logger }) => {
    const { clientId } = requireBackend({ ctx })
    logger.forBot().info(`Google Business registrado para clientId=${clientId}`)
  },
  unregister: async ({ logger }) => {
    logger.forBot().info('Google Business desregistrado')
  },
  actions: {
    getOAuthUrl: async ({ ctx }) => {
      const { backendUrl, clientId, apiKey } = requireBackend({ ctx })
      return gbGet(backendUrl, `${API_PREFIX}/oauth/start`, { clientId }, apiKey)
    },
    getConnectionStatus: async ({ ctx }) => {
      const { backendUrl, clientId, apiKey } = requireBackend({ ctx })
      return gbGet(backendUrl, `${API_PREFIX}/status`, { clientId }, apiKey)
    },
    listAccounts: async ({ ctx }) => {
      const { backendUrl, clientId, apiKey } = requireBackend({ ctx })
      const accounts = await gbGet<Array<{ accountId: string; accountName: string }>>(
        backendUrl,
        `${API_PREFIX}/accounts`,
        { clientId },
        apiKey,
      )
      return { accounts }
    },
    listLocations: async ({ ctx, input }) => {
      const { backendUrl, clientId, apiKey } = requireBackend({ ctx })
      const locations = await gbGet<
        Array<{ locationId: string; title: string; address?: string }>
      >(
        backendUrl,
        `${API_PREFIX}/locations`,
        { clientId, accountId: input.accountId },
        apiKey,
      )
      return { locations }
    },
    syncReviews: async ({ ctx, input }) => {
      const { backendUrl, clientId, apiKey } = requireBackend({ ctx })
      const reviews = await gbGet<Record<string, unknown>[]>(
        backendUrl,
        `${API_PREFIX}/locations/${encodeURIComponent(input.locationId)}/reviews`,
        { clientId, accountId: input.accountId },
        apiKey,
      )
      return { reviews }
    },
    suggestReply: async ({ ctx, input }) => {
      const { backendUrl, clientId, apiKey } = requireBackend({ ctx })
      return gbPost(
        backendUrl,
        `${API_PREFIX}/locations/${encodeURIComponent(input.locationId)}/reviews/${encodeURIComponent(input.reviewId)}/suggest-reply`,
        { clientId },
        undefined,
        apiKey,
      )
    },
    publishReply: async ({ ctx, input }) => {
      const { backendUrl, clientId, apiKey } = requireBackend({ ctx })
      return gbPost(
        backendUrl,
        `${API_PREFIX}/locations/${encodeURIComponent(input.locationId)}/reviews/${encodeURIComponent(input.reviewId)}/reply`,
        { clientId },
        {
          reply: input.reply,
          accountId: input.accountId,
          force: input.force,
        },
        apiKey,
      )
    },
    autoReply: async ({ ctx, input }) => {
      const { backendUrl, clientId, apiKey } = requireBackend({ ctx })
      return gbPost(
        backendUrl,
        `${API_PREFIX}/locations/${encodeURIComponent(input.locationId)}/reviews/${encodeURIComponent(input.reviewId)}/auto-reply`,
        { clientId, accountId: input.accountId },
        undefined,
        apiKey,
      )
    },
  },
  channels: {},
  handler: async () => {},
})
