import { useState, useEffect } from 'react'
import { 
  Github, Heart, 
  ChevronDown, Layers, Lock, 
  Code, Star, 
  Terminal, Zap,
  ExternalLink, Award,
  Scissors, Cpu, ShieldCheck, Shield,
  Sparkles, Settings, Trash2, Clock, Check
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { NativeToolLayout } from './tools/shared/NativeToolLayout'
import { clearActivity } from '../utils/recentActivity'
import { toast } from 'sonner'

const TechSpec = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 dark:border-zinc-800 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isOpen ? 'bg-rose-500 text-white' : 'bg-gray-50 dark:bg-zinc-900 text-gray-400 group-hover:text-rose-500'}`}>
            <Icon size={18} strokeWidth={2} />
          </div>
          <h4 className="font-black text-sm uppercase tracking-widest text-gray-900 dark:text-white">{title}</h4>
        </div>
        <ChevronDown size={18} className={`text-gray-300 transition-transform duration-300 ${isOpen ? 'rotate-180 text-rose-500' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="pb-8 pl-14 pr-4 text-sm text-gray-500 dark:text-zinc-400 leading-relaxed space-y-3">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function About() {
  const isNative = Capacitor.isNativePlatform()
  const [autoWipe, setAutoWipe] = useState(() => localStorage.getItem('autoWipe') === 'true')

  const toggleAutoWipe = () => {
    const newValue = !autoWipe
    setAutoWipe(newValue)
    localStorage.setItem('autoWipe', String(newValue))
    toast.success(newValue ? 'Auto-Wipe Enabled' : 'Auto-Wipe Disabled')
  }

  const handleClearData = async () => {
    await clearActivity()
    toast.success('All local data cleared.')
  }

  // Native Settings View
  if (isNative) {
    return (
      <NativeToolLayout 
        title="Settings" 
        description="Manage your privacy and app preferences."
      >
        <div className="space-y-8">
          {/* Privacy Section */}
          <section>
            <h3 className="px-2 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Privacy Control</h3>
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-zinc-800 overflow-hidden">
              <div className="p-4 flex items-center justify-between border-b border-gray-50 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-xl flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">Auto-Wipe</h4>
                    <p className="text-[10px] text-gray-500 font-medium">Clear data on app exit</p>
                  </div>
                </div>
                <button 
                  onClick={toggleAutoWipe}
                  className={`w-12 h-7 rounded-full p-1 transition-colors ${autoWipe ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-zinc-700'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${autoWipe ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <button 
                onClick={handleClearData}
                className="w-full p-4 flex items-center gap-4 active:bg-gray-50 dark:active:bg-zinc-800 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-xl flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">Nuke Data</h4>
                  <p className="text-[10px] text-gray-500 font-medium">Instantly clear history & cache</p>
                </div>
              </button>
            </div>
          </section>

          {/* About Section */}
          <section>
            <h3 className="px-2 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">About PaperKnife</h3>
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-zinc-800 p-6 space-y-6">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-zinc-900 dark:bg-white rounded-2xl flex items-center justify-center shadow-lg">
                     <Terminal size={32} className="text-white dark:text-black" />
                  </div>
                  <div>
                     <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">PaperKnife Node</h2>
                     <p className="text-xs font-medium text-gray-500">v0.5.0-beta • Build 2026</p>
                  </div>
               </div>
               
               <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed font-medium">
                 PaperKnife is a local-first PDF utility designed for maximum privacy. No servers, no tracking, just your device's power.
               </p>

               <div className="flex gap-2">
                 <a href="https://github.com/potatameister/PaperKnife" className="flex-1 py-3 bg-gray-100 dark:bg-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-center text-gray-600 dark:text-gray-300">GitHub</a>
                 <Link to="/thanks" className="flex-1 py-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-center text-rose-500">Credits</Link>
               </div>
            </div>
          </section>
        </div>
      </NativeToolLayout>
    )
  }

  // Web View (Documentation)
  return (
    <div className="min-h-full bg-[#FAFAFA] dark:bg-black text-gray-900 dark:text-zinc-100 selection:bg-rose-500 selection:text-white transition-colors duration-300">
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-24">
        
        {/* Refined Hero */}
        <section className="mb-24">
          <div className="flex items-center gap-2 text-rose-500 font-black text-[10px] uppercase tracking-[0.4em] mb-6">
            <Terminal size={14} /> Documentation v0.9.5
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-gray-900 dark:text-white leading-[1.1] mb-8">
            The Free <br/>
            <span className="text-rose-500">Privacy</span> Engine.
          </h2>
          <p className="text-lg md:text-xl text-gray-500 dark:text-zinc-400 leading-relaxed font-medium max-w-2xl">
            PaperKnife is a high-integrity PDF utility that executes entirely within the client-side runtime. We removed the server to ensure your documents never leave your sight.
          </p>
          <div className="mt-8">
            <Link 
              to="/thanks" 
              className="inline-flex items-center gap-2 text-rose-500 font-black text-xs uppercase tracking-widest hover:translate-x-1 transition-transform"
            >
              <Sparkles size={16} /> View Special Thanks
            </Link>
          </div>
        </section>

        {/* Technical Specification Protocol */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-8 px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Tool-Specific Logic</h3>
            <div className="h-[1px] flex-1 bg-gray-100 dark:border-zinc-800" />
          </div>

          <div className="bg-white dark:bg-zinc-950 rounded-[2rem] border border-gray-100 dark:border-zinc-800 px-2 md:px-6 shadow-sm">
            <TechSpec title="Zero-Server Protocol" icon={ShieldCheck}>
              <p>PaperKnife operates on a <strong>Local-First</strong> principle. When you select a file, it is loaded into your browser's private heap memory as an <code>ArrayBuffer</code>. No part of your file is ever uploaded, cached on a server, or transmitted over a network. All computations are performed by your device's CPU.</p>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 w-fit px-2 py-1 rounded">
                <Shield size={10} /> 100% In-Memory Processing
              </div>
            </TechSpec>

            <TechSpec title="Merge PDF" icon={Layers}>
              <p>Uses <strong>pdf-lib</strong> to initialize a new document in RAM. It copies the low-level object streams from your source files into the new container, preserving links and structure without disk I/O.</p>
            </TechSpec>

            <TechSpec title="Split PDF" icon={Scissors}>
              <p>Heavy page rendering is offloaded to a <strong>Web Worker</strong> thread. We perform "Atomic Extraction" by copying only the byte-offsets relevant to your selected pages into a fresh PDF buffer.</p>
            </TechSpec>

            <TechSpec title="Compress PDF" icon={Zap}>
              <p>Converts PDF vectors into high-resolution bitmaps, applies lossy JPEG encoding, and re-encapsulates them. This is the most effective way to shrink bloated or scanned documents.</p>
            </TechSpec>

            <TechSpec title="Protect PDF" icon={Lock}>
              <p>Implements the standard PDF Security Handler. Your password is used as a cryptographic seed for <strong>AES-256</strong> bit encryption. Your password never leaves your browser.</p>
            </TechSpec>

            <TechSpec title="Parallel Compute" icon={Cpu}>
              <p>We leverage <strong>Hardware Concurrency</strong>. The engine spawns background Web Workers to process document batches in parallel, ensuring consistent performance without UI latency.</p>
            </TechSpec>

            <TechSpec title="Audit Integrity" icon={Code}>
              <p>The entire engine is Open Source. You can verify our "Zero-Server" claim by auditing the Network tab (F12) to ensure no PDF data is transmitted to external URLs.</p>
              <a href="https://github.com/potatameister/PaperKnife" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-rose-500 font-bold hover:underline mt-2 text-[10px] uppercase tracking-widest">
                Audit on GitHub <ExternalLink size={12} />
              </a>
            </TechSpec>
          </div>
        </section>

        {/* Consolidatied Supporter Section */}
        <section className="mb-24">
          <div className="bg-zinc-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-12 text-rose-500/10 pointer-events-none">
              <Star size={120} fill="currentColor" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-2 text-rose-500 font-black uppercase tracking-[0.2em] text-[10px]">
                  <Award size={14} /> PaperKnife Supporter
                </div>
                <h3 className="text-3xl font-black uppercase tracking-tighter">Support the <br/>Project.</h3>
                <p className="text-sm text-gray-400 max-w-sm leading-relaxed font-medium">
                  PaperKnife is a free, solo-developed project. Your support helps keep the engine independent and completely ad-free.
                </p>
                
                <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-rose-500">
                        <Heart size={16} fill="currentColor" />
                        <span className="text-[10px] font-black uppercase tracking-widest">README Shoutout</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed uppercase font-bold tracking-tight">Your name etched in the GitHub Repository.</p>
                </div>
              </div>

              <div className="w-full md:w-fit shrink-0">
                <a 
                  href="https://github.com/sponsors/potatameister" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-rose-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-600 transition-all active:scale-95 shadow-xl shadow-rose-500/20"
                >
                  <Heart size={16} fill="currentColor" />
                  Sponsor Project
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Minimal Footer */}
        <footer className="text-center pt-10 border-t border-gray-100 dark:border-zinc-900">
            <div className="flex justify-center gap-8 mb-8">
                <a href="https://github.com/potatameister/PaperKnife" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-rose-500 transition-colors"><Github size={20} /></a>
                <Link to="/thanks" className="text-gray-400 hover:text-rose-500 transition-colors"><Sparkles size={20} /></Link>
                <a href="https://github.com/sponsors/potatameister" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-rose-500 transition-colors"><Heart size={20} /></a>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-300 dark:text-zinc-800 mb-2 leading-relaxed">
                PaperKnife • Precision Logic <br/>
                Zero Data Persistence • Open Source 2026
            </p>
        </footer>

      </main>
    </div>
  )
}
