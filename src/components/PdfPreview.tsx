/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Loader2, Lock, Share2, Unlock, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'
import { loadPdfDocument, renderPageThumbnail, shareFile, unlockPdf } from '../utils/pdfHelpers'
import { PaperKnifeLogo } from './Logo'

interface PdfPreviewProps {
  file: File
  onClose: () => void
  onProcess: () => void
}

const MIN_ZOOM = 0.75
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

const getPreviewRenderMaxDimension = (zoom: number) => {
  if (zoom >= 2.25) return 1800
  if (zoom >= 1.5) return 1500
  return 1200
}

const LazyPage = ({
  pdfDoc,
  pageNum,
  renderMaxDimension,
}: {
  pdfDoc: any
  pageNum: number
  renderMaxDimension: number
}) => {
  const [preview, setPreview] = useState<{ src: string; maxDimension: number } | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pdfDoc || (preview && preview.maxDimension >= renderMaxDimension)) return

    let isCancelled = false

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsRendering(true)
        renderPageThumbnail(pdfDoc, pageNum, 1.0, renderMaxDimension).then(data => {
          if (isCancelled) return
          if (data) setPreview({ src: data, maxDimension: renderMaxDimension })
          setIsRendering(false)
        }).catch(() => {
          if (!isCancelled) setIsRendering(false)
        })
        observer.disconnect()
      }
    }, { rootMargin: '800px' })

    if (containerRef.current) observer.observe(containerRef.current)
    return () => {
      isCancelled = true
      observer.disconnect()
    }
  }, [pdfDoc, pageNum, preview?.maxDimension, renderMaxDimension])

  return (
    <div 
      ref={containerRef}
      data-page-num={pageNum}
      className="relative flex flex-col items-center justify-center snap-center"
    >
      <div className="bg-white p-0.5 rounded-sm shadow-[0_10px_30px_rgba(0,0,0,0.3)] group relative overflow-hidden transition-all duration-500 w-full max-w-[95%] md:max-w-full flex items-center justify-center min-h-[300px]">
        {preview ? (
          <img 
            src={preview.src} 
            alt={`Page ${pageNum}`} 
            className="w-full max-w-full h-auto object-contain select-none" 
          />
        ) : (
          <div className="flex flex-col items-center gap-3 py-20">
             <Loader2 className="w-6 h-6 text-zinc-800 animate-spin" />
          </div>
        )}
        {preview && isRendering && (
          <div className="absolute right-3 top-3 rounded-full bg-zinc-950/70 p-2 text-white shadow-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}

export default function PdfPreview({ file, onClose, onProcess }: PdfPreviewProps) {
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [password, setPassword] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [zoom, setZoom] = useState(1)
  
  const mainRef = useRef<HTMLElement>(null)
  const zoomRef = useRef(zoom)
  const renderMaxDimension = getPreviewRenderMaxDimension(zoom)
  const canZoom = !isLoading && !isLocked && totalPages > 0
  const previewFileKey = `${file.name}-${file.size}-${file.lastModified}`

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const updateZoom = useCallback((nextZoom: number | ((currentZoom: number) => number)) => {
    const previousZoom = zoomRef.current
    const targetZoom = clampZoom(typeof nextZoom === 'function' ? nextZoom(previousZoom) : nextZoom)

    if (targetZoom === previousZoom) return

    const main = mainRef.current
    const centerX = main ? main.scrollLeft + main.clientWidth / 2 : 0
    const centerY = main ? main.scrollTop + main.clientHeight / 2 : 0
    const ratio = targetZoom / previousZoom

    zoomRef.current = targetZoom
    setZoom(targetZoom)

    if (main) {
      window.requestAnimationFrame(() => {
        main.scrollLeft = Math.max(0, centerX * ratio - main.clientWidth / 2)
        main.scrollTop = Math.max(0, centerY * ratio - main.clientHeight / 2)
      })
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setPdfDoc(null)
      setTotalPages(0)
      setCurrentPage(1)
      setIsLocked(false)
      setPassword('')
      setZoom(1)
      zoomRef.current = 1
      if (mainRef.current) {
        mainRef.current.scrollLeft = 0
        mainRef.current.scrollTop = 0
      }
      try {
        const doc = await loadPdfDocument(file)
        setPdfDoc(doc)
        setTotalPages(doc.numPages)
      } catch (err: any) {
        if (err.name === 'PasswordException') {
          setIsLocked(true)
        }
        console.error('Preview load error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [file])

  const handleUnlock = async () => {
    if (!password) return
    setIsUnlocking(true)
    try {
      const result = await unlockPdf(file, password)
      if (result.success) {
        setPdfDoc(result.pdfDoc)
        setTotalPages(result.pageCount)
        setIsLocked(false)
        toast.success('Document unlocked')
      } else {
        toast.error('Incorrect password')
      }
    } catch (e) {
      toast.error('Failed to unlock')
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    // Update current page based on intersection
    const pages = e.currentTarget.querySelectorAll('[data-page-num]')
    pages.forEach(page => {
      const rect = page.getBoundingClientRect()
      if (rect.top < window.innerHeight / 2 && rect.bottom > window.innerHeight / 2) {
        setCurrentPage(Number(page.getAttribute('data-page-num')))
      }
    })
  }

  const handleWheel = (e: React.WheelEvent<HTMLElement>) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    updateZoom((currentZoom) => currentZoom + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP))
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (!event.ctrlKey && !event.metaKey) return

      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        updateZoom((currentZoom) => currentZoom + ZOOM_STEP)
      } else if (event.key === '-') {
        event.preventDefault()
        updateZoom((currentZoom) => currentZoom - ZOOM_STEP)
      } else if (event.key === '0') {
        event.preventDefault()
        updateZoom(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [updateZoom])

  const handleShare = async () => {
    const buffer = await file.arrayBuffer()
    await shareFile(new Uint8Array(buffer), file.name, file.type)
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-[500] bg-zinc-950 flex flex-col animate-in fade-in duration-300 overflow-hidden overscroll-none"
    >
      
      {/* Fixed Header - Always Visible */}
      <header className="fixed top-0 inset-x-0 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 bg-zinc-900/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-50 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            aria-label="Close preview"
            className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 active:bg-white/10 active:text-white transition-all"
          >
            <X size={22} strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
             <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-xl shrink-0">
                <PaperKnifeLogo size={20} iconColor="#E68A73" partColor="#000000" />
             </div>
             <div className="hidden sm:block min-w-0">
                <h2 className="text-sm font-black text-white truncate max-w-[140px] leading-tight">{file.name}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                   <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Secure View</p>
                </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }} 
            aria-label="Share file"
            className="w-10 h-10 flex items-center justify-center bg-white/5 text-zinc-300 rounded-2xl active:bg-white/10 transition-all border border-white/5"
          >
            <Share2 size={18} strokeWidth={2.5} />
          </button>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              onProcess();
            }}
            aria-label="Process with tools"
            className="w-10 h-10 flex items-center justify-center bg-terracotta-500 text-white rounded-2xl shadow-lg shadow-terracotta-500/20 active:scale-95 active:bg-terracotta-600 transition-all border border-terracotta-400/20"
          >
            <Plus size={22} strokeWidth={3} />
          </button>
        </div>
      </header>

      {/* Main Content - Scrollable List of Pages */}
      <main 
        ref={mainRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        className="flex-1 overflow-auto bg-zinc-950 scrollbar-hide overscroll-none"
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      >
        <div className="min-h-full flex flex-col items-center pt-32 pb-48 space-y-12">
          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-terracotta-500 animate-spin" />
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Decoding Layers...</p>
            </div>
          )}

          {isLocked ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="w-20 h-20 bg-terracotta-500/10 text-terracotta-500 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner border border-terracotta-500/20">
                <Lock size={32} />
              </div>
              <h3 className="text-2xl font-black text-white tracking-tighter mb-3">Layer Protected</h3>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed mb-8">This document is encrypted. Enter the password to view the contents.</p>
              
              <div className="w-full max-w-xs space-y-3 mb-10">
                 <input 
                   type="password" 
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                   placeholder="Enter Password"
                   className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-center outline-none focus:border-terracotta-500 transition-all"
                   autoFocus
                 />
                 <button 
                   onClick={handleUnlock}
                   disabled={!password || isUnlocking}
                   className="w-full py-4 bg-terracotta-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   {isUnlocking ? <Loader2 className="animate-spin" size={16} /> : <Unlock size={16} />} 
                   Unlock Layer
                 </button>
              </div>

              <button 
                onClick={onProcess} 
                className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.2em] hover:text-white transition-colors"
              >
                Tool Selection
              </button>
            </div>
          ) : (
            <div
              className="mx-auto space-y-12 px-4 transition-[width,max-width] duration-200 ease-out"
              style={{
                width: `${zoom * 100}%`,
                maxWidth: `${zoom * 48}rem`,
              }}
            >
              {Array.from({ length: totalPages }).map((_, idx) => (
                <LazyPage 
                  key={`${previewFileKey}-${idx}`} 
                  pdfDoc={pdfDoc} 
                  pageNum={idx + 1} 
                  renderMaxDimension={renderMaxDimension}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Fixed Status Bar - Always Visible */}
      <footer className="fixed bottom-0 inset-x-0 px-3 sm:px-6 py-3 bg-zinc-900/95 backdrop-blur-xl border-t border-white/5 grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 z-50 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]" onClick={(e) => e.stopPropagation()}>
         <div className="hidden sm:flex items-center gap-2 opacity-60 min-w-0">
            <span>{(file.size / (1024*1024)).toFixed(2)} MB</span>
            <span className="opacity-30">•</span>
            <span>PDF Document</span>
         </div>
         <div className={`flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-1 shadow-2xl shadow-black/30 ${canZoom ? '' : 'opacity-40'}`}>
            <button
              type="button"
              onClick={() => updateZoom((currentZoom) => currentZoom - ZOOM_STEP)}
              disabled={!canZoom || zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              title="Zoom out"
              className="w-11 h-11 flex items-center justify-center rounded-xl text-zinc-300 transition-all active:scale-95 hover:bg-white/10 disabled:opacity-30 disabled:active:scale-100"
            >
              <ZoomOut size={19} strokeWidth={2.5} />
            </button>
            <div className="min-w-16 px-2 text-center text-[10px] font-black tracking-wider text-white tabular-nums" aria-live="polite">
              {Math.round(zoom * 100)}%
            </div>
            <button
              type="button"
              onClick={() => updateZoom((currentZoom) => currentZoom + ZOOM_STEP)}
              disabled={!canZoom || zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              title="Zoom in"
              className="w-11 h-11 flex items-center justify-center rounded-xl text-zinc-300 transition-all active:scale-95 hover:bg-white/10 disabled:opacity-30 disabled:active:scale-100"
            >
              <ZoomIn size={19} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => updateZoom(1)}
              disabled={!canZoom || zoom === 1}
              aria-label="Fit to width"
              title="Fit to width"
              className="w-11 h-11 flex items-center justify-center rounded-xl text-zinc-300 transition-all active:scale-95 hover:bg-white/10 disabled:opacity-30 disabled:active:scale-100"
            >
              <Maximize2 size={18} strokeWidth={2.5} />
            </button>
         </div>
         <div className="text-right text-zinc-400 font-bold tracking-[0.1em]">
            {currentPage} / {totalPages}
         </div>
      </footer>
    </div>,
    document.body
  )
}
