const warmupImports: Array<() => Promise<unknown>> = [
  () => import('../components/PdfPreview'),
  () => import('../components/tools/MergeTool'),
  () => import('../components/tools/SplitTool'),
  () => import('../components/tools/CompressTool'),
  () => import('../components/tools/ProtectTool'),
  () => import('../components/tools/UnlockTool'),
  () => import('../components/tools/RotateTool'),
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

  const runNext = () => {
    const next = queue.shift()
    if (!next) return

    void next()
      .catch(() => undefined)
      .finally(() => {
        globalThis.setTimeout(runNext, 150)
      })
  }

  scheduleWhenIdle(runNext)
}
