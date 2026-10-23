"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  ShoppingCart, Search, Download, XCircle, CheckCircle, Clock, Truck, Package, Bell,
} from "lucide-react"
import type { Order } from "@/features/dashboard/types"

type Props = {
  orders: Order[]
  orderSearchTerm: string
  setOrderSearchTerm: (v: string) => void
  downloadInvoice: (order: Order) => void
  onRequestCancel: (order: Order) => void
}

export function OrdersPanel({
  orders, orderSearchTerm, setOrderSearchTerm, downloadInvoice, onRequestCancel,
}: Props) {
  return (
    <div className="space-y-6">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-gray-900 text-lg sm:text-xl flex items-center">
                      <ShoppingCart className="h-5 w-5 mr-2 text-red-400" /> Order Management
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-sm sm:text-base">View and manage customer orders</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <label htmlFor="order-search" className="sr-only">
                      Search orders
                    </label>
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="order-search"
                      value={orderSearchTerm}
                      onChange={(e) => setOrderSearchTerm(e.target.value)}
                      placeholder="Search by name or phone"
                      className="pl-8 border-gray-300 focus:border-red-400 focus:ring-red-400"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="space-y-6">
                  {(() => {
                    const filteredOrders = orders
                      .filter((order) =>
                        order.address.name.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                        order.address.phone.toLowerCase().includes(orderSearchTerm.toLowerCase())
                      )
                      // Show only paid orders in order management
                      .filter((order) => order.paymentStatus === "paid" || !!order.paymentId)

                    return filteredOrders.length > 0 ? (
                      filteredOrders.map((order) => (
                        <div key={order._id} className="p-4 sm:p-6 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-3 sm:space-x-4">
                              <div className="bg-red-100 p-2 rounded-lg">
                                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 text-base sm:text-lg">
                                  Order #{order.orderId}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-600">
                                  {new Date(order.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto flex-wrap">
                              <Badge
                                variant="outline"
                                className={`border-gray-300 text-xs sm:text-sm ${order.orderStatus === "delivered"
                                  ? "text-red-700 bg-red-50 border-red-200"
                                  : order.orderStatus === "pending"
                                    ? "text-orange-700 bg-orange-50 border-orange-200"
                                    : order.orderStatus === "cancelled"
                                      ? "text-orange-700 bg-orange-50 border-orange-200"
                                      : order.orderStatus === "confirmed"
                                        ? "text-blue-700 bg-blue-50 border-blue-200"
                                        : "text-gray-700 bg-gray-50"
                                  }`}
                              >
                                {order.orderStatus === "delivered" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {order.orderStatus === "pending" && <Clock className="h-3 w-3 mr-1" />}
                                {order.orderStatus === "shipped" && <Truck className="h-3 w-3 mr-1" />}
                                <span className="capitalize">{order.orderStatus}</span>
                              </Badge>

                              <Badge
                                variant="outline"
                                className={`border-gray-300 text-xs sm:text-sm ${
                                  // If order is cancelled, show orange regardless of paid status
                                  order.orderStatus === "cancelled"
                                    ? "text-orange-700 bg-orange-50 border-orange-200"
                                    : (order.paymentStatus === "paid" || order.orderStatus === "confirmed" || !!order.paymentId)
                                      ? "text-green-700 bg-green-50 border-green-200"
                                      : order.paymentStatus === "pending"
                                        ? "text-orange-700 bg-orange-50 border-orange-200"
                                        : "text-red-700 bg-red-50 border-red-200"
                                  }`}
                              >
                                <span className="capitalize">{(order.paymentStatus === 'paid' || order.orderStatus === 'confirmed' || !!order.paymentId) ? 'paid' : order.paymentStatus}</span>
                              </Badge>



                              <Button
                                size="sm"
                                onClick={() => downloadInvoice(order)}
                                className="bg-red-400 hover:bg-red-400 text-white text-xs sm:text-sm"
                              >
                                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">ORDER DETAILS</span>
                              </Button>
                              {order.orderStatus !== "cancelled" && (
                                <Button
                                  size="sm"
                                  onClick={() => onRequestCancel(order)}
                                  className="bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm"
                                >
                                  <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">CANCEL ORDER</span>
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm">
                            <div className="space-y-2">
                              <div className="text-gray-500 font-medium text-base sm:text-lg">Customer Information</div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <div className="font-medium text-gray-900 text-sm sm:text-base">{order.address.name}</div>
                                <div className="text-gray-600 text-xs sm:text-sm">{order.address.phone}</div>
                                <div className="text-gray-600 text-xs mt-1">
                                  {order.address.address}, {order.address.city}, {order.address.state} -{" "}
                                  {order.address.pincode}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-gray-500 font-medium text-base sm:text-lg">Order Summary</div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600 text-base sm:text-lg">Total Amount:</span>
                                  <span className="font-semibold text-gray-900 text-sm sm:text-base">
                                    ₹ {(() => {
                                      const convBase = Number((order as any).convenienceFee || 0);
                                      const convGst = Number((convBase * 0.18).toFixed(2));
                                      const convTotal = Number((convBase + convGst).toFixed(2));
                                      const base = Number(order.totalAmount || 0);
                                      return (base + convTotal).toFixed(2);
                                    })()}
                                  </span>
                                </div>
                                {Number((order as any).convenienceFee || 0) > 0 && (
                                  <div className="flex justify-between items-center mt-1 text-xs sm:text-sm text-gray-600">
                                    <span>Includes Instamojo Convenience Fee</span>
                                    {(() => {
                                      const convBase = Number((order as any).convenienceFee || 0);
                                      const convGst = Number((convBase * 0.18).toFixed(2));
                                      const convTotal = Number((convBase + convGst).toFixed(2));
                                      return <span>₹ {convTotal.toFixed(2)}</span>
                                    })()}
                                  </div>
                                )}
                                <div className="text-gray-600 text-xs sm:text-sm mt-1">
                                  Payment: <span className="font-medium">{order.paymentMethod.toUpperCase()}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {order.specialRequests && (
                            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-500 rounded-lg">
                              <div className="flex items-center space-x-2 mb-2">
                                <Bell className="h-4 w-4 text-yellow-800" />
                                <div className="text-yellow-800 text-base sm:text-lg font-medium">Special Requests:</div>
                              </div>
                              <div className="text-yellow-900 text-sm">{order.specialRequests}</div>
                            </div>
                          )}

                          <div className="mt-4">
                            <div className="text-gray-500 text-base sm:text-lg font-medium mb-3">Order Items</div>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <div className="divide-y divide-gray-100">
                                {order.items.map((item, index) => (
                                  <div key={index} className="flex justify-between items-center p-3">
                                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                      <div className="bg-red-100 p-1 rounded flex-shrink-0">
                                        <Package className="h-3 w-3 text-red-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-gray-900 font-medium text-base sm:text-lg truncate block">
                                          {item.name}
                                          {(((item as any).variantLabel || (item as any).unit)
                                            ? ` (${(item as any).variantLabel || (item as any).unit})`
                                            : ""
                                          )}
                                        </span>
                                        <span className="text-gray-500 text-xs sm:text-sm">
                                          × {item.quantity}
                                          {(((item as any).variantLabel || (item as any).unit)
                                            ? ` × ${(item as any).variantLabel || (item as any).unit}`
                                            : ""
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="font-medium text-gray-900 text-sm sm:text-base flex-shrink-0">
                                      ₹ {(item.price * item.quantity).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm sm:text-base">
                        No orders found matching "{orderSearchTerm}"
                      </div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
    </div>
  )
}
