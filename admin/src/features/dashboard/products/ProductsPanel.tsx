"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Package, Plus, Search, Edit, Save, Trash } from "lucide-react"
import { ImageSlider } from "@/features/dashboard/components/ImageSlider"
import type { EditFormState, Product, ProductFormState, VariantInput } from "@/features/dashboard/types"

type Props = {
  products: Product[]
  searchTerm: string
  setSearchTerm: (v: string) => void
  isAddingProduct: boolean
  setIsAddingProduct: (v: boolean) => void
  productForm: ProductFormState
  setProductForm: React.Dispatch<React.SetStateAction<ProductFormState>>
  productVariants: VariantInput[]
  setProductVariants: React.Dispatch<React.SetStateAction<VariantInput[]>>
  imageSelectionMode: "url" | "upload"
  setImageSelectionMode: (v: "url" | "upload") => void
  selectedImages: File[]
  setSelectedImage: (f: File | null) => void
  setSelectedPredefinedItem: (v: string | null) => void
  handleCustomUrlChange: (url: string) => void
  handleImagesUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  addProduct: () => void
  editingProductId: string | null
  editForm: EditFormState
  setEditForm: React.Dispatch<React.SetStateAction<EditFormState>>
  editVariants: VariantInput[]
  setEditVariants: React.Dispatch<React.SetStateAction<VariantInput[]>>
  startEdit: (product: Product) => void
  cancelEdit: () => void
  saveEdit: () => void
  toggleProductStatus: (productId: string, isAvailable: boolean) => void
  deleteProduct: (productId: string) => void
  setSelectedCategory: (v: string) => void
}

export function ProductsPanel(props: Props) {
  const {
    products, searchTerm, setSearchTerm, isAddingProduct, setIsAddingProduct,
    productForm, setProductForm, productVariants, setProductVariants,
    imageSelectionMode, setImageSelectionMode, selectedImages,
    setSelectedImage, setSelectedPredefinedItem, handleCustomUrlChange,
    handleImagesUpload, addProduct, editingProductId, editForm, setEditForm,
    editVariants, setEditVariants, startEdit, cancelEdit, saveEdit,
    toggleProductStatus, deleteProduct, setSelectedCategory,
  } = props

  return (
    <div className="space-y-6">
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
    </div>
  )
}
