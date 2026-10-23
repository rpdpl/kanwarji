// src/App.jsx
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Login from "./components/Login";
import ResetPassword from "./components/ResetPassword";
import Register from "./components/Register";
import HomePage from "./components/HomePage";
import NavBar from "./components/NavBar";
import BottomNav from "./components/BottomNav";
import ProductDetails from "./components/ProductDetails";
import Cart from "./components/Cart";
import Checkout from "./components/Checkout";
import PaymentSuccess from "./components/PaymentSuccess";
import Profile from "./components/Profile";
import Categories from "./components/Categories";
import Discount from "./components/Discount";
import AboutUs from "./components/AboutUs";
import ContactUs from "./components/ContactUs";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfService from "./components/TermsOfService";
import ShippingPolicy from "./components/ShippingPolicy";
import RefundPolicy from "./components/RefundPolicy";
import { ProductCacheProvider } from "./context/ProductCacheContext";
import { CartProvider } from "./context/CartContext";

const AppWrapper = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Handle redirect from 404.html
  useEffect(() => {
    const redirectPath = sessionStorage.getItem("redirectPath");
    if (redirectPath && redirectPath !== "/") {
      sessionStorage.removeItem("redirectPath");
      navigate(redirectPath, { replace: true });
    }
  }, [navigate]);

  // hide nav on auth pages (login, signup, reset) — exact matches
  const exactHide = new Set(["/login", "/reset-password", "/signup"]);
  const hideNav = exactHide.has(location.pathname);

  // hide bottom nav on specific pages including product details
  const hideBottomNavPages = new Set(["/login", "/reset-password", "/signup"]);
  const hideBottomNav =
    hideBottomNavPages.has(location.pathname) ||
    location.pathname.startsWith("/product/") ||
    location.pathname === "/checkout"; // hide bottom nav on checkout page

  return (
    <>
      {!hideNav && (
        <>
          <NavBar />
          {/* Spacer to offset fixed header height (uses measured CSS var with fallback) */}
          <div aria-hidden style={{ height: "var(--header-offset, 168px)" }} />
        </>
      )}

      <div>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/signup" element={<Register />} />
          <Route path="/home" element={<HomePage />} />
          <Route
            path="/product/:id"
            element={<ProductDetails key={location.pathname} />}
          />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/discount" element={<Discount />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
        </Routes>
      </div>

      {!hideBottomNav && <BottomNav />}
    </>
  );
};

function App() {
  return (
    <Router>
      <ProductCacheProvider>
        <CartProvider>
          <AppWrapper />
          <ToastContainer
            position="top-center"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </CartProvider>
      </ProductCacheProvider>
    </Router>
  );
}

export default App;
