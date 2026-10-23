import { apiGet, apiPost } from "../utils/axiosInstance";

export const getUserOrders = (config = {}) =>
  apiGet("/api/user/orders", config);

export const getOrder = (orderId) => apiGet(`/api/orders/${orderId}`);

export const createInstamojoPayment = (orderData) =>
  apiPost("/api/create-instamojo-payment", { orderData });

export const requestCancellation = (orderId, data) =>
  apiPost(`/api/orders/${orderId}/request-cancellation`, data);

export const getCancellationRequests = (config = {}) =>
  apiGet("/api/user/cancellation-requests", config);
