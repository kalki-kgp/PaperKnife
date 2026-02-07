import { useState, useRef } from 'react'
import { Lock, Unlock, Loader2, ArrowRight, X } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { toast } from 'sonner'
import { Capacitor } from '@capacitor/core'

import { getPdfMetaData, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import { useObjectURL } from '../../utils/useObjectURL'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'
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
  const { objectUrl, createUrl, clearUrls } = useObjectURL()
  const [pdfData, setPdfData] = useState<UnlockPdfFile | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [password, setPassword] = useState('')
  const [customFileName, setCustomFileName] = useState('paperknife-unlocked')
  const isNative = Capacitor.isNativePlatform()

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') return
    const meta = await getPdfMetaData(file)
    setPdfData({ file, thumbnail: meta.thumbnail, pageCount: meta.pageCount, isLocked: meta.isLocked })
    setCustomFileName(`${file.name.replace('.pdf', '')}-unlocked`)
    clearUrls(); setPassword('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
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
    <button onClick={performUnlock} disabled={isProcessing || (pdfData?.isLocked && !password)} className={`w-full bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-rose-500/20 ${isNative ? 'py-4 rounded-2xl text-sm' : 'p-6 rounded-3xl text-xl'}`}>
      {isProcessing ? <><Loader2 className="animate-spin" /> Working...</> : <>Unlock PDF <ArrowRight size={18} /></>}
    </button>
  )

  return (
    <NativeToolLayout title="Unlock PDF" description="Remove passwords and restrictions permanently. Processed locally." icon={Unlock} actions={pdfData && !objectUrl && <ActionButton />}>
      <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
      {!pdfData ? (
        <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-gray-100 dark:border-zinc-900 rounded-[2.5rem] p-12 text-center hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all cursor-pointer group">
          <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"><Unlock size={32} /></div>
          <h3 className="text-xl font-bold dark:text-white mb-2">Select Locked PDF</h3>
          <p className="text-sm text-gray-400">Tap to browse files</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 flex items-center gap-6">
            <div className="w-16 h-20 bg-gray-50 dark:bg-black rounded-xl overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-rose-500">{pdfData.thumbnail ? <img src={pdfData.thumbnail} className="w-full h-full object-cover" /> : <Lock size={20} />}</div>
            <div className="flex-1 min-w-0"><h3 className="font-bold text-sm truncate dark:text-white">{pdfData.file.name}</h3><p className="text-[10px] text-gray-400 uppercase font-black">{pdfData.isLocked ? 'Locked' : 'Unlocked'}</p></div>
            <button onClick={() => setPdfData(null)} className="p-2 text-gray-400 hover:text-rose-500 transition-colors"><X size={20} /></button>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-100 dark:border-white/5 space-y-6">
            {!objectUrl ? (
              <div className="space-y-6">
                {pdfData.isLocked ? (
                  <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-rose-500 outline-none font-bold text-sm text-center" placeholder="••••••••" autoFocus /></div>
                ) : (
                  <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20 text-center"><p className="text-green-600 dark:text-green-400 font-bold text-xs">File is already unlocked!</p></div>
                )}
                <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Filename</label><input type="text" value={customFileName} onChange={(e) => setCustomFileName(e.target.value)} className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-rose-500 outline-none font-bold text-sm" /></div>
                {!isNative && <ActionButton />}
              </div>
            ) : (
              <SuccessState message="Unlocked Successfully" downloadUrl={objectUrl} fileName={`${customFileName || 'unlocked'}.pdf`} onStartOver={() => { clearUrls(); setPassword(''); }} />
            )}
          </div>
        </div>
      )}
      <PrivacyBadge />
    </NativeToolLayout>
  )
}