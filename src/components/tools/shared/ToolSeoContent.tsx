/**
 * SEO content section for tool pages.
 * Renders crawlable text (what it does, how it works, FAQ) below the tool UI.
 * Hidden on native to save screen space.
 */

import { Capacitor } from '@capacitor/core'

interface FaqItem {
  q: string
  a: string
}

interface ToolSeoContentProps {
  title: string
  headline: string
  description: string
  benefits: string[]
  howItWorks: string[]
  faqs: FaqItem[]
}

export default function ToolSeoContent({ title, headline, description, benefits, howItWorks, faqs }: ToolSeoContentProps) {
  if (Capacitor.isNativePlatform()) return null

  return (
    <section className="mt-16 border-t border-gray-100 dark:border-white/5 pt-10 space-y-10 max-w-3xl mx-auto">

      {/* Headline + Description */}
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-3">{headline}</h2>
        <p className="text-sm md:text-base text-gray-500 dark:text-zinc-400 leading-relaxed">{description}</p>
      </div>

      {/* Benefits */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-terracotta-500 mb-4">Why use {title}?</h3>
        <div className="grid gap-3">
          {benefits.map((b, i) => (
            <div key={i} className="flex gap-3 items-start p-4 bg-white dark:bg-zinc-900/60 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
              <span className="w-6 h-6 rounded-lg bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 flex items-center justify-center text-xs font-black shrink-0">{i + 1}</span>
              <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-terracotta-500 mb-4">How it works</h3>
        <div className="space-y-2">
          {howItWorks.map((step, i) => (
            <div key={i} className="flex gap-3 items-center">
              <div className="w-7 h-7 rounded-full bg-gray-900 dark:bg-white text-white dark:text-black flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</div>
              <p className="text-sm text-gray-600 dark:text-zinc-400">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-terracotta-500 mb-4">Frequently asked questions</h3>
        <div className="bg-white dark:bg-zinc-900/60 rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm">
          {faqs.map((faq, i) => (
            <details key={i} className={`group ${i < faqs.length - 1 ? 'border-b border-gray-50 dark:border-white/5' : ''}`}>
              <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors list-none flex justify-between items-center select-none">
                {faq.q}
                <span className="text-terracotta-500 text-base font-bold ml-3 shrink-0 group-open:hidden">+</span>
                <span className="text-terracotta-500 text-base font-bold ml-3 shrink-0 hidden group-open:inline">&minus;</span>
              </summary>
              <p className="px-5 pb-4 text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Bottom SEO text */}
      <p className="text-xs text-gray-400 dark:text-zinc-600 leading-relaxed">
        {title} by PaperKnife runs 100% in your browser. No files are uploaded to any server — your documents never leave your device. Free, private, and no account required.
      </p>
    </section>
  )
}
