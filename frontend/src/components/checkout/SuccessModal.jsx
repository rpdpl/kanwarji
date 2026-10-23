import React from "react";
import { FaTimes } from "react-icons/fa";

export default function SuccessModal({
  show,
  orderDetails,
  onClose,
}) {
  if (!show || !orderDetails) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-auto relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <FaTimes className="text-gray-500 w-5 h-5" />
        </button>

        <div className="text-center pt-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            🎉 Order Placed Successfully!
          </h2>

          <p className="text-gray-600 mb-6">Your order will be delivered soon</p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Order ID:</span>
                <span className="font-mono text-sm font-semibold text-red-600">
                  {orderDetails.orderId}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-bold text-gray-900">
                  ₹{orderDetails.totalAmount?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Payment Method:</span>
                <span className="text-gray-900">
                  {orderDetails.paymentMethod}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full text-white py-3 rounded-xl font-semibold transition-all active:scale-95 shadow-soft hover:shadow-card border-2"
            style={{
              backgroundColor: "rgb(238, 34, 37)",
              borderColor: "rgb(200, 20, 22)",
            }}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
