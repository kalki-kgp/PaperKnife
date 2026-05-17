/**
 * PaperKnife - Midnight shell (canary)
 * Mirrors the classic Layout structure 1:1, restyled with the midnight design language.
 * Component positions, props, and behaviors are intentionally unchanged so existing
 * users find every control where they expect it.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Download as DownloadIcon,
  History as HistoryIcon,
  Upload as UploadIcon,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  Plus as PlusIcon,
  Trash2 as Trash2Icon,
  CheckCircle2 as CheckCircleIcon,
  Home as HomeIcon,
  Info as InfoIcon,
  ArrowLeft as ArrowLeftIcon,
  LayoutGrid as LayoutGridIcon,
  Settings as SettingsIcon,
  Github as GHIcon,
  Heart as HeartIcon,
  Download,
  Sparkles
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Theme, Tool, ToolCategory, ViewMode } from '../../types'
import { PaperKnifeLogo } from '../Logo'
import { ActivityEntry, getRecentActivity, clearActivity } from '../../utils/recentActivity'
import { hapticImpact } from '../../utils/haptics'
import { getInitialOfflineProgress, subscribeOfflineStatus, type OfflineProgress } from '../../utils/offlineStatus'
import type { DesignVariant } from '../../utils/designVariant'

interface LayoutProps {
  children: React.ReactNode
  theme?: Theme
  toggleTheme?: () => void
  tools: Tool[]
  onFileDrop?: (files: FileList) => void
  viewMode: ViewMode
  variant?: DesignVariant
  onChangeVariant?: (v: DesignVariant) => void
}

const categoryAccent: Record<ToolCategory, string> = {
  Edit: 'var(--mid-coral)',
  Secure: 'var(--mid-violet)',
  Convert: 'var(--mid-mint)',
  Optimize: 'var(--mid-amber)'
}

export default function LayoutMidnight({ children, tools, onFileDrop, viewMode, variant, onChangeVariant }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isDragging, setIsDragging] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [offlineProgress, setOfflineProgress] = useState<OfflineProgress>(() => getInitialOfflineProgress())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isNative = Capacitor.isNativePlatform()
  const showMobileNav = isNative || viewMode === 'android'

  const isMobileBrowser = !isNative && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  useEffect(() => {
    if (showHistory) {
      getRecentActivity().then(setActivity)
    }
  }, [showHistory])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return subscribeOfflineStatus(setOfflineProgress)
  }, [])

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    const hasDraggedFiles = (dataTransfer: DataTransfer | null) => {
      return !!dataTransfer && Array.from(dataTransfer.types).includes('Files')
    }

    const handleDragOver = (e: DragEvent) => {
      if (!hasDraggedFiles(e.dataTransfer)) return
      e.preventDefault()
      if (onFileDrop) setIsDragging(true)
    }
    const handleDragLeave = (e: DragEvent) => {
      if (!hasDraggedFiles(e.dataTransfer)) return
      e.preventDefault()
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDragging(false)
      }
    }
    const handleDrop = (e: DragEvent) => {
      if (!hasDraggedFiles(e.dataTransfer)) return
      e.preventDefault()
      setIsDragging(false)
      if (onFileDrop && e.dataTransfer?.files) {
        onFileDrop(e.dataTransfer.files)
      }
    }

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [onFileDrop])

  const activeTool = tools.find(t => {
    const pathPart = t.title.split(' ')[0].toLowerCase()
    return location.pathname.includes(`/${pathPart}`)
  })

  const isHome = location.pathname === '/'

  const isMainView = isHome ||
    location.pathname.endsWith('/android-tools') ||
    location.pathname.endsWith('/android-history') ||
    location.pathname.endsWith('/settings')

  const shouldShowNav = showMobileNav && isMainView && !activeTool

  const isFreshSync = offlineProgress.status === 'preparing'
  const isUpdating = offlineProgress.status === 'updating'
  const isReady = offlineProgress.status === 'ready'

  const hasProgressData = offlineProgress.total > 0
  const showProgressUI = isFreshSync || (isUpdating && hasProgressData)
  const offlinePercent = isReady
    ? 100
    : hasProgressData
      ? Math.min(99, Math.round((offlineProgress.completed / offlineProgress.total) * 100))
      : 18

  const badgeLabel = isFreshSync ? 'Syncing Offline Pack' : 'Offline Ready'

  const tooltipHeading = isReady
    ? 'Offline cache ready'
    : isUpdating
      ? 'Updating offline pack'
      : 'Preparing offline cache'

  const tooltipBody = isReady
    ? 'Core app files are cached for offline use. Deep OCR can still need network support.'
    : isUpdating
      ? 'Offline access still works. Adding the latest tools and fixes in the background — no action needed.'
      : `${offlineProgress.label || 'Caching app bundles'}${hasProgressData ? ` (${offlineProgress.completed}/${offlineProgress.total})` : ''}. Keep this tab open for a moment.`

  const offlineBadge = !showMobileNav && offlineProgress.status !== 'unsupported' && (
    <div className="group relative hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{
        background: 'rgba(91, 255, 176, 0.06)',
        border: `1px solid ${isFreshSync ? 'rgba(255, 200, 87, 0.35)' : 'rgba(91, 255, 176, 0.30)'}`,
        color: isFreshSync ? 'var(--mid-amber)' : 'var(--mid-mint)'
      }}
    >
      <span className="relative w-1.5 h-1.5 rounded-full mid-pulse-dot" style={{ background: isFreshSync ? 'var(--mid-amber)' : 'var(--mid-mint)' }}>
        {isUpdating && <span className="absolute -top-0.5 -right-0.5 h-1 w-1 rounded-full mid-pulse-dot" style={{ background: 'var(--mid-amber)' }} />}
      </span>
      <span>{badgeLabel}</span>
      {isFreshSync && <span className="rounded-full px-2 py-0.5 tracking-normal" style={{ background: 'rgba(0,0,0,0.3)' }}>{offlinePercent}%</span>}
      <div className="pointer-events-none absolute right-0 top-full mt-3 w-72 origin-top-right rounded-2xl p-4 text-left opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
        style={{
          background: 'rgba(11, 11, 18, 0.92)',
          backdropFilter: 'blur(18px) saturate(140%)',
          border: '1px solid var(--mid-hairline-mid)',
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7)',
          color: 'var(--mid-bone)'
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="mid-mono-label" style={{ color: 'var(--mid-stone-dim)' }}>{tooltipHeading}</p>
          {showProgressUI || isReady ? (
            <p className="text-xs font-bold" style={{ color: isFreshSync ? 'var(--mid-amber)' : 'var(--mid-mint)' }}>{offlinePercent}%</p>
          ) : null}
        </div>
        {(showProgressUI || isReady) && (
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${offlinePercent}%`, background: isFreshSync ? 'var(--mid-amber)' : 'var(--mid-mint)' }} />
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--mid-stone)' }}>{tooltipBody}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ color: 'var(--mid-bone)' }}>

      {isDragging && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none" style={{ background: 'rgba(11, 11, 18, 0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="p-12 rounded-[3rem] mid-card-grad animate-in zoom-in duration-300">
            <div className="flex flex-col items-center gap-4 px-4">
              <UploadIcon size={56} style={{ color: 'var(--mid-coral)' }} className="animate-bounce" />
              <p className="mid-mono-label" style={{ color: 'var(--mid-coral-soft)' }}>Drop PDF to start</p>
            </div>
          </div>
        </div>
      )}

      {/* Web Header */}
      {!showMobileNav && (
        <header className="flex items-center justify-between px-4 md:px-8 h-16 md:h-20 sticky top-0 z-[100]"
          style={{
            background: 'rgba(11, 11, 18, 0.72)',
            backdropFilter: 'blur(18px) saturate(160%)',
            WebkitBackdropFilter: 'blur(18px) saturate(160%)',
            borderBottom: '1px solid var(--mid-hairline-mid)'
          }}
        >
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            {!isHome && (
              <button onClick={() => navigate('/')} aria-label="Back to home" className="p-2 rounded-xl transition-colors shrink-0"
                style={{ color: 'var(--mid-stone)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--mid-coral)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--mid-stone)')}
              ><ArrowLeftIcon size={20} /></button>
            )}
            <Link to="/" aria-label="PaperKnife home" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0 no-underline" style={{ color: 'var(--mid-bone)' }}>
              <PaperKnifeLogo size={Capacitor.isNativePlatform() ? 24 : 28} iconColor="var(--mid-coral)" partColor="currentColor" />
              <span className="mid-display-tight tracking-tight text-lg md:text-xl hidden xs:block" style={{ color: 'var(--mid-bone)' }}>
                paper<span className="mid-italic" style={{ color: 'var(--mid-coral-soft)' }}>knife</span>
              </span>
            </Link>
            <div className="h-6 w-[1px] mx-1 md:mx-2 shrink-0" style={{ background: 'var(--mid-hairline-mid)' }} />
            <div className="relative min-w-0" ref={dropdownRef}>
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full transition-all text-[10px] md:text-xs uppercase tracking-[0.16em] min-w-0 font-semibold"
                style={isDropdownOpen
                  ? { background: 'var(--mid-coral)', color: 'var(--mid-bg)', border: '1px solid var(--mid-coral)' }
                  : { background: 'rgba(236, 234, 228, 0.04)', color: 'var(--mid-stone)', border: '1px solid var(--mid-hairline-mid)' }}
              >
                <span className="truncate">{isHome ? 'All Tools' : activeTool?.title || 'Tool'}</span>
                <ChevronDownIcon size={14} className={`transition-transform duration-300 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-3 w-72 md:w-80 py-4 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 max-h-[80vh] overflow-y-auto scrollbar-hide rounded-3xl"
                  style={{
                    background: 'rgba(11, 11, 18, 0.95)',
                    backdropFilter: 'blur(22px) saturate(160%)',
                    border: '1px solid var(--mid-hairline-mid)',
                    boxShadow: '0 40px 80px -20px rgba(0,0,0,0.7)'
                  }}
                >
                  {Object.entries(tools.filter(t => t.implemented).reduce((acc, tool) => { if (!acc[tool.category]) acc[tool.category] = []; acc[tool.category].push(tool); return acc }, {} as Record<string, Tool[]>)).map(([category, categoryTools]) => {
                    const accent = categoryAccent[category as ToolCategory]
                    return (
                      <div key={category} className="mb-3">
                        <div className="px-6 py-2"><span className="mid-mono-label" style={{ color: accent, opacity: 0.85 }}>{category}</span></div>
                        <div className="grid grid-cols-1 gap-1 px-2">
                          {categoryTools.map((tool, i) => {
                            const Icon = tool.icon
                            const isActive = activeTool?.title === tool.title && !isHome
                            return (
                              <button key={i} onClick={() => { navigate(tool.path || '/'); setIsDropdownOpen(false) }}
                                className="flex items-center gap-4 p-3 rounded-2xl transition-all text-left group"
                                style={isActive
                                  ? { background: 'rgba(255, 92, 124, 0.10)', color: 'var(--mid-coral-soft)' }
                                  : { color: 'var(--mid-stone)' }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(236, 234, 228, 0.04)' }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                              >
                                <div className="p-2 rounded-xl" style={{ background: 'rgba(236, 234, 228, 0.05)', color: accent }}><Icon size={18} /></div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold tracking-tight" style={{ color: isActive ? 'var(--mid-bone)' : 'var(--mid-bone)' }}>{tool.title}</p>
                                  <p className="text-[10px] truncate" style={{ color: 'var(--mid-stone-dim)' }}>{tool.desc}</p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-3 shrink-0">
            {offlineBadge}
            {isMobileBrowser && (
              <a
                href="https://github.com/kalki-kgp/PaperKnife/releases/latest"
                target="_blank"
                className="hidden xs:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.16em] active:scale-95 transition-all no-underline"
                style={{ background: 'var(--mid-bone)', color: 'var(--mid-bg)' }}
              >
                <Download size={14} strokeWidth={2.5} />
                Get APK
              </a>
            )}
            <Link to="/about" aria-label="About PaperKnife"
              className="p-2 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs font-semibold uppercase tracking-[0.16em] transition-all flex items-center gap-2 no-underline"
              style={location.pathname.includes('about')
                ? { background: 'rgba(255, 92, 124, 0.12)', color: 'var(--mid-coral)' }
                : { color: 'var(--mid-stone)' }}
            >
              <InfoIcon size={18} />
              <span className="hidden sm:block">About</span>
            </Link>
            <button onClick={() => setShowHistory(true)} aria-label="View activity history" className="p-2 transition-colors relative" style={{ color: showHistory ? 'var(--mid-coral)' : 'var(--mid-stone)' }}>
              <HistoryIcon size={20} />
              {activity.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: 'var(--mid-coral)', boxShadow: '0 0 0 2px var(--mid-bg)' }} />}
            </button>
          </div>
        </header>
      )}

      <main className={`flex-1 min-w-0 ${shouldShowNav ? 'pb-32' : ''}`}>
        {children}
      </main>

      {/* Web Footer */}
      {!showMobileNav && (
        <footer className="mt-20 relative z-10" style={{ borderTop: '1px solid var(--mid-hairline-mid)', background: 'rgba(6, 6, 9, 0.6)' }}>
          <div className="max-w-7xl mx-auto px-6 md:px-8 py-10 md:py-12">

            <div className="grid grid-cols-2 md:grid-cols-12 gap-8 mb-12">

              <div className="col-span-2 md:col-span-6 space-y-4">
                <Link to="/" className="flex items-center gap-2.5 group w-fit no-underline" style={{ color: 'var(--mid-bone)' }}>
                  <PaperKnifeLogo size={22} iconColor="var(--mid-coral)" partColor="currentColor" />
                  <span className="mid-display-tight text-lg group-hover:opacity-80 transition-opacity">paperknife</span>
                </Link>
                <p className="text-xs leading-relaxed max-w-sm" style={{ color: 'var(--mid-stone)' }}>
                  The privacy-first PDF toolkit. 100% client-side logic. <br/>
                  Zero servers. Open source and forever free.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wide"
                    style={{ background: 'rgba(91, 255, 176, 0.08)', color: 'var(--mid-mint)', border: '1px solid rgba(91, 255, 176, 0.22)' }}
                  >
                    <div className="w-1 h-1 rounded-full mid-pulse-dot" style={{ background: 'var(--mid-mint)' }} />
                    Live Engine
                  </div>
                  <a href="https://github.com/kalki-kgp/PaperKnife" target="_blank" rel="noopener noreferrer" aria-label="PaperKnife on GitHub"
                    className="p-2 rounded-xl transition-all"
                    style={{ background: 'rgba(236, 234, 228, 0.04)', color: 'var(--mid-stone)', border: '1px solid var(--mid-hairline-mid)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--mid-coral)'; e.currentTarget.style.color = 'var(--mid-bg)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(236, 234, 228, 0.04)'; e.currentTarget.style.color = 'var(--mid-stone)' }}
                  >
                    <GHIcon size={14} />
                  </a>
                </div>
              </div>

              <div className="col-span-1 md:col-span-3">
                <h4 className="mid-mono-label mb-4" style={{ color: 'var(--mid-bone)' }}>Protocol</h4>
                <ul className="space-y-2.5 text-xs">
                  <li><Link to="/about" className="mid-link no-underline">About</Link></li>
                  <li><Link to="/privacy" className="mid-link no-underline">Privacy Spec</Link></li>
                  <li><a href="https://github.com/kalki-kgp/PaperKnife/blob/main/LICENSE" target="_blank" className="mid-link no-underline">License</a></li>
                </ul>
              </div>

              <div className="col-span-1 md:col-span-3">
                <h4 className="mid-mono-label mb-4" style={{ color: 'var(--mid-bone)' }}>Ecosystem</h4>
                <ul className="space-y-2.5 text-xs">
                  <li><a href="https://resumate.paperknife.app" target="_blank" className="mid-link no-underline">ResuMate — AI Resume Builder</a></li>
                  <li><a href="https://ko-fi.com/kalkikgp" target="_blank" className="mid-link no-underline">Buy me a Coffee</a></li>
                  <li><a href="https://github.com/sponsors/kalki-kgp" target="_blank" className="mid-link no-underline flex items-center gap-2">Sponsor <HeartIcon size={10} style={{ color: 'var(--mid-coral)' }} /></a></li>
                  <li><Link to="/feedback?type=enterprise" className="mid-link no-underline">Enterprise Licensing</Link></li>
                  <li><Link to="/feedback?type=tool" className="mid-link no-underline">Request Tool</Link></li>
                  <li><Link to="/feedback?type=bug" className="mid-link no-underline">Report Bug</Link></li>
                  <li><Link to="/thanks" className="mid-link no-underline">Hall of Fame</Link></li>
                </ul>
              </div>

            </div>

            <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px]"
              style={{ borderTop: '1px solid var(--mid-hairline-mid)', color: 'var(--mid-stone-dim)' }}
            >
              <p>© 2026 PaperKnife Project. No cookies used.</p>
              <div className="flex gap-6 items-center">
                <a href="https://github.com/kalki-kgp" target="_blank" className="mid-link no-underline">@kalki-kgp</a>
                {variant && onChangeVariant && (
                  <button
                    onClick={() => onChangeVariant(variant === 'midnight' ? 'classic' : 'midnight')}
                    className="mid-mono-label transition-colors flex items-center gap-1.5"
                    style={{ color: 'var(--mid-stone-dim)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--mid-coral-soft)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--mid-stone-dim)')}
                    aria-label="Switch design"
                  >
                    <Sparkles size={10} /> Design: Midnight · Switch
                  </button>
                )}
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Navigation */}
      {shouldShowNav && (
        <nav className="fixed bottom-0 left-0 right-0 flex items-end justify-between px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 z-[100]"
          style={{
            background: 'rgba(11, 11, 18, 0.9)',
            backdropFilter: 'blur(20px) saturate(160%)',
            borderTop: '1px solid var(--mid-hairline-mid)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.4)'
          }}
        >
          <button
            onClick={() => navigate('/')}
            className="flex flex-col items-center gap-1.5 flex-1 transition-all"
            style={{ color: location.pathname === '/' ? 'var(--mid-coral)' : 'var(--mid-stone-dim)' }}
          >
            <HomeIcon size={24} strokeWidth={location.pathname === '/' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Home</span>
          </button>

          <button
            onClick={() => navigate('/android-tools')}
            className="flex flex-col items-center gap-1.5 flex-1 transition-all"
            style={{ color: location.pathname === '/android-tools' ? 'var(--mid-coral)' : 'var(--mid-stone-dim)' }}
          >
            <LayoutGridIcon size={24} strokeWidth={location.pathname === '/android-tools' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Tools</span>
          </button>

          <div className="relative -top-8">
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
              className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
              style={{
                background: 'linear-gradient(135deg, var(--mid-coral) 0%, #FF7A5C 100%)',
                color: '#1A0A12',
                boxShadow: '0 14px 30px -8px var(--mid-coral-glow), 0 0 0 4px var(--mid-bg)'
              }}
            >
              <PlusIcon size={32} strokeWidth={3} />
            </button>
          </div>

          <button
            onClick={() => navigate('/android-history')}
            className="flex flex-col items-center gap-1.5 flex-1 transition-all"
            style={{ color: location.pathname === '/android-history' ? 'var(--mid-coral)' : 'var(--mid-stone-dim)' }}
          >
            <HistoryIcon size={24} strokeWidth={location.pathname === '/android-history' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">History</span>
          </button>

          <Link
            to="/settings"
            className="flex flex-col items-center gap-1.5 flex-1 transition-all no-underline"
            style={{ color: location.pathname.includes('settings') ? 'var(--mid-coral)' : 'var(--mid-stone-dim)' }}
          >
            <SettingsIcon size={24} strokeWidth={location.pathname.includes('settings') ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Settings</span>
          </Link>
        </nav>
      )}

      {/* Sidebar History Drawer */}
      <aside className={`fixed top-0 right-0 h-screen w-full sm:w-80 z-[150] transition-transform duration-500 ease-out transform ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          background: 'rgba(11, 11, 18, 0.96)',
          backdropFilter: 'blur(24px) saturate(160%)',
          borderLeft: '1px solid var(--mid-hairline-mid)',
          boxShadow: '-30px 0 60px rgba(0,0,0,0.5)'
        }}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <HistoryIcon style={{ color: 'var(--mid-coral)' }} size={22} />
              <h2 className="mid-display-tight text-xl" style={{ color: 'var(--mid-bone)' }}>Activity</h2>
            </div>
            <div className="flex items-center gap-2">
              {activity.length > 0 && (
                <button
                  onClick={async () => { await clearActivity(); setActivity([]) }}
                  aria-label="Clear activity history"
                  className="p-2 rounded-xl transition-colors"
                  style={{ color: 'var(--mid-stone)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--mid-coral)'; e.currentTarget.style.background = 'rgba(255, 92, 124, 0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--mid-stone)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <Trash2Icon size={18} />
                </button>
              )}
              <button onClick={() => setShowHistory(false)} aria-label="Close activity drawer" className="p-2 rounded-xl transition-colors" style={{ color: 'var(--mid-stone)' }}>
                <ChevronRightIcon size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
            {activity.length === 0 ? (
              <div className="text-center py-20">
                <p className="mid-mono-label" style={{ color: 'var(--mid-stone-dim)' }}>No recent files</p>
              </div>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl group relative"
                  style={{ background: 'rgba(236, 234, 228, 0.03)', border: '1px solid var(--mid-hairline-mid)' }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255, 92, 124, 0.12)', color: 'var(--mid-coral)' }}>
                      <CheckCircleIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--mid-bone)' }}>{item.name}</p>
                      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--mid-stone-dim)' }}>{item.tool}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-semibold" style={{ color: 'var(--mid-stone-dim)' }}>
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    {item.resultUrl && (
                      <a href={item.resultUrl} download={item.name} className="flex items-center gap-1" style={{ color: 'var(--mid-coral)' }}>
                        <DownloadIcon size={10} /> Redownload
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
      {showHistory && (<div onClick={() => setShowHistory(false)} className="fixed inset-0 z-[140] animate-in fade-in duration-300" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} />)}
    </div>
  )
}
