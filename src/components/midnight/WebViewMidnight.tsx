/**
 * PaperKnife - Midnight home (canary)
 * Mirrors WebView.tsx 1:1 — same sections in the same order, same search logic,
 * same SEO content, same buttons. Restyled with the midnight design language.
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Search as SearchIcon,
  ChevronRight as ChevronRightIcon,
  CloudOff,
  Zap,
  WifiOff,
  Shield,
  FileText as FileTextIcon,
  Sparkles,
  Heart as HeartIcon,
  Coffee as CoffeeIcon,
  Building2 as BuildingIcon,
  Mail as MailIcon,
  Server as ServerIcon
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Tool, ToolCategory } from '../../types'

const categoryAccent: Record<ToolCategory, string> = {
  Edit: 'var(--mid-coral)',
  Secure: 'var(--mid-violet)',
  Convert: 'var(--mid-mint)',
  Optimize: 'var(--mid-amber)'
}

const toolAliases: Record<string, string> = {
  'Merge PDF': 'combine join append collate stitch concatenate multiple files',
  'Split PDF': 'extract pages remove pages page range separate divide slice',
  'Compress PDF': 'reduce size shrink optimize smaller zip lightweight',
  'Protect PDF': 'password encrypt lock secure restrict permissions',
  'Unlock PDF': 'remove password decrypt open locked pdf',
  'Rotate PDF': 'turn orientation landscape portrait upside down',
  'Crop PDF': 'trim margins cut edges page box resize',
  'Rearrange PDF': 'reorder organize sort move pages drag pages',
  'Page Numbers': 'pagination footer header number pages',
  Watermark: 'stamp overlay brand confidential text mark',
  Metadata: 'properties author title privacy cleanup document info',
  Signature: 'sign e-sign autograph draw signature',
  Grayscale: 'black white monochrome bw grey scale print',
  'PDF to Image': 'jpg jpeg png export pages pictures convert',
  'Image to PDF': 'jpg png webp photos pictures convert',
  'Extract Images': 'pull pictures assets embedded photos',
  'PDF to Text': 'ocr scan read extract copy selectable words',
  'Repair PDF': 'fix corrupt broken damaged unreadable recover',
  'Compare PDFs': 'diff differences changes side by side review'
}

const normalizeSearchText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const makeAcronym = (value: string) => normalizeSearchText(value).split(' ').filter(Boolean).map(word => word[0]).join('')

const isSubsequence = (needle: string, haystack: string) => {
  let index = 0
  for (const char of haystack) {
    if (char === needle[index]) index += 1
    if (index === needle.length) return true
  }
  return false
}

const editDistance = (a: string, b: string) => {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  const current = Array.from({ length: b.length + 1 }, () => 0)

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = a[i - 1] === b[j - 1]
        ? previous[j - 1]
        : Math.min(previous[j - 1], previous[j], current[j - 1]) + 1
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j]
  }

  return previous[b.length]
}

const scoreTokenAgainstWords = (token: string, words: string[]) => {
  let best = Number.POSITIVE_INFINITY
  for (const word of words) {
    if (!word) continue
    if (word === token) best = Math.min(best, 0)
    else if (word.startsWith(token)) best = Math.min(best, 1)
    else if (word.includes(token)) best = Math.min(best, 3)
    else if (token.length > 2 && isSubsequence(token, word)) best = Math.min(best, 8 + Math.max(0, word.length - token.length))
    else if (token.length > 2) {
      const distance = editDistance(token, word)
      const allowedDistance = token.length > 6 ? 2 : 1
      if (distance <= allowedDistance) best = Math.min(best, 12 + distance)
    }
  }
  return best
}

const scoreToolMatch = (tool: Tool, rawQuery: string) => {
  const query = normalizeSearchText(rawQuery)
  if (!query) return Number.POSITIVE_INFINITY

  const title = normalizeSearchText(tool.title)
  const haystack = normalizeSearchText([
    tool.title,
    tool.desc,
    tool.category,
    tool.path || '',
    toolAliases[tool.title] || ''
  ].join(' '))
  const words = haystack.split(' ').filter(Boolean)
  const tokens = query.split(' ').filter(Boolean)
  const acronym = makeAcronym(tool.title)

  if (title === query) return -20
  if (title.startsWith(query)) return -12
  if (haystack.includes(query)) return -6
  if (acronym && acronym.includes(query.replace(/\s+/g, ''))) return -4

  let score = 0
  for (const token of tokens) {
    const tokenScore = Math.min(
      scoreTokenAgainstWords(token, words),
      acronym.includes(token) ? 2 : Number.POSITIVE_INFINITY
    )
    if (!Number.isFinite(tokenScore)) return Number.POSITIVE_INFINITY
    score += tokenScore
  }

  return score + Math.max(0, tool.title.length - query.length) * 0.03
}

const ToolCard = ({ title, desc, icon: Icon, onClick, category }: Tool & { onClick?: () => void }) => {
  const accent = categoryAccent[category]
  return (
    <button onClick={onClick} className="mid-tool-card group">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500"
        style={{
          background: `color-mix(in oklab, ${accent} 14%, transparent)`,
          color: accent,
          border: `1px solid color-mix(in oklab, ${accent} 30%, transparent)`
        }}
      >
        <Icon size={26} strokeWidth={2} />
      </div>
      <h3 className="mid-display-tight text-lg mb-2 transition-colors" style={{ color: 'var(--mid-bone)' }}>{title}</h3>
      <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--mid-stone)' }}>{desc}</p>

      <div className="absolute top-7 right-7 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: accent }}>
        <ChevronRightIcon size={20} />
      </div>
    </button>
  )
}

export default function WebViewMidnight({ tools }: { tools: Tool[] }) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'All'>('All')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const categories: (ToolCategory | 'All')[] = ['All', 'Edit', 'Secure', 'Convert', 'Optimize']
  const normalizedSearchQuery = normalizeSearchText(searchQuery)

  const categoryTools = useMemo(() => {
    return tools.filter(tool => activeCategory === 'All' || tool.category === activeCategory)
  }, [tools, activeCategory])

  const searchSuggestions = useMemo(() => {
    if (!normalizedSearchQuery) return []
    return tools
      .map(tool => ({ tool, score: scoreToolMatch(tool, searchQuery) }))
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => a.score - b.score || a.tool.title.localeCompare(b.tool.title))
      .slice(0, 7)
      .map(item => item.tool)
  }, [tools, searchQuery, normalizedSearchQuery])

  const requestToolPath = `/feedback?type=tool&query=${encodeURIComponent(searchQuery.trim() || activeCategory)}`

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const openTool = (tool: Tool) => {
    if (!tool.path) return
    setSearchQuery('')
    setIsSearchOpen(false)
    navigate(tool.path)
  }

  return (
    <div className="min-h-screen">

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 overflow-visible">
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="mid-chip mb-8">
            <span className="w-1.5 h-1.5 rounded-full mid-pulse-dot" style={{ background: 'var(--mid-coral)' }} />
            <span>Your PDFs · processed locally</span>
          </div>
          <h1 className="mid-display text-[44px] sm:text-6xl md:text-7xl mb-8" style={{ color: 'var(--mid-bone)' }}>
            Your PDFs, Your Peace.<br/>
            <span className="mid-italic" style={{ color: 'var(--mid-coral-soft)' }}>Your Protector.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl mb-12 leading-relaxed" style={{ color: 'var(--mid-stone)' }}>
            Effortless security. Process documents right in your browser, with the comfort of knowing your files never leave your side.
          </p>

          {/* Search */}
          <div ref={searchRef} className="max-w-2xl mx-auto relative z-50 group mt-8">
            <div className="mid-search-shell flex items-center px-6 py-2">
              <SearchIcon size={20} className="shrink-0 mr-3" style={{ color: 'var(--mid-stone)' }} />
              <input
                type="text"
                placeholder="Search tools (e.g. merge, compress, protect...)"
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setIsSearchOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setIsSearchOpen(false)
                  if (event.key === 'Enter' && searchSuggestions[0]) openTool(searchSuggestions[0])
                }}
                className="w-full bg-transparent py-4 outline-none font-semibold text-lg placeholder:opacity-50"
                style={{ color: 'var(--mid-bone)' }}
              />
            </div>

            {isSearchOpen && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-50 overflow-hidden rounded-3xl text-left animate-in fade-in slide-in-from-top-2 duration-200"
                style={{
                  background: 'rgba(11, 11, 18, 0.96)',
                  backdropFilter: 'blur(22px) saturate(160%)',
                  border: '1px solid var(--mid-hairline-mid)',
                  boxShadow: '0 40px 80px -20px rgba(0,0,0,0.7)'
                }}
              >
                <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--mid-hairline-mid)' }}>
                  <span className="mid-mono-label" style={{ color: 'var(--mid-stone-dim)' }}>Tool search</span>
                  <span className="mid-mono-label" style={{ color: 'var(--mid-coral)' }}>Fuzzy match</span>
                </div>

                <div className="max-h-[24rem] overflow-y-auto p-2">
                  {searchSuggestions.length > 0 ? (
                    searchSuggestions.map((tool) => {
                      const Icon = tool.icon
                      const accent = categoryAccent[tool.category]
                      return (
                        <button
                          key={`search-${tool.title}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => openTool(tool)}
                          className="group/result flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all"
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(236, 234, 228, 0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                            style={{ background: `color-mix(in oklab, ${accent} 14%, transparent)`, color: accent, border: `1px solid color-mix(in oklab, ${accent} 22%, transparent)` }}
                          >
                            <Icon size={20} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold" style={{ color: 'var(--mid-bone)' }}>{tool.title}</span>
                            <span className="block truncate text-xs" style={{ color: 'var(--mid-stone)' }}>{tool.desc}</span>
                          </span>
                          <span className="rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-widest"
                            style={{ background: 'rgba(236, 234, 228, 0.04)', color: 'var(--mid-stone)', border: '1px solid var(--mid-hairline-mid)' }}
                          >{tool.category}</span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <p className="text-sm font-semibold" style={{ color: 'var(--mid-bone)' }}>No close tool match.</p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--mid-stone)' }}>Tell me what workflow you wanted and I can add it to the roadmap.</p>
                    </div>
                  )}
                </div>

                <button
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { setIsSearchOpen(false); navigate(requestToolPath) }}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-all"
                  style={{ borderTop: '1px solid var(--mid-hairline-mid)', background: 'rgba(255, 92, 124, 0.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 92, 124, 0.10)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 92, 124, 0.04)')}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold" style={{ color: 'var(--mid-bone)' }}>Want to add a tool?</span>
                    <span className="block truncate text-xs" style={{ color: 'var(--mid-stone)' }}>{`Request "${searchQuery.trim()}" or report a missing workflow.`}</span>
                  </span>
                  <ChevronRightIcon size={18} className="shrink-0" style={{ color: 'var(--mid-coral)' }} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="max-w-6xl mx-auto px-6 -mt-4 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="mid-card p-8 text-left">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(255, 92, 124, 0.12)', color: 'var(--mid-coral)', border: '1px solid rgba(255, 92, 124, 0.25)' }}
            >
              <CloudOff className="w-6 h-6" />
            </div>
            <p className="mid-mono-label mb-2" style={{ color: 'var(--mid-stone)' }}>Privacy First</p>
            <h2 className="mid-display-tight text-2xl" style={{ color: 'var(--mid-bone)' }}>Zero Uploads</h2>
          </div>

          <div className="mid-card p-8 text-left">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(255, 200, 87, 0.12)', color: 'var(--mid-amber)', border: '1px solid rgba(255, 200, 87, 0.25)' }}
            >
              <Zap className="w-6 h-6" />
            </div>
            <p className="mid-mono-label mb-2" style={{ color: 'var(--mid-stone)' }}>Processing Speed</p>
            <h2 className="mid-display-tight text-2xl" style={{ color: 'var(--mid-bone)' }}>Instant</h2>
          </div>

          <div className="mid-card p-8 text-left">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(91, 255, 176, 0.12)', color: 'var(--mid-mint)', border: '1px solid rgba(91, 255, 176, 0.25)' }}
            >
              <WifiOff className="w-6 h-6" />
            </div>
            <p className="mid-mono-label mb-2" style={{ color: 'var(--mid-stone)' }}>Offline Capable</p>
            <h2 className="mid-display-tight text-2xl" style={{ color: 'var(--mid-bone)' }}>100% Local</h2>
          </div>
        </div>
      </section>

      {/* Toolkit Section */}
      <section className="py-20 relative" style={{ borderTop: '1px solid var(--mid-hairline-mid)', borderBottom: '1px solid var(--mid-hairline-mid)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="mid-mono-label mb-4 block" style={{ color: 'var(--mid-coral)' }}>Powerful Toolkit</span>
            <h2 className="mid-display text-4xl md:text-5xl mb-6" style={{ color: 'var(--mid-bone)' }}>
              Everything you need to <span className="mid-italic" style={{ color: 'var(--mid-coral-soft)' }}>manage PDFs</span>
            </h2>
            <p className="text-lg md:text-xl max-w-2xl mx-auto" style={{ color: 'var(--mid-stone)' }}>
              All the essential tools, optimized for your machine, delivered with a calm and seamless experience.
            </p>
          </div>

          {/* Category Filters */}
          <div className="flex items-center justify-between mb-12 flex-wrap gap-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="mid-btn-pill"
                  data-active={activeCategory === cat}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="hidden md:block text-xs" style={{ color: 'var(--mid-stone)' }}>{categoryTools.length} tools available</p>
          </div>

          {/* Tool Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryTools.map((tool) => (
              <ToolCard
                key={tool.title}
                {...tool}
                onClick={() => navigate(tool.path || '/')}
              />
            ))}
          </div>

          {categoryTools.length === 0 && (
            <div className="py-32 text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(236, 234, 228, 0.04)', color: 'var(--mid-stone)', border: '1px solid var(--mid-hairline-mid)' }}
              >
                <SearchIcon size={32} />
              </div>
              <h3 className="mid-display-tight text-2xl mb-2" style={{ color: 'var(--mid-bone)' }}>No tools in this category yet.</h3>
              <p style={{ color: 'var(--mid-stone)' }}>Tell me what workflow you need and I can prioritize it.</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => navigate(`/feedback?type=tool&query=${encodeURIComponent(activeCategory)}`)} className="mid-btn-primary">Request Tool</button>
                <button onClick={() => { setSearchQuery(''); setActiveCategory('All') }} className="mid-btn-ghost">Reset Dashboard</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="mid-card-grad p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8" style={{ opacity: 0.06 }}>
              <Shield className="w-32 h-32" style={{ color: 'var(--mid-coral)' }} />
            </div>
            <h2 className="mid-display text-4xl md:text-5xl mb-6 relative z-10" style={{ color: 'var(--mid-bone)' }}>
              Ready to <span className="mid-italic" style={{ color: 'var(--mid-coral-soft)' }}>take control?</span>
            </h2>
            <p className="text-lg md:text-xl mb-12 max-w-xl mx-auto relative z-10" style={{ color: 'var(--mid-stone)' }}>
              Start processing your PDFs with complete peace of mind today. Your files are in safe hands — yours.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('All') }}
              className="mid-btn-primary relative z-10"
            >
              Start Using Tools
            </button>
          </div>
        </div>
      </section>

      {/* SEO Content Block */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="mid-card p-10 md:p-14">
          <h2 className="mid-display-tight text-2xl mb-4" style={{ color: 'var(--mid-bone)' }}>All-in-one private PDF tools</h2>
          <p className="text-base leading-relaxed max-w-3xl mb-6" style={{ color: 'var(--mid-stone)' }}>
            PaperKnife handles everything from merge PDF, split PDF, compress PDF, protect PDF, unlock PDF,
            rotate, crop, watermark, metadata cleanup, signature, grayscale, PDF to image, image to PDF, extract images,
            PDF to text, and repair. Every operation runs locally — no server, no cloud, no data collected.
          </p>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <button
                key={`seo-${tool.title}`}
                onClick={() => navigate(tool.path || '/')}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{ background: 'rgba(236, 234, 228, 0.04)', color: 'var(--mid-stone)', border: '1px solid var(--mid-hairline-mid)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--mid-coral-soft)'; e.currentTarget.style.borderColor = 'rgba(255, 92, 124, 0.35)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--mid-stone)'; e.currentTarget.style.borderColor = 'var(--mid-hairline-mid)' }}
              >
                {tool.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="mid-card overflow-hidden">
          <div className="px-8 py-5" style={{ borderBottom: '1px solid var(--mid-hairline-mid)', background: 'rgba(255, 92, 124, 0.04)' }}>
            <h2 className="mid-mono-label" style={{ color: 'var(--mid-coral)' }}>Frequently Asked Questions</h2>
          </div>
          {[
            {
              q: 'Is this truly private and offline?',
              a: 'Yes. All PDF processing runs using WebAssembly and JavaScript directly in your browser tab. No file is ever transmitted to a server. You can even use PaperKnife with your network disconnected.'
            },
            {
              q: 'What file types are supported?',
              a: 'PDF is the primary format. The Image to PDF and PDF to Image tools also accept JPG, PNG, and WebP images.'
            },
            {
              q: 'Which PDF operations are available?',
              a: 'Merge, split, compress, protect (encrypt), unlock (decrypt), rotate, crop, rearrange pages, add page numbers, watermark, metadata sanitization, signature, grayscale, PDF-to-image, image-to-PDF, extract embedded images, PDF-to-text, and structural repair.'
            },
            {
              q: 'Where do processed files go?',
              a: 'Output files are downloaded directly by your browser. They stay on your device and are never sent to any server.'
            },
            {
              q: 'Is there a file size limit?',
              a: 'There is no enforced size limit, but very large PDFs (100+ MB) may be slow since processing happens on your device CPU. Compression is recommended before working with large files.'
            }
          ].map((item, i, arr) => (
            <details key={i} className="group" style={i < arr.length - 1 ? { borderBottom: '1px solid var(--mid-hairline-mid)' } : {}}>
              <summary className="cursor-pointer px-8 py-5 text-sm font-semibold transition-colors list-none flex justify-between items-center select-none"
                style={{ color: 'var(--mid-bone)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(236, 234, 228, 0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {item.q}
                <span className="text-lg font-bold ml-4 shrink-0 group-open:hidden" style={{ color: 'var(--mid-coral)' }}>+</span>
                <span className="text-lg font-bold ml-4 shrink-0 hidden group-open:inline" style={{ color: 'var(--mid-coral)' }}>&minus;</span>
              </summary>
              <p className="px-8 pb-5 text-sm leading-relaxed" style={{ color: 'var(--mid-stone)' }}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Feedback */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="mid-card p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="mid-chip mb-4">
                <MailIcon size={12} />
                Feedback
              </div>
              <h3 className="mid-display-tight text-2xl md:text-3xl mb-3" style={{ color: 'var(--mid-bone)' }}>Need a tool or found a problem?</h3>
              <p className="text-base leading-relaxed max-w-xl" style={{ color: 'var(--mid-stone)' }}>
                Tell me what is missing, what broke, or what would make PaperKnife faster for your workflow. The app prepares the message locally and hands it off to email or GitHub.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
              <button onClick={() => navigate('/feedback?type=tool')} className="mid-btn-primary">
                Request Tool
              </button>
              <button onClick={() => navigate('/feedback?type=bug')} className="mid-btn-ghost">
                Report Problem
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Self-Hosted */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="mid-card-grad relative overflow-hidden p-10 md:p-14"
          style={{ background: 'linear-gradient(135deg, #0E0E18 0%, #181828 100%)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--mid-coral), var(--mid-violet), var(--mid-mint), transparent)' }} />
          <div className="absolute top-0 right-0 p-8" style={{ opacity: 0.05 }}>
            <ServerIcon className="w-40 h-40" style={{ color: 'var(--mid-bone)' }} />
          </div>
          <div className="relative z-10">
            <div className="mid-chip mb-6">
              <BuildingIcon size={12} />
              Enterprise
            </div>
            <h3 className="mid-display text-2xl md:text-3xl mb-3 leading-tight" style={{ color: 'var(--mid-bone)' }}>
              Self-Hosted for <span className="mid-italic" style={{ color: 'var(--mid-coral-soft)' }}>Your Organization.</span>
            </h3>
            <p className="text-base leading-relaxed mb-8 max-w-xl" style={{ color: 'var(--mid-stone)' }}>
              Deploy PaperKnife on your own infrastructure. Complete data sovereignty, custom branding,
              priority support, and compliance-ready documentation for your team.
            </p>
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--mid-bone)' }}>
                <Shield size={14} style={{ color: 'var(--mid-mint)' }} /> Air-gapped deployment
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--mid-bone)' }}>
                <ServerIcon size={14} style={{ color: 'var(--mid-violet)' }} /> On-premise hosting
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--mid-bone)' }}>
                <BuildingIcon size={14} style={{ color: 'var(--mid-amber)' }} /> Custom branding
              </div>
            </div>
            <button
              onClick={() => navigate('/feedback?type=enterprise')}
              className="mid-btn-primary"
            >
              <MailIcon size={14} /> Contact for Licensing
            </button>
          </div>
        </div>
      </section>

      {/* Support / Ko-fi */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="mid-card relative overflow-hidden p-10 md:p-14">
          <div className="absolute top-0 right-0 p-8" style={{ opacity: 0.08 }}>
            <HeartIcon className="w-32 h-32" style={{ color: 'var(--mid-coral)' }} fill="currentColor" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="mid-chip mb-4">
                <CoffeeIcon size={12} /> Support the Project
              </div>
              <h3 className="mid-display text-2xl md:text-3xl mb-3 leading-tight" style={{ color: 'var(--mid-bone)' }}>
                Keep PaperKnife <span className="mid-italic" style={{ color: 'var(--mid-coral-soft)' }}>Free & Open.</span>
              </h3>
              <p className="text-base leading-relaxed mb-6 max-w-xl" style={{ color: 'var(--mid-stone)' }}>
                PaperKnife is built and maintained by one person. If it saves you time or keeps your documents private,
                consider buying a coffee to keep the project going.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://ko-fi.com/kalkikgp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mid-btn-primary no-underline"
                  style={{ background: 'linear-gradient(135deg, #FF5E5B 0%, #FF7A5C 100%)' }}
                >
                  <CoffeeIcon size={14} /> Buy me a Coffee
                </a>
                <a
                  href="https://github.com/sponsors/kalki-kgp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mid-btn-ghost no-underline"
                >
                  <HeartIcon size={14} style={{ color: 'var(--mid-coral)' }} /> GitHub Sponsors
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ResuMate Cross-Promo */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mid-card-grad relative overflow-hidden p-10 md:p-14"
            style={{ background: 'linear-gradient(135deg, #0F0F18 0%, #1A1426 100%)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--mid-coral), var(--mid-mint), transparent)' }} />

            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="flex-1 space-y-4">
                <div className="mid-chip" style={{ background: 'rgba(91, 255, 176, 0.10)', borderColor: 'rgba(91, 255, 176, 0.25)', color: 'var(--mid-mint)' }}>
                  <Sparkles size={12} />
                  Also by PaperKnife
                </div>
                <h3 className="mid-display-tight text-2xl md:text-3xl leading-tight" style={{ color: 'var(--mid-bone)' }}>
                  Working with resumes?<br />
                  <span className="mid-italic" style={{ color: 'var(--mid-coral-soft)' }}>Build one that lands interviews.</span>
                </h3>
                <p className="text-base leading-relaxed max-w-lg" style={{ color: 'var(--mid-stone)' }}>
                  ResuMate analyzes your resume with AI, scores it against ATS systems, and helps you build a polished, job-ready version — in minutes, not hours.
                </p>
                <a
                  href="https://resumate.paperknife.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mid-btn-primary no-underline"
                >
                  <FileTextIcon size={16} />
                  Try ResuMate — It's Free
                </a>
              </div>

              <div className="hidden md:flex w-36 h-36 rounded-[28px] items-center justify-center shrink-0 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, var(--mid-coral) 0%, var(--mid-violet) 100%)', boxShadow: '0 30px 60px -20px var(--mid-coral-glow)' }}
              >
                <img src="/logos/resumate-promo.png" alt="ResuMate AI Resume Builder" width={144} height={144} className="w-full h-full object-cover rounded-[28px]" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
