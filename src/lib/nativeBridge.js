// Android app only. The native side exposes its bridge as `SxRaw` and every call needs a
// per-launch token that only our own pages receive. This wrapper re-creates the old
// `window.SxNative` API for our code, so video iframes (which also see `SxRaw`) cannot use it.
(function installNativeBridge() {
  if (typeof window === 'undefined') return;
  const raw = window.SxRaw;
  if (!raw) return; // website, or an old app build that still exposes SxNative directly
  const names = ['keepScreenOn', 'setMedia', 'setPlaying', 'beginFile', 'appendFile', 'endFile', 'setAppLock', 'isAppLockEnabled', 'share'];
  const api = {};
  names.forEach((n) => {
    api[n] = (...args) => raw[n](window.__sxTok, ...args);
  });
  window.SxNative = api;
  try { delete window.SxRaw; } catch { /* some WebViews make it read-only: harmless */ }
})();
