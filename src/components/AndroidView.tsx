import { useState, useMemo, useEffect } from 'react'
import { Shield, ChevronRight, Search, X, Clock, Trash2, FileIcon, Download, Grid } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Tool, ToolCategory } from '../types'
import { ActivityEntry, getRecentActivity, clearActivity } from '../utils/recentActivity'

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const ToolCardCompact = ({ title, desc, icon: Icon, implemented, onClick }: Tool & { onClick?: () => void }) => (
  <div 
    onClick={implemented ? onClick : undefined}
    className={`
      bg-white dark:bg-zinc-900 rounded-3xl border transition-all duration-300 flex flex-row items-center p-4 gap-4
      ${implemented 
        ? 'border-gray-100 dark:border-zinc-800 shadow-sm active:scale-95' 
        : 'border-gray-50 dark:border-zinc-900 opacity-50 saturate-0'}
    `}
  >
    <div className={`
      bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl flex items-center justify-center w-12 h-12 shrink-0
      ${implemented ? 'group-hover:bg-rose-500 group-hover:text-white' : ''}
    `}>
      <Icon size={24} />
    </div>
    <div className="text-left overflow-hidden flex-1">
      <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">{title}</h3>
      <p className="text-gray-500 dark:text-zinc-400 text-xs truncate">{desc}</p>
    </div>
    {implemented ? (
      <ChevronRight size={16} className="text-gray-300" />
    ) : (
      <span className="text-[8px] font-black uppercase tracking-tighter bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-gray-400">Soon</span>
    )}
  </div>
)

export default function AndroidView({ tools }: { tools: Tool[] }) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'All'>('All')
  const [activeTab, setActiveTab] = useState<'tools' | 'recent'>('tools')
  const [history, setHistory] = useState<ActivityEntry[]>([])

  useEffect(() => {
    getRecentActivity(10).then(setHistory)
  }, [activeTab])

  const handleClearHistory = async () => {
    await clearActivity()
    setHistory([])
  }

  const categories: (ToolCategory | 'All')[] = ['All', 'Edit', 'Secure', 'Convert', 'Optimize']

  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      const matchesSearch = tool.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           tool.desc.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = activeCategory === 'All' || tool.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [tools, searchQuery, activeCategory])

  const handleToolClick = (tool: Tool) => {
    if (!tool.implemented) return
    if (tool.path) {
      navigate(tool.path)
    }
  }

  return (
    <div className="h-screen bg-[#FAFAFA] dark:bg-black text-gray-900 dark:text-zinc-100 font-sans flex flex-col overflow-hidden transition-colors duration-300 ease-out">
      <main className="flex-1 overflow-y-auto p-6 pb-32">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-1 dark:text-white">
              {activeTab === 'tools' ? 'Tools' : 'Recent'}
            </h2>
            <p className="text-gray-500 dark:text-zinc-400 text-xs italic">Local processing • 100% Private</p>
          </div>
          
          <div className="flex bg-gray-100 dark:bg-zinc-900 p-1 rounded-2xl border border-gray-200/50 dark:border-zinc-800">
            <button 
              onClick={() => setActiveTab('tools')}
              className={`p-2 rounded-xl transition-all ${activeTab === 'tools' ? 'bg-white dark:bg-zinc-800 text-rose-500 shadow-sm' : 'text-gray-400'}`}
            >
              <Grid size={18} />
            </button>
            <button 
              onClick={() => setActiveTab('recent')}
              className={`p-2 rounded-xl transition-all ${activeTab === 'recent' ? 'bg-white dark:bg-zinc-800 text-rose-500 shadow-sm' : 'text-gray-400'}`}
            >
              <Clock size={18} />
            </button>
          </div>
        </div>

        {activeTab === 'tools' ? (
          <div className="animate-in fade-in duration-300">
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Search all tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl py-3.5 pl-11 pr-4 shadow-sm outline-none focus:border-rose-500 font-bold text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Categories Scroll */}
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`whitespace-nowrap px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-rose-500 text-white shadow-md' : 'bg-white dark:bg-zinc-900 text-gray-400 border border-gray-100 dark:border-zinc-800'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            
            <div className="space-y-3 mt-4">
              {filteredTools.map((tool) => (
                <ToolCardCompact 
                  key={tool.title} 
                  {...tool} 
                  onClick={() => handleToolClick(tool)} 
                />
              ))}
              {filteredTools.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-sm font-bold text-gray-400">No tools found.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6 px-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{history.length} Files Processed</p>
              {history.length > 0 && (
                <button onClick={handleClearHistory} className="text-[10px] font-black uppercase text-rose-500 flex items-center gap-1">
                  <Trash2 size={12} /> Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-gray-300">
                  <Clock size={32} />
                </div>
                <p className="text-sm font-bold text-gray-400">Your recent activity will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(item => (
                  <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl flex items-center justify-center shrink-0">
                      <FileIcon size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 rounded">{item.tool}</span>
                        <span className="text-[8px] font-bold text-gray-400 uppercase">{formatSize(item.size)}</span>
                      </div>
                    </div>
                    {item.resultUrl && (
                      <a href={item.resultUrl} download={item.name} className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-2xl text-rose-500 active:scale-90 transition-all">
                        <Download size={20} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="mt-10 p-6 bg-rose-50 dark:bg-rose-900/10 rounded-[2rem] border border-rose-100 dark:border-rose-900/20">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold mb-2">
            <Shield size={20} />
            <span>Secure Memory</span>
          </div>
          <p className="text-xs text-rose-600/70 dark:text-rose-400/60 leading-relaxed">Your files never leave this device. Processing happens entirely in RAM.</p>
        </div>

        <div className="mt-12 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-600">
            Built by <span className="text-rose-500">potatameister</span>
          </p>
        </div>
      </main>
    </div>
  )
}