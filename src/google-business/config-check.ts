import { existsSync } from 'fs'
import { resolve } from 'path'
import { getGoogleBusinessConfig, getTokenEncryptionKey } from './constants'

export type ConfigCheckItem = {
  key: string
  ok: boolean
  message: string
}

export function checkGoogleBusinessConfig(): ConfigCheckItem[] {
  const config = getGoogleBusinessConfig()
  const checks: ConfigCheckItem[] = []

  checks.push({
    key: 'google_oauth',
    ok: !!(config.CLIENT_ID && config.CLIENT_SECRET && config.REDIRECT_URI),
    message:
      config.CLIENT_ID && config.CLIENT_SECRET && config.REDIRECT_URI
        ? 'OAuth Google configurado'
        : 'Preencha GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env',
  })

  const encryptionKey = getTokenEncryptionKey()
  checks.push({
    key: 'token_encryption',
    ok: !!encryptionKey,
    message: encryptionKey
      ? 'TOKEN_ENCRYPTION_KEY (ou CRYPTO_SECRET) configurado'
      : 'Defina TOKEN_ENCRYPTION_KEY no .env para criptografar refresh tokens',
  })

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS
  const hasEnvCredentials =
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY

  if (serviceAccountPath) {
    const absolutePath = resolve(process.cwd(), serviceAccountPath)
    const exists = existsSync(absolutePath)
    checks.push({
      key: 'firebase_service_account',
      ok: exists,
      message: exists
        ? `Service account encontrada em ${serviceAccountPath}`
        : `Arquivo não encontrado: ${absolutePath}. Baixe no Firebase Console → Configurações → Contas de serviço → Gerar nova chave privada`,
    })
  } else if (hasEnvCredentials) {
    checks.push({
      key: 'firebase_env',
      ok: true,
      message: 'Credenciais Firebase via variáveis de ambiente',
    })
  } else {
    checks.push({
      key: 'firebase',
      ok: false,
      message:
        'Configure FIREBASE_SERVICE_ACCOUNT_PATH apontando para o JSON da service account, ou FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY',
    })
  }

  return checks
}

export function isGoogleBusinessReady(): boolean {
  return checkGoogleBusinessConfig().every((item) => item.ok)
}
