import { apiFetch, apiJson, parseJsonSafe } from "@/lib/api-client"
import type {
  CancellationRequest,
  Order,
  Product,
  Stats,
  User,
  VariantInput,
} from "@/features/dashboard/types"

export async function loadStats(): Promise<Stats | null> {
  try {
    const data = await apiJson<{ success?: boolean; stats?: Stats }>("/admin/stats")
    return data.success ? data.stats ?? null : null
  } catch (error) {
    console.error("Failed to load stats:", error)
    return null
  }
}

export async function loadUsers(): Promise<User[]> {
  try {
    const data = await apiJson<{ success?: boolean; users?: User[] }>("/admin/users?limit=100")
    return data.success ? data.users || [] : []
  } catch (error) {
    console.error("Failed to load users:", error)
    return []
  }
}

export async function loadProducts(): Promise<Product[]> {
  try {
    const data = await apiJson<{ success?: boolean; items?: Product[] }>("/admin/items?limit=100")
    return data.success ? data.items || [] : []
  } catch (error) {
    console.error("Failed to load products:", error)
    return []
  }
}

export async function loadOrders(): Promise<Order[]> {
  try {
    const data = await apiJson<{ success?: boolean; data?: { orders?: Order[] } }>(
      "/admin/orders?limit=100",
    )
    return data.success ? data.data?.orders || [] : []
  } catch (error) {
    console.error("Failed to load orders:", error)
    return []
  }
}

export async function loadCancellationRequests(): Promise<CancellationRequest[]> {
  try {
    const data = await apiJson<{ data?: { requests?: CancellationRequest[] } }>(
      "/admin/cancellation-requests?status=all",
    )
    return data.data?.requests || []
  } catch (error) {
    console.error("Failed to load cancellation requests:", error)
    return []
  }
}

export async function toggleUserStatus(userId: string, isActive: boolean) {
  return apiJson<{ success?: boolean }>(`/admin/users/${userId}/status`, {
    method: "PATCH",
    json: true,
    body: JSON.stringify({ isActive }),
  })
}

export async function toggleProductStatus(productId: string, isAvailable: boolean) {
  return apiJson<{ success?: boolean }>(`/admin/items/${productId}/status`, {
    method: "PATCH",
    json: true,
    body: JSON.stringify({ isAvailable }),
  })
}

export async function deleteProduct(productId: string) {
  const response = await apiFetch(`/admin/items/${productId}`, { method: "DELETE" })
  let data: { success?: boolean; message?: string } = {}
  try {
    data = await response.json()
  } catch {
    /* empty body ok */
  }
  return { ok: response.ok && (data.success === undefined || data.success), data, response }
}

export async function fetchProduct(productId: string) {
  return apiJson<{ item?: Product }>(`/admin/items/${productId}`)
}

export async function createProductJson(productData: Record<string, unknown>) {
  const response = await apiFetch("/admin/items", {
    method: "POST",
    json: true,
    body: JSON.stringify(productData),
  })
  return parseJsonSafe<{ success?: boolean; message?: string }>(response)
}

export async function createProductForm(form: FormData) {
  const response = await apiFetch("/admin/items", {
    method: "POST",
    body: form,
  })
  return parseJsonSafe<{ success?: boolean; message?: string }>(response)
}

export async function updateProductJson(productId: string, productData: Record<string, unknown>) {
  const response = await apiFetch(`/admin/items/${productId}`, {
    method: "PUT",
    json: true,
    body: JSON.stringify(productData),
  })
  return parseJsonSafe<{ success?: boolean; message?: string }>(response)
}

export async function updateProductForm(productId: string, form: FormData) {
  const response = await apiFetch(`/admin/items/${productId}`, {
    method: "PUT",
    body: form,
  })
  return parseJsonSafe<{ success?: boolean; message?: string }>(response)
}

export async function fetchInvoiceData(orderId: string) {
  return apiJson<{ success?: boolean; invoiceData?: any; message?: string }>(
    `/admin/orders/${orderId}/invoice/data`,
  )
}

export async function cancelOrder(orderMongoId: string, remark: string) {
  const response = await apiFetch(`/admin/orders/${orderMongoId}/cancel`, {
    method: "PATCH",
    json: true,
    body: JSON.stringify({ reason: remark, remarks: remark }),
  })
  return parseJsonSafe<{ success?: boolean; message?: string }>(response)
}

export async function approveCancellation(requestId: string, remarks: string) {
  return apiJson<{ success?: boolean; message?: string }>(
    `/admin/cancellation-requests/${requestId}/approve`,
    {
      method: "PATCH",
      json: true,
      body: JSON.stringify({ adminRemarks: remarks }),
    },
  )
}

export async function rejectCancellation(requestId: string, remarks: string) {
  return apiJson<{ success?: boolean; message?: string }>(
    `/admin/cancellation-requests/${requestId}/reject`,
    {
      method: "PATCH",
      json: true,
      body: JSON.stringify({
        adminRemarks: remarks,
        adminResponse: "Your cancellation request has been rejected",
      }),
    },
  )
}

export async function confirmOrder(orderId: string) {
  return apiJson<{ success?: boolean; message?: string }>(`/admin/orders/${orderId}/confirm`, {
    method: "PATCH",
    json: true,
  })
}

export async function markOrderPaid(orderId: string) {
  return apiJson<{ success?: boolean; message?: string }>(`/admin/orders/${orderId}/mark-paid`, {
    method: "PATCH",
    json: true,
  })
}

/** Retry Shiprocket shipment creation for a failed/outstation order. */
export async function retryShiprocketOrder(orderId: string) {
  return apiJson<{
    success?: boolean
    message?: string
    shiprocketOrderId?: string
    error?: string
  }>("/shiprocket/retry-order", {
    method: "POST",
    json: true,
    body: JSON.stringify({ orderId }),
  })
}

export function mapVariants(variants: VariantInput[]) {
  return variants.map((v) => ({
    label: v.label,
    price: Number.parseFloat(v.price),
    quantity: Number.parseInt(v.quantity),
  }))
}
