import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { applyPrefs } from '@/lib/prefs'

applyPrefs() // saved accent color, text size and motion setting, before first paint

// Tiny error screen (so the big Sentry library is NOT needed to start the app).
class ErrorBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) {
    import('@/lib/sentry').then((m) => m.Sentry.captureException(error)).catch(() => {})
  }
  render() {
    if (this.state.failed) return <p style={{ padding: 24 }}>Something went wrong. Please reload the app.</p>
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

// Load error monitoring AFTER the page is already usable.
if (import.meta.env.VITE_SENTRY_DSN) {
  const start = () => import('@/lib/sentry').then((m) => m.initSentry()).catch(() => {})
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 4000 })
  else setTimeout(start, 2000)
}
