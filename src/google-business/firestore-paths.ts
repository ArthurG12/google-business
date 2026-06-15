export const GOOGLE_BUSINESS_COLLECTIONS = {
  CONNECTIONS: 'googleBusinessConnections',
  ACCOUNTS: 'googleBusinessAccounts',
  LOCATIONS: 'googleBusinessLocations',
  REVIEWS: 'reviews',
  REPLY_LOGS: 'reviewReplyLogs',
  AI_SETTINGS: 'companyAiSettings',
  OAUTH_STATES: 'googleBusinessOAuthStates',
  NOTIFICATION_EVENTS: 'googleBusinessNotificationEvents',
} as const

export function safeDocId(value: string): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_\-@.]/g, '_')
    .toLowerCase()
    .slice(0, 1500)
}

export function locationDocId(clientId: string, locationId: string): string {
  return safeDocId(`${clientId}__${locationId}`)
}

export function accountDocId(clientId: string, accountId: string): string {
  return safeDocId(`${clientId}__${accountId}`)
}

export function reviewDocId(reviewName: string): string {
  return safeDocId(reviewName)
}
