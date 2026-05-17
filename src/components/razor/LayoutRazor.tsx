/**
 * PaperKnife — RAZOR variant shell
 * Brutalist tech-noir chrome: hairline header, terminal status, sharp corners,
 * acid-lime accent. Surrounds existing tools without rebuilding their internals.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  ArrowLeft as ArrowLeftIcon,
  History as HistoryIcon,
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  Trash2 as Trash2Icon,
  Download as DownloadIcon,
  CheckCircle2 as CheckCircleIcon,
  Upload as UploadIcon,
  Github as GHIcon,
  Plus as PlusIcon,
  Home as HomeIcon,
  LayoutGrid as LayoutGridIcon,
  Settings as SettingsIcon,
  X as XIcon,
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Tool, ToolCategory, ViewMode } from '../../types'
import { ActivityEntry, getRecentActivity, clearActivity } from '../../utils/recentActivity'
import { hapticImpact } from '../../utils/haptics'
import {
  getInitialOfflineProgress,
  subscribeOfflineStatus,
  type OfflineProgress,
} from '../../utils/offlineStatus'
import { DesignVariant } from '../../utils/designVariant'

interface Props {
  children: React.ReactNode
  tools: Tool[]
  onFileDrop?: (files: FileList) => void
  viewMode: ViewMode
  variant: DesignVariant
  onChangeVariant: (v: DesignVariant) => void
}

const CATEGORY_LABEL: Record<ToolCategory, string> = {
  Edit: 'EDIT',
  Secure: 'SECURE',
  Convert: 'CONVERT',
  Optimize: 'OPTIMIZE',
}

export default function LayoutRazor({
  children,
  tools,
  onFileDrop,
  viewMode,
  onChangeVariant,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isDragging, setIsDragging] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [offlineProgress, setOfflineProgress] = useState<OfflineProgress>(() =>
    getInitialOfflineProgress(),
  )
  const [clock, setClock] = useState(() => new Date())
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isNative = Capacitor.isNativePlatform()
  const showMobileNav = isNative || viewMode === 'android'
  const isHome = location.pathname === '/'
  const isMainView =
    isHome ||
    location.pathname.endsWith('/android-tools') ||
    location.pathname.endsWith('/android-history') ||
    location.pathname.endsWith('/settings')
  const activeTool = useMemo(() => {
    return tools.find((t) => t.path && location.pathname === t.path)
  }, [tools, location.pathname])

  const shouldShowMobileNav = showMobileNav && isMainView && !activeTool

  /* History */
  useEffect(() => {
    if (showHistory) getRecentActivity().then(setActivity)
  }, [showHistory])

  /* Outside-click for dropdown */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  /* Offline status subscription */
  useEffect(() => subscribeOfflineStatus(setOfflineProgress), [])

  /* Clock for status bar */
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  /* Global drag-and-drop */
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    const hasFiles = (dt: DataTransfer | null) =>
      !!dt && Array.from(dt.types).includes('Files')

    const onOver = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return
      e.preventDefault()
      if (onFileDrop) setIsDragging(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return
      e.preventDefault()
      if (
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      )
        setIsDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return
      e.preventDefault()
      setIsDragging(false)
      if (onFileDrop && e.dataTransfer?.files) onFileDrop(e.dataTransfer.files)
    }

    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [onFileDrop])

  const isReady = offlineProgress.status === 'ready'
  const isPreparing = offlineProgress.status === 'preparing'
  const isUpdating = offlineProgress.status === 'updating'
  const offlinePercent = isReady
    ? 100
    : offlineProgress.total > 0
      ? Math.min(99, Math.round((offlineProgress.completed / offlineProgress.total) * 100))
      : 18

  const groupedTools = useMemo(() => {
    return tools
      .filter((t) => t.implemented)
      .reduce<Record<ToolCategory, Tool[]>>(
        (acc, t) => {
          if (!acc[t.category]) acc[t.category] = []
          acc[t.category].push(t)
          return acc
        },
        { Edit: [], Secure: [], Convert: [], Optimize: [] },
      )
  }, [tools])

  const timestamp =
    `${clock.toISOString().slice(0, 10)} ` +
    clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <div className="razor-grain min-h-screen flex flex-col bg-[color:var(--pk-bg)] text-[color:var(--pk-bone)]">
      {/* ─── Drag overlay ─────────────────────────────────────────── */}
      {isDragging && (
        <div className="fixed inset-0 z-[200] backdrop-blur-sm bg-[color:var(--pk-bg-deep)]/80 flex items-center justify-center pointer-events-none">
          <div className="razor-grid absolute inset-0 opacity-40" />
          <div
            className="relative bg-[color:var(--pk-bg)] border border-dashed p-12 max-w-md w-[90%] text-center"
            style={{ borderColor: 'var(--pk-razor)' }}
          >
            <div className="razor-label text-[color:var(--pk-razor)] mb-6">
              ▸ INCOMING TRANSMISSION
            </div>
            <UploadIcon size={48} className="text-[color:var(--pk-razor)] mx-auto mb-4 razor-tick" />
            <p className="razor-display-roman text-3xl mb-2">drop to begin.</p>
            <p className="razor-mono text-xs text-[color:var(--pk-stone)]">
              file stays on this device — local processing only.
            </p>
          </div>
        </div>
      )}

      {/* ─── Status rail (desktop only) ───────────────────────────── */}
      {!showMobileNav && (
        <div className="border-b border-[color:var(--pk-hairline)] bg-[color:var(--pk-bg-deep)]/60">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-7 flex items-center justify-between text-[10px] razor-mono text-[color:var(--pk-stone)] uppercase tracking-[0.18em]">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    isReady ? 'bg-[color:var(--pk-razor)]' : 'bg-[color:var(--pk-ember)]'
                  } razor-blink`}
                />
                {isReady ? 'OFFLINE READY' : isPreparing ? `SYNCING ${offlinePercent}%` : isUpdating ? 'UPDATING…' : 'ONLINE'}
              </span>
              <span className="hidden md:inline">PAPERKNIFE / v3.0</span>
              <span className="hidden lg:inline">AGPL-3.0</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="hidden md:inline">0 BYTES UPLOADED</span>
              <span className="text-[color:var(--pk-stone-dim)]">{timestamp} UTC</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Primary header ───────────────────────────────────────── */}
      {!showMobileNav && (
        <header className="sticky top-0 z-[100] border-b border-[color:var(--pk-hairline)] bg-[color:var(--pk-bg)]/85 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6 min-w-0 flex-1">
              {!isHome && (
                <button
                  onClick={() => navigate('/')}
                  aria-label="Back to home"
                  className="text-[color:var(--pk-stone)] hover:text-[color:var(--pk-razor)] transition-colors p-1.5 -ml-1.5"
                >
                  <ArrowLeftIcon size={18} />
                </button>
              )}
              <Link to="/" aria-label="PaperKnife home" className="flex items-center gap-3 group shrink-0">
                <RazorMark />
                <div className="flex flex-col leading-none">
                  <span className="razor-display-roman text-xl tracking-tight group-hover:text-[color:var(--pk-razor)] transition-colors">
                    paperknife
                  </span>
                  <span className="razor-label text-[8px] text-[color:var(--pk-stone-dim)] mt-0.5">
                    a knife for paper
                  </span>
                </div>
              </Link>

              <div className="hidden md:block w-px h-7 bg-[color:var(--pk-hairline)]" />

              <div className="relative min-w-0 hidden md:block" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen((v) => !v)}
                  className={`razor-label flex items-center gap-2 px-3 h-9 border transition-all ${
                    isDropdownOpen
                      ? 'border-[color:var(--pk-razor)] text-[color:var(--pk-razor)]'
                      : 'border-[color:var(--pk-hairline)] text-[color:var(--pk-stone)] hover:text-[color:var(--pk-bone)] hover:border-[color:var(--pk-hairline-hi)]'
                  }`}
                >
                  <span>{isHome ? '◇ all tools' : `▸ ${activeTool?.title || 'tool'}`}</span>
                  <ChevronDownIcon
                    size={12}
                    className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[420px] max-h-[72vh] overflow-y-auto bg-[color:var(--pk-bg-elev)] border border-[color:var(--pk-hairline-hi)] z-[110] shadow-2xl shadow-black/60">
                    <div className="px-5 py-3 border-b border-[color:var(--pk-hairline)] flex items-center justify-between">
                      <span className="razor-label text-[color:var(--pk-stone)]">tool index</span>
                      <span className="razor-label text-[color:var(--pk-razor)]">{tools.filter(t => t.implemented).length} / {tools.length}</span>
                    </div>
                    {Object.entries(groupedTools).map(([cat, list]) => (
                      <div key={cat} className="border-b border-[color:var(--pk-hairline)] last:border-b-0">
                        <div className="px-5 py-2 razor-label text-[color:var(--pk-stone-dim)]">
                          / {CATEGORY_LABEL[cat as ToolCategory]}
                        </div>
                        {list.map((t) => {
                          const Icon = t.icon
                          const active = activeTool?.title === t.title
                          return (
                            <button
                              key={t.title}
                              onClick={() => {
                                if (t.path) navigate(t.path)
                                setIsDropdownOpen(false)
                              }}
                              className={`w-full flex items-center gap-3 px-5 py-2.5 text-left group transition-colors ${
                                active
                                  ? 'bg-[color:var(--pk-bg-hi)] text-[color:var(--pk-razor)]'
                                  : 'hover:bg-[color:var(--pk-bg-hi)] text-[color:var(--pk-bone)]'
                              }`}
                            >
                              <Icon size={14} className={active ? 'text-[color:var(--pk-razor)]' : 'text-[color:var(--pk-stone)] group-hover:text-[color:var(--pk-razor)]'} />
                              <span className="razor-mono text-xs flex-1">{t.title.toLowerCase()}</span>
                              <ChevronRightIcon size={12} className="text-[color:var(--pk-stone-dim)] group-hover:text-[color:var(--pk-razor)] transition-colors" />
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <a
                href="https://github.com/kalki-kgp/PaperKnife"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="hidden sm:flex razor-label items-center gap-2 px-3 h-9 border border-[color:var(--pk-hairline)] text-[color:var(--pk-stone)] hover:text-[color:var(--pk-bone)] hover:border-[color:var(--pk-hairline-hi)] transition-all"
              >
                <GHIcon size={12} /> GH
              </a>
              <Link
                to="/about"
                className={`hidden md:flex razor-label items-center gap-2 px-3 h-9 border transition-all ${
                  location.pathname.includes('about')
                    ? 'border-[color:var(--pk-razor)] text-[color:var(--pk-razor)]'
                    : 'border-[color:var(--pk-hairline)] text-[color:var(--pk-stone)] hover:text-[color:var(--pk-bone)] hover:border-[color:var(--pk-hairline-hi)]'
                }`}
              >
                ABOUT
              </Link>
              <button
                onClick={() => setShowHistory(true)}
                aria-label="Activity history"
                className="razor-label flex items-center gap-2 px-3 h-9 border border-[color:var(--pk-hairline)] text-[color:var(--pk-stone)] hover:text-[color:var(--pk-bone)] hover:border-[color:var(--pk-hairline-hi)] transition-all relative"
              >
                <HistoryIcon size={12} />
                <span className="hidden sm:inline">LOG</span>
                {activity.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-[color:var(--pk-razor)]" />
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ─── Main content ─────────────────────────────────────────── */}
      <main className={`relative z-[2] flex-1 min-w-0 ${shouldShowMobileNav ? 'pb-32' : ''}`}>
        {children}
      </main>

      {/* ─── Footer (desktop) ─────────────────────────────────────── */}
      {!showMobileNav && (
        <footer className="border-t border-[color:var(--pk-hairline)] mt-24 bg-[color:var(--pk-bg-deep)] relative z-[2]">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-14">
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-12 md:col-span-5 space-y-5">
                <div className="flex items-center gap-3">
                  <RazorMark />
                  <span className="razor-display-roman text-xl">paperknife.</span>
                </div>
                <p className="razor-mono text-xs text-[color:var(--pk-stone)] leading-relaxed max-w-sm">
                  A surgical PDF toolkit. Twenty tools.
                  Zero uploads. Zero accounts. Zero tracking.
                  Open source. AGPL-3.0.
                </p>
                <div className="flex items-center gap-2 razor-label text-[color:var(--pk-stone-dim)]">
                  <span className="w-1.5 h-1.5 bg-[color:var(--pk-razor)] inline-block razor-blink" />
                  ENGINE LIVE — paperknife.app
                </div>
              </div>

              <div className="col-span-6 md:col-span-3">
                <div className="razor-label text-[color:var(--pk-stone-dim)] mb-4">/ protocol</div>
                <ul className="space-y-2.5 razor-mono text-xs text-[color:var(--pk-stone)]">
                  <li><Link to="/about" className="hover:text-[color:var(--pk-razor)] transition-colors">about</Link></li>
                  <li><Link to="/privacy" className="hover:text-[color:var(--pk-razor)] transition-colors">privacy spec</Link></li>
                  <li><a href="https://github.com/kalki-kgp/PaperKnife/blob/main/LICENSE" target="_blank" rel="noopener" className="hover:text-[color:var(--pk-razor)] transition-colors">license</a></li>
                  <li><Link to="/thanks" className="hover:text-[color:var(--pk-razor)] transition-colors">credits</Link></li>
                </ul>
              </div>

              <div className="col-span-6 md:col-span-4">
                <div className="razor-label text-[color:var(--pk-stone-dim)] mb-4">/ ecosystem</div>
                <ul className="space-y-2.5 razor-mono text-xs text-[color:var(--pk-stone)]">
                  <li><a href="https://resumate.paperknife.app" target="_blank" rel="noopener" className="hover:text-[color:var(--pk-razor)] transition-colors">resumate — ai resume builder ↗</a></li>
                  <li><a href="https://ko-fi.com/kalkikgp" target="_blank" rel="noopener" className="hover:text-[color:var(--pk-razor)] transition-colors">buy me a coffee ↗</a></li>
                  <li><a href="https://github.com/sponsors/kalki-kgp" target="_blank" rel="noopener" className="hover:text-[color:var(--pk-razor)] transition-colors">github sponsors ↗</a></li>
                  <li><Link to="/feedback?type=enterprise" className="hover:text-[color:var(--pk-razor)] transition-colors">enterprise licensing</Link></li>
                  <li><Link to="/feedback?type=tool" className="hover:text-[color:var(--pk-razor)] transition-colors">request a tool</Link></li>
                  <li><Link to="/feedback?type=bug" className="hover:text-[color:var(--pk-razor)] transition-colors">report a bug</Link></li>
                </ul>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-[color:var(--pk-hairline)] flex flex-col md:flex-row justify-between gap-3 razor-label text-[color:var(--pk-stone-dim)]">
              <span>© 2026 PAPERKNIFE PROJECT — NO COOKIES, NO TRACKING</span>
              <button
                onClick={() => onChangeVariant('classic')}
                className="text-left hover:text-[color:var(--pk-razor)] transition-colors"
                title="Return to the original design"
              >
                ▸ DESIGN: RAZOR / SWITCH TO CLASSIC
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* ─── History drawer ───────────────────────────────────────── */}
      <aside
        className={`fixed top-0 right-0 h-screen w-full sm:w-96 bg-[color:var(--pk-bg-elev)] border-l border-[color:var(--pk-hairline-hi)] z-[150] shadow-2xl shadow-black/80 transform transition-transform duration-500 ${
          showHistory ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-7 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="razor-label text-[color:var(--pk-stone-dim)] mb-1">/ session log</div>
              <h2 className="razor-display-roman text-3xl">activity.</h2>
            </div>
            <div className="flex items-center gap-2">
              {activity.length > 0 && (
                <button
                  onClick={async () => {
                    await clearActivity()
                    setActivity([])
                  }}
                  aria-label="Clear log"
                  className="p-2 text-[color:var(--pk-stone)] hover:text-[color:var(--pk-ember)] transition-colors border border-[color:var(--pk-hairline)] hover:border-[color:var(--pk-ember)]"
                >
                  <Trash2Icon size={14} />
                </button>
              )}
              <button
                onClick={() => setShowHistory(false)}
                aria-label="Close"
                className="p-2 text-[color:var(--pk-stone)] hover:text-[color:var(--pk-bone)] transition-colors border border-[color:var(--pk-hairline)] hover:border-[color:var(--pk-hairline-hi)]"
              >
                <XIcon size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2.5">
            {activity.length === 0 ? (
              <div className="text-center py-24">
                <div className="razor-label text-[color:var(--pk-stone-dim)] mb-2">▸ empty buffer</div>
                <p className="razor-mono text-xs text-[color:var(--pk-stone)]">
                  no recent operations on this device.
                </p>
              </div>
            ) : (
              activity.map((item) => (
                <div
                  key={item.id}
                  className="border border-[color:var(--pk-hairline)] bg-[color:var(--pk-bg-hi)] p-4 hover:border-[color:var(--pk-razor)] transition-colors group"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <CheckCircleIcon
                      size={14}
                      className="text-[color:var(--pk-razor)] mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="razor-mono text-xs text-[color:var(--pk-bone)] truncate">
                        {item.name}
                      </p>
                      <p className="razor-label text-[color:var(--pk-stone-dim)] mt-1">
                        / {item.tool}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between razor-label text-[color:var(--pk-stone-dim)]">
                    <span>{new Date(item.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                    {item.resultUrl && (
                      <a
                        href={item.resultUrl}
                        download={item.name}
                        className="flex items-center gap-1.5 text-[color:var(--pk-razor)] hover:underline"
                      >
                        <DownloadIcon size={11} /> RE-PULL
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
      {showHistory && (
        <div
          onClick={() => setShowHistory(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[140] animate-in fade-in duration-300"
        />
      )}

      {/* ─── Mobile bottom nav ────────────────────────────────────── */}
      {shouldShowMobileNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[color:var(--pk-bg-deep)] border-t border-[color:var(--pk-hairline-hi)] flex items-end justify-between px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 z-[100]">
          <RazorNavBtn
            active={location.pathname === '/'}
            label="HOME"
            onClick={() => navigate('/')}
            icon={<HomeIcon size={20} />}
          />
          <RazorNavBtn
            active={location.pathname === '/android-tools'}
            label="TOOLS"
            onClick={() => navigate('/android-tools')}
            icon={<LayoutGridIcon size={20} />}
          />
          <div className="relative -top-7">
            <button
              onClick={() => {
                hapticImpact()
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.pdf'
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) onFileDrop?.([file] as any)
                }
                input.click()
              }}
              aria-label="Upload PDF"
              className="w-14 h-14 bg-[color:var(--pk-razor)] text-[color:var(--pk-bg)] flex items-center justify-center active:scale-90 transition-transform shadow-2xl shadow-[color:var(--pk-razor-glow)]"
            >
              <PlusIcon size={28} strokeWidth={3} />
            </button>
          </div>
          <RazorNavBtn
            active={location.pathname === '/android-history'}
            label="LOG"
            onClick={() => navigate('/android-history')}
            icon={<HistoryIcon size={20} />}
          />
          <RazorNavBtn
            active={location.pathname.includes('settings')}
            label="SET"
            onClick={() => navigate('/settings')}
            icon={<SettingsIcon size={20} />}
          />
        </nav>
      )}
    </div>
  )
}

function RazorNavBtn({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean
  label: string
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 flex-1 transition-colors ${
        active ? 'text-[color:var(--pk-razor)]' : 'text-[color:var(--pk-stone-dim)]'
      }`}
    >
      {icon}
      <span className="razor-label text-[9px]">{label}</span>
    </button>
  )
}

function RazorMark() {
  // Sharp wedge "P" mark — references the knife/paper duality.
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3 L21 12 L3 12 Z" fill="var(--pk-razor)" />
      <path d="M3 21 L21 12 L3 12 Z" fill="var(--pk-bone)" />
      <line x1="3" y1="3" x2="3" y2="21" stroke="var(--pk-razor)" strokeWidth="1" />
    </svg>
  )
}
