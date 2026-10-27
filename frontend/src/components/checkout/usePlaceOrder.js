import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createInstamojoPayment } from "../../api/orders";
import { getPincodeCoords } from "../../utils/pincodeCoords";
import { buildOrderItems } from "./utils";

export default function usePlaceOrder({
  cart,
  addresses,
  selectedAddressId,
  clientSubtotal,
  weight,
  shippingFee,
  taxAmount,
  totalAmount,
  specialRequest,
  shippingMode = "standard",
  deliveryLat = null,
  deliveryLong = null,
  selectedCourier = null,
  expectedEtaText = "",
}) {
  const navigate = useNavigate();
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const paymentMethod = "online";

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setOrderDetails(null);
    navigate("/home");
  };

  const handleInstamojoPayment = async (orderData) => {
    try {
      const orderToStore = {
        ...orderData,
        orderId: `ORD-${Date.now()}`,
        paymentMethod: "Online Payment",
      };
      sessionStorage.setItem("pendingOrderData", JSON.stringify(orderToStore));

      console.log("📡 [FRONTEND] Calling /api/create-instamojo-payment...");
      const res = await createInstamojoPayment(orderData);
      console.log("📥 [FRONTEND] Response from Backend:", res.data);

      if (res.data && res.data.success && res.data.payment_url) {
        console.log(
          "✅ [FRONTEND] Payment URL received. Redirecting to:",
          res.data.payment_url
        );
        window.location.href = res.data.payment_url;
      } else {
        console.error("Instamojo create response:", res.data);
        toast.error(
          res.data?.message || "Failed to initiate payment. Please try again."
        );
        setPlacingOrder(false);
        sessionStorage.removeItem("pendingOrderData");
      }
    } catch (err) {
      console.error("Instamojo payment error:", err?.response?.data || err);
      const apiMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === "string" ? err.response.data : null);
      toast.error(
        apiMessage || err.message || "Failed to initiate payment. Please try again."
      );
      setPlacingOrder(false);
      sessionStorage.removeItem("pendingOrderData");
    }
  };

  const placeOrder = async () => {
    if (placingOrder) return;
    try {
      setPlacingOrder(true);
      console.log("🛒 [FRONTEND] Starting placeOrder process...");

      const address = addresses.find((a) => a._id === selectedAddressId);
      if (!address) {
        toast.error("Please select a delivery address");
        return;
      }

      let dropLat = deliveryLat;
      let dropLong = deliveryLong;
      if (shippingMode === "quick") {
        if (!Number.isFinite(Number(dropLat)) || !Number.isFinite(Number(dropLong))) {
          const fromPin = getPincodeCoords(address.pincode);
          if (fromPin) {
            dropLat = fromPin.lat;
            dropLong = fromPin.long;
          }
        }
        if (!Number.isFinite(Number(dropLat)) || !Number.isFinite(Number(dropLong))) {
          toast.error(
            "Same day delivery isn't available for this location. Please use Standard shipping."
          );
          setPlacingOrder(false);
          return;
        }
      }

      const orderItems = buildOrderItems(cart.cartItems || []);
      const orderData = {
        items: orderItems,
        address: {
          name: address.name,
          phone: address.phone,
          address: address.address,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        },
        paymentMethod,
        subtotal: clientSubtotal,
        weight,
        shiprocketFee: shippingFee,
        taxAmount,
        totalAmount,
        specialRequests: specialRequest,
        billedWeight: weight,
        shippingMode: shippingMode === "quick" ? "quick" : "standard",
        requestedShippingMode: shippingMode === "quick" ? "quick" : "standard",
        deliveryLat:
          shippingMode === "quick" && dropLat != null
            ? Number(dropLat)
            : undefined,
        deliveryLong:
          shippingMode === "quick" && dropLong != null
            ? Number(dropLong)
            : undefined,
        courierCompanyId:
          selectedCourier?.courier_company_id ??
          selectedCourier?.id ??
          undefined,
        courierName:
          shippingMode === "quick"
            ? "Same day delivery"
            : selectedCourier?.courier_name || undefined,
        courierRate: shippingFee,
        courierEtd: expectedEtaText || undefined,
      };

      console.log(
        "📦 [FRONTEND] Order Data Prepared:",
        JSON.stringify(orderData, null, 2)
      );
      console.log(
        "ℹ️ [FRONTEND] Shiprocket order creation will be triggered by the backend AFTER successful payment."
      );

      await handleInstamojoPayment(orderData);
    } catch (err) {
      console.error(err);
      toast.error("Failed to place order");
    } finally {
      setPlacingOrder(false);
    }
  };

  return {
    placingOrder,
    showSuccessModal,
    orderDetails,
    placeOrder,
    handleSuccessModalClose,
  };
}
