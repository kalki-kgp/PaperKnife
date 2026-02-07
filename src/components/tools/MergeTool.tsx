import { useState, useRef, useEffect } from 'react'
import { Plus, X, Loader2, GripVertical, Lock, Edit2, RotateCw, Upload, RefreshCw, Trash2, ArrowRight } from 'lucide-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@nd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Capacitor } from '@capacitor/core'

import { getPdfMetaData, unlockPdf, downloadFile } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import { usePipeline } from '../../utils/pipelineContext'
import { useObjectURL } from '../../utils/useObjectURL'
import { saveWorkspace, getWorkspace, clearWorkspace } from '../../utils/workspacePersistence'
import ToolHeader from './shared/ToolHeader'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'
import { NativeToolLayout } from './shared/NativeToolLayout'

// ... (PdfFile type and formatSize helper)

export default function MergeTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { setPipelineFile, consumePipelineFile } = usePipeline()
  const { objectUrl, createUrl, clearUrls } = useObjectURL()
  const [files, setFiles] = useState<PdfFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [customFileName, setCustomFileName] = useState('paperknife-merged')
  const [progress, setProgress] = useState(0)
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false)
  const [hasRestorableWorkspace, setHasRestorableWorkspace] = useState(false)
  const isNative = Capacitor.isNativePlatform()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ... (useEffects, handleFiles, handleUnlock, handleFileSelect, handleDragOver, handleDragLeave, handleDrop, handleDragEnd, removeFile, rotateFile)

  const mergePDFs = async () => {
    if (!canMerge) return

    setIsProcessing(true)
    setProgress(0)
    
    try {
      const worker = new Worker(new URL('../../utils/pdfWorker.ts', import.meta.url), { type: 'module' })
      const fileDatas = []
      for (const f of files) {
        fileDatas.push({
          buffer: await f.file.arrayBuffer(),
          rotation: f.rotation,
          password: f.password
        })
      }

      worker.postMessage({ type: 'MERGE_PDFS', payload: { files: fileDatas } })

      worker.onmessage = (e) => {
        const { type, payload } = e.data
        if (type === 'PROGRESS') {
          setProgress(payload)
        } else if (type === 'SUCCESS') {
          const blob = new Blob([payload], { type: 'application/pdf' })
          const url = createUrl(blob)
          const fileName = `${customFileName || 'merged'}.pdf`
          
          setPipelineFile({
            buffer: payload,
            name: fileName
          })
          
          addActivity({
            name: fileName,
            tool: 'Merge',
            size: blob.size,
            resultUrl: url
          })
          
          setIsProcessing(false)
          worker.terminate()
          clearWorkspace('merge')
          toast.success('PDFs merged successfully!')
        } else if (type === 'ERROR') {
          toast.error(payload)
          setIsProcessing(false)
          worker.terminate()
        }
      }
      // ... (onerror)
    } catch (error: any) {
      // ... (catch)
    }
  }

  const handleDownload = async () => {
    // This will be called from SuccessState, but we'll also use it for the native action bar
    if (setPipelineFile) {
        const p = (files.length > 0) ? await files[0].file.arrayBuffer() : null; // This is a placeholder, actual payload is in SuccessState
        // The real download logic is inside SuccessState now
    }
  }

  const ActionButton = () => (
    <button 
      onClick={mergePDFs}
      disabled={isProcessing || !canMerge}
      className={`w-full bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-rose-500/20 ${isNative ? 'py-4 rounded-2xl text-sm' : 'p-6 rounded-3xl text-xl'}`}
    >
      {isProcessing ? <><Loader2 className="animate-spin" /> {progress}%</> : <>Merge PDFs <ArrowRight size={18} /></>}
    </button>
  )

  return (
    <NativeToolLayout
      title="Merge PDF"
      description="Combine multiple PDF files into one document. Processed entirely on your device."
      icon={Plus}
      actions={files.length > 0 && !objectUrl && <ActionButton />}
    >
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Global Drop Overlay */}
        {isDraggingGlobal && (
          <div className="fixed inset-0 z-[100] bg-rose-500/90 backdrop-blur-xl flex flex-col items-center justify-center text-white p-6 animate-in fade-in duration-300">
            <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-8 animate-bounce">
              <Plus size={64} strokeWidth={3} />
            </div>
            <h2 className="text-4xl md:text-6xl font-black mb-4 text-center">Drop to Add</h2>
          </div>
        )}

        {/* ... (Restore Workspace Prompt) */}

        <div className="space-y-6">
          {/* File List */}
          {files.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {files.length} Files • {totalPages} Pages
                </p>
                <button onClick={() => { setFiles([]); clearUrls(); clearWorkspace('merge'); }} className="text-[10px] font-black uppercase text-rose-500/60">Clear All</button>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={files.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  {files.map((file) => (
                    <SortableItem key={file.id} id={file.id} file={file} onRemove={removeFile} onRotate={rotateFile} onUnlock={handleUnlock} />
                  ))}
                </SortableContext>
              </DndContext>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl text-gray-400 font-bold text-sm flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add More Files
              </button>

              {!objectUrl && (
                <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                   <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Filename</label>
                   <input 
                      type="text" 
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 outline-none font-bold text-sm border border-transparent focus:border-rose-500 transition-colors"
                   />
                </div>
              )}
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-4 border-dashed border-gray-100 dark:border-zinc-900 rounded-[2.5rem] p-12 text-center hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all cursor-pointer group"
            >
               <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
               </div>
               <h3 className="text-xl font-bold dark:text-white mb-2">Select PDF Files</h3>
               <p className="text-sm text-gray-400">Tap to browse or drag and drop here</p>
            </div>
          )}

          {/* Action Button (Web) */}
          {files.length > 0 && !objectUrl && !isNative && (
             <div className="mt-8">
                <ActionButton />
             </div>
          )}

          {/* Progress / Success States */}
          {isProcessing && !isNative && (
             <div className="mt-8 space-y-4">
                <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                   <div className="bg-rose-500 h-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Processing on Device...</p>
             </div>
          )}

          {objectUrl && (
            <div className="animate-in zoom-in duration-300">
              <SuccessState 
                message="PDFs Merged Successfully!"
                downloadUrl={objectUrl}
                fileName={`${customFileName || 'merged'}.pdf`}
                onStartOver={() => { setFiles([]); clearUrls(); clearWorkspace('merge'); }}
              />
            </div>
          )}
        </div>

        <input type="file" multiple accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
        <PrivacyBadge />
      </div>
    </NativeToolLayout>
  )
}
