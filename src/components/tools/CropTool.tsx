/**
 * PaperKnife - Crop PDF Tool
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useRef, useState } from 'react'
import { Crop, Loader2, Lock, RefreshCcw, ScissorsLineDashed, X } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { toast } from 'sonner'

import { getPdfMetaData, loadPdfDocument, renderPageThumbnail, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import { usePipeline } from '../../utils/pipelineContext'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'
import ToolSeoContent from './shared/ToolSeoContent'
import { NativeToolLayout } from './shared/NativeToolLayout'

type CropPdfData = {
  file: File
  pageCount: number
  isLocked: boolean
  pdfDoc?: any
  password?: string
  thumbnail?: string
}

type CropMargins = {
  top: number
  right: number
  bottom: number
  left: number
}

const defaultMargins: CropMargins = { top: 8, right: 8, bottom: 8, left: 8 }
const minRemainingPercent = 15
const presets: Array<{ label: string, margins: CropMargins }> = [
  { label: 'Reset', margins: { top: 0, right: 0, bottom: 0, left: 0 } },
  { label: 'Light', margins: { top: 5, right: 5, bottom: 5, left: 5 } },
  { label: 'Medium', margins: defaultMargins },
  { label: 'Wide', margins: { top: 12, right: 12, bottom: 12, left: 12 } },
]

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const numberValue = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const CropPreview = ({ pdfDoc, margins }: { pdfDoc: any, margins: CropMargins }) => {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    setSrc(null)
    if (!pdfDoc) return
    renderPageThumbnail(pdfDoc, 1, 1.0).then(setSrc)
  }, [pdfDoc])

  const overlayStyle = {
    top: `${margins.top}%`,
    right: `${margins.right}%`,
    bottom: `${margins.bottom}%`,
    left: `${margins.left}%`
  }

  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-gray-100 dark:border-white/5 bg-gray-100 dark:bg-black shadow-inner">
      <div className={`relative flex items-center justify-center ${src ? '' : 'aspect-[3/4]'}`}>
        {src ? (
          <div className="relative w-full bg-white">
            <img src={src} alt="Crop preview" className="block w-full h-auto" />
            <div className="absolute inset-0 bg-black/35 pointer-events-none" />
            <div className="absolute border-2 border-terracotta-500 bg-terracotta-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)] pointer-events-none" style={overlayStyle}>
              <div className="absolute -top-7 left-2 rounded-full bg-terracotta-500 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-lg">
                Kept Area
              </div>
              <div className="absolute -left-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-terracotta-500" />
              <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-terracotta-500" />
              <div className="absolute -bottom-1 -left-1 h-4 w-4 rounded-full border-2 border-white bg-terracotta-500" />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-terracotta-500" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">Rendering Preview</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CropTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { consumePipelineFile } = usePipeline()
  const [pdfData, setPdfData] = useState<CropPdfData | null>(null)
  const [margins, setMargins] = useState<CropMargins>(defaultMargins)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingMeta, setIsLoadingMeta] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-cropped')
  const [unlockPassword, setUnlockPassword] = useState('')

  useEffect(() => {
    const pipelined = consumePipelineFile()
    if (pipelined) {
      const file = new File([pipelined.buffer as any], pipelined.name, { type: 'application/pdf' })
      handleFile(file)
    }
  }, [])

  const updateMargin = (side: keyof CropMargins, value: number) => {
    setMargins((current) => {
      const next = { ...current, [side]: clamp(value, 0, 80) }
      if (next.left + next.right > 100 - minRemainingPercent) {
        next[side === 'left' ? 'right' : 'left'] = 100 - minRemainingPercent - next[side]
      }
      if (next.top + next.bottom > 100 - minRemainingPercent) {
        next[side === 'top' ? 'bottom' : 'top'] = 100 - minRemainingPercent - next[side]
      }
      return {
        top: clamp(next.top, 0, 80),
        right: clamp(next.right, 0, 80),
        bottom: clamp(next.bottom, 0, 80),
        left: clamp(next.left, 0, 80)
      }
    })
    setDownloadUrl(null)
  }

  const applyPreset = (presetMargins: CropMargins) => {
    setMargins(presetMargins)
    setDownloadUrl(null)
  }

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') return
    setIsLoadingMeta(true)
    try {
      const meta = await getPdfMetaData(file)
      if (meta.isLocked) {
        setPdfData({ file, pageCount: 0, isLocked: true })
      } else {
        const pdfDoc = await loadPdfDocument(file)
        setPdfData({ file, pageCount: meta.pageCount, isLocked: false, pdfDoc, thumbnail: meta.thumbnail })
        setCustomFileName(`${file.name.replace(/\.pdf$/i, '')}-cropped`)
        setMargins(defaultMargins)
      }
    } catch (error: any) {
      toast.error(error.message || 'Could not read this PDF')
    } finally {
      setIsLoadingMeta(false)
      setDownloadUrl(null)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
    if (e.target) e.target.value = ''
  }

  const handleUnlock = async () => {
    if (!pdfData || !unlockPassword) return
    setIsLoadingMeta(true)
    const result = await unlockPdf(pdfData.file, unlockPassword)
    if (result.success) {
      setPdfData({
        ...pdfData,
        isLocked: false,
        pageCount: result.pageCount,
        pdfDoc: result.pdfDoc,
        password: unlockPassword,
        thumbnail: result.thumbnail
      })
      setCustomFileName(`${pdfData.file.name.replace(/\.pdf$/i, '')}-cropped`)
      setMargins(defaultMargins)
    } else {
      toast.error('Incorrect password')
    }
    setIsLoadingMeta(false)
  }

  const cropPDF = async () => {
    if (!pdfData) return
    if (margins.left + margins.right > 100 - minRemainingPercent || margins.top + margins.bottom > 100 - minRemainingPercent) {
      toast.error('Crop area is too small')
      return
    }

    setIsProcessing(true)
    try {
      const arrayBuffer = await pdfData.file.arrayBuffer()
      const sourceDoc = await PDFDocument.load(arrayBuffer, { password: pdfData.password || undefined, ignoreEncryption: true } as any)
      const outputDoc = await PDFDocument.create()

      for (const sourcePage of sourceDoc.getPages()) {
        const { width, height } = sourcePage.getSize()
        const left = width * (margins.left / 100)
        const right = width * (1 - margins.right / 100)
        const bottom = height * (margins.bottom / 100)
        const top = height * (1 - margins.top / 100)
        const cropWidth = right - left
        const cropHeight = top - bottom

        if (cropWidth <= 0 || cropHeight <= 0) throw new Error('Crop area is too small')

        const embeddedPage = await outputDoc.embedPage(sourcePage, { left, right, bottom, top })
        const newPage = outputDoc.addPage([cropWidth, cropHeight])
        newPage.drawPage(embeddedPage, { x: 0, y: 0, width: cropWidth, height: cropHeight })
      }

      const pdfBytes = await outputDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      addActivity({ name: `${customFileName || 'cropped'}.pdf`, tool: 'Crop', size: blob.size, resultUrl: url })
    } catch (error: any) {
      toast.error(error.message || 'Error cropping PDF')
    } finally {
      setIsProcessing(false)
    }
  }

  const ActionButton = () => (
    <button
      onClick={cropPDF}
      disabled={isProcessing}
      className="w-full bg-terracotta-500 hover:bg-terracotta-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-terracotta-500/20 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl"
    >
      {isProcessing ? <Loader2 className="animate-spin" /> : <Crop size={20} />}
      Crop PDF
    </button>
  )

  return (
    <NativeToolLayout
      title="Crop PDF"
      description="Remove margins from every page with a local hard-crop rebuild."
      actions={pdfData && !pdfData.isLocked && !downloadUrl && <ActionButton />}
    >
      <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />

      {!pdfData ? (
        <button
          onClick={() => !isLoadingMeta && fileInputRef.current?.click()}
          className={`w-full border-2 border-dashed border-terracotta-300 dark:border-terracotta-800 rounded-[2.5rem] p-12 md:p-16 text-center bg-white dark:bg-zinc-900/60 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/10 hover:border-terracotta-400 transition-all cursor-pointer group shadow-clay-sm dark:shadow-none ${isLoadingMeta ? 'opacity-50 cursor-wait' : ''}`}
        >
          {isLoadingMeta ? (
            <div className="flex flex-col items-center">
              <Loader2 size={48} className="text-terracotta-500 animate-spin mb-4" />
              <h3 className="text-xl font-bold mb-2 dark:text-white">Analyzing PDF...</h3>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Crop size={32} />
              </div>
              <h3 className="text-xl font-bold dark:text-white mb-2">Select PDF File</h3>
              <p className="text-sm text-gray-400 font-medium">Tap to browse or drag and drop here</p>
              <span className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-terracotta-500 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-terracotta-500/20 group-hover:shadow-xl group-hover:scale-105 transition-all">Choose File</span>
            </>
          )}
        </button>
      ) : pdfData.isLocked ? (
        <div className="max-w-md mx-auto relative z-[100]">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 text-center shadow-2xl">
            <div className="w-16 h-16 bg-terracotta-100 dark:bg-terracotta-900/30 text-terracotta-500 rounded-full flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
            <h3 className="text-2xl font-bold mb-2 dark:text-white">Protected File</h3>
            <input type="password" value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} placeholder="Password" className="w-full bg-gray-50 dark:bg-black rounded-2xl px-6 py-4 border border-transparent focus:border-terracotta-500 outline-none font-bold text-center mb-4 dark:text-white" />
            <button onClick={handleUnlock} disabled={!unlockPassword || isLoadingMeta} className="w-full bg-terracotta-500 text-white p-4 rounded-2xl font-black uppercase text-xs disabled:opacity-50">Unlock</button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 flex items-center gap-6 shadow-sm">
            <div className="w-12 h-16 bg-gray-50 dark:bg-black rounded-xl overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-terracotta-500 shadow-inner">
              {pdfData.thumbnail ? <img src={pdfData.thumbnail} className="w-full h-full object-cover" alt="" /> : <Crop size={24} />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h3 className="font-bold text-sm truncate dark:text-white">{pdfData.file.name}</h3>
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{pdfData.pageCount} Pages • {(pdfData.file.size / (1024 * 1024)).toFixed(1)} MB</p>
            </div>
            <button onClick={() => setPdfData(null)} className="p-2 text-gray-400 hover:text-terracotta-500 transition-colors"><X size={20} /></button>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center shrink-0">
              <ScissorsLineDashed size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight leading-none mb-1">Hard crop rebuild</h4>
              <p className="text-xs text-amber-700/70 dark:text-amber-400/70 font-bold">The same crop applies to every page and creates new page sizes from the kept area.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.75fr] gap-6">
            <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h4 className="font-black uppercase tracking-widest text-[10px] text-gray-400">Visual Crop Preview</h4>
                <button onClick={() => applyPreset(defaultMargins)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-terracotta-500">
                  <RefreshCcw size={12} /> Reset
                </button>
              </div>
              <CropPreview pdfDoc={pdfData.pdfDoc} margins={margins} />
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm space-y-6">
              {!downloadUrl ? (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Output Filename</label>
                    <input type="text" value={customFileName} onChange={(e) => setCustomFileName(e.target.value)} className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-terracotta-500 outline-none font-bold text-sm dark:text-white" />
                  </div>

                  <div>
                    <p className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Margin Presets</p>
                    <div className="grid grid-cols-2 gap-2">
                      {presets.map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => applyPreset(preset.margins)}
                          className="rounded-xl bg-gray-50 dark:bg-black px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-colors hover:bg-terracotta-50 hover:text-terracotta-500 dark:hover:bg-terracotta-900/20"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(Object.keys(margins) as Array<keyof CropMargins>).map((side) => (
                      <div key={side}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{side}</label>
                          <input
                            type="number"
                            min="0"
                            max="80"
                            value={margins[side]}
                            onChange={(e) => updateMargin(side, numberValue(e.target.value))}
                            className="w-16 rounded-lg bg-gray-50 dark:bg-black px-2 py-1 text-right text-[11px] font-black text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-terracotta-500/20"
                          />
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="60"
                          value={margins[side]}
                          onChange={(e) => updateMargin(side, numberValue(e.target.value))}
                          className="w-full accent-terracotta-500"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-gray-50 dark:bg-black p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Kept Area</p>
                    <p className="text-xl font-black text-terracotta-500">
                      {Math.round(100 - margins.left - margins.right)}% x {Math.round(100 - margins.top - margins.bottom)}%
                    </p>
                  </div>
                </>
              ) : (
                <SuccessState message="PDF Cropped Successfully!" downloadUrl={downloadUrl} fileName={`${customFileName || 'cropped'}.pdf`} onStartOver={() => { setDownloadUrl(null); setPdfData(null); }} />
              )}
              <button onClick={() => { setPdfData(null); setDownloadUrl(null); }} className="w-full py-2 text-[10px] font-black uppercase text-gray-300 hover:text-terracotta-500 transition-colors">Close File</button>
            </div>
          </div>
        </div>
      )}

      <ToolSeoContent
        title="Crop PDF"
        headline="Crop PDF Margins Without Uploading"
        description="Remove unwanted white space, scanner borders, and presentation margins from every page. PaperKnife rebuilds the PDF locally with the selected area as the new page size."
        benefits={[
          "Crop all pages with one consistent visual selection.",
          "Hard-crop rebuild creates new page dimensions instead of only hiding margins.",
          "Useful for scanned notes, slides, receipts, and documents with large borders.",
          "100% local: your PDF never leaves your device.",
        ]}
        howItWorks={[
          "Upload the PDF you want to crop.",
          "Choose margin presets or fine-tune top, right, bottom, and left margins.",
          "Preview the kept area on the first page.",
          "Download the rebuilt cropped PDF.",
        ]}
        faqs={[
          { q: "Does Crop PDF apply to every page?", a: "Yes. This first version applies the same crop rectangle to all pages so multi-page documents stay consistent." },
          { q: "Is this a real crop or just hidden margins?", a: "PaperKnife rebuilds pages from the selected area so the output page size matches the kept region. It is not only setting a viewer crop box." },
          { q: "Will annotations or form fields survive?", a: "Hard-cropping may flatten or drop annotations and form fields because pages are rebuilt from their visible content. Normal text and images are preserved." },
          { q: "Can I crop one page differently?", a: "Not yet. For now, use one crop for the whole document. You can request per-page crop controls from the Feedback page." },
        ]}
      />
      <PrivacyBadge />
    </NativeToolLayout>
  )
}
