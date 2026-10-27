import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPut, apiPatch, apiPost } from "../utils/axiosInstance";
import { toast } from "react-toastify";
import { FaArrowLeft, FaEnvelope, FaPhone, FaSignOutAlt, FaClock, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { AiOutlineSetting, AiOutlineAppstore, AiOutlineShoppingCart } from "react-icons/ai";
import Footer from "./Footer";
import CancellationRequestsPage from "./CancellationRequestsPage";
import { getTrackingUrl } from "../utils/shiprocketAPI";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [editForm, setEditForm] = useState({ name: "", phone: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersPagination, setOrdersPagination] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit] = useState(5);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState(null);
  
  const navigate = useNavigate();



  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiGet("/api/auth/me");
        if (res.data.success) setUser(res.data.user);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (activeTab !== "orders") return;

    const loadOrders = async () => {
      setOrdersLoading(true);
      setOrdersError("");
      try {
        const res = await apiGet("/api/user/orders", {
          params: { page: ordersPage, limit: ordersLimit },
        });
        const ok = !!res?.data?.success;
        if (!ok) {
          setOrders([]);
          setOrdersPagination(null);
          setOrdersError(res?.data?.message || "Failed to load orders");
          return;
        }

        const data = res?.data?.data;
        const list = Array.isArray(data?.orders) ? data.orders : [];
        // Frontend safeguard: only show paid orders that are confirmed, cancellation-pending, or cancelled
        const filtered = list.filter((o) => {
          const os = String(o?.orderStatus || "").toLowerCase();
          const ps = String(o?.paymentStatus || "").toLowerCase();
          return (ps === "paid") && (os === "confirmed" || os === "cancellation-pending" || os === "cancelled");
        });
        setOrders(filtered);
        setOrdersPagination(data?.pagination || null);
      } catch (e) {
        console.error("Load orders error:", e);
        setOrders([]);
        setOrdersPagination(null);
        setOrdersError(
          e?.response?.data?.message || e?.message || "Failed to load orders"
        );
      } finally {
        setOrdersLoading(false);
      }
    };

    loadOrders();
  }, [activeTab, ordersPage, ordersLimit, ordersRefreshKey]);

  const formatOrderDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString();
  };

  const isDelivered = (order) =>
    String(order?.orderStatus || "").toLowerCase() === "delivered";

  const isCancelled = (order) => {
    const status = String(order?.orderStatus || "").toLowerCase();
    return status === "cancelled" || status === "cancellation-pending";
  };

  const isCancellationPending = (order) =>
    String(order?.orderStatus || "").toLowerCase() === "cancellation-pending";

  const openCancelModal = (order) => {
    if (isDelivered(order) || isCancelled(order)) return;
    setSelectedOrderForCancel(order);
    setCancelReason("");
    setShowCancelModal(true);
  };

  const confirmCancelOrder = async () => {
    if (!selectedOrderForCancel) return;

    setCancellingOrderId(selectedOrderForCancel._id);
    try {
      // Use the new request-cancellation endpoint instead of direct cancel
      const res = await apiPost(`/api/orders/${selectedOrderForCancel._id || selectedOrderForCancel.orderId}/request-cancellation`, {
        reason: cancelReason.trim() || "Requested cancellation",
      });
      if (res?.data?.success) {
        toast.success(res?.data?.message || "Cancellation request submitted. Our admin team will review it shortly.");
        setOrdersRefreshKey((k) => k + 1);
        setShowCancelModal(false);
      } else {
        toast.error(res?.data?.message || "Failed to submit cancellation request");
      }
    } catch (e) {
      console.error("Cancel order error:", e);
      toast.error(
        e?.response?.data?.message || e?.message || "Failed to submit cancellation request"
      );
    } finally {
      setCancellingOrderId(null);
      setSelectedOrderForCancel(null);
    }
  };

  // Handle opening edit modal and initialize form
  const handleEditClick = () => {
    setEditForm({
      name: user.name,
      phone: user.phone,
    });
    setShowEdit(true);
  };

  // Handle form input changes
  const handleEditChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value,
    });
  };

  // Handle form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!editForm.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    if (editForm.phone.length < 10) {
      toast.error("Phone number must be at least 10 digits");
      return;
    }

    setEditLoading(true);
    try {
      const res = await apiPut("/api/user/update-info", {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
      });

      if (res.data.success) {
        // Update user state with new data
        setUser(res.data.user);
        // Update localStorage if it exists
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          localStorage.setItem("user", JSON.stringify(res.data.user));
        }
        toast.success(res.data.message || "Profile updated successfully!");
        setShowEdit(false);
      } else {
        toast.error(res.data.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Update profile error:", error);
      toast.error(
        error.response?.data?.message ||
        error.message ||
        "Failed to update profile"
      );
    } finally {
      setEditLoading(false);
    }
  };

  if (!user)
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#FFEAEA" }}
      >
        <div className="flex flex-col items-center">
          <svg
            className="animate-spin h-10 w-10 text-primary-600 mb-4"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-neutral-600">Loading profile...</p>
        </div>
      </div>
    );

  return (
    <div
      className="min-h-screen pb-24 -mt-[76px] pt-[76px]"
      style={{ backgroundColor: "#FFEAEA" }}
    >
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="mx-auto w-full max-w-2xl">
          <div className="bg-white p-8 rounded-3xl shadow-elevated animate-slide-up">
            {/* Header section with back, title, and logout */}
            <div className="relative flex items-center justify-between mb-6 pb-6 border-b border-neutral-200">
              {/* Back button - left aligned */}
              <button
                onClick={() => navigate(-1)}
                className="text-neutral-700 p-2 hover:bg-neutral-100 rounded-lg transition-all active:scale-95"
                aria-label="Go back"
              >
                <FaArrowLeft size={20} />
              </button>

              {/* Centered title */}
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 via-orange-600 to-amber-600 bg-clip-text text-transparent absolute left-1/2 transform -translate-x-1/2">
                👤 My Profile 👤
              </h1>

              {/* Logout button - right aligned */}
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  window.dispatchEvent(new Event("logout"));
                  window.dispatchEvent(new Event("cart-updated"));
                  navigate("/home");
                }}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-all active:scale-95 border-2 shadow-sm font-semibold"
                style={{
                  backgroundColor: "rgb(238, 34, 37)",
                  borderColor: "rgb(200, 20, 22)",
                }}
                aria-label="Logout"
              >
                <FaSignOutAlt size={16} />
                <span className="text-sm">Logout</span>
              </button>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-100 to-orange-100 flex items-center justify-center overflow-hidden shadow-soft border-4 border-white mb-4 animate-scale-pulse">
                {user.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-4xl font-bold text-primary-600">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                {user.name}
              </h2>
              <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-1.5 rounded-full mb-6">
                <span className="text-sm font-semibold">BUYER</span>
              </div>

              <div className="w-full space-y-4 bg-neutral-50 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <FaEnvelope className="text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-neutral-500 font-medium">
                      Email Address
                    </div>
                    <div className="text-neutral-900 font-medium">
                      {user.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <FaPhone className="text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-neutral-500 font-medium">
                      Phone Number
                    </div>
                    <div className="text-neutral-900 font-medium">
                      {user.phone}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-3xl shadow-elevated overflow-hidden">
            <div className="flex border-b border-neutral-200">
              <button
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold transition-all ${activeTab === "overview"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50/50"
                  : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                  }`}
                onClick={() => setActiveTab("overview")}
              >
                <AiOutlineAppstore size={20} />
                <span>Overview</span>
              </button>
              <button
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold transition-all ${activeTab === "orders"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50/50"
                  : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                  }`}
                onClick={() => {
                  setActiveTab("orders");
                  setOrdersPage(1);
                }}
              >
                <AiOutlineShoppingCart size={20} />
                <span>Orders</span>
              </button>
              <button
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold transition-all ${activeTab === "cancellations"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50/50"
                  : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                  }`}
                onClick={() => setActiveTab("cancellations")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Cancellations</span>
              </button>
              <button
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold transition-all ${activeTab === "settings"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50/50"
                  : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                  }`}
                onClick={() => setActiveTab("settings")}
              >
                <AiOutlineSetting size={20} />
                <span>Settings</span>
              </button>
            </div>

            <div className="p-6">
              {activeTab === "overview" ? (
                <div>
                  <h3 className="font-semibold text-lg text-neutral-900 mb-4">
                    Account Status
                  </h3>
                  <div>
                    {user.isActive ? (
                      <div className="p-5 rounded-2xl bg-success-50 border border-success-200 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-success-500 flex items-center justify-center shadow-soft">
                          <svg
                            className="w-6 h-6 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <div>
                          <div className="font-bold text-success-700 text-lg">
                            Active Account
                          </div>
                          <div className="text-success-600 text-sm">
                            Your account is in good standing
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 rounded-2xl bg-neutral-100 border border-neutral-200">
                        <div className="font-semibold text-neutral-700">
                          Inactive
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === "orders" ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-neutral-900">
                      Order History
                    </h3>
                    {ordersPagination?.totalOrders != null && (
                      <div className="text-sm text-neutral-500 font-medium">
                        {ordersPagination.totalOrders} order(s)
                      </div>
                    )}
                  </div>

                  {ordersLoading ? (
                    <div className="flex flex-col items-center py-10">
                      <svg
                        className="animate-spin h-8 w-8 text-primary-600 mb-3"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <div className="text-neutral-600">Loading orders...</div>
                    </div>
                  ) : ordersError ? (
                    <div className="p-5 rounded-2xl bg-red-50 border border-red-200">
                      <div className="font-semibold text-red-700">
                        {ordersError}
                      </div>
                      <button
                        onClick={() => setOrdersRefreshKey((k) => k + 1)}
                        className="mt-3 px-4 py-2 rounded-xl bg-neutral-900 text-white font-semibold active:scale-95"
                      >
                        Retry
                      </button>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 text-center">
                      <div className="text-neutral-900 font-semibold mb-1">
                        No orders found
                      </div>
                      <div className="text-neutral-600 text-sm">
                        Once you place an order, it will appear here.
                      </div>
                      <button
                        onClick={() => navigate("/home")}
                        className="mt-4 px-5 py-2.5 rounded-xl text-white font-semibold active:scale-95 border-2 shadow-sm"
                        style={{
                          backgroundColor: "rgb(238, 34, 37)",
                          borderColor: "rgb(200, 20, 22)",
                        }}
                      >
                        Shop Now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div
                          key={order._id}
                          className="rounded-2xl border border-neutral-200 bg-white shadow-soft overflow-hidden"
                        >
                          <div className="p-5 border-b border-neutral-100">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm text-neutral-500 font-medium">
                                  Order ID
                                </div>
                                <div className="font-bold text-neutral-900">
                                  {order.orderId || order._id}
                                </div>
                                <div className="text-xs text-neutral-500 mt-1">
                                  {formatOrderDate(order.createdAt)}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-sm text-neutral-500 font-medium">
                                  Total
                                </div>
                                <div className="font-bold text-neutral-900">
                                  ₹{
                                    (
                                      Number(order.totalAmount || 0) +
                                      Number(order.convenienceFee || 0) * 1.18
                                    ).toFixed(2)
                                  }
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700">
                                {String(order.orderStatus || "unknown")}
                              </span>
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                                {String(order.paymentStatus || "unknown")}
                              </span>
                              {order.awbNumber && [
                                "ready_to_ship",
                                "shipped",
                                "in_transit",
                                "out_for_delivery",
                                "delivered",
                              ].includes(String(order.shipmentStatus || "").toLowerCase()) && (
                                <a
                                  href={getTrackingUrl(order.awbNumber)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                >
                                  Track Order
                                </a>
                              )}
                            </div>

                            {(order.shippingMode ||
                              order.requestedShippingMode ||
                              order.courierName ||
                              order.courierEtd ||
                              order.shiprocketFee) && (
                              <div className="mt-3 text-xs text-neutral-600 space-y-1 bg-neutral-50 rounded-lg p-3">
                                <div>
                                  <span className="font-semibold text-neutral-700">Shipping: </span>
                                  {order.shippingMode === "quick" ||
                                  order.requestedShippingMode === "quick"
                                    ? "Same day (Quick)"
                                    : "Standard"}
                                  {order.courierName ? ` · ${order.courierName}` : ""}
                                </div>
                                {(Number(order.courierRate || order.shiprocketFee) > 0 ||
                                  order.courierEtd) && (
                                  <div>
                                    {Number(order.courierRate || order.shiprocketFee) > 0 && (
                                      <span>
                                        Fee: ₹
                                        {Number(
                                          order.courierRate || order.shiprocketFee || 0
                                        ).toFixed(2)}
                                      </span>
                                    )}
                                    {order.courierEtd && (
                                      <span>
                                        {Number(order.courierRate || order.shiprocketFee) > 0
                                          ? " · "
                                          : ""}
                                        ETA: {order.courierEtd}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="p-5">
                            <div className="space-y-3">
                              {(order.items || []).map((it, idx) => (
                                <div
                                  key={`${order._id}-${idx}`}
                                  className="flex items-center gap-3"
                                >
                                  <div className="w-12 h-12 rounded-xl bg-neutral-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                                    {it?.imageUrl ? (
                                      <img
                                        src={it.imageUrl}
                                        alt={it?.name || "Item"}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="text-neutral-400 text-lg">🧾</div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-semibold text-neutral-900 text-sm">
                                      {it?.name}
                                    </div>
                                    <div className="text-xs text-neutral-500">
                                      Qty: {it?.quantity || 0} • ₹
                                      {Number(it?.price || 0).toFixed(2)}
                                    </div>
                                  </div>
                                  <div className="text-sm font-semibold text-neutral-900">
                                    ₹
                                    {(
                                      Number(it?.price || 0) *
                                      Number(it?.quantity || 0)
                                    ).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {isCancellationPending(order) && (
                              <div className="mt-5 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                  <strong>⏳ Cancellation Pending:</strong> Your cancellation request is under review by our admin team. You will receive an email notification once it's approved or rejected.
                                </p>
                              </div>
                            )}

                            {String(order?.orderStatus || "").toLowerCase() === "cancelled" && (
                              <div className="mt-5 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm text-green-800">
                                  <strong>✅ Order Cancelled:</strong> Your order cancellation has been approved.
                                </p>
                                {order.paymentMethod === "online" && order.paymentStatus === "refunded" && (
                                  <p className="text-sm text-green-700 mt-2">
                                    Your refund of ₹{Number(order.totalAmount).toFixed(2)} will be processed within 3-5 business days.
                                  </p>
                                )}
                              </div>
                            )}

                            {!isDelivered(order) && !isCancelled(order) && (
                              <div className="mt-5 flex justify-end">
                                <button
                                  onClick={() => openCancelModal(order)}
                                  disabled={cancellingOrderId === order._id || isCancellationPending(order)}
                                  className="px-5 py-2.5 rounded-xl font-semibold text-white active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed border-2 shadow-sm"
                                  style={{
                                    backgroundColor: "rgb(238, 34, 37)",
                                    borderColor: "rgb(200, 20, 22)",
                                  }}
                                >
                                  {cancellingOrderId === order._id
                                    ? "Cancelling..."
                                    : isCancellationPending(order)
                                    ? "Cancellation Under Review"
                                    : "Cancel Order"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {ordersPagination && (
                        <div className="flex items-center justify-between pt-2">
                          <button
                            onClick={() =>
                              setOrdersPage((p) => Math.max(1, Number(p) - 1))
                            }
                            disabled={!ordersPagination.hasPrevPage}
                            className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                          >
                            Prev
                          </button>

                          <div className="text-sm text-neutral-600 font-medium">
                            Page {ordersPagination.currentPage} of {ordersPagination.totalPages}
                          </div>

                          <button
                            onClick={() =>
                              setOrdersPage((p) => Number(p) + 1)
                            }
                            disabled={!ordersPagination.hasNextPage}
                            className="px-4 py-2 rounded-xl bg-neutral-900 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : activeTab === "cancellations" ? (
                <CancellationRequestsPage onBack={() => setActiveTab("overview")} />
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleEditClick}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-neutral-50 transition-all active:scale-[0.98] group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 group-hover:bg-primary-200 transition-colors">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-neutral-900">
                        Edit Profile
                      </div>
                      <div className="text-sm text-neutral-500">
                        Update your name and mobile number
                      </div>
                    </div>
                    <div className="text-neutral-300 group-hover:text-neutral-400 transition-colors">
                      ›
                    </div>
                  </button>

                  <button
                    onClick={() => navigate("/terms-of-service")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-neutral-50 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center text-success-600 group-hover:bg-success-200 transition-colors">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-neutral-900">
                        Terms of Service
                      </div>
                      <div className="text-sm text-neutral-500">
                        terms and conditions
                      </div>
                    </div>
                    <div className="text-neutral-300 group-hover:text-neutral-400 transition-colors">
                      ›
                    </div>
                  </button>

                  <button
                    onClick={() => navigate("/privacy-policy")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-neutral-50 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-secondary-100 flex items-center justify-center text-secondary-600 group-hover:bg-secondary-200 transition-colors">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-neutral-900">
                        Privacy
                      </div>
                      <div className="text-sm text-neutral-500">
                        privacy policy
                      </div>
                    </div>
                    <div className="text-neutral-300 group-hover:text-neutral-400 transition-colors">
                      ›
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-float animate-scale-in">
            <h3 className="text-2xl font-bold text-neutral-900 mb-6">
              Edit Profile
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Enter your name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={editForm.phone}
                  onChange={handleEditChange}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Enter your mobile number"
                  required
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="flex-1 py-3 text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl font-semibold transition-all active:scale-95"
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-soft"
                >
                  {editLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-float animate-scale-in">
            <h3 className="text-2xl font-bold text-neutral-900 mb-2">
              Request Cancellation
            </h3>
            <p className="text-neutral-600 text-sm mb-6">
              Order ID: <strong>{selectedOrderForCancel?.orderId || selectedOrderForCancel?._id}</strong>
            </p>

            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-700">
                ⏳ Your cancellation request will be reviewed by our admin team within a few hours. You will receive an email notification once it's approved or rejected.
                {selectedOrderForCancel?.paymentMethod === "online" && selectedOrderForCancel?.paymentStatus === "paid" &&
                  " If approved, your payment will be refunded within 3-5 business days."}
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); confirmCancelOrder(); }} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Reason for Cancellation <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please let us know why you want to cancel this order..."
                  maxLength="200"
                  rows="4"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  required
                />
                <div className="text-xs text-neutral-500 mt-1">
                  {cancelReason.length}/200 characters
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setSelectedOrderForCancel(null);
                    setCancelReason("");
                  }}
                  className="flex-1 py-3 text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl font-semibold transition-all active:scale-95"
                  disabled={cancellingOrderId}
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={cancellingOrderId || !cancelReason.trim()}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-soft"
                >
                  {cancellingOrderId ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    "Request Cancellation"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div>
        <Footer />
      </div>
    </div>
  );
};

export default Profile;
