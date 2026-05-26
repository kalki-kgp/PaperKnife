/**
 * PaperKnife - PDF signature extraction (Verify Signature, Phase 1)
 * Copyright (C) 2026 kalki-kgp
 *
 * Pulls the /ByteRange-bounded signed bytes and the PKCS#7 /Contents blob
 * out of a PDF without using a PDF parser. Robust enough for the common
 * /Sig field shape that UIDAI / Acrobat / iText / DSC vendors emit.
 *
 * Privacy: pure in-memory byte work. No network.
 */

export type SignatureSubFilter =
  | 'adbe.pkcs7.detached'
  | 'adbe.pkcs7.sha1'
  | 'ETSI.CAdES.detached'
  | 'ETSI.RFC3161'
  | string

export interface PdfSignatureRecord {
  /** SubFilter value as encoded in the signature dictionary */
  subFilter: SignatureSubFilter
  /** Bytes of the PKCS#7 / CMS message, hex-decoded from /Contents */
  pkcs7Der: Uint8Array
  /** Concatenation of bytes covered by /ByteRange — what the signature is over */
  signedBytes: Uint8Array
  /** Raw /ByteRange tuple [start1, len1, start2, len2] */
  byteRange: [number, number, number, number]
  /** Optional signing metadata extracted from the signature dictionary */
  metadata: SignatureMetadata
  /** Offset (in the original PDF) at which this /Contents value begins (inside the < >) */
  contentsHexStart: number
  /** Offset (in the original PDF) at which this /Contents value ends (the closing >) */
  contentsHexEnd: number
  /**
   * Certificates extracted from the /Cert entry (for legacy
   * /adbe.x509.rsa_sha1 signatures, which carry the cert outside the
   * signature value). May be empty if the dict has no /Cert entry or if the
   * values are encrypted/unreadable.
   */
  certs: Uint8Array[]
}

export interface SignatureMetadata {
  signerName?: string
  signingTime?: string
  reason?: string
  location?: string
  contactInfo?: string
}

export interface PdfSignatureScan {
  signatures: PdfSignatureRecord[]
  hasDSS: boolean
}

/**
 * Locate every PDF signature /Contents+/ByteRange pair in the file. The PDF
 * we read is the full file bytes (as Uint8Array). For Phase 1 we use the
 * first signature only; multi-sig support comes in Phase 2.
 */
export function scanPdfSignatures(pdfBytes: Uint8Array): PdfSignatureScan {
  const text = bytesAsLatin1(pdfBytes)
  const records: PdfSignatureRecord[] = []

  // Find every "/ByteRange [ ... ]" occurrence; each corresponds to a signature dict.
  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g
  let match: RegExpExecArray | null
  while ((match = byteRangeRegex.exec(text)) !== null) {
    const byteRange: [number, number, number, number] = [
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      parseInt(match[4], 10),
    ]

    const sigDictRange = findEnclosingDict(text, match.index)
    if (!sigDictRange) continue
    const sigDictText = text.slice(sigDictRange.start, sigDictRange.end)

    const contents = extractContentsBlob(pdfBytes, text, sigDictRange.start, sigDictRange.end)
    if (!contents) continue

    const subFilter = extractName(sigDictText, '/SubFilter') || 'adbe.pkcs7.detached'

    const signedBytes = sliceSignedBytes(pdfBytes, byteRange)

    records.push({
      subFilter,
      pkcs7Der: contents.der,
      signedBytes,
      byteRange,
      metadata: extractMetadata(sigDictText),
      contentsHexStart: contents.hexStart,
      contentsHexEnd: contents.hexEnd,
      certs: extractCerts(sigDictText),
    })
  }

  return {
    signatures: records,
    hasDSS: /\/DSS\s*<</.test(text) || /\/DSS\s+\d+\s+\d+\s+R/.test(text),
  }
}

/**
 * Extracts the /Cert entry from a signature dictionary. /Cert can be either
 *   /Cert <hex>                 → single DER-encoded cert as hex string
 *   /Cert (literal)             → single cert as a literal string
 *   /Cert [<hex1><hex2>...]     → array of hex/literal strings, signer first
 */
function extractCerts(dictText: string): Uint8Array[] {
  const certKeyIdx = dictText.search(/\/Cert\b/)
  if (certKeyIdx === -1) return []
  // Skip past "/Cert" plus whitespace
  let i = certKeyIdx + '/Cert'.length
  while (i < dictText.length && /\s/.test(dictText[i])) i++
  if (i >= dictText.length) return []

  const certs: Uint8Array[] = []
  if (dictText[i] === '[') {
    // Array form — collect all hex/literal strings until matching ']'.
    i++
    while (i < dictText.length) {
      while (i < dictText.length && /\s/.test(dictText[i])) i++
      if (i >= dictText.length) break
      if (dictText[i] === ']') break
      if (dictText[i] === '<') {
        const end = dictText.indexOf('>', i + 1)
        if (end === -1) break
        const hex = dictText.slice(i + 1, end).replace(/[^0-9a-fA-F]/g, '')
        certs.push(hexToBytes(hex))
        i = end + 1
      } else if (dictText[i] === '(') {
        const end = findLiteralStringEnd(dictText, i)
        if (end === -1) break
        const literal = dictText.slice(i + 1, end)
        certs.push(literalStringToBytes(literal))
        i = end + 1
      } else {
        // Unrecognized token — bail to avoid infinite loop.
        break
      }
    }
  } else if (dictText[i] === '<') {
    const end = dictText.indexOf('>', i + 1)
    if (end !== -1) {
      const hex = dictText.slice(i + 1, end).replace(/[^0-9a-fA-F]/g, '')
      certs.push(hexToBytes(hex))
    }
  } else if (dictText[i] === '(') {
    const end = findLiteralStringEnd(dictText, i)
    if (end !== -1) {
      const literal = dictText.slice(i + 1, end)
      certs.push(literalStringToBytes(literal))
    }
  }
  return certs
}

function findLiteralStringEnd(s: string, openIndex: number): number {
  let depth = 1
  let i = openIndex + 1
  while (i < s.length) {
    const ch = s[i]
    if (ch === '\\') { i += 2; continue }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

function literalStringToBytes(literal: string): Uint8Array {
  // PDF literal strings can carry binary via \nnn octal escapes; for cert
  // payloads we mostly see PEM-shaped text. Round-trip latin1 so byte
  // values survive.
  const decoded = literal
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
  const out = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i++) out[i] = decoded.charCodeAt(i) & 0xff
  return out
}

function sliceSignedBytes(pdfBytes: Uint8Array, byteRange: [number, number, number, number]): Uint8Array {
  const [s1, l1, s2, l2] = byteRange
  const out = new Uint8Array(l1 + l2)
  out.set(pdfBytes.subarray(s1, s1 + l1), 0)
  out.set(pdfBytes.subarray(s2, s2 + l2), l1)
  return out
}

function extractContentsBlob(
  pdfBytes: Uint8Array,
  text: string,
  dictStart: number,
  dictEnd: number,
): { der: Uint8Array, hexStart: number, hexEnd: number } | null {
  // /Contents <hex...> within this dict.
  const slice = text.slice(dictStart, dictEnd)
  const idx = slice.search(/\/Contents\s*</)
  if (idx === -1) return null
  const absHexOpen = dictStart + idx + slice.slice(idx).indexOf('<')
  // Find matching '>'.
  let absHexClose = absHexOpen + 1
  while (absHexClose < pdfBytes.length && pdfBytes[absHexClose] !== 0x3e /* > */) absHexClose++
  if (absHexClose >= pdfBytes.length) return null
  const hex = text.slice(absHexOpen + 1, absHexClose).replace(/\s+/g, '')
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '')
  // PDF hex strings are zero-padded with trailing zeros; strip pad pairs to find DER end.
  const der = hexToBytes(cleanHex)
  // Trim trailing 0x00 padding (DER itself never ends in arbitrary zeros after the top-level SEQUENCE).
  const trimmed = trimTrailingZeros(der)
  return { der: trimmed, hexStart: absHexOpen + 1, hexEnd: absHexClose }
}

function trimTrailingZeros(der: Uint8Array): Uint8Array {
  // Parse the outer SEQUENCE length to know the true DER length; anything past
  // that is PDF padding.
  if (der.length < 2 || der[0] !== 0x30) return der
  const lengthByte = der[1]
  let headerLen = 2
  let total = 0
  if (lengthByte < 0x80) {
    total = lengthByte
  } else {
    const numLenBytes = lengthByte & 0x7f
    if (numLenBytes === 0 || numLenBytes > 4 || der.length < 2 + numLenBytes) return der
    for (let i = 0; i < numLenBytes; i++) total = (total << 8) | der[2 + i]
    headerLen = 2 + numLenBytes
  }
  const expected = headerLen + total
  if (expected > der.length) return der
  return der.subarray(0, expected)
}

function extractName(dictText: string, key: string): string | undefined {
  const re = new RegExp(`${escapeRegex(key)}\\s*/([\\w.\\-]+)`)
  const m = dictText.match(re)
  return m ? m[1] : undefined
}

function extractMetadata(dictText: string): SignatureMetadata {
  return {
    signerName: extractStringValue(dictText, '/Name'),
    signingTime: extractStringValue(dictText, '/M'),
    reason: extractStringValue(dictText, '/Reason'),
    location: extractStringValue(dictText, '/Location'),
    contactInfo: extractStringValue(dictText, '/ContactInfo'),
  }
}

function extractStringValue(dictText: string, key: string): string | undefined {
  // Try literal string (parentheses) first, then hex string.
  const reParen = new RegExp(`${escapeRegex(key)}\\s*\\(((?:\\\\\\)|[^)])*)\\)`)
  const mParen = dictText.match(reParen)
  if (mParen) return decodePdfLiteralString(mParen[1])
  const reHex = new RegExp(`${escapeRegex(key)}\\s*<([0-9a-fA-F\\s]+)>`)
  const mHex = dictText.match(reHex)
  if (mHex) return decodeHexString(mHex[1].replace(/\s+/g, ''))
  return undefined
}

function decodePdfLiteralString(raw: string): string {
  // Handle escape sequences \n \r \t \( \) \\.
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}

function decodeHexString(hex: string): string {
  const clean = hex.length % 2 === 0 ? hex : hex + '0'
  let result = ''
  for (let i = 0; i < clean.length; i += 2) {
    result += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16))
  }
  return result.replace(/\0+$/, '')
}

function findEnclosingDict(text: string, fromIndex: number): { start: number, end: number } | null {
  // Walk backward to find the dict opening "<<" that contains fromIndex.
  let depth = 1
  let i = fromIndex
  while (i > 1) {
    if (text[i - 1] === '<' && text[i] === '<') {
      depth--
      if (depth === 0) {
        const start = i - 1
        const end = findDictClose(text, start)
        if (end === -1) return null
        return { start, end }
      }
    } else if (text[i - 1] === '>' && text[i] === '>') {
      depth++
    }
    i--
  }
  return null
}

function findDictClose(text: string, openIndex: number): number {
  let depth = 1
  let i = openIndex + 2
  while (i < text.length - 1) {
    if (text[i] === '<' && text[i + 1] === '<') { depth++; i += 2; continue }
    if (text[i] === '>' && text[i + 1] === '>') { depth--; if (depth === 0) return i + 2; i += 2; continue }
    i++
  }
  return -1
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function bytesAsLatin1(bytes: Uint8Array): string {
  // Latin-1 round-trips every byte to a code point, which is what we need to
  // search structural PDF tokens while keeping byte offsets aligned.
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return s
}

function hexToBytes(hex: string): Uint8Array {
  const len = Math.floor(hex.length / 2)
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const digest = await crypto.subtle.digest('SHA-256', buf)
  const view = new Uint8Array(digest)
  let s = ''
  for (let i = 0; i < view.length; i++) s += view[i].toString(16).padStart(2, '0')
  return s
}
