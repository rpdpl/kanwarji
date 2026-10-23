// import axios from "axios";

import axios from "axios";
import { toast } from "react-toastify";

// creating an axios instance
const getBaseURL = () => {
  // Check if we're in production and VITE_API_URL is not set
  if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
    return 'https://kanwarji.in/api';
  }
  // Use the environment variable or fallback to localhost for development
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

const axiosInstance = axios.create({
  baseURL: getBaseURL(),
});

// interceptor to attach the jwt token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// interceptor to handle jwt token errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    // Public endpoints that don't require authentication
    const publicEndpoints = [
      "/api/admin-items",
      "/api/items",
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/verify-otp",
      "/api/reset-password",
      "/api/auth/send-reset-otp",
    ];

    const isPublicEndpoint = publicEndpoints.some((endpoint) =>
      url.includes(endpoint)
    );

    if (status === 401 && !isPublicEndpoint) {
      // Only redirect if user had a token (session expired)
      const hadToken = localStorage.getItem("token");

      if (hadToken) {
        console.warn("Session expired. Please login again.");
        toast.warning("Your session has expired. Please login again.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
      }
    }

    // if (status === 403) {
    //   console.warn("Access denied.");
    // }

    return Promise.reject(error);
  }
);

// export the get, post, put, patch, delete methods
export const apiGet = (url, config = {}) => axiosInstance.get(url, config);
export const apiPost = (url, data, config = {}) =>
  axiosInstance.post(url, data, config);
export const apiPut = (url, data, config = {}) =>
  axiosInstance.put(url, data, config);
export const apiPatch = (url, data, config = {}) =>
  axiosInstance.patch(url, data, config);
export const apiDelete = (url, config = {}) =>
  axiosInstance.delete(url, config);

export default axiosInstance;
