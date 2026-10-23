import React, { useEffect, useState } from "react";
import { apiGet } from "../utils/axiosInstance";
import { toast } from "react-toastify";
import { FaArrowLeft, FaClock, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

const CancellationRequestsPage = ({ onBack }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    loadCancellationRequests(controller.signal);
    return () => controller.abort();
  }, [currentPage]);

  const loadCancellationRequests = async (signal) => {
    if (loading) return; // prevent overlapping calls
    setLoading(true);
    setError("");
    try {
      const response = await apiGet("/api/user/cancellation-requests", {
        params: {
          page: currentPage,
          limit: 5,
        },
        signal,
      });

      if (response.data?.success) {
        const payload = response.data.data || {};
        setRequests(Array.isArray(payload.requests) ? payload.requests : []);
        // Backend returns separate pagination fields; normalize for UI controls
        const totalPages = Number(payload.totalPages || 0);
        const current = Number(payload.currentPage || currentPage);
        setPagination({
          totalPages,
          currentPage: current,
          totalRequests: Number(payload.totalRequests || 0),
          hasPrevPage: current > 1,
          hasNextPage: totalPages > 0 && current < totalPages,
        });
      } else {
        setError(response.data?.message || "Failed to load cancellation requests");
      }
    } catch (err) {
      if (err?.name === "CanceledError") return; // aborted
      console.error("Load cancellation requests error:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load cancellation requests");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-amber-50 border-amber-200 text-amber-800";
      case "approved":
        return "bg-green-50 border-green-200 text-green-800";
      case "rejected":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return <FaClock className="text-amber-600" />;
      case "approved":
        return <FaCheckCircle className="text-green-600" />;
      case "rejected":
        return <FaTimesCircle className="text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#FFF5F5" }}>
      <div className="w-full max-w-4xl mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-all active:scale-95"
            aria-label="Back"
          >
            <FaArrowLeft className="text-neutral-700" size={20} />
          </button>
          <h1 className="text-2xl font-bold text-neutral-900">Cancellation Requests</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={loadCancellationRequests}
              className="mt-2 px-4 py-2 text-red-600 font-semibold hover:text-red-700 text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
            <p className="text-neutral-600 mt-4">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-soft">
            <div className="text-neutral-400 text-4xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              No Cancellation Requests
            </h3>
            <p className="text-neutral-600 text-sm">
              You haven't submitted any cancellation requests yet.
            </p>
            <button
              onClick={onBack}
              className="mt-6 px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-all"
            >
              Back to Profile
            </button>
          </div>
        ) : (
          <>
            {/* Requests List */}
            <div className="space-y-4 mb-8">
              {requests.map((request) => (
                <div
                  key={request._id}
                  className="bg-white rounded-2xl p-6 shadow-soft hover:shadow-elevated transition-all border border-neutral-100"
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-100">
                    <div>
                      <h3 className="font-bold text-lg text-neutral-900">
                        Order #{request.orderIdStr}
                      </h3>
                      <p className="text-sm text-neutral-500 mt-1">
                        Requested on {new Date(request.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div
                      className={`px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2 border ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {getStatusIcon(request.status)}
                      <span className="capitalize">{request.status}</span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 py-4">
                    <div>
                      <p className="text-xs font-medium text-neutral-600 uppercase">Reason</p>
                      <p className="text-sm text-neutral-900 mt-1 break-words">
                        {request.cancellationReason}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-neutral-600 uppercase">Order Amount</p>
                      <p className="text-lg font-bold text-neutral-900 mt-1">
                        ₹{Number(request.totalAmount).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  {request.items && request.items.length > 0 && (
                    <div className="mt-4 py-4 border-t border-neutral-100">
                      <p className="text-xs font-medium text-neutral-600 uppercase mb-3">
                        Order Items
                      </p>
                      <div className="space-y-2">
                        {request.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-neutral-700">
                              {item.name} × {item.quantity}
                            </span>
                            <span className="font-semibold text-neutral-900">
                              ₹{(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Details */}
                  {request.status === "pending" && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>⏳ Under Review:</strong> Your request is being reviewed by our admin team. You will receive an email notification once it's approved or rejected.
                      </p>
                    </div>
                  )}

                  {request.status === "approved" && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                      <p className="text-sm text-green-800">
                        <strong>✅ Approved:</strong> Your cancellation request has been approved.
                      </p>
                      {request.paymentMethod === "online" && request.paymentStatus === "paid" && (
                        <p className="text-sm text-green-700">
                          Your refund of ₹{Number(request.totalAmount).toFixed(2)} will be processed within 3-5 business days.
                        </p>
                      )}
                      {request.adminRemarks && (
                        <p className="text-sm text-green-700 mt-2">
                          <strong>Admin Notes:</strong> {request.adminRemarks}
                        </p>
                      )}
                    </div>
                  )}

                  {request.status === "rejected" && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                      <p className="text-sm text-red-800">
                        <strong>❌ Rejected:</strong> Your cancellation request has been declined.
                      </p>
                      {request.adminResponse && (
                        <p className="text-sm text-red-700">
                          <strong>Reason:</strong> {request.adminResponse}
                        </p>
                      )}
                      {request.adminRemarks && (
                        <p className="text-sm text-red-700 mt-2">
                          <strong>Admin Notes:</strong> {request.adminRemarks}
                        </p>
                      )}
                      <p className="text-xs text-red-600 mt-2">
                        Your order remains active. Please contact our support if you have any questions.
                      </p>
                    </div>
                  )}

                  {/* Payment Info */}
                  <div className="mt-4 py-4 border-t border-neutral-100">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-neutral-600">Payment Method</p>
                        <p className="font-semibold text-neutral-900 mt-1">
                          {request.paymentMethod === "online" ? "Online" : "COD"}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-600">Payment Status</p>
                        <p className="font-semibold text-neutral-900 mt-1">
                          {request.paymentStatus?.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-soft">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrevPage}
                  className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 transition-all"
                >
                  Previous
                </button>
                <div className="text-sm text-neutral-600">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!pagination.hasNextPage}
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CancellationRequestsPage;
