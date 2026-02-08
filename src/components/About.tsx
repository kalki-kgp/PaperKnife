import { useState } from 'react'
import { 
  Heart, 
  ChevronDown, 
  Code, 
  Zap,
  ShieldCheck, Shield,
  Sparkles, Trash2, Clock, Moon, Sun, Monitor,
  ChevronRight, ExternalLink, Scale, FileLock
} from 'lucide-react'
import { Link } from 'react-router-dom'
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
    className={`w-full flex items-center justify-between p-4 active:bg-gray-100 dark:active:bg-zinc-900 transition-colors text-left ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'}`}>
        <Icon size={20} />
      </div>
      <div>
        <h4 className={`text-sm font-bold ${danger ? 'text-rose-500' : 'text-gray-900 dark:text-white'}`}>{title}</h4>
        {subtitle && <p className="text-[10px] text-gray-500 dark:text-zinc-500 font-medium">{subtitle}</p>}
      </div>
    </div>
    {action || (onClick && <ChevronRight size={18} className="text-gray-300" />)}
  </button>
)

const SettingGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-6">
    <h3 className="px-6 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">{title}</h3>
    <div className="bg-white dark:bg-zinc-950 border-y border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5">
      {children}
    </div>
  </div>
)

export default function About({ theme, setTheme }: { theme?: Theme, setTheme?: (t: Theme) => void }) {
  const [autoWipe, setAutoWipe] = useState(() => localStorage.getItem('autoWipe') === 'true')
  const [wipeTimer, setWipeTimer] = useState(() => localStorage.getItem('autoWipeTimer') || '15')
  const [showProtocol, setShowProtocol] = useState(false)

  const toggleAutoWipe = () => {
    const newValue = !autoWipe
    setAutoWipe(newValue)
    localStorage.setItem('autoWipe', String(newValue))
    toast.success(newValue ? 'Auto-Wipe Armed' : 'Auto-Wipe Off')
  }

  const changeTimer = (val: string) => {
    setWipeTimer(val)
    localStorage.setItem('autoWipeTimer', val)
    toast.success(`Wipe timer set to ${val}m`)
  }

  return (
    <NativeToolLayout title="Settings" description="Application configuration">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 -mx-4 md:mx-0">
        
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

        <SettingGroup title="Privacy & Security">
          <SettingItem 
            icon={Clock} 
            title="Auto-Wipe History" 
            subtitle="Scrub activity logs on launch"
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
            <div className="p-4 px-6 bg-gray-50/50 dark:bg-zinc-900/30 flex items-center justify-between">
               <span className="text-xs font-bold text-gray-500 uppercase">Inactivity Timeout</span>
               <select 
                value={wipeTimer}
                onChange={(e) => changeTimer(e.target.value)}
                className="bg-transparent text-sm font-black text-rose-500 outline-none"
               >
                  <option value="1">1 Minute</option>
                  <option value="5">5 Minutes</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="0">Instant (Exit)</option>
               </select>
            </div>
          )}
          <SettingItem 
            icon={Trash2} 
            title="Nuke All Data" 
            subtitle="Wipe everything instantly" 
            danger
            onClick={async () => {
              if(confirm("This will clear all history and settings. Continue?")) {
                await clearActivity()
                localStorage.clear()
                window.location.reload()
              }
            }}
          />
        </SettingGroup>

        <SettingGroup title="Documentation">
          <SettingItem 
            icon={ShieldCheck} 
            title="Privacy Policy" 
            subtitle="Zero-data collection policy"
            onClick={() => {
              alert("Privacy Policy: PaperKnife is a zero-server application. We do not collect, store, or transmit any PDF data, passwords, or personal metrics. All processing occurs locally in your device's volatile memory.")
            }}
          />
          <SettingItem 
            icon={Scale} 
            title="MIT License" 
            subtitle="Open-source legal protocol"
            onClick={() => {
              window.open('https://github.com/potatameister/PaperKnife/blob/main/LICENSE', '_blank')
            }}
          />
          <SettingItem 
            icon={Zap} 
            title="Technical Protocol" 
            subtitle="How it works under the hood"
            onClick={() => setShowProtocol(!showProtocol)}
          />
          {showProtocol && (
            <div className="p-6 bg-gray-50 dark:bg-zinc-900/50 text-xs text-gray-500 dark:text-zinc-400 space-y-4 animate-in slide-in-from-top-2">
               <p><strong className="text-rose-500 uppercase">Local-First:</strong> PaperKnife uses <code>pdf-lib</code> and <code>Web Workers</code> to process files in your RAM. Files are never uploaded.</p>
               <p><strong className="text-rose-500 uppercase">Security:</strong> Passwords used for Protect/Unlock tools are never stored. They are used purely as cryptographic seeds.</p>
            </div>
          )}
        </SettingGroup>

        <SettingGroup title="About">
          <SettingItem 
            icon={Github} 
            title="Source Code" 
            subtitle="GitHub Repository"
            onClick={() => window.open('https://github.com/potatameister/PaperKnife', '_blank')}
          />
          <SettingItem 
            icon={Sparkles} 
            title="Credits" 
            subtitle="Special Thanks"
            onClick={() => window.location.href = '/PaperKnife/thanks'}
          />
          <SettingItem 
            icon={Heart} 
            title="Sponsor" 
            subtitle="Support development"
            onClick={() => window.open('https://github.com/sponsors/potatameister', '_blank')}
          />
        </SettingGroup>

        <div className="text-center py-10 opacity-20">
           <p className="text-[9px] font-black uppercase tracking-[0.5em]">PaperKnife v0.5.0-beta</p>
        </div>

      </div>
    </NativeToolLayout>
  )
}
