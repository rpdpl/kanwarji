"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import logo from "../../../../public/logo1.png"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  BarChart3,
  Users,
  Package,
  ShoppingCart,
  AlertCircle,
  LogOut,
  RefreshCw as Refresh,
  XCircle,
} from "lucide-react"
import { useDashboard } from "@/features/dashboard/dashboard-context"
import { CancelOrderModal } from "@/features/dashboard/components/CancelOrderModal"

const NAV = [
  { href: "/dashboard/overview", label: "Overview", short: "Stats", icon: BarChart3 },
  { href: "/dashboard/users", label: "Users", short: "Users", icon: Users },
  { href: "/dashboard/products", label: "Products", short: "Products", icon: Package },
  { href: "/dashboard/orders", label: "Orders", short: "Orders", icon: ShoppingCart },
  { href: "/dashboard/cancellations", label: "Cancellations", short: "Cancel", icon: AlertCircle },
] as const

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, isLoading, error, loadDashboardData, handleLogout } = useDashboard()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-400"></div>
          <div className="text-gray-600 text-sm sm:text-base font-medium">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div>
                <Image
                  src={logo}
                  alt="cart"
                  width={80}
                  height={80}
                  className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
                  priority
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">Admin</h1>
                <p className="text-gray-600 text-sm sm:text-base truncate">Kanwarji Management Dashboard</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDashboardData}
                className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent w-full sm:w-auto"
              >
                <Refresh className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div className="bg-red-50 px-2 sm:px-3 py-2 rounded-lg min-w-0 flex-1 sm:flex-none">
                  <span className="text-red-400 font-medium text-sm sm:text-base truncate">
                    Welcome, {user?.name}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="border-red-300 text-red-700 hover:bg-red-50 bg-transparent whitespace-nowrap"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 sm:mx-6 mt-4">
          <Alert className="bg-red-50 border-red-200">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="p-4 sm:p-6 space-y-6">
        <div className="overflow-x-auto">
          <nav className="bg-white border border-gray-200 shadow-sm p-1 w-max min-w-full sm:w-auto sm:min-w-0 inline-flex rounded-md gap-1">
            {NAV.map(({ href, label, short, icon: Icon }) => {
              const active = pathname === href || pathname?.startsWith(href + "/")
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-red-400 text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{short}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {children}
      </div>

      <CancelOrderModal />
    </div>
  )
}
