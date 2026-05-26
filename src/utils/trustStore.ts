/**
 * PaperKnife - Trust store for Verify Signature (Phase 1, UIDAI only)
 * Copyright (C) 2026 kalki-kgp
 *
 * Privacy-first: trust anchors are pinned by SHA-256 fingerprint of the root
 * certificate's raw DER bytes. PaperKnife never fetches over the network to
 * resolve or refresh trust state. To add a root, paste its SHA-256 fingerprint
 * (hex, lowercase, no separators) into PINNED_ROOT_FINGERPRINTS_SHA256.
 *
 * Phase 1 scope: accept signatures whose signer identity matches UIDAI and
 * whose chain terminates at a pinned CCA-India root. Anything else fails
 * closed with a specific message.
 */

import { Certificate } from 'pkijs'
import { sha256Hex } from './pdfSignature'

/**
 * SHA-256 fingerprints of root certificates trusted for Phase 1.
 *
 * Source: https://cca.gov.in/root_certificate.html (downloaded as DER and
 * digested locally). Fingerprints are over the full DER-encoded
 * certificate (the same byte string that `openssl x509 -outform DER`
 * produces). To refresh, run:
 *   openssl x509 -in <root>.cer -outform DER | shasum -a 256
 *
 * Older roots are kept here because UIDAI e-Aadhaar PDFs issued before the
 * 2022 root rotation still chain to CCA India 2014 / 2015 SPL.
 */
export const PINNED_ROOT_FINGERPRINTS_SHA256: ReadonlySet<string> = new Set<string>([
  // CCA India 2011  (expired 11-Mar-2016, still pinned for archival PDFs)
  '2d66a702ae81ba03af8cff55ab318afa919039d9f31b4d64388680f81311b65a',
  // CCA India 2014  (expired 05-Mar-2024)
  '60109bc6c38328598a112c7a25e38b0f23e5a7511cb815fb64e0c4ff05db7df7',
  // CCA India 2015 SPL  (expired 29-Jan-2025)
  'c34c5df53080078ffe45b21a7f600469917204f4f0293f1d7209393e5265c04f',
  // CCA India 2022  (valid until 02-Feb-2042)
  '9a3fd3176798e842ddcb12c262f11cfacca70a8b84c6ea6fda30842a95a94cd8',
  // CCA India 2022 SPL  (valid until 20-Sep-2042)
  'b724689b79b2ef9421ef8f5cc733eb093851b170ee715177005a09f226d8c91a',
])

/**
 * Phase 1 signer identity allowlist — match against the signer certificate
 * Subject DN. UIDAI signs e-Aadhaar with a cert whose CN/O contains "UIDAI"
 * or the full agency name.
 */
const UIDAI_SUBJECT_PATTERNS: RegExp[] = [
  /\buidai\b/i,
  /\bunique identification authority of india\b/i,
]

export type SignerIdentity = 'uidai' | 'unknown'

export function classifySigner(signerCert: Certificate): SignerIdentity {
  const dn = stringifyRDN(signerCert.subject?.typesAndValues)
  for (const pattern of UIDAI_SUBJECT_PATTERNS) {
    if (pattern.test(dn)) return 'uidai'
  }
  return 'unknown'
}

export interface TrustResult {
  pinned: boolean
  rootFingerprint: string | null
}

export async function evaluateTrust(chain: Certificate[]): Promise<TrustResult> {
  if (chain.length === 0) return { pinned: false, rootFingerprint: null }
  const root = chain[chain.length - 1]
  const rootDer = new Uint8Array(root.toSchema(true).toBER(false))
  const fingerprint = await sha256Hex(rootDer)
  return {
    pinned: PINNED_ROOT_FINGERPRINTS_SHA256.has(fingerprint),
    rootFingerprint: fingerprint,
  }
}

export function stringifyRDN(typesAndValues: { type: string, value: { valueBlock: { value: string } } }[] | undefined): string {
  if (!typesAndValues) return ''
  return typesAndValues
    .map(tv => {
      const oid = tv.type
      const name = OID_TO_SHORT_NAME[oid] || oid
      const value = tv.value?.valueBlock?.value ?? ''
      return `${name}=${value}`
    })
    .join(', ')
}

const OID_TO_SHORT_NAME: Record<string, string> = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '1.2.840.113549.1.9.1': 'E',
}
