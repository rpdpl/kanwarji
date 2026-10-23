"use client"

import { OverviewPanel } from "@/features/dashboard/overview/OverviewPanel"
import { useDashboard } from "@/features/dashboard/dashboard-context"

export default function OverviewPage() {
  const { stats } = useDashboard()
  return <OverviewPanel stats={stats} />
}
