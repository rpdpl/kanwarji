export interface InvoiceItem {
  name: string
  price: number
  quantity: number
}

export interface User {
  _id: string
  name: string
  email: string
  phone: string
  userType: "buyer" | "seller" | "admin"
  isActive: boolean
  createdAt: string
}

export interface Product {
  _id: string
  name: string
  productDetails: string
  price: number
  category: string
  imageUrls?: string[]
  images?: string[]
  imageUrl?: string
  videoUrl?: string
  quantity: number
  unit: string
  sellerId: string
  sellerName: string
  isAvailable: boolean
  createdAt: string
  discount?: number
  tax?: number
  hasVAT?: boolean
  discountPercent?: number
  taxPercent?: number
  applyVAT?: boolean
  isSpecialItem?: boolean
  variants?: Array<{ label: string; price: number; quantity: number }>
}

export interface OrderItem {
  name: string
  price: number
  quantity: number
  unit?: string
  variantLabel?: string
}

export interface Order {
  _id: string
  orderId: string
  userId: string
  items: OrderItem[]
  address: {
    name: string
    phone: string
    address: string
    city: string
    state: string
    pincode: string
  }
  paymentMethod: string
  paymentStatus: string
  paymentId?: string
  orderStatus: string
  totalAmount: number
  specialRequests?: string
  createdAt: string
  convenienceFee?: number
  shiprocketOrderId?: string
  shipmentStatus?: string
  shiprocketError?: string
  awbNumber?: string
  shiprocketFee?: number
  isLocalShiprocket?: boolean
}

export interface CancellationRequest {
  _id: string
  orderIdStr: string
  orderId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  cancellationReason: string
  status: "pending" | "approved" | "rejected"
  totalAmount: number
  paymentMethod: string
  paymentStatus: string
  items: OrderItem[]
  address: {
    name: string
    phone: string
    address: string
    city: string
    state: string
    pincode: string
  }
  adminRemarks?: string
  adminResponse?: string
  createdAt: string
}

export interface Stats {
  totalUsers: number
  totalSellers: number
  pendingRequests: number
  activeSellers: number
  totalProducts: number
  availableProducts: number
  hiddenProducts: number
  totalOrders: number
}

export type VariantInput = { label: string; price: string; quantity: string }

export type ProductFormState = {
  name: string
  productDetails: string
  category: string
  imageUrl: string
  discountPercent: string
  taxPercent: string
  isSpecialItem: boolean
}

export type EditFormState = {
  name: string
  productDetails: string
  category: string
  imageUrls: string
  discountPercent: string
  taxPercent: string
  isSpecialItem: boolean
}

export const emptyStats = (): Stats => ({
  totalUsers: 0,
  totalSellers: 0,
  pendingRequests: 0,
  activeSellers: 0,
  totalProducts: 0,
  availableProducts: 0,
  hiddenProducts: 0,
  totalOrders: 0,
})

export const emptyProductForm = (): ProductFormState => ({
  name: "",
  productDetails: "",
  category: "Fruits",
  imageUrl: "",
  discountPercent: "",
  taxPercent: "",
  isSpecialItem: false,
})

export const emptyEditForm = (): EditFormState => ({
  name: "",
  productDetails: "",
  category: "Fruits",
  imageUrls: "",
  discountPercent: "",
  taxPercent: "",
  isSpecialItem: false,
})
