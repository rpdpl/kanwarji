import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createInstamojoPayment } from "../../api/orders";
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
          res.data.message || "Failed to initiate payment. Please try again."
        );
        setPlacingOrder(false);
        sessionStorage.removeItem("pendingOrderData");
      }
    } catch (err) {
      console.error("Instamojo payment error:", err);
      toast.error(
        err.message || "Failed to initiate payment. Please try again."
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
