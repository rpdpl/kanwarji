import { apiGet, apiPost, apiPut } from "../utils/axiosInstance";

export const getMe = () => apiGet("/api/auth/me");

export const login = (data) => apiPost("/api/auth/login", data);

export const signup = (data) => apiPost("/api/auth/signup", data);

export const verifyOtp = (data) => apiPost("/api/auth/verify-otp", data);

export const updateUserInfo = (data) => apiPut("/api/user/update-info", data);
