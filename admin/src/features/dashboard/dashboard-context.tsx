"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GroceryItems } from "@/app/lib/grocery-items"
import {
  approveCancellation,
  cancelOrder as cancelOrderApi,
  createProductForm,
  createProductJson,
  deleteProduct as deleteProductApi,
  fetchProduct,
  loadCancellationRequests,
  loadOrders,
  loadProducts,
  loadStats,
  loadUsers,
  mapVariants,
  rejectCancellation,
  retryShiprocketOrder as retryShiprocketOrderApi,
  toggleProductStatus as toggleProductStatusApi,
  toggleUserStatus as toggleUserStatusApi,
  updateProductForm,
  updateProductJson,
} from "@/lib/admin-api"
import { downloadInvoice as downloadInvoiceFn } from "@/features/dashboard/orders/downloadInvoice"
import {
  emptyEditForm,
  emptyProductForm,
  emptyStats,
  type CancellationRequest,
  type EditFormState,
  type Order,
  type Product,
  type ProductFormState,
  type Stats,
  type User,
  type VariantInput,
} from "@/features/dashboard/types"

const MAX_IMAGE_SIZE = 10 * 1024 * 1024

type DashboardContextValue = {
  user: any
  stats: Stats
  users: User[]
  products: Product[]
  orders: Order[]
  cancellationRequests: CancellationRequest[]
  isLoading: boolean
  error: string
  setError: (msg: string) => void
  searchTerm: string
  setSearchTerm: (v: string) => void
  userSearchTerm: string
  setUserSearchTerm: (v: string) => void
  orderSearchTerm: string
  setOrderSearchTerm: (v: string) => void
  cancellationSearchTerm: string
  setCancellationSearchTerm: (v: string) => void
  showCancelModal: boolean
  selectedOrderForCancel: Order | null
  cancelRemark: string
  setCancelRemark: (v: string) => void
  isCancelling: boolean
  isAddingProduct: boolean
  setIsAddingProduct: (v: boolean) => void
  selectedImages: File[]
  imageSelectionMode: "url" | "upload"
  setImageSelectionMode: (v: "url" | "upload") => void
  setSelectedCategory: (v: string) => void
  productForm: ProductFormState
  setProductForm: React.Dispatch<React.SetStateAction<ProductFormState>>
  productVariants: VariantInput[]
  setProductVariants: React.Dispatch<React.SetStateAction<VariantInput[]>>
  editingProductId: string | null
  editForm: EditFormState
  setEditForm: React.Dispatch<React.SetStateAction<EditFormState>>
  editVariants: VariantInput[]
  setEditVariants: React.Dispatch<React.SetStateAction<VariantInput[]>>
  loadDashboardData: () => Promise<void>
  toggleUserStatus: (userId: string, isActive: boolean) => Promise<void>
  toggleProductStatus: (productId: string, isAvailable: boolean) => Promise<void>
  deleteProduct: (productId: string) => Promise<void>
  handleCustomUrlChange: (url: string) => void
  handleImagesUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  setSelectedImage: (f: File | null) => void
  setSelectedPredefinedItem: (v: string | null) => void
  addProduct: () => Promise<void>
  startEdit: (product: Product) => void
  cancelEdit: () => void
  saveEdit: () => Promise<void>
  downloadInvoice: (order: Order) => Promise<void>
  handleApproveCancellation: (requestId: string, remarks: string) => Promise<void>
  handleRejectCancellation: (requestId: string, remarks: string) => Promise<void>
  requestCancelOrder: (order: Order) => void
  closeCancelModal: () => void
  cancelOrder: () => Promise<void>
  retryShiprocket: (order: Order) => Promise<void>
  retryingOrderId: string | null
  handleLogout: () => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider")
  return ctx
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<Stats>(emptyStats())
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
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null)
  const router = useRouter()

  const [isAddingProduct, setIsAddingProduct] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imageSelectionMode, setImageSelectionMode] = useState<"url" | "upload">("url")
  const [, setSelectedCategory] = useState("Fruits")
  const [selectedPredefinedItem, setSelectedPredefinedItem] = useState<string | null>(null)
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm())
  const [productVariants, setProductVariants] = useState<VariantInput[]>([])
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm())
  const [editVariants, setEditVariants] = useState<VariantInput[]>([])
  const [editSelectedImages, setEditSelectedImages] = useState<File[]>([])

  const loadDashboardData = useCallback(async () => {
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
    } catch {
      setError("Failed to load dashboard data")
    } finally {
      setIsLoading(false)
    }
  }, [])

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
  }, [router, loadDashboardData])

  const getPredefinedItemImageUrl = (itemName: string) => GroceryItems.getImageUrl(itemName)

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const data = await toggleUserStatusApi(userId, isActive)
      if (data.success) {
        setUsers(await loadUsers())
      }
    } catch (err) {
      console.error("Failed to toggle user status:", err)
    }
  }

  const toggleProductStatus = async (productId: string, isAvailable: boolean) => {
    try {
      const data = await toggleProductStatusApi(productId, isAvailable)
      if (data.success) {
        const [updatedProducts, updatedStats] = await Promise.all([loadProducts(), loadStats()])
        setProducts(updatedProducts)
        if (updatedStats) setStats(updatedStats)
      }
    } catch (err) {
      console.error("Failed to toggle product status:", err)
    }
  }

  const deleteProduct = async (productId: string) => {
    const confirmDelete = window.confirm("Delete this product? This action cannot be undone.")
    if (!confirmDelete) return
    try {
      const { ok, data } = await deleteProductApi(productId)
      if (ok) {
        const [updatedProducts, updatedStats] = await Promise.all([loadProducts(), loadStats()])
        setProducts(updatedProducts)
        if (updatedStats) setStats(updatedStats)
      } else {
        setError(data.message || "Failed to delete product")
      }
    } catch (err) {
      console.error("Failed to delete product:", err)
      setError("Failed to delete product")
    }
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

      let data: { success?: boolean; message?: string }
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
        form.append("variants", JSON.stringify(mapVariants(productVariants)))
        try {
          const compatPrice = productVariants.length > 0 ? Number.parseFloat(productVariants[0].price) : undefined
          const compatQuantity = productVariants.reduce((s, v) => s + (Number.parseInt(v.quantity) || 0), 0)
          if (!Number.isNaN(compatPrice as number)) form.append("price", String(compatPrice))
          if (compatQuantity > 0) form.append("quantity", String(compatQuantity))
          form.append("unit", productVariants.length > 0 ? productVariants[0].label || "unit" : "unit")
        } catch {
          /* ignore */
        }
        form.append("isAvailable", "true")
        form.append("discount", String(productForm.discountPercent ? Number.parseFloat(productForm.discountPercent) : 0))
        form.append("tax", String(productForm.taxPercent ? Number.parseFloat(productForm.taxPercent) : 0))
        form.append("isSpecialItem", String(productForm.isSpecialItem))
        data = await createProductForm(form)
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
          variants: mapVariants(productVariants),
        }
        try {
          const compatPrice = productVariants.length > 0 ? Number.parseFloat(productVariants[0].price) : undefined
          const compatQuantity = productVariants.reduce((s, v) => s + (Number.parseInt(v.quantity) || 0), 0)
          if (!Number.isNaN(compatPrice as number)) productData.price = compatPrice
          if (compatQuantity > 0) productData.quantity = compatQuantity
          productData.unit = productVariants.length > 0 ? productVariants[0].label || "unit" : "unit"
        } catch {
          /* ignore */
        }
        data = await createProductJson(productData)
      }

      if (data.success) {
        setProductForm(emptyProductForm())
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
    } catch {
      setError("Failed to add product. Please try again.")
    }
  }

  const startEdit = (product: Product) => {
    setEditingProductId(product._id)
    setEditForm({
      name: product.name,
      productDetails: product.productDetails || "",
      category: product.category,
      imageUrls: Array.isArray(product.imageUrls)
        ? product.imageUrls.join(", ")
        : (product.imageUrls as any) || "",
      discountPercent: product.discountPercent?.toString() || "",
      taxPercent: product.taxPercent?.toString() || "",
      isSpecialItem: product.isSpecialItem || false,
    })
    ;(async () => {
      try {
        const data = await fetchProduct(product._id)
        const full = data?.item || product
        if (Array.isArray(full.variants) && full.variants.length > 0) {
          setEditVariants(
            full.variants.map((v: any) => ({
              label: v.label || "",
              price: String(v.price ?? ""),
              quantity: String(v.quantity ?? ""),
            })),
          )
        } else {
          setEditVariants(
            full.price
              ? [{ label: full.unit || "", price: String(full.price ?? ""), quantity: String(full.quantity ?? "") }]
              : [],
          )
        }
      } catch {
        if (Array.isArray(product.variants) && product.variants.length > 0) {
          setEditVariants(
            product.variants.map((v: any) => ({
              label: v.label || "",
              price: String(v.price ?? ""),
              quantity: String(v.quantity ?? ""),
            })),
          )
        } else {
          setEditVariants(
            product.price
              ? [
                  {
                    label: product.unit || "",
                    price: String(product.price ?? ""),
                    quantity: String(product.quantity ?? ""),
                  },
                ]
              : [],
          )
        }
      }
    })()
    setEditSelectedImages([])
  }

  const cancelEdit = () => {
    setEditingProductId(null)
    setEditForm(emptyEditForm())
    setEditSelectedImages([])
    setEditVariants([])
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

      if (!editingProductId) return

      let data: { success?: boolean; message?: string }
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
        if (hasEditVariants) form.append("variants", JSON.stringify(mapVariants(editVariants)))
        form.append("isAvailable", "true")
        form.append("discount", String(editForm.discountPercent ? Number.parseFloat(editForm.discountPercent) : 0))
        form.append("tax", String(editForm.taxPercent ? Number.parseFloat(editForm.taxPercent) : 0))
        form.append("isSpecialItem", String(editForm.isSpecialItem))
        data = await updateProductForm(editingProductId, form)
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
        if (hasEditVariants) productData.variants = mapVariants(editVariants)
        data = await updateProductJson(editingProductId, productData)
      }

      if (data.success) {
        cancelEdit()
        const [updatedProducts, updatedStats] = await Promise.all([loadProducts(), loadStats()])
        setProducts(updatedProducts)
        if (updatedStats) setStats(updatedStats)
      } else {
        setError(data.message || "Failed to update product")
      }
    } catch {
      setError("Failed to update product. Please try again.")
    }
  }

  const downloadInvoice = async (order: Order) => {
    await downloadInvoiceFn(order, setError)
  }

  const handleApproveCancellation = async (requestId: string, remarks: string) => {
    try {
      const data = await approveCancellation(requestId, remarks)
      if (data.success) {
        alert("Cancellation request approved successfully")
        setCancellationRequests(
          cancellationRequests.map((req) =>
            req._id === requestId ? { ...req, status: "approved" as const } : req,
          ),
        )
      } else {
        setError(data.message || "Failed to approve cancellation request")
      }
    } catch {
      setError("Failed to approve cancellation request. Please try again.")
    }
  }

  const handleRejectCancellation = async (requestId: string, remarks: string) => {
    try {
      const data = await rejectCancellation(requestId, remarks)
      if (data.success) {
        alert("Cancellation request rejected successfully")
        setCancellationRequests(
          cancellationRequests.map((req) =>
            req._id === requestId ? { ...req, status: "rejected" as const } : req,
          ),
        )
      } else {
        setError(data.message || "Failed to reject cancellation request")
      }
    } catch {
      setError("Failed to reject cancellation request. Please try again.")
    }
  }

  const requestCancelOrder = (order: Order) => {
    setSelectedOrderForCancel(order)
    setShowCancelModal(true)
  }

  const retryShiprocket = async (order: Order) => {
    try {
      setRetryingOrderId(order.orderId)
      setError("")
      const data = await retryShiprocketOrderApi(order.orderId)
      if (data.success) {
        const refreshed = await loadOrders()
        setOrders(refreshed)
        alert(
          data.shiprocketOrderId
            ? `Shiprocket created: ${data.shiprocketOrderId}`
            : data.message || "Shiprocket retry succeeded",
        )
      } else {
        setError(data.message || data.error || "Shiprocket retry failed")
        const refreshed = await loadOrders()
        setOrders(refreshed)
      }
    } catch (err: any) {
      setError(err?.message || "Shiprocket retry failed")
    } finally {
      setRetryingOrderId(null)
    }
  }

  const closeCancelModal = () => {
    setShowCancelModal(false)
    setCancelRemark("")
    setSelectedOrderForCancel(null)
  }

  const cancelOrder = async () => {
    if (!selectedOrderForCancel || !cancelRemark.trim()) {
      setError("Please provide a cancellation reason")
      return
    }

    try {
      setIsCancelling(true)
      const data = await cancelOrderApi(selectedOrderForCancel._id, cancelRemark)
      if (data.success) {
        setOrders(
          orders.map((o) =>
            o._id === selectedOrderForCancel._id ? { ...o, orderStatus: "cancelled" } : o,
          ),
        )
        closeCancelModal()
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

  const handleLogout = () => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user_data")
    router.push("/login")
  }

  const value: DashboardContextValue = {
    user,
    stats,
    users,
    products,
    orders,
    cancellationRequests,
    isLoading,
    error,
    setError,
    searchTerm,
    setSearchTerm,
    userSearchTerm,
    setUserSearchTerm,
    orderSearchTerm,
    setOrderSearchTerm,
    cancellationSearchTerm,
    setCancellationSearchTerm,
    showCancelModal,
    selectedOrderForCancel,
    cancelRemark,
    setCancelRemark,
    isCancelling,
    isAddingProduct,
    setIsAddingProduct,
    selectedImages,
    imageSelectionMode,
    setImageSelectionMode,
    setSelectedCategory,
    productForm,
    setProductForm,
    productVariants,
    setProductVariants,
    editingProductId,
    editForm,
    setEditForm,
    editVariants,
    setEditVariants,
    loadDashboardData,
    toggleUserStatus,
    toggleProductStatus,
    deleteProduct,
    handleCustomUrlChange,
    handleImagesUpload,
    setSelectedImage,
    setSelectedPredefinedItem,
    addProduct,
    startEdit,
    cancelEdit,
    saveEdit,
    downloadInvoice,
    handleApproveCancellation,
    handleRejectCancellation,
    requestCancelOrder,
    closeCancelModal,
    cancelOrder,
    retryShiprocket,
    retryingOrderId,
    handleLogout,
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}
