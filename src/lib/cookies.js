// Small cookie helpers (no library needed).
export function getCookie(name) {
  try {
    const m = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
  } catch { return null; }
}

export function setCookie(name, value, days = 365) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.round(days * 86400)}; Path=/; SameSite=Lax${secure}`;
  } catch { /* ignore */ }
}

export function deleteCookie(name) {
  try { document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`; } catch { /* ignore */ }
}
