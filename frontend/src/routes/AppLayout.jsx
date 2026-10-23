import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import BottomNav from "../components/BottomNav";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const redirectPath = sessionStorage.getItem("redirectPath");
    if (redirectPath && redirectPath !== "/") {
      sessionStorage.removeItem("redirectPath");
      navigate(redirectPath, { replace: true });
    }
  }, [navigate]);

  const exactHide = new Set(["/login", "/reset-password", "/signup"]);
  const hideNav = exactHide.has(location.pathname);

  const hideBottomNavPages = new Set(["/login", "/reset-password", "/signup"]);
  const hideBottomNav =
    hideBottomNavPages.has(location.pathname) ||
    location.pathname.startsWith("/product/") ||
    location.pathname === "/checkout";

  return (
    <>
      {!hideNav && (
        <>
          <NavBar />
          <div aria-hidden style={{ height: "var(--header-offset, 168px)" }} />
        </>
      )}

      <div>
        <Outlet />
      </div>

      {!hideBottomNav && <BottomNav />}
    </>
  );
}
