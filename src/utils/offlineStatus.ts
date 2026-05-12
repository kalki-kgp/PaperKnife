export type OfflineStatus = 'unsupported' | 'preparing' | 'ready'
export interface OfflineProgress {
  status: OfflineStatus
  completed: number
  total: number
  label?: string
}

const OFFLINE_STATUS_EVENT = 'paperknife:offline-status'
const OFFLINE_READY_STORAGE_KEY = 'paperknife:offline-ready'

const readyProgress: OfflineProgress = {
  status: 'ready',
  completed: 1,
  total: 1,
  label: 'Offline cache ready'
}

const isReadyForThisBuild = () => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(OFFLINE_READY_STORAGE_KEY) === __BUILD_ID__
}

export const getInitialOfflineStatus = (): OfflineStatus => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator)) return 'unsupported'
  return isReadyForThisBuild() ? 'ready' : 'preparing'
}

export const getInitialOfflineProgress = (): OfflineProgress => {
  const status = getInitialOfflineStatus()
  if (status === 'unsupported') return { status, completed: 0, total: 0, label: 'Offline cache unsupported' }
  if (status === 'ready') return readyProgress
  return { status, completed: 0, total: 0, label: 'Starting offline cache' }
}

export const setOfflineStatus = (status: OfflineStatus, progress: Partial<Omit<OfflineProgress, 'status'>> = {}) => {
  if (typeof window === 'undefined') return

  if (status === 'preparing' && isReadyForThisBuild()) {
    status = 'ready'
    progress = readyProgress
  }

  if (status === 'ready') {
    window.localStorage.setItem(OFFLINE_READY_STORAGE_KEY, __BUILD_ID__)
  }

  const detail: OfflineProgress = status === 'ready'
    ? { ...readyProgress, ...progress, status }
    : {
        status,
        completed: progress.completed ?? 0,
        total: progress.total ?? 0,
        label: progress.label
      }

  window.dispatchEvent(
    new CustomEvent<OfflineProgress>(OFFLINE_STATUS_EVENT, {
      detail
    })
  )
}

export const subscribeOfflineStatus = (listener: (progress: OfflineProgress) => void) => {
  if (typeof window === 'undefined') return () => {}

  const handleStatusChange = (event: Event) => {
    const customEvent = event as CustomEvent<OfflineProgress>
    listener(customEvent.detail)
  }

  window.addEventListener(OFFLINE_STATUS_EVENT, handleStatusChange as EventListener)
  return () => {
    window.removeEventListener(OFFLINE_STATUS_EVENT, handleStatusChange as EventListener)
  }
}
