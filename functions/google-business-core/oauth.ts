import { randomBytes } from 'crypto'
import { google } from 'googleapis'
import { getGoogleBusinessConfig } from './constants'
import { decryptText, encryptText, isV2Encrypted } from './crypto'
import { GoogleBusinessRepository } from './firestore'
import { GoogleBusinessConnectionDoc } from './types'

export class GoogleBusinessOAuth {
  constructor(private readonly repository = new GoogleBusinessRepository()) {}

  private createOAuthClient() {
    const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = getGoogleBusinessConfig()

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      throw new Error(
        'Google OAuth não configurado: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI são obrigatórios',
      )
    }

    return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
  }

  async buildAuthorizationUrl(clientId: string): Promise<{ url: string; state: string }> {
    const oauth2 = this.createOAuthClient()
    const { SCOPE, OAUTH_STATE_TTL_MS } = getGoogleBusinessConfig()
    const state = randomBytes(24).toString('hex')
    const now = new Date()

    await this.repository.saveOAuthState({
      id: state,
      clientId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS).toISOString(),
    })

    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [SCOPE],
      state,
    })

    return { url, state }
  }

  async handleCallback(code: string, state: string): Promise<{ clientId: string }> {
    const oauthState = await this.repository.getOAuthState(state)
    if (!oauthState) {
      throw new Error('State OAuth inválido ou expirado')
    }

    if (new Date(oauthState.expiresAt).getTime() < Date.now()) {
      await this.repository.deleteOAuthState(state)
      throw new Error('State OAuth expirado')
    }

    const oauth2 = this.createOAuthClient()
    const { tokens } = await oauth2.getToken(code)

    const encryptedRefreshToken = tokens.refresh_token
      ? encryptText(tokens.refresh_token)
      : ''

    const now = new Date().toISOString()
    const connection: GoogleBusinessConnectionDoc = {
      id: oauthState.clientId,
      clientId: oauthState.clientId,
      status: encryptedRefreshToken ? 'connected' : 'error',
      encryptedRefreshToken,
      authorizedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(encryptedRefreshToken
        ? {}
        : {
            lastError:
              'Google não retornou refresh_token. Revogue o acesso e reconecte.',
          }),
    }

    await this.repository.saveConnection(connection)
    await this.repository.deleteOAuthState(state)

    return { clientId: oauthState.clientId }
  }

  async getAccessTokenForClient(clientId: string): Promise<string> {
    const connection = await this.repository.getConnection(clientId)
    if (!connection?.encryptedRefreshToken) {
      throw new Error(`Cliente ${clientId} não possui conexão Google Business ativa`)
    }

    const refreshToken = decryptText(connection.encryptedRefreshToken)
    if (!refreshToken) {
      throw new Error(
        'Não foi possível descriptografar refresh_token. Verifique TOKEN_ENCRYPTION_KEY.',
      )
    }

    if (!isV2Encrypted(connection.encryptedRefreshToken)) {
      await this.repository.saveConnection({
        ...connection,
        encryptedRefreshToken: encryptText(refreshToken),
        updatedAt: new Date().toISOString(),
      })
    }

    const oauth2 = this.createOAuthClient()
    oauth2.setCredentials({ refresh_token: refreshToken })
    const { credentials } = await oauth2.refreshAccessToken()

    if (!credentials.access_token) {
      throw new Error('Falha ao renovar access_token Google')
    }

    return credentials.access_token
  }
}
