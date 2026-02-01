import { useState, useRef, useEffect } from 'react'
import { RotateCw, Lock, RefreshCcw, Loader2, Download } from 'lucide-react'
import { PDFDocument, degrees } from 'pdf-lib'
import { toast } from 'sonner'

import { getPdfMetaData, loadPdfDocument, renderPageThumbnail, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import ToolHeader from './shared/ToolHeader'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'

type RotatePdfData = {
  file: File
  pageCount: number
  isLocked: boolean
  pdfDoc?: any
  password?: string
}

const LazyThumbnail = ({ pdfDoc, pageNum, rotation }: { pdfDoc: any, pageNum: number, rotation: number }) => {
  const [src, setSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pdfDoc || src) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        renderPageThumbnail(pdfDoc, pageNum, 1.0).then(setSrc)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    if (imgRef.current) observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [pdfDoc, pageNum, src])

  if (src) {
    return (
      <img 
        src={src} 
        className="w-full h-full object-contain transition-transform duration-300 bg-white" 
        style={{ transform: `rotate(${rotation}deg)` }}
        alt={`Page ${pageNum}`} 
      />
    )
  }
  
  return (
    <div ref={imgRef} className="w-full h-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
      <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function RotateTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfData, setPdfData] = useState<RotatePdfData | null>(null)
  const [rotations, setRotations] = useState<Record<number, number>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-rotated')
  const [unlockPassword, setUnlockPassword] = useState('')

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
      setCustomFileName(`${pdfData.file.name.replace('.pdf', '')}-rotated`)
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
        setCustomFileName(`${file.name.replace('.pdf', '')}-rotated`)
        setRotations({})
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsProcessing(false)
      setDownloadUrl(null)
    }
  }

  const rotatePage = (pageNum: number) => {
    setRotations(prev => ({
      ...prev,
      [pageNum]: ((prev[pageNum] || 0) + 90) % 360
    }))
    setDownloadUrl(null)
  }

  const rotateAll = () => {
    const newRotations = { ...rotations }
    for (let i = 1; i <= (pdfData?.pageCount || 0); i++) {
      newRotations[i] = ((newRotations[i] || 0) + 90) % 360
    }
    setRotations(newRotations)
    setDownloadUrl(null)
  }

  const resetRotation = () => {
    setRotations({})
    setDownloadUrl(null)
  }

  const savePDF = async () => {
    if (!pdfData) return
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      const arrayBuffer = await pdfData.file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        password: pdfData.password || undefined,
        ignoreEncryption: true
      } as any)

      const pages = pdfDoc.getPages()
      pages.forEach((page, idx) => {
        const pageNum = idx + 1
        const rotationToAdd = rotations[pageNum] || 0
        if (rotationToAdd !== 0) {
          const currentRotation = page.getRotation().angle
          page.setRotation(degrees((currentRotation + rotationToAdd) % 360))
        }
      })

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)

      addActivity({
        name: `${customFileName}.pdf`,
        tool: 'Rotate',
        size: blob.size,
        resultUrl: url
      })
    } catch (error: any) {
      toast.error(`Error saving PDF: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex-1">
      <main className="max-w-6xl mx-auto px-6 py-6 md:py-10">
        <ToolHeader 
          title="Rotate" 
          highlight="PDF" 
          description="Fix page orientation permanently. Processed locally." 
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
                  <RotateCw size={32} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-1 md:mb-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">Select PDF</h3>
                <p className="text-xs md:text-sm text-gray-400 dark:text-zinc-500">Tap to start rotating</p>
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
              <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8">Unlock this file to rotate pages.</p>
              
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Pages Grid */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm">
                 <div className="flex justify-between items-center mb-6">
                  <h4 className="font-black uppercase tracking-widest text-xs text-gray-400">Tap pages to rotate</h4>
                  <div className="flex gap-2">
                    <button onClick={rotateAll} className="flex items-center gap-1 text-[10px] font-black uppercase text-rose-500 hover:underline"><RotateCw size={12}/> Rotate All</button>
                    <button onClick={resetRotation} className="flex items-center gap-1 text-[10px] font-black uppercase text-gray-400 hover:underline"><RefreshCcw size={12}/> Reset</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
                  {Array.from({ length: pdfData.pageCount }).map((_, i) => {
                    const pageNum = i + 1
                    const rotation = rotations[pageNum] || 0
                    return (
                      <div 
                        key={pageNum}
                        onClick={() => rotatePage(pageNum)}
                        className="relative group cursor-pointer aspect-[3/4] rounded-xl overflow-hidden border-2 border-transparent hover:border-rose-500 transition-all bg-gray-50 dark:bg-black"
                      >
                        <div className="w-full h-full p-2">
                           <LazyThumbnail pdfDoc={pdfData.pdfDoc} pageNum={pageNum} rotation={rotation} />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                           <div className="bg-white text-rose-500 p-2 rounded-full opacity-0 group-hover:opacity-100 shadow-lg transform scale-75 group-hover:scale-100 transition-all">
                              <RotateCw size={20} />
                           </div>
                        </div>
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-tighter">P. {pageNum}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm sticky top-24">
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-1 dark:text-white truncate">{pdfData.file.name}</h3>
                  <p className="text-xs text-gray-400 uppercase font-black tracking-widest">{pdfData.pageCount} Pages • {(pdfData.file.size / (1024*1024)).toFixed(1)} MB</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Output Filename</label>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-black rounded-2xl px-6 py-4 border border-gray-100 dark:border-zinc-800 focus-within:border-rose-500 transition-colors">
                      <input 
                        type="text" 
                        value={customFileName}
                        onChange={(e) => setCustomFileName(e.target.value)}
                        className="bg-transparent outline-none flex-1 text-sm font-bold dark:text-white"
                      />
                      <span className="text-gray-400 text-xs font-bold">.pdf</span>
                    </div>
                  </div>

                  {!downloadUrl ? (
                    <button 
                      onClick={savePDF}
                      disabled={isProcessing}
                      className="w-full bg-rose-500 hover:bg-rose-600 text-white p-6 rounded-3xl shadow-xl shadow-rose-200 dark:shadow-none font-black text-xl tracking-tight transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" /> : <Download />}
                      Save Rotated PDF
                    </button>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <SuccessState 
                        message="Success! PDF rotated."
                        downloadUrl={downloadUrl}
                        fileName={`${customFileName}.pdf`}
                        onStartOver={() => setDownloadUrl(null)}
                      />
                    </div>
                  )}
                  
                  <button onClick={() => setPdfData(null)} className="w-full py-2 text-[10px] font-black uppercase text-gray-300 hover:text-rose-500 transition-colors tracking-[0.2em]">Close File</button>
                </div>
              </div>
            </div>
          </div>
        )}
        <PrivacyBadge />
      </main>
    </div>
  )
}