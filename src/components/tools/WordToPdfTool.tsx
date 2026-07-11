import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2, Upload, ArrowRight, AlertTriangle } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { renderAsync } from 'docx-preview'
import html2canvas from 'html2canvas'
import { toast } from 'sonner'

import { addActivity } from '../../utils/recentActivity'
import SuccessState from './shared/SuccessState'
import ToolSeoContent from './shared/ToolSeoContent'
import { NativeToolLayout } from './shared/NativeToolLayout'

const DOCX_EXT = /\.docx$/i
const CSS_PX_TO_PT = 72 / 96

function isDocxFile(file: File) {
  return (
    DOCX_EXT.test(file.name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
}

async function canvasToPngBytes(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Failed to rasterize page')
  return new Uint8Array(await blob.arrayBuffer())
}

export default function WordToPdfTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-word-to-pdf')

  const handleFile = (selected: File | null) => {
    if (!selected) return
    if (!isDocxFile(selected)) {
      toast.error('Select a Word document (.docx)')
      return
    }
    setDownloadUrl(null)
    setCustomFileName(selected.name.replace(DOCX_EXT, '') || 'paperknife-word-to-pdf')
    setFile(selected)
  }

  // Render the .docx into a live preview; the same DOM is later rasterized to PDF.
  useEffect(() => {
    if (!file) return
    const container = previewRef.current
    if (!container) return

    let cancelled = false
    setIsRendering(true)
    container.innerHTML = ''

    file
      .arrayBuffer()
      .then(buffer =>
        renderAsync(buffer, container, undefined, {
          className: 'docx',
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        })
      )
      .catch(err => {
        if (cancelled) return
        console.error('docx render failed:', err)
        toast.error('Could not read this Word document. It may be corrupted or an unsupported format.')
        setFile(null)
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false)
      })

    return () => {
      cancelled = true
    }
  }, [file])

  const convertToPdf = useCallback(async () => {
    const container = previewRef.current
    if (!container) return

    const pages = Array.from(container.querySelectorAll<HTMLElement>('section.docx'))
    const targets = pages.length > 0 ? pages : Array.from(container.querySelectorAll<HTMLElement>('.docx-wrapper'))
    if (targets.length === 0) {
      toast.error('Nothing to convert yet — the document is still loading.')
      return
    }

    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 50))

    try {
      const pdfDoc = await PDFDocument.create()

      for (const target of targets) {
        const canvas = await html2canvas(target, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        })
        const pngBytes = await canvasToPngBytes(canvas)
        const pngImage = await pdfDoc.embedPng(pngBytes)

        const widthPt = target.offsetWidth * CSS_PX_TO_PT
        const heightPt = target.offsetHeight * CSS_PX_TO_PT
        const page = pdfDoc.addPage([widthPt, heightPt])
        page.drawImage(pngImage, { x: 0, y: 0, width: widthPt, height: heightPt })
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      addActivity({ name: `${customFileName}.pdf`, tool: 'Word to PDF', size: blob.size, resultUrl: url })
    } catch (error) {
      console.error('Word to PDF conversion failed:', error)
      toast.error('Conversion failed. Please try a different document.')
    } finally {
      setIsProcessing(false)
    }
  }, [customFileName])

  const reset = () => {
    setFile(null)
    setDownloadUrl(null)
    if (previewRef.current) previewRef.current.innerHTML = ''
  }

  const ActionButton = () => (
    <button
      onClick={convertToPdf}
      disabled={isProcessing || isRendering}
      className="w-full bg-terracotta-500 hover:bg-terracotta-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-terracotta-500/20 p-6 rounded-3xl text-xl"
    >
      {isProcessing ? (
        <><Loader2 className="animate-spin" /> Working...</>
      ) : isRendering ? (
        <><Loader2 className="animate-spin" /> Reading document...</>
      ) : (
        <>Convert to PDF <ArrowRight size={18} /></>
      )}
    </button>
  )

  return (
    <NativeToolLayout
      title="Word to PDF"
      description="Convert Word documents into a shareable PDF, entirely on your device."
      actions={file && !downloadUrl && <ActionButton />}
    >
      <input
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        ref={fileInputRef}
        onChange={e => handleFile(e.target.files?.[0] ?? null)}
      />

      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-terracotta-300 dark:border-terracotta-800 rounded-[2.5rem] p-12 md:p-16 text-center bg-white dark:bg-zinc-900/60 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/10 hover:border-terracotta-400 transition-all cursor-pointer group shadow-clay-sm dark:shadow-none"
        >
          <div className="w-20 h-20 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
            <Upload size={32} />
          </div>
          <h3 className="text-xl font-bold dark:text-white mb-2">Select a Word document</h3>
          <p className="text-sm text-gray-400">.docx files only</p>
        </div>
      ) : !downloadUrl ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-1">
            <p className="text-[10px] font-black uppercase text-gray-400 truncate max-w-[60%]">{file.name}</p>
            <button onClick={reset} className="text-[10px] font-black uppercase text-terracotta-500/60">Clear</button>
          </div>

          <div className="rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-100 dark:bg-zinc-950 overflow-auto max-h-[520px] shadow-inner p-1">
            <div ref={previewRef} className="wordToPdfPreview" />
            {isRendering && (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm font-bold">
                <Loader2 className="animate-spin" size={18} /> Rendering preview…
              </div>
            )}
          </div>

          <div className="flex gap-2 items-start p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Best-effort conversion. The PDF keeps the document's look but text is rendered as an image (not selectable).
              Complex tables, multi-column layouts, and embedded fonts may differ from Word.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Filename</label>
            <input
              type="text"
              value={customFileName}
              onChange={e => setCustomFileName(e.target.value)}
              className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-terracotta-500 outline-none font-bold text-sm"
            />
          </div>

          <ActionButton />
        </div>
      ) : (
        <SuccessState
          message="PDF Ready!"
          downloadUrl={downloadUrl}
          fileName={`${customFileName}.pdf`}
          onStartOver={reset}
        />
      )}

      <ToolSeoContent
        title="Word to PDF"
        headline="Convert Word Documents to PDF"
        description="Turn Microsoft Word (.docx) documents into clean, shareable PDFs right in your browser. PaperKnife parses and renders your document entirely on-device — no uploads, no account, no waiting. Ideal for sending résumés, reports, and letters as tamper-resistant PDFs."
        benefits={[
          'Convert .docx files to PDF without installing Microsoft Word.',
          'Everything runs locally — your document never leaves your device.',
          'Preserves the visual layout of typical text documents.',
          'Free, private, and works offline once loaded.',
        ]}
        howItWorks={[
          'Select or drop a Word (.docx) document.',
          'Preview how the document will look as a PDF.',
          "Click 'Convert to PDF' to generate the file on your device.",
          'Download or share your new PDF.',
        ]}
        faqs={[
          { q: 'Which Word formats are supported?', a: 'PaperKnife supports the modern .docx format. Legacy .doc files should be re-saved as .docx in Word or Google Docs first.' },
          { q: 'Is the PDF text selectable?', a: 'This tool renders each page as a high-resolution image for faithful layout, so text is not selectable. It is ideal for sharing and printing.' },
          { q: 'Will my formatting be preserved?', a: 'Typical documents — headings, paragraphs, lists, and images — render closely to the original. Complex tables, multi-column layouts, and embedded fonts may differ slightly.' },
          { q: 'Are my files uploaded anywhere?', a: 'No. Parsing and conversion happen entirely in your browser. No file bytes are ever sent to a server.' },
        ]}
      />
    </NativeToolLayout>
  )
}
