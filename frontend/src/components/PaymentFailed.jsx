import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaTimes } from "react-icons/fa";

const PaymentFailed = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 pt-32"
      style={{ backgroundColor: "#FFF5F5" }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-auto relative shadow-2xl border-t-4 border-red-500">
        <button
          onClick={() => navigate("/home")}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <FaTimes className="text-gray-500 w-5 h-5" />
        </button>

        <div className="text-center pt-4">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Failed
          </h2>
          <p className="text-gray-600 mb-4">
            Your payment could not be completed. No amount has been confirmed
            for this order. You can try again from checkout.
          </p>

          {orderId ? (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Order ID:</span>
                <span className="font-mono text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                  {orderId}
                </span>
              </div>
            </div>
          ) : null}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-left">
            <p className="text-sm text-amber-900">
              If money was deducted from your account, it usually reverses
              automatically. Contact support with your order ID if it does not.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate("/checkout")}
              className="w-full text-white py-3 rounded-xl font-semibold transition-all active:scale-95 shadow-soft hover:shadow-card border-2"
              style={{
                backgroundColor: "rgb(238, 34, 37)",
                borderColor: "rgb(200, 20, 22)",
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="w-full py-3 rounded-xl font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View Orders
            </button>
            <button
              onClick={() => navigate("/home")}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-800"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailed;
