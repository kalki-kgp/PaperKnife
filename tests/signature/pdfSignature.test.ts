import { describe, expect, test } from 'bun:test'
import {
  PdfSignatureParseError,
  buildSignedBytes,
  extractPdfSignature,
  looksLikeRasterizedRebuild
} from '../../src/utils/signature/pdfSignature'
import {
  buildSignedPdfFixture,
  buildSignedPdfWithPageContentsRef,
  buildSignedPdfWithoutByteRangeLabel
} from '../helpers/pdfTestUtils'

describe('pdfSignature', () => {
  test('extracts CMS hex from byte range gap when Contents precedes ByteRange in dict', () => {
    const cmsHex = '3082' + 'ef'.repeat(120)
    const contentsField = `<${cmsHex}>`
    const prefix = '%PDF-1.4\n'
    const body = '1 0 obj<<>>endobj\n'
    const gapBefore = 'X'.repeat(200)
    const sigOpen =
      '2 0 obj<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /Contents '
    const sigClose = ' /ByteRange '
    const draft = prefix + body + sigOpen + contentsField + gapBefore + sigClose + '[0 0 0 0] >>endobj\n%%EOF\n'
    const contentsStart = draft.indexOf('<')
    const contentsEnd = draft.indexOf('>') + 1
    const byteRange = `[0 ${contentsStart} ${contentsEnd} ${draft.length - contentsEnd}]`
    const final = draft.replace('[0 0 0 0]', byteRange)
    const pdf = new TextEncoder().encode(final)
    const extracted = extractPdfSignature(pdf)
    expect(extracted.signatureBytes[0]).toBe(0x30)
    expect(extracted.byteRange[1]).toBe(contentsStart)
  })

  test('extracts ByteRange and signed bytes', () => {
    const cmsHex = '3082' + 'ab'.repeat(64)
    const pdf = buildSignedPdfFixture(cmsHex)
    const extracted = extractPdfSignature(pdf)
    expect(extracted.byteRange).toHaveLength(4)
    expect(extracted.signedBytes.length).toBe(extracted.byteRange[1] + extracted.byteRange[3])
    const rebuilt = buildSignedBytes(pdf, extracted.byteRange)
    expect(Buffer.from(rebuilt)).toEqual(Buffer.from(extracted.signedBytes))
  })

  test('rejects malformed ByteRange', () => {
    const broken = new TextEncoder().encode('%PDF-1.4\n<< /ByteRange [0 10] /Contents <ab> >>')
    expect(() => extractPdfSignature(broken)).toThrow(PdfSignatureParseError)
  })

  test('strips padded Contents hex', () => {
    const cmsHex = '3082a1b2c3d4'
    const pdf = buildSignedPdfFixture(cmsHex)
    const extracted = extractPdfSignature(pdf)
    expect(extracted.signatureBytes[0]).toBe(0x30)
    expect(extracted.signatureBytes[1]).toBe(0x82)
  })

  test('falls back to CMS hex at tail when /ByteRange label is absent', () => {
    const cmsHex = '3082' + 'cd'.repeat(80)
    const pdf = buildSignedPdfWithoutByteRangeLabel(cmsHex)
    const extracted = extractPdfSignature(pdf)
    expect(extracted.signatureBytes[0]).toBe(0x30)
    expect(extracted.byteRange[0]).toBe(0)
  })

  test('ignores page /Contents refs and reads signature hex', () => {
    const cmsHex = '3082a1b2c3d4e5f60708'
    const pdf = buildSignedPdfWithPageContentsRef(cmsHex)
    const extracted = extractPdfSignature(pdf)
    expect(extracted.signatureBytes[0]).toBe(0x30)
    expect(extracted.signatureBytes[1]).toBe(0x82)
  })

  test('detects rasterized unlock-style rebuild without signature', () => {
    const unlockLike = new TextEncoder().encode(
      '%PDF-1.4\n1 0 obj<< /Type /Page /Contents 2 0 R >>endobj\n' +
        '2 0 obj<< /Filter /DCTDecode /Length 8 >>stream\nfakejpeg\nendstream\nendobj\n%%EOF\n'
    )
    expect(looksLikeRasterizedRebuild(unlockLike)).toBe(true)
  })

  test('reads hex CMS when byte range gap starts with Contents without slash', () => {
    const cmsHex = '3082' + 'cd'.repeat(100)
    const contentsField = `<${cmsHex}>`
    const prefix = '%PDF-1.4\n'
    const body = '1 0 obj<<>>endobj\n'
    const gapBefore = 'Contents ' + contentsField
    const sigOpen =
      '2 0 obj<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange '
    const draft = prefix + body + sigOpen + '[0 0 0 0] ' + gapBefore + ' >>endobj\n%%EOF\n'
    const contentsStart = draft.indexOf('<')
    const contentsEnd = draft.indexOf('>') + 1
    const byteRange = `[0 ${contentsStart} ${contentsEnd} ${draft.length - contentsEnd}]`
    const pdf = new TextEncoder().encode(draft.replace('[0 0 0 0]', byteRange))
    const extracted = extractPdfSignature(pdf)
    expect(extracted.signatureBytes[0]).toBe(0x30)
    expect(extracted.signatureBytes[1]).toBe(0x82)
  })

  test('reads hex CMS when byte range gap includes /Contents label', () => {
    const cmsHex = '3082' + 'ab'.repeat(80)
    const pdf = buildSignedPdfFixture(cmsHex)
    const text = new TextDecoder('latin1').decode(pdf)
    const br = text.match(/\/ByteRange\s*\[(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/i)
    expect(br).not.toBeNull()
    const gapStart = Number(br![1]) + Number(br![2])
    const gapEnd = Number(br![3])
    const gap = text.slice(gapStart, gapEnd)
    expect(gap).toMatch(/Contents\s*</i)
    const extracted = extractPdfSignature(pdf)
    expect(extracted.signatureBytes[0]).toBe(0x30)
    expect(extracted.signatureBytes[1]).toBe(0x82)
  })

  test('detects DSS markers when present', () => {
    const cmsHex = '3082a1b2' + '00'.repeat(60)
    const pdf = buildSignedPdfFixture(cmsHex)
    const suffix = new TextEncoder().encode('\n/DSS ')
    const withDss = new Uint8Array(pdf.length + suffix.length)
    withDss.set(pdf)
    withDss.set(suffix, pdf.length)
    const extracted = extractPdfSignature(withDss)
    expect(extracted.hasDss).toBe(true)
  })
})
