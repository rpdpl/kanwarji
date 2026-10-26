import { apiGet, apiPost, apiPut, apiDelete } from "../utils/axiosInstance";

export const getCart = (userId) => apiGet(`/api/cart/${userId}`);

export const addToCart = (payload) => apiPost("/api/cart/add", payload);

export const updateCart = (payload) => apiPut("/api/cart/update", payload);

export const removeFromCart = (payload) =>
  apiDelete("/api/cart/remove", { data: payload });

export const clearCart = (userId) => apiDelete(`/api/cart/clear/${userId}`);

/** Same as clearCart — backend has DELETE /api/cart/clear/:userId (not DELETE /api/cart/:userId). */
export const deleteCart = (userId) => apiDelete(`/api/cart/clear/${userId}`);
