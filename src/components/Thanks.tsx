import { Github as GHIcon, Heart as HeartIcon, Sparkles, Code, ExternalLink } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { NativeToolLayout } from './tools/shared/NativeToolLayout'
import { PaperKnifeLogo } from './Logo'

export default function Thanks() {
  const isNative = Capacitor.isNativePlatform()

  const links = [
    { name: 'pdf-lib', url: 'https://github.com/Hopding/pdf-lib', desc: 'Core document engine for local manipulation.' },
    { name: 'Termux', url: 'https://github.com/termux/termux-app', desc: 'Mobile terminal for on-the-go development.' },
    { name: 'OpenCode', url: 'https://github.com/opencode-ai/opencode', desc: 'Open-source AI coding assistant for the terminal.' },
    { name: 'Gemini CLI', url: 'https://github.com/google-gemini/gemini-cli', desc: 'AI assistance for architectural design.' },
  ]

  const content = (
    <div className="animate-in fade-in duration-700">
      <section className={isNative ? "mb-8 text-center py-2" : "mb-12 text-center"}>
        <div className="flex items-center justify-center gap-2 text-rose-500 font-black text-[9px] uppercase tracking-[0.4em] mb-4">
          <Sparkles size={12} /> Acknowledgments
        </div>
        <h2 className={isNative ? "text-3xl font-black tracking-tighter dark:text-white leading-tight mb-3" : "text-4xl md:text-6xl font-black tracking-tighter text-gray-900 dark:text-white leading-[1.1] mb-6"}>
          The <span className="text-rose-500">Supporters.</span>
        </h2>
        <p className="text-base md:text-lg text-gray-500 dark:text-zinc-400 leading-relaxed font-medium max-w-xl mx-auto px-4">
          PaperKnife is a self-funded labor of love. These are the individuals and tools that keep the engine running.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 mb-12">
        {/* Main Supporter Card / Hall of Fame */}
        <div className="p-8 bg-zinc-900 text-white rounded-[2.5rem] border border-white/10 flex flex-col md:flex-row items-center gap-8 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 -mr-4 -mt-4 group-hover:scale-110 transition-transform duration-1000">
            <HeartIcon size={160} fill="currentColor" />
          </div>
          
          <div className="w-20 h-20 bg-rose-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20 animate-pulse relative z-10">
            <HeartIcon size={32} fill="currentColor" />
          </div>
          
          <div className="flex-1 text-center md:text-left relative z-10">
            <h3 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Hall of Fame</h3>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-md mb-6 mx-auto md:mx-0">
              The heroes who fuel the engine. Your support ensures PaperKnife stays free, open, and permanently private. Sponsors get a permanent shout-out here.
            </p>
            <a href="https://github.com/sponsors/potatameister" target="_blank" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-rose-600 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform">
              <HeartIcon size={14} fill="currentColor" /> Become a Sponsor
            </a>
          </div>
        </div>

        {/* Technologies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 px-2 md:px-0">
          {links.map((link) => (
            <a 
              key={link.name} 
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group p-5 bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 hover:border-rose-500 transition-all shadow-sm flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-gray-50 dark:bg-zinc-900 rounded-lg flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors text-gray-400 shrink-0">
                <GHIcon size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-xs tracking-tight dark:text-white flex items-center gap-2">
                  {link.name}
                  <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-zinc-500 font-medium truncate">{link.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      <footer className="text-center py-8 opacity-20">
         <PaperKnifeLogo size={24} iconColor="#F43F5E" partColor="currentColor" className="mx-auto mb-4" />
         <p className="text-[8px] font-black uppercase tracking-[0.5em]">PaperKnife Protocol v1.0</p>
      </footer>
    </div>
  )

  if (isNative) {
    return (
      <NativeToolLayout title="Credits" description="Hall of Fame & Ecosystem" actions={null}>
        <div className="pb-20">
          {content}
        </div>
      </NativeToolLayout>
    )
  }

  return (
    <div className="min-h-full bg-[#FAFAFA] dark:bg-black text-gray-900 dark:text-zinc-100 selection:bg-rose-500 selection:text-white transition-colors duration-300">
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        {content}
      </main>
    </div>
  )
}
