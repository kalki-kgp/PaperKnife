import { useState } from 'react'
import { 
  Trash2, Clock, Moon, Sun, Monitor,
  ChevronRight, Info
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clearActivity } from '../utils/recentActivity'
import { toast } from 'sonner'
import { Theme } from '../types'
import { NativeToolLayout } from './tools/shared/NativeToolLayout'

const SettingItem = ({ 
  icon: Icon, 
  title, 
  subtitle, 
  action, 
  onClick,
  danger 
}: { 
  icon: any, 
  title: string, 
  subtitle?: string, 
  action?: React.ReactNode,
  onClick?: () => void,
  danger?: boolean
}) => (
  <button 
    onClick={onClick}
    disabled={!onClick}
    className={`w-full flex items-center justify-between p-5 active:bg-gray-100 dark:active:bg-zinc-900 transition-colors text-left ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-center gap-4 flex-1">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className={`text-sm font-bold truncate ${danger ? 'text-rose-500' : 'text-gray-900 dark:text-white'}`}>{title}</h4>
        {subtitle && <p className="text-[10px] text-gray-500 dark:text-zinc-500 font-medium line-clamp-1">{subtitle}</p>}
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {action}
      {onClick && !action && <ChevronRight size={18} className="text-gray-300" />}
    </div>
  </button>
)

const SettingGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-8">
    <h3 className="px-6 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">{title}</h3>
    <div className="bg-white dark:bg-zinc-950 border-y border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5">
      {children}
    </div>
  </div>
)

export default function Settings({ theme, setTheme }: { theme?: Theme, setTheme?: (t: Theme) => void }) {
  const navigate = useNavigate()
  const [autoWipe, setAutoWipe] = useState(() => localStorage.getItem('autoWipe') === 'true')
  const [wipeTimer, setWipeTimer] = useState(() => localStorage.getItem('autoWipeTimer') || '15')

  const toggleAutoWipe = () => {
    const newValue = !autoWipe
    setAutoWipe(newValue)
    localStorage.setItem('autoWipe', String(newValue))
    toast.success(newValue ? 'Auto-Wipe Enabled' : 'Auto-Wipe Disabled')
  }

  return (
    <NativeToolLayout title="Settings" description="Application configuration">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pb-32 -mx-4 md:mx-0">
        
        {/* Appearance */}
        <SettingGroup title="Appearance">
          <div className="p-4 grid grid-cols-3 gap-2 bg-white dark:bg-zinc-950">
            {[
              { id: 'light', icon: Sun, label: 'Light' },
              { id: 'dark', icon: Moon, label: 'Dark' },
              { id: 'system', icon: Monitor, label: 'System' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme?.(t.id as Theme)}
                className={`flex flex-col items-center gap-2 py-3 rounded-xl transition-all ${theme === t.id ? 'bg-rose-500 text-white shadow-lg' : 'bg-gray-50 dark:bg-zinc-900 text-gray-400'}`}
              >
                <t.icon size={18} />
                <span className="text-[10px] font-bold uppercase">{t.label}</span>
              </button>
            ))}
          </div>
        </SettingGroup>

        {/* Security */}
        <SettingGroup title="Security & Privacy">
          <SettingItem 
            icon={Clock} 
            title="Auto-Wipe History" 
            subtitle="Clear logs on app launch"
            action={
              <button 
                onClick={toggleAutoWipe}
                className={`w-11 h-6 rounded-full p-1 transition-colors ${autoWipe ? 'bg-rose-500' : 'bg-gray-200 dark:bg-zinc-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${autoWipe ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            }
          />
          {autoWipe && (
            <div className="p-4 px-6 bg-rose-50/30 dark:bg-rose-900/10 flex items-center justify-between border-t border-rose-100/20 dark:border-rose-900/20">
               <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Wipe Delay</span>
               <select 
                value={wipeTimer}
                onChange={(e) => {
                  const val = e.target.value
                  setWipeTimer(val)
                  localStorage.setItem('autoWipeTimer', val)
                  toast.success(`Wipe timer set to ${val}m`)
                }}
                className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none appearance-none cursor-pointer"
               >
                  <option value="1">1 Minute</option>
                  <option value="5">5 Minutes</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="0">Immediate</option>
               </select>
            </div>
          )}
          <SettingItem 
            icon={Trash2} 
            title="Nuke All Data" 
            subtitle="Reset app to factory defaults" 
            danger
            onClick={async () => {
              if(confirm("DANGER: This will delete ALL history and settings. Proceed?")) {
                await clearActivity()
                localStorage.clear()
                window.location.reload()
              }
            }}
          />
        </SettingGroup>

        {/* Application */}
        <SettingGroup title="Application">
          <SettingItem 
            icon={Info} 
            title="About PaperKnife" 
            subtitle="Version, License, and Protocol"
            onClick={() => navigate('/about')}
          />
        </SettingGroup>

        <div className="flex flex-col items-center gap-2 py-10 opacity-20">
           <p className="text-[9px] font-black uppercase tracking-[0.5em]">PaperKnife Node v0.5.0-beta</p>
        </div>

      </div>
    </NativeToolLayout>
  )
}
