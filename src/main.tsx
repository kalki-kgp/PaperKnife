import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'
import { warmOfflineBundles } from './utils/offlineWarmup'
import { getInitialOfflineStatus, setOfflineStatus } from './utils/offlineStatus'

if ('serviceWorker' in navigator) {
  setOfflineStatus(getInitialOfflineStatus())

  registerSW({
    immediate: true,
    onOfflineReady() {
      setOfflineStatus('ready')
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
