import { apiGet, apiPost, apiPut, apiDelete } from "../utils/axiosInstance";

export const getAddresses = () => apiGet("/api/addresses");

export const createAddress = (data) => apiPost("/api/addresses", data);

export const updateAddress = (id, data) => apiPut(`/api/addresses/${id}`, data);

export const deleteAddress = (id) => apiDelete(`/api/addresses/${id}`);
