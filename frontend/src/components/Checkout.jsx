import React, { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../utils/axiosInstance";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
    FaMapMarkerAlt,
    FaCreditCard,
    FaEllipsisV,
    FaEdit,
    FaTrash,
    FaArrowLeft,
    FaMinus,
    FaPlus,
    FaTimes,
} from "react-icons/fa";

import { useCart } from "../context/CartContext";
import Footer from "./Footer";
import {
    getShippingRates,
    SHIPROCKET_PICKUP_LOCATION_ID,
    FREE_SHIPPING_PINCODES,
    calculateBilledWeight,
} from "../utils/shiprocketAPI";

const Checkout = () => {
    const { clearCart: clearCartContext } = useCart();
    const [cart, setCart] = useState({ cartItems: [], totalPrice: 0 });
    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [paymentMethod] = useState("online");
    const [loading, setLoading] = useState(true);
    const [placingOrder, setPlacingOrder] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [orderDetails, setOrderDetails] = useState(null);
    const [showMenuFor, setShowMenuFor] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const emptyAddr = {
        title: "",
        name: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        isDefault: false,
    };
    const [editForm, setEditForm] = useState(emptyAddr);
    const [addForm, setAddForm] = useState(emptyAddr);
    const [specialRequest, setSpecialRequest] = useState("");
    const [shippingCharge, setShippingCharge] = useState(0);
    const [selectedCourier, setSelectedCourier] = useState(null);
    const [expectedEtaText, setExpectedEtaText] = useState("");
    const [shippingLoading, setShippingLoading] = useState(false);
    const [shippingError, setShippingError] = useState("");
    const [weight, setWeight] = useState(0);
    const [showLocalDeliveryModal, setShowLocalDeliveryModal] = useState(false);
    const [warnedPincode, setWarnedPincode] = useState(() => {
        // Initialize from localStorage to persist across page reloads
        return localStorage.getItem('warnedPincode') || null;
    });
    const [isLocalDelivery, setIsLocalDelivery] = useState(false);
    const [refreshedPin, setRefreshedPin] = useState(null);
    const [localRefreshPin, setLocalRefreshPin] = useState(null);
    const [localRefreshTick, setLocalRefreshTick] = useState(0);
    const [autoRefreshCount, setAutoRefreshCount] = useState(0);
    const navigate = useNavigate();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const me = await apiGet("/api/auth/me");
            const userId = me.data.user.id || me.data.user._id;
            const cartRes = await apiGet(`/api/cart/${userId}`);
            if (cartRes.data.success) {
                // Normalize server response to the local `cart` shape
                const data = cartRes.data;
                setCart({
                    cartItems: data.cartItems || [],
                    totalItems: data.totalItems ?? (data.cartItems ? data.cartItems.length : 0),
                    totalPrice: data.totalPrice ?? 0,
                });
            }
            const addrRes = await apiGet("/api/addresses");
            if (addrRes.data.success) {
                setAddresses(addrRes.data.addresses || []);
                if ((addrRes.data.addresses || []).length)
                    setSelectedAddressId((addrRes.data.addresses || [])[0]._id);
            }
        } catch (err) {
            console.error(err);
            toast.error("Please login to checkout");
            navigate("/login");
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Immediate local-delivery detection on address selection change (no async wait)
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
                localStorage.setItem('warnedPincode', pin);
            }
            // Trigger immediate refresh for Delhi pincodes
            if (localRefreshPin !== pin) {
                setLocalRefreshPin(pin);
                setAutoRefreshCount(0); // Reset counter for new pincode
                setRefreshedPin(pin + "_initial"); // Force immediate refresh
                setLocalRefreshTick((t) => t + 1);
                setTimeout(() => setLocalRefreshTick((t) => t + 1), 80);
            }
        } else {
            setIsLocalDelivery(false);
            setAutoRefreshCount(0);
        }
    }, [selectedAddressId, addresses, warnedPincode, localRefreshPin]);

    // Re-load cart data whenever the global cart-updated event fires (e.g., from CartSidebar changes)
    useEffect(() => {
        const handler = () => loadData();
        window.addEventListener("cart-updated", handler);
        return () => window.removeEventListener("cart-updated", handler);
    }, [loadData]);

    // Calculate subtotal before shipping calculation
    const clientSubtotal = (cart.cartItems || []).reduce((s, it) => {
        const price = Number(it.price || 0);
        const discount = Number(it.discount || 0) || 0;
        const discountedPrice = price * (1 - discount / 100);
        return s + discountedPrice * (it.quantity || 0);
    }, 0);

    // Calculate billed weight whenever cart changes
    useEffect(() => {
        // Local logic as per updated user requirements: 
        // 1 gms – 250 gms -> 0.5 kg
        // 251 gms – 750 gms -> 1.0 kg
        // 756 gms – 1.75 kgs -> 2.0 kg
        // 1.76 kgs – 2.75 kgs -> 3.0 kg

        const parseUnitToKg = (raw) => {
            if (!raw) return 0;
            const s = String(raw).toLowerCase();
            const compact = s.replace(/\s+/g, "");

            // Extract numerical value
            const numMatch = compact.match(/([0-9]*\.?[0-9]+)/);
            // Default to 1 if a unit is mentioned but no number (e.g., "kg", "gm")
            const val = numMatch ? Number(numMatch[1]) : 1;

            const unitToken = compact.replace(/[0-9.]/g, "");
            const UNIT_SYNONYMS = [
                { names: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"], factor: 1 },
                { names: ["g", "gm", "gms", "gram", "grams"], factor: 1 / 1000 },
            ];
            for (const u of UNIT_SYNONYMS) {
                if (u.names.some((name) => unitToken.includes(name))) {
                    return val * u.factor;
                }
            }
            // If we found a number but no unit, assume kg as default or 0 if it was truly NaN
            return numMatch ? val : 0;
        };

        const totalWeightKg = (cart.cartItems || []).reduce((sum, it) => {
            // Check multiple possible weight fields and convert to number
            const explicitWeight = Number(it?.weightKgPerUnit || it?.weight || it?.productWeight || 0);
            if (explicitWeight > 0) {
                return sum + explicitWeight * (it.quantity || 0);
            }

            // Fallback to parsing unit label
            const unitLabel = String(it?.unit || it?.variantLabel || it?.selectedVariant || "");
            const perUnitKg = parseUnitToKg(unitLabel);
            return sum + perUnitKg * (it.quantity || 0);
        }, 0) || 0;

        const billedWeight = calculateBilledWeight(totalWeightKg);
        setWeight(billedWeight);
    }, [cart.cartItems]);

    // Calculate shipping from backend based on selected address pincode (+20% buffered returned by API)
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

                // If pincode is in our FREE_SHIPPING_PINCODES set, bypass Shiprocket and set shipping to zero
                if (FREE_SHIPPING_PINCODES.has(pin)) {
                    setShippingCharge(0);
                    setShippingLoading(false);
                    setShippingError("");
                    setIsLocalDelivery(true);
                    if (warnedPincode !== pin) {
                        setShowLocalDeliveryModal(true);
                        setWarnedPincode(pin);
                    }
                    // Automatic second refresh for Delhi pincodes if not already done
                    if (autoRefreshCount === 0) {
                        setAutoRefreshCount(1);
                        // Trigger second refresh after a short delay
                        setTimeout(() => {
                            setRefreshedPin(pin + "_auto_refresh_2");
                            setAutoRefreshCount(2);
                        }, 100);
                    }
                    return;
                }

                // Otherwise call server's shipping-rate endpoint (Shiprocket) for non-local pincodes.
                // Call Shiprocket shipping-rates API utility
                const res = await getShippingRates(
                    SHIPROCKET_PICKUP_LOCATION_ID,
                    pin,
                    weight, // Use the state weight
                    clientSubtotal
                );

                if (res.success && res.data) {
                    const allRates =
                        res.data.available_courier_companies_vg ||
                        res.data.data?.available_courier_companies_vg ||
                        res.data.data?.available_courier_companies ||
                        [];
                    // Strict Air-Only filter: 
                    // 1. is_surface MUST be false/null
                    // 2. mode MUST be 1 (Air) or name MUST imply Air/Express
                    const airRates = (allRates || []).filter((c) => {
                        const isSurface = c?.is_surface === true || String(c?.courier_name).toLowerCase().includes("surface");
                        if (isSurface) return false;

                        const name = String(c.courier_name || "").toLowerCase();
                        const hasAirName = name.includes("air") || name.includes("express") || name.includes("speed post");
                        return Number(c?.mode) === 1 || hasAirName;
                    });

                    if (airRates.length === 0) {
                        setShippingError("Only surface couriers available for this route. Please try a different address.");
                        setShippingCharge(0);
                        setSelectedCourier(null);
                        return;
                    }

                    // Choose the fastest ETA (etd_hours, fallback to estimated_delivery_days), tie-break by lowest rate
                    const fastest = airRates.reduce((best, cur) => {
                        const bestEta = Number((best?.etd_hours ?? (best?.estimated_delivery_days != null ? Number(best.estimated_delivery_days) * 24 : undefined)))
                            || Number.POSITIVE_INFINITY;
                        const curEta = Number((cur?.etd_hours ?? (cur?.estimated_delivery_days != null ? Number(cur.estimated_delivery_days) * 24 : undefined)))
                            || Number.POSITIVE_INFINITY;
                        if (curEta < bestEta) return cur;
                        if (curEta > bestEta) return best;
                        return (Number(cur?.rate) < Number(best?.rate)) ? cur : best;
                    }, airRates[0]);

                    if (fastest) {
                        setShippingCharge(Math.ceil(Number(fastest.rate)));
                        setSelectedCourier(fastest);
                        setIsLocalDelivery(false);
                        const etaHours = Number(
                            fastest?.etd_hours ?? (fastest?.estimated_delivery_days != null ? Number(fastest.estimated_delivery_days) * 24 : NaN)
                        );
                        if (Number.isFinite(etaHours)) {
                            if (etaHours < 24) {
                                setExpectedEtaText("within 24 hours");
                            } else {
                                const days = Math.max(1, Math.round(etaHours / 24));
                                const dt = new Date();
                                dt.setDate(dt.getDate() + days);
                                setExpectedEtaText(`in ${days} day${days > 1 ? "s" : ""} (by ${dt.toLocaleDateString("en-IN")})`);
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
                    // Fallback to 0 or handle error
                    console.warn("No courier rates found for this pincode via Shiprocket");
                    setShippingCharge(0);
                    setExpectedEtaText("");
                    setIsLocalDelivery(false);
                    // Optional: setShippingError("Delivery not available for this pincode");
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
        // re-fetch when cart items change or address changes
    }, [selectedAddressId, addresses, cart.cartItems, clientSubtotal, weight, autoRefreshCount, refreshedPin]);

    const updateCartQuantity = async (itemOrId, newQuantity) => {
        if (newQuantity <= 0) return;
        try {
            const me = await apiGet("/api/auth/me");
            const userId = me.data.user.id || me.data.user._id;
            let productId = itemOrId;
            let unit, variantLabel;
            if (typeof itemOrId === "object" && itemOrId !== null) {
                productId = itemOrId._id || itemOrId.id || itemOrId.productId;
                unit = itemOrId.unit || itemOrId.variantLabel || undefined;
                variantLabel = itemOrId.variantLabel || undefined;
            }
            await apiPut("/api/cart/update", { userId, productId, unit, variantLabel, quantity: newQuantity });
            await loadData();
        } catch (err) {
            console.error(err);
            toast.error("Failed to update cart");
        }
    };

    const removeFromCart = async (itemOrId) => {
        try {
            const me = await apiGet("/api/auth/me");
            const userId = me.data.user.id || me.data.user._id;
            let productId = itemOrId;
            let unit, variantLabel;
            if (typeof itemOrId === "object" && itemOrId !== null) {
                productId = itemOrId._id || itemOrId.id || itemOrId.productId;
                unit = itemOrId.unit || itemOrId.variantLabel || undefined;
                variantLabel = itemOrId.variantLabel || undefined;
            }
            await apiDelete("/api/cart/remove", { data: { userId, productId, unit, variantLabel } });
            await loadData();
            toast.success("Item removed from cart");
        } catch (err) {
            console.error(err);
            toast.error("Failed to remove item");
        }
    };

    const handleClearCart = async () => {
        if (!confirm("Are you sure you want to clear the cart?")) return;
        try {
            const me = await apiGet("/api/auth/me");
            const userId = me.data.user.id || me.data.user._id;
            await apiDelete(`/api/cart/${userId}`);
            await loadData();
            toast.success("Cart cleared");
        } catch (err) {
            console.error(err);
            toast.error("Failed to clear cart");
        }
    };

    const handleSuccessModalClose = () => {
        setShowSuccessModal(false);
        setOrderDetails(null);
        navigate("/home");
    };

    const placeOrder = async () => {
        if (placingOrder) return; // Prevent multiple clicks

        try {
            setPlacingOrder(true);
            console.log("🛒 [FRONTEND] Starting placeOrder process...");

            const address = addresses.find((a) => a._id === selectedAddressId);
            if (!address) {
                toast.error("Please select a delivery address");
                return;
            }

            // Include per-item weight so backend can recompute billed weight reliably
            const orderItems = cart.cartItems.map((it) => {
                const unit = String(it.unit || it.variantLabel || "");
                const variantLabel = String(it.variantLabel || it.selectedVariantLabel || "");
                // Prefer explicit per-unit weight if present; otherwise parse from unit/variant label
                const parseUnitToKgLocal = (raw) => {
                    if (!raw) return 0;
                    const s = String(raw).toLowerCase();
                    const compact = s.replace(/\s+/g, "");
                    const numMatch = compact.match(/([0-9]*\.?[0-9]+)/);
                    const val = numMatch ? Number(numMatch[1]) : NaN;
                    if (isNaN(val)) return 0;
                    const unitToken = compact.replace(/[0-9.]/g, "");
                    const UNIT_SYNONYMS = [
                        { names: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"], factor: 1 },
                        { names: ["g", "gm", "gms", "gram", "grams"], factor: 1 / 1000 },
                    ];
                    for (const u of UNIT_SYNONYMS) {
                        if (u.names.some((name) => unitToken.includes(name))) {
                            return val * u.factor;
                        }
                    }
                    return 0;
                };
                const perUnitKg = (() => {
                    const explicit = Number(it?.weightKgPerUnit || it?.weight || it?.productWeight || 0);
                    if (explicit > 0) return explicit;
                    return parseUnitToKgLocal(unit || variantLabel);
                })();

                return {
                    name: it.name,
                    price: it.price,
                    quantity: it.quantity,
                    productId: it._id || it.id || it.productId,
                    unit,
                    variantLabel,
                    tax: Number(it.tax || 0),
                    discount: Number(it.discount || 0),
                    weight: perUnitKg, // per-unit weight in KG for backend recomputation
                };
            });

            // Use the client-side computed breakdown: subtotal(after discount), tax, shipping
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
                weight: weight,
                shiprocketFee: shippingFee, // Use correct field name for backend
                taxAmount,
                totalAmount: totalAmount,
                specialRequests: specialRequest,
                billedWeight: weight, // Added for explicit logging
            };

            console.log("📦 [FRONTEND] Order Data Prepared:", JSON.stringify(orderData, null, 2));
            console.log("ℹ️ [FRONTEND] Shiprocket order creation will be triggered by the backend AFTER successful payment.");

            // Only online payments supported: use Instamojo
            await handleInstamojoPayment(orderData);
        } catch (err) {
            console.error(err);
            toast.error("Failed to place order");
        } finally {
            setPlacingOrder(false);
        }
    };

    const handleInstamojoPayment = async (orderData) => {
        try {
            // Store order data in sessionStorage so PaymentSuccess component can access it
            const orderToStore = {
                ...orderData,
                orderId: `ORD-${Date.now()}`, // Generate a temporary order ID
                paymentMethod: "Online Payment",
            };
            sessionStorage.setItem("pendingOrderData", JSON.stringify(orderToStore));

            // Ask backend to create an Instamojo payment request and return the long payment URL
            console.log("📡 [FRONTEND] Calling /api/create-instamojo-payment...");
            const res = await apiPost("/api/create-instamojo-payment", { orderData });
            console.log("📥 [FRONTEND] Response from Backend:", res.data);

            if (res.data && res.data.success && res.data.payment_url) {
                console.log("✅ [FRONTEND] Payment URL received. Redirecting to:", res.data.payment_url);
                // Redirect user to Instamojo payment page
                // On success, Instamojo will redirect back to the success URL configured on their dashboard
                window.location.href = res.data.payment_url;
            } else {
                console.error("Instamojo create response:", res.data);
                toast.error(res.data.message || "Failed to initiate payment. Please try again.");
                setPlacingOrder(false);
                // Clear the stored order data on failure
                sessionStorage.removeItem("pendingOrderData");
            }
        } catch (err) {
            console.error("Instamojo payment error:", err);
            toast.error(err.message || "Failed to initiate payment. Please try again.");
            setPlacingOrder(false);
            // Clear the stored order data on failure
            sessionStorage.removeItem("pendingOrderData");
        }
    };

    const handleDeleteAddress = async (id) => {
        if (!confirm("Are you sure you want to delete this address?")) return;
        try {
            const res = await apiDelete(`/api/addresses/${id}`);
            if (res.data.success) {
                toast.success(res.data.message || "Address deleted successfully");
                setShowMenuFor(null);
                await loadData();
            } else {
                const msg = res?.data?.message || res?.data?.error || "Failed to delete address";
                toast.error(msg);
            }
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to delete address";
            toast.error(msg);
        }
    };

    const openEditModal = (addr) => {
        setEditingAddress(addr);
        setEditForm({
            title: addr.title || "",
            name: addr.name || "",
            phone: addr.phone || "",
            address: addr.address || "",
            city: addr.city || "",
            state: addr.state || "",
            pincode: addr.pincode || "",
            isDefault: !!addr.isDefault,
        });
        setShowMenuFor(null);
        setShowEditModal(true);
    };

    const handleUpdateAddress = async () => {
        if (!editingAddress) return;
        const allowedTitles = new Set(["home", "office", "other"]);
        const titleOk = allowedTitles.has(String(editForm.title || "").toLowerCase());
        const phoneDigits = String(editForm.phone || "").replace(/\D/g, "");
        const addressOk = String(editForm.address || "").trim().length >= 10;
        const cityOk = String(editForm.city || "").trim().length >= 3;
        const stateOk = String(editForm.state || "").trim().length >= 3;
        if (!editForm.name || !editForm.phone || !editForm.address || !editForm.city || !editForm.state || !editForm.pincode) {
            return toast.error("Please fill all required fields");
        }
        if (!titleOk) {
            return toast.error("Title must be Home, Office, or Other");
        }
        if (phoneDigits.length !== 10) {
            return toast.error("Phone must be exactly 10 digits");
        }
        if (!addressOk) {
            return toast.error("Address must be at least 10 characters");
        }
        if (!cityOk) {
            return toast.error("City must be at least 3 characters");
        }
        if (!stateOk) {
            return toast.error("State must be at least 3 characters");
        }
        try {
            const normalized = {
                ...editForm,
                title: String(editForm.title || "").trim(),
                phone: phoneDigits,
                address: String(editForm.address || "").trim(),
                city: String(editForm.city || "").trim(),
                state: String(editForm.state || "").trim(),
            };
            const res = await apiPut(
                `/api/addresses/${editingAddress._id}`,
                normalized
            );
            if (res.data.success) {
                const pinRaw = String(editForm.pincode || "").trim();
                const pin = pinRaw.replace(/\D/g, "").slice(0, 6);
                const isLocal = FREE_SHIPPING_PINCODES.has(pin);
                if (!isLocal) {
                    toast.success(res.data.message || "Address updated");
                }
                setShowEditModal(false);
                setEditingAddress(null);
                await loadData();

                if (editingAddress._id === selectedAddressId) {
                    setSelectedAddressId(null);
                    setTimeout(() => setSelectedAddressId(editingAddress._id), 0);
                }
                if (isLocal) {
                    setIsLocalDelivery(true);
                    if (warnedPincode !== pin) {
                        setShowLocalDeliveryModal(true);
                        setWarnedPincode(pin);
                    }
                    setShippingCharge(0);
                    setShippingLoading(false);
                    setShippingError("");
                    setExpectedEtaText("");
                }
            } else {
                const msg = res?.data?.message || res?.data?.error || "Failed to update address";
                toast.error(msg);
            }
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to update address";
            toast.error(msg);
        }
    };

    const openAddModal = () => {
        setAddForm(emptyAddr);
        setShowAddModal(true);
    };

    const handleAddAddress = async () => {
        const allowedTitles = new Set(["home", "office", "other"]);
        const titleOk = allowedTitles.has(String(addForm.title || "").toLowerCase());
        const phoneDigits = String(addForm.phone || "").replace(/\D/g, "");
        const addressOk = String(addForm.address || "").trim().length >= 10;
        const cityOk = String(addForm.city || "").trim().length >= 3;
        const stateOk = String(addForm.state || "").trim().length >= 3;
        if (!addForm.name || !addForm.phone || !addForm.address || !addForm.city || !addForm.state || !addForm.pincode) {
            return toast.error("Please fill all required fields");
        }
        if (!titleOk) {
            return toast.error("Title must be Home, Office, or Other");
        }
        if (phoneDigits.length !== 10) {
            return toast.error("Phone must be exactly 10 digits");
        }
        if (!addressOk) {
            return toast.error("Address must be at least 10 characters");
        }
        if (!cityOk) {
            return toast.error("City must be at least 3 characters");
        }
        if (!stateOk) {
            return toast.error("State must be at least 3 characters");
        }
        try {
            const normalized = {
                ...addForm,
                title: String(addForm.title || "").trim(),
                phone: phoneDigits,
                address: String(addForm.address || "").trim(),
                city: String(addForm.city || "").trim(),
                state: String(addForm.state || "").trim(),
            };
            const res = await apiPost("/api/addresses", normalized);
            if (res.data.success) {
                const pinRaw = String(normalized.pincode || res.data?.address?.pincode || "").trim();
                const pin = pinRaw.replace(/\D/g, "").slice(0, 6);
                const isLocal = FREE_SHIPPING_PINCODES.has(pin);
                if (!isLocal) {
                    toast.success(res.data.message || "Address added");
                }
                setShowAddModal(false);
                await loadData();
                const newId = res.data?.address?._id || res.data?.addressId;
                if (newId) {
                    setSelectedAddressId(null);
                    setTimeout(() => setSelectedAddressId(newId), 0);
                } else {
                    const prev = selectedAddressId;
                    setSelectedAddressId(null);
                    setTimeout(() => setSelectedAddressId(prev), 0);
                }
                if (isLocal) {
                    setIsLocalDelivery(true);
                    if (warnedPincode !== pin) {
                        setShowLocalDeliveryModal(true);
                        setWarnedPincode(pin);
                    }
                    setShippingCharge(0);
                    setShippingLoading(false);
                    setShippingError("");
                    setExpectedEtaText("");
                }
            } else {
                const msg = res?.data?.message || res?.data?.error || "Failed to add address";
                toast.error(msg);
            }
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to add address";
            toast.error(msg);
        }
    };

    if (loading)
        return (
            <div
                className="min-h-screen flex items-center justify-center"
                style={{ backgroundColor: "#FFF5F5" }}
            >
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-700">
                        Loading checkout...
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                        Please wait while we prepare your order
                    </div>
                </div>
            </div>
        );

    // Tax calculation
    const taxAmount = (cart.cartItems || []).reduce((s, it) => {
        const price = Number(it.price || 0);
        const discount = Number(it.discount || 0) || 0;
        const discountedPrice = price * (1 - discount / 100);
        const taxPercent = Number(it.tax || 0) || 0;
        return s + discountedPrice * (it.quantity || 0) * (taxPercent / 100);
    }, 0);

    const shippingFee = Number(shippingCharge || 0);
    const totalAmount = clientSubtotal + taxAmount + shippingFee;
    const savings = (cart.cartItems || []).reduce((s, it) => {
        const discount = Number(it.discount || 0);
        if (discount > 0) {
            const oldPrice = Number(it.price || 0) / (1 - discount / 100);
            return s + (oldPrice - Number(it.price || 0)) * (it.quantity || 0);
        }
        return s;
    }, 0);

    return (
        <div
            className="min-h-screen pb-36 pt-32"
            style={{ backgroundColor: "#FFF5F5" }}
        >
            {/* Header */}
            <div className="w-full max-w-4xl mx-auto px-4 pb-4">
                <div
                    className="rounded-2xl shadow-soft px-4 py-3 flex items-center gap-3"
                    style={{ backgroundColor: "#EE2225", border: "2px solid #C81416" }}
                >
                    <button
                        onClick={() => navigate("/home")}
                        className="p-2 rounded-full hover:bg-white/10"
                    >
                        <FaArrowLeft className="text-white" />
                    </button>
                    <h2 className="text-xl font-bold flex-1 text-center text-white">
                        Payment & Delivery
                    </h2>
                    <div className="w-8"></div>
                </div>
            </div>

            <div className="w-full max-w-4xl mx-auto px-4 pt-4">
                {/* Cart items summary card */}
                <div className="bg-white rounded-xl shadow p-4 border border-[#ffecec]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="text-red-500 text-xl">🛒</div>
                            <div>
                                <div className="font-semibold">
                                    Cart Items ({cart.totalItems || (cart.cartItems || []).length}
                                    )
                                </div>
                                <div className="text-sm text-gray-500">
                                    Review items before payment
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {(cart.cartItems || []).map((item) => (
                            <div
                                key={item._id || item.id || item.name}
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="w-16 h-16 rounded-lg bg-pink-50 flex items-center justify-center flex-shrink-0">
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                    ) : (
                                        <div className="text-pink-400 text-xl">🬬</div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="font-medium text-gray-800">
                                        {item.name} {item.unit ? (
                                            <span className="text-sm text-gray-500">({item.unit})</span>
                                        ) : null}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">
                                        ₹{Number(item.price || 0).toFixed(2)} each
                                        {item.unit ? (<><span> • {item.unit}</span></>) : null} ×{" "}
                                        {item.quantity || 1}
                                    </div>
                                    {item.originalPrice && item.originalPrice > item.price && (
                                        <div className="text-xs text-red-500 mt-1">
                                            Save ₹
                                            {(
                                                (item.originalPrice - item.price) *
                                                item.quantity
                                            ).toFixed(2)}
                                        </div>
                                    )}
                                    {/** Show per-item tax total if tax applies */}
                                    {Number(item.tax || 0) > 0 && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            Tax: ₹{(
                                                (Number(item.price || 0) * (1 - (Number(item.discount || 0) || 0) / 100)) *
                                                (item.quantity || 0) *
                                                (Number(item.tax || 0) / 100)
                                            ).toFixed(2)}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="font-medium text-lg">
                                        ₹
                                        {(Number(item.price || 0) * (item.quantity || 1)).toFixed(
                                            2
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Special Request Section */}
                    <div className="mt-4 pt-4 border-t">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Special Request (Optional)
                        </label>
                        <textarea
                            value={specialRequest}
                            onChange={(e) => setSpecialRequest(e.target.value)}
                            placeholder="Any special instructions for your order..."
                            className="w-full p-3 border rounded-lg text-sm resize-none"
                            rows="3"
                        />
                    </div>

                    {/* Cart Summary */}
                    <div className="mt-4 pt-4 border-t space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Subtotal ({(cart.cartItems || []).length} items)</span>
                            <span>₹{clientSubtotal.toFixed(2)}</span>
                        </div>
                        {taxAmount > 0 && (
                            <div className="flex justify-between text-sm">
                                <span>Tax</span>
                                <span>₹{taxAmount.toFixed(2)}</span>
                            </div>
                        )}
                        {shippingLoading && (
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Shipping Fee</span>
                                <span>Calculating...</span>
                            </div>
                        )}
                        {!shippingLoading && shippingError && (
                            <div className="flex justify-between text-sm text-red-600">
                                <span>Shipping Fee</span>
                                <span>{shippingError}</span>
                            </div>
                        )}
                        {!shippingLoading && !shippingError && shippingFee > 0 && (
                            <div className="flex justify-between text-sm">
                                <span>Shipping Fee</span>
                                <span>₹{shippingFee.toFixed(2)}</span>
                            </div>
                        )}
                        {!shippingLoading && !shippingError && expectedEtaText && (
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Expected Delivery</span>
                                <span>{expectedEtaText}</span>
                            </div>
                        )}
                        {!shippingLoading && !shippingError && shippingFee === 0 && (
                            <div className="flex justify-between text-sm font-bold text-red-600">
                                <span>Shipping Fee</span>
                                <span>Local Delivery Charges Payable at time of delivery, depending on distance.</span>
                            </div>
                        )}
                        {savings > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>You Save</span>
                                <span>-₹{savings.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm font-bold text-gray-600 pt-2 border-t">
                            <span>Total</span>
                            <span>₹{totalAmount.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Delivery address card */}
                <div className="mt-4 bg-white rounded-xl shadow p-4 border border-[#ffecec] relative">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <FaMapMarkerAlt className="text-red-500" />
                            <div className="font-semibold">Delivery Address</div>
                        </div>
                        {addresses.length > 0 && (
                            <button
                                onClick={openAddModal}
                                className="text-red-600 text-sm font-medium hover:bg-red-50 px-3 py-1 rounded"
                            >
                                Add New
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {(addresses || []).length === 0 && (
                            <div className="p-6 rounded-lg border border-dashed border-gray-200 text-center">
                                <FaMapMarkerAlt className="text-gray-300 text-2xl mx-auto mb-3" />
                                <div className="text-sm text-gray-500 mb-4">
                                    No saved addresses found
                                </div>
                                <button
                                    onClick={openAddModal}
                                    className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-2 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all active:scale-95 shadow-soft"
                                >
                                    Add Delivery Address
                                </button>
                            </div>
                        )}

                        {(addresses || []).map((addr) => (
                            <div
                                key={addr._id}
                                className={`p-4 rounded-lg border relative transition-all ${addr._id === selectedAddressId
                                    ? "border-red-300 bg-red-50 shadow-md"
                                    : "border-gray-200 hover:border-gray-300"
                                    }`}
                            >
                                <div className="absolute right-3 top-3">
                                    <button
                                        onClick={() =>
                                            setShowMenuFor(showMenuFor === addr._id ? null : addr._id)
                                        }
                                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                        aria-label="address menu"
                                    >
                                        <FaEllipsisV className="text-gray-400" />
                                    </button>
                                    {showMenuFor === addr._id && (
                                        <div className="absolute right-0 top-10 w-40 bg-white rounded-lg shadow-lg border py-2 z-10">
                                            <button
                                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left text-sm"
                                                onClick={() => openEditModal(addr)}
                                            >
                                                <FaEdit className="text-blue-500" />
                                                Edit
                                            </button>
                                            <button
                                                className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-gray-50 text-left text-sm"
                                                onClick={() => handleDeleteAddress(addr._id)}
                                            >
                                                <FaTrash className="text-red-500" />
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-start justify-between pr-10">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-medium">
                                                {addr.title || "Home"}
                                            </span>
                                            {addr.isDefault && (
                                                <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <div className="font-semibold text-gray-800 mb-1">
                                            {addr.name}
                                        </div>
                                        <div className="text-sm text-gray-600 mb-2">
                                            {addr.address}
                                            {addr.city && `, ${addr.city}`}
                                            {addr.state && `, ${addr.state}`} - {addr.pincode}
                                        </div>
                                        <div className="text-sm text-gray-500">📞 {addr.phone}</div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <input
                                            type="radio"
                                            name="deliveryAddress"
                                            checked={addr._id === selectedAddressId}
                                            onChange={() => setSelectedAddressId(addr._id)}
                                            className="w-4 h-4 text-red-600 focus:ring-red-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment method card */}

                <div className="mt-4 bg-white rounded-xl shadow p-4 border border-[#ffecec]">
                    <div className="font-semibold flex items-center gap-2 mb-4">
                        <FaCreditCard className="text-red-500" />
                        Payment Method
                    </div>
                    <div className="space-y-3">
                        <div className="block p-4 rounded-lg border border-blue-400 bg-blue-50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="text-blue-500 text-xl">💳</div>
                                    <div>
                                        <div className="font-semibold">Online Payment</div>
                                        <div className="text-sm text-gray-500">
                                            Pay securely with Instamojo
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded font-medium">
                                    Instamojo
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Order summary card */}
                <div className="mt-4 bg-white rounded-xl shadow p-4 border border-[#ffecec]">
                    <div className="font-semibold mb-4">Order Summary</div>
                    <div className="space-y-3 text-sm">
                        {savings > 0 && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Total Savings</span>
                                <span className="font-medium text-green-600">
                                    ₹{savings.toFixed(2)}
                                </span>
                            </div>
                        )}
                        <hr className="border-gray-200" />
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>₹{clientSubtotal.toFixed(2)}</span>
                        </div>
                        {taxAmount > 0 && (
                            <div className="flex justify-between">
                                <span>Tax</span>
                                <span>₹{taxAmount.toFixed(2)}</span>
                            </div>
                        )}
                        {shippingLoading && (
                            <div className="flex justify-between text-gray-500">
                                <span>Shipping Fee</span>
                                <span>Calculating...</span>
                            </div>
                        )}
                        {!shippingLoading && shippingError && (
                            <div className="flex justify-between text-red-600">
                                <span>Shipping Fee</span>
                                <span>{shippingError}</span>
                            </div>
                        )}
                        {!shippingLoading && !shippingError && shippingFee > 0 && (
                            <div className="flex justify-between">
                                <span>Shipping Fee</span>
                                <span>₹{shippingFee.toFixed(2)}</span>
                            </div>
                        )}
                        {!shippingLoading && !shippingError && shippingFee === 0 && (
                            <div className="flex justify-between font-bold text-red-600">
                                <span>Shipping Fee</span>
                                <span>Local Delivery Charges Payable at time of delivery, depending on distance.</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm font-bold text-gray-600">
                            <span>
                                Total Amount ({cart.totalItems || (cart.cartItems || []).length}{" "}
                                items)
                            </span>
                            <span>₹{totalAmount.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <Footer />
                </div>
            </div>

            <div
                className="fixed left-0 right-0 bottom-0 p-4 shadow-lg"
                style={{ backgroundColor: "#FFF5F5" }}
            >
                <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl p-4 shadow-lg">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-sm text-gray-500">Total Amount</div>
                            <div
                                className="text-xl font-bold"
                                style={{ color: "rgba(4, 4, 4, 1)" }}
                            >
                                ₹{totalAmount.toFixed(2)}
                            </div>
                            {savings > 0 && (
                                <div className="text-xs text-green-600 font-semibold">
                                    You saved ₹{savings.toFixed(2)}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={placeOrder}
                            disabled={
                                !selectedAddressId ||
                                (cart.cartItems || []).length === 0 ||
                                placingOrder ||
                                shippingLoading ||
                                !!shippingError
                            }
                            className="text-white px-8 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2 shadow-soft hover:shadow-card border-2"
                            style={{
                                backgroundColor: "rgb(238, 34, 37)",
                                borderColor: "rgb(200, 20, 22)",
                            }}
                        >
                            {placingOrder ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    {"Processing Payment..."}
                                </>
                            ) : (
                                "Place Order"
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Add Address Modal */}
            {/* Local Delivery Notice Modal */}
            {showLocalDeliveryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
                        <button
                            onClick={() => {
                                // Save the warned pincode to localStorage to prevent popup after reload
                                const addr = addresses.find((a) => a._id === selectedAddressId);
                                if (addr) {
                                    const pinRaw = (addr.pincode || "").toString().trim();
                                    const pin = pinRaw.replace(/\D/g, "").slice(0, 6);
                                    localStorage.setItem('warnedPincode', pin);
                                }
                                setShowLocalDeliveryModal(false);
                                // Reload the entire checkout page
                                window.location.reload();
                            }}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100"
                            aria-label="Close notice"
                        >
                            <FaTimes className="text-gray-500" />
                        </button>
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 text-xl">⚠️</div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-1">Local Delivery Charges Notice</h3>
                                <p className="text-sm text-gray-700">
                                    Delivery charges are payable at the time of delivery. This fee is not included in the total shown here.
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <button
                                onClick={() => {
                                    // Save the warned pincode to localStorage to prevent popup after reload
                                    const addr = addresses.find((a) => a._id === selectedAddressId);
                                    if (addr) {
                                        const pinRaw = (addr.pincode || "").toString().trim();
                                        const pin = pinRaw.replace(/\D/g, "").slice(0, 6);
                                        localStorage.setItem('warnedPincode', pin);
                                    }
                                    setShowLocalDeliveryModal(false);
                                    // Reload the entire checkout page
                                    window.location.reload();
                                }}
                                className="px-5 py-2 rounded-xl text-white font-semibold border-2 shadow-soft"
                                style={{ backgroundColor: "rgb(238, 34, 37)", borderColor: "rgb(200, 20, 22)" }}
                            >
                                I Understand
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Add New Address</h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-2 rounded-full hover:bg-gray-100"
                            >
                                <FaTimes className="text-gray-500" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <select
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                                value={addForm.title}
                                onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                            >
                                <option value="">Select Address Title</option>
                                <option value="Home">Home</option>
                                <option value="Office">Office</option>
                                <option value="Other">Other</option>
                            </select>
                            <input
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Full Name *"
                                value={addForm.name}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, name: e.target.value })
                                }
                                required
                            />
                            <input
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Phone Number *"
                                value={addForm.phone}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, phone: e.target.value })
                                }
                                required
                            />
                            <textarea
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                                placeholder="Complete Address *"
                                value={addForm.address}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, address: e.target.value })
                                }
                                rows="3"
                                required
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    className="p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    placeholder="City *"
                                    value={addForm.city}
                                    onChange={(e) =>
                                        setAddForm({ ...addForm, city: e.target.value })
                                    }
                                    required
                                />
                                <input
                                    className="p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    placeholder="State *"
                                    value={addForm.state}
                                    onChange={(e) =>
                                        setAddForm({ ...addForm, state: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <input
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Pincode *"
                                value={addForm.pincode}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, pincode: e.target.value })
                                }
                                required
                            />
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={addForm.isDefault}
                                    onChange={(e) =>
                                        setAddForm({ ...addForm, isDefault: e.target.checked })
                                    }
                                    className="w-4 h-4 text-red-600 focus:ring-red-500 rounded"
                                />
                                <span className="text-sm text-gray-600">
                                    Set as default address
                                </span>
                            </label>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddAddress}
                                className="px-6 py-2 rounded-xl text-white font-semibold transition-all active:scale-95 shadow-soft border-2"
                                style={{
                                    backgroundColor: "rgb(238, 34, 37)",
                                    borderColor: "rgb(200, 20, 22)",
                                }}
                            >
                                Add Address
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Address Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Edit Address</h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="p-2 rounded-full hover:bg-gray-100"
                            >
                                <FaTimes className="text-gray-500" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <select
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                                value={editForm.title}
                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            >
                                <option value="">Select Address Title</option>
                                <option value="Home">Home</option>
                                <option value="Office">Office</option>
                                <option value="Other">Other</option>
                            </select>
                            <input
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Full Name *"
                                value={editForm.name}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, name: e.target.value })
                                }
                                required
                            />
                            <input
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Phone Number *"
                                value={editForm.phone}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, phone: e.target.value })
                                }
                                required
                            />
                            <textarea
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                                placeholder="Complete Address *"
                                value={editForm.address}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, address: e.target.value })
                                }
                                rows="3"
                                required
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    className="p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    placeholder="City *"
                                    value={editForm.city}
                                    onChange={(e) =>
                                        setEditForm({ ...editForm, city: e.target.value })
                                    }
                                    required
                                />
                                <input
                                    className="p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    placeholder="State *"
                                    value={editForm.state}
                                    onChange={(e) =>
                                        setEditForm({ ...editForm, state: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <input
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Pincode *"
                                value={editForm.pincode}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, pincode: e.target.value })
                                }
                                required
                            />
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={editForm.isDefault}
                                    onChange={(e) =>
                                        setEditForm({ ...editForm, isDefault: e.target.checked })
                                    }
                                    className="w-4 h-4 text-red-600 focus:ring-red-500 rounded"
                                />
                                <span className="text-sm text-gray-600">
                                    Set as default address
                                </span>
                            </label>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateAddress}
                                className="px-6 py-2 rounded-xl text-white font-semibold transition-all active:scale-95 shadow-soft border-2"
                                style={{
                                    backgroundColor: "rgb(238, 34, 37)",
                                    borderColor: "rgb(200, 20, 22)",
                                }}
                            >
                                Update Address
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && orderDetails && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-auto relative shadow-2xl">
                        {/* Cancel/Close button */}
                        <button
                            onClick={handleSuccessModalClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <FaTimes className="text-gray-500 w-5 h-5" />
                        </button>

                        {/* Success Content */}
                        <div className="text-center pt-4">
                            {/* Success Icon */}
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg
                                    className="w-8 h-8 text-green-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M5 13l4 4L19 7"
                                    ></path>
                                </svg>
                            </div>

                            {/* Success Message */}
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                🎉 Order Placed Successfully!
                            </h2>

                            <p className="text-gray-600 mb-6">
                                Your order will be delivered soon
                            </p>

                            {/* Order Details */}
                            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Order ID:</span>
                                        <span className="font-mono text-sm font-semibold text-red-600">
                                            {orderDetails.orderId}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Total Amount:</span>
                                        <span className="font-bold text-gray-900">
                                            ₹{orderDetails.totalAmount?.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Payment Method:</span>
                                        <span className="text-gray-900">
                                            {orderDetails.paymentMethod}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Continue Shopping Button */}
                            <button
                                onClick={handleSuccessModalClose}
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
            )}
        </div>
    );
};

export default Checkout;