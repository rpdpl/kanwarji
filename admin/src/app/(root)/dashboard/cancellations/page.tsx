"use client"

import { CancellationsPanel } from "@/features/dashboard/cancellations/CancellationsPanel"
import { useDashboard } from "@/features/dashboard/dashboard-context"

export default function CancellationsPage() {
  const {
    cancellationRequests,
    cancellationSearchTerm,
    setCancellationSearchTerm,
    handleApproveCancellation,
    handleRejectCancellation,
  } = useDashboard()
  return (
    <CancellationsPanel
      cancellationRequests={cancellationRequests}
      cancellationSearchTerm={cancellationSearchTerm}
      setCancellationSearchTerm={setCancellationSearchTerm}
      handleApproveCancellation={handleApproveCancellation}
      handleRejectCancellation={handleRejectCancellation}
    />
  )
}
