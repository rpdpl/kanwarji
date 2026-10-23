"use client"

import { DashboardProvider } from "@/features/dashboard/dashboard-context"
import { DashboardShell } from "@/features/dashboard/components/DashboardShell"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  )
}
