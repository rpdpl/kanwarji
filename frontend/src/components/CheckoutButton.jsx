import React from "react";
import { useNavigate } from "react-router-dom";

export default function CheckoutButton({ children = "Proceed to Checkout", className, tokenKey = "token" }) {
  const navigate = useNavigate();

  const onClick = (e) => {
    const token = localStorage.getItem(tokenKey); // adjust if you use another storage/key
    if (token) {
      // already logged in -> go directly to checkout
      navigate("/checkout");
      return;
    }
    // Not logged in -> send to login with special source flag only used for this flow
    const redirect = encodeURIComponent("/checkout");
    const source = encodeURIComponent("checkout-proceed");
    navigate(`/login?redirect=${redirect}&source=${source}`);
  };

  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
