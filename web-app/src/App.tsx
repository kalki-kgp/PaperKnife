import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileUp,
  Gauge,
  LockKeyhole,
  Search,
  Shield,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { HashRouter, Link, Route, Routes, useParams } from 'react-router-dom'
import { categories, tools } from './data/tools'
import type { JobRecord } from './types'

type CategoryFilter = (typeof categories)[number]
type OutputArtifact = {
  blob: Blob
  fileName: string
  mimeType: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const size = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / 1024 ** size
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[size]}`
}

function readIncomingFile(list: FileList | null): File | null {
  if (!list || list.length === 0) {
    return null
  }

  const [file] = Array.from(list)
  return file
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function stripExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot <= 0 ? fileName : fileName.slice(0, lastDot)
}

function triggerDownload(downloadUrl: string, fileName: string): void {
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = fileName
  anchor.click()
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not generate image blob.'))
          return
        }

        resolve(blob)
      },
      type,
      quality,
    )
  })
}

async function createPdfImageOutput(file: File, quality: number, onProgress: (progress: number) => void): Promise<OutputArtifact> {
  const [{ GlobalWorkerOptions, getDocument }, { default: JSZip }, { default: pdfWorkerSrc }] = await Promise.all([
    import('pdfjs-dist'),
    import('jszip'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])

  if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    throw new Error('PDF to Image requires a PDF file.')
  }

  const source = new Uint8Array(await file.arrayBuffer())
  const loadingTask = getDocument({ data: source })
  const pdf = await loadingTask.promise
  const zip = new JSZip()
  const baseName = stripExtension(file.name)
  const padWidth = Math.max(2, String(pdf.numPages).length)

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const scale = 1 + quality / 60
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create rendering context.')
    }

    await page.render({ canvas, canvasContext: context, viewport }).promise
    const imageBlob = await canvasToBlob(canvas, 'image/png')
    const pageSuffix = String(pageNumber).padStart(padWidth, '0')
    zip.file(`${baseName}-page-${pageSuffix}.png`, imageBlob)
    onProgress(Math.round((pageNumber / pdf.numPages) * 90))
  }

  const outputBlob = await zip.generateAsync(
    { type: 'blob' },
    ({ percent }) => {
      onProgress(Math.min(99, Math.round(90 + percent / 10)))
    },
  )

  pdf.cleanup()
  await loadingTask.destroy()

  return {
    blob: outputBlob,
    fileName: `${baseName}-images.zip`,
    mimeType: 'application/zip',
  }
}

async function createOutputArtifact(
  toolId: string,
  file: File,
  quality: number,
  onProgress: (progress: number) => void,
): Promise<OutputArtifact> {
  if (toolId === 'pdf-to-image') {
    return createPdfImageOutput(file, quality, onProgress)
  }

  const sourceBuffer = await file.arrayBuffer()
  onProgress(100)
  return {
    blob: new Blob([sourceBuffer], { type: file.type || 'application/octet-stream' }),
    fileName: `${stripExtension(file.name)}-${toolId}-output.${file.name.split('.').pop() || 'bin'}`,
    mimeType: file.type || 'application/octet-stream',
  }
}

function AppChrome({
  activeFile,
  onFileSelect,
  onFileClear,
  jobs,
  onQueue,
}: {
  activeFile: File | null
  onFileSelect: (file: File | null) => void
  onFileClear: () => void
  jobs: JobRecord[]
  onQueue: (toolId: string, fileName: string) => void
}) {
  return (
    <div className="control-room">
      <div className="texture-overlay" />
      <div className="accent-wave accent-wave-a" />
      <div className="accent-wave accent-wave-b" />

      <header className="command-header reveal-up">
        <Link to="/" className="brand-mark" aria-label="PaperKnife home">
          <span className="brand-monogram">PK</span>
          <div>
            <p>PaperKnife / Web Ops</p>
            <small>Local-only Document Forge</small>
          </div>
        </Link>

        <div className="header-pills">
          <span>
            <Shield size={14} />
            Zero Uploads
          </span>
          <span>
            <Clock3 size={14} />
            {jobs.length} Runs Logged
          </span>
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <HomePage activeFile={activeFile} onFileSelect={onFileSelect} onFileClear={onFileClear} jobs={jobs} />
          }
        />
        <Route
          path="/tool/:toolId"
          element={
            <ToolWorkspace
              activeFile={activeFile}
              onFileSelect={onFileSelect}
              onFileClear={onFileClear}
              onQueue={onQueue}
              jobs={jobs}
            />
          }
        />
      </Routes>
    </div>
  )
}

function HomePage({
  activeFile,
  onFileSelect,
  onFileClear,
  jobs,
}: {
  activeFile: File | null
  onFileSelect: (file: File | null) => void
  onFileClear: () => void
  jobs: JobRecord[]
}) {
  const [query, setQuery] = useState('')
  const [selectedGoal, setSelectedGoal] = useState<Exclude<CategoryFilter, 'All'> | null>(null)
  const [showAllTools, setShowAllTools] = useState(false)
  const [dragging, setDragging] = useState(false)

  const goalChoices = useMemo(
    () => categories.filter((category): category is Exclude<CategoryFilter, 'All'> => category !== 'All'),
    [],
  )

  const goalDescription: Record<Exclude<CategoryFilter, 'All'>, string> = {
    Edit: 'Merge, split, rotate, watermark, and reorder pages.',
    Secure: 'Protect files, remove locks, and clean metadata.',
    Convert: 'Move between PDF, images, and text formats.',
    Optimize: 'Compress, grayscale, and repair heavy documents.',
  }

  const filtered = useMemo(() => {
    return tools.filter((tool) => {
      if (!selectedGoal) {
        return false
      }

      const matchesCategory = tool.category === selectedGoal
      const text = `${tool.title} ${tool.description} ${tool.category}`.toLowerCase()
      const matchesQuery = text.includes(query.trim().toLowerCase())
      return matchesCategory && matchesQuery
    })
  }, [query, selectedGoal])

  const visibleTools = showAllTools ? filtered : filtered.slice(0, 4)

  const totalRuns = jobs.length
  const lastJob = jobs[0]

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    onFileSelect(readIncomingFile(event.dataTransfer.files))
  }

  const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelect(readIncomingFile(event.target.files))
  }

  return (
    <main className="home-flow">
      <section className="panel welcome-panel reveal-up">
        <p className="kicker">Start Here</p>
        <h1>One clear flow for every user.</h1>
        <p>
          Upload your document, select what you want to do, then pick from a short recommended tool list.
          No noisy dashboard.
        </p>
        <div className="flow-strip">
          <span>1. Add file</span>
          <span>2. Pick goal</span>
          <span>3. Run tool</span>
        </div>
        <small className="flow-meta">
          {lastJob
            ? `Last run: ${lastJob.fileName} at ${formatTimestamp(lastJob.createdAt)}`
            : `${totalRuns} total local runs. Files never leave browser memory.`}
        </small>
      </section>

      <section
        className={`panel step-panel reveal-up ${dragging ? 'dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
        onDrop={handleDrop}
      >
        <div className="step-head">
          <span className="step-number">Step 1</span>
          <h2>Upload your document</h2>
        </div>
        <div className="drop-zone-lite">
          <div className="ingest-icon">{activeFile ? <CheckCircle2 size={26} /> : <Upload size={26} />}</div>
          {activeFile ? (
            <div className="active-file-inline">
              <strong>{activeFile.name}</strong>
              <small>{formatBytes(activeFile.size)}</small>
              <button type="button" onClick={onFileClear} aria-label="Clear file">
                <X size={14} />
              </button>
            </div>
          ) : (
            <p>Drag PDF/JPG/PNG/WebP here or choose from device.</p>
          )}
        </div>
        <label className="ink-btn" htmlFor="main-file-input">
          <FileUp size={16} />
          Choose Local File
        </label>
        <input
          id="main-file-input"
          className="hidden-input"
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          onChange={handleSelect}
        />
      </section>

      <section className="panel step-panel reveal-up">
        <div className="step-head">
          <span className="step-number">Step 2</span>
          <h2>What do you want to do?</h2>
        </div>
        <div className="goal-grid">
          {goalChoices.map((goal) => (
            <button
              key={goal}
              className={`goal-card ${selectedGoal === goal ? 'active' : ''}`}
              onClick={() => {
                setSelectedGoal(goal)
                setShowAllTools(false)
              }}
              type="button"
            >
              <strong>{goal}</strong>
              <span>{goalDescription[goal]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel step-panel reveal-up">
        <div className="step-head">
          <span className="step-number">Step 3</span>
          <h2>Pick a tool</h2>
        </div>

        {!selectedGoal ? (
          <p className="step-placeholder">Choose a goal in Step 2 to unlock suggested tools.</p>
        ) : (
          <>
            <div className="search-slot compact">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search within ${selectedGoal.toLowerCase()} tools`}
                aria-label="Search tools"
              />
            </div>

            <div className="guided-tools">
              {visibleTools.map((tool, idx) => {
                const Icon = tool.icon
                return (
                  <Link
                    key={tool.id}
                    className="guided-tool reveal-up"
                    style={{ ['--accent' as string]: tool.accent, animationDelay: `${Math.min(idx * 45, 300)}ms` }}
                    to={`/tool/${tool.id}`}
                  >
                    <div className="guided-tool-main">
                      <span className="guided-icon">
                        <Icon size={18} />
                      </span>
                      <div>
                        <strong>{tool.title}</strong>
                        <p>{tool.description}</p>
                      </div>
                    </div>
                    <div className="guided-tool-meta">
                      <span>{tool.eta}</span>
                      <ArrowRight size={14} />
                    </div>
                  </Link>
                )
              })}
            </div>

            {filtered.length > 4 && (
              <button className="wire-btn show-more" type="button" onClick={() => setShowAllTools((prev) => !prev)}>
                {showAllTools ? 'Show fewer tools' : `Show all ${filtered.length} tools`}
              </button>
            )}

            {filtered.length === 0 && <p className="step-placeholder">No match for this search. Try another keyword.</p>}
          </>
        )}
      </section>
    </main>
  )
}

function ToolWorkspace({
  activeFile,
  onFileSelect,
  onFileClear,
  onQueue,
  jobs,
}: {
  activeFile: File | null
  onFileSelect: (file: File | null) => void
  onFileClear: () => void
  onQueue: (toolId: string, fileName: string) => void
  jobs: JobRecord[]
}) {
  const { toolId } = useParams()
  const tool = tools.find((item) => item.id === toolId)

  const [quality, setQuality] = useState(72)
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL')
  const [password, setPassword] = useState('')
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [latestOutput, setLatestOutput] = useState<{
    fileName: string
    size: number
    createdAt: number
    downloadUrl: string
    mimeType: string
  } | null>(null)

  const runLockRef = useRef(false)

  useEffect(() => {
    return () => {
      if (latestOutput?.downloadUrl) {
        URL.revokeObjectURL(latestOutput.downloadUrl)
      }
    }
  }, [latestOutput])

  if (!tool) {
    return (
      <main className="workspace-grid">
        <article className="panel workspace-main">
          <h1>Tool not found</h1>
          <p>This module does not exist in the current catalog.</p>
          <Link to="/" className="wire-btn">
            Back to tool list
          </Link>
        </article>
      </main>
    )
  }

  const Icon = tool.icon

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelect(readIncomingFile(event.target.files))
  }

  const startRun = async () => {
    if (!activeFile || running || runLockRef.current) {
      return
    }

    runLockRef.current = true
    setRunError(null)
    setRunning(true)
    setProgress(6)

    try {
      const output = await createOutputArtifact(tool.id, activeFile, quality, (nextProgress) => {
        setProgress(Math.max(6, Math.min(99, nextProgress)))
      })

      const downloadUrl = URL.createObjectURL(output.blob)
      if (latestOutput?.downloadUrl) {
        URL.revokeObjectURL(latestOutput.downloadUrl)
      }

      setLatestOutput({
        fileName: output.fileName,
        size: output.blob.size,
        createdAt: Date.now(),
        downloadUrl,
        mimeType: output.mimeType,
      })

      triggerDownload(downloadUrl, output.fileName)
      setProgress(100)
      onQueue(tool.id, activeFile.name)
    } catch (error) {
      setProgress(0)
      setRunError(error instanceof Error ? error.message : 'Failed to generate output.')
    } finally {
      setRunning(false)
      runLockRef.current = false
    }
  }

  const recentJobs = jobs
    .filter((job) => job.toolId === tool.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4)

  const downloadRunSummary = () => {
    if (!activeFile) {
      return
    }

    const lines = [
      `PaperKnife Web Job`,
      `Tool: ${tool.title}`,
      `Input: ${activeFile.name} (${formatBytes(activeFile.size)})`,
      `Quality: ${quality}`,
      `Watermark: ${watermarkText || 'none'}`,
      `Password set: ${password ? 'yes' : 'no'}`,
      `Generated: ${new Date().toISOString()}`,
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `${tool.id}-run.txt`
    anchor.click()
    URL.revokeObjectURL(href)
  }

  return (
    <main className="workspace-grid">
      <article className="panel workspace-main reveal-up">
        <Link className="back-link" to="/">
          Back to Tool Deck
        </Link>

        <header className="workspace-head" style={{ ['--accent' as string]: tool.accent }}>
          <div className="workspace-title">
            <span className="workspace-icon">
              <Icon size={18} />
            </span>
            <div>
              <p className="kicker">Active Operation</p>
              <h1>{tool.title}</h1>
              <p>{tool.description}</p>
            </div>
          </div>
          <span className="eta-badge">{tool.eta}</span>
        </header>

        <section className="file-bay">
          <div className="file-row">
            {activeFile ? (
              <div className="file-pill">
                <strong>{activeFile.name}</strong>
                <span>{formatBytes(activeFile.size)}</span>
                <button onClick={onFileClear} type="button" aria-label="Clear file">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="empty-pill">
                <p>No file selected yet.</p>
              </div>
            )}

            <label className="wire-btn" htmlFor="workspace-file-input">
              Replace file
            </label>
            <input
              id="workspace-file-input"
              className="hidden-input"
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
            />
          </div>
        </section>

        <section className="controls-grid">
          <label>
            Quality Profile <strong>{quality}</strong>
            <input
              type="range"
              min={20}
              max={100}
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
          </label>

          <label>
            Watermark Label
            <input
              type="text"
              value={watermarkText}
              onChange={(event) => setWatermarkText(event.target.value)}
              placeholder="Optional label"
            />
          </label>

          <label>
            Password (optional)
            <div className="inline-input">
              <LockKeyhole size={16} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Only needed for secure tools"
              />
            </div>
          </label>
        </section>

        <section className="run-actions">
          <button className="ink-btn" type="button" disabled={!activeFile || running} onClick={startRun}>
            <Sparkles size={16} />
            {running ? 'Processing...' : 'Run Tool'}
          </button>

          <button className="wire-btn" type="button" disabled={!activeFile} onClick={downloadRunSummary}>
            <Gauge size={16} />
            Export Job Note
          </button>
        </section>
      </article>

      <aside className="panel workspace-side reveal-up">
        <h2>Run Monitor</h2>

        <section className="progress-box" style={{ ['--accent' as string]: tool.accent }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p>{running ? `Working... ${progress}%` : progress === 100 ? 'Completed.' : 'Ready to start.'}</p>
          {runError && <p className="error-text">{runError}</p>}
        </section>

        <section className="output-box">
          <h3>Latest Output</h3>
          {latestOutput ? (
            <div className="output-entry">
              <strong>{latestOutput.fileName}</strong>
              <span>
                {formatBytes(latestOutput.size)} • {formatTimestamp(latestOutput.createdAt)}
              </span>
              <button
                className="wire-btn output-btn"
                type="button"
                onClick={() => triggerDownload(latestOutput.downloadUrl, latestOutput.fileName)}
              >
                <Download size={14} />
                Download again
              </button>
              <small>Saved via browser download.</small>
            </div>
          ) : (
            <p className="muted">Run the tool to generate output.</p>
          )}
        </section>

        <section className="timeline">
          <h3>Recent {tool.title} Runs</h3>
          {recentJobs.length === 0 ? (
            <p className="muted">No runs for this tool yet.</p>
          ) : (
            <ul className="job-list">
              {recentJobs.map((job) => (
                <li key={job.id}>
                  <strong>{job.fileName}</strong>
                  <span>{formatTimestamp(job.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </main>
  )
}

export default function App() {
  const [activeFile, setActiveFile] = useState<File | null>(null)
  const [jobs, setJobs] = useState<JobRecord[]>([])

  const queueJob = (toolId: string, fileName: string) => {
    const now = Date.now()

    setJobs((prev) => {
      const latest = prev[0]
      if (latest && latest.toolId === toolId && latest.fileName === fileName && now - latest.createdAt < 2500) {
        return prev
      }

      return [
        {
          id: `${toolId}-${now}`,
          toolId,
          fileName,
          createdAt: now,
          status: 'done',
        },
        ...prev,
      ]
    })
  }

  return (
    <HashRouter>
      <AppChrome
        activeFile={activeFile}
        onFileSelect={setActiveFile}
        onFileClear={() => setActiveFile(null)}
        jobs={jobs}
        onQueue={queueJob}
      />
    </HashRouter>
  )
}
