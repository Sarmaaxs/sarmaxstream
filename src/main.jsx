import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initSentry, Sentry } from '@/lib/sentry'

initSentry()

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<p style={{ padding: 24 }}>Something went wrong. Please reload the app.</p>}>
    <App />
  </Sentry.ErrorBoundary>
)
