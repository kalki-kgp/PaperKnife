/**
 * PaperKnife - Feedback & Contact
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useMemo, useState } from 'react'
import { Bug, Building2, CheckCircle2, Clipboard, Github, Lightbulb, Mail, MessageSquare, Send, ShieldCheck } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Tool } from '../types'
import { NativeToolLayout } from './tools/shared/NativeToolLayout'

type FeedbackType = 'enterprise' | 'bug' | 'tool' | 'general'

const CONTACT_EMAIL = 'krishnapaikine777@gmail.com'
const GITHUB_ISSUE_URL = 'https://github.com/kalki-kgp/PaperKnife/issues/new'

const feedbackOptions: Record<FeedbackType, {
  label: string
  title: string
  description: string
  icon: typeof MessageSquare
  subject: string
  detailsPlaceholder: string
}> = {
  enterprise: {
    label: 'Self-hosted',
    title: 'Self-hosted PaperKnife',
    description: 'Deployment, licensing, branding, support, and compliance questions.',
    icon: Building2,
    subject: 'PaperKnife Enterprise Inquiry',
    detailsPlaceholder: 'Tell me about your organization, expected users, deployment environment, compliance needs, and timeline.'
  },
  bug: {
    label: 'Bug report',
    title: 'Report a problem',
    description: 'Broken tools, confusing output, browser issues, or app crashes.',
    icon: Bug,
    subject: 'PaperKnife Bug Report',
    detailsPlaceholder: 'What happened? Which tool were you using? What browser/device? What did you expect instead?'
  },
  tool: {
    label: 'Tool request',
    title: 'Request a PDF tool',
    description: 'Ask for a missing workflow or improvement to an existing tool.',
    icon: Lightbulb,
    subject: 'PaperKnife Tool Request',
    detailsPlaceholder: 'What tool do you need? What input/output should it support? How would you use it?'
  },
  general: {
    label: 'General',
    title: 'Contact maintainer',
    description: 'Questions, feedback, privacy concerns, or anything else.',
    icon: MessageSquare,
    subject: 'PaperKnife Feedback',
    detailsPlaceholder: 'Share what you want me to know.'
  }
}

const normalizeFeedbackType = (value: string | null): FeedbackType => {
  if (value === 'enterprise' || value === 'bug' || value === 'tool' || value === 'general') return value
  return 'general'
}

const compact = (value: string) => value.trim().replace(/\s+/g, ' ')

const fieldClass = 'w-full rounded-2xl border border-orange-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/10 placeholder:text-gray-400 dark:placeholder:text-zinc-600'

export default function Feedback({ tools }: { tools: Tool[] }) {
  const [searchParams] = useSearchParams()
  const initialType = normalizeFeedbackType(searchParams.get('type'))
  const initialTool = searchParams.get('tool') || ''
  const initialQuery = searchParams.get('query') || ''

  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialType)
  const [relatedTool, setRelatedTool] = useState(initialTool)
  const [summary, setSummary] = useState(initialQuery ? `Request: ${initialQuery}` : '')
  const [details, setDetails] = useState('')
  const [contact, setContact] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setFeedbackType(initialType)
    setRelatedTool(initialTool)
    if (initialQuery) setSummary(`Request: ${initialQuery}`)
  }, [initialType, initialTool, initialQuery])

  const activeOption = feedbackOptions[feedbackType]

  const messageBody = useMemo(() => {
    const lines = [
      `Feedback type: ${activeOption.label}`,
      relatedTool ? `Related tool: ${relatedTool}` : '',
      summary ? `Summary: ${compact(summary)}` : '',
      '',
      'Details:',
      details.trim() || '(not provided)',
      '',
      contact.trim() ? `Contact: ${contact.trim()}` : 'Contact: (not provided)',
      '',
      `Page: ${typeof window !== 'undefined' ? window.location.href : '/feedback'}`,
      `User agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`
    ]
    return lines.filter((line, index) => line !== '' || lines[index - 1] !== '').join('\n')
  }, [activeOption.label, contact, details, relatedTool, summary])

  const subject = useMemo(() => {
    const cleanSummary = compact(summary)
    if (cleanSummary) return `${activeOption.subject}: ${cleanSummary}`.slice(0, 140)
    if (relatedTool) return `${activeOption.subject}: ${relatedTool}`.slice(0, 140)
    return activeOption.subject
  }, [activeOption.subject, relatedTool, summary])

  const emailUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageBody)}`
  const githubUrl = `${GITHUB_ISSUE_URL}?title=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageBody)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${messageBody}`)
      setCopied(true)
      toast.success('Feedback copied')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Copy failed. Select the text and copy it manually.')
    }
  }

  const handleEmail = () => {
    window.location.href = emailUrl
  }

  const handleGitHub = () => {
    window.open(githubUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <NativeToolLayout
      title="Feedback"
      description="Send a tool request, bug report, or self-hosted deployment inquiry without adding a server to PaperKnife."
      actions={null}
    >
      <div className="max-w-5xl mx-auto w-full space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-3 duration-500">
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-clay dark:shadow-none p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(feedbackOptions) as FeedbackType[]).map((type) => {
                const option = feedbackOptions[type]
                const Icon = option.icon
                const isActive = feedbackType === type
                return (
                  <button
                    key={type}
                    onClick={() => setFeedbackType(type)}
                    className={`min-h-24 rounded-2xl border p-3 text-left transition-all ${
                      isActive
                        ? 'border-terracotta-500 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-600 dark:text-terracotta-400 shadow-sm'
                        : 'border-orange-100 dark:border-zinc-800 bg-[#FFF9F7] dark:bg-black text-gray-500 hover:border-terracotta-200 hover:text-terracotta-500'
                    }`}
                  >
                    <Icon size={20} className="mb-3" />
                    <span className="block text-[11px] font-black uppercase tracking-widest">{option.label}</span>
                  </button>
                )
              })}
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Related Tool</label>
              <select value={relatedTool} onChange={(e) => setRelatedTool(e.target.value)} className={fieldClass}>
                <option value="">No specific tool</option>
                {tools.map((tool) => (
                  <option key={tool.title} value={tool.title}>{tool.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Short Summary</label>
              <input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={activeOption.title}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Details</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={activeOption.detailsPlaceholder}
                rows={8}
                className={`${fieldClass} resize-y leading-relaxed`}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Contact Email or Name</label>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Optional, but helpful if you want a reply"
                className={fieldClass}
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[2rem] bg-zinc-900 text-white p-6 md:p-8 border border-white/10 shadow-clay dark:shadow-none">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-terracotta-300 mb-5">
                <ShieldCheck size={13} />
                Static handoff
              </div>
              <h2 className="text-2xl font-black tracking-tight mb-3">{activeOption.title}</h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">{activeOption.description}</p>
              <div className="space-y-3">
                <button
                  onClick={handleEmail}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-terracotta-500 px-5 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-terracotta-500/25 transition-all hover:-translate-y-0.5 hover:bg-terracotta-600 active:scale-95"
                >
                  <Mail size={16} />
                  Open Email
                </button>
                {(feedbackType === 'bug' || feedbackType === 'tool') && (
                  <button
                    onClick={handleGitHub}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-900 transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    <Github size={16} />
                    Open GitHub Issue
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 active:scale-95"
                >
                  {copied ? <CheckCircle2 size={16} /> : <Clipboard size={16} />}
                  {copied ? 'Copied' : 'Copy Details'}
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] bg-accent-yellow dark:bg-zinc-900 border border-orange-100 dark:border-zinc-800 p-6 shadow-clay-sm dark:shadow-none">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-main dark:text-white mb-2">No files are sent</h3>
                  <p className="text-xs text-text-muted dark:text-zinc-400 leading-relaxed">
                    This page only prepares your message. Email and GitHub open outside PaperKnife, so the app keeps its no-backend, no-upload promise.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] bg-white dark:bg-zinc-900 border border-orange-100 dark:border-zinc-800 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Preview</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-gray-50 dark:bg-black p-4 text-[11px] leading-relaxed text-gray-500 dark:text-zinc-400">{messageBody}</pre>
            </div>
          </aside>
        </section>
      </div>
    </NativeToolLayout>
  )
}
