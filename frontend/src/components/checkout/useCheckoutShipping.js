import { useEffect, useState } from "react";
import {
  getShippingRates,
  SHIPROCKET_PICKUP_LOCATION_ID,
  calculateBilledWeight,
} from "../../utils/shiprocketAPI";
import { getPincodeCoords } from "../../utils/pincodeCoords";
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

function extractCouriers(res) {
  return (
    res?.available_courier_companies_vg ||
    res?.data?.available_courier_companies_vg ||
    res?.data?.data?.available_courier_companies ||
    res?.data?.available_courier_companies ||
    []
  );
}

function courierRate(c) {
  return Math.ceil(Number(c?.rate ?? c?.rates ?? c?.freight_charge) || 0);
}

function sortByRateAsc(list) {
  return [...list].sort((a, b) => courierRate(a) - courierRate(b));
}

function optionId(mode, courier, index) {
  const cid =
    courier?.courier_company_id ?? courier?.id ?? courier?.courier_id ?? index;
  return `${mode}-${cid}`;
}

function toOption(courier, mode, index, coords = null) {
  const rate = courierRate(courier);
  const eta = etaTextFromCourier(courier);
  const name =
    mode === "quick"
      ? "Same day delivery"
      : String(courier?.courier_name || "Courier");
  return {
    id: optionId(mode, courier, index),
    mode,
    label: name,
    rate,
    eta,
    courier,
    deliveryLat: coords?.lat ?? null,
    deliveryLong: coords?.long ?? null,
  };
}

function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export default function useCheckoutShipping({
  cart,
  addresses,
  selectedAddressId,
}) {
  const [shippingCharge, setShippingCharge] = useState(0);
  const [selectedCourier, setSelectedCourier] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [expectedEtaText, setExpectedEtaText] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [shippingMode, setShippingMode] = useState("standard");
  const [deliveryLat, setDeliveryLat] = useState(null);
  const [deliveryLong, setDeliveryLong] = useState(null);

  const cartItems = cart?.cartItems || [];
  const needsAddress = !selectedAddressId;
  const clientSubtotal = computeClientSubtotal(cartItems);
  // Derive weight during render so address auto-select and rates fetch
  // share the same turn (no lagged weight state race on first load).
  const rawWeightKg = computeCartWeightKg(cartItems);
  const weight =
    calculateBilledWeight(rawWeightKg) ||
    (cartItems.length > 0 ? 0.5 : 0);

  const selectedAddress =
    (addresses || []).find((a) => sameId(a._id, selectedAddressId)) || null;
  const pin = (selectedAddress?.pincode || "")
    .toString()
    .replace(/\D/g, "")
    .slice(0, 6);
  const addressLat = Number(selectedAddress?.latitude);
  const addressLong = Number(selectedAddress?.longitude);

  const clearShipping = () => {
    setShippingOptions([]);
    setShippingCharge(0);
    setShippingError("");
    setShippingLoading(false);
    setSelectedCourier(null);
    setSelectedOptionId(null);
    setExpectedEtaText("");
    setShippingMode("standard");
    setDeliveryLat(null);
    setDeliveryLong(null);
  };

  const applyOption = (option) => {
    if (!option) {
      setShippingCharge(0);
      setSelectedCourier(null);
      setSelectedOptionId(null);
      setExpectedEtaText("");
      setShippingMode("standard");
      setDeliveryLat(null);
      setDeliveryLong(null);
      return;
    }
    setSelectedOptionId(option.id);
    setSelectedCourier(option.courier);
    setShippingCharge(option.rate);
    setExpectedEtaText(option.eta || "");
    setShippingMode(option.mode === "quick" ? "quick" : "standard");
    if (option.mode === "quick") {
      setDeliveryLat(option.deliveryLat);
      setDeliveryLong(option.deliveryLong);
    } else {
      setDeliveryLat(null);
      setDeliveryLong(null);
    }
  };

  const selectShippingOption = (option) => {
    if (!option || needsAddress || shippingLoading) return;
    applyOption(option);
  };

  useEffect(() => {
    if (!selectedAddressId) {
      clearShipping();
      return;
    }

    // Address id is set but list hasn't caught up yet (first paint / reload).
    // Keep a loading placeholder instead of a blank "no options" state.
    if (!selectedAddress) {
      setShippingLoading(true);
      setShippingError("");
      setShippingOptions([]);
      applyOption(null);
      return;
    }

    if (pin.length !== 6) {
      clearShipping();
      setShippingError("This address has an invalid pincode.");
      return;
    }

    // Cart empty / unweighable — nothing to quote yet.
    if (weight <= 0) {
      clearShipping();
      return;
    }

    let cancelled = false;

    const run = async () => {
      setShippingLoading(true);
      setShippingError("");
      setShippingOptions([]);
      applyOption(null);

      const fromPin = getPincodeCoords(pin);
      const lat = Number.isFinite(addressLat) ? addressLat : fromPin?.lat;
      const long = Number.isFinite(addressLong) ? addressLong : fromPin?.long;
      const canQuick =
        !!fromPin && Number.isFinite(lat) && Number.isFinite(long);

      try {
        const stdPromise = getShippingRates(
          SHIPROCKET_PICKUP_LOCATION_ID,
          pin,
          weight,
          clientSubtotal,
          { mode: "standard", cod: 0 }
        );
        const quickPromise = canQuick
          ? getShippingRates(
              SHIPROCKET_PICKUP_LOCATION_ID,
              pin,
              weight,
              clientSubtotal,
              { mode: "quick", lat, long, cod: 0 }
            )
          : Promise.resolve(null);

        const [stdRes, quickRes] = await Promise.all([stdPromise, quickPromise]);
        if (cancelled) return;

        const options = [];

        if (quickRes?.success) {
          const quickCouriers = extractCouriers(quickRes);
          const bestQuick = pickBestCourier(quickCouriers, { preferAir: false });
          if (bestQuick) {
            options.push(toOption(bestQuick, "quick", 0, { lat, long }));
          }
        }

        if (!stdRes?.success) {
          if (!options.length) {
            setShippingError(
              stdRes?.error ||
                stdRes?.message ||
                "Failed to calculate shipping for your pincode."
            );
          }
        } else {
          const stdCouriers = sortByRateAsc(extractCouriers(stdRes));
          stdCouriers.forEach((c, i) => {
            options.push(toOption(c, "standard", i));
          });
          if (!options.length) {
            setShippingError(
              "No suitable couriers available for this route. Please try a different address."
            );
          }
        }

        setShippingOptions(options);

        if (options.length) {
          const sameDay = options.find((o) => o.mode === "quick");
          const bestStdCourier = pickBestCourier(
            options.filter((o) => o.mode === "standard").map((o) => o.courier),
            { preferAir: true }
          );
          const bestStd = bestStdCourier
            ? options.find(
                (o) => o.mode === "standard" && o.courier === bestStdCourier
              ) ||
              options.find(
                (o) =>
                  o.mode === "standard" &&
                  (o.courier?.courier_company_id ?? o.courier?.id) ===
                    (bestStdCourier?.courier_company_id ?? bestStdCourier?.id)
              )
            : options.find((o) => o.mode === "standard");
          applyOption(sameDay || bestStd || options[0]);
        }
      } catch (e) {
        console.error("Shipping calc error", e);
        if (!cancelled) {
          setShippingError("Failed to calculate shipping for your pincode.");
          setShippingOptions([]);
          applyOption(null);
        }
      } finally {
        if (!cancelled) setShippingLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // Primitive deps only — avoid re-fetch/cancel loops from new `addresses` array refs.
  }, [
    selectedAddressId,
    selectedAddress?._id,
    pin,
    weight,
    clientSubtotal,
    addressLat,
    addressLong,
  ]);

  return {
    shippingCharge,
    setShippingCharge,
    selectedCourier,
    selectedOptionId,
    shippingOptions,
    selectShippingOption,
    expectedEtaText,
    setExpectedEtaText,
    shippingLoading,
    shippingError,
    weight,
    needsAddress,
    shippingMode,
    deliveryLat,
    deliveryLong,
    clientSubtotal,
  };
}
