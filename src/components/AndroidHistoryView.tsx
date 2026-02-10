import { useState, useEffect } from 'react'
import { 
  Download as DownloadIcon, 
  Clock as HistoryIcon, Shield as ShieldIcon, Search as SearchIcon, FileText as FileTextIcon, ChevronRight as ChevronRightIcon, X as XIcon, Trash2 as Trash2Icon, Calendar as CalendarIcon, HardDrive as HardDriveIcon
} from 'lucide-react'
import { ActivityEntry, getRecentActivity, clearActivity } from '../utils/recentActivity'
import { toast } from 'sonner'

export default function AndroidHistoryView() {
  const [history, setHistory] = useState<ActivityEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const limitSetting = localStorage.getItem('historyLimit')
    const limit = limitSetting === '999' ? 100 : parseInt(limitSetting || '10')
    getRecentActivity(limit).then(setHistory)
  }, [])

  const handleClear = async () => {
    toast('Wipe all history?', {
      id: 'history-wipe-confirm',
      action: {
        label: 'Confirm',
        onClick: async () => {
          await clearActivity()
          setHistory([])
          toast.success('History wiped', { id: 'history-wipe-done' })
          toast.dismiss('history-wipe-confirm')
        }
      },
      cancel: {
        label: 'Cancel',
        onClick: () => toast.dismiss('history-wipe-confirm')
      }
    })
  }

  const filteredHistory = history.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.tool.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-black pb-32 transition-colors">
      <header className="px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 sticky top-0 bg-[#FAFAFA]/90 dark:bg-black/90 backdrop-blur-xl z-50 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col text-left">
            <h1 className="text-3xl font-black tracking-tighter dark:text-white">Activity</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 opacity-80">Local Storage Active</p>
          </div>
          {history.length > 0 && (
            <button 
              onClick={handleClear}
              className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl active:scale-90 transition-all shadow-sm"
            >
              <Trash2Icon size={20} />
            </button>
          )}
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-rose-500 transition-colors">
            <SearchIcon size={18} />
          </div>
          <input 
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold placeholder:text-gray-400 focus:bg-white dark:focus:bg-zinc-800 shadow-sm outline-none transition-all dark:text-white"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-4 flex items-center text-gray-400"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>
      </header>

      <main className="px-4 py-6 space-y-2">
        {filteredHistory.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center animate-in fade-in duration-700">
            <div className="w-20 h-20 bg-gray-50 dark:bg-zinc-900 rounded-[2.5rem] flex items-center justify-center text-gray-300 mb-6 border border-gray-100 dark:border-white/5">
              <HistoryIcon size={32} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-black dark:text-white tracking-tight">Everything Clear</h3>
            <p className="text-xs text-gray-500 dark:text-zinc-500 max-w-[200px] mt-2 font-medium leading-relaxed">Documents processed on this device will appear here temporarily.</p>
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div key={item.id} className="p-4 bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-white/5 flex items-center gap-4 active:scale-[0.99] transition-all shadow-sm group">
              <div className="w-12 h-12 bg-gray-50 dark:bg-zinc-800 text-gray-400 group-hover:bg-rose-50 dark:group-hover:bg-rose-900/20 group-hover:text-rose-500 rounded-2xl flex items-center justify-center shrink-0 transition-colors shadow-inner">
                <FileTextIcon size={22} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-black truncate dark:text-white mb-0.5">{item.name}</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[9px] text-gray-400 font-black uppercase tracking-tighter bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                    {item.tool}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold">
                    <HardDriveIcon size={10} /> {formatSize(item.size)}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold">
                    <CalendarIcon size={10} /> {formatDate(item.timestamp)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {item.resultUrl && (
                    <a 
                      href={item.resultUrl} 
                      download={item.name} 
                      className="w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20 active:scale-90 transition-all"
                    >
                      <DownloadIcon size={18} />
                    </a>
                 )}
                 <ChevronRightIcon size={16} className="text-gray-200 dark:text-zinc-800" />
              </div>
            </div>
          ))
        )}

        <div className="pt-12 flex flex-col items-center gap-3 pb-10 opacity-30">
           <div className="flex items-center gap-2">
             <ShieldIcon size={14} className="text-emerald-500" />
             <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-500">Privacy Protocol</span>
           </div>
           <p className="text-[7px] font-medium text-gray-400 max-w-[200px] text-center">
             Documents are processed locally in your private environment. Activity logs are stored on this device only.
           </p>
        </div>
      </main>
    </div>
  )
}