import { Download, Eye, CheckCircle2, Share2, RotateCcw, FileText, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { downloadFile, shareFile } from '../../../utils/pdfHelpers'
import { Capacitor } from '@capacitor/core'
import { hapticSuccess } from '../../../utils/haptics'
import PdfPreview from '../../PdfPreview'

interface SuccessStateProps {
  message: string
  downloadUrl: string
  fileName: string
  onStartOver: () => void
  showPreview?: boolean
}

export default function SuccessState({ message, downloadUrl, fileName, onStartOver, showPreview = true }: SuccessStateProps) {
  const [internalPreviewFile, setInternalPreviewFile] = useState<File | null>(null)
  const [promoDismissed, setPromoDismissed] = useState(() => localStorage.getItem('resumate_promo_dismissed') === '1')
  const isNative = Capacitor.isNativePlatform()

  useEffect(() => {
    hapticSuccess()
    
    // Auto-Download Logic
    const shouldAutoDownload = localStorage.getItem('autoDownload') === 'true'
    if (shouldAutoDownload) {
      const triggerAutoDownload = async () => {
        try {
          const response = await fetch(downloadUrl)
          const blob = await response.blob()
          const buffer = await blob.arrayBuffer()
          const mimeType = fileName.endsWith('.zip') ? 'application/zip' : 'application/pdf'
          await downloadFile(new Uint8Array(buffer), fileName, mimeType)
          toast.success(`Auto-saved as ${fileName}`)
        } catch (e) {
          console.error('Auto-download failed:', e)
        }
      }
      triggerAutoDownload()
    }
  }, [downloadUrl, fileName])

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      toast.loading(`Saving ${fileName}...`, { id: 'save-action' })
      const response = await fetch(downloadUrl)
      const blob = await response.blob()
      const buffer = await blob.arrayBuffer()
      const mimeType = fileName.endsWith('.zip') ? 'application/zip' : 'application/pdf'
      
      await downloadFile(new Uint8Array(buffer), fileName, mimeType)
      toast.success(`Saved to Documents as ${fileName}`, { id: 'save-action' })
    } catch (err) {
      toast.error('Failed to save file', { id: 'save-action' })
    }
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      toast.loading('Preparing to share...', { id: 'share-action' })
      const response = await fetch(downloadUrl)
      const blob = await response.blob()
      const buffer = await blob.arrayBuffer()
      const mimeType = fileName.endsWith('.zip') ? 'application/zip' : 'application/pdf'
      
      await shareFile(new Uint8Array(buffer), fileName, mimeType)
      toast.dismiss('share-action')
    } catch (err) {
      toast.error('Failed to share file', { id: 'share-action' })
    }
  }

  const handlePreview = async () => {
    try {
      toast.loading('Loading preview...', { id: 'preview-load' })
      const response = await fetch(downloadUrl)
      const blob = await response.blob()
      const mimeType = fileName.endsWith('.zip') ? 'application/zip' : 'application/pdf'
      const file = new File([blob], fileName, { type: mimeType })
      setInternalPreviewFile(file)
      toast.dismiss('preview-load')
    } catch (e) {
      toast.error('Failed to open preview')
    }
  }

  return (
    <div className="animate-in slide-in-from-bottom duration-500 fade-in space-y-6">
      {internalPreviewFile && (
        <PdfPreview 
          file={internalPreviewFile} 
          onClose={() => setInternalPreviewFile(null)} 
          onProcess={() => {
            const file = internalPreviewFile;
            setInternalPreviewFile(null);
            // Handoff to global Quick Drop selector after unmounting internal preview
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-quick-drop', { 
                detail: { file } 
              }))
            }, 100);
          }} 
        />
      )}

      <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 md:p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs md:text-sm border border-green-100 dark:border-green-900/30">
        <CheckCircle2 size={16} /> {message}
      </div>
      
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          {showPreview && (
            <button 
              onClick={handlePreview}
              className="flex-1 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white border border-gray-200 dark:border-zinc-800 p-4 rounded-2xl md:rounded-3xl shadow-sm font-black text-sm md:text-xl tracking-tight transition-all hover:bg-gray-50 active:scale-95 flex items-center justify-center gap-2"
            >
              <Eye size={20} /> Preview
            </button>
          )}
          
          <button 
            onClick={handleShare}
            className="flex-1 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 border border-terracotta-100 dark:border-terracotta-900/30 p-4 rounded-2xl md:rounded-3xl shadow-sm font-black text-sm md:text-xl tracking-tight transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Share2 size={20} /> Share
          </button>
        </div>
        
        <button 
          onClick={handleDownload}
          className="w-full bg-gray-900 dark:bg-white text-white dark:text-black p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl font-black text-lg md:text-xl tracking-tight transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-3"
        >
          <Download size={24} /> {isNative ? 'Save to Device' : 'Download'}
        </button>
      </div>

      {/* ResuMate Cross-Promo */}
      {!promoDismissed && !isNative && (
        <div className="relative mt-2 rounded-2xl bg-gradient-to-br from-[#faf7f2] to-[#fff1e8] dark:from-zinc-900 dark:to-zinc-800 border border-[rgba(201,100,66,0.15)] dark:border-zinc-700 p-5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#c96442] to-[#2d5a3d]" />
          <button
            onClick={() => { localStorage.setItem('resumate_promo_dismissed', '1'); setPromoDismissed(true); }}
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-[#2d5a3d] dark:text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#2d5a3d] dark:text-emerald-400">From PaperKnife</span>
          </div>
          <p className="text-sm font-bold text-[#2c1810] dark:text-white mb-1">Need a job-ready resume?</p>
          <p className="text-xs text-[#8b7355] dark:text-zinc-400 leading-relaxed mb-3">
            ResuMate uses AI to build ATS-friendly resumes in minutes. Upload, analyze, and craft the one that gets you hired.
          </p>
          <a
            href="https://resumate.paperknife.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#c96442] to-[#2d5a3d] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-[#c96442]/20 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 no-underline"
          >
            <FileText size={13} />
            Try ResuMate — Free
          </a>
        </div>
      )}

      <button
        onClick={onStartOver}
        className="w-full mt-6 py-4 bg-gray-50 dark:bg-zinc-900 text-gray-400 hover:text-terracotta-500 dark:hover:text-terracotta-500 rounded-2xl border border-gray-100 dark:border-white/5 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
      >
        <RotateCcw size={14} /> Start New Session
      </button>
    </div>
  )
}