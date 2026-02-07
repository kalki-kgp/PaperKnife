import { useState, useRef } from 'react'
import { Loader2, ShieldAlert, Upload } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { toast } from 'sonner'

import { addActivity } from '../../utils/recentActivity'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'
import { NativeToolLayout } from './shared/NativeToolLayout'

export default function RepairTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') return
    setIsProcessing(true); setFileName(file.name)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true, throwOnInvalidObject: false } as any)
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      addActivity({ name: `repaired-${file.name}`, tool: 'Repair', size: blob.size, resultUrl: url })
      toast.success('PDF rebuilt successfully!')
    } catch (error: any) { toast.error(`Error: ${error.message}`) } finally { setIsProcessing(false) }
  }

  return (
    <NativeToolLayout title="Repair PDF" description="Fix corrupted or unreadable PDF files by rebuilding structure.">
      <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {!downloadUrl ? (
        <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-4 border-dashed border-gray-100 dark:border-zinc-900 rounded-[2.5rem] p-12 text-center hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all cursor-pointer group ${isProcessing ? 'opacity-50' : ''}`}>
          {isProcessing ? (
            <div className="flex flex-col items-center"><Loader2 size={48} className="text-rose-500 animate-spin mb-4" /><h3 className="text-xl font-bold mb-2">Rebuilding...</h3></div>
          ) : (
            <><div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"><Upload size={32} /></div><h3 className="text-xl font-bold dark:text-white mb-2">Select Corrupted PDF</h3><p className="text-sm text-gray-400">Tap to upload and attempt repair</p></>
          )}
        </div>
      ) : (
        <SuccessState message="Reconstruction Complete!" downloadUrl={downloadUrl} fileName={`repaired-${fileName}`} onStartOver={() => setDownloadUrl(null)} />
      )}
      <div className="mt-8 p-6 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-white/5 flex items-start gap-4">
        <ShieldAlert className="text-amber-500 shrink-0" size={20} />
        <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed"><p className="font-bold mb-1 uppercase tracking-widest">How it works:</p>PaperKnife generates a fresh Cross-Reference Table. This can fix files that refuse to open. Highly corrupted files may still fail.</div>
      </div>
      <PrivacyBadge />
    </NativeToolLayout>
  )
}
