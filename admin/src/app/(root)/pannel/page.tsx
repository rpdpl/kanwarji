"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import logo from "../../../../public/logo1.png"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Users,
  Package,
  ShoppingCart,
  Eye,
  LogOut,
  RefreshCw as Refresh,
  Download,
  Plus,
  BarChart3,
  TrendingUp,
  Activity,
  Bell,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Trash,
  Edit,
  Save,
  AlertCircle,
} from "lucide-react"

import { API_BASE_URL } from "../../lib/config"
import { loadProducts, loadStats, loadUsers, loadOrders, getAuthHeaders } from "../../lib/data"
import { GroceryItems } from "../../lib/grocery-items"

// Inline Shiprocket utilities to avoid import issues
const getTrackingUrl = (awbNumber: string): string => {
  return `https://shiprocket.co/tracking/${awbNumber}`;
};

interface InvoiceItem {
  name: string
  price: number
  quantity: number
}

function ImageSlider({ urls }: { urls: string[] }): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const scrollBy = (delta: number) => {
    const el = containerRef.current
    if (!el) return
    el.scrollBy({ left: delta, behavior: "smooth" })
  }
  if (!urls || urls.length === 0) return null
  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="flex overflow-x-auto no-scrollbar space-x-2 snap-x snap-mandatory w-full max-w-xs sm:max-w-sm"
      >
        {urls.slice(0, 4).map((url, idx) => (
          <img
            key={idx}
            src={url || "/placeholder.svg"}
            alt={`image ${idx + 1}`}
            className="snap-center shrink-0 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-cover rounded border border-gray-200 bg-white"
            onError={(e) => {
              ; (e.currentTarget as HTMLImageElement).src = "/placeholder.svg?thumb=1"
            }}
          />
        ))}
      </div>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollBy(-120)}
            className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 border border-gray-200 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow text-sm"
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollBy(120)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 border border-gray-200 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow text-sm"
            aria-label="Next"
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}

interface User {
  _id: string
  name: string
  email: string
  phone: string
  userType: "buyer" | "seller" | "admin"
  isActive: boolean
  createdAt: string
}
interface Product {
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
}
interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  variantLabel?: string;
}
interface Order {
  _id: string;
  orderId: string;
  userId: string;
  items: OrderItem[];
  address: { name: string; phone: string; address: string; city: string; state: string; pincode: string };
  paymentMethod: string;
  paymentStatus: string;
  paymentId?: string;
  orderStatus: string;
  totalAmount: number;
  specialRequests?: string;
  createdAt: string;
  convenienceFee?: number;
}
interface CancellationRequest {
  _id: string;
  orderIdStr: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  cancellationReason: string;
  status: "pending" | "approved" | "rejected";
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  items: OrderItem[];
  address: { name: string; phone: string; address: string; city: string; state: string; pincode: string };
  adminRemarks?: string;
  adminResponse?: string;
  createdAt: string;
}
interface Stats {
  totalUsers: number
  totalSellers: number
  pendingRequests: number
  activeSellers: number
  totalProducts: number
  availableProducts: number
  hiddenProducts: number
  totalOrders: number
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalSellers: 0,
    pendingRequests: 0,
    activeSellers: 0,
    totalProducts: 0,
    availableProducts: 0,
    hiddenProducts: 0,
    totalOrders: 0,
  })
  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [userSearchTerm, setUserSearchTerm] = useState("")
  const [orderSearchTerm, setOrderSearchTerm] = useState("")
  const [cancellationSearchTerm, setCancellationSearchTerm] = useState("")
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<Order | null>(null)
  const [cancelRemark, setCancelRemark] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)
  const router = useRouter()

  const [isAddingProduct, setIsAddingProduct] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imageSelectionMode, setImageSelectionMode] = useState<"url" | "upload">("url")
  const [selectedCategory, setSelectedCategory] = useState("Fruits")
  const [selectedPredefinedItem, setSelectedPredefinedItem] = useState<string | null>(null)

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024

  const [productForm, setProductForm] = useState({
    name: "",
    productDetails: "",
    category: "Fruits",
    imageUrl: "",
    discountPercent: "",
    taxPercent: "",
    isSpecialItem: false,
  })

  // Variants for new product: array of { label, price, quantity } stored as strings for inputs
  const [productVariants, setProductVariants] = useState<Array<{ label: string; price: string; quantity: string }>>([])

  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    productDetails: "",
    category: "Fruits",
    imageUrls: "", // comma-separated
    discountPercent: "",
    taxPercent: "",
    isSpecialItem: false,
  })
  const [editVariants, setEditVariants] = useState<Array<{ label: string; price: string; quantity: string }>>([])
  const [editImageMode, setEditImageMode] = useState<"url" | "upload">("url")
  const [editSelectedImages, setEditSelectedImages] = useState<File[]>([])

  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    const userData = localStorage.getItem("user_data")

    if (!token || !userData) {
      router.push("/login")
      return
    }

    const parsedUser = JSON.parse(userData)
    if (parsedUser.userType !== "admin") {
      router.push("/login")
      return
    }

    setUser(parsedUser)
    loadDashboardData()
  }, [router])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const [statsData, usersData, productsData, ordersData, cancellationData] = await Promise.all([
        loadStats(),
        loadUsers(),
        loadProducts(),
        loadOrders(),
        loadCancellationRequests(),
      ])
      if (statsData) setStats(statsData)
      setUsers(usersData)
      setProducts(productsData)
      setOrders(ordersData)
      setCancellationRequests(cancellationData)
    } catch (error) {
      setError("Failed to load dashboard data")
    } finally {
      setIsLoading(false)
    }
  }

  const loadCancellationRequests = async (): Promise<CancellationRequest[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/cancellation-requests?status=all`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      return data.data?.requests || []
    } catch (error) {
      console.error("Failed to load cancellation requests:", error)
      return []
    }
  }

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders({ json: true }),
        body: JSON.stringify({ isActive }),
      })
      const data = await response.json()
      if (data.success) {
        const updatedUsers = await loadUsers()
        setUsers(updatedUsers)
      }
    } catch (error) {
      console.error("Failed to toggle user status:", error)
    }
  }

  const toggleProductStatus = async (productId: string, isAvailable: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/items/${productId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders({ json: true }),
        body: JSON.stringify({ isAvailable }),
      })
      const data = await response.json()
      if (data.success) {
        const [updatedProducts, updatedStats] = await Promise.all([loadProducts(), loadStats()])
        setProducts(updatedProducts)
        if (updatedStats) setStats(updatedStats)
      }
    } catch (error) {
      console.error("Failed to toggle product status:", error)
    }
  }

  const deleteProduct = async (productId: string) => {
    const confirmDelete = window.confirm("Delete this product? This action cannot be undone.")
    if (!confirmDelete) return
    try {
      const response = await fetch(`${API_BASE_URL}/admin/items/${productId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      })
      let data: any = {}
      try {
        data = await response.json()
      } catch (_) { }
      if (response.ok && (data.success === undefined || data.success)) {
        const [updatedProducts, updatedStats] = await Promise.all([loadProducts(), loadStats()])
        setProducts(updatedProducts)
        if (updatedStats) setStats(updatedStats)

      } else {
        setError(data.message || "Failed to delete product")
      }
    } catch (error) {
      console.error("Failed to delete product:", error)
      setError("Failed to delete product")
    }
  }

  const getPredefinedItemImageUrl = (itemName: string) => {
    return GroceryItems.getImageUrl(itemName)
  }

  const handlePredefinedImageSelect = (imageName: string) => {
    const imageUrl = getPredefinedItemImageUrl(imageName)
    setSelectedPredefinedItem(imageName)
    setSelectedImage(null)
    setProductForm({ ...productForm, name: imageName, imageUrl: imageUrl || "" })
  }

  const handleCustomUrlChange = (url: string) => {
    setSelectedPredefinedItem(null)
    setSelectedImage(null)
    setProductForm({ ...productForm, imageUrl: url })
  }

  const handleImagesUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const imagesOnly = files.filter((f) => f.type.startsWith("image/"))
    for (const f of imagesOnly) {
      if (f.size > MAX_IMAGE_SIZE) {
        setError(`Image too large. Max ${Math.round(MAX_IMAGE_SIZE / (1024 * 1024))}MB allowed.`)
        return
      }
    }
    const combined = [...selectedImages, ...imagesOnly].slice(0, 4)
    setSelectedImages(combined)
    setSelectedPredefinedItem(null)
    setProductForm({
      ...productForm,
      imageUrl: combined.length ? URL.createObjectURL(combined[0]) : "",
    })
  }

  const addProduct = async () => {
    try {
      const hasVariants = productVariants && productVariants.length > 0

      // Validate either variants or legacy price/quantity
      if (!productForm.name.trim() || !productForm.productDetails.trim()) {
        setError("Name and product details are required")
        return
      }
      if (hasVariants) {
        for (const v of productVariants) {
          if (!v.label || v.label.trim() === "") {
            setError("Each variant requires a label")
            return
          }
          const vp = Number.parseFloat(v.price)
          const vq = Number.parseInt(v.quantity)
          if (isNaN(vp) || vp <= 0) {
            setError("Each variant must have a valid price > 0")
            return
          }
          if (isNaN(vq) || vq < 0) {
            setError("Each variant must have a valid quantity (>= 0)")
            return
          }
        }
      } else {
        // Legacy validation path when no variants are provided
        const legacyPrice = Number.parseFloat((productForm as any).price)
        const legacyQty = Number.parseInt((productForm as any).quantity)
        if (isNaN(legacyPrice) || legacyPrice <= 0 || isNaN(legacyQty) || legacyQty <= 0) {
          setError("All required fields must be valid: name, product details, price > 0, quantity > 0")
          return
        }
      }

      let finalImageUrl = productForm.imageUrl
      if (selectedPredefinedItem !== null) {
        const predefinedUrl = getPredefinedItemImageUrl(selectedPredefinedItem)
        finalImageUrl = predefinedUrl || productForm.imageUrl
      }

      let response: Response
      if (selectedImages.length > 0) {
        if (selectedImages.length > 4) {
          setError("Maximum 4 images allowed.")
          return
        }
        for (const img of selectedImages) {
          if (img.size > MAX_IMAGE_SIZE) {
            setError(`Image too large. Max ${Math.round(MAX_IMAGE_SIZE / (1024 * 1024))}MB allowed.`)
            return
          }
        }

        const form = new FormData()
        selectedImages.forEach((img) => form.append("images", img))

        form.append("name", productForm.name)
        form.append("productDetails", productForm.productDetails)
        form.append("category", productForm.category)
        // attach variants as JSON string (backend requires variants)
        form.append(
          "variants",
          JSON.stringify(
            productVariants.map((v) => ({ label: v.label, price: Number.parseFloat(v.price), quantity: Number.parseInt(v.quantity) }))
          )
        )
        // Compatibility: some servers still require legacy price/quantity/unit
        try {
          const compatPrice = productVariants.length > 0 ? Number.parseFloat(productVariants[0].price) : undefined
          const compatQuantity = productVariants.reduce((s, v) => s + (Number.parseInt(v.quantity) || 0), 0)
          if (!Number.isNaN(compatPrice as number)) {
            form.append("price", String(compatPrice))
          }
          if (compatQuantity > 0) {
            form.append("quantity", String(compatQuantity))
          }
          const compatUnit = productVariants.length > 0 ? productVariants[0].label || "unit" : "unit"
          form.append("unit", compatUnit)
        } catch { }
        form.append("isAvailable", "true")
        form.append("discount", String(productForm.discountPercent ? Number.parseFloat(productForm.discountPercent) : 0))
        form.append("tax", String(productForm.taxPercent ? Number.parseFloat(productForm.taxPercent) : 0))
        form.append("isSpecialItem", String(productForm.isSpecialItem))

        response = await fetch(`${API_BASE_URL}/admin/items`, {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          } as any,
          body: form,
        })
      } else {
        const urls = (finalImageUrl || "")
          .split(",")
          .map((u) => u.trim())
          .filter((u) => u.length > 0)
          .slice(0, 4)

        const productData: any = {
          name: productForm.name,
          productDetails: productForm.productDetails,
          category: productForm.category,
          imageUrls: urls,
          isAvailable: true,
          discount: productForm.discountPercent ? Number.parseFloat(productForm.discountPercent) : 0,
          tax: productForm.taxPercent ? Number.parseFloat(productForm.taxPercent) : 0,
          isSpecialItem: productForm.isSpecialItem,
        }
        // attach variants (required)
        productData.variants = productVariants.map((v) => ({ label: v.label, price: Number.parseFloat(v.price), quantity: Number.parseInt(v.quantity) }))
        // Back-compat: also include top-level price/quantity/unit derived from variants
        try {
          const compatPrice = productVariants.length > 0 ? Number.parseFloat(productVariants[0].price) : undefined
          const compatQuantity = productVariants.reduce((s, v) => s + (Number.parseInt(v.quantity) || 0), 0)
          if (!Number.isNaN(compatPrice as number)) {
            productData.price = compatPrice
          }
          if (compatQuantity > 0) {
            productData.quantity = compatQuantity
          }
          productData.unit = productVariants.length > 0 ? productVariants[0].label || "unit" : "unit"
        } catch { }

        response = await fetch(`${API_BASE_URL}/admin/items`, {
          method: "POST",
          headers: {
            ...getAuthHeaders({ json: true }),
          },
          body: JSON.stringify(productData),
        })
      }

      let data: any
      const rawText = await response.text()
      try {
        data = rawText ? JSON.parse(rawText) : {}
      } catch (e) {
        data = { success: false, message: rawText }
      }

      if (data.success) {
        setProductForm({
          name: "",
          productDetails: "",
          category: "Fruits",
          imageUrl: "",
          discountPercent: "",
          taxPercent: "",
          isSpecialItem: false,
        })
        setProductVariants([])
        setSelectedImage(null)
        setSelectedImages([])
        setSelectedPredefinedItem(null)
        setImageSelectionMode("url")
        setIsAddingProduct(false)

        const [updatedProducts, updatedStats] = await Promise.all([loadProducts(), loadStats()])
        setProducts(updatedProducts)
        if (updatedStats) setStats(updatedStats)
      } else {
        setError(data.message || "Failed to add product")
      }
    } catch (error) {
      setError("Failed to add product. Please try again.")
    }
  }

  const downloadInvoice = async (order: Order) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/orders/${order.orderId}/invoice/data`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      if (data.success) {
        const invoiceData = data.invoiceData

        // Import jsPDF dynamically
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        })

        // Set base Latin font
        doc.setFont('helvetica')

        // Try loading a Unicode font that supports Devanagari (Hindi)
        // We load TTF at runtime and register it with jsPDF VFS
        const fetchAsBase64 = async (url: string): Promise<string> => {
          const resp = await fetch(url)
          if (!resp.ok) throw new Error(`HTTP ${resp.status} for font`)
          const buf = await resp.arrayBuffer()
          let binary = ''
          const bytes = new Uint8Array(buf)
          const len = bytes.byteLength
          for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i])
          return btoa(binary)
        }

        const loadUnicodeFont = async (): Promise<boolean> => {
          const tryUrls = [
            // Prefer locally hosted copies if present
            '/fonts/NotoSansDevanagari-Regular.ttf',
            '/NotoSansDevanagari-Regular.ttf',
            // Fallback to a public source (GitHub raw)
            'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf',
          ]
          for (const u of tryUrls) {
            try {
              const b64 = await fetchAsBase64(u)
              doc.addFileToVFS('NotoSansDevanagari-Regular.ttf', b64)
              doc.addFont('NotoSansDevanagari-Regular.ttf', 'NotoSansDeva', 'normal')
              return true
            } catch (e) {
              console.warn('Unicode font load failed:', u, e)
            }
          }
          return false
        }

        const unicodeFontLoaded = await loadUnicodeFont()

        let yPos = 20
        const pageWidth = doc.internal.pageSize.getWidth()
        const leftMargin = 20
        const rightMargin = pageWidth - 20
        const contentWidth = rightMargin - leftMargin

        // Header - Logo and Company Name
        let lastLogoHeight = 0
        const addLogo = async (url: string) => {
          const logoWidth = 48
          const logoHeight = 20
          const logoX = (pageWidth - logoWidth) / 2

          try {
            // Use fetch to get the image as blob, then convert to base64
            const imgResponse = await fetch(url)
            const blob = await imgResponse.blob()
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                const result = reader.result as string
                resolve(result)
              }
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })

            doc.addImage(base64, 'PNG', logoX, yPos, logoWidth, logoHeight, undefined, 'FAST')
            lastLogoHeight = logoHeight
            return true
          } catch (err) {
            console.error('Failed to load logo:', err)
            return false
          }
        }

        // Try to load logo - prefer same-origin first, then remote
        let logoLoaded = false
        try {
          const logoSrc = typeof logo === 'string' ? logo : (logo as any)?.src || '/logo2.png'
          logoLoaded = await addLogo(logoSrc)
        } catch (err) {
          console.warn('Local logo load error:', err)
        }
        if (!logoLoaded) {
          try {
            logoLoaded = await addLogo('https://kanwarji.in/logo1.png')
          } catch (err2) {
            console.warn('Remote logo load error:', err2)
          }
        }

        // Leave space below the logo equal to its height plus margin
        if (logoLoaded) {
          yPos += (lastLogoHeight || 20) + 12
        }
        doc.setFontSize(22)
        doc.setFont('helvetica', 'bold')
        if (!logoLoaded) {
          // If still no logo, add minor top padding for balance
          yPos += 6
        }
        doc.text('Kanwarji Bhagirath Mal', pageWidth / 2, yPos, { align: 'center' })
        yPos += 10

        // Order Details Title
        doc.setFontSize(18)
        doc.text('ORDER DETAILS', pageWidth / 2, yPos, { align: 'center' })
        yPos += 8

        doc.setFontSize(14)
        doc.text(`Order ID: ${order.orderId}`, pageWidth / 2, yPos, { align: 'center' })
        yPos += 15

        // Order Info Section
        doc.setFillColor(253, 240, 240)
        doc.rect(leftMargin, yPos - 5, contentWidth, 50, 'F')

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('Date:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(new Date(order.createdAt).toLocaleDateString(), leftMargin + 40, yPos)
        yPos += 7

        doc.setFont('helvetica', 'bold')
        doc.text('Customer:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(invoiceData.customer.name, leftMargin + 40, yPos)
        yPos += 7

        doc.setFont('helvetica', 'bold')
        doc.text('Phone:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(invoiceData.customer.phone, leftMargin + 40, yPos)
        yPos += 7

        doc.setFont('helvetica', 'bold')
        doc.text('Email:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(invoiceData.customer.email, leftMargin + 40, yPos)
        yPos += 7

        doc.setFont('helvetica', 'bold')
        doc.text('Address:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        const addressText = `${invoiceData.customer.address.address}, ${invoiceData.customer.address.city}, ${invoiceData.customer.address.state} - ${invoiceData.customer.address.pincode}`
        const addressLines = doc.splitTextToSize(addressText, contentWidth - 45)
        doc.text(addressLines, leftMargin + 40, yPos)
        yPos += 7 * addressLines.length

        doc.setFont('helvetica', 'bold')
        doc.text('Payment:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(invoiceData.order.paymentMethod.toUpperCase(), leftMargin + 40, yPos)
        yPos += 7

        doc.setFont('helvetica', 'bold')
        doc.text('Status:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(`${invoiceData.order.paymentStatus.toUpperCase()} / ${invoiceData.order.orderStatus.toUpperCase()}`, leftMargin + 40, yPos)
        yPos += 15

        // Special Requests
        if (order.specialRequests) {
          doc.setFillColor(249, 229, 151)
          doc.rect(leftMargin, yPos - 5, contentWidth, 15, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.text('Special Requests:', leftMargin + 5, yPos)
          yPos += 6
          // Switch to Unicode Devanagari font ONLY if the text has Hindi characters; otherwise keep Latin font
          const hasDevanagari = /[\u0900-\u097F]/.test(order.specialRequests || '')
          if (unicodeFontLoaded && hasDevanagari) {
            doc.setFont('NotoSansDeva', 'normal')
          } else {
            doc.setFont('helvetica', 'normal')
          }
          doc.setFontSize(9)
          // Sanitize: normalize Unicode, drop control chars, replace NBSP with space
          const srRaw = String(order.specialRequests || '')
          const sr = srRaw
            .normalize('NFC')
            .replace(/[\u0000-\u001F\u007F]/g, '')
            .replace(/\u00A0/g, ' ')
          // Wrap text using splitTextToSize (compatible across jsPDF versions)
          const maxWidth = contentWidth - 10
          const wrapped = doc.splitTextToSize(sr, maxWidth)
          doc.text(wrapped as any, leftMargin + 5, yPos)
          const lineHeight = 6
          yPos += (Array.isArray(wrapped) ? wrapped.length : 1) * lineHeight + 8
          // Restore base font for the rest of the document
          doc.setFont('helvetica', 'normal')
        }

        // Table column setup
        const COL = {
          padding: 4,
          totalRight: rightMargin - 4,
          totalWidth: 30,
          priceWidth: 30,
          qtyWidth: 30,
        }
        const totalLeft = COL.totalRight - COL.totalWidth
        const priceRight = totalLeft - 2
        const priceLeft = priceRight - COL.priceWidth
        const qtyRight = priceLeft - 2
        const qtyLeft = qtyRight - COL.qtyWidth
        const itemLeft = leftMargin + COL.padding
        const itemRight = qtyLeft - 2

        const drawTableHeader = () => {
          doc.setFillColor(252, 220, 220)
          doc.rect(leftMargin, yPos, contentWidth, 12, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text('Item', itemLeft, yPos + 8)
          doc.text('Qty', qtyRight, yPos + 8, { align: 'right' })
          doc.text('Price', priceRight, yPos + 8, { align: 'right' })
          doc.text('Total', COL.totalRight, yPos + 8, { align: 'right' })
          yPos += 14
          doc.setDrawColor(230)
          doc.line(leftMargin, yPos, leftMargin, yPos - 14)
          doc.line(itemRight, yPos, itemRight, yPos - 14)
          doc.line(qtyRight + 1, yPos, qtyRight + 1, yPos - 14)
          doc.line(priceRight + 1, yPos, priceRight + 1, yPos - 14)
          doc.line(COL.totalRight + 1, yPos, COL.totalRight + 1, yPos - 14)
          doc.line(leftMargin + contentWidth, yPos, leftMargin + contentWidth, yPos - 14)
        }

        drawTableHeader()

        // Items
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const lineHeight = 6

        invoiceData.order.items.forEach((item: any) => {
          const variant = item.variantLabel || item.unit
          const itemName = `${item.name}${variant ? ` (${variant})` : ''}`
          const qtyText = String(item.quantity)
          const priceText = `Rs ${Number(item.price).toFixed(2)}`
          const totalText = `Rs ${(item.price * item.quantity).toFixed(2)}`

          const wrappedName = doc.splitTextToSize(itemName, itemRight - itemLeft - 2)
          const rowHeight = Math.max(lineHeight, wrappedName.length * lineHeight)

          if (yPos + rowHeight > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage()
            yPos = 20
            drawTableHeader()
          }

          const startY = yPos - (lineHeight - 2)
          const boxH = rowHeight + 3
          doc.setFillColor(255, 245, 245)
          doc.rect(leftMargin, startY, contentWidth, boxH, 'F')
          doc.setDrawColor(235)
          doc.rect(leftMargin, startY, itemRight - leftMargin, boxH)
          doc.rect(itemRight, startY, qtyRight - itemRight, boxH)
          doc.rect(qtyRight, startY, priceRight - qtyRight, boxH)
          doc.rect(priceRight, startY, COL.totalRight - priceRight, boxH)

          doc.setTextColor(0, 0, 0)
          doc.text(wrappedName as any, itemLeft, yPos)
          doc.text(qtyText, qtyRight, yPos, { align: 'right' })
          doc.text(priceText, priceRight, yPos, { align: 'right' })
          doc.text(totalText, COL.totalRight, yPos, { align: 'right' })

          doc.setDrawColor(220)
          doc.line(leftMargin, startY + boxH, leftMargin + contentWidth, startY + boxH)

          yPos += rowHeight + 2
        })

        yPos += 5

        // Compute convenience fee + 18% GST and updated total
        const convBase = Number(invoiceData.order.convenienceFee || 0)
        const convGst = Number((convBase * 0.18).toFixed(2))
        const convTotal = Number((convBase + convGst).toFixed(2))
        const updatedTotalForPdf = Number(((Number(invoiceData.order.totalAmount || 0)) + convTotal).toFixed(2))

        // Totals Section
        doc.setFillColor(260, 260, 260)
        const totalsHeight = 25
        doc.rect(leftMargin, yPos, contentWidth, totalsHeight, 'F')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        yPos += 7
        doc.text('Subtotal:', leftMargin + 110, yPos)
        doc.text(`Rs ${invoiceData.order.subtotal?.toFixed(2) || '0.00'}`, rightMargin - 5, yPos, { align: 'right' })
        yPos += 6

        const dFee = Number(invoiceData.order.deliveryFee || invoiceData.order.shiprocketFee || 0)
        if (dFee > 0) {
          doc.text('Delivery / Shipping Fee:', leftMargin + 110, yPos)
          doc.text(`Rs ${dFee.toFixed(2)}`, rightMargin - 5, yPos, { align: 'right' })
        } else {
          doc.setFontSize(8)
          doc.text('Local delivery charges payable at time of delivery', leftMargin + 110, yPos)
          doc.setFontSize(10)
        }
        yPos += 6

        if (Number(invoiceData.order.taxAmount) > 0) {
          doc.text('Tax:', leftMargin + 110, yPos)
          doc.text(`Rs ${Number(invoiceData.order.taxAmount).toFixed(2)}`, rightMargin - 5, yPos, { align: 'right' })
          yPos += 6
        } else {
          yPos += 2
        }

        if (convTotal > 0) {
          // Show single combined Convenience Fee (including GST)
          doc.text('Convenience Fee:', leftMargin + 110, yPos)
          doc.text(`Rs ${convTotal.toFixed(2)}`, rightMargin - 5, yPos, { align: 'right' })
          yPos += 8
        } else {
          yPos += 2
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text('Total Amount:', leftMargin + 110, yPos)
        const finalTotal = updatedTotalForPdf.toFixed(2)
        doc.text(`Rs ${finalTotal}`, rightMargin - 5, yPos, { align: 'right' })
        yPos += 15

        // Footer
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        yPos = doc.internal.pageSize.getHeight() - 25
        doc.text('Kanwarji Bhagirath Mal', pageWidth / 2, yPos, { align: 'center' })
        yPos += 5
        doc.text('1972, Chandni Chowk, Delhi- 110006. Delhi. Bharat (India)', pageWidth / 2, yPos, { align: 'center' })
        yPos += 5
        doc.text('Email: kanwarji@rpdindia.com | Phone: +91-9811049585', pageWidth / 2, yPos, { align: 'center' })
        yPos += 5
        doc.text('Thank you for shopping with us!', pageWidth / 2, yPos, { align: 'center' })

        // Save the PDF
        doc.save(`Kanwarji-order-details-${order.orderId}.pdf`)
      }
    } catch (error) {
      console.error("Failed to download invoice:", error)
      setError("Failed to download invoice")
    }
  }
  const startEdit = (product: any) => {
    setEditingProductId(product._id)
    setEditForm({
      name: product.name,
      productDetails: product.productDetails || "",
      category: product.category,
      imageUrls: Array.isArray(product.imageUrls) ? product.imageUrls.join(", ") : (product.imageUrls || ""),
      discountPercent: product.discountPercent?.toString() || "",
      taxPercent: product.taxPercent?.toString() || "",
      isSpecialItem: product.isSpecialItem || false,
    })
      // Always try to fetch full item to ensure variants are complete
      ; (async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/admin/items/${product._id}`, {
            headers: getAuthHeaders(),
          })
          const data = await res.json()
          const full = data?.item || product
          if (Array.isArray(full.variants) && full.variants.length > 0) {
            setEditVariants(full.variants.map((v: any) => ({ label: v.label || "", price: String(v.price ?? ""), quantity: String(v.quantity ?? "") })))
          } else {
            setEditVariants(full.price ? [{ label: full.unit || "", price: String(full.price ?? ""), quantity: String(full.quantity ?? "") }] : [])
          }
        } catch (_) {
          if (Array.isArray(product.variants) && product.variants.length > 0) {
            setEditVariants(product.variants.map((v: any) => ({ label: v.label || "", price: String(v.price ?? ""), quantity: String(v.quantity ?? "") })))
          } else {
            setEditVariants(product.price ? [{ label: product.unit || "", price: String(product.price ?? ""), quantity: String(product.quantity ?? "") }] : [])
          }
        }
      })()

    setEditImageMode("url")
    setEditSelectedImages([])
  }

  const cancelEdit = () => {
    setEditingProductId(null)
    setEditForm({
      name: "",
      productDetails: "",
      category: "Fruits",
      imageUrls: "",
      discountPercent: "",
      taxPercent: "",
      isSpecialItem: false,
    })
    setEditImageMode("url")
    setEditSelectedImages([])
    setEditVariants([])
  }

  const cancelOrder = async () => {
    if (!selectedOrderForCancel || !cancelRemark.trim()) {
      setError("Please provide a cancellation reason")
      return
    }

    try {
      setIsCancelling(true)
      const response = await fetch(`${API_BASE_URL}/admin/orders/${selectedOrderForCancel._id}/cancel`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: cancelRemark,
          remarks: cancelRemark,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Update local orders state
        setOrders(orders.map(o => o._id === selectedOrderForCancel._id ? { ...o, orderStatus: "cancelled" } : o))
        setShowCancelModal(false)
        setCancelRemark("")
        setSelectedOrderForCancel(null)
        setError("")
        alert(`Order ${selectedOrderForCancel.orderId} cancelled successfully`)
      } else {
        setError(data.message || "Failed to cancel order")
      }
    } catch (err: any) {
      setError(err.message || "Failed to cancel order")
      console.error("Cancel order error:", err)
    } finally {
      setIsCancelling(false)
    }
  }

  const saveEdit = async () => {
    try {
      const priceNum = Number.parseFloat((editForm as any).price)
      const quantityNum = Number.parseInt((editForm as any).quantity)
      const hasEditVariants = editVariants && editVariants.length > 0

      if (!editForm.name.trim() || !editForm.productDetails.trim()) {
        setError("Name and product details are required")
        return
      }

      if (hasEditVariants) {
        for (const v of editVariants) {
          if (!v.label || v.label.trim() === "") {
            setError("Each variant requires a label")
            return
          }
          const vp = Number.parseFloat(v.price)
          const vq = Number.parseInt(v.quantity)
          if (isNaN(vp) || vp <= 0) {
            setError("Each variant must have a valid price > 0")
            return
          }
          if (isNaN(vq) || vq < 0) {
            setError("Each variant must have a valid quantity (>= 0)")
            return
          }
        }
      } else {
        if (isNaN(priceNum) || priceNum <= 0 || isNaN(quantityNum) || quantityNum <= 0) {
          setError("All required fields must be valid: name, product details, price > 0, quantity > 0")
          return
        }
      }

      let response: Response
      if (editSelectedImages.length > 0) {
        if (editSelectedImages.length > 4) {
          setError("Maximum 4 images allowed.")
          return
        }
        for (const img of editSelectedImages) {
          if (img.size > MAX_IMAGE_SIZE) {
            setError(`Image too large. Max ${Math.round(MAX_IMAGE_SIZE / (1024 * 1024))}MB allowed.`)
            return
          }
        }

        const form = new FormData()
        editSelectedImages.forEach((img) => form.append("images", img))

        form.append("name", editForm.name)
        form.append("productDetails", editForm.productDetails)
        if (!hasEditVariants) form.append("price", String(priceNum))
        form.append("category", editForm.category)
        if (!hasEditVariants) form.append("quantity", String(quantityNum))
        form.append("unit", String((editForm as any).unit || ""))
        if (hasEditVariants) {
          form.append("variants", JSON.stringify(editVariants.map((v) => ({ label: v.label, price: Number.parseFloat(v.price), quantity: Number.parseInt(v.quantity) }))))
        }
        form.append("isAvailable", "true")
        form.append("discount", String(editForm.discountPercent ? Number.parseFloat(editForm.discountPercent) : 0))
        form.append("tax", String(editForm.taxPercent ? Number.parseFloat(editForm.taxPercent) : 0))
        form.append("isSpecialItem", String(editForm.isSpecialItem))

        response = await fetch(`${API_BASE_URL}/admin/items/${editingProductId}`, {
          method: "PUT",
          headers: {
            ...getAuthHeaders(),
          } as any,
          body: form,
        })
      } else {
        const urls = editForm.imageUrls
          .split(",")
          .map((u) => u.trim())
          .filter((u) => u.length > 0)
          .slice(0, 4)

        const productData: any = {
          name: editForm.name,
          productDetails: editForm.productDetails,
          price: priceNum,
          category: editForm.category,
          quantity: quantityNum,
          unit: (editForm as any).unit,
          imageUrls: urls,
          isAvailable: true,
          discount: editForm.discountPercent ? Number.parseFloat(editForm.discountPercent) : 0,
          tax: editForm.taxPercent ? Number.parseFloat(editForm.taxPercent) : 0,
          isSpecialItem: editForm.isSpecialItem,
        }
        if (hasEditVariants) {
          productData.variants = editVariants.map((v) => ({ label: v.label, price: Number.parseFloat(v.price), quantity: Number.parseInt(v.quantity) }))
        }

        response = await fetch(`${API_BASE_URL}/admin/items/${editingProductId}`, {
          method: "PUT",
          headers: {
            ...getAuthHeaders({ json: true }),
          },
          body: JSON.stringify(productData),
        })
      }

      let data: any
      const rawText = await response.text()
      try {
        data = rawText ? JSON.parse(rawText) : {}
      } catch (e) {
        data = { success: false, message: rawText }
      }

      if (data.success) {
        cancelEdit()
        const [updatedProducts, updatedStats] = await Promise.all([loadProducts(), loadStats()])
        setProducts(updatedProducts)
        if (updatedStats) setStats(updatedStats)
      } else {
        setError(data.message || "Failed to update product")
      }
    } catch (error) {
      setError("Failed to update product. Please try again.")
    }
  }

  const handleApproveCancellation = async (requestId: string, remarks: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/cancellation-requests/${requestId}/approve`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders({ json: true }),
        },
        body: JSON.stringify({ adminRemarks: remarks }),
      })

      const data = await response.json()
      if (data.success) {
        alert("Cancellation request approved successfully")
        const updatedRequests = cancellationRequests.map((req) =>
          req._id === requestId ? { ...req, status: "approved" as const } : req
        )
        setCancellationRequests(updatedRequests)
      } else {
        setError(data.message || "Failed to approve cancellation request")
      }
    } catch (error) {
      setError("Failed to approve cancellation request. Please try again.")
    }
  }

  const handleRejectCancellation = async (requestId: string, remarks: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/cancellation-requests/${requestId}/reject`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders({ json: true }),
        },
        body: JSON.stringify({ adminRemarks: remarks, adminResponse: "Your cancellation request has been rejected" }),
      })

      const data = await response.json()
      if (data.success) {
        alert("Cancellation request rejected successfully")
        const updatedRequests = cancellationRequests.map((req) =>
          req._id === requestId ? { ...req, status: "rejected" as const } : req
        )
        setCancellationRequests(updatedRequests)
      } else {
        setError(data.message || "Failed to reject cancellation request")
      }
    } catch (error) {
      setError("Failed to reject cancellation request. Please try again.")
    }
  }

  const handleCancelOrder = async () => {
    if (!selectedOrderForCancel) return
    if (!cancelRemark.trim()) {
      setError("Please provide a cancellation remark")
      return
    }

    setIsCancelling(true)
    try {
      // Cancel the order - this handles both the order cancellation and refund processing
      const response = await fetch(`${API_BASE_URL}/admin/orders/${selectedOrderForCancel._id}/cancel`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders({ json: true }),
        },
        body: JSON.stringify({
          reason: cancelRemark,
          remarks: cancelRemark
        }),
      })

      let data
      try {
        data = await response.json()
      } catch (e) {
        data = { success: false, message: `HTTP ${response.status}: ${response.statusText}` }
      }

      if (data.success) {
        alert("Order cancelled successfully. Refund has been initiated.")
        setShowCancelModal(false)
        setCancelRemark("")
        setSelectedOrderForCancel(null)

        // Reload orders and cancellation requests
        const [updatedOrders, updatedCancellations] = await Promise.all([
          loadOrders(),
          loadCancellationRequests()
        ])
        setOrders(updatedOrders)
        setCancellationRequests(updatedCancellations)
      } else {
        setError(data.message || "Failed to cancel order")
      }
    } catch (error) {
      console.error("Cancel order error:", error)
      setError(`Failed to cancel order: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsCancelling(false)
    }
  }

  const markOrderAsConfirmed = async (orderId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/confirm`, {
        method: "PATCH",
        headers: getAuthHeaders({ json: true }),
      })

      const data = await response.json()
      if (data.success) {
        const updatedOrders = await loadOrders()
        setOrders(updatedOrders)
      } else {
        setError(data.message || "Failed to confirm order")
      }
    } catch (error) {
      setError("Failed to confirm order. Please try again.")
    }
  }

  const markOrderAsPaid = async (orderId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/mark-paid`, {
        method: "PATCH",
        headers: getAuthHeaders({ json: true }),
      })

      const data = await response.json()
      if (data.success) {
        const updatedOrders = await loadOrders()
        setOrders(updatedOrders)
      } else {
        setError(data.message || "Failed to mark order as paid")
      }
    } catch (error) {
      setError("Failed to mark order as paid. Please try again.")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user_data")
    router.push("/login")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-400"></div>
          <div className="text-gray-600 text-sm sm:text-base font-medium">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div>
                <Image src={logo} alt="cart" width={80} height={80} className="h-16 w-16 sm:h-20 sm:w-20 object-contain" priority />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">Admin</h1>
                <p className="text-gray-600 text-sm sm:text-base truncate">Kanwarji Management Dashboard</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDashboardData}
                className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent w-full sm:w-auto"
              >
                <Refresh className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div className="bg-red-50 px-2 sm:px-3 py-2 rounded-lg min-w-0 flex-1 sm:flex-none">
                  <span className="text-red-400 font-medium text-sm sm:text-base truncate">Welcome, {user?.name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="border-red-300 text-red-700 hover:bg-red-50 bg-transparent whitespace-nowrap"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 sm:mx-6 mt-4">
          <Alert className="bg-red-50 border-red-200">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="p-4 sm:p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="bg-white border border-gray-200 shadow-sm p-1 w-max min-w-full sm:w-auto sm:min-w-0">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-red-400 data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Overview</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="data-[state=active]:bg-red-400 data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap"
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Users</span>
                <span className="sm:hidden">Users</span>
              </TabsTrigger>
              <TabsTrigger
                value="products"
                className="data-[state=active]:bg-red-400 data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap"
              >
                <Package className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Products</span>
                <span className="sm:hidden">Items</span>
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="data-[state=active]:bg-red-400 data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Orders</span>
                <span className="sm:hidden">Orders</span>
              </TabsTrigger>
              <TabsTrigger
                value="cancellations"
                className="data-[state=active]:bg-red-400 data-[state=active]:text-white data-[state=active]:shadow-sm whitespace-nowrap"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Cancellations</span>
                <span className="sm:hidden">Cancel</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base sm:text-lg font-medium text-gray-600">Total Users</CardTitle>
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalUsers}</div>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-3 w-3 text-red-400 mr-1" />
                    <span className="text-sm sm:text-base text-red-400 font-medium">Active users</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base sm:text-lg font-medium text-gray-600">Total Products</CardTitle>
                  <div className="bg-red-100 p-2 rounded-lg">
                    <Package className="h-4 w-4 text-red-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalProducts}</div>
                  <div className="flex items-center mt-2">
                    <Activity className="h-3 w-3 text-red-400 mr-1" />
                    <span className="text-sm sm:text-base text-red-400 font-medium">{stats.availableProducts} available</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base sm:text-lg font-medium text-gray-600">Available Products</CardTitle>
                  <div className="bg-emerald-100 p-2 rounded-lg">
                    <Eye className="h-4 w-4 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats.availableProducts}</div>
                  <div className="flex items-center mt-2">
                    <CheckCircle className="h-3 w-3 text-emerald-600 mr-1" />
                    <span className="text-sm sm:text-base text-emerald-600 font-medium">Ready to sell</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base sm:text-lg font-medium text-gray-600">Total Orders</CardTitle>
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <ShoppingCart className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalOrders}</div>
                  <div className="flex items-center mt-2">
                    <div className="text-sm sm:text-base text-orange-600">₹ </div>
                    <span className="text-sm sm:text-base text-orange-600 font-medium">-All time</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-gray-900 text-lg sm:text-xl flex items-center">
                      <Users className="h-5 w-5 mr-2 text-red-400" /> User Management
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-sm sm:text-base">Manage user accounts and permissions</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <label htmlFor="user-search" className="sr-only">
                      Search users
                    </label>
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="user-search"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      placeholder="Search by name or phone"
                      className="pl-8 border-gray-300 focus:border-red-400 focus:ring-red-400"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {(() => {
                    const filteredUsers = users.filter((user) =>
                      user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                      user.phone.toLowerCase().includes(userSearchTerm.toLowerCase())
                    )

                    return filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <div
                          key={user._id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors space-y-3 sm:space-y-0"
                        >
                          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                            <div className="bg-red-100 p-2 rounded-full flex-shrink-0">
                              <Users className="h-4 w-4 text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{user.name}</div>
                              <div className="text-xs sm:text-sm text-gray-600 mt-0.5">{user.email}</div>
                              <div className="text-xs sm:text-sm text-gray-500">{user.phone}</div>
                              <Badge
                                variant={user.userType === "admin" ? "default" : "secondary"}
                                className={`mt-2 sm:mt-1 inline-flex ${user.userType === "admin" ? "bg-red-400 hover:bg-red-400" : "bg-gray-100 text-gray-700"
                                  }`}
                              >
                                {user.userType}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-3 w-full sm:w-auto">
                            <span className={`text-xs sm:text-sm font-medium flex-shrink-0 ${user.isActive ? "text-red-400" : "text-gray-500"}`}>
                              {user.isActive ? "Active" : "Inactive"}
                            </span>
                            <Switch
                              checked={user.isActive}
                              onCheckedChange={(checked) => toggleUserStatus(user._id, checked)}
                              className="data-[state=checked]:bg-red-400"
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm sm:text-base">
                        No users found matching "{userSearchTerm}"
                      </div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-gray-900 text-lg sm:text-xl flex items-center">
                      <Package className="h-5 w-5 mr-2 text-red-400" /> Product Management
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-sm sm:text-base">Manage fresh products and inventory</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <label htmlFor="product-search" className="sr-only">
                        Search products
                      </label>
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="product-search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search"
                        className="pl-8 border-gray-300 focus:border-red-400 focus:ring-red-400"
                      />
                    </div>
                    <Button
                      onClick={() => setIsAddingProduct(!isAddingProduct)}
                      className="bg-red-400 hover:bg-red-400 text-white shadow-sm"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Product
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {isAddingProduct && (
                  <div className="p-6 bg-red-50 rounded-lg border border-red-200 space-y-6">
                    <div className="flex items-center space-x-2">
                      <div className="bg-red-400 p-2 rounded-lg">
                        <Plus className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Add New Product</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-gray-700 text-sm sm:text-base font-medium">
                          Product Name *
                        </Label>
                        <Input
                          id="name"
                          value={productForm.name}
                          onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                          className="border-gray-300 focus:border-red-400 focus:ring-red-400"
                          placeholder="Enter product name"
                        />
                      </div>


                      <div className="space-y-2">
                        <Label htmlFor="category" className="text-gray-700 text-sm sm:text-base font-medium">
                          Category
                        </Label>
                        <Select
                          value={productForm.category}
                          onValueChange={(value) => {
                            setProductForm({ ...productForm, category: value })
                            setSelectedCategory(value)
                          }}
                        >
                          <SelectTrigger className="border-gray-300 focus:border-red-400 focus:ring-red-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-gray-200">
                            <SelectItem value="Savory">Savory</SelectItem>
                            <SelectItem value="Namkeen">Namkeen</SelectItem>
                            <SelectItem value="Sweets">Sweets</SelectItem>
                            <SelectItem value="Travel Pack Combo">Travel Pack Combo</SelectItem>
                            <SelectItem value="Value Pack Offers">Value Pack Offers</SelectItem>
                            <SelectItem value="Gift Packs">Gift Packs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* price/quantity/unit removed - using variants instead */}

                      <div className="space-y-2">
                        <Label htmlFor="discount" className="text-gray-700 text-sm sm:text-base font-medium">
                          Discount (%)
                        </Label>
                        <Input
                          id="discount"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={productForm.discountPercent}
                          onChange={(e) => setProductForm({ ...productForm, discountPercent: e.target.value })}
                          className="border-gray-300 focus:border-red-400 focus:ring-red-400"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tax" className="text-gray-700 text-sm sm:text-base font-medium">
                          Tax (%)
                        </Label>
                        <Input
                          id="tax"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={productForm.taxPercent}
                          onChange={(e) => setProductForm({ ...productForm, taxPercent: e.target.value })}
                          className="border-gray-300 focus:border-red-400 focus:ring-red-400"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="isSpecialItem"
                            checked={productForm.isSpecialItem}
                            onCheckedChange={(checked) => setProductForm({ ...productForm, isSpecialItem: checked })}
                            className="data-[state=checked]:bg-red-400"
                          />
                          <Label htmlFor="isSpecialItem" className="text-gray-700 text-sm sm:text-base font-medium cursor-pointer">
                            Mark as Best Selling Product
                          </Label>
                        </div>
                        <p className="text-xs text-gray-500">
                          Featured products will appear in the "Best Selling" section on the home page
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-gray-700 text-sm sm:text-base font-medium">Product Media</Label>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={imageSelectionMode === "url" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setImageSelectionMode("url")}
                          className={
                            imageSelectionMode === "url"
                              ? "bg-red-400 hover:bg-red-400"
                              : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          }
                        >
                          Custom
                        </Button>
                        <Button
                          type="button"
                          variant={imageSelectionMode === "upload" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setImageSelectionMode("upload")}
                          className={
                            imageSelectionMode === "upload"
                              ? "bg-red-400 hover:bg-red-400"
                              : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          }
                        >
                          Upload
                        </Button>
                      </div>

                      {imageSelectionMode === "url" && (
                        <div className="space-y-2">
                          <div className="flex space-x-2">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="bg-red-400 hover:bg-red-400"
                            >
                              Image URL
                            </Button>
                          </div>
                          <Input
                            placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                            value={productForm.imageUrl}
                            onChange={(e) => handleCustomUrlChange(e.target.value)}
                            className="border-gray-300 focus:border-red-400 focus:ring-red-400"
                          />
                          <div className="text-xs text-gray-500">
                            Tip: Add multiple image URLs separated by commas.
                          </div>
                        </div>
                      )}

                      {imageSelectionMode === "upload" && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-4">
                            <div className="flex-1">
                              <Label className="text-gray-700">Images (max 4)</Label>
                              <Input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleImagesUpload}
                                className="mt-1 border-gray-300 focus:border-red-400 focus:ring-red-400 file:bg-red-400 file:text-white file:border-0 file:rounded file:px-4 file:py-2"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {imageSelectionMode === "upload" && selectedImages.length > 0 && (
                        <div className="p-4 bg-white rounded-lg border border-gray-200">
                          <div className="text-gray-700 text-base sm:text-lg font-medium mb-2">Image Previews:</div>
                          <ImageSlider urls={selectedImages.slice(0, 4).map((img) => URL.createObjectURL(img))} />
                        </div>
                      )}

                      {productForm.imageUrl && imageSelectionMode === "url" && (
                        <div className="p-4 bg-white rounded-lg border border-gray-200">
                          <div className="text-gray-700 text-base sm:text-lg font-medium mb-2">Preview:</div>
                          {(() => {
                            const urls = productForm.imageUrl
                              .split(",")
                              .map((u) => u.trim())
                              .filter(Boolean)
                              .slice(0, 4)
                            return <ImageSlider urls={urls} />
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-700 text-sm sm:text-base font-medium">Variants </Label>
                        <p className="text-xs text-gray-500">Add one or more size/variant rows (label, price, quantity). If provided, variants will be used instead of top-level price/quantity.</p>
                        <div className="space-y-2 mt-2">
                          {productVariants.map((v, idx) => (
                            <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                              <div>
                                <Input
                                  placeholder="Label (e.g. 500g, 1kg)"
                                  value={v.label}
                                  onChange={(e) => {
                                    const next = [...productVariants]
                                    next[idx] = { ...next[idx], label: e.target.value }
                                    setProductVariants(next)
                                  }}
                                />
                              </div>
                              <div>
                                <Input
                                  placeholder="Price"
                                  type="number"
                                  step="0.01"
                                  value={v.price}
                                  onChange={(e) => {
                                    const next = [...productVariants]
                                    next[idx] = { ...next[idx], price: e.target.value }
                                    setProductVariants(next)
                                  }}
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                <Input
                                  placeholder="Qty available"
                                  type="number"
                                  value={v.quantity}
                                  onChange={(e) => {
                                    const next = [...productVariants]
                                    next[idx] = { ...next[idx], quantity: e.target.value }
                                    setProductVariants(next)
                                  }}
                                />
                                <Button size="sm" variant="outline" onClick={() => setProductVariants(productVariants.filter((_, i) => i !== idx))}>
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div>
                            <Button size="sm" onClick={() => setProductVariants([...productVariants, { label: "", price: "", quantity: "" }])} className="mt-2">
                              Add Variant
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="productDetails" className="text-gray-700 text-sm sm:text-base font-medium">
                          Product Details
                        </Label>
                        <Textarea
                          id="productDetails"
                          value={productForm.productDetails}
                          onChange={(e) => setProductForm({ ...productForm, productDetails: e.target.value })}
                          className="border-gray-300 focus:border-red-400 focus:ring-red-400"
                          placeholder="Enter product details..."
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <Button onClick={addProduct} className="bg-red-400 hover:bg-red-400 text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Product
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsAddingProduct(false)
                          setSelectedImage(null)
                          setSelectedPredefinedItem(null)
                          setImageSelectionMode("url")
                          setProductForm({
                            name: "",
                            productDetails: "",
                            category: "Fruits",
                            imageUrl: "",
                            discountPercent: "",
                            taxPercent: "",
                            isSpecialItem: false,
                          })
                        }}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {(() => {
                    const filteredProducts = products.filter((product) =>
                      product.name.toLowerCase().includes(searchTerm.toLowerCase()),
                    )

                    return filteredProducts.length > 0 ? (
                      filteredProducts.map((product) =>
                        editingProductId === product._id ? (
                          <div key={product._id} className="p-6 bg-red-50 rounded-lg border border-red-200 space-y-6">
                            <div className="flex items-center space-x-2">
                              <div className="bg-red-400 p-2 rounded-lg">
                                <Edit className="h-4 w-4 text-white" />
                              </div>
                              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Edit Product</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <Label htmlFor="edit-name" className="text-gray-700 text-sm sm:text-base font-medium">
                                  Product Name *
                                </Label>
                                <Input
                                  id="edit-name"
                                  value={editForm.name}
                                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                  className="border-gray-300 focus:border-red-400 focus:ring-red-400"
                                  placeholder="Enter product name"
                                />
                              </div>

                              {/* price removed for edit - use variants instead */}

                              <div className="space-y-2">
                                <Label htmlFor="edit-category" className="text-gray-700 text-sm sm:text-base font-medium">
                                  Category
                                </Label>
                                <Select
                                  value={editForm.category}
                                  onValueChange={(value) => setEditForm({ ...editForm, category: value })}
                                >
                                  <SelectTrigger className="border-gray-300 focus:border-red-400 focus:ring-red-400">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border-gray-200">
                                    <SelectItem value="Savory">Savory</SelectItem>
                                    <SelectItem value="Namkeen">Namkeen</SelectItem>
                                    <SelectItem value="Sweets">Sweets</SelectItem>
                                    <SelectItem value="Travel Pack Combo">Travel Pack Combo</SelectItem>
                                    <SelectItem value="Value Pack Offers">Value Pack Offers</SelectItem>
                                    <SelectItem value="Gift Packs">Gift Packs</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* quantity/unit removed for edit - use variants instead */}
                            </div>

                            <div className="space-y-4">
                              <div>
                                <Label className="text-gray-700 text-sm sm:text-base font-medium">Variants (optional)</Label>
                                <p className="text-xs text-gray-500">Edit variants for this product. If provided, variants will be used instead of top-level price/quantity.</p>
                                <div className="space-y-2 mt-2">
                                  {editVariants.map((v, idx) => (
                                    <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                                      <div>
                                        <Input
                                          placeholder="Label (e.g. 500g, 1kg)"
                                          value={v.label}
                                          onChange={(e) => {
                                            const next = [...editVariants]
                                            next[idx] = { ...next[idx], label: e.target.value }
                                            setEditVariants(next)
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Input
                                          placeholder="Price"
                                          type="number"
                                          step="0.01"
                                          value={v.price}
                                          onChange={(e) => {
                                            const next = [...editVariants]
                                            next[idx] = { ...next[idx], price: e.target.value }
                                            setEditVariants(next)
                                          }}
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Input
                                          placeholder="Qty Available"
                                          type="number"
                                          value={v.quantity}
                                          onChange={(e) => {
                                            const next = [...editVariants]
                                            next[idx] = { ...next[idx], quantity: e.target.value }
                                            setEditVariants(next)
                                          }}
                                        />
                                        <Button size="sm" variant="outline" onClick={() => setEditVariants(editVariants.filter((_, i) => i !== idx))}>
                                          Remove
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  <div>
                                    <Button size="sm" onClick={() => setEditVariants([...editVariants, { label: "", price: "", quantity: "" }])} className="mt-2">
                                      Add Variant
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="edit-details" className="text-gray-700 text-sm sm:text-base font-medium">
                                  Product Details
                                </Label>
                                <Textarea
                                  id="edit-details"
                                  value={editForm.productDetails}
                                  onChange={(e) => setEditForm({ ...editForm, productDetails: e.target.value })}
                                  className="border-gray-300 focus:border-red-400 focus:ring-red-400"
                                  placeholder="Enter product details..."
                                  rows={3}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <Label htmlFor="edit-discount" className="text-gray-700 text-sm sm:text-base font-medium">
                                  Discount (%)
                                </Label>
                                <Input
                                  id="edit-discount"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={editForm.discountPercent}
                                  onChange={(e) => setEditForm({ ...editForm, discountPercent: e.target.value })}
                                  className="border-gray-300 focus:border-red-400 focus:ring-red-400"
                                  placeholder="0.00"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="edit-tax" className="text-gray-700 text-sm sm:text-base font-medium">
                                  Tax (%)
                                </Label>
                                <Input
                                  id="edit-tax"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={editForm.taxPercent}
                                  onChange={(e) => setEditForm({ ...editForm, taxPercent: e.target.value })}
                                  className="border-gray-300 focus:border-red-400 focus:ring-red-400"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="edit-specialItem"
                                  checked={editForm.isSpecialItem}
                                  onCheckedChange={(checked) => setEditForm({ ...editForm, isSpecialItem: checked })}
                                  className="data-[state=checked]:bg-red-400"
                                />
                                <Label htmlFor="edit-specialItem" className="text-gray-700 text-sm sm:text-base font-medium cursor-pointer">
                                  Mark as Best Selling Product
                                </Label>
                              </div>
                              <p className="text-xs text-gray-500">
                                Featured products will appear in the "Best Selling" section on the home page
                              </p>
                            </div>

                            <div className="flex space-x-3 pt-4">
                              <Button onClick={saveEdit} className="bg-red-400 hover:bg-red-400 text-white">
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                              </Button>
                              <Button
                                variant="outline"
                                onClick={cancelEdit}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={product._id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors space-y-3 sm:space-y-0"
                          >
                            <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                              <div className="flex-shrink-0">
                                {product.images && product.images.length > 0 ? (
                                  <ImageSlider urls={product.images} />
                                ) : product.imageUrls && product.imageUrls.length > 0 ? (
                                  <ImageSlider urls={product.imageUrls} />
                                ) : product.imageUrl ? (
                                  <img
                                    src={product.imageUrl || "/placeholder.svg"}
                                    alt={product.name}
                                    className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded border border-gray-200"
                                    onError={(e) => {
                                      ; (e.currentTarget as HTMLImageElement).src = "/placeholder.svg?thumb=1"
                                    }}
                                  />
                                ) : (
                                  <div className="bg-red-100 p-1.5 sm:p-2 rounded-lg">
                                    <Package className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 text-base sm:text-lg truncate">
                                  {product.name}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">
                                  {product.productDetails}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-600 mt-1">
                                  <span className="font-semibold text-gray-900">₹ {product.price}</span>
                                  <span className="text-gray-500"> / {product.unit}</span>
                                </div>
                                {Array.isArray((product as any).variants) && (product as any).variants.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {(product as any).variants.map((v: any, i: number) => (
                                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] sm:text-[11px] bg-white border-gray-200 text-gray-700">
                                        <span className="font-medium mr-1">{String(v.label)}</span>
                                        <span>₹{Number(v.price).toFixed(0)}</span>
                                        {typeof v.quantity !== 'undefined' && (
                                          <span className="ml-1 text-gray-500">(qty {v.quantity})</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500">
                                  Seller: <span className="font-medium">{product.sellerName}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  <span className="font-semibold text-red-400">Discount:</span>{" "}
                                  {product.discount || product.discountPercent || 0}% |{" "}
                                  <span className="font-semibold text-blue-700">Tax:</span>{" "}
                                  {product.tax || product.taxPercent || 0}%
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-end">
                              <Badge
                                variant={product.isAvailable ? "default" : "secondary"}
                                className={
                                  product.isAvailable
                                    ? "bg-red-400 hover:bg-red-400 text-xs sm:text-sm"
                                    : "bg-gray-100 text-gray-700 text-xs sm:text-sm"
                                }
                              >
                                {product.isAvailable ? "Visible" : "Hidden"}
                              </Badge>
                              <Switch
                                checked={product.isAvailable}
                                onCheckedChange={(checked) => toggleProductStatus(product._id, checked)}
                                className="data-[state=checked]:bg-red-400"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEdit(product)}
                                className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs sm:text-sm"
                              >
                                <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteProduct(product._id)}
                                className="border-red-300 text-red-700 hover:bg-red-50 text-xs sm:text-sm"
                              >
                                <Trash className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                            </div>
                          </div>
                        )
                      )
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm sm:text-base">No products found matching "{searchTerm}"</div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-gray-900 text-lg sm:text-xl flex items-center">
                      <ShoppingCart className="h-5 w-5 mr-2 text-red-400" /> Order Management
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-sm sm:text-base">View and manage customer orders</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <label htmlFor="order-search" className="sr-only">
                      Search orders
                    </label>
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="order-search"
                      value={orderSearchTerm}
                      onChange={(e) => setOrderSearchTerm(e.target.value)}
                      placeholder="Search by name or phone"
                      className="pl-8 border-gray-300 focus:border-red-400 focus:ring-red-400"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="space-y-6">
                  {(() => {
                    const filteredOrders = orders
                      .filter((order) =>
                        order.address.name.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                        order.address.phone.toLowerCase().includes(orderSearchTerm.toLowerCase())
                      )
                      // Show only paid orders in order management
                      .filter((order) => order.paymentStatus === "paid" || !!order.paymentId)

                    return filteredOrders.length > 0 ? (
                      filteredOrders.map((order) => (
                        <div key={order._id} className="p-4 sm:p-6 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-3 sm:space-x-4">
                              <div className="bg-red-100 p-2 rounded-lg">
                                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 text-base sm:text-lg">
                                  Order #{order.orderId}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-600">
                                  {new Date(order.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto flex-wrap">
                              <Badge
                                variant="outline"
                                className={`border-gray-300 text-xs sm:text-sm ${order.orderStatus === "delivered"
                                  ? "text-red-700 bg-red-50 border-red-200"
                                  : order.orderStatus === "pending"
                                    ? "text-orange-700 bg-orange-50 border-orange-200"
                                    : order.orderStatus === "cancelled"
                                      ? "text-orange-700 bg-orange-50 border-orange-200"
                                      : order.orderStatus === "confirmed"
                                        ? "text-blue-700 bg-blue-50 border-blue-200"
                                        : "text-gray-700 bg-gray-50"
                                  }`}
                              >
                                {order.orderStatus === "delivered" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {order.orderStatus === "pending" && <Clock className="h-3 w-3 mr-1" />}
                                {order.orderStatus === "shipped" && <Truck className="h-3 w-3 mr-1" />}
                                <span className="capitalize">{order.orderStatus}</span>
                              </Badge>

                              <Badge
                                variant="outline"
                                className={`border-gray-300 text-xs sm:text-sm ${
                                  // If order is cancelled, show orange regardless of paid status
                                  order.orderStatus === "cancelled"
                                    ? "text-orange-700 bg-orange-50 border-orange-200"
                                    : (order.paymentStatus === "paid" || order.orderStatus === "confirmed" || !!order.paymentId)
                                      ? "text-green-700 bg-green-50 border-green-200"
                                      : order.paymentStatus === "pending"
                                        ? "text-orange-700 bg-orange-50 border-orange-200"
                                        : "text-red-700 bg-red-50 border-red-200"
                                  }`}
                              >
                                <span className="capitalize">{(order.paymentStatus === 'paid' || order.orderStatus === 'confirmed' || !!order.paymentId) ? 'paid' : order.paymentStatus}</span>
                              </Badge>



                              <Button
                                size="sm"
                                onClick={() => downloadInvoice(order)}
                                className="bg-red-400 hover:bg-red-400 text-white text-xs sm:text-sm"
                              >
                                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">ORDER DETAILS</span>
                              </Button>
                              {order.orderStatus !== "cancelled" && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOrderForCancel(order)
                                    setShowCancelModal(true)
                                  }}
                                  className="bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm"
                                >
                                  <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">CANCEL ORDER</span>
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm">
                            <div className="space-y-2">
                              <div className="text-gray-500 font-medium text-base sm:text-lg">Customer Information</div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <div className="font-medium text-gray-900 text-sm sm:text-base">{order.address.name}</div>
                                <div className="text-gray-600 text-xs sm:text-sm">{order.address.phone}</div>
                                <div className="text-gray-600 text-xs mt-1">
                                  {order.address.address}, {order.address.city}, {order.address.state} -{" "}
                                  {order.address.pincode}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-gray-500 font-medium text-base sm:text-lg">Order Summary</div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600 text-base sm:text-lg">Total Amount:</span>
                                  <span className="font-semibold text-gray-900 text-sm sm:text-base">
                                    ₹ {(() => {
                                      const convBase = Number((order as any).convenienceFee || 0);
                                      const convGst = Number((convBase * 0.18).toFixed(2));
                                      const convTotal = Number((convBase + convGst).toFixed(2));
                                      const base = Number(order.totalAmount || 0);
                                      return (base + convTotal).toFixed(2);
                                    })()}
                                  </span>
                                </div>
                                {Number((order as any).convenienceFee || 0) > 0 && (
                                  <div className="flex justify-between items-center mt-1 text-xs sm:text-sm text-gray-600">
                                    <span>Includes Instamojo Convenience Fee</span>
                                    {(() => {
                                      const convBase = Number((order as any).convenienceFee || 0);
                                      const convGst = Number((convBase * 0.18).toFixed(2));
                                      const convTotal = Number((convBase + convGst).toFixed(2));
                                      return <span>₹ {convTotal.toFixed(2)}</span>
                                    })()}
                                  </div>
                                )}
                                <div className="text-gray-600 text-xs sm:text-sm mt-1">
                                  Payment: <span className="font-medium">{order.paymentMethod.toUpperCase()}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {order.specialRequests && (
                            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-500 rounded-lg">
                              <div className="flex items-center space-x-2 mb-2">
                                <Bell className="h-4 w-4 text-yellow-800" />
                                <div className="text-yellow-800 text-base sm:text-lg font-medium">Special Requests:</div>
                              </div>
                              <div className="text-yellow-900 text-sm">{order.specialRequests}</div>
                            </div>
                          )}

                          <div className="mt-4">
                            <div className="text-gray-500 text-base sm:text-lg font-medium mb-3">Order Items</div>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <div className="divide-y divide-gray-100">
                                {order.items.map((item, index) => (
                                  <div key={index} className="flex justify-between items-center p-3">
                                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                      <div className="bg-red-100 p-1 rounded flex-shrink-0">
                                        <Package className="h-3 w-3 text-red-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-gray-900 font-medium text-base sm:text-lg truncate block">
                                          {item.name}
                                          {(((item as any).variantLabel || (item as any).unit)
                                            ? ` (${(item as any).variantLabel || (item as any).unit})`
                                            : ""
                                          )}
                                        </span>
                                        <span className="text-gray-500 text-xs sm:text-sm">
                                          × {item.quantity}
                                          {(((item as any).variantLabel || (item as any).unit)
                                            ? ` × ${(item as any).variantLabel || (item as any).unit}`
                                            : ""
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="font-medium text-gray-900 text-sm sm:text-base flex-shrink-0">
                                      ₹ {(item.price * item.quantity).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm sm:text-base">
                        No orders found matching "{orderSearchTerm}"
                      </div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cancellations" className="space-y-6">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-gray-900 text-lg sm:text-xl flex items-center">
                      <AlertCircle className="h-5 w-5 mr-2 text-orange-400" /> Cancellation Requests
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-sm sm:text-base">Review and manage order cancellation requests</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <label htmlFor="cancellation-search" className="sr-only">
                      Search cancellation requests
                    </label>
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="cancellation-search"
                      value={cancellationSearchTerm}
                      onChange={(e) => setCancellationSearchTerm(e.target.value)}
                      placeholder="Search by order ID or name"
                      className="pl-8 border-gray-300 focus:border-orange-400 focus:ring-orange-400"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="space-y-6">
                  {(() => {
                    const filteredRequests = cancellationRequests.filter((req) =>
                      req.orderIdStr.toLowerCase().includes(cancellationSearchTerm.toLowerCase()) ||
                      req.customerName.toLowerCase().includes(cancellationSearchTerm.toLowerCase()) ||
                      req.customerEmail.toLowerCase().includes(cancellationSearchTerm.toLowerCase()) ||
                      req.customerPhone.toLowerCase().includes(cancellationSearchTerm.toLowerCase())
                    )

                    return filteredRequests.length > 0 ? (
                      filteredRequests.map((request) => (
                        <div key={request._id} className="p-4 sm:p-6 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-3 sm:space-x-4">
                              <div className="bg-orange-100 p-2 rounded-lg">
                                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 text-base sm:text-lg">
                                  Cancellation Request #{request.orderIdStr}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-600">
                                  Requested on {new Date(request.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
                              <Badge
                                variant="outline"
                                className={`border-gray-300 text-xs sm:text-sm ${request.status === "approved"
                                  ? "text-green-700 bg-green-50 border-green-200"
                                  : request.status === "rejected"
                                    ? "text-red-700 bg-red-50 border-red-200"
                                    : "text-orange-700 bg-orange-50 border-orange-200"
                                  }`}
                              >
                                {request.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {request.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                                {request.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                                <span className="capitalize">{request.status}</span>
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm">
                            <div className="space-y-2">
                              <div className="text-gray-500 font-medium text-base sm:text-lg">Customer Details</div>
                              <div className="bg-white p-3 rounded border border-gray-200 space-y-2">
                                <div>
                                  <span className="text-gray-600">Name:</span>
                                  <span className="font-medium text-gray-900 ml-2">{request.customerName}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Email:</span>
                                  <span className="text-gray-900 ml-2">{request.customerEmail}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Phone:</span>
                                  <span className="font-medium text-gray-900 ml-2">{request.customerPhone}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Address:</span>
                                  <span className="text-gray-900 ml-2">
                                    {request.address.address}, {request.address.city}, {request.address.state} - {request.address.pincode}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-gray-500 font-medium text-base sm:text-lg">Payment & Order Info</div>
                              <div className="bg-white p-3 rounded border border-gray-200 space-y-2">
                                <div>
                                  <span className="text-gray-600">Cancellation Reason:</span>
                                  <div className="text-gray-900 mt-1 text-xs p-2 bg-yellow-50 rounded border border-yellow-100">
                                    {request.cancellationReason}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-600">Payment Method:</span>
                                  <span className="font-medium text-gray-900 ml-2">{request.paymentMethod.toUpperCase()}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Payment Status:</span>
                                  <span className={`font-medium ml-2 ${request.paymentStatus === "paid" ? "text-green-600" : "text-orange-600"}`}>
                                    {request.paymentStatus.toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Order Amount:</span>
                                  <span className="font-semibold text-gray-900 ml-2">₹ {request.totalAmount.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="text-gray-500 text-base sm:text-lg font-medium mb-3">Order Items</div>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <div className="divide-y divide-gray-100">
                                {request.items.map((item, index) => (
                                  <div key={index} className="flex justify-between items-center p-3">
                                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                      <div className="bg-orange-100 p-1 rounded flex-shrink-0">
                                        <Package className="h-3 w-3 text-orange-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-gray-900 font-medium text-base sm:text-lg truncate block">
                                          {item.name}
                                        </span>
                                        <span className="text-gray-500 text-xs sm:text-sm">
                                          × {item.quantity}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="font-medium text-gray-900 text-sm sm:text-base flex-shrink-0">
                                      ₹ {(item.price * item.quantity).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {request.status === "pending" && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="space-y-3">
                                <Label htmlFor={`remarks-${request._id}`} className="text-gray-700">Admin Remarks/Response:</Label>
                                <Textarea
                                  id={`remarks-${request._id}`}
                                  placeholder="Enter your remarks or reason for approval/rejection"
                                  className="border-gray-300 focus:border-orange-400 focus:ring-orange-400 text-sm"
                                  defaultValue={request.adminRemarks}
                                />
                                <div className="flex gap-3">
                                  <Button
                                    onClick={() => handleApproveCancellation(request._id, (document.getElementById(`remarks-${request._id}`) as HTMLTextAreaElement)?.value)}
                                    className="bg-green-500 hover:bg-green-600 text-white flex-1"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approve
                                  </Button>
                                  <Button
                                    onClick={() => handleRejectCancellation(request._id, (document.getElementById(`remarks-${request._id}`) as HTMLTextAreaElement)?.value)}
                                    className="bg-red-500 hover:bg-red-600 text-white flex-1"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {request.status !== "pending" && (
                            <div className={`mt-4 pt-4 border-t p-3 rounded ${request.status === "approved" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                              <div className="text-sm">
                                <span className={`font-medium ${request.status === "approved" ? "text-green-800" : "text-red-800"}`}>
                                  Status: {request.status.toUpperCase()}
                                </span>
                                {request.adminRemarks && (
                                  <p className={`mt-2 text-xs ${request.status === "approved" ? "text-green-700" : "text-red-700"}`}>
                                    <strong>Admin Notes:</strong> {request.adminRemarks}
                                  </p>
                                )}
                                {request.adminResponse && (
                                  <p className={`mt-2 text-xs ${request.status === "approved" ? "text-green-700" : "text-red-700"}`}>
                                    <strong>Response:</strong> {request.adminResponse}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm sm:text-base">
                        No cancellation requests found {cancellationSearchTerm && `matching "${cancellationSearchTerm}"`}
                      </div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Cancel Order Modal */}
        {showCancelModal && selectedOrderForCancel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-md bg-white shadow-xl border-0">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl font-bold text-gray-900">Cancel Order</CardTitle>
                <CardDescription className="text-gray-600">
                  Order #{selectedOrderForCancel.orderId}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cancel-remark" className="text-gray-700 font-medium">
                    Please provide a remark for cancelling this order
                  </Label>
                  <Textarea
                    id="cancel-remark"
                    placeholder="Enter cancellation remark..."
                    value={cancelRemark}
                    onChange={(e) => setCancelRemark(e.target.value)}
                    className="border-gray-300 focus:border-red-400 focus:ring-red-400 min-h-32 text-sm"
                  />
                </div>
              </CardContent>
              <div className="flex gap-3 px-6 pb-6">
                <Button
                  onClick={() => {
                    setShowCancelModal(false)
                    setCancelRemark("")
                    setSelectedOrderForCancel(null)
                  }}
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </Button>
                <Button
                  onClick={cancelOrder}
                  disabled={isCancelling || !cancelRemark.trim()}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  {isCancelling ? "Cancelling..." : "Confirm Cancel"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
