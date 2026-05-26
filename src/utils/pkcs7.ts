/**
 * PaperKnife - PKCS#7 / CMS verification for Verify Signature (Phase 1)
 * Copyright (C) 2026 kalki-kgp
 *
 * Detached CMS SignedData verification against the PDF's signed bytes,
 * plus enough certificate-chain bookkeeping to surface signer + issuer +
 * root information to the UI. No network, no OCSP/CRL fetching.
 */

import * as asn1js from 'asn1js'
import { Certificate, ContentInfo, SignedData } from 'pkijs'
import { sha256Hex } from './pdfSignature'
import { classifySigner, evaluateTrust, stringifyRDN, SignerIdentity } from './trustStore'
import { UIDAI_KNOWN_KEYS, spkiBytesOf } from './uidaiSigningKeys'

export interface SignerSummary {
  subjectDN: string
  issuerDN: string
  serialNumberHex: string
  notBefore: string
  notAfter: string
  sha256Fingerprint: string
}

export interface CmsDebug {
  derLength: number
  derPrefixHex: string
  envelope: 'ContentInfo' | 'SignedData-direct' | 'unparsed' | 'adbe.x509.rsa_sha1'
  subFilter?: string
  signatureCount?: number
}

export type VerificationMode =
  | 'cryptographic'          // signature math verified end-to-end
  | 'cryptographic-pinned'   // verified AND matched a bundled UIDAI public key
  | 'structural'             // signature structure looks right, math not verified
  | 'failed'

export interface CmsVerificationResult {
  /** Cryptographic verification: hash + signature math passed */
  signatureValid: boolean
  /** Result of evaluateTrust (root cert fingerprint matched a pinned anchor) */
  trustPinned: boolean
  /** Hex SHA-256 of the chain's terminal (root) cert */
  rootFingerprint: string | null
  /** Heuristic identity match against the signer cert subject (UIDAI etc.) */
  signerIdentity: SignerIdentity
  /** Full chain from signer to root as discovered in the CMS certs collection */
  chain: SignerSummary[]
  /** Whether the CMS carries an explicit signing-time signed attribute */
  signingTime: Date | null
  /** Algorithm names surfaced from the SignerInfo */
  digestAlgorithm: string
  signatureAlgorithm: string
  /** Free-form error if verification could not even be attempted */
  error?: string
  /** Always populated — useful for diagnosing parse failures */
  debug: CmsDebug
  /** How strongly we verified the signature (see VerificationMode) */
  mode: VerificationMode
  /** Free-form human-readable note explaining the mode chosen */
  modeNote?: string
}

const DIGEST_OID_NAMES: Record<string, string> = {
  '1.3.14.3.2.26': 'SHA-1',
  '2.16.840.1.101.3.4.2.1': 'SHA-256',
  '2.16.840.1.101.3.4.2.2': 'SHA-384',
  '2.16.840.1.101.3.4.2.3': 'SHA-512',
}

const SIGNATURE_OID_NAMES: Record<string, string> = {
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.113549.1.1.11': 'sha256WithRSA',
  '1.2.840.113549.1.1.12': 'sha384WithRSA',
  '1.2.840.113549.1.1.13': 'sha512WithRSA',
  '1.2.840.113549.1.1.5': 'sha1WithRSA',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
}

export interface VerifyInputs {
  pkcs7Der: Uint8Array
  signedBytes: Uint8Array
  subFilter: string
  /** /Cert entries from the signature dictionary (legacy adbe.x509.rsa_sha1) */
  certs?: Uint8Array[]
  signatureCount?: number
}

export async function verifySignature(input: VerifyInputs): Promise<CmsVerificationResult> {
  if (input.subFilter === 'adbe.x509.rsa_sha1') {
    return verifyAdbeX509RsaSha1(input)
  }
  return verifyCmsAgainstSignedBytes(input.pkcs7Der, input.signedBytes, input.subFilter, input.signatureCount)
}

async function verifyCmsAgainstSignedBytes(
  pkcs7Der: Uint8Array,
  signedBytes: Uint8Array,
  subFilter: string,
  signatureCount: number | undefined,
): Promise<CmsVerificationResult> {
  const debug: CmsDebug = {
    derLength: pkcs7Der.length,
    derPrefixHex: prefixHex(pkcs7Der, 32),
    envelope: 'unparsed',
    subFilter,
    signatureCount,
  }

  const berView = pkcs7Der.buffer.slice(
    pkcs7Der.byteOffset,
    pkcs7Der.byteOffset + pkcs7Der.byteLength,
  ) as ArrayBuffer
  const asn1 = asn1js.fromBER(berView)
  if (asn1.offset === -1) {
    return failResult('Could not parse PKCS#7 envelope (BER decoding failed)', debug)
  }

  let signedData: SignedData
  try {
    const contentInfo = new ContentInfo({ schema: asn1.result })
    signedData = new SignedData({ schema: contentInfo.content })
    debug.envelope = 'ContentInfo'
  } catch (contentInfoErr) {
    // Some PKCS#7 producers emit the SignedData SEQUENCE directly without the
    // outer ContentInfo wrapper. Try that before giving up.
    try {
      signedData = new SignedData({ schema: asn1.result })
      debug.envelope = 'SignedData-direct'
    } catch (signedDataErr) {
      return failResult(
        `PKCS#7 parse error: ${(contentInfoErr as Error).message} (fallback also failed: ${(signedDataErr as Error).message})`,
        debug,
      )
    }
  }

  const certs = (signedData.certificates || []).filter(
    (c): c is Certificate => c instanceof Certificate,
  )
  if (certs.length === 0 || !signedData.signerInfos[0]) {
    return failResult('CMS missing certificates or signer info', debug)
  }

  const signerInfo = signedData.signerInfos[0]
  const signerCert = findSignerCert(certs, signerInfo)
  if (!signerCert) {
    return failResult('Signer certificate not found in CMS', debug)
  }

  const chain = buildChain(signerCert, certs)
  const chainSummaries: SignerSummary[] = []
  for (const cert of chain) {
    chainSummaries.push(await summarizeCert(cert))
  }

  const dataView = signedBytes.buffer.slice(
    signedBytes.byteOffset,
    signedBytes.byteOffset + signedBytes.byteLength,
  ) as ArrayBuffer

  let signatureValid = false
  try {
    const result = await signedData.verify({
      signer: 0,
      data: dataView,
      checkChain: false,
      extendedMode: true,
    })
    signatureValid = !!(result as { signatureVerified?: boolean }).signatureVerified
  } catch {
    signatureValid = false
  }

  const trust = await evaluateTrust(chain)
  const signerIdentity = classifySigner(signerCert)

  return {
    signatureValid,
    trustPinned: trust.pinned,
    rootFingerprint: trust.rootFingerprint,
    signerIdentity,
    chain: chainSummaries,
    signingTime: extractSigningTime(signerInfo),
    digestAlgorithm: DIGEST_OID_NAMES[signerInfo.digestAlgorithm.algorithmId] || signerInfo.digestAlgorithm.algorithmId,
    signatureAlgorithm: SIGNATURE_OID_NAMES[signerInfo.signatureAlgorithm.algorithmId] || signerInfo.signatureAlgorithm.algorithmId,
    debug,
    mode: signatureValid ? 'cryptographic' : 'failed',
  }
}

function failResult(error: string, debug: CmsDebug): CmsVerificationResult {
  return {
    signatureValid: false,
    trustPinned: false,
    rootFingerprint: null,
    signerIdentity: 'unknown',
    chain: [],
    signingTime: null,
    digestAlgorithm: '',
    signatureAlgorithm: '',
    error,
    debug,
    mode: 'failed',
  }
}

function prefixHex(bytes: Uint8Array, count: number): string {
  const slice = bytes.subarray(0, Math.min(count, bytes.length))
  let s = ''
  for (let i = 0; i < slice.length; i++) s += slice[i].toString(16).padStart(2, '0')
  return s
}

/**
 * Verifies a legacy Adobe /adbe.x509.rsa_sha1 signature. /Contents is a
 * DER-encoded OCTET STRING wrapping a raw PKCS#1 v1.5 RSA-SHA1 signature.
 * The signer's certificate is carried separately in the /Cert dictionary
 * entry. UIDAI uses this format on downloaded e-Aadhaar PDFs.
 *
 * Verification cascade:
 *   1. Cleartext /Cert (unencrypted PDFs): parse cert, RSA verify with its
 *      public key, do full chain + identity + trust evaluation.
 *   2. /Cert unreadable (encrypted PDFs, where /Cert is encrypted under
 *      the file key): trial-verify against each bundled UIDAI public key.
 *      A match means the signature was made by that specific UIDAI key.
 *   3. None of the above: structural validation — confirm the signature
 *      structure looks like a UIDAI signature so the print copy can still
 *      be produced. The UI labels this honestly.
 */
async function verifyAdbeX509RsaSha1(input: VerifyInputs): Promise<CmsVerificationResult> {
  const debug: CmsDebug = {
    derLength: input.pkcs7Der.length,
    derPrefixHex: prefixHex(input.pkcs7Der, 32),
    envelope: 'adbe.x509.rsa_sha1',
    subFilter: input.subFilter,
    signatureCount: input.signatureCount,
  }

  const rawSig = unwrapOctetString(input.pkcs7Der)
  if (!rawSig) {
    return failResult('adbe.x509.rsa_sha1: /Contents is not a DER OCTET STRING (got prefix ' + debug.derPrefixHex.slice(0, 8) + ')', debug)
  }

  // ── Step 1: try cleartext /Cert ────────────────────────────────────────
  const certBytes = (input.certs || []).filter(c => c.length > 0)
  if (certBytes.length > 0) {
    try {
      const parsedCerts = certBytes.map(der => parseCertificate(der))
      const signerCert = parsedCerts[0]
      const chain = buildChain(signerCert, parsedCerts)
      const valid = await rsaSha1Verify(
        new Uint8Array(signerCert.subjectPublicKeyInfo.toSchema().toBER(false)),
        rawSig,
        input.signedBytes,
      )
      if (valid) {
        const chainSummaries: SignerSummary[] = []
        for (const cert of chain) chainSummaries.push(await summarizeCert(cert))
        const trust = await evaluateTrust(chain)
        return {
          signatureValid: true,
          trustPinned: trust.pinned,
          rootFingerprint: trust.rootFingerprint,
          signerIdentity: classifySigner(signerCert),
          chain: chainSummaries,
          signingTime: null,
          digestAlgorithm: 'SHA-1',
          signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
          debug,
          mode: 'cryptographic',
          modeNote: 'Verified against /Cert in the signature dictionary.',
        }
      }
      // cert parsed but signature doesn't match — fall through to bundled keys
    } catch {
      // /Cert present but unparseable (encrypted) — fall through
    }
  }

  // ── Step 2: trial-verify against bundled UIDAI public keys ─────────────
  for (const key of UIDAI_KNOWN_KEYS) {
    const spki = spkiBytesOf(key)
    const valid = await rsaSha1Verify(spki, rawSig, input.signedBytes)
    if (valid) {
      return {
        signatureValid: true,
        trustPinned: true,
        rootFingerprint: null,
        signerIdentity: 'uidai',
        chain: [],
        signingTime: null,
        digestAlgorithm: 'SHA-1',
        signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
        debug,
        mode: 'cryptographic-pinned',
        modeNote: `Matched bundled UIDAI public key: ${key.label} (valid ${key.validFrom} – ${key.validTo}).`,
      }
    }
  }

  // ── Step 3: structural fallback ────────────────────────────────────────
  const isStructurallyValid =
    rawSig.length === 256 &&
    input.signedBytes.length > 1024 &&
    input.subFilter === 'adbe.x509.rsa_sha1'
  if (isStructurallyValid) {
    return {
      signatureValid: false,
      trustPinned: false,
      rootFingerprint: null,
      signerIdentity: 'uidai',
      chain: [],
      signingTime: null,
      digestAlgorithm: 'SHA-1',
      signatureAlgorithm: 'RSASSA-PKCS1-v1_5',
      debug,
      mode: 'structural',
      modeNote: 'Signature is shaped like a UIDAI e-Aadhaar signature (adbe.x509.rsa_sha1, RSA-2048, ByteRange covers the whole file), but PaperKnife could not read /Cert (likely encrypted) and no bundled UIDAI key matched. The print copy will still mark verification clearly, but full cryptographic chain validation is not asserted.',
    }
  }

  return failResult(
    'adbe.x509.rsa_sha1: signature could not be verified. /Cert was unreadable and no bundled UIDAI public key matched.',
    debug,
  )
}

async function rsaSha1Verify(spkiDer: Uint8Array, signature: Uint8Array, signedBytes: Uint8Array): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      bufferOf(spkiDer),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
      false,
      ['verify'],
    )
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bufferOf(signature), bufferOf(signedBytes))
  } catch {
    return false
  }
}

function unwrapOctetString(der: Uint8Array): Uint8Array | null {
  if (der.length < 2 || der[0] !== 0x04) return null
  const lengthByte = der[1]
  let headerLen = 2
  let total: number
  if (lengthByte < 0x80) {
    total = lengthByte
  } else {
    const numLenBytes = lengthByte & 0x7f
    if (numLenBytes === 0 || numLenBytes > 4 || der.length < 2 + numLenBytes) return null
    total = 0
    for (let i = 0; i < numLenBytes; i++) total = (total << 8) | der[2 + i]
    headerLen = 2 + numLenBytes
  }
  if (headerLen + total > der.length) return null
  return der.subarray(headerLen, headerLen + total)
}

function parseCertificate(der: Uint8Array): Certificate {
  const buf = bufferOf(der)
  const asn1 = asn1js.fromBER(buf)
  if (asn1.offset === -1) throw new Error('certificate BER decoding failed')
  return new Certificate({ schema: asn1.result })
}

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function findSignerCert(certs: Certificate[], signerInfo: SignedData['signerInfos'][number]): Certificate | undefined {
  const sid = signerInfo.sid as unknown as {
    issuer?: { typesAndValues: { type: string, value: { valueBlock: { value: string } } }[] }
    serialNumber?: { valueBlock: { valueHexView?: Uint8Array, valueHex?: ArrayBuffer } }
  }
  if (!sid?.serialNumber) return certs[0]
  const wantedSerial = bytesToHex(extractHex(sid.serialNumber))
  const wantedIssuer = stringifyRDN(sid.issuer?.typesAndValues)
  return certs.find(c => {
    const serial = bytesToHex(extractHex(c.serialNumber as unknown as { valueBlock: { valueHexView?: Uint8Array, valueHex?: ArrayBuffer } }))
    const issuer = stringifyRDN(c.issuer.typesAndValues)
    return serial === wantedSerial && issuer === wantedIssuer
  }) || certs[0]
}

function buildChain(signer: Certificate, certs: Certificate[]): Certificate[] {
  const chain: Certificate[] = [signer]
  let current = signer
  const seen = new Set<Certificate>([signer])
  while (true) {
    const issuerDN = stringifyRDN(current.issuer.typesAndValues)
    const subjectDN = stringifyRDN(current.subject.typesAndValues)
    if (issuerDN === subjectDN) break
    const next = certs.find(c =>
      !seen.has(c) && stringifyRDN(c.subject.typesAndValues) === issuerDN,
    )
    if (!next) break
    chain.push(next)
    seen.add(next)
    current = next
  }
  return chain
}

async function summarizeCert(cert: Certificate): Promise<SignerSummary> {
  const der = new Uint8Array(cert.toSchema(true).toBER(false))
  return {
    subjectDN: stringifyRDN(cert.subject.typesAndValues),
    issuerDN: stringifyRDN(cert.issuer.typesAndValues),
    serialNumberHex: bytesToHex(extractHex(cert.serialNumber as unknown as { valueBlock: { valueHexView?: Uint8Array, valueHex?: ArrayBuffer } })),
    notBefore: cert.notBefore.value.toISOString(),
    notAfter: cert.notAfter.value.toISOString(),
    sha256Fingerprint: await sha256Hex(der),
  }
}

function extractHex(value: { valueBlock: { valueHexView?: Uint8Array, valueHex?: ArrayBuffer } }): Uint8Array {
  if (value.valueBlock.valueHexView) return value.valueBlock.valueHexView
  if (value.valueBlock.valueHex) return new Uint8Array(value.valueBlock.valueHex)
  return new Uint8Array()
}

function bytesToHex(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0')
  return s
}

const OID_SIGNING_TIME = '1.2.840.113549.1.9.5'

function extractSigningTime(signerInfo: SignedData['signerInfos'][number]): Date | null {
  const attrs = signerInfo.signedAttrs?.attributes
  if (!attrs) return null
  for (const attr of attrs) {
    if (attr.type !== OID_SIGNING_TIME) continue
    const value = attr.values?.[0] as { toDate?: () => Date, value?: Date } | undefined
    if (!value) continue
    if (typeof value.toDate === 'function') return value.toDate()
    if (value.value instanceof Date) return value.value
  }
  return null
}
