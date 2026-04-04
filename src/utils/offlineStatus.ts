export type OfflineStatus = 'unsupported' | 'preparing' | 'ready'

const OFFLINE_STATUS_EVENT = 'paperknife:offline-status'
const OFFLINE_READY_STORAGE_KEY = 'paperknife:offline-ready'

export const getInitialOfflineStatus = (): OfflineStatus => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator)) return 'unsupported'
  return window.localStorage.getItem(OFFLINE_READY_STORAGE_KEY) === 'true' ? 'ready' : 'preparing'
}

export const setOfflineStatus = (status: OfflineStatus) => {
  if (typeof window === 'undefined') return

  if (status === 'ready') {
    window.localStorage.setItem(OFFLINE_READY_STORAGE_KEY, 'true')
  }

  window.dispatchEvent(
    new CustomEvent<{ status: OfflineStatus }>(OFFLINE_STATUS_EVENT, {
      detail: { status }
    })
  )
}

export const subscribeOfflineStatus = (listener: (status: OfflineStatus) => void) => {
  if (typeof window === 'undefined') return () => {}

  const handleStatusChange = (event: Event) => {
    const customEvent = event as CustomEvent<{ status: OfflineStatus }>
    listener(customEvent.detail.status)
  }

  window.addEventListener(OFFLINE_STATUS_EVENT, handleStatusChange as EventListener)
  return () => {
    window.removeEventListener(OFFLINE_STATUS_EVENT, handleStatusChange as EventListener)
  }
}
