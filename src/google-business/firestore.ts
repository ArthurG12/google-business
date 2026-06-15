import { readFileSync } from 'fs'
import { existsSync } from 'fs'
import { resolve } from 'path'
import * as admin from 'firebase-admin'
import {
  GOOGLE_BUSINESS_COLLECTIONS,
  accountDocId,
  locationDocId,
  reviewDocId,
  safeDocId,
} from './firestore-paths'
import {
  CompanyAiSettingsDoc,
  GoogleBusinessAccountDoc,
  GoogleBusinessConnectionDoc,
  GoogleBusinessLocationDoc,
  GoogleBusinessNotificationEventDoc,
  GoogleBusinessOAuthStateDoc,
  GoogleBusinessReplyLogDoc,
  GoogleBusinessReviewDoc,
} from './types'

let initialized = false

function parsePrivateKey(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '')
  return trimmed.replace(/\\n/g, '\n')
}

function loadServiceAccountFromFile(pathValue: string): {
  projectId: string
  clientEmail: string
  privateKey: string
} {
  const absolutePath = resolve(process.cwd(), pathValue)
  const parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as {
    project_id?: string
    client_email?: string
    private_key?: string
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      `Arquivo de service account inválido: ${absolutePath}. Baixe novamente no Firebase Console.`,
    )
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsePrivateKey(parsed.private_key),
  }
}

export function initFirebaseAdmin(): void {
  if (initialized || admin.apps.length > 0) {
    initialized = true
    return
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (serviceAccountPath) {
    const absolutePath = resolve(process.cwd(), serviceAccountPath)
    if (!existsSync(absolutePath)) {
      throw new Error(
        `Firebase: arquivo não encontrado em ${absolutePath}. Baixe a service account no Firebase Console (projeto ${process.env.FIREBASE_PROJECT_ID || 'therme-gas'}) e salve como firebase-service-account.json, ou preencha FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env`,
      )
    }
    admin.initializeApp({
      credential: admin.credential.cert(loadServiceAccountFromFile(serviceAccountPath)),
    })
    initialized = true
    return
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || ''

  if (projectId && clientEmail && privateKeyRaw) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: parsePrivateKey(privateKeyRaw),
      }),
    })
  } else {
    admin.initializeApp()
  }

  initialized = true
}

function getDb(): FirebaseFirestore.Firestore {
  initFirebaseAdmin()
  return admin.firestore()
}

async function getDocument<T extends { id: string }>(
  collection: string,
  documentId: string,
): Promise<T | null> {
  const snap = await getDb().collection(collection).doc(documentId).get()
  if (!snap.exists) {
    return null
  }
  return { id: snap.id, ...snap.data() } as T
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) {
        result[key] = stripUndefined(nested)
      }
    }
    return result as T
  }
  return value
}

async function setDocument<T extends { id: string }>(
  collection: string,
  doc: T,
  documentId?: string,
): Promise<void> {
  const id = documentId || doc.id
  const payload = stripUndefined(doc)
  await getDb().collection(collection).doc(id).set(payload, { merge: true })
}

async function getDocuments<T extends { id: string }>(
  collection: string,
  filters: Array<{
    field: string
    operator: FirebaseFirestore.WhereFilterOp
    value: unknown
  }>,
): Promise<T[]> {
  let query: FirebaseFirestore.Query = getDb().collection(collection)
  for (const filter of filters) {
    query = query.where(filter.field, filter.operator, filter.value)
  }
  const snap = await query.get()
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T)
}

export class GoogleBusinessRepository {
  getConnection(clientId: string): Promise<GoogleBusinessConnectionDoc | null> {
    return getDocument<GoogleBusinessConnectionDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.CONNECTIONS,
      safeDocId(clientId),
    )
  }

  saveConnection(doc: GoogleBusinessConnectionDoc): Promise<void> {
    const id = safeDocId(doc.clientId)
    return setDocument(GOOGLE_BUSINESS_COLLECTIONS.CONNECTIONS, { ...doc, id }, id)
  }

  saveOAuthState(doc: GoogleBusinessOAuthStateDoc): Promise<void> {
    return setDocument(GOOGLE_BUSINESS_COLLECTIONS.OAUTH_STATES, doc, doc.id)
  }

  getOAuthState(state: string): Promise<GoogleBusinessOAuthStateDoc | null> {
    return getDocument<GoogleBusinessOAuthStateDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.OAUTH_STATES,
      state,
    )
  }

  async deleteOAuthState(state: string): Promise<void> {
    await getDb().collection(GOOGLE_BUSINESS_COLLECTIONS.OAUTH_STATES).doc(state).delete()
  }

  upsertAccount(doc: GoogleBusinessAccountDoc): Promise<void> {
    const id = accountDocId(doc.clientId, doc.accountId)
    return setDocument(GOOGLE_BUSINESS_COLLECTIONS.ACCOUNTS, { ...doc, id }, id)
  }

  listAccountsByClient(clientId: string): Promise<GoogleBusinessAccountDoc[]> {
    return getDocuments<GoogleBusinessAccountDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.ACCOUNTS,
      [{ field: 'clientId', operator: '==', value: clientId }],
    )
  }

  upsertLocation(doc: GoogleBusinessLocationDoc): Promise<void> {
    const id = locationDocId(doc.clientId, doc.locationId)
    return setDocument(GOOGLE_BUSINESS_COLLECTIONS.LOCATIONS, { ...doc, id }, id)
  }

  listLocationsByClient(clientId: string): Promise<GoogleBusinessLocationDoc[]> {
    return getDocuments<GoogleBusinessLocationDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.LOCATIONS,
      [{ field: 'clientId', operator: '==', value: clientId }],
    )
  }

  async findLocationByResourceName(
    locationResourceName: string,
  ): Promise<GoogleBusinessLocationDoc | null> {
    const normalized = locationResourceName.replace(/^locations\//, '')
    const rows = await getDocuments<GoogleBusinessLocationDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.LOCATIONS,
      [{ field: 'locationId', operator: '==', value: normalized }],
    )
    return rows[0] ?? null
  }

  async getReview(reviewId: string): Promise<GoogleBusinessReviewDoc | null> {
    const byDocId = await getDocument<GoogleBusinessReviewDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.REVIEWS,
      safeDocId(reviewId),
    )
    if (byDocId) return byDocId

    const byReviewName = await this.getReviewByName(reviewId)
    if (byReviewName) return byReviewName

    const rows = await getDocuments<GoogleBusinessReviewDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.REVIEWS,
      [{ field: 'reviewId', operator: '==', value: reviewId }],
    )
    return rows[0] ?? null
  }

  getReviewByName(reviewName: string): Promise<GoogleBusinessReviewDoc | null> {
    return getDocument<GoogleBusinessReviewDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.REVIEWS,
      reviewDocId(reviewName),
    )
  }

  async upsertReview(doc: GoogleBusinessReviewDoc): Promise<void> {
    const id = reviewDocId(doc.reviewName || doc.reviewId)
    const existing = await this.getReviewByName(doc.reviewName || doc.reviewId)

    if (existing) {
      const merged: GoogleBusinessReviewDoc = {
        ...existing,
        ...doc,
        id,
        suggestedReply: doc.suggestedReply ?? existing.suggestedReply,
        requiresApproval: doc.requiresApproval ?? existing.requiresApproval,
        internalStatus: doc.internalStatus ?? existing.internalStatus,
        createdAt: existing.createdAt || doc.createdAt,
        updatedAt: doc.updatedAt,
      }
      await setDocument(GOOGLE_BUSINESS_COLLECTIONS.REVIEWS, merged, id)
      return
    }

    await setDocument(GOOGLE_BUSINESS_COLLECTIONS.REVIEWS, { ...doc, id }, id)
  }

  listReviewsByLocation(
    clientId: string,
    locationId: string,
  ): Promise<GoogleBusinessReviewDoc[]> {
    return getDocuments<GoogleBusinessReviewDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.REVIEWS,
      [
        { field: 'clientId', operator: '==', value: clientId },
        {
          field: 'locationId',
          operator: '==',
          value: locationId.replace(/^locations\//, ''),
        },
      ],
    )
  }

  saveReplyLog(doc: GoogleBusinessReplyLogDoc): Promise<void> {
    return setDocument(GOOGLE_BUSINESS_COLLECTIONS.REPLY_LOGS, doc, doc.id)
  }

  async hasPublishedLog(reviewName: string): Promise<boolean> {
    const rows = await getDocuments<GoogleBusinessReplyLogDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.REPLY_LOGS,
      [
        { field: 'reviewName', operator: '==', value: reviewName },
        { field: 'status', operator: '==', value: 'success' },
      ],
    )
    return rows.length > 0
  }

  getCompanyAiSettings(clientId: string): Promise<CompanyAiSettingsDoc | null> {
    return getDocument<CompanyAiSettingsDoc>(
      GOOGLE_BUSINESS_COLLECTIONS.AI_SETTINGS,
      safeDocId(clientId),
    )
  }

  upsertCompanyAiSettings(doc: CompanyAiSettingsDoc): Promise<void> {
    const id = safeDocId(doc.clientId)
    return setDocument(GOOGLE_BUSINESS_COLLECTIONS.AI_SETTINGS, { ...doc, id }, id)
  }

  saveNotificationEvent(doc: GoogleBusinessNotificationEventDoc): Promise<void> {
    return setDocument(GOOGLE_BUSINESS_COLLECTIONS.NOTIFICATION_EVENTS, doc, doc.id)
  }
}
