export type OfflineStatus = 'unsupported' | 'preparing' | 'updating' | 'ready'
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

const storedMark = () => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(OFFLINE_READY_STORAGE_KEY)
}

const isReadyForThisBuild = () => storedMark() === __BUILD_ID__

export const getInitialOfflineStatus = (): OfflineStatus => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator)) return 'unsupported'
  if (isReadyForThisBuild()) return 'ready'
  // Pre-existing offline cache (any prior value, including legacy 'true') means
  // the user already has working offline access — we are just refreshing it.
  if (storedMark() !== null) return 'updating'
  return 'preparing'
}

export const getInitialOfflineProgress = (): OfflineProgress => {
  const status = getInitialOfflineStatus()
  if (status === 'unsupported') return { status, completed: 0, total: 0, label: 'Offline cache unsupported' }
  if (status === 'ready') return readyProgress
  if (status === 'updating') return { status, completed: 0, total: 0, label: 'Updating offline pack' }
  return { status, completed: 0, total: 0, label: 'Starting offline cache' }
}

export const setOfflineStatus = (status: OfflineStatus, progress: Partial<Omit<OfflineProgress, 'status'>> = {}) => {
  if (typeof window === 'undefined') return

  // Soft transition: when warmup says 'preparing' but the user already had a prior
  // offline cache for an older build, surface this as an 'updating' state instead.
  if (status === 'preparing' && !isReadyForThisBuild() && storedMark() !== null) {
    status = 'updating'
  }

  // Already cached for this build — anything trying to revert stays as ready.
  if ((status === 'preparing' || status === 'updating') && isReadyForThisBuild()) {
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
