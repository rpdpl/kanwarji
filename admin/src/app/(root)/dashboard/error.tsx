"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
      <p className="text-sm text-gray-600 text-center max-w-md">
        {error.message || "Failed to render this dashboard section."}
      </p>
      <Button onClick={reset} className="bg-red-400 hover:bg-red-400 text-white">
        Try again
      </Button>
    </div>
  )
}
