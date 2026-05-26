/**
 * PaperKnife - Verify Signature (Phase 1: offline UIDAI print copy)
 * Copyright (C) 2026 kalki-kgp
 *
 * Drops a signed PDF (e-Aadhaar today) -> verifies the embedded PKCS#7
 * signature offline -> produces a print-ready PDF with a visible validation
 * band/footer. Original page vectors are preserved via pdf-lib copyPages so
 * Aadhaar QR codes still scan from the printed copy.
 */

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSignature,
  Loader2,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import { toast } from 'sonner'

import { addActivity } from '../../utils/recentActivity'
import { usePipeline } from '../../utils/pipelineContext'
import { scanPdfSignatures } from '../../utils/pdfSignature'
import { verifySignature, CmsVerificationResult } from '../../utils/pkcs7'
import { inspectEmbeddedRevocation, EmbeddedRevocationStatus } from '../../utils/embeddedRevocation'
import { buildPrintReadyCopy } from '../../utils/pdfSignatureAppearance'
import { pdfHasEncryptionMarker, unlockPdf } from '../../utils/pdfHelpers'
import SuccessState from './shared/SuccessState'
import PrivacyBadge from './shared/PrivacyBadge'
import ToolSeoContent from './shared/ToolSeoContent'
import { NativeToolLayout } from './shared/NativeToolLayout'

type Status =
  | { kind: 'idle' }
  | { kind: 'analyzing' }
  | { kind: 'no-signature', message: string }
  | { kind: 'invalid', message: string, verification?: CmsVerificationResult }
  | { kind: 'valid', verification: CmsVerificationResult, revocation: EmbeddedRevocationStatus }

interface LoadedPdf {
  bytes: Uint8Array
  name: string
  isEncrypted: boolean
}

export default function VerifySignatureTool() {
  const { consumePipelineFile } = usePipeline()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<LoadedPdf | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [isBuilding, setIsBuilding] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [outputFileName, setOutputFileName] = useState('paperknife-verified')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const pipelined = consumePipelineFile()
    if (pipelined) {
      handleFileBytes(pipelined.buffer as Uint8Array, pipelined.name)
    }
  }, [])

  const handleFile = async (file: File) => {
    const buffer = await file.arrayBuffer()
    await handleFileBytes(new Uint8Array(buffer), file.name)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileBytes = async (bytes: Uint8Array, name: string) => {
    const isEncrypted = pdfHasEncryptionMarker(bytes)
    setLoaded({ bytes, name, isEncrypted })
    setStatus({ kind: 'analyzing' })
    setDownloadUrl(null)
    setPassword('')

    try {
      const scan = scanPdfSignatures(bytes)
      if (scan.signatures.length === 0) {
        setStatus({
          kind: 'no-signature',
          message: 'This PDF does not contain a digital signature. Verify Signature only works on PDFs that were already signed (e.g. e-Aadhaar, ITR, GST).',
        })
        return
      }

      const sig = scan.signatures[0]
      const verification = await verifySignature({
        pkcs7Der: sig.pkcs7Der,
        signedBytes: sig.signedBytes,
        subFilter: sig.subFilter,
        certs: sig.certs,
        signatureCount: scan.signatures.length,
      })
      const revocation = inspectEmbeddedRevocation(sig.pkcs7Der)

      // 'cryptographic' / 'cryptographic-pinned' / 'structural' all allow
      // the print copy to be produced. 'failed' blocks it.
      if (verification.mode === 'failed') {
        setStatus({
          kind: 'invalid',
          message: verification.error
            || 'Signature math failed. The document may have been modified after it was signed.',
          verification,
        })
        return
      }

      if (verification.signerIdentity !== 'uidai') {
        setStatus({
          kind: 'invalid',
          message: 'Signer is not on PaperKnife\'s Phase 1 trust list (UIDAI only). Phase 2 will broaden the trust store to all CCA-licensed CAs.',
          verification,
        })
        return
      }

      setStatus({ kind: 'valid', verification, revocation })
      const safeName = name.replace(/\.pdf$/i, '') || 'document'
      setOutputFileName(`${safeName}-verified`)
    } catch (err) {
      setStatus({
        kind: 'invalid',
        message: `Could not analyze signature: ${(err as Error).message}`,
      })
    }
  }

  const handleBuildPrintCopy = async () => {
    if (!loaded || status.kind !== 'valid') return
    if (loaded.isEncrypted && !password) {
      toast.error('Enter the PDF password to produce a print copy.')
      return
    }
    setIsBuilding(true)
    try {
      if (loaded.isEncrypted && password) {
        const unlocked = await unlockPdf(
          new File([loaded.bytes as BlobPart], loaded.name, { type: 'application/pdf' }),
          password,
        )
        if (!unlocked.success) {
          toast.error('Incorrect password.')
          setIsBuilding(false)
          return
        }
      }
      const result = await buildPrintReadyCopy(loaded.bytes, {
        signerLabel: 'UIDAI',
        signingTime: status.verification.signingTime,
        trustLabel: trustLabelFor(status.verification),
        password: loaded.isEncrypted || password ? password : undefined,
      })
      const blob = new Blob([result.bytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      addActivity({
        name: `${outputFileName}.pdf`,
        tool: 'Verify Signature',
        size: blob.size,
        resultUrl: url,
      })
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('encrypted')) {
        // pdf-lib detected encryption we missed in the initial scan —
        // tell the user to enter the password and retry.
        setLoaded(loaded ? { ...loaded, isEncrypted: true } : loaded)
        toast.error('PDF is password-protected. Enter the password and try again.')
      } else {
        toast.error(`Failed to build print copy: ${msg}`)
      }
    } finally {
      setIsBuilding(false)
    }
  }

  const resetAll = () => {
    setLoaded(null)
    setStatus({ kind: 'idle' })
    setDownloadUrl(null)
    setIsBuilding(false)
    setPassword('')
  }

  const ActionButton = () =>
    status.kind === 'valid' && !downloadUrl ? (
      <button
        onClick={handleBuildPrintCopy}
        disabled={isBuilding}
        className="w-full bg-terracotta-500 hover:bg-terracotta-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-terracotta-500/20 p-5 md:p-6 rounded-2xl md:rounded-3xl text-sm md:text-lg"
      >
        {isBuilding ? <Loader2 className="animate-spin" /> : (<>Validate &amp; Create Print Copy <ArrowRight size={18} /></>)}
      </button>
    ) : null

  return (
    <NativeToolLayout
      title="Verify Signature"
      description="Validate the digital signature on an e-Aadhaar / signed PDF offline, then download a print-ready copy."
      actions={!downloadUrl ? <ActionButton /> : null}
    >
      <input
        type="file"
        accept=".pdf"
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {!loaded ? (
        <DropZone onPick={() => fileInputRef.current?.click()} />
      ) : downloadUrl ? (
        <SuccessState
          message="Print copy ready. Print and submit."
          downloadUrl={downloadUrl}
          fileName={`${outputFileName}.pdf`}
          onStartOver={resetAll}
        />
      ) : (
        <div className="space-y-6">
          <FileBanner name={loaded.name} byteCount={loaded.bytes.length} isEncrypted={loaded.isEncrypted} onClear={resetAll} />
          <StatusCard status={status} />
          {status.kind === 'valid' && loaded.isEncrypted && (
            <PasswordInput value={password} onChange={setPassword} />
          )}
          {status.kind === 'valid' && (
            <OutputNameInput value={outputFileName} onChange={setOutputFileName} />
          )}
        </div>
      )}

      <ToolSeoContent
        title="Verify Signature"
        headline="Verify e-Aadhaar and CCA-signed PDFs offline"
        description="PaperKnife checks the PKCS#7 digital signature on PDFs signed by Indian government agencies (UIDAI today, more in upcoming releases) and produces a print-ready copy with verification clearly marked on every page. The verification runs entirely in your browser — your file is never uploaded."
        benefits={[
          'No Adobe Acrobat. No clicking through trust dialogs. One click to validate and download a print-ready copy.',
          'Designed for the Indian e-Aadhaar -> passport / KYC submission workflow.',
          'Original page content is copied as vectors, so Aadhaar QR codes still scan from the printed copy.',
          'Offline-only: PaperKnife never contacts OCSP, CRL, or any external server while verifying.',
        ]}
        howItWorks={[
          'Drop the signed PDF you downloaded from UIDAI.',
          'PaperKnife extracts the embedded signature and checks it against the file bytes.',
          'If the signature is valid and the signer is UIDAI, click "Validate & Create Print Copy".',
          'Download the new PDF, print it, and submit.',
        ]}
        faqs={[
          {
            q: 'Why do I need this?',
            a: 'Indian passport / KYC offices often require the printed e-Aadhaar to show the digital signature as "validated" rather than "validity unknown". That label is added by the reader after you trust the signer certificate. PaperKnife produces a print-ready copy that explicitly shows verification on every page.',
          },
          {
            q: 'Does it work with files other than e-Aadhaar?',
            a: 'Phase 1 only accepts signatures from UIDAI. Phase 2 will expand the trust store to ITR (Income Tax Department), GST, NSDL, EPFO, eMudhra, Sify, and other CCA-licensed CAs.',
          },
          {
            q: 'Are you uploading my Aadhaar?',
            a: 'No. PaperKnife runs entirely in your browser. The signature math and the print copy are produced locally. No file or signature bytes leave your device.',
          },
          {
            q: 'Does the printed copy stay legally equivalent to the digital signature?',
            a: 'The print copy preserves the original document content and adds a visible verification band/footer attesting that PaperKnife checked the signature. Whether a particular office accepts this depends on their policy.',
          },
        ]}
      />
      <PrivacyBadge />
    </NativeToolLayout>
  )
}

function DropZone({ onPick }: { onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="w-full border-2 border-dashed border-terracotta-300 dark:border-terracotta-800 rounded-[2.5rem] p-12 md:p-16 text-center bg-white dark:bg-zinc-900/60 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/10 hover:border-terracotta-400 transition-all cursor-pointer group shadow-clay-sm dark:shadow-none"
    >
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-terracotta-50 text-terracotta-500 flex items-center justify-center">
        <FileSignature size={28} strokeWidth={2} />
      </div>
      <h3 className="text-xl font-bold dark:text-white mb-2">Drop a signed PDF</h3>
      <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
        Phase 1: optimized for UIDAI-signed e-Aadhaar. PaperKnife verifies the signature offline and produces a print-ready copy.
      </p>
    </button>
  )
}

function FileBanner({ name, byteCount, isEncrypted, onClear }: { name: string, byteCount: number, isEncrypted: boolean, onClear: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 md:p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-black text-gray-900 dark:text-white truncate">{name}</p>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
          {(byteCount / (1024 * 1024)).toFixed(2)} MB · PDF{isEncrypted ? ' · Encrypted' : ''}
        </p>
      </div>
      <button
        onClick={onClear}
        className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-terracotta-500 transition-colors px-3 py-2"
      >
        Close
      </button>
    </div>
  )
}

function PasswordInput({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 px-1">
        PDF Password
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        placeholder="Required for encrypted PDFs"
        className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-terracotta-500 outline-none font-bold text-sm dark:text-white"
      />
      <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
        For e-Aadhaar this is the first 4 letters of your name (capitalised) plus your year of birth, e.g. <span className="font-mono">RAVI1984</span>. The password is used locally — it never leaves your device.
      </p>
    </div>
  )
}

function OutputNameInput({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 px-1">
        Output Filename
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-50 dark:bg-black rounded-xl px-4 py-3 border border-transparent focus:border-terracotta-500 outline-none font-bold text-sm dark:text-white"
      />
    </div>
  )
}

function StatusCard({ status }: { status: Status }) {
  if (status.kind === 'analyzing') {
    return (
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 flex items-center gap-4 shadow-sm">
        <Loader2 className="animate-spin text-terracotta-500" size={22} />
        <p className="text-sm font-bold text-gray-700 dark:text-zinc-300">Verifying signature…</p>
      </div>
    )
  }

  if (status.kind === 'no-signature') {
    return <BadCard icon={<ShieldOff size={22} />} title="No signature found" body={status.message} tone="muted" />
  }

  if (status.kind === 'invalid') {
    return (
      <BadCard
        icon={<AlertTriangle size={22} />}
        title="Signature not accepted"
        body={status.message}
        tone="danger"
        details={status.verification ? <ChainDetails verification={status.verification} /> : null}
      />
    )
  }

  if (status.kind === 'valid') {
    return (
      <GoodCard verification={status.verification} revocation={status.revocation} />
    )
  }

  return null
}

function GoodCard({ verification, revocation }: { verification: CmsVerificationResult, revocation: EmbeddedRevocationStatus }) {
  const signer = verification.chain[0]
  const root = verification.chain[verification.chain.length - 1]
  const isStructural = verification.mode === 'structural'
  const tone = isStructural
    ? 'border-amber-200/70 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10'
    : 'border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/10'
  const accentBg = isStructural ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  const titleColor = isStructural ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
  const titleText = isStructural
    ? 'Signature present · UIDAI · structural only'
    : verification.mode === 'cryptographic-pinned'
      ? 'Signature valid · UIDAI · matched bundled key'
      : 'Signature valid · UIDAI'

  return (
    <div className={`p-5 md:p-6 rounded-3xl border shadow-sm ${tone}`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${accentBg}`}>
          <ShieldCheck size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className={titleColor} />
            <p className={`text-[10px] font-black uppercase tracking-widest ${titleColor}`}>
              {titleText}
            </p>
          </div>
          <p className="text-sm font-bold leading-snug">
            {signer?.subjectDN || verification.modeNote || 'Signer details unavailable'}
          </p>
          <p className="text-xs opacity-80 mt-1">
            {verification.signatureAlgorithm || 'unknown algorithm'} · digest {verification.digestAlgorithm || 'unknown'}
            {verification.signingTime ? ` · signed ${verification.signingTime.toUTCString()}` : ''}
          </p>
          {!signer && verification.modeNote && (
            <p className="text-xs opacity-90 mt-3 leading-relaxed">{verification.modeNote}</p>
          )}

          {signer && (
            <dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <DetailRow label="Issuer" value={signer.issuerDN || '—'} />
              <DetailRow label="Root" value={root?.subjectDN || '—'} />
              <DetailRow
                label="Root fingerprint (SHA-256)"
                value={verification.rootFingerprint || '—'}
                mono
              />
              <DetailRow
                label="Pinned"
                value={verification.trustPinned ? 'yes (CCA India pinned)' : 'no — cryptographic check only'}
              />
              <DetailRow label="Embedded OCSP responses" value={String(revocation.ocspResponseCount)} />
              <DetailRow label="Embedded CRLs" value={String(revocation.crlCount)} />
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}

function trustLabelFor(verification: CmsVerificationResult): string {
  switch (verification.mode) {
    case 'cryptographic-pinned':
      return 'Trust: matched bundled UIDAI key'
    case 'cryptographic':
      return verification.trustPinned ? 'Trust: CCA India (pinned)' : 'Trust: cryptographically valid'
    case 'structural':
      return 'Trust: structural validation only'
    default:
      return 'Trust: unverified'
  }
}

function BadCard({
  icon,
  title,
  body,
  tone,
  details,
}: {
  icon: React.ReactNode
  title: string
  body: string
  tone: 'danger' | 'muted'
  details?: React.ReactNode
}) {
  const toneStyle = tone === 'danger'
    ? 'border-rose-200/70 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-900/10 text-rose-700 dark:text-rose-300'
    : 'border-gray-200/70 dark:border-white/5 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300'
  return (
    <div className={`p-5 md:p-6 rounded-3xl border ${toneStyle} shadow-sm`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tone === 'danger' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest mb-1">
            {title}
          </p>
          <p className="text-sm font-bold leading-snug">{body}</p>
          {details}
        </div>
      </div>
    </div>
  )
}

function ChainDetails({ verification }: { verification: CmsVerificationResult }) {
  const hasChain = verification.chain.length > 0
  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest opacity-70 hover:opacity-100">
        Show technical details
      </summary>
      <div className="mt-3 text-xs opacity-90 space-y-3">
        <div className="border-t border-current/10 pt-2">
          <p className="font-black">Signature envelope</p>
          {verification.debug.subFilter && (
            <p className="mt-1"><span className="opacity-60">SubFilter:</span> /{verification.debug.subFilter}</p>
          )}
          {typeof verification.debug.signatureCount === 'number' && (
            <p><span className="opacity-60">Signatures in PDF:</span> {verification.debug.signatureCount}</p>
          )}
          <p><span className="opacity-60">Detected envelope:</span> {verification.debug.envelope}</p>
          <p><span className="opacity-60">/Contents length:</span> {verification.debug.derLength} bytes</p>
          <p className="font-mono break-all"><span className="opacity-60 font-sans">First 32 bytes:</span> {verification.debug.derPrefixHex || '(empty)'}</p>
        </div>
        {hasChain && verification.chain.map((cert, i) => (
          <div key={cert.sha256Fingerprint} className="border-t border-current/10 pt-2">
            <p className="font-black">{i === 0 ? 'Signer' : i === verification.chain.length - 1 ? 'Root' : `Intermediate ${i}`}</p>
            <p className="mt-1"><span className="opacity-60">Subject:</span> {cert.subjectDN}</p>
            <p><span className="opacity-60">Issuer:</span> {cert.issuerDN}</p>
            <p className="font-mono break-all"><span className="opacity-60 font-sans">SHA-256:</span> {cert.sha256Fingerprint}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

function DetailRow({ label, value, mono }: { label: string, value: string, mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</dt>
      <dd className={`text-xs font-semibold break-all ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
