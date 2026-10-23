import { API_BASE_URL } from "./config"

export const getAuthHeaders = (opts?: { json?: boolean }) => {
  const token = localStorage.getItem("auth_token")
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }
  if (opts?.json) {
    headers["Content-Type"] = "application/json"
  }
  return headers
}

export const loadStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/stats`, {
      headers: getAuthHeaders(),
    })
    const data = await response.json()
    return data.success ? data.stats : null
  } catch (error) {
    console.error("Failed to load stats:", error)
    return null
  }
}

export const loadUsers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users?limit=100`, {
      headers: getAuthHeaders(),
    })
    const data = await response.json()
    return data.success ? data.users : []
  } catch (error) {
    console.error("Failed to load users:", error)
    return []
  }
}

export const loadProducts = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/items?limit=100`, {
      headers: getAuthHeaders(),
    })
    const data = await response.json()
    return data.success ? data.items : []
  } catch (error) {
    console.error("Failed to load products:", error)
    return []
  }
}

export const loadOrders = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/orders?limit=100`, {
      headers: getAuthHeaders(),
    })
    const data = await response.json()
    return data.success ? data.data.orders : []
  } catch (error) {
    console.error("Failed to load orders:", error)
    return []
  }
}