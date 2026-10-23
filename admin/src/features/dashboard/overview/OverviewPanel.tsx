"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Package, ShoppingCart, Eye, TrendingUp, Activity, CheckCircle } from "lucide-react"
import type { Stats } from "@/features/dashboard/types"

export function OverviewPanel({ stats }: { stats: Stats }) {
  return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base sm:text-lg font-medium text-gray-600">Total Users</CardTitle>
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalUsers}</div>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-3 w-3 text-red-400 mr-1" />
                    <span className="text-sm sm:text-base text-red-400 font-medium">Active users</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base sm:text-lg font-medium text-gray-600">Total Products</CardTitle>
                  <div className="bg-red-100 p-2 rounded-lg">
                    <Package className="h-4 w-4 text-red-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalProducts}</div>
                  <div className="flex items-center mt-2">
                    <Activity className="h-3 w-3 text-red-400 mr-1" />
                    <span className="text-sm sm:text-base text-red-400 font-medium">{stats.availableProducts} available</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base sm:text-lg font-medium text-gray-600">Available Products</CardTitle>
                  <div className="bg-emerald-100 p-2 rounded-lg">
                    <Eye className="h-4 w-4 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats.availableProducts}</div>
                  <div className="flex items-center mt-2">
                    <CheckCircle className="h-3 w-3 text-emerald-600 mr-1" />
                    <span className="text-sm sm:text-base text-emerald-600 font-medium">Ready to sell</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base sm:text-lg font-medium text-gray-600">Total Orders</CardTitle>
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <ShoppingCart className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalOrders}</div>
                  <div className="flex items-center mt-2">
                    <div className="text-sm sm:text-base text-orange-600">₹ </div>
                    <span className="text-sm sm:text-base text-orange-600 font-medium">-All time</span>
                  </div>
                </CardContent>
              </Card>
            </div>
  )
}
