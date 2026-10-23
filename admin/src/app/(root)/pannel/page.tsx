"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Soft redirect: legacy `/pannel` → `/dashboard`. */
export default function PannelRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/dashboard/overview")
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600 text-sm">Redirecting to dashboard…</div>
    </div>
  )
}
