import React, { useState } from "react";
import { toast } from "react-toastify";
import { FaTimes } from "react-icons/fa";
import { apiGet, apiPost } from "../utils/axiosInstance";

const CancelOrderModal = ({ order, isOpen, onClose, onCancelSuccess }) => {
  const [cancellationReason, setCancellationReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReasonError, setShowReasonError] = useState(false);

  const handleSubmitCancellation = async () => {
    if (!cancellationReason.trim()) {
      setShowReasonError(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiPost(
        `/api/orders/${order._id || order.orderId}/request-cancellation`,
        {
          reason: cancellationReason,
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setCancellationReason("");
        setShowReasonError(false);
        if (onCancelSuccess) onCancelSuccess();
        onClose();
      } else {
        toast.error(response.data.message || "Failed to submit cancellation request");
      }
    } catch (error) {
      console.error("Cancellation request error:", error);
      toast.error(
        error.response?.data?.message || "Failed to submit cancellation request"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-neutral-900">Cancel Order</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 hover:bg-neutral-100 rounded-lg transition-all disabled:opacity-50"
          >
            <FaTimes className="text-neutral-600" size={20} />
          </button>
        </div>

        {/* Order Info */}
        <div className="bg-neutral-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-neutral-600 mb-1">Order ID</p>
              <p className="font-semibold text-neutral-900">{order.orderId}</p>
            </div>
            <div>
              <p className="text-neutral-600 mb-1">Amount</p>
              <p className="font-semibold text-neutral-900">₹{order.totalAmount}</p>
            </div>
            <div>
              <p className="text-neutral-600 mb-1">Status</p>
              <p className="font-semibold text-neutral-900">{order.orderStatus}</p>
            </div>
            <div>
              <p className="text-neutral-600 mb-1">Payment</p>
              <p className="font-semibold text-neutral-900">
                {order.paymentMethod === "online" ? "Online" : "COD"}
              </p>
            </div>
          </div>
        </div>

        {/* Refund Info */}
        {order.paymentMethod === "online" && order.paymentStatus === "paid" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-800">
              ✓ <strong>Refund:</strong> You will receive a refund of ₹{order.totalAmount} within 3-5 business days after approval.
            </p>
          </div>
        )}

        {/* Cancellation Reason */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Why do you want to cancel? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={cancellationReason}
            onChange={(e) => {
              setCancellationReason(e.target.value);
              if (e.target.value.trim()) setShowReasonError(false);
            }}
            placeholder="Please provide a reason for cancellation..."
            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none ${
              showReasonError ? "border-red-500" : "border-neutral-300"
            }`}
            rows="4"
            disabled={isSubmitting}
          />
          {showReasonError && (
            <p className="text-red-500 text-sm mt-1">Reason is required</p>
          )}
        </div>

        {/* Info Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-900">
            <strong>ℹ️ Note:</strong> Your cancellation request will be reviewed by our admin team within a few hours. You will receive an email notification once it's approved or rejected.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 font-medium rounded-lg hover:bg-neutral-50 transition-all disabled:opacity-50"
          >
            Keep Order
          </button>
          <button
            onClick={handleSubmitCancellation}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              "Request Cancellation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelOrderModal;
