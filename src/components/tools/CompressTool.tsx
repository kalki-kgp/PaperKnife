import { useState, useRef, useEffect, useMemo } from 'react'
import { Zap, Loader2, Plus, X, FileIcon, Download, ChevronLeft, ChevronRight, Maximize2, ArrowRight, TrendingDown, TrendingUp, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { Capacitor } from '@capacitor/core'

import { getPdfMetaData, loadPdfDocument, renderPageThumbnail, unlockPdf, downloadFile } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import { usePipeline } from '../../utils/pipelineContext'
import { useObjectURL } from '../../utils/useObjectURL'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'
import ToolSeoContent from './shared/ToolSeoContent'
import { NativeToolLayout } from './shared/NativeToolLayout'

// -----------------------------------------------------------------------------
// Quality model
// -----------------------------------------------------------------------------
// Slider position `t` runs 0 (smallest file) -> 100 (highest quality). We sample
// at a handful of discrete stops and interpolate both the render scale and the
// JPEG quality between them. Stops were picked so that visual quality remains
// acceptable across the full range; t=0 is "mobile preview" territory, t=100
// is "archival-ish" raster.

type QualityStop = { t: number; scale: number; jpeg: number }

const QUALITY_STOPS: QualityStop[] = [
  { t: 0, scale: 0.75, jpeg: 0.35 },
  { t: 25, scale: 1.0, jpeg: 0.5 },
  { t: 50, scale: 1.25, jpeg: 0.65 },
  { t: 75, scale: 1.5, jpeg: 0.8 },
  { t: 100, scale: 2.0, jpeg: 0.92 },
]

// Roughly cap canvas pixels so we don't OOM on huge page sizes.
const MAX_SAMPLE_PIXELS = 4_000_000
const MAX_RENDER_PIXELS = 8_000_000

function interpolateStop(t: number): QualityStop {
  const clamped = Math.max(0, Math.min(100, t))
  for (let i = 0; i < QUALITY_STOPS.length - 1; i++) {
    const a = QUALITY_STOPS[i]
    const b = QUALITY_STOPS[i + 1]
    if (clamped >= a.t && clamped <= b.t) {
      const f = (clamped - a.t) / (b.t - a.t)
      return {
        t: clamped,
        scale: a.scale + f * (b.scale - a.scale),
        jpeg: a.jpeg + f * (b.jpeg - a.jpeg),
      }
    }
  }
  return QUALITY_STOPS[QUALITY_STOPS.length - 1]
}

type Analysis = {
  originalSize: number
  losslessSize: number
  // t -> projected total bytes if we rasterize the full doc at this stop.
  stops: Record<number, number>
}

function estimateRasterSize(t: number, analysis: Analysis): number {
  const clamped = Math.max(0, Math.min(100, t))
  for (let i = 0; i < QUALITY_STOPS.length - 1; i++) {
    const a = QUALITY_STOPS[i].t
    const b = QUALITY_STOPS[i + 1].t
    if (clamped >= a && clamped <= b) {
      const f = (clamped - a) / (b - a)
      const sa = analysis.stops[a]
      const sb = analysis.stops[b]
      return sa + f * (sb - sa)
    }
  }
  return analysis.stops[100]
}

function bestProjection(t: number, analysis: Analysis): { size: number; source: 'raster' | 'lossless' | 'original' } {
  const raster = estimateRasterSize(t, analysis)
  const candidates: Array<{ size: number; source: 'raster' | 'lossless' | 'original' }> = [
    { size: raster, source: 'raster' },
    { size: analysis.losslessSize, source: 'lossless' },
    { size: analysis.originalSize, source: 'original' },
  ]
  candidates.sort((a, b) => a.size - b.size)
  return candidates[0]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// -----------------------------------------------------------------------------
// Analysis helpers
// -----------------------------------------------------------------------------

async function computeLosslessSize(buffer: ArrayBuffer, password?: string): Promise<number | null> {
  try {
    const pdf = await PDFDocument.load(buffer, {
      password: password || undefined,
      ignoreEncryption: true,
    } as any)
    const saved = await pdf.save({ useObjectStreams: true })
    return saved.byteLength
  } catch {
    return null
  }
}

async function renderSampleJpegBytes(pdfDoc: any, pageNum: number, scale: number, jpeg: number): Promise<number> {
  const page = await pdfDoc.getPage(pageNum)
  let effectiveScale = scale
  const baseViewport = page.getViewport({ scale: 1 })
  const pixels = baseViewport.width * baseViewport.height * scale * scale
  if (pixels > MAX_SAMPLE_PIXELS) {
    effectiveScale = scale * Math.sqrt(MAX_SAMPLE_PIXELS / pixels)
  }
  const viewport = page.getViewport({ scale: effectiveScale })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return 0
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise
  const dataUrl = canvas.toDataURL('image/jpeg', jpeg)
  const commaIdx = dataUrl.indexOf(',')
  const base64Len = dataUrl.length - commaIdx - 1
  const approxBytes = Math.floor((base64Len * 3) / 4)
  // If we had to shrink the sample canvas, re-scale the result so the estimate
  // reflects what we *would* produce at the requested scale.
  const scaleRatio = scale / effectiveScale
  const correctedBytes = approxBytes * scaleRatio * scaleRatio
  canvas.width = 0
  canvas.height = 0
  return correctedBytes
}

async function analyzeFile(file: File, password: string | undefined, pageCount: number, onProgress?: (p: number) => void): Promise<Analysis> {
  const originalSize = file.size
  const buffer = await file.arrayBuffer()

  onProgress?.(10)
  const lossless = await computeLosslessSize(buffer.slice(0), password)
  const losslessSize = lossless ?? originalSize
  onProgress?.(30)

  const pdfDoc = await loadPdfDocument(new File([buffer as any], file.name, { type: 'application/pdf' }))
  const numPages = pageCount || pdfDoc.numPages

  // Sample up to 2 representative pages. More would slow down analysis on long
  // documents without meaningfully improving the estimate.
  const sampleIndices = numPages <= 1 ? [1] : Array.from(new Set([1, Math.max(1, Math.ceil(numPages / 2))]))

  const stops: Record<number, number> = {}
  const overhead = 4096
  for (let i = 0; i < QUALITY_STOPS.length; i++) {
    const stop = QUALITY_STOPS[i]
    let totalSampleBytes = 0
    let samplesCounted = 0
    for (const pageIdx of sampleIndices) {
      try {
        const bytes = await renderSampleJpegBytes(pdfDoc, pageIdx, stop.scale, stop.jpeg)
        totalSampleBytes += bytes
        samplesCounted += 1
      } catch {
        // Ignore per-page errors; we'll extrapolate from what we have.
      }
    }
    const avgPerPage = samplesCounted > 0 ? totalSampleBytes / samplesCounted : 0
    stops[stop.t] = Math.round(avgPerPage * numPages + overhead)
    onProgress?.(30 + Math.round(((i + 1) / QUALITY_STOPS.length) * 65))
  }

  onProgress?.(100)
  return { originalSize, losslessSize, stops }
}

// -----------------------------------------------------------------------------
// Compare slider
// -----------------------------------------------------------------------------

const QualityCompare = ({ originalBuffer, compressedBuffer }: { originalBuffer: Uint8Array; compressedBuffer: Uint8Array }) => {
  const [originalThumb, setOriginalThumb] = useState<string>('')
  const [compressedThumb, setCompressedThumb] = useState<string>('')
  const [sliderPos, setSliderPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadThumbs = async () => {
      try {
        const origPdf = await loadPdfDocument(new File([originalBuffer as any], 'orig.pdf', { type: 'application/pdf' }))
        const compPdf = await loadPdfDocument(new File([compressedBuffer as any], 'comp.pdf', { type: 'application/pdf' }))
        const t1 = await renderPageThumbnail(origPdf, 1, 2.0)
        const t2 = await renderPageThumbnail(compPdf, 1, 2.0)
        setOriginalThumb(t1)
        setCompressedThumb(t2)
      } catch (e) {
        console.error(e)
      }
    }
    loadThumbs()
  }, [originalBuffer, compressedBuffer])

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const position = ((x - rect.left) / rect.width) * 100
    setSliderPos(Math.max(0, Math.min(100, position)))
  }

  if (!originalThumb || !compressedThumb)
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 rounded-[2rem] animate-pulse">
        <div className="w-8 h-8 border-2 border-terracotta-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase text-gray-400">Comparing Quality...</p>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <h4 className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-2">
          <Maximize2 size={12} /> Quality Inspection
        </h4>
      </div>
      <div
        ref={containerRef}
        className="relative h-80 md:h-[400px] rounded-[2rem] overflow-hidden cursor-ew-resize select-none border border-gray-100 dark:border-white/5"
        onMouseMove={handleMove}
        onTouchMove={handleMove}
      >
        <img src={compressedThumb} className="absolute inset-0 w-full h-full object-contain bg-white" alt="Compressed" />
        <div className="absolute inset-0 w-full h-full overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
          <img src={originalThumb} className="absolute inset-0 w-full h-full object-contain bg-white" alt="Original" />
        </div>
        <div className="absolute top-0 bottom-0 w-1 bg-white shadow-xl z-10" style={{ left: `${sliderPos}%` }}>
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white dark:bg-zinc-900 rounded-full shadow-2xl border border-gray-100 dark:border-white/5 flex items-center justify-center text-terracotta-500">
            <ChevronLeft size={14} />
            <ChevronRight size={14} />
          </div>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Main tool
// -----------------------------------------------------------------------------

type CompressPdfFile = {
  id: string
  file: File
  thumbnail?: string
  pageCount: number
  isLocked: boolean
  pdfDoc?: any
  password?: string
  status: 'pending' | 'analyzing' | 'processing' | 'completed' | 'error'
  analysis?: Analysis
  analysisProgress?: number
  resultUrl?: string
  resultSize?: number
  resultSource?: 'raster' | 'lossless' | 'original'
}

export default function CompressTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { consumePipelineFile, setPipelineFile, lastPipelinedFile } = usePipeline()
  const { objectUrl, createUrl, clearUrls } = useObjectURL()
  const [files, setFiles] = useState<CompressPdfFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [globalProgress, setGlobalProgress] = useState(0)
  // Slider value: 0 = smallest file, 100 = highest quality. Default leans
  // toward smaller files since that's what most users want.
  const [quality, setQuality] = useState<number>(35)
  const [showSuccess, setShowSuccess] = useState(false)
  const isNative = Capacitor.isNativePlatform()

  useEffect(() => {
    const pipelined = consumePipelineFile()
    if (!pipelined) return
    // Don't auto-reload our own output when the user returns to this tool.
    if (pipelined.sourceTool === 'compress') return
    if (pipelined.type && pipelined.type !== 'application/pdf') {
      toast.error('The file from the previous tool is not a PDF and cannot be used here.')
      return
    }
    const file = new File([pipelined.buffer as any], pipelined.name, { type: 'application/pdf' })
    handleFiles([file])
  }, [])

  const startAnalysis = (id: string, file: File, password: string | undefined, pageCount: number) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, status: 'analyzing', analysisProgress: 0 } : f)))
    analyzeFile(file, password, pageCount, p => {
      setFiles(prev => prev.map(f => (f.id === id ? { ...f, analysisProgress: p } : f)))
    })
      .then(analysis => {
        setFiles(prev => prev.map(f => (f.id === id ? { ...f, status: 'pending', analysis, analysisProgress: 100 } : f)))
      })
      .catch(err => {
        console.error('Analysis failed:', err)
        setFiles(prev => prev.map(f => (f.id === id ? { ...f, status: 'pending' } : f)))
      })
  }

  const handleFiles = async (selectedFiles: FileList | File[]) => {
    const newFiles = Array.from(selectedFiles)
      .filter(f => f.type === 'application/pdf')
      .map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        pageCount: 0,
        isLocked: false,
        status: 'pending' as const,
      }))
    setFiles(prev => [...prev, ...newFiles])
    setShowSuccess(false)
    clearUrls()

    if (fileInputRef.current) fileInputRef.current.value = ''

    for (const f of newFiles) {
      getPdfMetaData(f.file).then(meta => {
        setFiles(prev =>
          prev.map(item => (item.id === f.id ? { ...item, pageCount: meta.pageCount, isLocked: meta.isLocked, thumbnail: meta.thumbnail } : item))
        )
        if (!meta.isLocked && meta.pageCount > 0) {
          startAnalysis(f.id, f.file, undefined, meta.pageCount)
        }
      })
    }
  }

  const handleUnlock = async (id: string, password: string) => {
    const item = files.find(f => f.id === id)
    if (!item) return
    const result = await unlockPdf(item.file, password)
    if (result.success) {
      setFiles(prev =>
        prev.map(f => (f.id === id ? { ...f, isLocked: false, pageCount: result.pageCount, pdfDoc: result.pdfDoc, thumbnail: result.thumbnail, password } : f))
      )
      startAnalysis(id, item.file, password, result.pageCount)
    } else {
      toast.error('Incorrect password')
    }
  }

  // Static (slider-independent) analysis summary across all analyzed files.
  //
  // We sample the delivered-size curve (= min(raster(t), lossless, original))
  // across the slider range once, use it to decide whether the slider can
  // actually change the output, and if so, find the smallest internal t that
  // already hits the size ceiling. The slider is then remapped so that its
  // full 0→100 travel always lives inside the useful region — the displayed
  // output size changes as the user drags, with no flat zone at the end.
  const analysisSummary = useMemo(() => {
    const analyzed = files.filter(f => f.analysis)
    if (analyzed.length === 0) return null
    const sampleTs = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const samples = sampleTs.map(t => {
      let size = 0
      for (const f of analyzed) size += bestProjection(t, f.analysis!).size
      return { t, size }
    })
    const totalOriginal = analyzed.reduce((s, f) => s + f.analysis!.originalSize, 0)
    const minDelivered = Math.min(...samples.map(s => s.size))
    const maxDelivered = Math.max(...samples.map(s => s.size))
    const range = maxDelivered - minDelivered
    const sliderMatters = range > Math.max(totalOriginal * 0.01, 10 * 1024)

    // Smallest t that reaches the upper-end delivered size (within tolerance).
    // Past this point the slider would be flat, so we clip to it.
    let tCeiling = 100
    const tol = Math.max(range * 0.03, 1024)
    for (const s of samples) {
      if (s.size >= maxDelivered - tol) {
        tCeiling = s.t
        break
      }
    }
    if (!sliderMatters) tCeiling = 0

    // What strategy dominates when the slider is inert — used for a short
    // one-liner so the user understands why there's no slider.
    let dominantSource: 'raster' | 'lossless' | 'original' | 'mixed' = 'raster'
    if (!sliderMatters) {
      const sources = new Set(analyzed.map(f => bestProjection(0, f.analysis!).source))
      dominantSource = sources.size === 1 ? (sources.values().next().value as any) : 'mixed'
    }

    return { totalOriginal, minDelivered, maxDelivered, sliderMatters, tCeiling, dominantSource }
  }, [files])

  // Slider value 0→100 is remapped to the useful internal range so the output
  // always changes as the user drags.
  const effectiveT = analysisSummary?.sliderMatters ? (quality / 100) * analysisSummary.tCeiling : 0

  // The live-updating output number shown to the user at the current slider
  // position.
  const projection = useMemo(() => {
    if (!analysisSummary) return null
    const analyzed = files.filter(f => f.analysis)
    let totalDelivered = 0
    for (const f of analyzed) totalDelivered += bestProjection(effectiveT, f.analysis!).size
    const delta = totalDelivered - analysisSummary.totalOriginal
    const percent = analysisSummary.totalOriginal > 0 ? (delta / analysisSummary.totalOriginal) * 100 : 0
    return { totalOriginal: analysisSummary.totalOriginal, totalDelivered, delta, percent }
  }, [files, effectiveT, analysisSummary])

  const anyAnalyzing = files.some(f => f.status === 'analyzing')
  const hasReadyFiles = files.some(f => !f.isLocked && f.status === 'pending' && f.analysis)
  const hasUnanalyzedReady = files.some(f => !f.isLocked && f.status === 'pending' && !f.analysis)

  const compressSingleFile = async (
    item: CompressPdfFile,
    qualityT: number,
    onProgress?: (p: number) => void
  ): Promise<{ url: string; size: number; buffer: Uint8Array; source: 'raster' | 'lossless' | 'original' }> => {
    const params = interpolateStop(qualityT)
    const originalBuffer = new Uint8Array(await item.file.arrayBuffer())
    const originalSize = originalBuffer.byteLength

    // Lossless pass — cheap and often the winner for text-heavy PDFs.
    let losslessBytes: Uint8Array | null = null
    try {
      const pdflib = await PDFDocument.load(originalBuffer.slice(0), {
        password: item.password || undefined,
        ignoreEncryption: true,
      } as any)
      losslessBytes = await pdflib.save({ useObjectStreams: true })
    } catch (e) {
      console.warn('Lossless pass failed:', e)
    }
    onProgress?.(10)

    const losslessSize = losslessBytes ? losslessBytes.byteLength : Infinity
    const rasterEstimate = item.analysis ? estimateRasterSize(qualityT, item.analysis) : Infinity
    const minNonRaster = Math.min(losslessSize, originalSize)

    // Skip the expensive rasterization path when analysis already proves it
    // would produce a larger file than the best non-raster candidate.
    const shouldRasterize = rasterEstimate < minNonRaster * 0.98

    let rasterBytes: Uint8Array | null = null
    if (shouldRasterize) {
      const pdfDoc = item.pdfDoc || (await loadPdfDocument(item.file))
      const pageCount = item.pageCount || pdfDoc.numPages
      const pagesData: { imageBytes: Uint8Array; width: number; height: number }[] = []
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdfDoc.getPage(i)
        let effectiveScale = params.scale
        const base = page.getViewport({ scale: 1 })
        const pixels = base.width * base.height * params.scale * params.scale
        if (pixels > MAX_RENDER_PIXELS) {
          effectiveScale = params.scale * Math.sqrt(MAX_RENDER_PIXELS / pixels)
        }
        const viewport = page.getViewport({ scale: effectiveScale })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) continue
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: context, viewport, intent: 'print' }).promise
        const imgData = canvas.toDataURL('image/jpeg', params.jpeg)
        const base64 = imgData.split(',')[1]
        const binaryString = window.atob(base64)
        const bytes = new Uint8Array(binaryString.length)
        for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j)
        pagesData.push({ imageBytes: bytes, width: canvas.width, height: canvas.height })
        onProgress?.(10 + Math.round((i / pageCount) * 55))
        canvas.width = 0
        canvas.height = 0
      }

      rasterBytes = await new Promise<Uint8Array>((resolve, reject) => {
        try {
          const worker = new Worker(new URL('../../utils/pdfWorker.ts', import.meta.url), { type: 'module' })
          worker.postMessage(
            { type: 'COMPRESS_PDF_ASSEMBLY', payload: { pages: pagesData } },
            pagesData.map(p => p.imageBytes.buffer) as any
          )
          worker.onmessage = e => {
            if (e.data.type === 'PROGRESS') {
              onProgress?.(65 + Math.round(e.data.payload * 0.3))
            } else if (e.data.type === 'SUCCESS') {
              resolve(e.data.payload as Uint8Array)
              worker.terminate()
            } else if (e.data.type === 'ERROR') {
              reject(new Error(e.data.payload))
              worker.terminate()
            }
          }
          worker.onerror = () => {
            reject(new Error('Worker failed to start or execution error.'))
            worker.terminate()
          }
        } catch (e: any) {
          reject(new Error(`Failed to start worker: ${e.message}`))
        }
      })
    }

    onProgress?.(95)

    // Pick the smallest candidate. Never return a larger file than the user
    // gave us — falling back to the original is the correct behavior.
    type Candidate = { size: number; buffer: Uint8Array; source: 'raster' | 'lossless' | 'original' }
    const candidates: Candidate[] = [{ size: originalSize, buffer: originalBuffer, source: 'original' }]
    if (losslessBytes) candidates.push({ size: losslessBytes.byteLength, buffer: losslessBytes, source: 'lossless' })
    if (rasterBytes) candidates.push({ size: rasterBytes.byteLength, buffer: rasterBytes, source: 'raster' })
    candidates.sort((a, b) => a.size - b.size)
    const winner = candidates[0]

    const blob = new Blob([winner.buffer as any], { type: 'application/pdf' })
    onProgress?.(100)
    return { url: createUrl(blob), size: winner.size, buffer: winner.buffer, source: winner.source }
  }

  const startBatchCompression = async () => {
    const pendingFiles = files.filter(f => !f.isLocked && f.status === 'pending')
    if (pendingFiles.length === 0) return
    setIsProcessing(true)
    setGlobalProgress(0)
    const results: { name: string; buffer: Uint8Array }[] = []

    const isSingle = pendingFiles.length === 1

    for (let i = 0; i < pendingFiles.length; i++) {
      const item = pendingFiles[i]
      setFiles(prev => prev.map(f => (f.id === item.id ? { ...f, status: 'processing' } : f)))
      try {
        const { url, size, buffer, source } = await compressSingleFile(item, effectiveT, isSingle ? setGlobalProgress : undefined)
        results.push({ name: item.file.name.replace('.pdf', '-compressed.pdf'), buffer })
        setFiles(prev => prev.map(f => (f.id === item.id ? { ...f, status: 'completed', resultUrl: url, resultSize: size, resultSource: source } : f)))
        addActivity({ name: item.file.name.replace('.pdf', '-compressed.pdf'), tool: 'Compress', size, resultUrl: url })
        if (pendingFiles.length === 1) {
          const originalBuffer = await pendingFiles[0].file.arrayBuffer()
          setPipelineFile({
            buffer,
            name: item.file.name.replace('.pdf', '-compressed.pdf'),
            type: 'application/pdf',
            originalBuffer: new Uint8Array(originalBuffer),
            sourceTool: 'compress',
          })
          if (source === 'original') {
            toast('Your PDF is already well optimized — kept the original file.', { icon: <ShieldCheck size={16} /> })
          }
        }
      } catch (e) {
        console.error('Compression failed:', e)
        setFiles(prev => prev.map(f => (f.id === item.id ? { ...f, status: 'error' } : f)))
      }

      if (!isSingle) setGlobalProgress(Math.round(((i + 1) / pendingFiles.length) * 100))
    }
    if (results.length > 1) {
      const zip = new JSZip()
      results.forEach(res => zip.file(res.name, res.buffer))
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      createUrl(zipBlob)
    }
    setIsProcessing(false)
    setShowSuccess(true)
  }

  const handleDownloadBatch = async () => {
    if (objectUrl && files.length > 1) {
      const zip = new JSZip()
      for (const f of files) {
        if (f.resultUrl) {
          const res = await fetch(f.resultUrl)
          zip.file(f.file.name.replace('.pdf', '-compressed.pdf'), await res.arrayBuffer())
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      await downloadFile(new Uint8Array(await blob.arrayBuffer()), 'paperknife-compressed.zip', 'application/zip')
    }
  }

  const ActionButton = () => {
    const disabled = isProcessing || !hasReadyFiles || anyAnalyzing
    const label = anyAnalyzing
      ? 'Analyzing…'
      : hasUnanalyzedReady && !hasReadyFiles
      ? 'Preparing…'
      : files.filter(f => !f.isLocked).length > 1
      ? `Compress ${files.filter(f => !f.isLocked).length} Files`
      : 'Compress PDF'
    return (
      <button
        onClick={startBatchCompression}
        disabled={disabled}
        className={`w-full bg-terracotta-500 hover:bg-terracotta-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-terracotta-500/20 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="animate-spin" /> {globalProgress}%
          </>
        ) : anyAnalyzing ? (
          <>
            <Loader2 className="animate-spin" /> {label}
          </>
        ) : (
          <>
            {label} <ArrowRight size={18} />
          </>
        )}
      </button>
    )
  }

  return (
    <NativeToolLayout
      title="Compress PDF"
      description="Reduce file size while maintaining quality. Everything stays on your device."
      actions={files.length > 0 && !showSuccess && <ActionButton />}
    >
      <input type="file" multiple accept=".pdf" className="hidden" ref={fileInputRef} onChange={e => e.target.files && handleFiles(e.target.files)} />

      {files.length === 0 ? (
        <button
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-terracotta-300 dark:border-terracotta-800 rounded-[2.5rem] p-12 md:p-16 text-center bg-white dark:bg-zinc-900/60 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/10 hover:border-terracotta-400 transition-all cursor-pointer group shadow-clay-sm dark:shadow-none"
        >
          <div className="w-20 h-20 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-inner">
            <Zap size={32} />
          </div>
          <h3 className="text-xl font-bold dark:text-white mb-2">Select PDFs</h3>
          <p className="text-sm text-gray-400 font-medium">Tap to browse or drag and drop here</p>
          <span className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-terracotta-500 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-terracotta-500/20 group-hover:shadow-xl group-hover:scale-105 transition-all">
            Choose File
          </span>
        </button>
      ) : !showSuccess ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {files.map(f => (
              <div
                key={f.id}
                className="bg-white dark:bg-zinc-900 p-4 rounded-[1.5rem] border border-gray-100 dark:border-white/5 flex items-center gap-4 relative group shadow-sm"
              >
                <div className="w-12 h-16 bg-gray-50 dark:bg-black rounded-lg overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800">
                  {f.thumbnail ? (
                    <img src={f.thumbnail} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileIcon className="text-gray-300" size={16} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black truncate dark:text-white">{f.file.name}</p>
                  {f.isLocked ? (
                    <div className="flex gap-1 mt-1">
                      <input
                        type="password"
                        placeholder="Locked..."
                        className="flex-1 bg-gray-50 dark:bg-black text-[10px] p-1.5 rounded-lg outline-none w-full border border-gray-100 dark:border-zinc-800 focus:border-terracotta-500"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUnlock(f.id, e.currentTarget.value)
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                        {formatBytes(f.file.size)} • {f.pageCount || '…'} Pages
                      </p>
                      {f.status === 'analyzing' && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-terracotta-500 transition-all" style={{ width: `${f.analysisProgress || 0}%` }} />
                          </div>
                          <span className="text-[9px] font-black uppercase text-gray-400">Analyzing</span>
                        </div>
                      )}
                      {f.analysis && (
                        <p className="text-[10px] font-black uppercase tracking-tighter text-terracotta-500">
                          → {formatBytes(bestProjection(effectiveT, f.analysis).size)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => setFiles(prev => prev.filter(item => item.id !== f.id))} className="p-2 text-gray-300 hover:text-terracotta-500 transition-colors">
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-[1.5rem] p-4 text-gray-400 flex flex-col items-center justify-center gap-1 hover:border-terracotta-500 hover:text-terracotta-500 transition-all"
            >
              <Plus size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Add More</span>
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            {projection ? (
              <>
                {/* Headline: Original -> Output */}
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Original</p>
                    <p className="text-lg md:text-xl font-black dark:text-white tracking-tight tabular-nums">{formatBytes(projection.totalOriginal)}</p>
                  </div>
                  <ArrowRight className="text-gray-300 shrink-0" size={20} />
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Output</p>
                    <p className="text-2xl md:text-3xl font-black text-terracotta-500 tracking-tight tabular-nums transition-all">
                      {formatBytes(projection.totalDelivered)}
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-6 ${
                    projection.delta < 0 ? 'text-green-600 dark:text-green-400' : projection.delta === 0 ? 'text-gray-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {projection.delta < 0 ? <TrendingDown size={14} /> : projection.delta > 0 ? <TrendingUp size={14} /> : <ShieldCheck size={14} />}
                  <span>
                    {projection.delta < 0
                      ? `${Math.abs(projection.percent).toFixed(0)}% smaller`
                      : projection.delta === 0
                      ? 'No change'
                      : `Would grow ${projection.percent.toFixed(0)}% — original kept`}
                  </span>
                </div>

                {/* Slider is shown only when it actually changes the output size. */}
                {analysisSummary?.sliderMatters ? (
                  <div className="space-y-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={quality}
                      onChange={e => setQuality(Number(e.target.value))}
                      className="w-full h-2 bg-gradient-to-r from-terracotta-500 via-terracotta-300 to-terracotta-500/40 rounded-full appearance-none cursor-pointer accent-terracotta-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-terracotta-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-terracotta-500/30 [&::-webkit-slider-thumb]:cursor-grab active:[&::-webkit-slider-thumb]:cursor-grabbing [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-terracotta-500 [&::-moz-range-thumb]:cursor-grab"
                    />
                    <div className="flex justify-between text-[9px] font-black uppercase text-gray-400 tracking-widest px-0.5">
                      <span>Smallest ({formatBytes(analysisSummary.minDelivered)})</span>
                      <span>Best Quality ({formatBytes(analysisSummary.maxDelivered)})</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed">
                    {analysisSummary?.dominantSource === 'original'
                      ? 'Already optimized — your file is as small as it can get without losing quality.'
                      : analysisSummary?.dominantSource === 'lossless'
                      ? 'Lossless rebuild — no quality loss. Your PDF is mostly text or vectors, so this is the smallest it can get.'
                      : 'This is the smallest size we can reach for your file.'}
                  </p>
                )}
              </>
            ) : anyAnalyzing ? (
              <div className="flex items-center gap-3 text-gray-400">
                <Loader2 className="animate-spin" size={18} />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Analyzing…</p>
                  <p className="text-[10px] mt-1">Figuring out how small we can make your file.</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Unlock your PDF(s) to see a size estimate.</p>
            )}

            {isProcessing && (
              <div className="mt-8 space-y-3">
                <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden shadow-inner">
                  <div className="bg-terracotta-500 h-full transition-all" style={{ width: `${globalProgress}%` }} />
                </div>
                <p className="text-[10px] text-center font-black uppercase text-gray-400 tracking-widest animate-pulse">Compressing…</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in zoom-in duration-300">
          {objectUrl && files.length > 1 && (
            <button
              onClick={handleDownloadBatch}
              className="block w-full bg-zinc-900 dark:bg-white text-white dark:text-black p-10 rounded-[2.5rem] text-center shadow-2xl transition-all group active:scale-[0.98]"
            >
              <div className="w-16 h-16 bg-terracotta-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <Download className="text-white" size={32} />
              </div>
              <h3 className="text-2xl font-black tracking-tight mb-1">{isNative ? 'Save ZIP Archive' : 'Download ZIP Archive'}</h3>
              <p className="text-xs font-bold opacity-60 uppercase tracking-widest">{files.length} Optimized PDFs</p>
            </button>
          )}
          {objectUrl && files.length === 1 && (
            <div className="space-y-8">
              {(() => {
                const f = files[0]
                const original = f.file.size
                const result = f.resultSize || original
                const delta = result - original
                const percent = original > 0 ? (delta / original) * 100 : 0
                const message =
                  f.resultSource === 'original'
                    ? `Already optimized — kept your original (${formatBytes(original)}).`
                    : delta < 0
                    ? `${formatBytes(original)} → ${formatBytes(result)}  •  ${Math.abs(percent).toFixed(0)}% smaller`
                    : `${formatBytes(original)} → ${formatBytes(result)}  •  no reduction possible`
                return (
                  <>
                    {f.resultSource === 'raster' && lastPipelinedFile?.originalBuffer && lastPipelinedFile?.buffer && (
                      <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
                        <QualityCompare originalBuffer={lastPipelinedFile.originalBuffer} compressedBuffer={lastPipelinedFile.buffer} />
                      </div>
                    )}
                    <SuccessState
                      message={message}
                      downloadUrl={objectUrl}
                      fileName={f.file.name.replace('.pdf', '-compressed.pdf')}
                      onStartOver={() => {
                        setFiles([])
                        setShowSuccess(false)
                        clearUrls()
                        setIsProcessing(false)
                      }}
                    />
                  </>
                )
              })()}
            </div>
          )}
        </div>
      )}
      <ToolSeoContent
        title="Compress PDF"
        headline="Compress PDF Files Without Losing Quality"
        description="Reduce your PDF file size for easier sharing and storage. PaperKnife's compression tool analyzes each document the moment you upload it, shows you exactly how small it can go, and never returns a file bigger than the one you gave it — all in your browser, with no uploads."
        benefits={[
          "Per-file analysis: we probe your PDF and project the output size live as you move the slider.",
          "Guaranteed non-bloat: if compression would make the file bigger, we keep your original automatically.",
          "Lossless mode for text-heavy PDFs — structure is re-packed without touching quality.",
          "100% local processing: your documents are never uploaded to any server.",
        ]}
        howItWorks={[
          "Upload the PDF you want to compress.",
          "Wait a second while PaperKnife measures how much it can shrink.",
          "Drag the quality slider — see the projected size update instantly.",
          "Click 'Compress' and download the smaller PDF.",
        ]}
        faqs={[
          { q: "Why did another tool make my PDF bigger?", a: "Many compressors always re-render every page as a JPEG. For text-heavy PDFs, that's much larger than the original compact text. PaperKnife detects this and falls back to a lossless re-pack — or keeps your original if nothing helps." },
          { q: "What does the slider actually do?", a: "It picks the render scale and JPEG quality used when images need to be downsampled. Left = smaller file, more visible compression. Right = larger file, near-original quality. The projected size updates live." },
          { q: "Can I compress password-protected PDFs?", a: "Yes. Enter the password when prompted and the tool will compress it while keeping the encryption settings." },
          { q: "Is this better than online compression tools?", a: "For privacy, absolutely. Unlike online tools that upload your files to their servers, PaperKnife compresses everything locally. Your sensitive documents never leave your device." },
        ]}
      />
      <PrivacyBadge />
    </NativeToolLayout>
  )
}
