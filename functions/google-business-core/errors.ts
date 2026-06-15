function getGcpProjectId(): string {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    'seu-projeto-gcp'
  )
}

function isGbpQuotaBlocked(message: string): boolean {
  return message.includes('Quota exceeded') || message.includes('429')
}

export function formatGoogleBusinessApiError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  const projectId = getGcpProjectId()
  const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER || '170446672666'

  if (
    message.includes('mybusinessaccountmanagement') &&
    isGbpQuotaBlocked(message)
  ) {
    return new Error(
      `Projeto GCP ainda sem aprovação para Google Business Profile API (quota 0/min). ` +
        `Ativar a API no console não libera acesso — é preciso solicitar aprovação: ` +
        `https://support.google.com/business/contact/api_default ` +
        `(opção "Application for Basic API Access", project number ${projectNumber}). ` +
        `Após aprovação a quota sobe para 300/min. Verifique em ` +
        `https://console.cloud.google.com/apis/api/mybusinessaccountmanagement.googleapis.com/quotas?project=${projectId}`,
    )
  }

  if (
    message.includes('mybusinessbusinessinformation') &&
    isGbpQuotaBlocked(message)
  ) {
    return new Error(
      `Projeto GCP ainda sem aprovação para Google Business Profile API (quota 0/min). ` +
        `Solicite acesso em https://support.google.com/business/contact/api_default ` +
        `(opção "Application for Basic API Access", project number ${projectNumber}).`,
    )
  }

  return error instanceof Error ? error : new Error(message)
}
