/**
 * PaperKnife - Warm Clay-Morphism Dashboard
 * A cozy, privacy-first PDF toolkit interface.
 */

import { useState, useMemo } from 'react'
import {
  Search as SearchIcon,
  ChevronRight as ChevronRightIcon,
  CloudOff,
  Zap,
  WifiOff,
  Shield
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Tool, ToolCategory } from '../types'

const categoryColors: Record<ToolCategory, { bg: string, text: string, iconBg: string }> = {
  Edit: {
    bg: 'bg-terracotta-100/50 dark:bg-terracotta-900/20',
    text: 'text-terracotta-500',
    iconBg: 'bg-orange-100/50'
  },
  Secure: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-500',
    iconBg: 'bg-indigo-100/50'
  },
  Convert: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-500',
    iconBg: 'bg-emerald-100/50'
  },
  Optimize: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-500',
    iconBg: 'bg-amber-100/50'
  }
}

const ToolCard = ({ title, desc, icon: Icon, onClick, category }: Tool & { onClick?: () => void }) => {
  const colors = categoryColors[category]

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col p-8 rounded-[32px] bg-white dark:bg-zinc-900/60 shadow-clay dark:shadow-none dark:border dark:border-white/5 hover:shadow-clay-lg transition-all duration-300 text-left hover:-translate-y-1 border border-white/40"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${colors.iconBg} dark:bg-white/5 ${colors.text} group-hover:bg-terracotta-500 group-hover:text-white transition-all duration-500 shadow-sm`}>
        <Icon size={26} strokeWidth={2} />
      </div>
      <h3 className="font-bold text-text-main dark:text-white mb-2 text-lg tracking-tight group-hover:text-terracotta-500 transition-colors">{title}</h3>
      <p className="text-sm text-text-muted dark:text-zinc-400 leading-relaxed line-clamp-2">{desc}</p>

      <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity text-terracotta-500">
        <ChevronRightIcon size={20} />
      </div>
    </button>
  )
}

export default function WebView({ tools }: { tools: Tool[] }) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'All'>('All')

  const categories: (ToolCategory | 'All')[] = ['All', 'Edit', 'Secure', 'Convert', 'Optimize']

  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      const matchesSearch = tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           tool.desc.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = activeCategory === 'All' || tool.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [tools, searchQuery, activeCategory])

  return (
    <div className="min-h-screen bg-[#FFF3F0] dark:bg-black transition-colors duration-500">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(230,138,115,0.08),transparent_70%)] pointer-events-none" />

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-100 dark:bg-terracotta-900/20 text-terracotta-500 rounded-full text-sm font-semibold mb-8 border border-orange-200/50 dark:border-terracotta-900/30">
            <span>Your PDFs, processed locally with peace of mind.</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-text-main dark:text-white mb-8 leading-tight">
            Your PDFs, Your Peace.<br/>
            <span className="text-terracotta-500">Your Protector.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-text-muted dark:text-zinc-400 text-xl mb-12 leading-relaxed">
            Experience effortless security. Process your documents right in your browser with the comfort of knowing your files never leave your side.
          </p>

          {/* Search */}
          <div className="max-w-2xl mx-auto relative group mt-8">
            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-text-muted group-focus-within:text-terracotta-500 transition-colors">
              <SearchIcon size={22} />
            </div>
            <input
              type="text"
              placeholder="Search tools (e.g. merge, compress, protect...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 rounded-[32px] py-6 pl-16 pr-8 shadow-clay dark:shadow-none dark:border dark:border-white/5 border border-white/40 focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/10 outline-none transition-all font-bold text-xl text-text-main dark:text-white placeholder:text-text-muted/50"
            />
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="max-w-6xl mx-auto px-6 -mt-4 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="clay-card-yellow p-8 text-left border-4 border-white/50 hover:-translate-y-1 transition-transform duration-300">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-terracotta-500 mb-4 shadow-inner">
              <CloudOff className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Privacy First</p>
            <h3 className="text-2xl font-bold text-text-main dark:text-white">Zero Uploads</h3>
          </div>

          <div className="clay-card-peach p-8 text-left border-4 border-white/50 hover:-translate-y-1 transition-transform duration-300">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-terracotta-500 mb-4 shadow-inner">
              <Zap className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Processing Speed</p>
            <h3 className="text-2xl font-bold text-text-main dark:text-white">Instant</h3>
          </div>

          <div className="clay-card p-8 text-left border-4 border-white/50 hover:-translate-y-1 transition-transform duration-300">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-terracotta-500 mb-4 shadow-inner">
              <WifiOff className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Offline Capable</p>
            <h3 className="text-2xl font-bold text-text-main dark:text-white">100% Local</h3>
          </div>
        </div>
      </section>

      {/* Toolkit Section */}
      <section className="bg-accent-yellow dark:bg-zinc-950 py-20 rounded-[80px_80px_0_0]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-terracotta-500 font-bold tracking-widest uppercase text-sm mb-4 block">Powerful Toolkit</span>
            <h2 className="text-4xl md:text-5xl font-bold text-text-main dark:text-white mb-6">Everything you need to manage PDFs</h2>
            <p className="text-text-muted dark:text-zinc-400 text-xl max-w-2xl mx-auto">
              All the essential tools, optimized for your machine, delivering a cozy and seamless experience.
            </p>
          </div>

          {/* Category Filters */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                    activeCategory === cat
                      ? 'bg-terracotta-500 text-white shadow-lg shadow-terracotta-500/30'
                      : 'bg-white/70 dark:bg-zinc-900 text-text-muted dark:text-zinc-400 shadow-clay-sm dark:shadow-none dark:border dark:border-white/5 hover:text-terracotta-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="hidden md:block text-sm font-bold text-text-muted">{filteredTools.length} tools available</p>
          </div>

          {/* Tool Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.title}
                {...tool}
                onClick={() => navigate(tool.path || '/')}
              />
            ))}
          </div>

          {filteredTools.length === 0 && (
            <div className="py-32 text-center">
              <div className="w-20 h-20 bg-white dark:bg-zinc-900 rounded-[32px] shadow-clay dark:shadow-none flex items-center justify-center mx-auto mb-6 text-text-muted">
                <SearchIcon size={32} />
              </div>
              <h3 className="text-2xl font-bold text-text-main dark:text-white mb-2">No tools matched.</h3>
              <p className="text-text-muted dark:text-zinc-400">Try searching for a different keyword or clear your filters.</p>
              <button onClick={() => { setSearchQuery(''); setActiveCategory('All'); }} className="mt-8 text-terracotta-500 font-bold text-sm hover:underline underline-offset-8">Reset Dashboard</button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white dark:bg-zinc-950 py-24 rounded-[0_0_80px_80px] shadow-[0_40px_60px_-15px_rgba(230,138,115,0.1)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="clay-card-peach p-16 border-4 border-white/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Shield className="w-32 h-32" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-text-main mb-6 relative z-10">Ready to take control?</h2>
            <p className="text-text-muted text-xl mb-12 max-w-xl mx-auto relative z-10">
              Start processing your PDFs with complete peace of mind today. Your files are in safe hands — yours.
            </p>
            <button
              onClick={() => setActiveCategory('All')}
              className="clay-button px-12 py-5 rounded-3xl text-lg font-bold relative z-10"
            >
              Start Using Tools
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
