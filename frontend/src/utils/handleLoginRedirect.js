export function handleLoginRedirect(afterLoginNavigate = (path) => (window.location.href = path)) {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  if (redirect) {
    try {
      const decoded = decodeURIComponent(redirect);
      // small safety: only allow internal redirects
      if (decoded.startsWith("/")) {
        afterLoginNavigate(decoded);
        return;
      }
    } catch (e) {
      // ignore invalid redirect
    }
  }
  // default fallback after login
  afterLoginNavigate("/checkout"); // or "/" if you prefer home
}

export function handleLoginRedirect(navigateFn) {
  // navigateFn is typically react-router's navigate
  try {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    const source = params.get("source");
    if (!redirect || !source) return false; // nothing to do

    // Only redirect automatically when the login was initiated from the checkout button
    if (source === "checkout-proceed") {
      // Safety: only allow internal paths
      const decoded = decodeURIComponent(redirect);
      if (decoded && decoded.startsWith("/")) {
        if (typeof navigateFn === "function") navigateFn(decoded);
        else window.location.href = decoded;
        return true;
      }
    }
  } catch (e) {
    // ignore malformed params
  }
  return false;
}
