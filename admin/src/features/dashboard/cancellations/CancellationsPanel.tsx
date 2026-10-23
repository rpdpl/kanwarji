"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Search, CheckCircle, XCircle, Clock, Package } from "lucide-react"
import type { CancellationRequest } from "@/features/dashboard/types"

type Props = {
  cancellationRequests: CancellationRequest[]
  cancellationSearchTerm: string
  setCancellationSearchTerm: (v: string) => void
  handleApproveCancellation: (requestId: string, remarks: string) => void
  handleRejectCancellation: (requestId: string, remarks: string) => void
}

export function CancellationsPanel({
  cancellationRequests, cancellationSearchTerm, setCancellationSearchTerm,
  handleApproveCancellation, handleRejectCancellation,
}: Props) {
  return (
    <div className="space-y-6">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-gray-900 text-lg sm:text-xl flex items-center">
                      <AlertCircle className="h-5 w-5 mr-2 text-orange-400" /> Cancellation Requests
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-sm sm:text-base">Review and manage order cancellation requests</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <label htmlFor="cancellation-search" className="sr-only">
                      Search cancellation requests
                    </label>
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="cancellation-search"
                      value={cancellationSearchTerm}
                      onChange={(e) => setCancellationSearchTerm(e.target.value)}
                      placeholder="Search by order ID or name"
                      className="pl-8 border-gray-300 focus:border-orange-400 focus:ring-orange-400"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="space-y-6">
                  {(() => {
                    const filteredRequests = cancellationRequests.filter((req) =>
                      req.orderIdStr.toLowerCase().includes(cancellationSearchTerm.toLowerCase()) ||
                      req.customerName.toLowerCase().includes(cancellationSearchTerm.toLowerCase()) ||
                      req.customerEmail.toLowerCase().includes(cancellationSearchTerm.toLowerCase()) ||
                      req.customerPhone.toLowerCase().includes(cancellationSearchTerm.toLowerCase())
                    )

                    return filteredRequests.length > 0 ? (
                      filteredRequests.map((request) => (
                        <div key={request._id} className="p-4 sm:p-6 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-3 sm:space-x-4">
                              <div className="bg-orange-100 p-2 rounded-lg">
                                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 text-base sm:text-lg">
                                  Cancellation Request #{request.orderIdStr}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-600">
                                  Requested on {new Date(request.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
                              <Badge
                                variant="outline"
                                className={`border-gray-300 text-xs sm:text-sm ${request.status === "approved"
                                  ? "text-green-700 bg-green-50 border-green-200"
                                  : request.status === "rejected"
                                    ? "text-red-700 bg-red-50 border-red-200"
                                    : "text-orange-700 bg-orange-50 border-orange-200"
                                  }`}
                              >
                                {request.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {request.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                                {request.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                                <span className="capitalize">{request.status}</span>
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm">
                            <div className="space-y-2">
                              <div className="text-gray-500 font-medium text-base sm:text-lg">Customer Details</div>
                              <div className="bg-white p-3 rounded border border-gray-200 space-y-2">
                                <div>
                                  <span className="text-gray-600">Name:</span>
                                  <span className="font-medium text-gray-900 ml-2">{request.customerName}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Email:</span>
                                  <span className="text-gray-900 ml-2">{request.customerEmail}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Phone:</span>
                                  <span className="font-medium text-gray-900 ml-2">{request.customerPhone}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Address:</span>
                                  <span className="text-gray-900 ml-2">
                                    {request.address.address}, {request.address.city}, {request.address.state} - {request.address.pincode}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-gray-500 font-medium text-base sm:text-lg">Payment & Order Info</div>
                              <div className="bg-white p-3 rounded border border-gray-200 space-y-2">
                                <div>
                                  <span className="text-gray-600">Cancellation Reason:</span>
                                  <div className="text-gray-900 mt-1 text-xs p-2 bg-yellow-50 rounded border border-yellow-100">
                                    {request.cancellationReason}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-600">Payment Method:</span>
                                  <span className="font-medium text-gray-900 ml-2">{request.paymentMethod.toUpperCase()}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Payment Status:</span>
                                  <span className={`font-medium ml-2 ${request.paymentStatus === "paid" ? "text-green-600" : "text-orange-600"}`}>
                                    {request.paymentStatus.toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Order Amount:</span>
                                  <span className="font-semibold text-gray-900 ml-2">₹ {request.totalAmount.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="text-gray-500 text-base sm:text-lg font-medium mb-3">Order Items</div>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <div className="divide-y divide-gray-100">
                                {request.items.map((item, index) => (
                                  <div key={index} className="flex justify-between items-center p-3">
                                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                      <div className="bg-orange-100 p-1 rounded flex-shrink-0">
                                        <Package className="h-3 w-3 text-orange-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-gray-900 font-medium text-base sm:text-lg truncate block">
                                          {item.name}
                                        </span>
                                        <span className="text-gray-500 text-xs sm:text-sm">
                                          × {item.quantity}
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

                          {request.status === "pending" && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="space-y-3">
                                <Label htmlFor={`remarks-${request._id}`} className="text-gray-700">Admin Remarks/Response:</Label>
                                <Textarea
                                  id={`remarks-${request._id}`}
                                  placeholder="Enter your remarks or reason for approval/rejection"
                                  className="border-gray-300 focus:border-orange-400 focus:ring-orange-400 text-sm"
                                  defaultValue={request.adminRemarks}
                                />
                                <div className="flex gap-3">
                                  <Button
                                    onClick={() => handleApproveCancellation(request._id, (document.getElementById(`remarks-${request._id}`) as HTMLTextAreaElement)?.value)}
                                    className="bg-green-500 hover:bg-green-600 text-white flex-1"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approve
                                  </Button>
                                  <Button
                                    onClick={() => handleRejectCancellation(request._id, (document.getElementById(`remarks-${request._id}`) as HTMLTextAreaElement)?.value)}
                                    className="bg-red-500 hover:bg-red-600 text-white flex-1"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {request.status !== "pending" && (
                            <div className={`mt-4 pt-4 border-t p-3 rounded ${request.status === "approved" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                              <div className="text-sm">
                                <span className={`font-medium ${request.status === "approved" ? "text-green-800" : "text-red-800"}`}>
                                  Status: {request.status.toUpperCase()}
                                </span>
                                {request.adminRemarks && (
                                  <p className={`mt-2 text-xs ${request.status === "approved" ? "text-green-700" : "text-red-700"}`}>
                                    <strong>Admin Notes:</strong> {request.adminRemarks}
                                  </p>
                                )}
                                {request.adminResponse && (
                                  <p className={`mt-2 text-xs ${request.status === "approved" ? "text-green-700" : "text-red-700"}`}>
                                    <strong>Response:</strong> {request.adminResponse}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm sm:text-base">
                        No cancellation requests found {cancellationSearchTerm && `matching "${cancellationSearchTerm}"`}
                      </div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
    </div>
  )
}
