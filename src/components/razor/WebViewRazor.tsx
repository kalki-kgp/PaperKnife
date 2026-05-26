/**
 * PaperKnife — RAZOR variant landing page.
 * Editorial brutalist tech-noir home: oversized italic display, mono labels,
 * acid-lime accent, scrolling marquee, numbered tool index.
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight as ChevronRightIcon,
  ArrowUpRight as ArrowUpRightIcon,
  Heart as HeartIcon,
  Coffee as CoffeeIcon,
  Building2 as BuildingIcon,
  Server as ServerIcon,
  Shield as ShieldIcon,
  Sparkles,
  FileText as FileTextIcon,
  Mail as MailIcon,
  CornerDownRight,
} from 'lucide-react'
import { Tool, ToolCategory } from '../../types'

declare global {
  interface Window {
    adsbygoogle: any[]
  }
}

const AdUnit = ({ className = '' }: { className?: string }) => {
  const adRef = useRef<HTMLDivElement>(null)
  const pushed = useRef(false)
  useEffect(() => {
    if (pushed.current) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch {}
  }, [])
  return (
    <div className={`w-full flex justify-center ${className}`} ref={adRef}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-4050145985658577"
        data-ad-slot="auto"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}

const CATEGORY_TINT: Record<ToolCategory, { dot: string; label: string }> = {
  Edit: { dot: 'var(--pk-razor)', label: 'EDIT' },
  Secure: { dot: '#7CC4FF', label: 'SECURE' },
  Convert: { dot: '#FF6B47', label: 'CONVERT' },
  Optimize: { dot: '#F4D35E', label: 'OPTIMIZE' },
  Signatures: { dot: '#F47174', label: 'SIGNATURES' },
}

const toolAliases: Record<string, string> = {
  'Merge PDF': 'combine join append collate stitch concatenate',
  'Split PDF': 'extract pages remove pages page range separate divide slice',
  'Compress PDF': 'reduce size shrink optimize smaller',
  'Protect PDF': 'password encrypt lock secure restrict',
  'Unlock PDF': 'remove password decrypt open locked',
  'Rotate PDF': 'turn orientation landscape portrait',
  'Crop PDF': 'trim margins cut edges page box',
  'Rearrange PDF': 'reorder organize sort move pages',
  'Page Numbers': 'pagination footer header',
  Watermark: 'stamp overlay brand confidential',
  Metadata: 'properties author title cleanup',
  Signature: 'sign e-sign autograph draw',
  Grayscale: 'black white monochrome bw',
  'PDF to Image': 'jpg jpeg png export',
  'Image to PDF': 'jpg png webp photos',
  'Extract Images': 'pull pictures assets embedded',
  'PDF to Text': 'ocr scan read extract copy',
  'Repair PDF': 'fix corrupt broken damaged',
  'Compare PDFs': 'diff differences side by side',
}

const norm = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function scoreMatch(tool: Tool, q: string) {
  const query = norm(q)
  if (!query) return Infinity
  const haystack = norm(
    [tool.title, tool.desc, tool.category, tool.path || '', toolAliases[tool.title] || ''].join(' '),
  )
  if (norm(tool.title).startsWith(query)) return -10
  if (haystack.includes(query)) return -3
  // light fuzzy: each query char must appear in order
  let i = 0
  for (const c of haystack) {
    if (c === query[i]) i += 1
    if (i === query.length) return query.length - i
  }
  return Infinity
}

function ToolRow({
  tool,
  index,
  onClick,
}: {
  tool: Tool
  index: number
  onClick: () => void
}) {
  const tint = CATEGORY_TINT[tool.category]
  const Icon = tool.icon
  const indexLabel = String(index + 1).padStart(2, '0')

  return (
    <button
      onClick={onClick}
      className="razor-card group flex items-stretch text-left w-full p-0"
    >
      <div className="w-14 md:w-16 shrink-0 border-r border-[color:var(--pk-hairline)] flex flex-col items-center justify-center py-6 bg-[color:var(--pk-bg-deep)]">
        <span className="razor-mono text-[10px] text-[color:var(--pk-stone-dim)] mb-2">
          {indexLabel}
        </span>
        <Icon
          size={20}
          className="text-[color:var(--pk-bone)] group-hover:text-[color:var(--pk-razor)] transition-colors"
        />
      </div>
      <div className="flex-1 min-w-0 px-5 md:px-7 py-6 flex flex-col justify-center">
        <div className="flex items-center gap-3 mb-1.5">
          <span
            className="w-1.5 h-1.5 inline-block"
            style={{ background: tint.dot }}
          />
          <span className="razor-label text-[color:var(--pk-stone)]">{tint.label}</span>
        </div>
        <h3 className="razor-display-roman text-2xl md:text-3xl tracking-tight text-[color:var(--pk-bone)] group-hover:text-[color:var(--pk-razor)] transition-colors leading-none mb-2">
          {tool.title.toLowerCase()}
        </h3>
        <p className="razor-mono text-xs text-[color:var(--pk-stone)] leading-relaxed line-clamp-2 max-w-md">
          {tool.desc}
        </p>
      </div>
      <div className="w-14 md:w-16 shrink-0 border-l border-[color:var(--pk-hairline)] flex items-center justify-center text-[color:var(--pk-stone-dim)] group-hover:text-[color:var(--pk-razor)] group-hover:bg-[color:var(--pk-bg-deep)] transition-all">
        <ChevronRightIcon size={18} />
      </div>
    </button>
  )
}

export default function WebViewRazor({ tools }: { tools: Tool[] }) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'All'>('All')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const categories: (ToolCategory | 'All')[] = ['All', 'Edit', 'Secure', 'Convert', 'Optimize']

  const filteredTools = useMemo(
    () => tools.filter((t) => activeCategory === 'All' || t.category === activeCategory),
    [tools, activeCategory],
  )

  const searchSuggestions = useMemo(() => {
    if (!norm(searchQuery)) return []
    return tools
      .map((tool) => ({ tool, score: scoreMatch(tool, searchQuery) }))
      .filter((x) => Number.isFinite(x.score))
      .sort((a, b) => a.score - b.score || a.tool.title.localeCompare(b.tool.title))
      .slice(0, 6)
      .map((x) => x.tool)
  }, [tools, searchQuery])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  const openTool = (tool: Tool) => {
    if (!tool.path) return
    setSearchQuery('')
    setIsSearchOpen(false)
    navigate(tool.path)
  }

  const marqueeItems = useMemo(() => {
    const names = tools.map((t) => t.title.toUpperCase().replace(/\s/g, '_'))
    return [...names, ...names]
  }, [tools])

  return (
    <div className="bg-[color:var(--pk-bg)] text-[color:var(--pk-bone)] relative overflow-x-clip">
      {/* ─── HERO ────────────────────────────────────────────────── */}
      <section className="relative razor-grid">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-10">
          <div className="razor-label text-[color:var(--pk-stone)] mb-10 flex flex-wrap items-center gap-x-6 gap-y-2 razor-fade-in">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[color:var(--pk-razor)] inline-block razor-blink" />
              ◉ LOCAL · ZERO UPLOADS · ZERO ACCOUNTS
            </span>
            <span className="text-[color:var(--pk-stone-dim)]">/ /</span>
            <span>{tools.filter((t) => t.implemented).length} TOOLS — ALL ON-DEVICE</span>
          </div>

          <div className="grid grid-cols-12 gap-6 md:gap-10 items-end">
            <div className="col-span-12 md:col-span-7">
              <h1
                className="razor-display text-[clamp(4.5rem,15vw,12rem)] razor-fade-in"
                style={{ animationDelay: '60ms' }}
              >
                paper
                <br />
                <span className="text-[color:var(--pk-bone)]">knife</span>
                <span className="text-[color:var(--pk-razor)]">.</span>
              </h1>
              <div className="mt-8 flex items-center gap-3 razor-mono text-xs text-[color:var(--pk-stone)]">
                <span className="w-8 h-px bg-[color:var(--pk-razor)]" />
                <span className="text-[color:var(--pk-razor)] razor-blink">▮</span>
                <span>twenty surgical pdf tools — running entirely in this tab.</span>
              </div>
            </div>

            <div
              className="col-span-12 md:col-span-5 md:pl-10 md:border-l md:border-[color:var(--pk-hairline)] razor-fade-in"
              style={{ animationDelay: '180ms' }}
            >
              <div className="razor-label text-[color:var(--pk-stone-dim)] mb-3">/ manifest</div>
              <p className="razor-display-roman text-2xl md:text-[2rem] leading-[1.05] text-[color:var(--pk-bone)] mb-5">
                A knife <em className="text-[color:var(--pk-razor)]">for paper.</em>
                <br />Local. Sharp. Private.
              </p>
              <p className="razor-mono text-xs text-[color:var(--pk-stone)] leading-relaxed mb-7 max-w-md">
                Every operation runs on your device. No server. No cloud round-trip.
                No telemetry. Close the tab and the work disappears.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.pdf'
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) {
                        window.dispatchEvent(
                          new CustomEvent('open-quick-drop', { detail: { file } }),
                        )
                      }
                    }
                    input.click()
                  }}
                  className="razor-btn-primary"
                >
                  ▸ DROP A FILE
                </button>
                <a
                  href="#tools"
                  className="razor-btn-ghost no-underline inline-flex items-center"
                >
                  BROWSE TOOLS ↓
                </a>
              </div>
            </div>
          </div>

          {/* search */}
          <div
            ref={searchRef}
            className="mt-14 max-w-2xl razor-fade-in"
            style={{ animationDelay: '300ms' }}
          >
            <div className="razor-label text-[color:var(--pk-stone-dim)] mb-2">/ tool index</div>
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[color:var(--pk-razor)]">
                <span className="razor-mono text-sm">&gt;_</span>
              </div>
              <input
                type="text"
                placeholder="search tools — merge, compress, sign..."
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setIsSearchOpen(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsSearchOpen(false)
                  if (e.key === 'Enter' && searchSuggestions[0]) openTool(searchSuggestions[0])
                }}
                className="w-full bg-[color:var(--pk-bg-elev)] border border-[color:var(--pk-hairline-hi)] py-4 pl-14 pr-4 razor-mono text-base text-[color:var(--pk-bone)] placeholder:text-[color:var(--pk-stone-dim)] focus:border-[color:var(--pk-razor)] focus:outline-none focus:ring-1 focus:ring-[color:var(--pk-razor)] transition-all"
              />
              {isSearchOpen && searchQuery.trim() && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 bg-[color:var(--pk-bg-elev)] border border-[color:var(--pk-hairline-hi)] shadow-2xl shadow-black/70">
                  <div className="px-4 py-2 border-b border-[color:var(--pk-hairline)] flex items-center justify-between">
                    <span className="razor-label text-[color:var(--pk-stone)]">/ matches</span>
                    <span className="razor-label text-[color:var(--pk-razor)]">
                      {searchSuggestions.length} found
                    </span>
                  </div>
                  {searchSuggestions.length > 0 ? (
                    searchSuggestions.map((tool) => {
                      const Icon = tool.icon
                      const tint = CATEGORY_TINT[tool.category]
                      return (
                        <button
                          key={`s-${tool.title}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => openTool(tool)}
                          className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[color:var(--pk-bg-hi)] text-left group"
                        >
                          <Icon
                            size={16}
                            className="text-[color:var(--pk-stone)] group-hover:text-[color:var(--pk-razor)] transition-colors shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="razor-mono text-sm text-[color:var(--pk-bone)]">
                              {tool.title.toLowerCase()}
                            </p>
                            <p className="razor-mono text-xs text-[color:var(--pk-stone)] truncate">
                              {tool.desc}
                            </p>
                          </div>
                          <span
                            className="razor-label"
                            style={{ color: tint.dot }}
                          >
                            {tint.label}
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="razor-mono text-sm text-[color:var(--pk-bone)]">
                        no match in current index
                      </p>
                      <p className="razor-mono text-xs text-[color:var(--pk-stone)] mt-1">
                        request a tool — it gets added to the roadmap.
                      </p>
                    </div>
                  )}
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setIsSearchOpen(false)
                      navigate(`/feedback?type=tool&query=${encodeURIComponent(searchQuery.trim())}`)
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 border-t border-[color:var(--pk-hairline)] bg-[color:var(--pk-bg-deep)] hover:bg-[color:var(--pk-bg-hi)] text-left group"
                  >
                    <div>
                      <p className="razor-mono text-sm text-[color:var(--pk-razor)]">
                        ▸ propose new tool
                      </p>
                      <p className="razor-label text-[color:var(--pk-stone-dim)] mt-1">
                        ENQUEUE FOR REVIEW
                      </p>
                    </div>
                    <ArrowUpRightIcon
                      size={16}
                      className="text-[color:var(--pk-razor)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MARQUEE TICKER */}
        <div className="border-y border-[color:var(--pk-hairline)] bg-[color:var(--pk-bg-deep)] overflow-hidden mt-12">
          <div className="razor-marquee py-4 razor-mono text-sm text-[color:var(--pk-stone)] whitespace-nowrap">
            {marqueeItems.map((name, i) => (
              <span key={i} className="px-6">
                <span className="text-[color:var(--pk-razor)] mr-3">█</span>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS TRIO ──────────────────────────────────────────── */}
      <section className="border-b border-[color:var(--pk-hairline)]">
        <div className="max-w-[1400px] mx-auto grid grid-cols-3 divide-x divide-[color:var(--pk-hairline)]">
          <Stat label="UPLOADS" value="0" suffix="bytes" />
          <Stat
            label="LOCAL TOOLS"
            value={String(tools.filter((t) => t.implemented).length).padStart(2, '0')}
            suffix="& growing"
          />
          <Stat label="TRACKERS" value="0" suffix="zero pixels" />
        </div>
      </section>

      {/* ─── AD ──────────────────────────────────────────────────── */}
      <AdUnit className="max-w-[1400px] mx-auto px-6 md:px-10 my-10" />

      {/* ─── TOOL INDEX ──────────────────────────────────────────── */}
      <section
        id="tools"
        className="max-w-[1400px] mx-auto px-6 md:px-10 pt-16 pb-24"
      >
        <div className="flex items-end justify-between flex-wrap gap-6 mb-10 border-b border-[color:var(--pk-hairline)] pb-6">
          <div>
            <div className="razor-label text-[color:var(--pk-stone-dim)] mb-2">/ section 02 / tool index</div>
            <h2 className="razor-display text-5xl md:text-7xl text-[color:var(--pk-bone)]">
              the <em className="text-[color:var(--pk-razor)]">arsenal.</em>
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`razor-label px-4 h-9 border transition-all ${
                  activeCategory === cat
                    ? 'bg-[color:var(--pk-bone)] text-[color:var(--pk-bg)] border-[color:var(--pk-bone)]'
                    : 'border-[color:var(--pk-hairline)] text-[color:var(--pk-stone)] hover:text-[color:var(--pk-bone)] hover:border-[color:var(--pk-hairline-hi)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredTools.map((tool, idx) => (
            <ToolRow
              key={tool.title}
              tool={tool}
              index={idx}
              onClick={() => tool.path && navigate(tool.path)}
            />
          ))}
        </div>

        {filteredTools.length === 0 && (
          <div className="border border-dashed border-[color:var(--pk-hairline-hi)] py-24 text-center">
            <p className="razor-display-roman text-3xl text-[color:var(--pk-bone)] mb-2">
              empty subset.
            </p>
            <p className="razor-mono text-sm text-[color:var(--pk-stone)] mb-6">
              no tools match this filter — propose one.
            </p>
            <button
              onClick={() =>
                navigate(`/feedback?type=tool&query=${encodeURIComponent(activeCategory)}`)
              }
              className="razor-btn-primary"
            >
              ▸ REQUEST TOOL
            </button>
          </div>
        )}
      </section>

      {/* ─── PRINCIPLES MANIFESTO ────────────────────────────────── */}
      <section className="border-y border-[color:var(--pk-hairline)] bg-[color:var(--pk-bg-deep)] py-24 relative overflow-hidden">
        <div className="absolute inset-0 razor-grid opacity-30" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 relative">
          <div className="razor-label text-[color:var(--pk-stone-dim)] mb-3">/ section 03 / principles</div>
          <h2 className="razor-display text-5xl md:text-7xl mb-12 max-w-4xl leading-[0.9]">
            we don't see your files.
            <br />
            <span className="text-[color:var(--pk-razor)]">we can't.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Principle
              num="01"
              title="zero uploads."
              body="Files never leave the browser. Every operation is JavaScript and WebAssembly running on your device. Network logs would be empty even if we kept any."
            />
            <Principle
              num="02"
              title="zero accounts."
              body="No sign up, no login, no email. PaperKnife loads, you work, you close the tab. Nothing persists unless you choose to keep it."
            />
            <Principle
              num="03"
              title="open & inspectable."
              body="AGPL-3.0 source on GitHub. Audit the code, fork the binary, self-host the bundle. This isn't a marketing claim — it's an engineering choice."
            />
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 md:px-10 py-24">
        <div className="razor-label text-[color:var(--pk-stone-dim)] mb-3">/ section 04 / faq</div>
        <h2 className="razor-display text-5xl md:text-6xl mb-10">
          questions, <em className="text-[color:var(--pk-razor)]">answered.</em>
        </h2>
        <div className="border border-[color:var(--pk-hairline)] divide-y divide-[color:var(--pk-hairline)]">
          {[
            {
              q: 'Is this truly private and offline?',
              a: 'Yes. All PDF processing runs using WebAssembly and JavaScript directly in your browser tab. No file is ever transmitted to a server. You can use PaperKnife with your network disconnected.',
            },
            {
              q: 'What file types are supported?',
              a: 'PDF is the primary format. The Image-to-PDF and PDF-to-Image tools also accept JPG, PNG, and WebP images.',
            },
            {
              q: 'Which PDF operations are available?',
              a: 'Merge, split, compress, protect (encrypt), unlock (decrypt), rotate, crop, rearrange pages, page numbers, watermark, metadata cleanup, signature, grayscale, PDF-to-image, image-to-PDF, extract images, PDF-to-text, structural repair, and side-by-side compare.',
            },
            {
              q: 'Where do processed files go?',
              a: 'Output files are downloaded directly by your browser. They stay on your device and are never sent to any server.',
            },
            {
              q: 'Is there a file size limit?',
              a: 'There is no enforced size limit. Very large PDFs (100+ MB) may be slow because processing runs on your CPU. Compression is recommended before working with large files.',
            },
          ].map((item, i) => (
            <details key={i} className="group bg-[color:var(--pk-bg-elev)]">
              <summary className="cursor-pointer px-6 py-5 razor-mono text-sm text-[color:var(--pk-bone)] hover:bg-[color:var(--pk-bg-hi)] transition-colors list-none flex justify-between items-center select-none">
                <span className="flex items-center gap-3">
                  <span className="razor-label text-[color:var(--pk-stone-dim)]">
                    Q.{String(i + 1).padStart(2, '0')}
                  </span>
                  {item.q}
                </span>
                <span className="text-[color:var(--pk-razor)] razor-mono group-open:rotate-90 transition-transform">
                  ▸
                </span>
              </summary>
              <div className="px-6 pb-6 pl-[5.25rem] flex gap-3 razor-mono text-xs text-[color:var(--pk-stone)] leading-relaxed">
                <CornerDownRight size={14} className="text-[color:var(--pk-razor)] mt-1 shrink-0" />
                <p>{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ─── ENTERPRISE ──────────────────────────────────────────── */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 pb-16">
        <div className="border border-[color:var(--pk-hairline-hi)] bg-[color:var(--pk-bg-elev)] p-10 md:p-14 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[color:var(--pk-razor)] to-transparent opacity-60" />
          <div className="absolute top-6 right-8 opacity-5">
            <ServerIcon className="w-40 h-40" />
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-7">
              <div className="razor-label text-[color:var(--pk-razor)] mb-4 flex items-center gap-2">
                <BuildingIcon size={12} /> ENTERPRISE
              </div>
              <h3 className="razor-display text-4xl md:text-5xl mb-4">
                self-hosted for <em className="text-[color:var(--pk-razor)]">your org.</em>
              </h3>
              <p className="razor-mono text-xs text-[color:var(--pk-stone)] leading-relaxed max-w-xl">
                Deploy PaperKnife on your own infrastructure. Air-gapped operation, custom branding,
                priority support, and compliance documentation for your team.
              </p>
            </div>
            <div className="md:col-span-5 md:text-right space-y-4">
              <div className="flex md:justify-end flex-wrap gap-x-6 gap-y-2 razor-label text-[color:var(--pk-stone)]">
                <span className="flex items-center gap-2">
                  <ShieldIcon size={11} className="text-[color:var(--pk-razor)]" /> AIR-GAPPED
                </span>
                <span className="flex items-center gap-2">
                  <ServerIcon size={11} className="text-[color:var(--pk-razor)]" /> ON-PREM
                </span>
                <span className="flex items-center gap-2">
                  <BuildingIcon size={11} className="text-[color:var(--pk-razor)]" /> CO-BRANDED
                </span>
              </div>
              <button
                onClick={() => navigate('/feedback?type=enterprise')}
                className="razor-btn-primary inline-flex items-center gap-2"
              >
                <MailIcon size={12} /> CONTACT FOR LICENSING
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SUPPORT ─────────────────────────────────────────────── */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-[color:var(--pk-hairline)] p-10 bg-[color:var(--pk-bg-elev)] relative overflow-hidden group hover:border-[color:var(--pk-hairline-hi)] transition-colors">
            <HeartIcon
              className="absolute -bottom-4 -right-4 w-32 h-32 text-[color:var(--pk-ember)] opacity-5 group-hover:opacity-10 transition-opacity"
              fill="currentColor"
            />
            <div className="razor-label text-[color:var(--pk-ember)] mb-4 flex items-center gap-2">
              <CoffeeIcon size={12} /> SUPPORT
            </div>
            <h3 className="razor-display text-3xl md:text-4xl mb-3">
              keep paperknife <em className="text-[color:var(--pk-ember)]">free.</em>
            </h3>
            <p className="razor-mono text-xs text-[color:var(--pk-stone)] leading-relaxed mb-6 max-w-md">
              Built and maintained by one person. Your support keeps the lights on, the tools sharp,
              and the project ad-light.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://ko-fi.com/kalkikgp"
                target="_blank"
                rel="noopener noreferrer"
                className="razor-btn-ghost no-underline inline-flex items-center gap-2"
                style={{ borderColor: 'var(--pk-ember)', color: 'var(--pk-ember)' }}
              >
                <CoffeeIcon size={12} /> BUY A COFFEE
              </a>
              <a
                href="https://github.com/sponsors/kalki-kgp"
                target="_blank"
                rel="noopener noreferrer"
                className="razor-btn-ghost no-underline inline-flex items-center gap-2"
              >
                <HeartIcon size={12} /> GH SPONSORS
              </a>
            </div>
          </div>

          <div className="border border-[color:var(--pk-hairline)] p-10 bg-[color:var(--pk-bg-elev)] relative group hover:border-[color:var(--pk-hairline-hi)] transition-colors">
            <div className="razor-label text-[color:var(--pk-razor)] mb-4 flex items-center gap-2">
              <MailIcon size={12} /> FEEDBACK
            </div>
            <h3 className="razor-display text-3xl md:text-4xl mb-3">
              missing something? <em className="text-[color:var(--pk-razor)]">say so.</em>
            </h3>
            <p className="razor-mono text-xs text-[color:var(--pk-stone)] leading-relaxed mb-6 max-w-md">
              Tell us what tool you wish existed, what broke, or what would make PaperKnife
              faster for your workflow. The app composes the message locally.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/feedback?type=tool')}
                className="razor-btn-primary"
              >
                ▸ REQUEST TOOL
              </button>
              <button
                onClick={() => navigate('/feedback?type=bug')}
                className="razor-btn-ghost"
              >
                REPORT BUG
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SEO BLOCK (preserved for ranking, restyled) ────────── */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 pb-16">
        <div className="border border-[color:var(--pk-hairline)] p-10 bg-[color:var(--pk-bg-deep)]">
          <div className="razor-label text-[color:var(--pk-stone-dim)] mb-3">/ index/sitemap</div>
          <h2 className="razor-display-roman text-2xl md:text-3xl text-[color:var(--pk-bone)] mb-3">
            All-in-one private PDF tools.
          </h2>
          <p className="razor-mono text-xs text-[color:var(--pk-stone)] leading-relaxed max-w-3xl mb-6">
            PaperKnife handles everything from merge PDF, split PDF, compress PDF, protect PDF, unlock PDF,
            rotate, crop, watermark, metadata cleanup, signature, grayscale, PDF to image, image to PDF,
            extract images, PDF to text, structural repair, and side-by-side compare. Every operation
            runs locally — no server, no cloud, no data collected.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tools.map((tool) => (
              <button
                key={`seo-${tool.title}`}
                onClick={() => navigate(tool.path || '/')}
                className="razor-mono text-xs px-3 py-1.5 border border-[color:var(--pk-hairline)] text-[color:var(--pk-stone)] hover:text-[color:var(--pk-razor)] hover:border-[color:var(--pk-razor)] transition-colors"
              >
                {tool.title.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </section>

      <AdUnit className="max-w-4xl mx-auto px-6 md:px-10 mb-12" />

      {/* ─── ResuMate cross-promo (restyled) ─────────────────────── */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 pb-24">
        <div className="border border-[color:var(--pk-hairline-hi)] bg-[color:var(--pk-bg-elev)] p-10 md:p-14 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[color:#7CC4FF] to-transparent opacity-60" />
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-8">
              <div className="razor-label mb-4 flex items-center gap-2" style={{ color: '#7CC4FF' }}>
                <Sparkles size={12} /> ALSO BY PAPERKNIFE
              </div>
              <h3 className="razor-display text-3xl md:text-4xl mb-4">
                working with resumes? <em style={{ color: '#7CC4FF' }}>land more interviews.</em>
              </h3>
              <p className="razor-mono text-xs text-[color:var(--pk-stone)] leading-relaxed mb-6 max-w-xl">
                ResuMate analyzes your resume with AI, scores it against ATS systems, and helps you
                build a polished, job-ready version — in minutes, not hours.
              </p>
              <a
                href="https://resumate.paperknife.app"
                target="_blank"
                rel="noopener noreferrer"
                className="razor-btn-ghost no-underline inline-flex items-center gap-2"
                style={{ borderColor: '#7CC4FF', color: '#7CC4FF' }}
              >
                <FileTextIcon size={12} /> TRY RESUMATE — FREE ↗
              </a>
            </div>
            <div className="hidden md:block md:col-span-4">
              <div
                className="aspect-square w-full max-w-[200px] mx-auto border"
                style={{ borderColor: '#7CC4FF' }}
              >
                <img
                  src="/logos/resumate-promo.png"
                  alt="ResuMate"
                  className="w-full h-full object-cover grayscale contrast-125"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="px-6 md:px-10 py-10 md:py-14">
      <div className="razor-label text-[color:var(--pk-stone-dim)] mb-3">/ {label}</div>
      <div className="flex items-baseline gap-3">
        <span className="razor-display text-6xl md:text-8xl text-[color:var(--pk-bone)]">{value}</span>
        {suffix && (
          <span className="razor-mono text-xs text-[color:var(--pk-stone)]">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function Principle({
  num,
  title,
  body,
}: {
  num: string
  title: string
  body: string
}) {
  return (
    <div className="border border-[color:var(--pk-hairline)] bg-[color:var(--pk-bg-elev)] p-7 hover:border-[color:var(--pk-razor)] transition-colors group">
      <div className="razor-label text-[color:var(--pk-stone-dim)] mb-5 group-hover:text-[color:var(--pk-razor)] transition-colors">
        / {num}
      </div>
      <h3 className="razor-display-roman text-2xl md:text-3xl text-[color:var(--pk-bone)] mb-3 leading-tight">
        {title}
      </h3>
      <p className="razor-mono text-xs text-[color:var(--pk-stone)] leading-relaxed">{body}</p>
    </div>
  )
}
