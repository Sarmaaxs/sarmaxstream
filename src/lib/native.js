// True when the site is running inside the Android app (Capacitor shell).
// The shell adds "SarmaxstreamApp" to the user agent, so this works even when
// the app loads the live website.
export const isNative =
  typeof window !== 'undefined' &&
  (!!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
    /SarmaxstreamApp/.test((typeof navigator !== 'undefined' && navigator.userAgent) || ''));
