/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState, useRef, useEffect } from 'react'
import { ShieldCheck, Loader2, ArrowRight, X, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Capacitor } from '@capacitor/core'
import { getPdfMetaData } from '../../utils/pdfHelpers'
import { addActivity } from '../../utils/recentActivity'
import { usePipeline } from '../../utils/pipelineContext'
import { useObjectURL } from '../../utils/useObjectURL'
import {
  EncryptedPdfNeedsPasswordError,
  createValidationPrintCopy,
  sha256Hex
} from '../../utils/signature/pdfSignatureAppearance'
import { pdfHasEncryption } from '../../utils/signature/pdfSignature'
import {
  failureMessage,
  verifyUidaiPdfSignature
} from '../../utils/signature/verifyUidaiSignature'
import type { SignatureFailureReason, VerifiedSignatureInfo } from '../../utils/signature/types'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'
import ToolSeoContent from './shared/ToolSeoContent'
import { NativeToolLayout } from './shared/NativeToolLayout'

type PdfFileState = {
  file: File
  rawBytes: Uint8Array
  thumbnail?: string
  pageCount: number
  isLocked: boolean
}

export default function VerifySignatureTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { consumePipelineFile } = usePipeline()
  const { objectUrl, createUrl, clearUrls } = useObjectURL()
  const [pdfData, setPdfData] = useState<PdfFileState | null>(null)
  const [needsVerifyPassword, setNeedsVerifyPassword] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [copyPassword, setCopyPassword] = useState('')
  const [verifyPassword, setVerifyPassword] = useState('')
  const [verification, setVerification] = useState<VerifiedSignatureInfo | null>(null)
  const [failure, setFailure] = useState<SignatureFailureReason | null>(null)
  const [failureDetail, setFailureDetail] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('paperknife-verified-print')
  const isNative = Capacitor.isNativePlatform()

  useEffect(() => {
    const pipelined = consumePipelineFile()
    if (pipelined) {
      const file = new File([new Uint8Array(pipelined.buffer)], pipelined.name, { type: 'application/pdf' })
      void loadFile(file)
    }
  }, [])

  const loadFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) return
    const buffer = await file.arrayBuffer()
    const rawBytes = new Uint8Array(buffer)
    const meta = await getPdfMetaData(file)
    setPdfData({
      file,
      rawBytes,
      thumbnail: meta.thumbnail,
      pageCount: meta.pageCount,
      isLocked: meta.isLocked
    })
    setNeedsVerifyPassword(meta.isLocked || pdfHasEncryption(rawBytes))
    setCustomFileName(`${file.name.replace(/\.pdf$/i, '')}-verified-print`)
    setVerification(null)
    setFailure(null)
    setFailureDetail(null)
    setCopyPassword('')
    setVerifyPassword('')
    clearUrls()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) void loadFile(e.target.files[0])
    if (e.target) e.target.value = ''
  }

  const runVerification = async () => {
    if (!pdfData) return
    setIsVerifying(true)
    setVerification(null)
    setFailure(null)
    setFailureDetail(null)
    try {
      const result = await verifyUidaiPdfSignature(
        pdfData.rawBytes,
        verifyPassword.trim() ? verifyPassword : undefined
      )
      if (!result.ok) {
        setFailure(result.reason)
        setFailureDetail(result.message)
        toast.error(result.message || failureMessage(result.reason))
        return
      }
      setVerification(result.info)
      toast.success('UIDAI signature verified offline.')
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Could not verify signature offline.'
      setFailure('unsupported-signature')
      setFailureDetail(detail)
      toast.error(detail)
    } finally {
      setIsVerifying(false)
    }
  }

  const createPrintCopy = async () => {
    if (!pdfData || !verification) return
    setIsProcessing(true)
    try {
      const inputSha256 = await sha256Hex(pdfData.rawBytes)
      const output = await createValidationPrintCopy(
        pdfData.rawBytes,
        {
          verified: true,
          signerLabel: verification.signerSubject || 'UIDAI signer',
          signedAt: verification.signingTime,
          inputSha256,
          revocationNote: verification.revocation.offlineNote
        },
        pdfData.isLocked ? copyPassword : undefined
      )
      const blob = new Blob([new Uint8Array(output)], { type: 'application/pdf' })
      const url = createUrl(blob)
      addActivity({
        name: `${customFileName || 'verified-print'}.pdf`,
        tool: 'Verify Signature',
        size: blob.size,
        resultUrl: url
      })
      toast.success('UIDAI signature verified offline. Print-ready copy created.')
    } catch (err) {
      if (err instanceof EncryptedPdfNeedsPasswordError) {
        setFailure('encrypted-copy-needs-password')
        toast.error(failureMessage('encrypted-copy-needs-password'))
      } else {
        toast.error('Failed to create print copy.')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const ActionButton = () => (
    <button
      onClick={createPrintCopy}
      disabled={isProcessing || !verification}
      className={`w-full bg-terracotta-500 hover:bg-terracotta-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-terracotta-500/20 ${isNative ? 'py-4 rounded-2xl text-sm' : 'p-6 rounded-3xl text-xl'}`}
    >
      {isProcessing ? (
        <>
          <Loader2 className="animate-spin" /> Creating print copy...
        </>
      ) : (
        <>
          Validate & Create Print Copy <ArrowRight size={18} />
        </>
      )}
    </button>
  )

  return (
    <NativeToolLayout
      title="Verify Signature"
      description="Offline UIDAI/e-Aadhaar signature validation with a print-ready validation band. No uploads."
      actions={pdfData && verification && !objectUrl ? <ActionButton /> : undefined}
    >
      <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />

      {!pdfData ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-terracotta-300 dark:border-terracotta-800 rounded-[2.5rem] p-12 md:p-16 text-center bg-white dark:bg-zinc-900/60 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/10 hover:border-terracotta-400 transition-all cursor-pointer group shadow-clay-sm dark:shadow-none"
        >
          <div className="w-20 h-20 bg-terracotta-50 dark:bg-terracotta-900/20 text-terracotta-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
            <ShieldCheck size={32} />
          </div>
          <h3 className="text-xl font-bold dark:text-white mb-2">Select signed PDF</h3>
          <p className="text-sm text-gray-400 font-medium">Use the original signed e-Aadhaar PDF — not an Unlock PDF copy</p>
          <span className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-terracotta-500 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-terracotta-500/20 group-hover:shadow-xl group-hover:scale-105 transition-all">
            Choose File
          </span>
        </button>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 flex items-center gap-6">
            <div className="w-16 h-20 bg-gray-50 dark:bg-black rounded-xl overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-terracotta-500">
              {pdfData.thumbnail ? (
                <img src={pdfData.thumbnail} className="w-full h-full object-cover" alt="" />
              ) : (
                <ShieldCheck size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate dark:text-white">{pdfData.file.name}</h3>
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                {pdfData.pageCount} Pages • {(pdfData.file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
            <button
              onClick={() => {
                setPdfData(null)
                setVerification(null)
                setFailure(null)
                setFailureDetail(null)
                clearUrls()
              }}
              className="p-2 text-gray-400 hover:text-terracotta-500 transition-colors"
              aria-label="Remove file"
            >
              <X size={20} />
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-100 dark:border-white/5 space-y-6 shadow-sm">
            {!objectUrl ? (
              <>
                {needsVerifyPassword && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-widest">
                      <Lock size={14} /> e-Aadhaar password (required for verification)
                    </div>
                    <input
                      type="password"
                      value={verifyPassword}
                      onChange={(e) => setVerifyPassword(e.target.value)}
                      placeholder="Enter e-Aadhaar PDF password"
                      className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-terracotta-500 outline-none font-bold text-sm dark:text-white"
                    />
                  </div>
                )}

                <button
                  onClick={() => void runVerification()}
                  disabled={isVerifying || (needsVerifyPassword && !verifyPassword.trim())}
                  className="w-full bg-zinc-900 dark:bg-zinc-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifying ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                  {isVerifying ? 'Verifying offline...' : 'Verify UIDAI Signature Offline'}
                </button>

                {failure && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                      {failureDetail || failureMessage(failure)}
                    </p>
                  </div>
                )}

                {verification && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">UIDAI signature verified offline</span>
                    </div>
                    <p className="text-xs text-emerald-800 dark:text-emerald-200">
                      Signer: {verification.signerSubject || 'UIDAI'}
                    </p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-200">
                      {verification.signingTime
                        ? `Signed: ${verification.signingTime.toISOString()}`
                        : 'Signing time unavailable'}
                    </p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-200">{verification.revocation.offlineNote}</p>
                  </div>
                )}

                {pdfData.isLocked && verification && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-widest">
                      <Lock size={14} /> Same password for print copy (if different, re-enter below)
                    </div>
                    <input
                      type="password"
                      value={copyPassword || verifyPassword}
                      onChange={(e) => setCopyPassword(e.target.value)}
                      placeholder="PDF password"
                      className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-terracotta-500 outline-none font-bold text-sm dark:text-white"
                    />
                  </div>
                )}

                {!isNative && verification && <ActionButton />}
              </>
            ) : (
              <SuccessState
                message="Print-ready copy created"
                downloadUrl={objectUrl}
                fileName={`${customFileName || 'verified-print'}.pdf`}
                onStartOver={() => {
                  clearUrls()
                  setVerification(null)
                  setFailure(null)
                  setFailureDetail(null)
                  setCopyPassword('')
                }}
              />
            )}

            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex items-start gap-3">
              <Lock size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                Password-protected e-Aadhaar is fine. Do not run Unlock PDF first — it rebuilds the document and removes the digital signature. Verify here, then enter the password only when creating a print copy.
              </p>
            </div>

            <PrivacyBadge />
          </div>
        </div>
      )}

      <ToolSeoContent
        title="Verify Signature"
        headline="Offline UIDAI e-Aadhaar Signature Validation"
        description="Validate UIDAI digital signatures entirely on your device and download a print-ready copy with a PaperKnife validation band. No OCSP/CRL network calls."
        benefits={[
          'Byte-range PKCS#7 verification against pinned CCA India roots',
          'UIDAI signer identity checks for Phase 1 e-Aadhaar',
          'Vector print copy with validation footer (input SHA-256)',
          'Embedded OCSP/CRL parsed when present — never fetched live'
        ]}
        howItWorks={[
          'Drop or select a signed e-Aadhaar PDF — signature extraction stays byte-based.',
          'PaperKnife verifies the detached CMS signature and UIDAI signer identity offline.',
          'Create a print copy with a vector validation band; footer hash is the original input file SHA-256.'
        ]}
        faqs={[
          {
            q: 'Does this make Adobe Acrobat show a green trust badge?',
            a: 'No. The output is a verified print copy for submission and printing. External reader trust remains local to each PDF viewer.'
          },
          {
            q: 'Are revocation checks performed online?',
            a: 'No. PaperKnife only parses OCSP/CRL evidence already embedded in the PDF/CMS. Missing evidence does not fail Phase 1 UIDAI validation.'
          }
        ]}
      />
    </NativeToolLayout>
  )
}
