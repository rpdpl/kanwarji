/**
 * Re-export loaders from shared admin API (api-client backed).
 * Kept for existing import paths.
 */
export {
  loadStats,
  loadUsers,
  loadProducts,
  loadOrders,
  loadCancellationRequests,
} from "@/lib/admin-api"

import { apiFetch } from "@/lib/api-client"

/** @deprecated Prefer apiFetch from @/lib/api-client */
export const getAuthHeaders = (opts?: { json?: boolean }) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts?.json) headers["Content-Type"] = "application/json"
  return headers
}

/** Thin wrapper retained for call sites that still build headers manually. */
export { apiFetch }
