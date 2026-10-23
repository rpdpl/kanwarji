import React, { Suspense, lazy } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import AppLayout from "./AppLayout";
import RequireAuth from "./RequireAuth";
import Login from "../components/Login";
import ResetPassword from "../components/ResetPassword";
import Register from "../components/Register";
import HomePage from "../components/HomePage";
import ProductDetails from "../components/ProductDetails";
import PaymentSuccess from "../components/PaymentSuccess";
import Categories from "../components/Categories";
import Discount from "../components/Discount";
import AboutUs from "../components/AboutUs";
import ContactUs from "../components/ContactUs";
import PrivacyPolicy from "../components/PrivacyPolicy";
import TermsOfService from "../components/TermsOfService";
import ShippingPolicy from "../components/ShippingPolicy";
import RefundPolicy from "../components/RefundPolicy";

const Checkout = lazy(() => import("../components/Checkout"));
const Profile = lazy(() => import("../components/Profile"));

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center text-gray-600">
    Loading...
  </div>
);

export default function AppRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/signup" element={<Register />} />
          <Route path="/home" element={<HomePage />} />
          <Route
            path="/product/:id"
            element={<ProductDetails key={location.pathname} />}
          />
          <Route
            path="/checkout"
            element={
              <RequireAuth>
                <Checkout />
              </RequireAuth>
            }
          />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route path="/categories" element={<Categories />} />
          <Route path="/discount" element={<Discount />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
