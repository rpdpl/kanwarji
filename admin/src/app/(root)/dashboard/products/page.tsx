"use client"

import { ProductsPanel } from "@/features/dashboard/products/ProductsPanel"
import { useDashboard } from "@/features/dashboard/dashboard-context"

export default function ProductsPage() {
  const d = useDashboard()
  return (
    <ProductsPanel
      products={d.products}
      searchTerm={d.searchTerm}
      setSearchTerm={d.setSearchTerm}
      isAddingProduct={d.isAddingProduct}
      setIsAddingProduct={d.setIsAddingProduct}
      productForm={d.productForm}
      setProductForm={d.setProductForm}
      productVariants={d.productVariants}
      setProductVariants={d.setProductVariants}
      imageSelectionMode={d.imageSelectionMode}
      setImageSelectionMode={d.setImageSelectionMode}
      selectedImages={d.selectedImages}
      setSelectedImage={d.setSelectedImage}
      setSelectedPredefinedItem={d.setSelectedPredefinedItem}
      handleCustomUrlChange={d.handleCustomUrlChange}
      handleImagesUpload={d.handleImagesUpload}
      addProduct={d.addProduct}
      editingProductId={d.editingProductId}
      editForm={d.editForm}
      setEditForm={d.setEditForm}
      editVariants={d.editVariants}
      setEditVariants={d.setEditVariants}
      startEdit={d.startEdit}
      cancelEdit={d.cancelEdit}
      saveEdit={d.saveEdit}
      toggleProductStatus={d.toggleProductStatus}
      deleteProduct={d.deleteProduct}
      setSelectedCategory={d.setSelectedCategory}
    />
  )
}
