import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'
import { warmOfflineBundles } from './utils/offlineWarmup'
import { getInitialOfflineStatus, setOfflineStatus } from './utils/offlineStatus'

const SERVICE_WORKER_UPDATE_INTERVAL_MS = 30 * 60 * 1000

const installServiceWorkerUpdateChecks = (registration: ServiceWorkerRegistration) => {
  const checkForUpdate = () => {
    if (!navigator.onLine) return
    void registration.update().catch((error) => {
      console.warn('Service worker update check failed:', error)
    })
  }

  const checkWhenVisible = () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  }

  checkForUpdate()
  window.addEventListener('focus', checkForUpdate)
  window.addEventListener('online', checkForUpdate)
  document.addEventListener('visibilitychange', checkWhenVisible)
  window.setInterval(checkForUpdate, SERVICE_WORKER_UPDATE_INTERVAL_MS)
}

if ('serviceWorker' in navigator) {
  setOfflineStatus(getInitialOfflineStatus())

  registerSW({
    immediate: true,
    onOfflineReady() {
      setOfflineStatus('ready')
    },
    onRegisteredSW(_swScriptUrl, registration) {
      if (registration) installServiceWorkerUpdateChecks(registration)
    }
  })
  window.addEventListener('load', () => {
    warmOfflineBundles()
  }, { once: true })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
