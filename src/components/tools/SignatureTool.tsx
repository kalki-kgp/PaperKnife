import { useState, useRef, useEffect } from 'react'
import { Loader2, Lock, Image as ImageIcon, ArrowRight, PenLine, ChevronLeft, ChevronRight, Eraser, X } from 'lucide-react'
import { PDFDocument, degrees } from 'pdf-lib'
import { toast } from 'sonner'

import { getPdfMetaData, loadPdfDocument, pdfHasEncryptionMarker, renderPageThumbnail, stripPdfEncryption, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import { usePipeline } from '../../utils/pipelineContext'
import SuccessState from './shared/SuccessState'
import ToolSeoContent from './shared/ToolSeoContent'
import { NativeToolLayout } from './shared/NativeToolLayout'

type SignaturePdfData = { file: File, pageCount: number, isLocked: boolean, pdfDoc?: any, password?: string }
type PageView = { src: string, width: number, height: number, rotation: number, toPdfPoint: (x: number, y: number) => number[] }
type DragMode = { kind: 'move' } | { kind: 'resize', startX: number, startWidth: number }

/** Crops a drawn signature to its ink so it can be placed and sized precisely. */
const canvasToTrimmedPng = (canvas: HTMLCanvasElement): Promise<File | null> => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return Promise.resolve(null)
  const pad = 8
  const out = document.createElement('canvas')
  out.width = maxX - minX + 1 + pad * 2
  out.height = maxY - minY + 1 + pad * 2
  out.getContext('2d')?.drawImage(canvas, minX, minY, maxX - minX + 1, maxY - minY + 1, pad, pad, maxX - minX + 1, maxY - minY + 1)
  return new Promise(resolve => out.toBlob(blob => resolve(blob ? new File([blob], 'signature.png', { type: 'image/png' }) : null), 'image/png'))
}

function DrawPad({ onDone, onCancel }: { onDone: (file: File) => void, onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111827'
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const clear = () => {
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }

  const finish = async () => {
    if (!canvasRef.current) return
    const file = await canvasToTrimmedPng(canvasRef.current)
    if (file) onDone(file)
  }

  return (
    <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Draw your signature</span>
        <button onClick={onCancel} aria-label="Cancel drawing" className="p-1 text-gray-400 hover:text-terracotta-500"><X size={16} /></button>
      </div>
      <canvas
        ref={canvasRef}
        // Arbitrary colours on purpose: design variants restyle bg-gray-50 and friends
        // to dark surfaces, which hides the dark ink. The pad stands in for paper.
        className="w-full h-44 bg-[#fafaf9] rounded-2xl border border-dashed border-[#d6d3d1] touch-none cursor-crosshair"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = true
          const ctx = e.currentTarget.getContext('2d'); const { x, y } = point(e)
          ctx?.beginPath(); ctx?.moveTo(x, y); ctx?.lineTo(x + 0.1, y + 0.1); ctx?.stroke()
          setHasInk(true)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const ctx = e.currentTarget.getContext('2d'); const { x, y } = point(e)
          ctx?.lineTo(x, y); ctx?.stroke()
        }}
        onPointerUp={() => { drawing.current = false }}
        onPointerCancel={() => { drawing.current = false }}
      />
      <div className="flex gap-3">
        <button onClick={clear} className="flex-1 p-3 bg-gray-50 dark:bg-zinc-800 dark:text-white rounded-2xl font-black uppercase text-xs border border-gray-100 dark:border-white/5 flex items-center justify-center gap-2"><Eraser size={14} /> Clear</button>
        <button onClick={finish} disabled={!hasInk} className="flex-1 p-3 bg-terracotta-500 text-white rounded-2xl font-black uppercase text-xs disabled:opacity-50">Use Signature</button>
      </div>
    </div>
  )
}

export default function SignatureTool() {
  const fileInputRef = useRef<HTMLInputElement>(null); const signatureInputRef = useRef<HTMLInputElement>(null); const previewRef = useRef<HTMLDivElement>(null)
  const { consumePipelineFile } = usePipeline()
  const [pdfData, setPdfData] = useState<SignaturePdfData | null>(null); const [signatureImg, setSignatureImg] = useState<string | null>(null); const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false); const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-signed')
  const [unlockPassword, setUnlockPassword] = useState(''); const [activePage, setActivePage] = useState(1)
  // Centre of the signature and its width, as fractions of the visible page.
  const [pos, setPos] = useState({ x: 0.5, y: 0.75 }); const [widthFrac, setWidthFrac] = useState(0.25)
  const [pageView, setPageView] = useState<PageView | null>(null); const [isDrawing, setIsDrawing] = useState(false)
  const dragRef = useRef<DragMode | null>(null)

  useEffect(() => {
    const pipelined = consumePipelineFile()
    if (pipelined) {
      const file = new File([pipelined.buffer as any], pipelined.name, { type: 'application/pdf' })
      handleFile(file)
    }
  }, [])

  useEffect(() => {
    const pdfDoc = pdfData?.pdfDoc
    if (!pdfDoc) return
    let cancelled = false
    setPageView(null)
    void (async () => {
      const page = await pdfDoc.getPage(activePage)
      const viewport = page.getViewport({ scale: 1 })
      const src = await renderPageThumbnail(pdfDoc, activePage, 2.0)
      if (cancelled) return
      setPageView({
        src, width: viewport.width, height: viewport.height, rotation: viewport.rotation,
        toPdfPoint: (x, y) => viewport.convertToPdfPoint(x, y)
      })
    })()
    return () => { cancelled = true }
  }, [pdfData?.pdfDoc, activePage])

  // Signature lines are almost always on the last page.
  const openDocument = (base: SignaturePdfData, pdfDoc: any, pageCount: number) => {
    setPdfData({ ...base, isLocked: false, pageCount, pdfDoc })
    setActivePage(pageCount || 1)
  }

  const handleUnlock = async () => {
    if (!pdfData || !unlockPassword) return; setIsProcessing(true)
    try {
      const result = await unlockPdf(pdfData.file, unlockPassword)
      if (result.success) openDocument({ ...pdfData, password: unlockPassword }, result.pdfDoc, result.pageCount)
      else { toast.error('Incorrect password') }
    } finally { setIsProcessing(false) }
  }

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') return; setIsProcessing(true)
    try {
      const meta = await getPdfMetaData(file)
      if (meta.isLocked) {
        // Edit-restricted files open without a password; only ask when one is really needed.
        const pdfDoc = await loadPdfDocument(file).catch(() => null)
        if (pdfDoc) openDocument({ file, pageCount: pdfDoc.numPages, isLocked: false }, pdfDoc, pdfDoc.numPages)
        else setPdfData({ file, pageCount: 0, isLocked: true })
      } else { const pdfDoc = await loadPdfDocument(file); openDocument({ file, pageCount: meta.pageCount, isLocked: false }, pdfDoc, meta.pageCount) }
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const applySignature = (file: File | null) => {
    if (signatureImg) URL.revokeObjectURL(signatureImg)
    setSignatureFile(file); setSignatureImg(file ? URL.createObjectURL(file) : null)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    if (drag.kind === 'move') {
      setPos({ x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) })
    } else {
      // The box is centred on pos, so dragging the corner grows it on both sides.
      const next = drag.startWidth + (2 * (e.clientX - drag.startX)) / rect.width
      setWidthFrac(Math.max(0.05, Math.min(1, next)))
    }
  }

  const saveSignedPdf = async () => {
    if (!pdfData || !signatureFile || !pageView) return; setIsProcessing(true)
    try {
      // pdf-lib cannot decrypt, so encrypted sources are decrypted locally first.
      const sourceBytes = new Uint8Array(await pdfData.file.arrayBuffer())
      const bytes = pdfHasEncryptionMarker(sourceBytes) ? await stripPdfEncryption(pdfData.file, pdfData.password) : sourceBytes
      const pdfDoc = await PDFDocument.load(bytes)
      const sigBytes = await signatureFile.arrayBuffer(); const sigImage = signatureFile.type === 'image/png' ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes)
      const page = pdfDoc.getPages()[activePage - 1]

      // Work in the page's visible (rotated, cropped) space, then map back to PDF user space.
      const widthPt = widthFrac * pageView.width
      const heightPt = widthPt * (sigImage.height / sigImage.width)
      const left = pos.x * pageView.width - widthPt / 2
      const bottom = pos.y * pageView.height + heightPt / 2
      const [x, y] = pageView.toPdfPoint(left, bottom)
      page.drawImage(sigImage, { x, y, width: widthPt, height: heightPt, rotate: degrees(pageView.rotation) })

      const pdfBytes = await pdfDoc.save(); const blob = new Blob([pdfBytes as any], { type: 'application/pdf' }); const url = URL.createObjectURL(blob)
      setDownloadUrl(url); addActivity({ name: `${customFileName}.pdf`, tool: 'Signature', size: blob.size, resultUrl: url })
    } catch (error: any) {
      toast.error(error?.message || 'Could not sign this PDF.')
    } finally { setIsProcessing(false) }
  }

  const closeFile = () => { setPdfData(null); setPageView(null); applySignature(null); setIsDrawing(false) }

  const ActionButton = () => (
    <button onClick={saveSignedPdf} disabled={isProcessing || !signatureImg || !pageView} className={`w-full bg-terracotta-500 hover:bg-terracotta-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-terracotta-500/20 p-6 rounded-3xl text-xl`}>
      {isProcessing ? <Loader2 className="animate-spin" /> : <>Sign & Save <ArrowRight size={18} /></>}
    </button>
  )

  return (
    <NativeToolLayout title="Signature" description="Draw or upload your signature, then drag it into place." actions={pdfData && !pdfData.isLocked && !downloadUrl && <ActionButton />}>
      <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <input type="file" accept="image/png,image/jpeg" className="hidden" ref={signatureInputRef} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) applySignature(file) }} />
      {!pdfData ? (
        <button
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-terracotta-300 dark:border-terracotta-800 rounded-[2.5rem] p-12 md:p-16 text-center bg-white dark:bg-zinc-900/60 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/10 hover:border-terracotta-400 transition-all cursor-pointer group shadow-clay-sm dark:shadow-none"
        >
          <ImageIcon size={32} className="mx-auto mb-4 text-terracotta-500" />
          <h3 className="text-xl font-bold dark:text-white">Select PDF</h3>
        </button>
      ) : pdfData.isLocked ? (
        <div className="max-w-md mx-auto p-8 bg-white dark:bg-zinc-900 rounded-3xl text-center"><Lock size={32} className="mx-auto mb-4 text-terracotta-500" /><input type="password" value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} className="w-full p-4 mb-4 border rounded-xl" /><button onClick={handleUnlock} className="w-full p-4 bg-terracotta-500 text-white rounded-xl">Unlock</button></div>
      ) : (
        <div className="space-y-6" onPointerMove={handlePointerMove} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}>
          {!downloadUrl ? (
            <>
              {pdfData.pageCount > 1 && (
                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => setActivePage(p => Math.max(1, p - 1))} disabled={activePage <= 1} aria-label="Previous page" className="p-2 rounded-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 disabled:opacity-30"><ChevronLeft size={18} /></button>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-500">Page {activePage} of {pdfData.pageCount}</span>
                  <button onClick={() => setActivePage(p => Math.min(pdfData.pageCount, p + 1))} disabled={activePage >= pdfData.pageCount} aria-label="Next page" className="p-2 rounded-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 disabled:opacity-30"><ChevronRight size={18} /></button>
                </div>
              )}
              <div
                ref={previewRef}
                className="relative w-full bg-white rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden touch-none select-none"
                style={{ aspectRatio: pageView ? `${pageView.width} / ${pageView.height}` : '1 / 1.4' }}
                onClick={(e) => { if (!signatureImg) return; const r = e.currentTarget.getBoundingClientRect(); setPos({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }) }}
              >
                {pageView ? <img src={pageView.src} alt="" className="absolute inset-0 w-full h-full pointer-events-none" /> : <div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-terracotta-500" /></div>}
                {signatureImg && pageView && (
                  <div
                    onPointerDown={(e) => { e.stopPropagation(); dragRef.current = { kind: 'move' } }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${widthFrac * 100}%`, transform: 'translate(-50%, -50%)' }}
                    className="absolute cursor-move ring-2 ring-terracotta-500 rounded-sm"
                  >
                    <img src={signatureImg} alt="Your signature" className="w-full pointer-events-none" />
                    <div onPointerDown={(e) => { e.stopPropagation(); dragRef.current = { kind: 'resize', startX: e.clientX, startWidth: widthFrac } }} className="absolute -bottom-2 -right-2 w-6 h-6 bg-terracotta-500 rounded-full border-2 border-white cursor-nwse-resize" />
                  </div>
                )}
              </div>
              {isDrawing ? (
                <DrawPad onDone={(file) => { applySignature(file); setIsDrawing(false) }} onCancel={() => setIsDrawing(false)} />
              ) : (
                <div className="flex gap-4">
                  <button onClick={() => setIsDrawing(true)} className="flex-1 p-4 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-100 dark:border-white/5 rounded-2xl font-black uppercase text-xs hover:border-terracotta-500 transition-all">
                    <span className="flex items-center justify-center gap-2"><PenLine size={16}/> Draw Signature</span>
                  </button>
                  <button onClick={() => signatureInputRef.current?.click()} className="flex-1 p-4 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-100 dark:border-white/5 rounded-2xl font-black uppercase text-xs hover:border-terracotta-500 transition-all">
                    <span className="flex items-center justify-center gap-2"><ImageIcon size={16}/> Upload Image</span>
                  </button>
                </div>
              )}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 px-1">Output Filename</label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-terracotta-500 outline-none font-bold text-sm dark:text-white"
                />
              </div>
            </>
          ) : (
            <SuccessState message="Signed Successfully!" downloadUrl={downloadUrl} fileName={`${customFileName}.pdf`} onStartOver={() => { setDownloadUrl(null); closeFile() }} />
          )}
          <button onClick={closeFile} className="w-full py-2 text-[10px] font-black uppercase text-gray-300 hover:text-terracotta-500 transition-colors">Close File</button>
        </div>
      )}
      <ToolSeoContent
        title="PDF Signature"
        headline="Add Electronic Signatures to PDF Documents"
        description="Sign your PDF documents by drawing your signature or uploading an image of it, then dragging it into place on any page. Everything happens in your browser. No account needed, no data uploaded, fully private."
        benefits={[
          "Add your signature to contracts, forms, and documents instantly.",
          "Draw with your finger, mouse or stylus, or upload a PNG or JPG.",
          "Place and resize the signature on any page.",
          "100% private: your signature and documents stay on your device.",
        ]}
        howItWorks={[
          "Upload the PDF you want to sign.",
          "Draw your signature, or upload an image of it.",
          "Pick the page, then drag and resize the signature into place.",
          "Click Sign & Save and download your signed document.",
        ]}
        faqs={[
          { q: "Is this a legally binding signature?", a: "PaperKnife places an image of your signature on the page. Legal validity depends on your jurisdiction and the type of document. For digital signatures backed by a certificate, specialized software may be required." },
          { q: "Can I place the signature on a specific page?", a: "Yes. Use the page arrows above the preview to pick a page — it opens on the last page, where signature lines usually are — then drag the signature where you want it." },
          { q: "Can I use a handwritten signature image?", a: "Yes. Upload a photo or scan of your signature as PNG or JPG. A PNG with a transparent background looks best." },
          { q: "Is my signature data stored?", a: "No. Your signature is used only during the current session to stamp the PDF. It is never stored, transmitted, or logged." },
        ]}
      />
    </NativeToolLayout>
  )
}
