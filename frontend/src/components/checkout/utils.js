import { isPinQuickAvailable } from "../../utils/pincodeCoords";

export const emptyAddr = {
  title: "",
  name: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
  preferredShippingMode: "standard",
};

export const parseUnitToKg = (raw) => {
  if (!raw) return 0;
  const s = String(raw).toLowerCase();
  const compact = s.replace(/\s+/g, "");
  const numMatch = compact.match(/([0-9]*\.?[0-9]+)/);
  const val = numMatch ? Number(numMatch[1]) : 1;
  const unitToken = compact.replace(/[0-9.]/g, "");
  const UNIT_SYNONYMS = [
    {
      names: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"],
      factor: 1,
    },
    { names: ["g", "gm", "gms", "gram", "grams"], factor: 1 / 1000 },
  ];
  for (const u of UNIT_SYNONYMS) {
    if (u.names.some((name) => unitToken.includes(name))) {
      return val * u.factor;
    }
  }
  return numMatch ? val : 0;
};

export const computeClientSubtotal = (cartItems = []) =>
  cartItems.reduce((s, it) => {
    const price = Number(it.price || 0);
    const discount = Number(it.discount || 0) || 0;
    const discountedPrice = price * (1 - discount / 100);
    return s + discountedPrice * (it.quantity || 0);
  }, 0);

export const computeTaxAmount = (cartItems = []) =>
  cartItems.reduce((s, it) => {
    const price = Number(it.price || 0);
    const discount = Number(it.discount || 0) || 0;
    const discountedPrice = price * (1 - discount / 100);
    const taxPercent = Number(it.tax || 0) || 0;
    return s + discountedPrice * (it.quantity || 0) * (taxPercent / 100);
  }, 0);

export const computeSavings = (cartItems = []) =>
  cartItems.reduce((s, it) => {
    const discount = Number(it.discount || 0);
    if (discount > 0) {
      const oldPrice = Number(it.price || 0) / (1 - discount / 100);
      return s + (oldPrice - Number(it.price || 0)) * (it.quantity || 0);
    }
    return s;
  }, 0);

export const computeCartWeightKg = (cartItems = []) =>
  (cartItems || []).reduce((sum, it) => {
    const explicitWeight = Number(
      it?.weightKgPerUnit || it?.weight || it?.productWeight || 0
    );
    if (explicitWeight > 0) {
      return sum + explicitWeight * (it.quantity || 0);
    }
    const unitLabel = String(
      it?.unit || it?.variantLabel || it?.selectedVariant || ""
    );
    return sum + parseUnitToKg(unitLabel) * (it.quantity || 0);
  }, 0) || 0;

export const buildOrderItems = (cartItems = []) =>
  cartItems.map((it) => {
    const unit = String(it.unit || it.variantLabel || "");
    const variantLabel = String(
      it.variantLabel || it.selectedVariantLabel || ""
    );
    const explicit = Number(
      it?.weightKgPerUnit || it?.weight || it?.productWeight || 0
    );
    const perUnitKg =
      explicit > 0 ? explicit : parseUnitToKg(unit || variantLabel);
    return {
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      productId: it._id || it.id || it.productId,
      unit,
      variantLabel,
      tax: Number(it.tax || 0),
      discount: Number(it.discount || 0),
      weight: perUnitKg,
    };
  });

export const validateAddressForm = (form) => {
  const allowedTitles = new Set(["home", "office", "other"]);
  const titleOk = allowedTitles.has(String(form.title || "").toLowerCase());
  const phoneDigits = String(form.phone || "").replace(/\D/g, "");
  const pincodeDigits = String(form.pincode || "").replace(/\D/g, "").slice(0, 6);
  const addressOk = String(form.address || "").trim().length >= 10;
  const cityOk = String(form.city || "").trim().length >= 3;
  const stateOk = String(form.state || "").trim().length >= 3;
  if (
    !form.name ||
    !form.phone ||
    !form.address ||
    !form.city ||
    !form.state ||
    !form.pincode
  ) {
    return { ok: false, error: "Please fill all required fields" };
  }
  if (!titleOk) return { ok: false, error: "Title must be Home, Office, or Other" };
  if (phoneDigits.length !== 10)
    return { ok: false, error: "Phone must be exactly 10 digits" };
  if (pincodeDigits.length !== 6)
    return { ok: false, error: "Pincode must be 6 digits" };
  if (!addressOk)
    return { ok: false, error: "Address must be at least 10 characters" };
  if (!cityOk) return { ok: false, error: "City must be at least 3 characters" };
  if (!stateOk)
    return { ok: false, error: "State must be at least 3 characters" };

  let preferredShippingMode =
    form.preferredShippingMode === "quick" ? "quick" : "standard";
  if (preferredShippingMode === "quick" && !isPinQuickAvailable(pincodeDigits)) {
    preferredShippingMode = "standard";
  }

  return {
    ok: true,
    normalized: {
      title: String(form.title || "").trim(),
      name: form.name,
      phone: phoneDigits,
      address: String(form.address || "").trim(),
      city: String(form.city || "").trim(),
      state: String(form.state || "").trim(),
      pincode: pincodeDigits,
      isDefault: !!form.isDefault,
      preferredShippingMode,
    },
  };
};
