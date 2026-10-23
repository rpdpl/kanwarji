"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import logo from "../../../../public/logo1.png"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, ShoppingCart } from "lucide-react"
import { apiJson } from "@/lib/api-client"

export default function LoginPage() {
  const [emailOrPhone, setEmailOrPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const data = await apiJson<{
        success?: boolean
        token?: string
        user?: { userType?: string }
        message?: string
      }>("/auth/login", {
        method: "POST",
        json: true,
        skipAuth: true,
        body: JSON.stringify({ emailOrPhone, password }),
      })

      if (data.success) {
        localStorage.setItem("auth_token", data.token!)
        localStorage.setItem("user_data", JSON.stringify(data.user))

        if (data.user?.userType === "admin") {
          router.push("/dashboard/overview")
        } else {
          setError("Admin access required")
        }
      } else {
        setError(data.message || "Login failed")
      }
    } catch (error) {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-red-400 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white border-white-700">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
      <div  >
  <Image 
    src={logo}
    alt="cart"
    width={80}
    height={80}
    className="h-20 w-20 object-contain"
    priority
  />
</div>

          </div>
          <CardTitle className="text-2xl font-bold text-slate-600">Admin Login</CardTitle>
          <CardDescription className="text-slate-600">Sign in to access the admin dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailOrPhone" className="text-white">
                Email or Phone
              </Label>
              <Input
                id="emailOrPhone"
                type="text"
                placeholder="Enter your email or phone"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                required
                className="bg-gray-200 border-slate-800 text-slate-600 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-gray-200 border-slate-800 text-slate-600 placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <Alert className="bg-red-900/50 border-red-800">
                <AlertDescription className="text-red-200">{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full bg-red-400 hover:bg-red-400" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
            <div className="text-center mt-2">
              <Link href="/forgot" className="text-slate-600 hover:text-slate-800 underline underline-offset-4">
                Forgot password?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
