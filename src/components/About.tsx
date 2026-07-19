/**
 * PaperKnife - About & Protocol Specification
 * Professional-grade technical details and sustainability protocol.
 */

import { useState } from 'react'
import { 
  Heart as HeartIcon,
  Code as CodeIcon,
  Cpu as CpuIcon,
  Github as GHIcon,
  Shield as ShieldIcon,
  ChevronDown as ChevronDownIcon,
  ServerOff as ServerOffIcon,
  ExternalLink as ExternalLinkIcon,
  ChevronRight as ChevronRightIcon,
  Sparkles as SparklesIcon,
  FileText as FileTextIcon,
  HardDrive as DiskIcon,
  EyeOff as PrivacyIcon,
  Coffee as CoffeeIcon,
  Building2 as BuildingIcon,
  Mail as MailIcon,
  Server as ServerIcon
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PaperKnifeLogo } from './Logo'
import { usePageSeo } from '../utils/pageSeo'

// --- UI COMPONENTS ---
const SpecItem = ({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 dark:border-zinc-800 last:border-0 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group transition-all"
      >
        <div className="flex items-center gap-5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${isOpen ? 'bg-terracotta-500 text-white shadow-lg shadow-terracotta-500/20' : 'bg-gray-50 dark:bg-zinc-900 text-gray-400 group-hover:text-terracotta-500 group-hover:bg-terracotta-50 dark:group-hover:bg-terracotta-900/10'}`}>
            <Icon size={20} strokeWidth={2.5} />
          </div>
          <h4 className="font-black text-xs md:text-sm uppercase tracking-[0.2em] text-gray-900 dark:text-white transition-colors">{title}</h4>
        </div>
        <div className={`p-2 rounded-full transition-all ${isOpen ? 'bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500' : 'text-gray-300'}`}>
          <ChevronDownIcon size={18} className={`transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isOpen && (
        <div className="pb-8 pl-16 pr-6 text-sm md:text-base text-gray-500 dark:text-zinc-400 font-medium leading-relaxed animate-in slide-in-from-top-4 duration-500">
          {children}
        </div>
      )}
    </div>
  )
}

// --- WEB VERSION (TITAN v1.2 EXPLANATORY) ---
const AboutWeb = () => {
  const navigate = useNavigate()
  usePageSeo({
    title: 'About PaperKnife — Private, Local PDF Tools',
    description: 'Learn how PaperKnife keeps PDF merge, split, compress, protect, unlock, convert, OCR, and cleanup workflows private by running every operation locally in your browser.',
    canonicalPath: '/about'
  })

  return (
    <div className="min-h-screen bg-[#FFF3F0] dark:bg-black text-gray-900 dark:text-zinc-100 selection:bg-terracotta-500 selection:text-white pb-24">
      
      {/* 1. Impact Hero - Compact */}
      <section className="relative pt-20 pb-12 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(230,138,115,0.05),transparent_60%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter dark:text-white mb-6 leading-[0.9] animate-in fade-in slide-in-from-bottom-4 duration-700">
            Privacy is a <br/>
            <span className="text-terracotta-500 font-black">Human Right.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            PaperKnife is an absolute document engine. No servers, no tracking, no compromises. We transform your browser into a self-contained document laboratory.
          </p>
        </div>
      </section>

      {/* 2. Sustainability Card - Condensed */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="clay-card-peach p-8 md:p-12 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden border-4 border-white/50">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(230,138,115,0.1),transparent_60%)] pointer-events-none" />
           <div className="w-20 h-20 bg-terracotta-500/20 rounded-3xl flex items-center justify-center shrink-0 border border-terracotta-500/20">
              <HeartIcon size={32} className="text-terracotta-500" fill="currentColor" />
           </div>
           <div className="flex-1 text-center md:text-left relative z-10">
              <h3 className="text-3xl font-black tracking-tighter mb-3 leading-tight text-text-main">Fuel the Engine.</h3>
              <p className="text-text-muted font-medium text-base mb-6 max-w-xl leading-relaxed">
                 PaperKnife is built and maintained by one person. Your support keeps the project alive and free for everyone.
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                 <a href="https://ko-fi.com/kalkikgp" target="_blank" className="px-8 py-3.5 clay-button rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform flex items-center gap-2">
                    <CoffeeIcon size={14} /> Buy me a Coffee
                 </a>
                 <a href="https://github.com/sponsors/kalki-kgp" target="_blank" className="px-8 py-3.5 bg-white text-terracotta-500 border border-terracotta-200 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-terracotta-50 transition-colors flex items-center gap-2">
                    <HeartIcon size={14} fill="currentColor" /> Sponsor
                 </a>
                 <button onClick={() => navigate('/thanks')} className="px-8 py-3.5 bg-white text-terracotta-500 border border-terracotta-200 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-terracotta-50 transition-colors flex items-center gap-2">
                    <SparklesIcon size={14} /> Hall of Fame
                 </button>
              </div>
           </div>
        </div>
      </section>

      {/* 3. Deep Specification - Tighter Layout */}
      <section className="max-w-6xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Narrative Column */}
          <div className="lg:col-span-5 space-y-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-zinc-100 dark:bg-white/5 rounded-md text-[9px] font-black uppercase tracking-widest text-gray-400 border border-gray-200/50 dark:border-white/5">
               Technical Manifesto
            </div>
            <h2 className="text-3xl font-black tracking-tighter dark:text-white leading-[1.1]">
              Architecture of <br/>
              <span className="text-terracotta-500">Absolute Sovereignty.</span>
            </h2>
            <p className="text-gray-500 dark:text-zinc-400 text-sm font-medium leading-relaxed">
              PaperKnife rejects the trade-off between convenience and privacy. We've built an engine that runs where the user is, ensuring your sensitive data never crosses a network boundary.
            </p>
            <div className="p-6 bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
               <h4 className="font-black text-[10px] uppercase tracking-widest text-emerald-500 mb-3 flex items-center gap-2">
                  <ServerOffIcon size={14} /> Zero Infrastructure
               </h4>
               <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium leading-relaxed">
                  We operate no backend. No databases. No file caches. PaperKnife is a static distribution of code that activates your browser's existing power.
               </p>
            </div>
          </div>

          {/* Accordion Column - Compact */}
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 rounded-[2.5rem] p-2 md:p-6 border border-gray-100 dark:border-white/5 shadow-sm">
             <SpecItem title="How it Works" icon={CpuIcon} defaultOpen={true}>
                Every action is executed locally on your device's CPU. Using high-performance <span className="text-terracotta-500 font-bold">Web Workers</span> and <span className="text-terracotta-500 font-bold">WebAssembly</span>, PaperKnife loads your PDF into a sandboxed environment within your browser tab.
             </SpecItem>

             <SpecItem title="Data Lifecycle" icon={PrivacyIcon}>
                Your documents live exclusively in your browser's <span className="text-terracotta-500 font-bold">volatile memory (RAM)</span>. We do not use persistent storage or cookies for your file content. Once the tab is closed, the data is destroyed.
             </SpecItem>

             <SpecItem title="Deep Metadata Clean" icon={DiskIcon}>
                Our "Deep Clean" metadata protocol purges identifying strings like Producer, Creator, and XMP metadata that standard editors leave behind, ensuring your files are truly anonymous.
             </SpecItem>

             <SpecItem title="Radical Transparency" icon={CodeIcon}>
                PaperKnife is <span className="text-terracotta-500 font-bold">100% Open Source</span> under the <span className="text-terracotta-500 font-bold">GNU AGPL v3</span> license. This gives you the right to audit every line of code and guarantees the engine remains free.
             </SpecItem>

             <SpecItem title="Privacy Nodes" icon={ShieldIcon}>
                By processing documents on-device, every user acts as their own "Privacy Node." There is no central point of failure and no surveillance capability.
             </SpecItem>
          </div>

        </div>
      </section>

      {/* Enterprise Self-Hosted */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-zinc-900 to-zinc-800 text-white p-8 md:p-12 border border-white/10">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-terracotta-500 via-indigo-500 to-emerald-500" />
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <ServerIcon className="w-40 h-40" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center shrink-0 border border-white/10">
              <BuildingIcon size={32} className="text-terracotta-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-3xl font-black tracking-tighter mb-3 leading-tight">Deploy on Your Infrastructure.</h3>
              <p className="text-zinc-400 font-medium text-base mb-6 max-w-xl leading-relaxed">
                Self-host PaperKnife for your organization. Air-gapped deployment, custom branding, priority support, and compliance-ready documentation.
              </p>
              <button
                onClick={() => navigate('/feedback?type=enterprise')}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-terracotta-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-terracotta-500/30 hover:scale-105 transition-transform no-underline"
              >
                <MailIcon size={14} /> Contact for Enterprise Licensing
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ResuMate Cross-Promo */}
      <section className="max-w-4xl mx-auto px-6 mb-16">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0F0F18] to-[#1A1426] border border-white/10 p-10 md:p-14 shadow-xl shadow-black/20">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF5C7C] to-[#5BFFB0]" />
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5BFFB0]/25 bg-[#5BFFB0]/10 text-[#5BFFB0] text-xs font-bold uppercase tracking-widest">
                <SparklesIcon size={12} />
                Also by PaperKnife
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-white leading-tight">
                Working with resumes?<br />
                <span className="text-[#FF9AB0]">Build one that lands interviews.</span>
              </h3>
              <p className="text-zinc-400 text-base leading-relaxed max-w-lg">
                ResuMate analyzes your resume with AI, scores it against ATS systems, and helps you build a polished, job-ready version — in minutes, not hours.
              </p>
              <a
                href="https://resumate.paperknife.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-[#FF5C7C] to-[#8B6FFF] text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-[#FF5C7C]/25 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 no-underline"
              >
                <FileTextIcon size={16} />
                Try ResuMate — It's Free
              </a>
            </div>

            <div className="hidden md:flex w-36 h-36 rounded-[28px] items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br from-[#FF5C7C] to-[#8B6FFF] shadow-xl shadow-[#FF5C7C]/20">
              <img src="/logos/resumate-promo.png" alt="ResuMate AI Resume Builder" width={144} height={144} className="w-full h-full object-cover rounded-[28px]" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Final Footer Links - Condensed */}
      <section className="max-w-4xl mx-auto px-6 text-center border-t border-gray-100 dark:border-zinc-900 pt-16">
        <div className="flex flex-wrap justify-center gap-8 mb-12">
           <a href="https://github.com/kalki-kgp/PaperKnife" target="_blank" className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-terracotta-500 transition-colors group">
              <GHIcon size={16} /> Audit Source <ExternalLinkIcon size={12} className="opacity-40 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
           </a>
           <a href="https://resumate.paperknife.app" target="_blank" className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-terracotta-500 transition-colors group">
              <SparklesIcon size={16} /> ResuMate <ExternalLinkIcon size={12} className="opacity-40 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
           </a>
           <button onClick={() => navigate('/thanks')} className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-terracotta-500 transition-colors group">
              <SparklesIcon size={16} /> Credits <ChevronRightIcon size={12} className="opacity-40 group-hover:translate-x-1 transition-transform" />
           </button>
        </div>
        
        <div className="opacity-20 hover:opacity-50 transition-opacity duration-700">
          <PaperKnifeLogo size={32} iconColor="#E68A73" partColor="currentColor" className="mx-auto mb-4" />
          <p className="text-[9px] font-black uppercase tracking-[0.6em] text-gray-400">kalki-kgp</p>
        </div>
      </section>

    </div>
  )
}

export default AboutWeb
