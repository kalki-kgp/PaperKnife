/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { pdfHasEncryptionMarker } from '../pdfEncryption'
import { decryptPdfObjectBytes, getPdfFileEncryptionKey } from './pdfEncryptionKey'
import type { ByteRangeTuple, ExtractedPdfSignature } from './types'
import { Certificate } from 'pkijs'

const SUPPORTED_SUBFILTERS = new Set([
  'adbe.pkcs7.detached',
  'ETSI.CAdES.detached',
  'adbe.pkcs7.sha1',
  'adbe.x509.rsa_sha1'
])

export const isX509RsaSubFilter = (subFilter: string): boolean => subFilter === 'adbe.x509.rsa_sha1'

const textDecoder = new TextDecoder('latin1')
const SIG_CONTEXT_WINDOW = 32 * 1024
const CONTENTS_SEARCH_AHEAD = 2 * 1024 * 1024
const TAIL_SCAN_BYTES = 2 * 1024 * 1024
const MIN_CMS_HEX_CHARS = 64
const GAP_HEX_SEARCH_PADDING = 16 * 1024
const SIG_HEX_WINDOW = 8 * 1024 * 1024

const findByteRangeHits = (pdfBytes: Uint8Array): number[] => {
  const hits: number[] = []
  const scanStart = Math.max(0, pdfBytes.length - TAIL_SCAN_BYTES)
  const tail = textDecoder.decode(pdfBytes.subarray(scanStart))
  const re = /\/ByteRange/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(tail))) {
    hits.push(scanStart + match.index)
  }
  if (hits.length > 0) return hits

  const full = textDecoder.decode(pdfBytes)
  while ((match = re.exec(full))) {
    hits.push(match.index)
  }
  return hits
}

const parseByteRange = (pdfBytes: Uint8Array, anchor: number): ByteRangeTuple | null => {
  const slice = textDecoder.decode(pdfBytes.subarray(anchor, anchor + 4096))
  const bracket = slice.indexOf('[')
  if (bracket === -1) return null
  const match = slice.slice(bracket).match(/\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/)
  if (!match) return null
  const tuple: ByteRangeTuple = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4])
  ]
  if (tuple.some((n) => !Number.isFinite(n) || n < 0)) return null
  const [o1, l1, o2, l2] = tuple
  if (o1 + l1 > pdfBytes.length || o2 + l2 > pdfBytes.length) return null
  if (o2 <= o1 + l1) return null
  return tuple
}

const isSignatureDictionaryContext = (pdfBytes: Uint8Array, anchor: number): boolean => {
  const start = Math.max(0, anchor - SIG_CONTEXT_WINDOW)
  const end = Math.min(pdfBytes.length, anchor + SIG_CONTEXT_WINDOW)
  const chunk = textDecoder.decode(pdfBytes.subarray(start, end))
  return (
    /\/Type\s*\/Sig\b/i.test(chunk) ||
    /\/FT\s*\/Sig\b/i.test(chunk) ||
    /\/Filter\s*\/Adobe\.PPKLite/i.test(chunk) ||
    /\/SubFilter\s*\/adbe\.pkcs7/i.test(chunk) ||
    /\/SubFilter\s*\/adbe\.x509/i.test(chunk) ||
    /\/SubFilter\s*\/ETSI\.CAdES/i.test(chunk) ||
    /<30[0-9A-Fa-f]{40,}/i.test(chunk)
  )
}

const indexOfByte = (haystack: Uint8Array, byte: number, from = 0): number => {
  for (let i = from; i < haystack.length; i++) {
    if (haystack[i] === byte) return i
  }
  return -1
}

const normalizeHexRaw = (hexRaw: string): string => {
  let hex = hexRaw.replace(/\s/g, '')
  if (!hex || !/^[0-9A-Fa-f]+$/.test(hex)) return ''
  if (hex.length % 2 !== 0) hex = hex.slice(0, -1)
  return hex
}

const hexToBytes = (hexRaw: string): Uint8Array | null => {
  const hex = normalizeHexRaw(hexRaw)
  if (!hex || hex.length < MIN_CMS_HEX_CHARS || !hex.startsWith('30')) return null
  const signatureBytes = new Uint8Array(hex.length / 2)
  for (let j = 0; j < hex.length; j += 2) {
    signatureBytes[j / 2] = parseInt(hex.slice(j, j + 2), 16)
  }
  return signatureBytes
}

const hexToCmsBytes = (hexRaw: string): Uint8Array | null => {
  const signatureBytes = hexToBytes(hexRaw)
  if (!signatureBytes) return null
  const parsed = parseDerCms(signatureBytes, 0)
  return parsed?.signatureBytes ?? null
}

const pickCmsFromHex = (hexRaw: string): Uint8Array | null => {
  return hexToCmsBytes(hexRaw) ?? hexToBytes(hexRaw)
}

const parseDerCms = (bytes: Uint8Array, offset: number): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  if (offset >= bytes.length || bytes[offset] !== 0x30) return null
  let contentLen = 0
  let headerLen = 2
  const lenByte = bytes[offset + 1]
  if (lenByte === undefined) return null
  if (lenByte & 0x80) {
    const numLenBytes = lenByte & 0x7f
    if (numLenBytes === 0 || offset + 2 + numLenBytes >= bytes.length) return null
    headerLen = 2 + numLenBytes
    for (let i = 0; i < numLenBytes; i++) {
      contentLen = (contentLen << 8) | bytes[offset + 2 + i]
    }
  } else {
    contentLen = lenByte
  }
  const total = headerLen + contentLen
  if (total < MIN_CMS_HEX_CHARS / 2 || offset + total > bytes.length) return null
  return {
    signatureBytes: bytes.subarray(offset, offset + total),
    start: offset,
    end: offset + total
  }
}

const contentsHexPattern = /(?:\/)?Contents\s*<([0-9A-Fa-f\s\r\n]+)>?/i

const extractLongestHexRun = (
  gapStart: number,
  gapText: string
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  let best: { signatureBytes: Uint8Array; start: number; end: number } | null = null
  const re = /[0-9A-Fa-f]{64,}/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(gapText))) {
    if (!match[0].toLowerCase().includes('3082') && !match[0].startsWith('30')) continue
    const signatureBytes = pickCmsFromHex(match[0])
    if (!signatureBytes) continue
    const candidate = {
      signatureBytes,
      start: gapStart + match.index,
      end: gapStart + match.index + match[0].length
    }
    if (!best || signatureBytes.length > best.signatureBytes.length) best = candidate
  }
  return best
}

const findLargestSigHexInWindow = (
  pdfBytes: Uint8Array,
  searchStart: number,
  searchEnd: number
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  const window = textDecoder.decode(pdfBytes.subarray(searchStart, searchEnd))
  let best: { signatureBytes: Uint8Array; start: number; end: number } | null = null
  const re = /<([0-9A-Fa-f\s\r\n]{64,})>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(window))) {
    const signatureBytes = pickCmsFromHex(match[1])
    if (!signatureBytes) continue
    const lt = match.index
    const candidate = {
      signatureBytes,
      start: searchStart + lt,
      end: searchStart + lt + match[0].length
    }
    if (!best || signatureBytes.length > best.signatureBytes.length) best = candidate
  }

  const labeled = window.match(contentsHexPattern)
  if (labeled?.index !== undefined) {
    const hexRaw = labeled[1]
    const signatureBytes = pickCmsFromHex(hexRaw)
    if (signatureBytes) {
      const lt = labeled.index + labeled[0].indexOf('<')
      const candidate = {
        signatureBytes,
        start: searchStart + lt,
        end: labeled[0].endsWith('>')
          ? searchStart + labeled.index + labeled[0].length
          : searchStart + lt + hexRaw.length + 2
      }
      if (!best || signatureBytes.length > best.signatureBytes.length) best = candidate
    }
  }

  const run = extractLongestHexRun(searchStart, window)
  if (run && (!best || run.signatureBytes.length > best.signatureBytes.length)) best = run
  return best
}

const extractHexAngleBracket = (
  gapStart: number,
  gapBytes: Uint8Array
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  const gapText = textDecoder.decode(gapBytes)
  const labeled = gapText.match(contentsHexPattern)
  if (labeled?.index !== undefined) {
    const hexRaw = labeled[1].replace(/\s/g, '')
    const signatureBytes = hexToBytes(hexRaw)
    if (signatureBytes) {
      const lt = labeled.index + labeled[0].indexOf('<')
      const hasClose = labeled[0].endsWith('>')
      const end = hasClose ? lt + labeled[0].length : gapStart + gapBytes.length
      return { signatureBytes, start: gapStart + lt, end }
    }
  }

  const re = /<([0-9A-Fa-f\s\r\n]{32,})>?/gi
  let match: RegExpExecArray | null
  let best: { signatureBytes: Uint8Array; start: number; end: number } | null = null
  while ((match = re.exec(gapText))) {
    const hexRaw = match[1].replace(/\s/g, '')
    const signatureBytes = hexToBytes(hexRaw)
    if (!signatureBytes) continue
    const lt = match.index
    const end = match[0].endsWith('>') ? lt + match[0].length : gapBytes.length
    const candidate = { signatureBytes, start: gapStart + lt, end: gapStart + end }
    if (!best || signatureBytes.length > best.signatureBytes.length) best = candidate
  }
  const run = extractLongestHexRun(gapStart, gapText)
  if (run && (!best || run.signatureBytes.length > best.signatureBytes.length)) return run
  return best
}

const extractBinaryCmsFromGap = (
  pdfBytes: Uint8Array,
  gapStart: number,
  gapBytes: Uint8Array
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  if (indexOfByte(gapBytes, 0x3c) !== -1) return null
  for (let i = 0; i < gapBytes.length - 4; i++) {
    if (gapBytes[i] !== 0x30) continue
    const parsed = parseDerCms(pdfBytes, gapStart + i)
    if (parsed) return parsed
  }
  return null
}

const extractStreamCmsFromGap = (
  pdfBytes: Uint8Array,
  gapStart: number,
  gapBytes: Uint8Array
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  const gapText = textDecoder.decode(gapBytes)
  const streamIdx = gapText.indexOf('stream')
  const endIdx = gapText.indexOf('endstream')
  if (streamIdx === -1 || endIdx === -1 || endIdx <= streamIdx) return null
  let dataStart = streamIdx + 6
  if (gapBytes[dataStart] === 0x0d && gapBytes[dataStart + 1] === 0x0a) dataStart += 2
  else if (gapBytes[dataStart] === 0x0a) dataStart += 1
  const dataEnd = endIdx
  const streamBytes = gapBytes.subarray(dataStart, dataEnd)
  if (streamBytes.length < MIN_CMS_HEX_CHARS / 2) return null
  if (streamBytes[0] === 0x30) {
    const parsed = parseDerCms(pdfBytes, gapStart + dataStart)
    if (parsed) return parsed
  }
  return {
    signatureBytes: streamBytes,
    start: gapStart + dataStart,
    end: gapStart + dataEnd
  }
}

const resolveIndirectContents = (
  pdfBytes: Uint8Array,
  objectId: number
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  const pattern = new RegExp(`${objectId}\\s+0\\s+obj`, 'g')
  const text = textDecoder.decode(pdfBytes)
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    const objStart = match.index
    const slice = text.slice(objStart, objStart + 256 * 1024)
    const hexMatch = slice.match(/<([0-9A-Fa-f\s\r\n]{64,})>/)
    if (hexMatch?.index !== undefined) {
      const lt = objStart + hexMatch.index
      const gt = lt + hexMatch[0].length
      const hexRaw = hexMatch[1].replace(/\s/g, '')
      const signatureBytes = hexToBytes(hexRaw)
      if (signatureBytes) return { signatureBytes, start: lt, end: gt }
    }
    const streamIdx = slice.indexOf('stream')
    const endIdx = slice.indexOf('endstream')
    if (streamIdx !== -1 && endIdx > streamIdx) {
      let dataStart = objStart + streamIdx + 6
      if (pdfBytes[dataStart] === 0x0a) dataStart += 1
      if (pdfBytes[dataStart - 1] === 0x0d) dataStart += 1
      const dataEnd = objStart + endIdx
      const streamBytes = pdfBytes.subarray(dataStart, dataEnd)
      if (streamBytes[0] === 0x30) {
        const parsed = parseDerCms(pdfBytes, dataStart)
        if (parsed) return parsed
      }
    }
  }
  return null
}

const extractIndirectFromGap = (
  pdfBytes: Uint8Array,
  gapBytes: Uint8Array
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  const gapText = textDecoder.decode(gapBytes)
  const indirect = gapText.match(/\/Contents\s+(\d+)\s+(\d+)\s+R/i)
  if (!indirect) return null
  return resolveIndirectContents(pdfBytes, Number(indirect[1]))
}

/** Parse CMS from the byte-range gap (excluded from the signed digest). */
const extractContentsFromByteRange = (
  pdfBytes: Uint8Array,
  byteRange: ByteRangeTuple
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  const gapStart = byteRange[0] + byteRange[1]
  const gapEnd = byteRange[2]
  if (gapEnd <= gapStart || gapEnd > pdfBytes.length) return null

  const gapBytes = pdfBytes.subarray(gapStart, gapEnd)

  return (
    extractHexAngleBracket(gapStart, gapBytes) ||
    extractBinaryCmsFromGap(pdfBytes, gapStart, gapBytes) ||
    extractStreamCmsFromGap(pdfBytes, gapStart, gapBytes) ||
    extractIndirectFromGap(pdfBytes, gapBytes) ||
    (() => {
      const atOffset = byteRange[0] + byteRange[1]
      if (pdfBytes[atOffset] === 0x3c) {
        return extractHexAngleBracket(atOffset, pdfBytes.subarray(atOffset, gapEnd))
      }
      if (pdfBytes[atOffset] === 0x30) {
        return parseDerCms(pdfBytes, atOffset)
      }
      return null
    })()
  )
}

const decodeHexContents = (
  window: string,
  hexStartInWindow: number,
  searchStart: number,
  ltIndex: number
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  let i = hexStartInWindow
  while (i < window.length) {
    const c = window[i]
    if (c === '>') break
    if (/[0-9A-Fa-f\s\r\n]/.test(c)) {
      i += 1
      continue
    }
    return null
  }

  const hexRaw = window.slice(hexStartInWindow, i).replace(/\s/g, '')
  const signatureBytes = hexToBytes(hexRaw)
  if (!signatureBytes) return null

  return { signatureBytes, start: searchStart + ltIndex, end: searchStart + i + 1 }
}

const extractHexContentsNear = (
  pdfBytes: Uint8Array,
  anchor: number
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  const searchStart = Math.max(0, anchor - SIG_CONTEXT_WINDOW)
  const searchEnd = Math.min(pdfBytes.length, anchor + CONTENTS_SEARCH_AHEAD)
  const window = textDecoder.decode(pdfBytes.subarray(searchStart, searchEnd))

  let best: { signatureBytes: Uint8Array; start: number; end: number } | null = null
  const patterns = [/\/Contents\s*</gi, /<30[0-9A-Fa-f]/gi]

  for (const re of patterns) {
    let match: RegExpExecArray | null
    while ((match = re.exec(window))) {
      const hexStartInWindow =
        match[0].startsWith('<') ? match.index + 1 : match.index + match[0].length
      const ltIndex = match[0].startsWith('<') ? match.index : match.index + match[0].indexOf('<')
      const parsed = decodeHexContents(window, hexStartInWindow, searchStart, ltIndex)
      if (!parsed) continue

      const distance = Math.abs(parsed.start - anchor)
      const bestDistance = best ? Math.abs(best.start - anchor) : Number.POSITIVE_INFINITY
      if (
        !best ||
        distance < bestDistance ||
        (distance === bestDistance && parsed.signatureBytes.length > best.signatureBytes.length)
      ) {
        best = parsed
      }
    }
  }

  return best
}

const findCmsHexAtTail = (
  pdfBytes: Uint8Array
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  const searchStart = Math.max(0, pdfBytes.length - TAIL_SCAN_BYTES)
  const window = textDecoder.decode(pdfBytes.subarray(searchStart))

  let best: { signatureBytes: Uint8Array; start: number; end: number } | null = null
  const re = /<30[0-9A-Fa-f]/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(window))) {
    const parsed = decodeHexContents(window, match.index + 1, searchStart, match.index)
    if (!parsed) continue
    if (!best || parsed.signatureBytes.length > best.signatureBytes.length) {
      best = parsed
    }
  }
  return best
}

const inferByteRangeFromContents = (
  pdfBytes: Uint8Array,
  contents: { start: number; end: number }
): ByteRangeTuple => [0, contents.start, contents.end, pdfBytes.length - contents.end]

const readSubFilter = (pdfBytes: Uint8Array, anchor: number): string => {
  const start = Math.max(0, anchor - SIG_CONTEXT_WINDOW)
  const end = Math.min(pdfBytes.length, anchor + SIG_CONTEXT_WINDOW)
  const chunk = textDecoder.decode(pdfBytes.subarray(start, end))
  const match = chunk.match(/\/SubFilter\s*\/([^\s/>[\]]+)/i)
  return match?.[1] ?? ''
}

export const parsePdfModDate = (raw: string): Date | null => {
  const match = raw.match(
    /D:(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?(Z|([+-])(\d{2})'(\d{2})')?/i
  )
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const hour = Number(match[4] ?? '0')
  const minute = Number(match[5] ?? '0')
  const second = Number(match[6] ?? '0')
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

  if (match[7] === 'Z') {
    return new Date(Date.UTC(year, month, day, hour, minute, second))
  }

  const offsetSign = match[8]
  if (offsetSign) {
    const offsetHours = Number(match[9] ?? '0')
    const offsetMinutes = Number(match[10] ?? '0')
    const offsetMs = (offsetHours * 60 + offsetMinutes) * 60 * 1000
    const utcMs = Date.UTC(year, month, day, hour, minute, second)
    return new Date(offsetSign === '+' ? utcMs - offsetMs : utcMs + offsetMs)
  }

  return new Date(year, month, day, hour, minute, second)
}

const readSignatureModDate = (pdfBytes: Uint8Array, anchor: number): Date | null => {
  const start = Math.max(0, anchor - SIG_CONTEXT_WINDOW)
  const end = Math.min(pdfBytes.length, anchor + SIG_CONTEXT_WINDOW)
  const chunk = textDecoder.decode(pdfBytes.subarray(start, end))
  const match = chunk.match(/\/M\s*\((D:[^)]+)\)/i)
  return match ? parsePdfModDate(match[1]) : null
}

const parseDerCertificate = (der: Uint8Array): Certificate | null => {
  if (der.length < 64 || der[0] !== 0x30) return null
  try {
    const buffer = der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength) as ArrayBuffer
    return Certificate.fromBER(buffer)
  } catch {
    return null
  }
}

type CertDerChunk = { bytes: Uint8Array; objectNum: number | null }

const tryParseCertificateChunk = async (
  pdfBytes: Uint8Array,
  chunk: CertDerChunk,
  password?: string
): Promise<Certificate | null> => {
  const direct = parseDerCertificate(chunk.bytes)
  if (direct) return direct

  const trimmedPassword = password?.trim()
  if (!trimmedPassword || chunk.objectNum === null || !pdfHasEncryption(pdfBytes)) {
    return null
  }

  try {
    const encryption = await getPdfFileEncryptionKey(pdfBytes, trimmedPassword)
    const decrypted = await decryptPdfObjectBytes(
      chunk.bytes,
      chunk.objectNum,
      0,
      encryption
    )
    return parseDerCertificate(decrypted)
  } catch {
    return null
  }
}

const resolveIndirectCertBytes = (
  pdfBytes: Uint8Array,
  objectId: number,
  generation = 0
): Uint8Array | null => {
  const pattern = new RegExp(`${objectId}\\s+${generation}\\s+obj`, 'g')
  const text = textDecoder.decode(pdfBytes)
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    const objStart = match.index
    const slice = text.slice(objStart, objStart + 512 * 1024)
    const hexMatch = slice.match(/<([0-9A-Fa-f\s\r\n]{64,})>/)
    if (hexMatch?.[1]) {
      return decodeGapHexRaw(hexMatch[1])
    }
    const literalMatch = slice.match(/\(([\s\S]*?)\)/)
    if (literalMatch?.index !== undefined && literalMatch.index < 512) {
      const parsed = parsePdfLiteralString(slice, literalMatch.index)
      if (parsed && parsed.length >= 64) return parsed
    }
    const streamIdx = slice.indexOf('stream')
    const endIdx = slice.indexOf('endstream')
    if (streamIdx !== -1 && endIdx > streamIdx) {
      let dataStart = objStart + streamIdx + 6
      if (pdfBytes[dataStart] === 0x0a) dataStart += 1
      if (pdfBytes[dataStart - 1] === 0x0d) dataStart += 1
      const dataEnd = objStart + endIdx
      return pdfBytes.subarray(dataStart, dataEnd)
    }
  }
  return null
}

const parsePdfLiteralString = (text: string, openIndex: number): Uint8Array | null => {
  if (text[openIndex] !== '(') return null
  const bytes: number[] = []
  for (let i = openIndex + 1; i < text.length; i++) {
    const c = text[i]
    if (c === ')') return new Uint8Array(bytes)
    if (c === '\\') {
      i += 1
      if (i >= text.length) break
      const esc = text[i]
      if (esc >= '0' && esc <= '7') {
        let oct = esc.charCodeAt(0) - 48
        for (let j = 0; j < 2 && i + 1 < text.length; j++) {
          const next = text[i + 1]
          if (next >= '0' && next <= '7') {
            i += 1
            oct = oct * 8 + (next.charCodeAt(0) - 48)
          } else break
        }
        bytes.push(oct)
      } else {
        bytes.push(esc.charCodeAt(0))
      }
      continue
    }
    bytes.push(c.charCodeAt(0))
  }
  return null
}

const findPdfObjectEnd = (text: string, objectStart: number): number => {
  let i = objectStart
  const objMarker = text.indexOf('obj', i)
  if (objMarker === -1) return -1
  i = objMarker + 3

  let inHex = false
  let parenDepth = 0

  while (i < text.length) {
    const c = text[i]

    if (parenDepth > 0) {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '(') parenDepth += 1
      else if (c === ')') parenDepth -= 1
      i += 1
      continue
    }

    if (inHex) {
      if (c === '>') inHex = false
      i += 1
      continue
    }

    if (c === '<') {
      if (text[i + 1] === '<') {
        i += 2
        continue
      }
      inHex = true
      i += 1
      continue
    }

    if (c === '(') {
      parenDepth = 1
      i += 1
      continue
    }

    if (text.startsWith('endobj', i)) return i + 6
    i += 1
  }

  return -1
}

const findSignatureObjectSpan = (
  pdfBytes: Uint8Array,
  anchor: number
): { objectNum: number; start: number; end: number } | null => {
  const objectNum = findSignatureObjectNumber(pdfBytes, anchor)
  if (objectNum === null) return null

  const text = textDecoder.decode(pdfBytes)
  const searchStart = Math.max(0, anchor - 512 * 1024)
  const region = text.slice(searchStart)
  const objRe = new RegExp(`${objectNum}\\s+0\\s+obj`, 'i')
  const objMatch = region.match(objRe)
  if (objMatch?.index === undefined) return null

  const start = searchStart + objMatch.index
  const end = findPdfObjectEnd(text, start)
  if (end === -1) return null
  return { objectNum, start, end }
}

const extractCertFieldsNearAnchor = (pdfBytes: Uint8Array, anchor: number): Uint8Array[] => {
  const start = Math.max(0, anchor - 64 * 1024)
  const end = Math.min(pdfBytes.length, anchor + 512 * 1024)
  const text = textDecoder.decode(pdfBytes.subarray(start, end))
  const derChunks: Uint8Array[] = []
  const re = /\/Cert\b/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const slice = text.slice(match.index, match.index + 512 * 1024)
    for (const hexRaw of extractCertHexStringsFromObject(slice)) {
      const decoded = decodeGapHexRaw(hexRaw)
      if (decoded) derChunks.push(decoded)
    }
    for (const [objectId, generation] of extractCertIndirectRefsFromObject(slice)) {
      const indirect = resolveIndirectCertBytes(pdfBytes, objectId, generation)
      if (indirect) derChunks.push(indirect)
    }
    const literal = extractCertLiteralFromObject(slice)
    if (literal) derChunks.push(literal)
  }
  return derChunks
}

const scanPdfTailForDerCertificates = (
  pdfBytes: Uint8Array,
  anchor: number,
  byteRange?: ByteRangeTuple
): Uint8Array[] => {
  const scanStart = Math.max(0, anchor - 128 * 1024)
  const scanEnd = Math.min(pdfBytes.length, pdfBytes.length)
  const gapStart = byteRange ? byteRange[0] + byteRange[1] : -1
  const gapEnd = byteRange ? byteRange[2] : -1
  return scanDerCertificatesInObject(pdfBytes, scanStart, scanEnd, gapStart, gapEnd)
}

const dedupeCertDerChunks = (chunks: CertDerChunk[]): CertDerChunk[] => {
  const seen = new Set<string>()
  const unique: CertDerChunk[] = []
  for (const chunk of chunks) {
    const key = [...chunk.bytes.slice(0, 32)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(chunk)
  }
  return unique
}

const extractCertHexStringsFromObject = (objectText: string): string[] => {
  const hexStrings: string[] = []
  const certIdx = objectText.search(/\/Cert\b/i)
  if (certIdx === -1) return hexStrings

  const after = objectText.slice(certIdx + 5).replace(/^\s+/, '')
  if (after.startsWith('[')) {
    const close = after.indexOf(']')
    if (close === -1) return hexStrings
    const inner = after.slice(1, close)
    const hexRe = /<([0-9A-Fa-f\s\r\n]+)>/gi
    let match: RegExpExecArray | null
    while ((match = hexRe.exec(inner))) {
      hexStrings.push(match[1])
    }
    return hexStrings
  }

  if (after.startsWith('<')) {
    const close = after.indexOf('>')
    if (close !== -1) hexStrings.push(after.slice(1, close))
    return hexStrings
  }

  return hexStrings
}

const extractCertIndirectRefsFromObject = (objectText: string): Array<[number, number]> => {
  const certIdx = objectText.search(/\/Cert\b/i)
  if (certIdx === -1) return []

  const after = objectText.slice(certIdx + 5).replace(/^\s+/, '')
  const target = after.startsWith('[') ? after.slice(1, after.indexOf(']')) : after
  const refs: Array<[number, number]> = []
  const re = /(\d+)\s+(\d+)\s+R/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(target))) {
    refs.push([Number(match[1]), Number(match[2])])
  }
  return refs
}

const extractCertLiteralFromObject = (objectText: string): Uint8Array | null => {
  const certIdx = objectText.search(/\/Cert\b/i)
  if (certIdx === -1) return null
  const after = objectText.slice(certIdx + 5).replace(/^\s+/, '')
  if (!after.startsWith('(')) return null
  return parsePdfLiteralString(after, 0)
}

const scanDerCertificatesInObject = (
  pdfBytes: Uint8Array,
  objectStart: number,
  objectEnd: number,
  excludeStart: number,
  excludeEnd: number
): Uint8Array[] => {
  const found: Uint8Array[] = []
  const end = Math.min(objectEnd, pdfBytes.length)
  for (let i = objectStart; i < end - 4; i++) {
    if (i >= excludeStart && i < excludeEnd) continue
    if (pdfBytes[i] !== 0x30) continue
    const parsed = parseDerCms(pdfBytes, i)
    if (!parsed || parsed.signatureBytes.length < 200) continue
    if (!parseDerCertificate(parsed.signatureBytes)) continue
    found.push(parsed.signatureBytes)
    i = parsed.end - 1
  }
  return found
}

const decryptCertDerChunks = async (
  pdfBytes: Uint8Array,
  derChunks: CertDerChunk[],
  password?: string
): Promise<Certificate[]> => {
  if (derChunks.length === 0) return []

  const certificates: Certificate[] = []
  for (const chunk of derChunks) {
    const cert = await tryParseCertificateChunk(pdfBytes, chunk, password)
    if (cert) certificates.push(cert)
  }
  return certificates
}

const readSignatureCertificatesFromSource = async (
  pdfBytes: Uint8Array,
  anchor: number,
  password?: string,
  byteRange?: ByteRangeTuple
): Promise<Certificate[]> => {
  const span = findSignatureObjectSpan(pdfBytes, anchor)
  let derChunks: CertDerChunk[] = []

  if (span) {
    const objectText = textDecoder.decode(pdfBytes.subarray(span.start, span.end))

    for (const hexRaw of extractCertHexStringsFromObject(objectText)) {
      const decoded = decodeGapHexRaw(hexRaw)
      if (decoded) derChunks.push({ bytes: decoded, objectNum: span.objectNum })
    }

    if (derChunks.length === 0) {
      for (const [objectId, generation] of extractCertIndirectRefsFromObject(objectText)) {
        const indirect = resolveIndirectCertBytes(pdfBytes, objectId, generation)
        if (indirect) derChunks.push({ bytes: indirect, objectNum: objectId })
      }
    }

    if (derChunks.length === 0) {
      const literal = extractCertLiteralFromObject(objectText)
      if (literal) derChunks.push({ bytes: literal, objectNum: span.objectNum })
    }

    if (derChunks.length === 0 && byteRange) {
      const gapStart = byteRange[0] + byteRange[1]
      const gapEnd = byteRange[2]
      for (const bytes of scanDerCertificatesInObject(
        pdfBytes,
        span.start,
        span.end,
        gapStart,
        gapEnd
      )) {
        derChunks.push({ bytes, objectNum: span.objectNum })
      }
    }

    if (derChunks.length === 0) {
      for (const bytes of scanDerCertificatesInObject(pdfBytes, span.start, span.end, -1, -1)) {
        derChunks.push({ bytes, objectNum: span.objectNum })
      }
    }
  }

  if (derChunks.length === 0) {
    for (const bytes of extractCertFieldsNearAnchor(pdfBytes, anchor)) {
      derChunks.push({ bytes, objectNum: span?.objectNum ?? null })
    }
  }

  if (derChunks.length === 0) {
    for (const bytes of scanPdfTailForDerCertificates(pdfBytes, anchor, byteRange)) {
      derChunks.push({ bytes, objectNum: span?.objectNum ?? null })
    }
  }

  derChunks = dedupeCertDerChunks(derChunks)
  if (derChunks.length === 0) return []

  return decryptCertDerChunks(pdfBytes, derChunks, password)
}

export const readSignatureCertificates = async (
  pdfBytes: Uint8Array,
  anchor: number,
  password?: string,
  decryptedBytes?: Uint8Array,
  byteRange?: ByteRangeTuple
): Promise<Certificate[]> => {
  const sources = [pdfBytes, decryptedBytes].filter(
    (source): source is Uint8Array => source instanceof Uint8Array && source.length > 0
  )

  for (const source of sources) {
    const certificates = await readSignatureCertificatesFromSource(
      source,
      anchor,
      source === pdfBytes ? password : undefined,
      byteRange
    )
    if (certificates.length > 0) return certificates
  }

  return []
}

export const buildSignedBytes = (pdfBytes: Uint8Array, byteRange: ByteRangeTuple): Uint8Array => {
  const [o1, l1, o2, l2] = byteRange
  const part1 = pdfBytes.subarray(o1, o1 + l1)
  const part2 = pdfBytes.subarray(o2, o2 + l2)
  const signed = new Uint8Array(part1.length + part2.length)
  signed.set(part1, 0)
  signed.set(part2, part1.length)
  return signed
}

export const detectDssMarkers = (pdfBytes: Uint8Array): { hasDss: boolean; hasVri: boolean } => {
  const text = textDecoder.decode(pdfBytes)
  return {
    hasDss: text.includes('/DSS'),
    hasVri: text.includes('/VRI')
  }
}

export const pdfHasEncryption = (pdfBytes: Uint8Array): boolean => pdfHasEncryptionMarker(pdfBytes)

export const looksLikeRasterizedRebuild = (pdfBytes: Uint8Array): boolean => {
  const text = textDecoder.decode(pdfBytes)
  if (/\/ByteRange/i.test(text)) return false
  if (/<30[0-9A-Fa-f]{32,}/i.test(text)) return false

  const pageCount = (text.match(/\/Type\s*\/Page\b/gi) || []).length
  const jpegStreams = (text.match(/\/DCTDecode/gi) || []).length
  const pdfLibMarker = /\/Producer\b/i.test(text) && /pdf-lib/i.test(text)

  if (pdfLibMarker && pageCount > 0) return true
  if (pageCount > 0 && jpegStreams >= pageCount) return true
  return false
}

export class PdfSignatureParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfSignatureParseError'
  }
}

const buildExtracted = (
  pdfBytes: Uint8Array,
  byteRange: ByteRangeTuple,
  contents: { signatureBytes: Uint8Array; start: number; end: number },
  subFilter: string,
  extras?: Pick<ExtractedPdfSignature, 'certificates' | 'signingTime' | 'dictAnchor'>
): ExtractedPdfSignature => {
  const markers = detectDssMarkers(pdfBytes)
  return {
    subFilter: subFilter || 'adbe.pkcs7.detached',
    byteRange,
    contentsStart: contents.start,
    contentsEnd: contents.end,
    signatureBytes: contents.signatureBytes,
    signedBytes: buildSignedBytes(pdfBytes, byteRange),
    hasDss: markers.hasDss,
    hasVri: markers.hasVri,
    ...extras
  }
}

const tryExtractAtByteRange = (
  pdfBytes: Uint8Array,
  byteRangeIndex: number
): ExtractedPdfSignature | null => {
  const byteRange = parseByteRange(pdfBytes, byteRangeIndex)
  if (!byteRange) return null

  const gapStart = byteRange[0] + byteRange[1]
  const gapEnd = byteRange[2]

  let contents = extractContentsFromByteRange(pdfBytes, byteRange)
  if (!contents) {
    const searchStart = Math.max(0, gapStart - GAP_HEX_SEARCH_PADDING)
    const searchEnd = Math.min(pdfBytes.length, gapEnd + GAP_HEX_SEARCH_PADDING)
    contents = findLargestSigHexInWindow(pdfBytes, searchStart, searchEnd)
  }
  if (!contents) {
    const tailStart = Math.max(0, pdfBytes.length - SIG_HEX_WINDOW)
    contents = findLargestSigHexInWindow(pdfBytes, Math.max(tailStart, byteRangeIndex - SIG_CONTEXT_WINDOW), pdfBytes.length)
  }
  if (!contents) {
    contents = extractHexContentsNear(pdfBytes, byteRangeIndex)
  }
  const subFilter = readSubFilter(pdfBytes, byteRangeIndex)
  if (subFilter && !SUPPORTED_SUBFILTERS.has(subFilter)) {
    throw new PdfSignatureParseError(`Unsupported SubFilter: ${subFilter}`)
  }

  if (!contents && isX509RsaSubFilter(subFilter)) {
    contents = extractRawSignatureFromByteRange(pdfBytes, byteRange)
  }
  if (!contents) return null

  const extras = isX509RsaSubFilter(subFilter)
    ? {
        signingTime: readSignatureModDate(pdfBytes, byteRangeIndex),
        dictAnchor: byteRangeIndex
      }
    : { dictAnchor: byteRangeIndex }

  return buildExtracted(pdfBytes, byteRange, contents, subFilter, extras)
}

const findSignatureAnchors = (pdfBytes: Uint8Array): number[] => {
  const scanStart = Math.max(0, pdfBytes.length - TAIL_SCAN_BYTES)
  const tail = textDecoder.decode(pdfBytes.subarray(scanStart))
  const hits = new Set<number>()
  const patterns = [
    /\/Filter\s*\/Adobe\.PPKLite/gi,
    /\/SubFilter\s*\/adbe\.pkcs7/gi,
    /\/SubFilter\s*\/adbe\.x509/gi,
    /\/SubFilter\s*\/ETSI\.CAdES/gi,
    /\/Type\s*\/Sig\b/gi
  ]
  for (const re of patterns) {
    let match: RegExpExecArray | null
    while ((match = re.exec(tail))) {
      hits.add(scanStart + match.index)
    }
  }
  return [...hits]
}

const hexToRawSignatureBytes = (hexRaw: string): Uint8Array | null => {
  const hex = normalizeHexRaw(hexRaw)
  if (!hex || hex.length < 32) return null
  const signatureBytes = new Uint8Array(hex.length / 2)
  for (let j = 0; j < hex.length; j += 2) {
    signatureBytes[j / 2] = parseInt(hex.slice(j, j + 2), 16)
  }
  return signatureBytes
}

const extractRawSignatureFromByteRange = (
  pdfBytes: Uint8Array,
  byteRange: ByteRangeTuple
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  const gapStart = byteRange[0] + byteRange[1]
  const gapEnd = byteRange[2]
  if (gapEnd <= gapStart || gapEnd > pdfBytes.length) return null
  const gapText = textDecoder.decode(pdfBytes.subarray(gapStart, gapEnd))
  const labeled = gapText.match(contentsHexPattern)
  if (labeled?.index !== undefined) {
    const hexRaw = labeled[1]
    const signatureBytes = hexToRawSignatureBytes(hexRaw)
    if (signatureBytes) {
      const lt = labeled.index + labeled[0].indexOf('<')
      const hasClose = labeled[0].endsWith('>')
      const end = hasClose ? gapStart + lt + labeled[0].length : gapEnd
      return { signatureBytes, start: gapStart + lt, end }
    }
  }
  const gapBytes = extractGapHexBytes(pdfBytes, byteRange)
  if (!gapBytes) return null
  return { signatureBytes: gapBytes, start: gapStart, end: gapEnd }
}

const decodeGapHexRaw = (hexRaw: string): Uint8Array | null => {
  const hex = normalizeHexRaw(hexRaw)
  if (!hex || hex.length < 32) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let j = 0; j < hex.length; j += 2) {
    bytes[j / 2] = parseInt(hex.slice(j, j + 2), 16)
  }
  return bytes
}

const findSignatureObjectNumber = (pdfBytes: Uint8Array, anchor: number): number | null => {
  const start = Math.max(0, anchor - 16 * 1024)
  const chunk = textDecoder.decode(pdfBytes.subarray(start, anchor))
  const matches = [...chunk.matchAll(/(\d+)\s+0\s+obj/gi)]
  if (matches.length === 0) return null
  return Number(matches[matches.length - 1][1])
}

const findBinaryCmsInWindow = (
  pdfBytes: Uint8Array,
  searchStart: number,
  searchEnd: number
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  let best: { signatureBytes: Uint8Array; start: number; end: number } | null = null
  const end = Math.min(pdfBytes.length, searchEnd)
  for (let i = Math.max(0, searchStart); i < end - 4; i++) {
    if (pdfBytes[i] !== 0x30) continue
    const parsed = parseDerCms(pdfBytes, i)
    if (!parsed) continue
    if (!best || parsed.signatureBytes.length > best.signatureBytes.length) best = parsed
  }
  return best
}

const extractGapHexBytes = (
  pdfBytes: Uint8Array,
  byteRange: ByteRangeTuple
): Uint8Array | null => {
  const gapStart = byteRange[0] + byteRange[1]
  const gapEnd = byteRange[2]
  if (gapEnd <= gapStart || gapEnd > pdfBytes.length) return null
  const gapText = textDecoder.decode(pdfBytes.subarray(gapStart, gapEnd))
  const lt = gapText.indexOf('<')
  const gt = gapText.lastIndexOf('>')
  if (lt === -1 || gt <= lt) return null
  return decodeGapHexRaw(gapText.slice(lt + 1, gt))
}

const decryptGapContents = async (
  pdfBytes: Uint8Array,
  password: string,
  byteRange: ByteRangeTuple,
  anchor: number
): Promise<{ signatureBytes: Uint8Array; start: number; end: number } | null> => {
  const gapStart = byteRange[0] + byteRange[1]
  const gapEnd = byteRange[2]
  const gapBytes = extractGapHexBytes(pdfBytes, byteRange)
  if (!gapBytes) return null

  const parsed = parseDerCms(gapBytes, 0)
  if (parsed) {
    return { signatureBytes: parsed.signatureBytes, start: gapStart, end: gapEnd }
  }

  const objectNum = findSignatureObjectNumber(pdfBytes, anchor)
  if (objectNum === null) return null

  const encryption = await getPdfFileEncryptionKey(pdfBytes, password)
  const decrypted = await decryptPdfObjectBytes(gapBytes, objectNum, 0, encryption)
  const cms = parseDerCms(decrypted, 0)
  if (cms) {
    return { signatureBytes: cms.signatureBytes, start: gapStart, end: gapEnd }
  }
  return { signatureBytes: decrypted, start: gapStart, end: gapEnd }
}

const findContentsInPdf = (
  pdfBytes: Uint8Array,
  anchorHints: number[]
): { signatureBytes: Uint8Array; start: number; end: number } | null => {
  const tail = findCmsHexAtTail(pdfBytes)
  if (tail) return tail

  const binaryTail = findBinaryCmsInWindow(
    pdfBytes,
    Math.max(0, pdfBytes.length - SIG_HEX_WINDOW),
    pdfBytes.length
  )
  if (binaryTail) return binaryTail

  const full = findLargestSigHexInWindow(pdfBytes, 0, pdfBytes.length)
  if (full) return full

  const anchors = [...new Set([...anchorHints, ...findSignatureAnchors(pdfBytes)])].sort((a, b) => b - a)
  for (const anchor of anchors) {
    const searchStart = Math.max(0, anchor - GAP_HEX_SEARCH_PADDING)
    const searchEnd = Math.min(pdfBytes.length, anchor + CONTENTS_SEARCH_AHEAD)
    const near =
      findLargestSigHexInWindow(pdfBytes, searchStart, searchEnd) ||
      findBinaryCmsInWindow(pdfBytes, searchStart, searchEnd) ||
      extractHexContentsNear(pdfBytes, anchor)
    if (near) return near
  }

  return findBinaryCmsInWindow(pdfBytes, 0, pdfBytes.length)
}

/**
 * Encrypted e-Aadhaar: ByteRange + signed digest must come from the original file bytes.
 * CMS hex usually only becomes readable after decryption (offsets in a saved decrypt do not match).
 */
export const extractPdfSignatureWithDecryptedContents = async (
  originalBytes: Uint8Array,
  decryptedBytes: Uint8Array,
  password?: string
): Promise<ExtractedPdfSignature> => {
  const byteRangeHits = findByteRangeHits(originalBytes)
  if (byteRangeHits.length === 0) {
    throw new PdfSignatureParseError('No /ByteRange found in the original encrypted PDF.')
  }

  const ordered = [...byteRangeHits].sort((a, b) => {
    const aSig = isSignatureDictionaryContext(originalBytes, a) ? 1 : 0
    const bSig = isSignatureDictionaryContext(originalBytes, b) ? 1 : 0
    return bSig - aSig || b - a
  })

  for (const byteRangeIndex of ordered) {
    const byteRange = parseByteRange(originalBytes, byteRangeIndex)
    if (!byteRange) continue

    const subFilter = readSubFilter(originalBytes, byteRangeIndex)
    if (subFilter && !SUPPORTED_SUBFILTERS.has(subFilter)) {
      throw new PdfSignatureParseError(`Unsupported SubFilter: ${subFilter}`)
    }

    let contents =
      (password ? await decryptGapContents(originalBytes, password, byteRange, byteRangeIndex) : null) ||
      extractContentsFromByteRange(originalBytes, byteRange) ||
      (isX509RsaSubFilter(subFilter)
        ? extractRawSignatureFromByteRange(originalBytes, byteRange)
        : null) ||
      findContentsInPdf(originalBytes, [byteRangeIndex]) ||
      findContentsInPdf(decryptedBytes, [byteRangeIndex])

    if (!contents) continue

    const certificates = isX509RsaSubFilter(subFilter)
      ? await readSignatureCertificates(
          originalBytes,
          byteRangeIndex,
          password,
          decryptedBytes,
          byteRange
        )
      : undefined
    const signingTime = isX509RsaSubFilter(subFilter)
      ? readSignatureModDate(originalBytes, byteRangeIndex)
      : undefined

    return buildExtracted(originalBytes, byteRange, contents, subFilter, {
      certificates,
      signingTime,
      dictAnchor: byteRangeIndex
    })
  }

  throw new PdfSignatureParseError(
    'Could not locate PKCS#7 /Contents after unlocking. The signature layout may not be supported offline yet.'
  )
}

const tryAllByteRangeHits = (pdfBytes: Uint8Array, byteRangeHits: number[]): ExtractedPdfSignature | null => {
  const ordered = [...byteRangeHits].sort((a, b) => {
    const aSig = isSignatureDictionaryContext(pdfBytes, a) ? 1 : 0
    const bSig = isSignatureDictionaryContext(pdfBytes, b) ? 1 : 0
    return bSig - aSig || b - a
  })

  for (const byteRangeIndex of ordered) {
    try {
      const extracted = tryExtractAtByteRange(pdfBytes, byteRangeIndex)
      if (extracted) return extracted
    } catch (err) {
      if (err instanceof PdfSignatureParseError) throw err
    }
  }
  return null
}

export const extractPdfSignature = (pdfBytes: Uint8Array): ExtractedPdfSignature => {
  const byteRangeHits = findByteRangeHits(pdfBytes)

  if (byteRangeHits.length > 0) {
    const extracted = tryAllByteRangeHits(pdfBytes, byteRangeHits)
    if (extracted) return extracted

    if (pdfHasEncryption(pdfBytes)) {
      throw new PdfSignatureParseError(
        'PDF is encrypted and the signature block is not readable from raw bytes. Enter your e-Aadhaar password below, then verify again.'
      )
    }

    throw new PdfSignatureParseError(
      'Found /ByteRange but could not read signature /Contents. If this is a password-protected e-Aadhaar, enter your PDF password and verify again.'
    )
  }

  const tailCms = findCmsHexAtTail(pdfBytes)
  if (tailCms) {
    const byteRange = inferByteRangeFromContents(pdfBytes, tailCms)
    if (byteRange[1] > 0 && byteRange[3] > 0) {
      const subFilter = readSubFilter(pdfBytes, tailCms.start)
      if (subFilter && !SUPPORTED_SUBFILTERS.has(subFilter)) {
        throw new PdfSignatureParseError(`Unsupported SubFilter: ${subFilter}`)
      }
      return buildExtracted(pdfBytes, byteRange, tailCms, subFilter)
    }
  }

  if (looksLikeRasterizedRebuild(pdfBytes)) {
    throw new PdfSignatureParseError(
      'This PDF looks like a rebuilt copy (for example from Unlock PDF). That process rasterizes pages and removes the UIDAI digital signature. Use the original password-protected e-Aadhaar file from myAadhaar/UIDAI instead.'
    )
  }

  if (pdfHasEncryption(pdfBytes)) {
    throw new PdfSignatureParseError(
      'PDF is encrypted and the signature block is not readable from raw bytes. Enter your e-Aadhaar password below, then verify again.'
    )
  }

  throw new PdfSignatureParseError(
    'No digital signature found. Use the original digitally signed e-Aadhaar PDF from myAadhaar/UIDAI (not a scan, screenshot, printout, or Unlock PDF output).'
  )
}

export const isSupportedSubFilter = (subFilter: string): boolean =>
  SUPPORTED_SUBFILTERS.has(subFilter)
