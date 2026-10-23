import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getMe } from "../api/auth";
import {
  getCart,
  addToCart as addToCartApi,
  updateCart as updateCartApi,
  removeFromCart as removeFromCartApi,
  clearCart as clearCartApi,
  deleteCart as deleteCartApi,
} from "../api/cart";
import { useAuth } from "./AuthContext";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { userId: authUserId } = useAuth();
  const [cart, setCart] = useState({
    cartItems: [],
    totalItems: 0,
    totalPrice: 0,
  });
  const [loading, setLoading] = useState(false);

  const resolveUserId = useCallback(async () => {
    if (authUserId) return authUserId;
    const me = await getMe();
    if (!me.data?.success) return null;
    return me.data.user.id || me.data.user._id || null;
  }, [authUserId]);

  const fetchCart = useCallback(async () => {
    setLoading(true);
    try {
      if (!localStorage.getItem("token")) {
        throw new Error("guest");
      }
      const userId = await resolveUserId();
      if (!userId) throw new Error("not logged in");
      const res = await getCart(userId);
      if (res.data.success) {
        setCart(res.data);
      }
    } catch (err) {
      try {
        const raw = localStorage.getItem("guestCart");
        const items = raw ? JSON.parse(raw) : [];
        const totalItems = items.reduce((s, it) => s + (it.quantity || 0), 0);
        const totalPrice = items.reduce(
          (s, it) => s + Number(it.price || 0) * (it.quantity || 0),
          0
        );
        setCart({ cartItems: items, totalItems, totalPrice });
      } catch (_) {
        setCart({ cartItems: [], totalItems: 0, totalPrice: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [resolveUserId]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    const onCartUpdated = () => fetchCart();
    window.addEventListener("cart-updated", onCartUpdated);
    return () => window.removeEventListener("cart-updated", onCartUpdated);
  }, [fetchCart]);

  const addToCart = async (productOrId, quantity = 1) => {
    setLoading(true);
    try {
      const userId = await resolveUserId();
      if (userId) {
        const productId =
          typeof productOrId === "string"
            ? productOrId
            : productOrId._id || productOrId.id || productOrId.productId;
        const itemObj =
          typeof productOrId === "object" ? productOrId : { productId };
        const variantLabel =
          itemObj.selectedVariant || itemObj.variantLabel || "";
        const unit = itemObj.unit || variantLabel || "";
        const priceOverride = Number(itemObj.price || itemObj.cost || 0);
        const payload = {
          userId,
          productId,
          quantity,
          unit,
          variantLabel,
          priceOverride,
        };
        const res = await addToCartApi(payload);
        if (res.data.success) {
          await fetchCart();
          return true;
        }
        return false;
      }
      throw new Error("guest");
    } catch (err) {
      try {
        const raw = localStorage.getItem("guestCart");
        const items = raw ? JSON.parse(raw) : [];
        const productId =
          typeof productOrId === "string"
            ? productOrId
            : productOrId._id || productOrId.id || productOrId.productId;
        const itemObj =
          typeof productOrId === "object" ? productOrId : { productId };
        const selectedVariantLabel =
          itemObj.selectedVariant || itemObj.variantLabel || "";
        const unit = itemObj.unit || selectedVariantLabel || "";
        const price = Number(itemObj.price || itemObj.cost || 0);
        const maxQty =
          typeof itemObj.maxQty !== "undefined"
            ? Number(itemObj.maxQty)
            : itemObj.selectedVariant &&
                typeof itemObj.selectedVariant.quantity !== "undefined"
              ? Number(itemObj.selectedVariant.quantity)
              : undefined;
        const productKey = `${productId}__${unit}`;

        const existing = items.find((it) => it.productKey === productKey);
        if (existing) {
          existing.quantity = (existing.quantity || 0) + quantity;
        } else {
          const toSave = {
            productId,
            productKey,
            quantity,
            name: selectedVariantLabel
              ? `${itemObj.name || itemObj.title || ""} (${selectedVariantLabel})`
              : itemObj.name || itemObj.title || "",
            price,
            imageUrl:
              itemObj.imageUrl || (itemObj.images && itemObj.images[0]) || "",
            unit,
            selectedVariantLabel,
            maxQty,
          };
          items.push(toSave);
        }
        localStorage.setItem("guestCart", JSON.stringify(items));
        const totalItems = items.reduce((s, it) => s + (it.quantity || 0), 0);
        const totalPrice = items.reduce(
          (s, it) => s + Number(it.price || 0) * (it.quantity || 0),
          0
        );
        setCart({ cartItems: items, totalItems, totalPrice });
        return true;
      } catch (e) {
        return false;
      }
    } finally {
      setLoading(false);
    }
  };

  const updateQty = async (identifier, quantity) => {
    setLoading(true);
    try {
      const userId = await resolveUserId();
      if (userId) {
        let productId, unit, variantLabel;
        if (typeof identifier === "object" && identifier !== null) {
          productId = identifier.productId || identifier._id;
          unit = identifier.unit || identifier.variantLabel || undefined;
          variantLabel = identifier.variantLabel || undefined;
        } else {
          const key = String(identifier);
          const parts = key.split("__");
          productId = parts[0];
          unit = parts[1] || undefined;
        }
        await updateCartApi({
          userId,
          productId,
          unit,
          variantLabel,
          quantity,
        });
        await fetchCart();
        return true;
      }
      throw new Error("guest");
    } catch (err) {
      try {
        const raw = localStorage.getItem("guestCart");
        const items = raw ? JSON.parse(raw) : [];
        const key = String(identifier);
        const existing = items.find(
          (it) =>
            it.productKey === key ||
            String(it.productId) === key ||
            String(it._id) === key
        );
        if (!existing) return false;
        if (typeof existing.maxQty !== "undefined") {
          quantity = Math.max(
            1,
            Math.min(Number(quantity || 0), Number(existing.maxQty))
          );
        } else {
          quantity = Math.max(1, Number(quantity || 0));
        }
        existing.quantity = quantity;
        localStorage.setItem("guestCart", JSON.stringify(items));
        const totalItems = items.reduce((s, it) => s + (it.quantity || 0), 0);
        const totalPrice = items.reduce(
          (s, it) => s + Number(it.price || 0) * (it.quantity || 0),
          0
        );
        setCart({ cartItems: items, totalItems, totalPrice });
        return true;
      } catch (e) {
        return false;
      }
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (identifier) => {
    setLoading(true);
    try {
      const userId = await resolveUserId();
      if (userId) {
        let productId, unit, variantLabel;
        if (typeof identifier === "object" && identifier !== null) {
          productId = identifier.productId || identifier._id;
          unit = identifier.unit || identifier.variantLabel || undefined;
          variantLabel = identifier.variantLabel || undefined;
        } else {
          const key = String(identifier);
          const parts = key.split("__");
          productId = parts[0];
          unit = parts[1] || undefined;
        }
        await removeFromCartApi({ userId, productId, unit, variantLabel });
        await fetchCart();
        return true;
      }
      throw new Error("guest");
    } catch (err) {
      try {
        const raw = localStorage.getItem("guestCart");
        const items = raw ? JSON.parse(raw) : [];
        const key = String(identifier);
        const filtered = items.filter(
          (it) =>
            !(
              it.productKey === key ||
              String(it.productId) === key ||
              String(it._id) === key
            )
        );
        localStorage.setItem("guestCart", JSON.stringify(filtered));
        const totalItems = filtered.reduce((s, it) => s + (it.quantity || 0), 0);
        const totalPrice = filtered.reduce(
          (s, it) => s + Number(it.price || 0) * (it.quantity || 0),
          0
        );
        setCart({ cartItems: filtered, totalItems, totalPrice });
        return true;
      } catch (e) {
        return false;
      }
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    setLoading(true);
    try {
      const userId = await resolveUserId();
      if (userId) {
        try {
          await clearCartApi(userId);
        } catch (serverErr) {
          try {
            await deleteCartApi(userId);
          } catch (_) {
            console.warn("Could not clear cart from server");
          }
        }
        await fetchCart();
        return true;
      }
      throw new Error("guest");
    } catch (err) {
      try {
        localStorage.removeItem("guestCart");
        setCart({ cartItems: [], totalItems: 0, totalPrice: 0 });
        window.dispatchEvent(new Event("cart-updated"));
        return true;
      } catch (e) {
        console.error("Error clearing guest cart:", e);
        return false;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        fetchCart,
        addToCart,
        updateQty,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
