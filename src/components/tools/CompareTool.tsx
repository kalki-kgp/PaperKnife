/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  GitCompare, Upload, X, Loader2, ChevronLeft, ChevronRight,
  FileText, Image as ImageIcon, Lock, AlertTriangle, Maximize2, Minimize2,
} from 'lucide-react'
import { toast } from 'sonner'

import { loadPdfDocument, getPdfMetaData, unlockPdf } from '../../utils/pdfHelpers'
import {
  diffPageText,
  renderPageCanvas,
  visualDiff,
  pickSharedScale,
  type PageTextDiff,
  type WordBox,
  type VisualDiffResult,
} from '../../utils/pdfDiff'
import { usePipeline } from '../../utils/pipelineContext'
import PrivacyBadge from './shared/PrivacyBadge'
import ToolSeoContent from './shared/ToolSeoContent'
import { NativeToolLayout } from './shared/NativeToolLayout'

type Slot = 'A' | 'B'
type Mode = 'text' | 'visual'

interface SlotState {
  file: File
  pdfDoc: any | null
  pageCount: number
  isLocked: boolean
  password?: string
}

const MAX_RENDER_EDGE = 1400

export default function CompareTool() {
  const fileInputA = useRef<HTMLInputElement>(null)
  const fileInputB = useRef<HTMLInputElement>(null)
  const { consumePipelineFile } = usePipeline()

  const [slotA, setSlotA] = useState<SlotState | null>(null)
  const [slotB, setSlotB] = useState<SlotState | null>(null)
  const [mode, setMode] = useState<Mode>('text')
  const [pageIndex, setPageIndex] = useState(0)
  const [loadingSlot, setLoadingSlot] = useState<Slot | null>(null)
  const [unlockInput, setUnlockInput] = useState('')

  // Per-page caches so flipping pages doesn't re-render from scratch.
  const [canvasA, setCanvasA] = useState<HTMLCanvasElement | null>(null)
  const [canvasB, setCanvasB] = useState<HTMLCanvasElement | null>(null)
  const [canvasDims, setCanvasDims] = useState<{ wA: number; hA: number; wB: number; hB: number }>({ wA: 0, hA: 0, wB: 0, hB: 0 })
  const [textDiff, setTextDiff] = useState<PageTextDiff | null>(null)
  const [visualResult, setVisualResult] = useState<VisualDiffResult | null>(null)
  const [pageBusy, setPageBusy] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Callback refs (state-backed) so the canvas mount effect re-fires when the host divs
  // unmount in the normal view and remount inside the expanded overlay.
  const [hostA, setHostA] = useState<HTMLDivElement | null>(null)
  const [hostB, setHostB] = useState<HTMLDivElement | null>(null)
  const [diffOverlayHost, setDiffOverlayHost] = useState<HTMLDivElement | null>(null)

  const maxPages = Math.max(slotA?.pageCount ?? 0, slotB?.pageCount ?? 0)

  useEffect(() => {
    const pipelined = consumePipelineFile()
    if (pipelined) {
      const file = new File([pipelined.buffer as any], pipelined.name, { type: 'application/pdf' })
      void loadSlot('A', file)
    }
    // We intentionally only consume on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetPageOutputs = useCallback(() => {
    setCanvasA(null)
    setCanvasB(null)
    setTextDiff(null)
    setVisualResult(null)
    setPageError(null)
  }, [])

  const loadSlot = async (slot: Slot, file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF file.')
      return
    }
    setLoadingSlot(slot)
    try {
      const meta = await getPdfMetaData(file)
      if (meta.isLocked) {
        const payload: SlotState = { file, pdfDoc: null, pageCount: 0, isLocked: true }
        if (slot === 'A') setSlotA(payload)
        else setSlotB(payload)
      } else {
        const pdfDoc = await loadPdfDocument(file)
        const payload: SlotState = {
          file,
          pdfDoc,
          pageCount: pdfDoc.numPages,
          isLocked: false,
        }
        if (slot === 'A') setSlotA(payload)
        else setSlotB(payload)
      }
      setPageIndex(0)
      resetPageOutputs()
      if (meta.pageCount > 300) {
        toast.warning('Large document detected — per-page work may be slow.')
      }
    } catch (err: any) {
      console.error(err)
      toast.error(`Failed to load file: ${err?.message || 'Unknown error'}`)
    } finally {
      setLoadingSlot(null)
    }
  }

  const handleUnlock = async (slot: Slot) => {
    const state = slot === 'A' ? slotA : slotB
    if (!state || !unlockInput) return
    setLoadingSlot(slot)
    try {
      const result = await unlockPdf(state.file, unlockInput)
      if (result.success) {
        const payload: SlotState = {
          file: state.file,
          pdfDoc: result.pdfDoc,
          pageCount: result.pageCount,
          isLocked: false,
          password: unlockInput,
        }
        if (slot === 'A') setSlotA(payload)
        else setSlotB(payload)
        setUnlockInput('')
        setPageIndex(0)
        resetPageOutputs()
      } else {
        toast.error('Incorrect password')
      }
    } finally {
      setLoadingSlot(null)
    }
  }

  const removeSlot = (slot: Slot) => {
    if (slot === 'A') setSlotA(null)
    else setSlotB(null)
    setPageIndex(0)
    resetPageOutputs()
  }

  const swapSlots = () => {
    setSlotA(slotB)
    setSlotB(slotA)
    setPageIndex(0)
    resetPageOutputs()
  }

  // Render and diff the current page when inputs change.
  useEffect(() => {
    if (!slotA || !slotB || slotA.isLocked || slotB.isLocked || !slotA.pdfDoc || !slotB.pdfDoc) {
      resetPageOutputs()
      return
    }
    if (maxPages === 0) return

    let cancelled = false
    const pageNum = pageIndex + 1

    const run = async () => {
      setPageBusy(true)
      setPageError(null)
      setCanvasA(null)
      setCanvasB(null)
      setTextDiff(null)
      setVisualResult(null)

      try {
        const pageA = pageNum <= slotA.pageCount ? await slotA.pdfDoc.getPage(pageNum) : null
        const pageB = pageNum <= slotB.pageCount ? await slotB.pdfDoc.getPage(pageNum) : null

        const { scaleA, scaleB } = pickSharedScale(pageA, pageB, MAX_RENDER_EDGE)

        const [renderedA, renderedB] = await Promise.all([
          pageA ? renderPageCanvas(pageA, scaleA) : Promise.resolve(null),
          pageB ? renderPageCanvas(pageB, scaleB) : Promise.resolve(null),
        ])
        if (cancelled) {
          renderedA && (renderedA.canvas.width = 0)
          renderedB && (renderedB.canvas.width = 0)
          return
        }

        setCanvasA(renderedA?.canvas ?? null)
        setCanvasB(renderedB?.canvas ?? null)
        setCanvasDims({
          wA: renderedA?.width ?? 0,
          hA: renderedA?.height ?? 0,
          wB: renderedB?.width ?? 0,
          hB: renderedB?.height ?? 0,
        })

        if (mode === 'text') {
          const diff = await diffPageText(pageA, pageB, Math.max(scaleA, scaleB))
          if (cancelled) return
          setTextDiff(diff)
          if (!diff.hasText) {
            setPageError('No selectable text on this page. Switch to Visual mode to compare scanned content.')
          }
        } else if (renderedA && renderedB) {
          const result = visualDiff(renderedA.canvas, renderedB.canvas, 0.1)
          if (cancelled) return
          setVisualResult(result)
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error(err)
          setPageError(err?.message || 'Failed to process page')
        }
      } finally {
        if (!cancelled) setPageBusy(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [slotA, slotB, pageIndex, mode, maxPages, resetPageOutputs])

  // Mount raw canvases inside host divs (React can't directly render an HTMLCanvasElement node).
  // Depending on the host elements lets us cleanly re-mount when the host remounts elsewhere
  // (e.g. when the expand overlay opens or closes).
  useEffect(() => {
    if (!hostA) return
    hostA.innerHTML = ''
    if (canvasA) {
      canvasA.style.display = 'block'
      canvasA.style.width = '100%'
      canvasA.style.height = 'auto'
      hostA.appendChild(canvasA)
    }
  }, [canvasA, hostA])

  useEffect(() => {
    if (!hostB) return
    hostB.innerHTML = ''
    if (canvasB) {
      canvasB.style.display = 'block'
      canvasB.style.width = '100%'
      canvasB.style.height = 'auto'
      hostB.appendChild(canvasB)
    }
  }, [canvasB, hostB])

  useEffect(() => {
    if (!diffOverlayHost) return
    diffOverlayHost.innerHTML = ''
    if (mode === 'visual' && visualResult) {
      const c = visualResult.diffCanvas
      c.style.display = 'block'
      c.style.width = '100%'
      c.style.height = 'auto'
      c.style.position = 'absolute'
      c.style.inset = '0'
      c.style.pointerEvents = 'none'
      c.style.mixBlendMode = 'multiply'
      diffOverlayHost.appendChild(c)
    }
  }, [mode, visualResult, diffOverlayHost])

  // Keyboard page navigation + Escape to exit expanded view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!slotA || !slotB) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') {
        setPageIndex(i => Math.min(i + 1, Math.max(0, maxPages - 1)))
      } else if (e.key === 'ArrowLeft') {
        setPageIndex(i => Math.max(0, i - 1))
      } else if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slotA, slotB, maxPages, isExpanded])

  useEffect(() => {
    if (!isExpanded) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isExpanded])

  const onDrop = (slot: Slot) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) void loadSlot(slot, file)
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault()

  const bothReady = !!(slotA && slotB && !slotA.isLocked && !slotB.isLocked && slotA.pdfDoc && slotB.pdfDoc)

  const pageNumber = pageIndex + 1
  const pageInA = slotA && pageNumber <= slotA.pageCount
  const pageInB = slotB && pageNumber <= slotB.pageCount

  return (
    <NativeToolLayout
      title="Compare PDFs"
      description="Spot what changed between two documents, side by side."
    >
      <input type="file" accept=".pdf,application/pdf" className="hidden" ref={fileInputA} onChange={(e) => e.target.files?.[0] && void loadSlot('A', e.target.files[0])} />
      <input type="file" accept=".pdf,application/pdf" className="hidden" ref={fileInputB} onChange={(e) => e.target.files?.[0] && void loadSlot('B', e.target.files[0])} />

      {!bothReady ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SlotDropZone
            label="Original"
            sub="Side A"
            slot="A"
            state={slotA}
            busy={loadingSlot === 'A'}
            onBrowse={() => fileInputA.current?.click()}
            onDrop={onDrop('A')}
            onDragOver={onDragOver}
            onRemove={() => removeSlot('A')}
            onUnlock={() => handleUnlock('A')}
            unlockInput={unlockInput}
            setUnlockInput={setUnlockInput}
          />
          <SlotDropZone
            label="Revised"
            sub="Side B"
            slot="B"
            state={slotB}
            busy={loadingSlot === 'B'}
            onBrowse={() => fileInputB.current?.click()}
            onDrop={onDrop('B')}
            onDragOver={onDragOver}
            onRemove={() => removeSlot('B')}
            onUnlock={() => handleUnlock('B')}
            unlockInput={unlockInput}
            setUnlockInput={setUnlockInput}
          />
        </div>
      ) : (
        <>
          {!isExpanded && (
            <div className="space-y-5">
              <CompareHeader
                slotA={slotA!}
                slotB={slotB!}
                mode={mode}
                setMode={setMode}
                onRemoveA={() => removeSlot('A')}
                onRemoveB={() => removeSlot('B')}
                onSwap={swapSlots}
                onExpand={() => setIsExpanded(true)}
                isExpanded={false}
              />

              <PageNavigator
                pageNumber={pageNumber}
                totalPages={maxPages}
                onPrev={() => setPageIndex(i => Math.max(0, i - 1))}
                onNext={() => setPageIndex(i => Math.min(i + 1, Math.max(0, maxPages - 1)))}
                onJump={(n) => setPageIndex(Math.min(Math.max(0, n - 1), Math.max(0, maxPages - 1)))}
              />

              <DiffLegend mode={mode} visualResult={visualResult} textDiff={textDiff} />

              {pageError && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={16} className="shrink-0" />
                  <p className="text-xs font-bold">{pageError}</p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <PageColumn
                  title="Original"
                  sub={slotA!.file.name}
                  present={!!pageInA}
                  busy={pageBusy}
                  hostRef={setHostA}
                  overlayWords={mode === 'text' && textDiff ? buildSideOverlay(textDiff, 'A') : []}
                  canvasWidth={canvasDims.wA}
                  canvasHeight={canvasDims.hA}
                />
                <PageColumn
                  title="Revised"
                  sub={slotB!.file.name}
                  present={!!pageInB}
                  busy={pageBusy}
                  hostRef={setHostB}
                  overlayWords={mode === 'text' && textDiff ? buildSideOverlay(textDiff, 'B') : []}
                  canvasWidth={canvasDims.wB}
                  canvasHeight={canvasDims.hB}
                  extraOverlayRef={mode === 'visual' ? setDiffOverlayHost : undefined}
                />
              </div>
            </div>
          )}

          {isExpanded && (
            <ExpandedCompareView
              slotA={slotA!}
              slotB={slotB!}
              mode={mode}
              setMode={setMode}
              pageNumber={pageNumber}
              totalPages={maxPages}
              onPrev={() => setPageIndex(i => Math.max(0, i - 1))}
              onNext={() => setPageIndex(i => Math.min(i + 1, Math.max(0, maxPages - 1)))}
              onJump={(n) => setPageIndex(Math.min(Math.max(0, n - 1), Math.max(0, maxPages - 1)))}
              onClose={() => setIsExpanded(false)}
              pageBusy={pageBusy}
              pageError={pageError}
              textDiff={textDiff}
              visualResult={visualResult}
              canvasDims={canvasDims}
              pageInA={!!pageInA}
              pageInB={!!pageInB}
              hostA={setHostA}
              hostB={setHostB}
              diffOverlayHost={setDiffOverlayHost}
            />
          )}
        </>
      )}

      <ToolSeoContent
        title="Compare PDFs"
        headline="Compare two PDFs and see exactly what changed"
        description="Drop two PDF files and PaperKnife highlights every word-level edit or visual tweak, page by page. Everything runs locally in your browser — no uploads, no servers, no tracking."
        benefits={[
          'Catch silent edits to contracts, invoices, and reports before you sign or send.',
          'Toggle between word-level text diff and full-page visual diff with one tap.',
          'Works on color scans and layout changes thanks to the pixel-matched visual mode.',
          'Keeps your documents private: comparison happens entirely on your device.',
        ]}
        howItWorks={[
          'Drop or select the original PDF on the left.',
          'Drop or select the revised PDF on the right.',
          'Flip between Text and Visual modes and page through the document.',
          'Scan the highlighted additions, removals, and modifications.',
        ]}
        faqs={[
          { q: 'Does Text mode work on scanned PDFs?', a: 'No — Text mode relies on selectable text embedded in the PDF. For image-only scans, use Visual mode which compares the rendered pixels directly.' },
          { q: 'How are "modified" words detected?', a: 'When a removed word sits right next to an added word in the diff stream, PaperKnife treats the pair as a modification and paints both sides amber.' },
          { q: 'What if the documents have different page counts?', a: 'Pages are compared strictly one-to-one. Any page that only exists in one document is shown on its side with a "No matching page" placeholder on the other side.' },
          { q: 'Will the comparison catch font or layout changes?', a: 'Text mode focuses on word changes, so it ignores cosmetic re-layouts. Switch to Visual mode to see any visible difference, including font, layout, color, and image edits.' },
        ]}
      />
      <PrivacyBadge />
    </NativeToolLayout>
  )
}

// ---------- Subcomponents ----------

function SlotDropZone({
  label, sub, slot, state, busy, onBrowse, onDrop, onDragOver, onRemove, onUnlock, unlockInput, setUnlockInput,
}: {
  label: string
  sub: string
  slot: Slot
  state: SlotState | null
  busy: boolean
  onBrowse: () => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onRemove: () => void
  onUnlock: () => void
  unlockInput: string
  setUnlockInput: (v: string) => void
}) {
  if (state && state.isLocked) {
    return (
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 text-center">
        <div className="w-14 h-14 bg-terracotta-100 dark:bg-terracotta-900/30 text-terracotta-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock size={22} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{sub}</p>
        <h3 className="text-base font-bold mb-4 dark:text-white truncate">{state.file.name}</h3>
        <input
          type="password"
          value={unlockInput}
          onChange={(e) => setUnlockInput(e.target.value)}
          placeholder="Password"
          className="w-full bg-gray-50 dark:bg-black rounded-2xl px-4 py-3 border border-transparent focus:border-terracotta-500 outline-none font-bold text-center mb-3 text-sm"
        />
        <button
          onClick={onUnlock}
          disabled={!unlockInput || busy}
          className="w-full bg-terracotta-500 text-white p-3 rounded-2xl font-black uppercase text-xs disabled:opacity-50"
        >
          {busy ? 'Unlocking...' : 'Unlock'}
        </button>
        <button
          onClick={onRemove}
          className="w-full py-2 mt-2 text-[10px] font-black uppercase text-gray-300 hover:text-terracotta-500 transition-colors"
        >
          Remove
        </button>
      </div>
    )
  }

  if (state) {
    return (
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-16 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 rounded-xl flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{sub}</p>
            <h3 className="font-bold text-sm truncate dark:text-white">{state.file.name}</h3>
            <p className="text-[10px] text-gray-400 uppercase font-black mt-0.5">
              {state.pageCount} pages • {(state.file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>
          <button onClick={onRemove} className="p-2 text-gray-400 hover:text-terracotta-500 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 p-3 bg-gray-50 dark:bg-black rounded-2xl border border-gray-100 dark:border-white/5">
          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Ready — waiting for the other side
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onBrowse}
      onDrop={onDrop}
      onDragOver={onDragOver}
      className="border-2 border-dashed border-terracotta-300 dark:border-terracotta-800 rounded-[2rem] p-8 md:p-10 text-center bg-white dark:bg-zinc-900/60 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/10 hover:border-terracotta-400 transition-all cursor-pointer group shadow-clay-sm dark:shadow-none"
    >
      <div className="w-16 h-16 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
        {busy ? <Loader2 className="animate-spin" size={26} /> : slot === 'A' ? <FileText size={26} /> : <GitCompare size={26} />}
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-terracotta-500 mb-1">{sub}</p>
      <h3 className="text-lg font-bold dark:text-white mb-1">{label} PDF</h3>
      <p className="text-xs text-gray-400 font-medium mb-4">Tap to browse or drop a file here</p>
      <span className="inline-flex items-center gap-2 px-5 py-2 bg-terracotta-500 text-white rounded-full text-[11px] font-black uppercase tracking-widest shadow-lg shadow-terracotta-500/20 group-hover:shadow-xl group-hover:scale-105 transition-all">
        <Upload size={12} /> Choose file
      </span>
    </div>
  )
}

function CompareHeader({
  slotA, slotB, mode, setMode, onRemoveA, onRemoveB, onSwap, onExpand, isExpanded,
}: {
  slotA: SlotState
  slotB: SlotState
  mode: Mode
  setMode: (m: Mode) => void
  onRemoveA: () => void
  onRemoveB: () => void
  onSwap: () => void
  onExpand: () => void
  isExpanded: boolean
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-white/5 p-4 md:p-5 space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-center">
        <FileChip label="Original" state={slotA} onRemove={onRemoveA} />
        <button
          onClick={onSwap}
          className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 hover:bg-terracotta-100 dark:hover:bg-terracotta-900/40 transition-colors mx-auto"
          aria-label="Swap sides"
          title="Swap sides"
        >
          <GitCompare size={16} />
        </button>
        <FileChip label="Revised" state={slotB} onRemove={onRemoveB} />
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex p-1 bg-gray-50 dark:bg-black rounded-full border border-gray-100 dark:border-white/5">
          <ModeTab active={mode === 'text'} onClick={() => setMode('text')} icon={<FileText size={14} />} label="Text diff" />
          <ModeTab active={mode === 'visual'} onClick={() => setMode('visual')} icon={<ImageIcon size={14} />} label="Visual diff" />
        </div>
        <button
          onClick={onExpand}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400 hover:text-terracotta-500 hover:border-terracotta-300 dark:hover:border-terracotta-800 transition-colors"
          aria-label={isExpanded ? 'Exit full screen' : 'Enter full screen'}
          title={isExpanded ? 'Exit full screen' : 'Full screen comparison'}
        >
          {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span className="hidden sm:inline">{isExpanded ? 'Exit' : 'Expand'}</span>
        </button>
      </div>
    </div>
  )
}

function FileChip({ label, state, onRemove }: { label: string; state: SlotState; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-black rounded-2xl border border-gray-100 dark:border-white/5">
      <div className="w-9 h-12 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 rounded-lg flex items-center justify-center shrink-0">
        <FileText size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
        <p className="font-bold text-xs dark:text-white truncate">{state.file.name}</p>
        <p className="text-[9px] text-gray-400 uppercase font-black">{state.pageCount} pages</p>
      </div>
      <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-terracotta-500 transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}

function ModeTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${
        active
          ? 'bg-terracotta-500 text-white shadow-lg shadow-terracotta-500/20'
          : 'text-gray-400 hover:text-terracotta-500'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function PageNavigator({
  pageNumber, totalPages, onPrev, onNext, onJump,
}: {
  pageNumber: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
  onJump: (n: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(pageNumber))
  useEffect(() => setDraft(String(pageNumber)), [pageNumber])

  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      <button
        onClick={onPrev}
        disabled={pageNumber <= 1}
        className="p-2.5 rounded-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 text-gray-500 hover:text-terracotta-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft size={18} />
      </button>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => { const n = parseInt(draft || '1', 10); onJump(isNaN(n) ? 1 : n); setEditing(false) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') { setDraft(String(pageNumber)); setEditing(false) }
          }}
          className="w-20 text-center bg-white dark:bg-zinc-900 rounded-full px-3 py-2 border border-terracotta-300 dark:border-terracotta-800 font-black text-sm dark:text-white outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="px-5 py-2 rounded-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 text-sm font-black tracking-widest dark:text-white"
        >
          {pageNumber} <span className="text-gray-300">/</span> {totalPages}
        </button>
      )}
      <button
        onClick={onNext}
        disabled={pageNumber >= totalPages}
        className="p-2.5 rounded-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 text-gray-500 hover:text-terracotta-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Next page"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

function DiffLegend({ mode, visualResult, textDiff }: { mode: Mode; visualResult: VisualDiffResult | null; textDiff: PageTextDiff | null }) {
  const chip = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400">
      <span className={`w-3 h-3 rounded-sm ${cls}`} /> {label}
    </span>
  )
  return (
    <div className="flex items-center justify-center flex-wrap gap-4 text-[10px]">
      {mode === 'text' ? (
        <>
          {chip('bg-rose-400/70', 'Removed')}
          {chip('bg-emerald-400/70', 'Added')}
          {chip('bg-amber-400/70', 'Modified')}
          {textDiff && (
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {textDiff.addedCount} added • {textDiff.removedCount} removed • {textDiff.modifiedCount} modified
            </span>
          )}
        </>
      ) : (
        <>
          {chip('bg-rose-400/70', 'Pixel differences')}
          {visualResult && (
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Similarity {(visualResult.similarity * 100).toFixed(2)}%
            </span>
          )}
        </>
      )}
    </div>
  )
}

type HostSetter = (el: HTMLDivElement | null) => void

function PageColumn({
  title, sub, present, busy, hostRef, overlayWords, canvasWidth, canvasHeight, extraOverlayRef, fill,
}: {
  title: string
  sub: string
  present: boolean
  busy: boolean
  hostRef: HostSetter
  overlayWords: OverlayWord[]
  canvasWidth: number
  canvasHeight: number
  extraOverlayRef?: HostSetter
  fill?: boolean
}) {
  // When `fill` is set, desktop gives each column a bounded height (md:flex-1 md:min-h-0)
  // with its own scroll. On mobile the column stays at natural height and the outer modal
  // body scrolls instead, so tall pages remain fully reachable.
  const rootFill = fill ? 'md:flex md:flex-col md:min-h-0 md:h-full md:flex-1 md:min-w-0' : ''
  const scrollArea = fill
    ? 'min-h-[240px] md:flex-1 md:min-h-0 md:overflow-auto'
    : 'min-h-[240px] overflow-hidden'
  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-white/5 p-3 md:p-4 shadow-sm overflow-hidden ${rootFill}`}>
      <div className="flex items-center justify-between px-2 pb-3 shrink-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-terracotta-500">{title}</p>
        <p className="text-[10px] text-gray-400 font-bold truncate max-w-[60%]">{sub}</p>
      </div>
      <div className={`relative rounded-2xl bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 ${scrollArea}`}>
        {!present ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center mb-3">
              <X size={18} />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-rose-500">No matching page</p>
            <p className="text-[10px] text-gray-400 mt-1">This side has fewer pages.</p>
          </div>
        ) : (
          <div className="relative w-full">
            <div ref={hostRef} />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-sm">
                <Loader2 className="animate-spin text-terracotta-500" size={26} />
              </div>
            )}
            {canvasWidth > 0 && canvasHeight > 0 && overlayWords.length > 0 && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  width: '100%',
                  height: '100%',
                }}
              >
                <div className="relative w-full h-full">
                  {overlayWords.map((w, i) => (
                    <div
                      key={i}
                      className={`absolute rounded-sm mix-blend-multiply ${w.className}`}
                      style={{
                        left: `${(w.x / canvasWidth) * 100}%`,
                        top: `${(w.y / canvasHeight) * 100}%`,
                        width: `${(w.w / canvasWidth) * 100}%`,
                        height: `${(w.h / canvasHeight) * 100}%`,
                      }}
                      title={w.title}
                    />
                  ))}
                </div>
              </div>
            )}
            {extraOverlayRef && <div ref={extraOverlayRef} className="absolute inset-0 pointer-events-none" />}
          </div>
        )}
      </div>
    </div>
  )
}

function ExpandedCompareView({
  slotA, slotB, mode, setMode, pageNumber, totalPages, onPrev, onNext, onJump, onClose,
  pageBusy, pageError, textDiff, visualResult, canvasDims, pageInA, pageInB,
  hostA, hostB, diffOverlayHost,
}: {
  slotA: SlotState
  slotB: SlotState
  mode: Mode
  setMode: (m: Mode) => void
  pageNumber: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
  onJump: (n: number) => void
  onClose: () => void
  pageBusy: boolean
  pageError: string | null
  textDiff: PageTextDiff | null
  visualResult: VisualDiffResult | null
  canvasDims: { wA: number; hA: number; wB: number; hB: number }
  pageInA: boolean
  pageInB: boolean
  hostA: HostSetter
  hostB: HostSetter
  diffOverlayHost: HostSetter
}) {
  return (
    <div className="fixed inset-0 z-[500] bg-[#FFF3F0] dark:bg-black flex flex-col pt-safe pb-safe animate-in fade-in duration-200">
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="hidden md:flex items-center gap-2 min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 truncate">{slotA.file.name}</p>
          <span className="text-gray-300 dark:text-zinc-700">↔</span>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 truncate">{slotB.file.name}</p>
        </div>
        <div className="flex-1 md:flex-none flex items-center justify-center gap-3">
          <div className="inline-flex p-1 bg-gray-50 dark:bg-black rounded-full border border-gray-100 dark:border-white/5">
            <ModeTab active={mode === 'text'} onClick={() => setMode('text')} icon={<FileText size={14} />} label="Text" />
            <ModeTab active={mode === 'visual'} onClick={() => setMode('visual')} icon={<ImageIcon size={14} />} label="Visual" />
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-white/5 text-gray-500 hover:text-terracotta-500 transition-colors"
          aria-label="Exit full screen"
          title="Exit full screen (Esc)"
        >
          <Minimize2 size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-3 md:p-5 gap-3 overflow-auto md:overflow-hidden">
        {pageError && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl text-amber-700 dark:text-amber-300 shrink-0">
            <AlertTriangle size={14} className="shrink-0" />
            <p className="text-[11px] font-bold">{pageError}</p>
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:flex-1 md:min-h-0">
          <PageColumn
            title="Original"
            sub={slotA.file.name}
            present={pageInA}
            busy={pageBusy}
            hostRef={hostA}
            overlayWords={mode === 'text' && textDiff ? buildSideOverlay(textDiff, 'A') : []}
            canvasWidth={canvasDims.wA}
            canvasHeight={canvasDims.hA}
            fill
          />
          <PageColumn
            title="Revised"
            sub={slotB.file.name}
            present={pageInB}
            busy={pageBusy}
            hostRef={hostB}
            overlayWords={mode === 'text' && textDiff ? buildSideOverlay(textDiff, 'B') : []}
            canvasWidth={canvasDims.wB}
            canvasHeight={canvasDims.hB}
            extraOverlayRef={mode === 'visual' ? diffOverlayHost : undefined}
            fill
          />
        </div>
      </div>

      <div className="shrink-0 px-4 md:px-6 py-3 border-t border-gray-100 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <DiffLegend mode={mode} visualResult={visualResult} textDiff={textDiff} />
        <PageNavigator
          pageNumber={pageNumber}
          totalPages={totalPages}
          onPrev={onPrev}
          onNext={onNext}
          onJump={onJump}
        />
      </div>
    </div>
  )
}

// ---------- Helpers ----------

interface OverlayWord {
  x: number
  y: number
  w: number
  h: number
  className: string
  title: string
}

function buildSideOverlay(diff: PageTextDiff, side: Slot): OverlayWord[] {
  const out: OverlayWord[] = []
  for (const op of diff.ops) {
    if (op.op === 'equal') continue
    if (side === 'A' && (op.op === 'remove' || op.op === 'modified') && op.aIndex !== undefined) {
      const box = diff.wordsA[op.aIndex] as WordBox | undefined
      if (!box) continue
      out.push(toOverlay(box, op.op))
    } else if (side === 'B' && (op.op === 'add' || op.op === 'modified') && op.bIndex !== undefined) {
      const box = diff.wordsB[op.bIndex] as WordBox | undefined
      if (!box) continue
      out.push(toOverlay(box, op.op))
    }
  }
  return out
}

function toOverlay(box: WordBox, op: 'add' | 'remove' | 'modified'): OverlayWord {
  const className =
    op === 'add' ? 'bg-emerald-400/40 ring-1 ring-emerald-500/50' :
    op === 'remove' ? 'bg-rose-400/40 ring-1 ring-rose-500/50' :
    'bg-amber-400/40 ring-1 ring-amber-500/50'
  return {
    x: box.x,
    y: box.y,
    w: Math.max(box.w, 2),
    h: Math.max(box.h, 2),
    className,
    title: `${op}: ${box.text}`,
  }
}
