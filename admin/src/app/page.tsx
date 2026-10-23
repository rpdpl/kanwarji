"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in and redirect accordingly
    const token = localStorage.getItem("auth_token")
    const userData = localStorage.getItem("user_data")

    if (token && userData) {
      const user = JSON.parse(userData)
      if (user.userType === "admin") {
        router.push("/pannel")
      } else {
        router.push("/login")
      }
    } else {
      router.push("/login")
    }
  }, [router])

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white">Redirecting...</div>
    </div>
  )
}
