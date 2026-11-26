// True only inside the Android WebView that exposes the SarmaxStream bridge.
// Guard the access so the same bundle works on the normal website and during SSR.
export const isNative =
  typeof window !== 'undefined' &&
  typeof window.SxNative === 'object' &&
  window.SxNative !== null;
