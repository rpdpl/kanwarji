// src/App.jsx
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider } from "./context/AuthContext";
import { ProductCacheProvider } from "./context/ProductCacheContext";
import { CartProvider } from "./context/CartContext";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <Router>
      <AuthProvider>
        <ProductCacheProvider>
          <CartProvider>
            <AppRoutes />
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
      </AuthProvider>
    </Router>
  );
}

export default App;
