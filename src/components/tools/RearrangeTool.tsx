import { useState, useRef, useEffect } from 'react'
import { Download, Loader2, CheckCircle2, Lock, Grid, Move, RefreshCcw } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { getPdfMetaData, loadPdfDocument, renderPageThumbnail, unlockPdf } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'

type RearrangePdfData = {
  file: File
  pageCount: number
  isLocked: boolean
  pdfDoc?: any
  password?: string
}

const LazyThumbnail = ({ pdfDoc, pageNum }: { pdfDoc: any, pageNum: number }) => {
  const [src, setSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pdfDoc || src) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        renderPageThumbnail(pdfDoc, pageNum).then(setSrc)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    if (imgRef.current) observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [pdfDoc, pageNum, src])

  if (src) return <img src={src} className="w-full h-full object-contain bg-white" alt={`Page ${pageNum}`} />
  
  return (
    <div ref={imgRef} className="w-full h-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
      <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function SortablePage({ id, pageNum, pdfDoc }: { id: string, pageNum: number, pdfDoc: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`relative group cursor-grab active:cursor-grabbing aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all bg-gray-50 dark:bg-black ${isDragging ? 'border-rose-500 shadow-xl scale-105 opacity-90' : 'border-transparent hover:border-gray-200 dark:hover:border-zinc-700'}`}
    >
      <div className="w-full h-full p-2">
         <LazyThumbnail pdfDoc={pdfDoc} pageNum={pageNum} />
      </div>
      <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-lg p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <Move size={14} />
      </div>
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-tighter">P. {pageNum}</div>
    </div>
  )
}

export default function RearrangeTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfData, setPdfData] = useState<RearrangePdfData | null>(null)
  const [pageOrder, setPageOrder] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-rearranged')
  const [unlockPassword, setUnlockPassword] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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
      setPageOrder(Array.from({ length: result.pageCount }, (_, i) => (i + 1).toString()))
      setCustomFileName(`${pdfData.file.name.replace('.pdf', '')}-rearranged`)
    } else {
      alert('Incorrect password')
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
        setPageOrder(Array.from({ length: meta.pageCount }, (_, i) => (i + 1).toString()))
        setCustomFileName(`${file.name.replace('.pdf', '')}-rearranged`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsProcessing(false)
      setDownloadUrl(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      setPageOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over?.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
      setDownloadUrl(null)
    }
  }

  const resetOrder = () => {
    if (!pdfData) return
    setPageOrder(Array.from({ length: pdfData.pageCount }, (_, i) => (i + 1).toString()))
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

      const newPdf = await PDFDocument.create()
      // Map string IDs back to 0-based indices
      const indices = pageOrder.map(id => parseInt(id) - 1)
      const copiedPages = await newPdf.copyPages(pdfDoc, indices)
      copiedPages.forEach(page => newPdf.addPage(page))

      const pdfBytes = await newPdf.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)

      addActivity({
        name: `${customFileName}.pdf`,
        tool: 'Rearrange',
        size: blob.size,
        resultUrl: url
      })
    } catch (error: any) {
      alert(`Error saving PDF: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex-1">
      <main className="max-w-6xl mx-auto px-6 py-6 md:py-10">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-3xl md:text-5xl font-black mb-3 md:mb-4 dark:text-white">Rearrange <span className="text-rose-500">PDF.</span></h2>
          <p className="text-sm md:text-base text-gray-500 dark:text-zinc-400">Drag and drop to reorder pages. <br className="hidden md:block"/>Processed locally.</p>
        </div>

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
                  <Grid size={32} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-1 md:mb-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">Select PDF</h3>
                <p className="text-xs md:text-sm text-gray-400 dark:text-zinc-500">Tap to start arranging</p>
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
              <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8">Unlock this file to rearrange pages.</p>
              
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
                  <h4 className="font-black uppercase tracking-widest text-xs text-gray-400">Drag pages to reorder</h4>
                  <button onClick={resetOrder} className="flex items-center gap-1 text-[10px] font-black uppercase text-gray-400 hover:text-rose-500 transition-colors"><RefreshCcw size={12}/> Reset Order</button>
                </div>
                
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={pageOrder} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
                      {pageOrder.map((id) => (
                        <SortablePage key={id} id={id} pageNum={parseInt(id)} pdfDoc={pdfData.pdfDoc} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
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
                      Save PDF
                    </button>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm border border-green-100 dark:border-green-900/30">
                        <CheckCircle2 size={20} /> Success!
                      </div>
                      <a 
                        href={downloadUrl} 
                        download={`${customFileName}.pdf`}
                        className="w-full bg-gray-900 dark:bg-white text-white dark:text-black p-6 rounded-3xl font-black text-xl flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all shadow-xl"
                      >
                        <Download size={24} /> Download PDF
                      </a>
                      <button onClick={() => setDownloadUrl(null)} className="w-full py-2 text-xs font-black uppercase text-gray-400 hover:text-rose-500 tracking-[0.2em]">Arrange Again</button>
                    </div>
                  )}
                  
                  <button onClick={() => setPdfData(null)} className="w-full py-2 text-[10px] font-black uppercase text-gray-300 hover:text-rose-500 transition-colors tracking-[0.2em]">Close File</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}