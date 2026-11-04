"use client"

import { OrdersPanel } from "@/features/dashboard/orders/OrdersPanel"
import { useDashboard } from "@/features/dashboard/dashboard-context"

export default function OrdersPage() {
  const {
    orders,
    orderSearchTerm,
    setOrderSearchTerm,
    downloadInvoice,
    requestCancelOrder,
    retryShiprocket,
    syncPayment,
    retryingOrderId,
    syncingOrderId,
  } = useDashboard()
  return (
    <OrdersPanel
      orders={orders}
      orderSearchTerm={orderSearchTerm}
      setOrderSearchTerm={setOrderSearchTerm}
      downloadInvoice={downloadInvoice}
      onRequestCancel={requestCancelOrder}
      onRetryShiprocket={retryShiprocket}
      onSyncPayment={syncPayment}
      retryingOrderId={retryingOrderId}
      syncingOrderId={syncingOrderId}
    />
  )
}
