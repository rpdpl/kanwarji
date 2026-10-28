import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { apiGet } from "../utils/axiosInstance";
import { toast } from "react-toastify";
import { FaTimes } from "react-icons/fa";
import { getTrackingUrl, getShippingRates, SHIPROCKET_PICKUP_LOCATION_ID, calculateBilledWeight } from "../utils/shiprocketAPI";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const didRun = useRef(false);
  const [expectedEtaText, setExpectedEtaText] = useState("");
  const conversionFiredRef = useRef(false);

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      try {
        if (didRun.current) {
          return;
        }
        didRun.current = true;
        const orderId = searchParams.get("orderId");
        if (!orderId) {
          console.error("Missing orderId in URL");
          toast.error("Missing order ID. Please contact support.");
          setLoading(false);
          return;
        }

        const res = await apiGet(`/api/orders/${orderId}`);
        if (!res?.data?.success || !res?.data?.order) {
          console.error("Failed to fetch order from server", res?.data);
          toast.error("Could not fetch order details. Please contact support.");
          setLoading(false);
          return;
        }

        const order = res.data.order;

        const shippingMode =
          order.shippingMode === "quick"
            ? "Same day (Quick)"
            : order.shippingMode === "standard"
              ? "Standard"
              : order.requestedShippingMode === "quick"
                ? "Same day (Quick)"
                : "Standard";

        setOrderDetails({
          orderId: order.orderId,
          subtotal: Number(order.subtotal || 0),
          taxAmount: Number(order.taxAmount || 0),
          deliveryFee: Number(order.shiprocketFee || order.deliveryFee || 0),
          convenienceFee: Number(order.convenienceFee || 0),
          totalAmount: Number(order.totalAmount || 0),
          paymentMethod: order.paymentMethod,
          items: order.items || [],
          paidAt: order.paidAt || order.updatedAt || order.createdAt,
          shippingMode,
          courierName: order.courierName || "",
          courierEtd: order.courierEtd || "",
          courierRate: Number(order.courierRate || order.shiprocketFee || 0),
        });

        try {
          const addr = order.address || {};
          const pin = String(addr.pincode || "").trim();
          if (pin) {
            const parseUnitToKg = (raw) => {
              if (!raw) return 0;
              const s = String(raw).toLowerCase();
              const compact = s.replace(/\s+/g, "");
              const numMatch = compact.match(/([0-9]*\.?[0-9]+)/);
              const val = numMatch ? Number(numMatch[1]) : 1;
              const unitToken = compact.replace(/[0-9.]/g, "");
              const UNIT_SYNONYMS = [
                { names: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"], factor: 1 },
                { names: ["g", "gm", "gms", "gram", "grams"], factor: 1 / 1000 },
              ];
              for (const u of UNIT_SYNONYMS) {
                if (u.names.some((name) => unitToken.includes(name))) return val * u.factor;
              }
              return numMatch ? val : 0;
            };

            const totalWeightKg = (order.items || []).reduce((sum, it) => {
              const explicitWeight = Number(it?.weightKgPerUnit || it?.weight || it?.productWeight || 0);
              if (explicitWeight > 0) {
                return sum + explicitWeight * (it.quantity || 0);
              }
              const unitLabel = String(it?.unit || it?.variantLabel || it?.selectedVariant || "");
              const perUnitKg = parseUnitToKg(unitLabel);
              return sum + perUnitKg * (it.quantity || 0);
            }, 0) || 0;

            const billedWeight = calculateBilledWeight(totalWeightKg);
            const rates = await getShippingRates(
              SHIPROCKET_PICKUP_LOCATION_ID,
              pin,
              billedWeight,
              Number(order.subtotal || 0),
              { mode: "standard", cod: 0 }
            );
            if (rates?.success && rates?.data) {
              const allRates = rates.data.available_courier_companies_vg || rates.data.data?.available_courier_companies_vg || rates.data.data?.available_courier_companies || [];
              const airRates = (allRates || []).filter((c) => (c?.is_surface === false) || Number(c?.mode) === 1 || /air|express|speed post/i.test(String(c.courier_name || "")));
              const pickFrom = airRates.length ? airRates : (allRates || []);
              if (pickFrom.length) {
                const fastest = pickFrom.reduce((best, cur) => {
                  const be = Number((best?.etd_hours ?? (best?.estimated_delivery_days != null ? Number(best.estimated_delivery_days) * 24 : undefined))) || Number.POSITIVE_INFINITY;
                  const ce = Number((cur?.etd_hours ?? (cur?.estimated_delivery_days != null ? Number(cur.estimated_delivery_days) * 24 : undefined))) || Number.POSITIVE_INFINITY;
                  if (ce < be) return cur;
                  if (ce > be) return best;
                  return (Number(cur?.rate) < Number(best?.rate)) ? cur : best;
                }, pickFrom[0]);
                const etaHours = Number(fastest?.etd_hours ?? (fastest?.estimated_delivery_days != null ? Number(fastest.estimated_delivery_days) * 24 : NaN));
                if (Number.isFinite(etaHours)) {
                  if (etaHours < 24) setExpectedEtaText("within 24 hours");
                  else {
                    const days = Math.max(1, Math.round(etaHours / 24));
                    const dt = new Date();
                    dt.setDate(dt.getDate() + days);
                    setExpectedEtaText(`in ${days} day${days > 1 ? "s" : ""} (by ${dt.toLocaleDateString("en-IN")})`);
                  }
                }
              }
            }
          }
        } catch (_) {
          setExpectedEtaText("");
        }

        // Clear the cart (both server and local)
        await clearCart();

        // Clear the sessionStorage
        sessionStorage.removeItem("pendingOrderData");

        const toastKey = "payment-success-toast-shown";
        if (!sessionStorage.getItem(toastKey)) {
          toast.success("Payment successful! Your order has been confirmed.");
          sessionStorage.setItem(toastKey, "1");
        }

        setLoading(false);
      } catch (error) {
        console.error("Error processing payment success:", error);
        toast.error("Error processing your order. Please contact support.");
        setLoading(false);
      }
    };

    handlePaymentSuccess();
  }, []);

  // Fire Google Ads Purchase conversion once when order details are available
  useEffect(() => {
    if (conversionFiredRef.current) return;
    if (!orderDetails) return;
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      try {
        window.gtag("event", "conversion", {
          send_to: "AW-17796498798/o-3FCNPx5M8bEO6KhKZC",
          value: Number(orderDetails.totalAmount || 1.0),
          currency: "INR",
          transaction_id: String(orderDetails.orderId || ""),
        });
        conversionFiredRef.current = true;
      } catch (_) {
        // no-op
      }
    }
  }, [orderDetails]);

  const handleClose = () => {
    navigate("/home");
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#FFF5F5" }}
      >
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-semibold">Processing your order...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 pt-32"
      style={{ backgroundColor: "#FFF5F5" }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-auto relative shadow-2xl border-t-4 border-green-500">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close success modal"
        >
          <FaTimes className="text-gray-500 w-5 h-5" />
        </button>

        {/* Success Content */}
        <div className="text-center pt-4">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Success Message */}
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            🎉 Order Confirmed!
          </h2>

          <p className="text-gray-600 mb-2">
            Payment successful! Your order will be delivered soon.
          </p>

          {/* Order Details */}
          {orderDetails && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Order ID:</span>
                  <span className="font-mono text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                    {orderDetails.orderId}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Payment Successful At:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {new Date(orderDetails.paidAt).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Payment Method:</span>
                  <span className="text-gray-900 capitalize">
                    {orderDetails.paymentMethod === "online"
                      ? "Online Payment"
                      : orderDetails.paymentMethod}
                  </span>
                </div>
                {(orderDetails.shippingMode ||
                  orderDetails.courierName ||
                  orderDetails.courierEtd) && (
                  <div className="mt-3 border-t pt-3 space-y-2">
                    {orderDetails.shippingMode && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Shipping:</span>
                        <span className="font-semibold">{orderDetails.shippingMode}</span>
                      </div>
                    )}
                    {orderDetails.courierName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Courier:</span>
                        <span className="font-semibold text-right max-w-[60%]">
                          {orderDetails.courierName}
                        </span>
                      </div>
                    )}
                    {orderDetails.courierEtd && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">ETA:</span>
                        <span className="font-semibold text-right max-w-[60%]">
                          {orderDetails.courierEtd}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {/* Cost Breakdown */}
                <div className="mt-3 border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-semibold">₹{orderDetails.subtotal?.toFixed(2)}</span>
                  </div>
                  {orderDetails.taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-semibold">₹{orderDetails.taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {orderDetails.deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping Fee:</span>
                      <span className="font-semibold">₹{orderDetails.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  {orderDetails.convenienceFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Convenience Fee</span>
                      <span className="font-semibold">₹{(orderDetails.convenienceFee * 1.18).toFixed(2)}</span>
                    </div>
                  )}
                  {expectedEtaText && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Expected Delivery</span>
                      <span className="font-semibold">{expectedEtaText}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-gray-900 font-semibold">Total:</span>
                    <span className="text-lg font-bold text-gray-900">
                      ₹{(Number(orderDetails.totalAmount || 0) + Number(orderDetails.convenienceFee || 0) * 1.18).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-gray-600 font-medium">Items:</span>
                  <span className="text-right text-gray-900">
                    {orderDetails.items?.length || 0} item(s)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Info Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-left">
            <p className="text-sm text-blue-900">
              📧 A confirmation email has been sent to your registered email address with order details and tracking information.
            </p>
          </div>

          {/* Continue Shopping Button */}
          <button
            onClick={handleClose}
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
};

export default PaymentSuccess;
