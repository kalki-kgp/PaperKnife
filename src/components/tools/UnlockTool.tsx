import { useState, useRef, useEffect } from 'react'
import { Lock, Unlock, Loader2, X } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { toast } from 'sonner'

import { getPdfMetaData, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import { usePipeline } from '../../utils/pipelineContext'
import { useObjectURL } from '../../utils/useObjectURL'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'
import ToolSeoContent from './shared/ToolSeoContent'
import { NativeToolLayout } from './shared/NativeToolLayout'

type UnlockPdfFile = {
  file: File
  thumbnail?: string
  pageCount: number
  isLocked: boolean
  password?: string
  pdfDoc?: any
}

export default function UnlockTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { consumePipelineFile } = usePipeline()
  const { objectUrl, createUrl, clearUrls } = useObjectURL()
  const [pdfData, setPdfData] = useState<UnlockPdfFile | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [password, setPassword] = useState('')
  const [customFileName, setCustomFileName] = useState('paperknife-unlocked')

  useEffect(() => {
    const pipelined = consumePipelineFile()
    if (pipelined) {
      const file = new File([pipelined.buffer as any], pipelined.name, { type: 'application/pdf' })
      handleFile(file)
    }
  }, [])

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') return
    const meta = await getPdfMetaData(file)
    setPdfData({ file, thumbnail: meta.thumbnail, pageCount: meta.pageCount, isLocked: meta.isLocked })
    setCustomFileName(`${file.name.replace('.pdf', '')}-unlocked`)
    clearUrls(); setPassword('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
    if (e.target) e.target.value = ''
  }

  const performUnlock = async () => {
    if (!pdfData || (pdfData.isLocked && !password)) return
    setIsProcessing(true); await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const result = await unlockPdf(pdfData.file, password)
      if (!result.success) throw new Error('Incorrect password.')
      const arrayBuffer = await pdfData.file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, { password: password || undefined, ignoreEncryption: true } as any)
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = createUrl(blob)
      addActivity({ name: `${customFileName || 'unlocked'}.pdf`, tool: 'Unlock', size: blob.size, resultUrl: url })
    } catch (error: any) { toast.error(error.message || 'Error.') } finally { setIsProcessing(false) }
  }

  const ActionButton = () => (
    <button onClick={performUnlock} disabled={isProcessing || (pdfData?.isLocked && !password)} className={`w-full bg-terracotta-500 hover:bg-terracotta-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl flex items-center justify-center gap-3 shadow-lg shadow-terracotta-500/20`}>
      {isProcessing ? <Loader2 className="animate-spin" /> : <Unlock size={20} />} Unlock PDF
    </button>
  )

  return (
    <NativeToolLayout title="Unlock PDF" description="Remove passwords and restrictions permanently. Processed locally." actions={pdfData && !objectUrl && <ActionButton />}>
      <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
      {!pdfData ? (
        <button 
          onClick={() => !isProcessing && fileInputRef.current?.click()} 
          className="w-full border-2 border-dashed border-terracotta-300 dark:border-terracotta-800 rounded-[2.5rem] p-12 md:p-16 text-center bg-white dark:bg-zinc-900/60 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/10 hover:border-terracotta-400 transition-all cursor-pointer group shadow-clay-sm dark:shadow-none"
        >
          <div className="w-20 h-20 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"><Unlock size={32} /></div>
          <h3 className="text-xl font-bold dark:text-white mb-2">Select Locked PDF</h3>
          <p className="text-sm text-gray-400 font-medium">Tap to browse or drag and drop here</p><span className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-terracotta-500 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-terracotta-500/20 group-hover:shadow-xl group-hover:scale-105 transition-all">Choose File</span>
        </button>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 flex items-center gap-6 shadow-sm">
            <div className="w-16 h-20 bg-gray-50 dark:bg-black rounded-xl overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-terracotta-500 shadow-inner">{pdfData.thumbnail ? <img src={pdfData.thumbnail} className="w-full h-full object-cover" /> : <Lock size={20} />}</div>
            <div className="flex-1 min-w-0 text-left">
              <h3 className="font-bold text-sm truncate dark:text-white">{pdfData.file.name}</h3>
              <p className="text-[10px] text-gray-400 uppercase font-black">{pdfData.isLocked ? 'Encrypted Document' : 'Open Document'}</p>
            </div>
            <button onClick={() => setPdfData(null)} className="p-2 text-gray-400 hover:text-terracotta-500 transition-colors"><X size={20} /></button>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 space-y-6 shadow-sm">
            {!objectUrl ? (
              <div className="space-y-6">
                {pdfData.isLocked ? (
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-3">Master Password</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-4 border border-transparent focus:border-terracotta-500 outline-none font-bold text-lg text-center dark:text-white" placeholder="••••••••" autoFocus />
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20 text-center"><p className="text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest">File is already unlocked!</p></div>
                )}
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-3">Output Filename</label>
                  <input type="text" value={customFileName} onChange={(e) => setCustomFileName(e.target.value)} className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-terracotta-500 outline-none font-bold text-sm dark:text-white" />
                </div>
              </div>
            ) : (
              <SuccessState message="Encryption Removed!" downloadUrl={objectUrl} fileName={`${customFileName || 'unlocked'}.pdf`} onStartOver={() => { clearUrls(); setPassword(''); setPdfData(null); setIsProcessing(false); }} />
            )}
          </div>
        </div>
      )}
      <ToolSeoContent
        title="Unlock PDF"
        headline="Remove Password Protection From PDFs"
        description="Unlock password-protected PDF files locally in your browser. Enter the existing password to remove the protection and download an unprotected copy. Your password and document never leave your device."
        benefits={[
          "Remove password restrictions from PDFs you have authorized access to.",
          "Create unprotected copies for easier sharing and editing.",
          "All decryption happens locally — your password is never sent anywhere.",
          "Works with standard PDF encryption formats.",
        ]}
        howItWorks={[
          "Upload the password-protected PDF.",
          "Enter the existing password for the document.",
          "Click 'Unlock' to remove the protection.",
          "Download the unprotected PDF.",
        ]}
        faqs={[
          { q: "Can I unlock a PDF without the password?", a: "No. You must know the correct password to unlock the file. PaperKnife does not crack or bypass PDF encryption — it removes protection using the authorized password." },
          { q: "Is it legal to unlock PDFs?", a: "Yes, if you have the right to access the document. Unlocking your own password-protected files or files you've been given the password for is perfectly legal." },
          { q: "Will unlocking affect the PDF content?", a: "No. The content, formatting, images, and fonts remain identical. Only the password protection is removed." },
          { q: "What if the password doesn't work?", a: "Make sure you're entering the correct password including any uppercase letters, numbers, or special characters. PDF passwords are case-sensitive." },
        ]}
      />
      <PrivacyBadge />
    </NativeToolLayout>
  )
}
