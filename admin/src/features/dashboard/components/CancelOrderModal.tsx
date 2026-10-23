"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDashboard } from "@/features/dashboard/dashboard-context"

export function CancelOrderModal() {
  const {
    showCancelModal,
    selectedOrderForCancel,
    cancelRemark,
    setCancelRemark,
    isCancelling,
    closeCancelModal,
    cancelOrder,
  } = useDashboard()

  if (!showCancelModal || !selectedOrderForCancel) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md bg-white shadow-xl border-0">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl font-bold text-gray-900">Cancel Order</CardTitle>
          <CardDescription className="text-gray-600">
            Order #{selectedOrderForCancel.orderId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-remark" className="text-gray-700 font-medium">
              Please provide a remark for cancelling this order
            </Label>
            <Textarea
              id="cancel-remark"
              placeholder="Enter cancellation remark..."
              value={cancelRemark}
              onChange={(e) => setCancelRemark(e.target.value)}
              className="border-gray-300 focus:border-red-400 focus:ring-red-400 min-h-32 text-sm"
            />
          </div>
        </CardContent>
        <div className="flex gap-3 px-6 pb-6">
          <Button
            onClick={closeCancelModal}
            variant="outline"
            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Close
          </Button>
          <Button
            onClick={cancelOrder}
            disabled={isCancelling || !cancelRemark.trim()}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
          >
            {isCancelling ? "Cancelling..." : "Confirm Cancel"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
