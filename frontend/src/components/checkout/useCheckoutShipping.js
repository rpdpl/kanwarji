import { useEffect, useState } from "react";
import {
  getShippingRates,
  SHIPROCKET_PICKUP_LOCATION_ID,
  FREE_SHIPPING_PINCODES,
  calculateBilledWeight,
} from "../../utils/shiprocketAPI";
import { computeCartWeightKg, computeClientSubtotal } from "./utils";

export default function useCheckoutShipping({
  cart,
  addresses,
  selectedAddressId,
}) {
  const [shippingCharge, setShippingCharge] = useState(0);
  const [selectedCourier, setSelectedCourier] = useState(null);
  const [expectedEtaText, setExpectedEtaText] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [weight, setWeight] = useState(0);
  const [showLocalDeliveryModal, setShowLocalDeliveryModal] = useState(false);
  const [warnedPincode, setWarnedPincode] = useState(
    () => localStorage.getItem("warnedPincode") || null
  );
  const [isLocalDelivery, setIsLocalDelivery] = useState(false);
  const [refreshedPin, setRefreshedPin] = useState(null);
  const [localRefreshPin, setLocalRefreshPin] = useState(null);
  const [localRefreshTick, setLocalRefreshTick] = useState(0);
  const [autoRefreshCount, setAutoRefreshCount] = useState(0);

  const clientSubtotal = computeClientSubtotal(cart.cartItems || []);

  useEffect(() => {
    const addr = addresses.find((a) => a._id === selectedAddressId);
    if (!addr) {
      setIsLocalDelivery(false);
      setAutoRefreshCount(0);
      return;
    }
    const pinRaw = (addr.pincode || "").toString().trim();
    const pin = pinRaw.replace(/\D/g, "").slice(0, 6);
    if (FREE_SHIPPING_PINCODES.has(pin)) {
      setIsLocalDelivery(true);
      if (warnedPincode !== pin) {
        setShowLocalDeliveryModal(true);
        setWarnedPincode(pin);
        localStorage.setItem("warnedPincode", pin);
      }
      if (localRefreshPin !== pin) {
        setLocalRefreshPin(pin);
        setAutoRefreshCount(0);
        setRefreshedPin(pin + "_initial");
        setLocalRefreshTick((t) => t + 1);
        setTimeout(() => setLocalRefreshTick((t) => t + 1), 80);
      }
    } else {
      setIsLocalDelivery(false);
      setAutoRefreshCount(0);
    }
  }, [selectedAddressId, addresses, warnedPincode, localRefreshPin]);

  useEffect(() => {
    const billedWeight = calculateBilledWeight(
      computeCartWeightKg(cart.cartItems || [])
    );
    setWeight(billedWeight);
  }, [cart.cartItems]);

  useEffect(() => {
    const addr = addresses.find((a) => a._id === selectedAddressId);
    if (!addr) {
      setShippingCharge(0);
      setShippingError("");
      setShippingLoading(false);
      setIsLocalDelivery(false);
      return;
    }
    const fetchShipping = async () => {
      try {
        setShippingLoading(true);
        setShippingError("");
        setSelectedCourier(null);
        setExpectedEtaText("");
        const pinRaw = (addr.pincode || "").toString().trim();
        const pin = pinRaw.replace(/\D/g, "").slice(0, 6);

        if (FREE_SHIPPING_PINCODES.has(pin)) {
          setShippingCharge(0);
          setShippingLoading(false);
          setShippingError("");
          setIsLocalDelivery(true);
          if (warnedPincode !== pin) {
            setShowLocalDeliveryModal(true);
            setWarnedPincode(pin);
          }
          if (autoRefreshCount === 0) {
            setAutoRefreshCount(1);
            setTimeout(() => {
              setRefreshedPin(pin + "_auto_refresh_2");
              setAutoRefreshCount(2);
            }, 100);
          }
          return;
        }

        const res = await getShippingRates(
          SHIPROCKET_PICKUP_LOCATION_ID,
          pin,
          weight,
          clientSubtotal
        );

        if (res.success && res.data) {
          const allRates =
            res.data.available_courier_companies_vg ||
            res.data.data?.available_courier_companies_vg ||
            res.data.data?.available_courier_companies ||
            [];
          const airRates = (allRates || []).filter((c) => {
            const isSurface =
              c?.is_surface === true ||
              String(c?.courier_name).toLowerCase().includes("surface");
            if (isSurface) return false;
            const name = String(c.courier_name || "").toLowerCase();
            const hasAirName =
              name.includes("air") ||
              name.includes("express") ||
              name.includes("speed post");
            return Number(c?.mode) === 1 || hasAirName;
          });

          if (airRates.length === 0) {
            setShippingError(
              "Only surface couriers available for this route. Please try a different address."
            );
            setShippingCharge(0);
            setSelectedCourier(null);
            return;
          }

          const fastest = airRates.reduce((best, cur) => {
            const bestEta =
              Number(
                best?.etd_hours ??
                  (best?.estimated_delivery_days != null
                    ? Number(best.estimated_delivery_days) * 24
                    : undefined)
              ) || Number.POSITIVE_INFINITY;
            const curEta =
              Number(
                cur?.etd_hours ??
                  (cur?.estimated_delivery_days != null
                    ? Number(cur.estimated_delivery_days) * 24
                    : undefined)
              ) || Number.POSITIVE_INFINITY;
            if (curEta < bestEta) return cur;
            if (curEta > bestEta) return best;
            return Number(cur?.rate) < Number(best?.rate) ? cur : best;
          }, airRates[0]);

          if (fastest) {
            setShippingCharge(Math.ceil(Number(fastest.rate)));
            setSelectedCourier(fastest);
            setIsLocalDelivery(false);
            const etaHours = Number(
              fastest?.etd_hours ??
                (fastest?.estimated_delivery_days != null
                  ? Number(fastest.estimated_delivery_days) * 24
                  : NaN)
            );
            if (Number.isFinite(etaHours)) {
              if (etaHours < 24) {
                setExpectedEtaText("within 24 hours");
              } else {
                const days = Math.max(1, Math.round(etaHours / 24));
                const dt = new Date();
                dt.setDate(dt.getDate() + days);
                setExpectedEtaText(
                  `in ${days} day${days > 1 ? "s" : ""} (by ${dt.toLocaleDateString("en-IN")})`
                );
              }
            } else {
              setExpectedEtaText("");
            }
          } else {
            setShippingCharge(0);
            setSelectedCourier(null);
            setExpectedEtaText("");
            setIsLocalDelivery(false);
          }
        } else {
          console.warn(
            "No courier rates found for this pincode via Shiprocket"
          );
          setShippingCharge(0);
          setExpectedEtaText("");
          setIsLocalDelivery(false);
        }
      } catch (e) {
        console.error("Shipping calc error", e);
        setShippingError("Failed to calculate shipping for your pincode.");
        setShippingCharge(0);
        setExpectedEtaText("");
        setIsLocalDelivery(false);
      } finally {
        setShippingLoading(false);
      }
    };
    fetchShipping();
  }, [
    selectedAddressId,
    addresses,
    cart.cartItems,
    clientSubtotal,
    weight,
    autoRefreshCount,
    refreshedPin,
    warnedPincode,
  ]);

  // keep tick referenced so local refresh still triggers re-renders like original
  void localRefreshTick;

  return {
    shippingCharge,
    setShippingCharge,
    selectedCourier,
    expectedEtaText,
    setExpectedEtaText,
    shippingLoading,
    setShippingLoading,
    shippingError,
    setShippingError,
    weight,
    showLocalDeliveryModal,
    setShowLocalDeliveryModal,
    warnedPincode,
    setWarnedPincode,
    isLocalDelivery,
    setIsLocalDelivery,
    clientSubtotal,
  };
}
