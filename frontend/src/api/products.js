import { apiGet } from "../utils/axiosInstance";

export const getAdminItems = (params = {}) => {
  const search = new URLSearchParams();
  const limit = params.limit ?? 200;
  search.set("limit", String(limit));
  if (params.status) search.set("status", params.status);
  return apiGet(`/api/admin-items?${search.toString()}`);
};

export const getCategories = () => apiGet("/api/categories");

export const getDiscountProducts = () =>
  apiGet("/api/admin-products/with-discount");
