import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import CryptoJS from 'crypto-js'
import { getTokenEncryptionKey } from './constants'

const V2_PREFIX = 'v2:'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function resolveSecret(secret?: string): string {
  return secret || getTokenEncryptionKey()
}

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function isV2Encrypted(encryptedText: string): boolean {
  return encryptedText.startsWith(V2_PREFIX)
}

function encryptV2(text: string, secret: string): string {
  const key = deriveKey(secret)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, tag, encrypted])
  return `${V2_PREFIX}${payload.toString('base64url')}`
}

function decryptV2(encryptedText: string, secret: string): string {
  const payload = Buffer.from(encryptedText.slice(V2_PREFIX.length), 'base64url')
  if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    return ''
  }
  const iv = payload.subarray(0, IV_LENGTH)
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const data = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const key = deriveKey(secret)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

function decryptLegacy(encryptedText: string, secret: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, secret)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    return decrypted || ''
  } catch {
    return ''
  }
}

export function encryptText(text: string, secret?: string): string {
  const key = resolveSecret(secret)
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY não configurado')
  }
  return encryptV2(text, key)
}

export function decryptText(encryptedText: string, secret?: string): string {
  const key = resolveSecret(secret)
  if (!key || !encryptedText) {
    return ''
  }
  try {
    if (isV2Encrypted(encryptedText)) {
      return decryptV2(encryptedText, key)
    }
    return decryptLegacy(encryptedText, key)
  } catch {
    return ''
  }
}
