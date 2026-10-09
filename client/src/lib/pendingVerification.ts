const key = "keirio:pending-email-verification";
let pending = "";
const valid = (value: string | null): value is string => !!value && /^[a-f0-9]{64}$/.test(value);

export function capturePendingVerification() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("verifyEmailToken");
  if (valid(token)) {
    pending = token;
    try { sessionStorage.setItem(key, token); } catch { /* keep the token in this page's memory */ }
  }
  if (url.searchParams.has("verifyEmailToken")) {
    url.searchParams.delete("verifyEmailToken");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
  return pendingVerification();
}

export function pendingVerification() {
  try { const stored = sessionStorage.getItem(key); if (valid(stored)) pending = stored; }
  catch { /* in-memory fallback */ }
  return pending;
}

export function clearPendingVerification() {
  pending = "";
  try { sessionStorage.removeItem(key); } catch { /* in-memory token is cleared */ }
}

export function safeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next === "/invite" || next === "/account" || next === "/operations" ? next : "/app";
}
