import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'
import { warmOfflineBundles } from './utils/offlineWarmup'
import { getInitialOfflineStatus, setOfflineStatus } from './utils/offlineStatus'

// Bug Sniffer: Show errors on Android screen (skip on web to avoid console noise)
const isNativePlatform =
  typeof (window as any).Capacitor?.isNativePlatform === 'function'
  && (window as any).Capacitor.isNativePlatform()

if (isNativePlatform) {
  window.onerror = function(msg, _url, line, _col, error) {
    alert("ERROR: " + msg + "\nLine: " + line + "\n" + error);
    return false;
  };
}

if (!isNativePlatform && 'serviceWorker' in navigator) {
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
