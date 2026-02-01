import { useState, useRef } from 'react'
import { Loader2, Wrench, ShieldAlert } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { toast } from 'sonner'

import { addActivity } from '../../utils/recentActivity'
import ToolHeader from './shared/ToolHeader'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'

export default function RepairTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') return
    setIsProcessing(true)
    setFileName(file.name)
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      // PDF-Lib's load function automatically attempts to repair minor syntax errors
      // and rebuilds the cross-reference table upon save.
      const pdfDoc = await PDFDocument.load(arrayBuffer, { 
        ignoreEncryption: true,
        throwOnInvalidObject: false 
      } as any)
      
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      
      setDownloadUrl(url)
      addActivity({
        name: `repaired-${file.name}`,
        tool: 'Repair',
        size: blob.size,
        resultUrl: url
      })
      toast.success('PDF rebuilt successfully!')
    } catch (error: any) {
      toast.error(`Could not repair PDF: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex-1">
      <main className="max-w-4xl mx-auto px-6 py-6 md:py-10">
        <ToolHeader 
          title="Repair" 
          highlight="PDF" 
          description="Attempt to fix corrupted or unreadable PDF files by rebuilding their internal structure." 
        />

        <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

        {!downloadUrl ? (
          <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-4 border-dashed border-gray-200 dark:border-zinc-800 rounded-[2.5rem] bg-white/50 dark:bg-zinc-900/50 p-20 text-center hover:border-rose-300 dark:hover:border-rose-900 transition-all cursor-pointer group ${isProcessing ? 'opacity-50' : ''}`}>
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <Loader2 size={48} className="text-rose-500 animate-spin mb-4" />
                <h3 className="text-xl font-bold mb-2">Rebuilding PDF...</h3>
              </div>
            ) : (
              <>
                <div className="w-24 h-24 bg-rose-100 dark:bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Wrench size={40} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Select Corrupted PDF</h3>
                <p className="text-sm text-gray-400">Tap to upload and attempt repair</p>
              </>
            )}
          </div>
        ) : (
          <SuccessState 
            message="Reconstruction Complete!"
            downloadUrl={downloadUrl}
            fileName={`repaired-${fileName}`}
            onStartOver={() => setDownloadUrl(null)}
          />
        )}

        <div className="mt-8 p-6 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex items-start gap-4">
          <ShieldAlert className="text-amber-500 shrink-0" size={20} />
          <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            <p className="font-bold mb-1 uppercase">How it works:</p>
            PaperKnife uses a safe-load algorithm to bypass minor corruption in the PDF stream and generates a fresh Cross-Reference Table. This can fix files that refuse to open in some viewers. Note: Highly corrupted files with missing data may still fail.
          </div>
        </div>

        <PrivacyBadge />
      </main>
    </div>
  )
}