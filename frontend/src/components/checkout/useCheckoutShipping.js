import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getShippingRates,
  SHIPROCKET_PICKUP_LOCATION_ID,
  QUICK_ELIGIBLE_PINCODES,
  calculateBilledWeight,
} from "../../utils/shiprocketAPI";
import { updateAddress } from "../../api/addresses";
import { computeCartWeightKg, computeClientSubtotal } from "./utils";

function pickBestCourier(rates, { preferAir = true } = {}) {
  let list = Array.isArray(rates) ? rates : [];
  if (preferAir) {
    const airRates = list.filter((c) => {
      const isSurface =
        c?.is_surface === true ||
        String(c?.courier_name).toLowerCase().includes("surface");
      if (isSurface) return false;
      const name = String(c.courier_name || "").toLowerCase();
      const hasAirName =
        name.includes("air") ||
        name.includes("express") ||
        name.includes("speed post") ||
        name.includes("quick");
      return Number(c?.mode) === 1 || hasAirName || c?.is_surface === false;
    });
    if (airRates.length) list = airRates;
  }
  if (!list.length) return null;

  return list.reduce((best, cur) => {
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
    const bestRate = Number(best?.rate ?? best?.rates ?? best?.freight_charge);
    const curRate = Number(cur?.rate ?? cur?.rates ?? cur?.freight_charge);
    return curRate < bestRate ? cur : best;
  }, list[0]);
}

function etaTextFromCourier(courier) {
  const etaHours = Number(
    courier?.etd_hours ??
      (courier?.estimated_delivery_days != null
        ? Number(courier.estimated_delivery_days) * 24
        : NaN)
  );
  if (!Number.isFinite(etaHours)) return "";
  if (etaHours < 24) return "within 24 hours";
  const days = Math.max(1, Math.round(etaHours / 24));
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return `in ${days} day${days > 1 ? "s" : ""} (by ${dt.toLocaleDateString("en-IN")})`;
}

function requestBrowserGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          long: pos.coords.longitude,
        });
      },
      (err) => {
        reject(err || new Error("Location permission denied"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

export default function useCheckoutShipping({
  cart,
  addresses,
  selectedAddressId,
  setAddresses,
}) {
  const [shippingCharge, setShippingCharge] = useState(0);
  const [selectedCourier, setSelectedCourier] = useState(null);
  const [expectedEtaText, setExpectedEtaText] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [weight, setWeight] = useState(0);
  const [showQuickIntroModal, setShowQuickIntroModal] = useState(false);
  const [quickEligible, setQuickEligible] = useState(false);
  const [shippingMode, setShippingMode] = useState("standard"); // quick | standard
  const [deliveryLat, setDeliveryLat] = useState(null);
  const [deliveryLong, setDeliveryLong] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [warnedQuickPin, setWarnedQuickPin] = useState(
    () => localStorage.getItem("warnedQuickPin") || null
  );

  // legacy aliases used by older checkout UI
  const isLocalDelivery = quickEligible;
  const showLocalDeliveryModal = showQuickIntroModal;
  const setShowLocalDeliveryModal = setShowQuickIntroModal;

  const clientSubtotal = computeClientSubtotal(cart.cartItems || []);

  useEffect(() => {
    const billedWeight = calculateBilledWeight(
      computeCartWeightKg(cart.cartItems || [])
    );
    setWeight(billedWeight);
  }, [cart.cartItems]);

  useEffect(() => {
    const addr = addresses.find((a) => a._id === selectedAddressId);
    if (!addr) {
      setQuickEligible(false);
      setShippingMode("standard");
      setDeliveryLat(null);
      setDeliveryLong(null);
      return;
    }
    const pin = (addr.pincode || "").toString().replace(/\D/g, "").slice(0, 6);
    const eligible = QUICK_ELIGIBLE_PINCODES.has(pin);
    setQuickEligible(eligible);
    if (!eligible) {
      setShippingMode("standard");
    } else if (warnedQuickPin !== pin) {
      setShowQuickIntroModal(true);
      setWarnedQuickPin(pin);
      localStorage.setItem("warnedQuickPin", pin);
    }
    if (Number.isFinite(Number(addr.latitude)) && Number.isFinite(Number(addr.longitude))) {
      setDeliveryLat(Number(addr.latitude));
      setDeliveryLong(Number(addr.longitude));
    } else if (shippingMode !== "quick") {
      setDeliveryLat(null);
      setDeliveryLong(null);
    }
  }, [selectedAddressId, addresses, warnedQuickPin, shippingMode]);

  const applyCourierResult = (courier, mode) => {
    if (!courier) {
      setShippingCharge(0);
      setSelectedCourier(null);
      setExpectedEtaText("");
      return false;
    }
    setShippingCharge(
      Math.ceil(Number(courier.rate ?? courier.rates ?? courier.freight_charge) || 0)
    );
    setSelectedCourier(courier);
    setExpectedEtaText(etaTextFromCourier(courier));
    setShippingMode(mode);
    return true;
  };

  const fetchStandardRates = async (pin) => {
    const res = await getShippingRates(
      SHIPROCKET_PICKUP_LOCATION_ID,
      pin,
      weight,
      clientSubtotal,
      { mode: "standard" }
    );
    if (!res.success) {
      throw new Error(res.error || res.message || "Failed to fetch rates");
    }
    const allRates =
      res.available_courier_companies_vg ||
      res.data?.available_courier_companies_vg ||
      res.data?.data?.available_courier_companies ||
      res.data?.available_courier_companies ||
      [];
    const best = pickBestCourier(allRates, { preferAir: true });
    if (!best) {
      setShippingError(
        "No suitable couriers available for this route. Please try a different address."
      );
      applyCourierResult(null, "standard");
      return;
    }
    setShippingError("");
    applyCourierResult(best, "standard");
  };

  const fetchQuickRates = async (pin, lat, long) => {
    const res = await getShippingRates(
      SHIPROCKET_PICKUP_LOCATION_ID,
      pin,
      weight,
      clientSubtotal,
      { mode: "quick", lat, long }
    );
    if (!res.success) {
      throw new Error(res.error || res.message || "Quick rates unavailable");
    }
    const allRates =
      res.available_courier_companies_vg ||
      res.data?.available_courier_companies_vg ||
      res.data?.data?.available_courier_companies ||
      res.data?.available_courier_companies ||
      [];
    const best = pickBestCourier(allRates, { preferAir: false });
    if (!best) {
      throw new Error("No Quick couriers available for your location");
    }
    setShippingError("");
    applyCourierResult(best, "quick");
  };

  const selectShippingMode = async (mode) => {
    const addr = addresses.find((a) => a._id === selectedAddressId);
    if (!addr) return;
    const pin = (addr.pincode || "").toString().replace(/\D/g, "").slice(0, 6);

    if (mode === "quick") {
      if (!quickEligible) {
        toast.info("Quick delivery is only available in Delhi / NCR");
        return;
      }
      setGpsLoading(true);
      setShippingLoading(true);
      setShippingError("");
      try {
        let lat = deliveryLat;
        let long = deliveryLong;
        if (!Number.isFinite(lat) || !Number.isFinite(long)) {
          const gps = await requestBrowserGps();
          lat = gps.lat;
          long = gps.long;
          setDeliveryLat(lat);
          setDeliveryLong(long);
          try {
            const updated = await updateAddress(addr._id, {
              title: addr.title,
              name: addr.name,
              phone: addr.phone,
              address: addr.address,
              city: addr.city,
              state: addr.state,
              pincode: addr.pincode,
              isDefault: !!addr.isDefault,
              latitude: lat,
              longitude: long,
            });
            if (updated?.data?.address && typeof setAddresses === "function") {
              setAddresses((prev) =>
                prev.map((a) =>
                  a._id === addr._id ? { ...a, ...updated.data.address } : a
                )
              );
            }
          } catch (_) {
            /* non-fatal: coords still used for this checkout */
          }
        }
        await fetchQuickRates(pin, lat, long);
        toast.success("Quick delivery rates loaded");
      } catch (e) {
        console.error(e);
        const msg =
          e?.code === 1 || /denied|permission/i.test(String(e?.message || e))
            ? "Location permission is required for Quick delivery. Switched to Standard shipping."
            : e?.message ||
              "Quick delivery unavailable. Switched to Standard shipping.";
        toast.warning(msg);
        setShippingMode("standard");
        try {
          await fetchStandardRates(pin);
        } catch (stdErr) {
          setShippingError("Failed to calculate shipping for your pincode.");
          applyCourierResult(null, "standard");
        }
      } finally {
        setGpsLoading(false);
        setShippingLoading(false);
      }
      return;
    }

    // standard
    setShippingMode("standard");
    setShippingLoading(true);
    setShippingError("");
    try {
      await fetchStandardRates(pin);
    } catch (e) {
      console.error(e);
      setShippingError("Failed to calculate shipping for your pincode.");
      applyCourierResult(null, "standard");
    } finally {
      setShippingLoading(false);
    }
  };

  useEffect(() => {
    const addr = addresses.find((a) => a._id === selectedAddressId);
    if (!addr) {
      setShippingCharge(0);
      setShippingError("");
      setShippingLoading(false);
      setSelectedCourier(null);
      return;
    }
    const pin = (addr.pincode || "").toString().replace(/\D/g, "").slice(0, 6);

    const run = async () => {
      setShippingLoading(true);
      setShippingError("");
      setSelectedCourier(null);
      setExpectedEtaText("");
      try {
        if (
          shippingMode === "quick" &&
          QUICK_ELIGIBLE_PINCODES.has(pin) &&
          Number.isFinite(deliveryLat) &&
          Number.isFinite(deliveryLong)
        ) {
          await fetchQuickRates(pin, deliveryLat, deliveryLong);
        } else {
          if (shippingMode === "quick") {
            // waiting for GPS / user selection — don't hard-fail
            setShippingCharge(0);
          } else {
            await fetchStandardRates(pin);
          }
        }
      } catch (e) {
        console.error("Shipping calc error", e);
        if (shippingMode === "quick") {
          toast.warning(
            "Quick delivery unavailable. Falling back to Standard shipping."
          );
          setShippingMode("standard");
          try {
            await fetchStandardRates(pin);
          } catch (_) {
            setShippingError("Failed to calculate shipping for your pincode.");
            applyCourierResult(null, "standard");
          }
        } else {
          setShippingError("Failed to calculate shipping for your pincode.");
          applyCourierResult(null, "standard");
        }
      } finally {
        setShippingLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-fetch on address/weight/mode/coords
  }, [
    selectedAddressId,
    addresses,
    cart.cartItems,
    clientSubtotal,
    weight,
    shippingMode,
    deliveryLat,
    deliveryLong,
  ]);

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
    showQuickIntroModal,
    setShowQuickIntroModal,
    isLocalDelivery,
    quickEligible,
    shippingMode,
    selectShippingMode,
    deliveryLat,
    deliveryLong,
    gpsLoading,
    clientSubtotal,
  };
}
