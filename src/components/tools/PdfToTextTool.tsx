import { useState, useRef } from 'react'
import { Loader2, Copy, FileText, Lock, Check, Download } from 'lucide-react'
import { toast } from 'sonner'

import { getPdfMetaData, loadPdfDocument, unlockPdf } from '../../utils/pdfHelpers'
import ToolHeader from './shared/ToolHeader'
import PrivacyBadge from './shared/PrivacyBadge'

type PdfToTextData = {
  file: File
  pageCount: number
  isLocked: boolean
  pdfDoc?: any
  password?: string
}

export default function PdfToTextTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfData, setPdfData] = useState<PdfToTextData | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [copied, setCopied] = useState(false)

  const handleUnlock = async () => {
    if (!pdfData || !unlockPassword) return
    setIsProcessing(true)
    const result = await unlockPdf(pdfData.file, unlockPassword)
    if (result.success) {
      setPdfData({
        ...pdfData,
        isLocked: false,
        pageCount: result.pageCount,
        pdfDoc: result.pdfDoc,
        password: unlockPassword
      })
    } else {
      toast.error('Incorrect password')
    }
    setIsProcessing(false)
  }

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') return
    setIsProcessing(true)
    try {
      const meta = await getPdfMetaData(file)
      if (meta.isLocked) {
        setPdfData({ file, pageCount: 0, isLocked: true })
      } else {
        const pdfDoc = await loadPdfDocument(file)
        setPdfData({
          file,
          pageCount: meta.pageCount,
          isLocked: false,
          pdfDoc
        })
      }
      setExtractedText('')
    } catch (err) {
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const extractText = async () => {
    if (!pdfData || !pdfData.pdfDoc) return
    setIsProcessing(true)
    setProgress(0)
    setExtractedText('')

    try {
      let fullText = ''
      for (let i = 1; i <= pdfData.pageCount; i++) {
        const page = await pdfData.pdfDoc.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        fullText += `--- Page ${i} ---\n${pageText}\n\n`
        setProgress(Math.round((i / pdfData.pageCount) * 100))
      }
      setExtractedText(fullText)
      toast.success('Text extracted successfully!')
    } catch (error: any) {
      toast.error(`Error extracting text: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(extractedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadText = () => {
    const blob = new Blob([extractedText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pdfData?.file.name.replace('.pdf', '')}-extracted.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-1">
      <main className="max-w-4xl mx-auto px-6 py-6 md:py-10">
        <ToolHeader 
          title="PDF to" 
          highlight="Text" 
          description="Extract plain text for easy editing. Processed locally." 
        />

        <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

        {!pdfData ? (
          <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-4 border-dashed border-gray-200 dark:border-zinc-800 rounded-[2rem] md:rounded-[2.5rem] bg-white/50 dark:bg-zinc-900/50 p-10 md:p-20 text-center hover:border-rose-300 dark:hover:border-rose-900 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-all cursor-pointer group ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}>
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <Loader2 size={48} className="text-rose-500 animate-spin mb-4" />
                <h3 className="text-xl font-bold mb-2">Analyzing PDF...</h3>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 md:w-24 md:h-24 bg-rose-100 dark:bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:scale-110 transition-transform">
                  <FileText size={32} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-1 md:mb-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">Select PDF</h3>
                <p className="text-xs md:text-sm text-gray-400 dark:text-zinc-500">Tap to start extracting</p>
              </>
            )}
          </div>
        ) : pdfData.isLocked ? (
          <div className="max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-zinc-800 shadow-xl text-center">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2 dark:text-white">File is Protected</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8">Unlock this file to extract text.</p>
              
              <div className="space-y-4">
                <input 
                  type="password" 
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full bg-gray-50 dark:bg-black rounded-2xl px-6 py-4 border border-gray-100 dark:border-zinc-800 focus:border-rose-500 outline-none font-bold text-center transition-all"
                  autoFocus
                />
                <button 
                  onClick={handleUnlock}
                  disabled={!unlockPassword || isProcessing}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? 'Unlocking...' : 'Unlock PDF'}
                </button>
                <button 
                  onClick={() => setPdfData(null)}
                  className="w-full py-2 text-xs font-bold text-gray-400 hover:text-rose-500"
                >
                  Choose different file
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* File Info */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-6">
              <div className="w-20 h-28 bg-gray-100 dark:bg-zinc-800 rounded-xl overflow-hidden shrink-0 border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-rose-500">
                <FileText size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate dark:text-white">{pdfData.file.name}</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400">{pdfData.pageCount} Pages • {(pdfData.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                <button onClick={() => setPdfData(null)} className="mt-2 text-xs font-black uppercase text-rose-500 hover:text-rose-600 transition-colors">Change File</button>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm space-y-8">
              {!extractedText ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-zinc-400 mb-6">Ready to extract text from {pdfData.pageCount} pages.</p>
                  
                  {isProcessing && (
                    <div className="mb-6 space-y-3 max-w-md mx-auto">
                      <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-[10px] text-center font-black uppercase text-gray-400 tracking-widest animate-pulse">Extracting... {progress}%</p>
                    </div>
                  )}

                  <button 
                    onClick={extractText}
                    disabled={isProcessing}
                    className="w-full md:w-auto px-12 bg-rose-500 hover:bg-rose-600 text-white p-6 rounded-3xl shadow-xl shadow-rose-200 dark:shadow-none font-black text-xl tracking-tight transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" /> : <FileText />}
                    Start Extraction
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="relative">
                     <textarea 
                        readOnly
                        value={extractedText}
                        className="w-full h-96 bg-gray-50 dark:bg-black border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 font-mono text-xs md:text-sm resize-none focus:outline-none focus:border-rose-500 transition-colors"
                     />
                     <div className="absolute top-4 right-4 flex gap-2">
                        <button 
                          onClick={copyToClipboard}
                          className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white p-2 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
                          title="Copy to Clipboard"
                        >
                          {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                        </button>
                     </div>
                   </div>

                   <div className="flex flex-col sm:flex-row gap-3">
                      <button 
                        onClick={() => { setExtractedText(''); setProgress(0); }}
                        className="flex-1 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white border border-gray-200 dark:border-zinc-800 p-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-gray-50 transition-all active:scale-95"
                      >
                        Extract Again
                      </button>
                      <button 
                        onClick={downloadText}
                        className="flex-[2] bg-gray-900 dark:bg-white text-white dark:text-black p-4 rounded-3xl font-black text-lg flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all shadow-xl"
                      >
                        <Download size={24} /> Download .txt
                      </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        )}
        <PrivacyBadge />
      </main>
    </div>
  )
}
