import React from "react";
import { useCart } from "../context/CartContext";
import { toast } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";
import { FaTimes, FaTrashAlt } from "react-icons/fa";

const CartSidebar = ({ isOpen, onClose }) => {
  const { cart, loading, updateQty, removeItem, clearCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // No longer require login to view or manage cart — guests can use a local cart.

  const totalItems =
    cart.totalItems ||
    (cart.cartItems || []).reduce((s, it) => s + (it.quantity || 0), 0);

  const subtotal = (cart.cartItems || []).reduce(
    (s, it) => s + Number(it.price || 0) * (it.quantity || 0),
    0
  );
  const totalSavings = (cart.cartItems || []).reduce((s, it) => {
    const discount = Number(it.discount || 0);
    if (discount > 0) {
      const oldPrice = Number(it.price || 0) / (1 - discount / 100);
      return s + (oldPrice - Number(it.price || 0)) * (it.quantity || 0);
    }
    return s;
  }, 0);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-1/2 bg-gradient-to-br from-warm-100 via-peach-200 to-warm-300 z-[70] shadow-2xl transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div
            className="p-4 shadow-soft"
            style={{
              backgroundColor: "#EE2225",
              borderBottom: "2px solid #C81416",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all active:scale-95"
                  aria-label="Close cart"
                >
                  <FaTimes className="text-white" size={20} />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-white">My Cart</h2>
                  <p className="text-sm text-white/80">
                    Kanwarji Fresh Products
                  </p>
                </div>
              </div>
              {(cart.cartItems || []).length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-white hover:bg-white/10 flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                >
                  <FaTrashAlt className="text-white" size={16} />
                  <span className="text-sm font-semibold">Clear Cart</span>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 pb-24">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full">
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
                <p className="text-neutral-600">Loading your cart...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center mb-6">
                  <h3 className="text-lg font-bold text-neutral-900">
                    Cart Items ({totalItems})
                  </h3>
                </div>

                <div className="space-y-4">
                  {(cart.cartItems || []).length === 0 && (
                    <div className="text-center py-16 bg-white rounded-2xl shadow-card">
                      <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                          className="w-10 h-10 text-neutral-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                          />
                        </svg>
                      </div>
                      <p className="text-neutral-600 text-lg font-semibold mb-2">
                        Your cart is empty
                      </p>
                      <p className="text-neutral-500 text-sm mb-6">
                        Add some products to get started
                      </p>
                      <button
                        onClick={() => {
                          onClose();
                          navigate("/home");
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all active:scale-95 shadow-soft"
                      >
                        Start Shopping
                      </button>
                    </div>
                  )}

                  {(cart.cartItems || []).map((it) => {
                    const discount = Number(it.discount || 0);
                    const unitPrice = Number(it.price || 0);
                    const oldPrice =
                      discount > 0 ? unitPrice / (1 - discount / 100) : null;
                    const itemTotal = unitPrice * (it.quantity || 0);
                    const itemSave = oldPrice
                      ? (oldPrice - unitPrice) * (it.quantity || 0)
                      : 0;

                    return (
                      <div
                        key={it.productId}
                        className="bg-white rounded-2xl p-4 shadow-card hover:shadow-elevated transition-shadow duration-300"
                      >
                        <div className="flex gap-3">
                          <div className="w-20 h-20 bg-neutral-50 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                            <img
                              src={it.imageUrl || "/placeholder.svg"}
                              alt={it.name}
                              className="w-full h-full object-contain p-2"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-neutral-900 mb-1 line-clamp-2">
                              {it.name}
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-base font-bold text-neutral-900">
                                ₹{unitPrice.toFixed(3)}
                              </div>
                              {oldPrice && (
                                <div className="text-xs text-neutral-400 line-through">
                                  ₹{oldPrice.toFixed(3)}
                                </div>
                              )}
                            </div>

                            {discount > 0 && (
                              <div className="inline-block bg-success-100 text-success-700 text-xs font-semibold px-2 py-0.5 rounded-lg mb-2">
                                {discount}% OFF
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    const ok = await updateQty(
                                      it.productId,
                                      Math.max(1, it.quantity - 1)
                                    );
                                    if (ok)
                                      window.dispatchEvent(
                                        new Event("cart-updated")
                                      );
                                  }}
                                  className="w-8 h-8 bg-neutral-100 hover:bg-neutral-200 rounded-lg flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50"
                                  disabled={it.quantity <= 1}
                                >
                                  <span className="text-base font-bold text-neutral-700">
                                    -
                                  </span>
                                </button>
                                <div className="px-3 py-1 bg-neutral-50 border border-neutral-200 rounded-lg font-semibold text-sm text-neutral-900">
                                  {it.quantity}
                                </div>
                                <button
                                  onClick={async () => {
                                    const ok = await updateQty(
                                      it.productId,
                                      it.quantity + 1
                                    );
                                    if (ok)
                                      window.dispatchEvent(
                                        new Event("cart-updated")
                                      );
                                  }}
                                  className="w-8 h-8 text-white rounded-lg flex items-center justify-center active:scale-95 shadow-soft border-2"
                                  style={{
                                    backgroundColor: "rgb(238, 34, 37)",
                                    borderColor: "rgb(200, 20, 22)",
                                  }}
                                >
                                  <span className="text-base font-bold">+</span>
                                </button>
                              </div>

                              <div className="text-right">
                                <div className="text-base font-bold text-neutral-900">
                                  ₹{itemTotal.toFixed(3)}
                                </div>
                                {itemSave > 0 && (
                                  <div className="text-xs text-success-600 font-semibold">
                                    Save ₹{itemSave.toFixed(3)}
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={async () => {
                                const ok = await removeItem(it.productId);
                                if (ok)
                                  window.dispatchEvent(
                                    new Event("cart-updated")
                                  );
                              }}
                              className="text-xs text-danger-600 hover:text-danger-700 font-semibold px-2 py-1 hover:bg-danger-50 rounded-lg transition-all mt-2"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(cart.cartItems || []).length > 0 && (
                  <div className="mt-6">
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Special Requests
                    </label>
                    <textarea
                      placeholder="Any special instructions for your order?"
                      className="w-full p-3 rounded-xl border border-neutral-300 bg-white shadow-soft focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all placeholder:text-neutral-400 resize-none text-sm"
                      rows={3}
                    />
                  </div>
                )}

                {(cart.cartItems || []).length > 0 && (
                  <div className="mt-6 bg-white border border-neutral-200 rounded-2xl p-5 shadow-card">
                    <h3 className="text-base font-bold text-neutral-900 mb-4">
                      Order Summary
                    </h3>
                    <div className="space-y-3">
                      {totalSavings > 0 && (
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-success-600 font-medium">
                            Total Savings
                          </div>
                          <div className="text-sm text-success-600 font-semibold">
                            ₹{totalSavings.toFixed(3)}
                          </div>
                        </div>
                      )}
                      <div className="border-t border-neutral-200 pt-3 flex justify-between items-center">
                        <div className="text-base font-bold text-neutral-900">
                          Total Amount ({totalItems} items)
                        </div>
                        <div
                          className="text-xl font-bold"
                          style={{ color: "rgb(238, 34, 37)" }}
                        >
                          ₹{subtotal.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sticky checkout bar */}
          {(cart.cartItems || []).length > 0 && !loading && (
            <div className="bg-white border-t border-neutral-200 shadow-elevated p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-neutral-500 font-medium">
                    Total Amount
                  </div>
                  <div
                    className="text-xl font-bold"
                    style={{ color: "rgb(238, 34, 37)" }}
                  >
                    ₹{subtotal.toFixed(3)}
                  </div>
                  {totalSavings > 0 && (
                    <div className="text-xs text-success-600 font-semibold">
                      You saved ₹{totalSavings.toFixed(3)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    onClose();
                    // Require login only at checkout time
                    if (localStorage.getItem("token")) {
                      navigate("/checkout");
                    } else {
                      try {
                        sessionStorage.setItem("redirectAfterLogin", "/checkout");
                      } catch (e) {}
                      toast.info("Please login to proceed to checkout");
                      navigate("/login");
                    }
                  }}
                  className="text-white px-6 py-3 rounded-xl font-semibold shadow-soft hover:shadow-md active:scale-95 transition-all border-2"
                  style={{
                    backgroundColor: "rgb(238, 34, 37)",
                    borderColor: "rgb(200, 20, 22)",
                  }}
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CartSidebar;
