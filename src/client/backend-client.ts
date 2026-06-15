import axios, { AxiosRequestConfig } from 'axios'

function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function buildConfig(apiKey?: string): AxiosRequestConfig {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey?.trim()) {
    headers['x-api-key'] = apiKey.trim()
  }
  return { timeout: 20000, headers }
}

export async function gbGet<T>(
  backendUrl: string,
  path: string,
  params: Record<string, string | undefined>,
  apiKey?: string,
): Promise<T> {
  const base = normalizeBackendUrl(backendUrl)
  const { data } = await axios.get<T>(`${base}${path}`, {
    ...buildConfig(apiKey),
    params,
  })
  return data
}

export async function gbPost<T>(
  backendUrl: string,
  path: string,
  params: Record<string, string | undefined>,
  body?: unknown,
  apiKey?: string,
): Promise<T> {
  const base = normalizeBackendUrl(backendUrl)
  const { data } = await axios.post<T>(`${base}${path}`, body ?? {}, {
    ...buildConfig(apiKey),
    params,
  })
  return data
}
