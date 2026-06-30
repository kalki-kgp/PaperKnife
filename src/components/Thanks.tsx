import { Github as GHIcon, Heart as HeartIcon, Sparkles, ChevronRight, Coffee, Shield, Wrench, Code2 } from 'lucide-react'
import { PaperKnifeLogo } from './Logo'
import { usePageSeo } from '../utils/pageSeo'

export default function Thanks() {
  const links = [
    { name: 'pdf-lib', url: 'https://github.com/Hopding/pdf-lib', desc: 'Local PDF creation, page edits, metadata, signatures, and rebuild flows.' },
    { name: 'PDF.js', url: 'https://github.com/mozilla/pdf.js', desc: 'High-fidelity rendering, thumbnails, previews, text extraction, and page analysis.' },
    { name: 'qpdf-wasm', url: 'https://github.com/qpdf/qpdf', desc: 'Structural PDF repair and unlock/decrypt workflows through WebAssembly.' },
    { name: 'pdf-encrypt-lite', url: 'https://github.com/pdfsmaller/pdf-encrypt-lite', desc: 'Client-side password protection and encryption support.' },
    { name: 'Tesseract.js', url: 'https://github.com/naptha/tesseract.js', desc: 'Local OCR for scanned PDFs and image-based text extraction.' },
    { name: 'pixelmatch', url: 'https://github.com/mapbox/pixelmatch', desc: 'Visual diffing for the Compare PDFs workflow.' },
    { name: '@dnd-kit', url: 'https://github.com/clauderic/dnd-kit', desc: 'Drag-and-drop interactions for merge, reorder, and file flows.' },
    { name: 'JSZip', url: 'https://github.com/Stuk/jszip', desc: 'Local ZIP packaging for split pages and extracted assets.' },
    { name: 'Lucide', url: 'https://github.com/lucide-icons/lucide', desc: 'Crisp open-source icons across the interface.' },
    { name: 'React, Vite, Tailwind', url: 'https://vitejs.dev', desc: 'The app shell that keeps PaperKnife fast, static, and installable.' },
  ]

  usePageSeo({
    title: 'PaperKnife Hall of Fame — Supporters & Open Source Credits',
    description: 'PaperKnife thanks its supporters and the open-source libraries that power private local PDF merge, split, compress, unlock, repair, OCR, compare, and conversion tools.',
    canonicalPath: '/thanks'
  })

  return (
    <div className="min-h-full bg-[#FFF3F0] dark:bg-black text-gray-900 dark:text-zinc-100 selection:bg-terracotta-500 selection:text-white transition-colors duration-300">
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <div className="animate-in fade-in duration-700">
          <section className="mb-12 text-center">
            <div className="flex items-center justify-center gap-2 text-terracotta-500 font-black text-[9px] uppercase tracking-[0.4em] mb-4">
              <Sparkles size={12} /> Acknowledgments
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-gray-900 dark:text-white leading-[1.1] mb-6">
              Hall of <span className="text-terracotta-500">Fame.</span>
            </h2>
            <p className="text-base md:text-lg text-gray-500 dark:text-zinc-400 leading-relaxed font-medium max-w-xl mx-auto px-4">
              PaperKnife stays private because it has no upload server to monetize. This page is for the people and open-source projects keeping that choice alive.
            </p>
          </section>

          <div className="grid grid-cols-1 gap-4 mb-12">
            <div className="p-10 bg-zinc-900 text-white rounded-[2.5rem] border border-white/10 flex flex-col md:flex-row items-center gap-10 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 -mr-4 -mt-4 group-hover:scale-110 transition-transform duration-1000">
                <HeartIcon size={160} fill="currentColor" />
              </div>

              <div className="w-20 h-20 bg-terracotta-500 text-white rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-lg shadow-terracotta-500/20 animate-pulse relative z-10">
                <HeartIcon size={32} fill="currentColor" />
              </div>

              <div className="flex-1 text-center md:text-left relative z-10">
                <h3 className="text-3xl font-black tracking-tighter mb-2">Hall of Fame</h3>
                <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-lg mb-8 mx-auto md:mx-0">
                  Sponsors keep the app free, fund browser-only PDF fixes, and get a permanent shout-out here. No user files, no telemetry, no account wall.
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  <a href="https://github.com/sponsors/kalki-kgp" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-8 py-3.5 bg-white text-terracotta-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform shadow-lg">
                    <HeartIcon size={14} fill="currentColor" /> Sponsor Project
                  </a>
                  <a href="https://ko-fi.com/kalkikgp" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-8 py-3.5 bg-terracotta-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform shadow-lg shadow-terracotta-500/25">
                    <Coffee size={14} /> Buy Coffee
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {[
                { icon: Shield, title: 'Privacy', desc: 'No file uploads, accounts, or document tracking.' },
                { icon: Wrench, title: 'Tooling', desc: 'Merge, split, compress, crop, compare, unlock, repair, OCR, and conversion work.' },
                { icon: Code2, title: 'Open Source', desc: 'AGPL code that can be audited, self-hosted, and improved.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white dark:bg-zinc-900 rounded-[1.75rem] border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 flex items-center justify-center mb-4">
                    <Icon size={18} />
                  </div>
                  <h3 className="font-black text-xs uppercase tracking-widest dark:text-white mb-2">{title}</h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <div className="flex items-center gap-2 text-terracotta-500 font-black text-[9px] uppercase tracking-[0.3em] mb-4">
                <Sparkles size={12} /> Open Source Credits
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium leading-relaxed mb-5 max-w-2xl">
                PaperKnife is a static browser app, but the engine underneath is serious: PDF parsing, WebAssembly repair, encryption, OCR, diffing, drag-and-drop, and ZIP packaging all happen locally.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {links.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group p-5 bg-white dark:bg-zinc-900 rounded-[1.75rem] border border-gray-100 dark:border-white/5 hover:border-terracotta-500 transition-all shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center group-hover:bg-terracotta-500 group-hover:text-white transition-colors text-gray-400 shrink-0 border border-transparent dark:border-white/5">
                      <GHIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-xs tracking-widest uppercase dark:text-white mb-0.5">
                        {link.name}
                      </h3>
                      <p className="text-[9px] text-gray-500 dark:text-zinc-500 font-bold uppercase tracking-tight truncate">{link.desc}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-terracotta-500 group-hover:translate-x-1 transition-all" />
                </a>
              ))}
            </div>
          </div>

          <footer className="text-center py-8 opacity-20">
             <PaperKnifeLogo size={24} iconColor="#E68A73" partColor="currentColor" className="mx-auto mb-4" />
             <p className="text-[8px] font-black uppercase tracking-[0.5em]">PaperKnife Protocol v1.0.9</p>
          </footer>
        </div>
      </main>
    </div>
  )
}
