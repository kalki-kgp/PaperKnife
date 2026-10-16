import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Lock, FormInput, FileWarning, LayoutList, FileText, X, PenTool } from 'lucide-react'
import { toast } from 'sonner'

import { loadPdfDocument, renderPageThumbnail } from '../../utils/pdfHelpers'
import { FormField, FormValue, ParsedForm, UnsupportedCharacterError, fillForm, parseForm, prepareFormBytes } from '../../utils/pdfForm'
import { addActivity } from '../../utils/recentActivity'
import { usePipeline } from '../../utils/pipelineContext'
import { useObjectURL } from '../../utils/useObjectURL'
import SuccessState from './shared/SuccessState'
import ToolSeoContent from './shared/ToolSeoContent'
import { NativeToolLayout } from './shared/NativeToolLayout'

type WidgetBox = { field: FormField, option?: string, left: number, top: number, width: number, height: number, heightPt: number }
type RenderedPage = { src: string, widthPt: number, heightPt: number, boxes: WidgetBox[] }
type ViewMode = 'page' | 'list'

const percent = (value: number) => `${value}%`

const initialValues = (fields: FormField[]) =>
  Object.fromEntries(fields.map(field => [field.name, field.value])) as Record<string, FormValue>

const fieldInputClass = 'w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-gray-100 dark:border-white/5 focus:border-terracotta-500 outline-none font-medium text-sm dark:text-white disabled:opacity-50'

function FieldControl({ field, value, onChange }: { field: FormField, value: FormValue, onChange: (value: FormValue) => void }) {
  const disabled = field.readOnly
  switch (field.kind) {
    case 'text':
      return field.multiline
        ? <textarea value={value as string} maxLength={field.maxLength} disabled={disabled} onChange={(e) => onChange(e.target.value)} rows={3} className={fieldInputClass} />
        : <input type="text" value={value as string} maxLength={field.maxLength} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={fieldInputClass} />
    case 'checkbox':
      return (
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={value as boolean} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-terracotta-500" />
          <span className="text-sm font-medium text-gray-600 dark:text-zinc-300">{value ? 'Checked' : 'Not checked'}</span>
        </label>
      )
    case 'radio':
      return (
        <div className="flex flex-wrap gap-2">
          {field.options.map(option => (
            <button key={option} type="button" disabled={disabled} onClick={() => onChange(value === option ? '' : option)} className={`px-4 py-2 rounded-xl border text-sm font-bold transition-colors ${value === option ? 'bg-terracotta-500 border-terracotta-500 text-white' : 'bg-gray-50 dark:bg-black border-gray-100 dark:border-white/5 text-gray-600 dark:text-zinc-300 hover:border-terracotta-300'}`}>
              {option}
            </button>
          ))}
        </div>
      )
    case 'dropdown':
      return field.editable ? (
        <>
          <input type="text" list={`opts-${field.name}`} value={value as string} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={fieldInputClass} />
          <datalist id={`opts-${field.name}`}>{field.options.map(option => <option key={option} value={option} />)}</datalist>
        </>
      ) : (
        <select value={value as string} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={fieldInputClass}>
          <option value="">—</option>
          {field.options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      )
    case 'list':
      return (
        <select multiple={field.multiselect} value={field.multiselect ? value as string[] : (value as string[])[0] ?? ''} disabled={disabled} onChange={(e) => onChange(Array.from(e.target.selectedOptions, o => o.value))} className={fieldInputClass}>
          {field.options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      )
  }
}

function PageOverlay({ page, values, onChange }: { page: RenderedPage, values: Record<string, FormValue>, onChange: (name: string, value: FormValue) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / page.widthPt))
    observer.observe(el)
    return () => observer.disconnect()
  }, [page.widthPt])

  return (
    <div ref={containerRef} className="relative w-full bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100 dark:border-white/5" style={{ aspectRatio: `${page.widthPt} / ${page.heightPt}` }}>
      <img src={page.src} alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" />
      {page.boxes.map((box, index) => {
        const { field } = box
        const value = values[field.name]
        const style = { left: percent(box.left), top: percent(box.top), width: percent(box.width), height: percent(box.height) }
        const fontSize = Math.max(8, Math.min(box.heightPt * scale * 0.65, 14 * scale))
        const base = 'absolute bg-sky-50/90 hover:bg-sky-100/90 focus:bg-white border border-sky-300/70 focus:border-terracotta-500 outline-none text-black disabled:bg-gray-100/80 disabled:cursor-not-allowed'
        const title = field.label + (field.required ? ' (required)' : '')

        if (field.kind === 'checkbox' || field.kind === 'radio') {
          const selected = field.kind === 'checkbox' ? value === true : value === box.option
          return (
            <button key={index} type="button" title={title} aria-label={title} aria-pressed={selected} disabled={field.readOnly} style={{ ...style, fontSize: Math.max(8, box.heightPt * scale * 0.8) }}
              onClick={() => onChange(field.name, field.kind === 'checkbox' ? !selected : (selected ? '' : box.option ?? ''))}
              className={`${base} flex items-center justify-center font-black leading-none ${field.kind === 'radio' ? 'rounded-full' : 'rounded-sm'}`}>
              {selected && (field.kind === 'checkbox' ? '✓' : '●')}
            </button>
          )
        }
        if (field.kind === 'text') {
          return field.multiline
            ? <textarea key={index} title={title} aria-label={title} value={value as string} maxLength={field.maxLength} disabled={field.readOnly} onChange={(e) => onChange(field.name, e.target.value)} style={{ ...style, fontSize: Math.max(8, Math.min(12 * scale, fontSize)) }} className={`${base} resize-none px-0.5 leading-tight`} />
            : <input key={index} type="text" title={title} aria-label={title} value={value as string} maxLength={field.maxLength} disabled={field.readOnly} onChange={(e) => onChange(field.name, e.target.value)} style={{ ...style, fontSize }} className={`${base} px-0.5`} />
        }
        return (
          <select key={index} title={title} aria-label={title} multiple={field.kind === 'list' && field.multiselect} disabled={field.readOnly}
            value={field.kind === 'list' ? (field.multiselect ? value as string[] : (value as string[])[0] ?? '') : value as string}
            onChange={(e) => onChange(field.name, field.kind === 'list' ? Array.from(e.target.selectedOptions, o => o.value) : e.target.value)}
            style={{ ...style, fontSize }} className={`${base} px-0.5`}>
            {field.kind === 'dropdown' && <option value="">—</option>}
            {field.options.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        )
      })}
    </div>
  )
}

export default function FillFormTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { consumePipelineFile, setPipelineFile } = usePipeline()
  const { objectUrl, createUrl, clearUrls } = useObjectURL()

  const [file, setFile] = useState<File | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [form, setForm] = useState<ParsedForm | null>(null)
  const [pages, setPages] = useState<RenderedPage[]>([])
  const [values, setValues] = useState<Record<string, FormValue>>({})
  const [view, setView] = useState<ViewMode>(() => window.innerWidth < 768 ? 'list' : 'page')
  const [flatten, setFlatten] = useState(true)
  const [customFileName, setCustomFileName] = useState('paperknife-filled')
  const [result, setResult] = useState<Uint8Array | null>(null)
  const loadIdRef = useRef(0)

  useEffect(() => {
    const pipelined = consumePipelineFile()
    if (pipelined) handleFile(new File([pipelined.buffer as any], pipelined.name, { type: 'application/pdf' }))
  }, [])

  const reset = () => {
    loadIdRef.current += 1
    setFile(null); setNeedsPassword(false); setPassword(''); setBytes(null); setForm(null); setPages([]); setValues({}); setResult(null); clearUrls()
  }

  const renderPages = async (pdfBytes: Uint8Array, parsed: ParsedForm, loadId: number) => {
    const pdf = await loadPdfDocument(new File([pdfBytes.slice() as any], 'form.pdf', { type: 'application/pdf' }))
    try {
      const rendered: RenderedPage[] = []
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (loadId !== loadIdRef.current) return
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1 })
        const boxes: WidgetBox[] = []
        for (const field of parsed.fields) {
          for (const widget of field.widgets) {
            if (widget.pageIndex !== pageNum - 1) continue
            // convertToViewportRectangle applies the page's rotation and crop-box offset.
            const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(widget.rect)
            const left = Math.min(x1, x2), top = Math.min(y1, y2)
            const width = Math.abs(x2 - x1), height = Math.abs(y2 - y1)
            if (width < 1 || height < 1) continue
            boxes.push({
              field, option: widget.option,
              left: (left / viewport.width) * 100, top: (top / viewport.height) * 100,
              width: (width / viewport.width) * 100, height: (height / viewport.height) * 100,
              heightPt: height
            })
          }
        }
        const src = await renderPageThumbnail(pdf, pageNum, 1.0, 1600)
        rendered.push({ src, widthPt: viewport.width, heightPt: viewport.height, boxes })
        setPages([...rendered])
      }
    } finally {
      await pdf.destroy().catch(() => {})
    }
  }

  const openForm = async (selected: File, pass?: string) => {
    const loadId = ++loadIdRef.current
    setIsProcessing(true)
    try {
      const prepared = await prepareFormBytes(selected, pass)
      if (loadId !== loadIdRef.current) return
      if (prepared.status === 'needs-password') { setNeedsPassword(true); return }
      const parsed = await parseForm(prepared.bytes)
      if (loadId !== loadIdRef.current) return
      setNeedsPassword(false); setBytes(prepared.bytes); setForm(parsed); setValues(initialValues(parsed.fields)); setPages([])
      if (parsed.fields.length) await renderPages(prepared.bytes, parsed, loadId)
    } catch (error: any) {
      if (pass) toast.error('Incorrect password, or the file could not be decrypted.')
      else toast.error(error?.message || 'Could not read this PDF.')
    } finally {
      if (loadId === loadIdRef.current) setIsProcessing(false)
    }
  }

  const handleFile = (selected: File) => {
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) return
    reset()
    setFile(selected)
    setCustomFileName(`${selected.name.replace(/\.pdf$/i, '')}-filled`)
    void openForm(selected)
  }

  const setValue = (name: string, value: FormValue) => setValues(prev => ({ ...prev, [name]: value }))

  const missingRequired = useMemo(() => (form?.fields ?? []).filter(field => {
    if (!field.required || field.readOnly) return false
    const value = values[field.name]
    return Array.isArray(value) ? value.length === 0 : value === '' || value === false
  }), [form, values])

  const save = async () => {
    if (!bytes || !form) return
    if (missingRequired.length) toast.warning(`${missingRequired.length} required field${missingRequired.length > 1 ? 's are' : ' is'} still empty.`)
    setIsProcessing(true)
    try {
      const output = await fillForm(bytes, form.fields, values, { flatten })
      if (flatten && !output.flattened) toast.warning('This form could not be flattened, so its fields stay editable. Your answers are saved.')
      const blob = new Blob([output.bytes as any], { type: 'application/pdf' })
      const url = createUrl(blob)
      setResult(output.bytes)
      addActivity({ name: `${customFileName || 'filled'}.pdf`, tool: 'Fill Form', size: blob.size, resultUrl: url })
    } catch (error: any) {
      toast.error(error instanceof UnsupportedCharacterError ? error.message : (error?.message || 'Could not save the form.'))
    } finally { setIsProcessing(false) }
  }

  const sendToSignature = () => {
    if (!result) return
    setPipelineFile({ buffer: result, name: `${customFileName || 'filled'}.pdf`, type: 'application/pdf', sourceTool: 'Fill Form' })
    navigate('/signature')
  }

  const fieldsByPage = useMemo(() => {
    const groups = new Map<number, FormField[]>()
    for (const field of form?.fields ?? []) {
      const pageIndex = field.widgets[0]?.pageIndex ?? -1
      groups.set(pageIndex, [...(groups.get(pageIndex) ?? []), field])
    }
    return [...groups.entries()].sort(([a], [b]) => a - b)
  }, [form])

  const ready = !!form && form.fields.length > 0
  const ActionButton = () => (
    <button onClick={save} disabled={isProcessing} className="w-full bg-terracotta-500 hover:bg-terracotta-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-terracotta-500/20 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl">
      {isProcessing ? <Loader2 className="animate-spin" /> : <><FormInput size={20} /> Save Filled PDF</>}
    </button>
  )

  return (
    <NativeToolLayout title="Fill PDF Form" description="Type into a PDF's form fields, then save or sign it. Processed locally." actions={ready && !objectUrl && <ActionButton />}>
      <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={(e) => { const picked = e.target.files?.[0]; e.target.value = ''; if (picked) handleFile(picked) }} />

      {!file ? (
        <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-terracotta-300 dark:border-terracotta-800 rounded-[2.5rem] p-12 md:p-16 text-center bg-white dark:bg-zinc-900/60 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/10 hover:border-terracotta-400 transition-all cursor-pointer group shadow-clay-sm dark:shadow-none">
          <div className="w-20 h-20 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"><FormInput size={32} /></div>
          <h3 className="text-xl font-bold dark:text-white mb-2">Select a Fillable PDF</h3>
          <p className="text-sm text-gray-400 font-medium">Tap to browse or drag and drop here</p>
          <span className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-terracotta-500 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-terracotta-500/20 group-hover:shadow-xl group-hover:scale-105 transition-all">Choose File</span>
        </button>
      ) : objectUrl ? (
        <SuccessState
          message="Form Filled!"
          downloadUrl={objectUrl}
          fileName={`${customFileName || 'filled'}.pdf`}
          onStartOver={reset}
          nextAction={{ label: 'Sign this PDF', icon: PenTool, onClick: sendToSignature }}
        />
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-zinc-900 p-4 md:p-6 rounded-3xl border border-gray-100 dark:border-white/5 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 rounded-xl flex items-center justify-center shrink-0"><FileText size={20} /></div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate dark:text-white">{file.name}</h3>
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                {form ? `${form.fields.length} fillable field${form.fields.length === 1 ? '' : 's'}` : needsPassword ? 'Password required' : 'Reading form…'}
              </p>
            </div>
            <button onClick={reset} aria-label="Close file" className="p-2 text-gray-400 hover:text-terracotta-500 transition-colors"><X size={20} /></button>
          </div>

          {needsPassword ? (
            <div className="max-w-md mx-auto p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 text-center space-y-4">
              <Lock size={32} className="mx-auto text-terracotta-500" />
              <p className="text-sm text-gray-500 dark:text-zinc-400">This form needs a password to open.</p>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && password) void openForm(file, password) }} className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-4 border border-transparent focus:border-terracotta-500 outline-none font-bold text-lg text-center dark:text-white" placeholder="••••••••" autoFocus />
              <button onClick={() => void openForm(file, password)} disabled={!password || isProcessing} className="w-full p-4 bg-terracotta-500 text-white rounded-xl font-black uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : 'Unlock'}
              </button>
            </div>
          ) : !form ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-terracotta-500" size={32} /></div>
          ) : !ready ? (
            <div className="max-w-lg mx-auto p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 text-center space-y-3">
              <FileWarning size={32} className="mx-auto text-terracotta-500" />
              {form.hasXfa ? (
                <>
                  <h3 className="font-bold dark:text-white">This is an Adobe XFA form</h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">XFA forms (made with Adobe LiveCycle) can only be filled in Adobe Acrobat or Acrobat Reader. Once filled there, you can sign it here with the Signature tool.</p>
                </>
              ) : (
                <>
                  <h3 className="font-bold dark:text-white">No fillable fields found</h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">This PDF looks like a form, but it has no interactive fields to type into — it was probably scanned or exported as a flat document.{form.skippedSignatureFields > 0 && ' It does have a signature box, which you can sign with the Signature tool.'}</p>
                </>
              )}
              <button onClick={() => { if (bytes) setPipelineFile({ buffer: bytes, name: file.name, type: 'application/pdf' }); navigate('/signature') }} className="mt-2 inline-flex items-center gap-2 px-6 py-3 bg-terracotta-500 text-white rounded-full text-xs font-black uppercase tracking-widest">
                <PenTool size={14} /> Open in Signature
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex p-1 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                  {([['page', FileText, 'On page'], ['list', LayoutList, 'As list']] as const).map(([mode, Icon, label]) => (
                    <button key={mode} onClick={() => setView(mode)} aria-pressed={view === mode} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${view === mode ? 'bg-terracotta-500 text-white' : 'text-gray-400 hover:text-terracotta-500'}`}>
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
                {missingRequired.length > 0 && <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">{missingRequired.length} required left</p>}
              </div>

              {view === 'page' ? (
                <div className="space-y-6">
                  {pages.map((page, index) => <PageOverlay key={index} page={page} values={values} onChange={setValue} />)}
                  {isProcessing && <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-terracotta-500" /></div>}
                </div>
              ) : (
                <div className="space-y-6">
                  {fieldsByPage.map(([pageIndex, fields]) => (
                    <div key={pageIndex} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm space-y-5">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">{pageIndex >= 0 ? `Page ${pageIndex + 1}` : 'Other fields'}</h4>
                      {fields.map(field => (
                        <div key={field.name}>
                          <label className="block text-xs font-bold text-gray-700 dark:text-zinc-200 mb-2">
                            {field.label}{field.required && <span className="text-terracotta-500"> *</span>}
                          </label>
                          <FieldControl field={field} value={values[field.name]} onChange={(value) => setValue(field.name, value)} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {form.skippedSignatureFields > 0 && (
                <p className="text-xs text-gray-500 dark:text-zinc-400 text-center">This form has {form.skippedSignatureFields === 1 ? 'a signature box' : `${form.skippedSignatureFields} signature boxes`}. Save first, then choose “Sign this PDF”.</p>
              )}

              <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm space-y-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} className="mt-0.5 w-5 h-5 accent-terracotta-500 shrink-0" />
                  <span>
                    <span className="block text-sm font-bold dark:text-white">Lock answers into the page</span>
                    <span className="block text-xs text-gray-500 dark:text-zinc-400">Recommended before sending. Untick to keep the fields editable so you can finish later.</span>
                  </span>
                </label>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 px-1">Output Filename</label>
                  <input type="text" value={customFileName} onChange={(e) => setCustomFileName(e.target.value)} className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-terracotta-500 outline-none font-bold text-sm dark:text-white" />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <ToolSeoContent
        title="Fill PDF Form"
        headline="Fill In PDF Forms Online, Privately"
        description="Type answers straight into a PDF's form fields — text boxes, checkboxes, radio buttons and dropdowns — then download the completed form or sign it. Everything runs in your browser, so the form and your answers never leave your device."
        benefits={[
          "Fill text fields, checkboxes, radio buttons and dropdowns.",
          "Works with forms that block editing, such as many tax and government forms.",
          "Lock your answers into the page before sending, or keep them editable.",
          "Go straight from a filled form to adding your signature.",
        ]}
        howItWorks={[
          "Open a fillable PDF form.",
          "Type into the fields on the page, or switch to the list view on a phone.",
          "Save the filled PDF.",
          "Download or share it, or choose “Sign this PDF” to add your signature.",
        ]}
        faqs={[
          { q: "Are my answers uploaded anywhere?", a: "No. The form is read and filled entirely in your browser. Nothing you type is sent to a server." },
          { q: "Why does my PDF say it has no fillable fields?", a: "Some forms are just printed pages with lines — scanned or exported without interactive fields. Those can't be typed into here. You can still sign them with the Signature tool." },
          { q: "What is an XFA form?", a: "XFA is an older Adobe format used by some government agencies. Only Adobe Acrobat and Acrobat Reader can fill these. Most modern fillable PDFs use standard fields and work here." },
          { q: "What does “Lock answers into the page” do?", a: "It flattens the form: your answers become part of the page, so they look the same in every viewer and can't be changed by accident. Untick it if you want to come back and edit later." },
        ]}
      />
    </NativeToolLayout>
  )
}
