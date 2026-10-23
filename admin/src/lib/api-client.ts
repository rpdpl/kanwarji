import { API_BASE_URL } from "@/app/lib/config"

export type ApiClientOptions = {
  method?: string
  body?: BodyInit | null
  /** When true, sets Content-Type: application/json (do not use with FormData). */
  json?: boolean
  headers?: Record<string, string>
  /** Skip Authorization header (e.g. public auth endpoints). */
  skipAuth?: boolean
}

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("auth_token")
}

/**
 * Authenticated fetch against API_BASE_URL (already includes `/api`).
 * Path should be like `/admin/stats` or `admin/stats`.
 */
export async function apiFetch(path: string, opts: ApiClientOptions = {}): Promise<Response> {
  const normalized = path.startsWith("/") ? path : `/${path}`
  const url = `${API_BASE_URL}${normalized}`

  const headers: Record<string, string> = { ...(opts.headers || {}) }

  if (!opts.skipAuth) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  if (opts.json && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }

  return fetch(url, {
    method: opts.method || "GET",
    headers,
    body: opts.body,
  })
}

/** Parse JSON; on failure return a shape matching existing admin error handling. */
export async function parseJsonSafe<T = any>(response: Response): Promise<T> {
  const rawText = await response.text()
  try {
    return (rawText ? JSON.parse(rawText) : {}) as T
  } catch {
    return { success: false, message: rawText || `HTTP ${response.status}` } as T
  }
}

export async function apiJson<T = any>(path: string, opts: ApiClientOptions = {}): Promise<T> {
  const response = await apiFetch(path, opts)
  return parseJsonSafe<T>(response)
}
