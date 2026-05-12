import { setOfflineStatus } from './offlineStatus'

const warmupImports: Array<() => Promise<unknown>> = [
  () => import('../components/PdfPreview'),
  () => import('../components/tools/MergeTool'),
  () => import('../components/tools/SplitTool'),
  () => import('../components/tools/CompressTool'),
  () => import('../components/tools/ProtectTool'),
  () => import('../components/tools/UnlockTool'),
  () => import('../components/tools/RotateTool'),
  () => import('../components/tools/CropTool'),
  () => import('../components/tools/RearrangeTool'),
  () => import('../components/tools/PageNumberTool'),
  () => import('../components/tools/WatermarkTool'),
  () => import('../components/tools/MetadataTool'),
  () => import('../components/tools/SignatureTool'),
  () => import('../components/tools/PdfToImageTool'),
  () => import('../components/tools/ImageToPdfTool'),
  () => import('../components/tools/ExtractImagesTool'),
  () => import('../components/tools/GrayscaleTool'),
  () => import('../components/tools/RepairTool'),
  () => import('../components/tools/PdfToTextTool')
]

let warmupStarted = false

const scheduleWhenIdle = (callback: () => void) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => callback(), { timeout: 4000 })
    return
  }

  globalThis.setTimeout(callback, 1200)
}

export const warmOfflineBundles = () => {
  if (warmupStarted || typeof window === 'undefined' || !navigator.onLine) return

  warmupStarted = true
  const queue = [...warmupImports]
  const total = queue.length
  let completed = 0
  setOfflineStatus('preparing', { completed, total, label: 'Loading app bundles' })

  const runNext = () => {
    const next = queue.shift()
    if (!next) {
      // Warmup completion is our reliable signal that the current build's
      // chunks are now cached. onOfflineReady from registerSW only fires on
      // first install, so we cannot rely on it for build-to-build updates.
      setOfflineStatus('ready', { completed: total, total, label: 'Offline cache ready' })
      return
    }

    void next()
      .catch(() => undefined)
      .finally(() => {
        completed += 1
        setOfflineStatus('preparing', { completed, total, label: 'Loading app bundles' })
        globalThis.setTimeout(runNext, 150)
      })
  }

  scheduleWhenIdle(runNext)
}
