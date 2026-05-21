/**
 * PaperKnife - test helpers
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'

export const buildMinimalPdf = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([300, 400])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('PaperKnife signature fixture', { x: 40, y: 360, size: 12, font })
  return doc.save({ useObjectStreams: false })
}

export const extractObjectStream = (pdfBytes: Uint8Array, objectId: number): Uint8Array | null => {
  const text = new TextDecoder('latin1').decode(pdfBytes)
  const re = new RegExp(`${objectId} 0 obj[\\s\\S]*?stream\\r?\\n([\\s\\S]*?)\\r?\\nendstream`)
  const match = text.match(re)
  if (!match) return null
  return new TextEncoder().encode(match[1])
}

const injectByteRange = (draft: string, rangePlaceholder: string, contentsField: string): string => {
  let pdf = draft
  for (let attempt = 0; attempt < 4; attempt++) {
    const contentsStart = pdf.indexOf(contentsField)
    if (contentsStart === -1) throw new Error('signature Contents field not found in fixture')
    const contentsEnd = contentsStart + contentsField.length
    const byteRange = `[0 ${contentsStart} ${contentsEnd} ${pdf.length - contentsEnd}]`
    const next = pdf.replace(rangePlaceholder, byteRange)
    if (next === pdf) return pdf
    pdf = next
  }
  return pdf
}

export const buildSignedPdfWithPageContentsRef = (cmsHex: string): Uint8Array => {
  const header = '%PDF-1.4\n'
  const body =
    '1 0 obj<< /Type /Page /Contents 2 0 R >>endobj\n' +
    '2 0 obj<< /Length 8 >>stream\n/pagecon\nendstream\nendobj\n'
  const raw = cmsHex.replace(/[^0-9A-Fa-f]/g, '')
  const contentsHex = (raw.startsWith('3082') ? raw : `3082${raw}`).padEnd(128, '0')
  const contentsField = `<${contentsHex}>`
  const prefix = header + body
  const rangePlaceholder = '[0 0 0 0]'
  const sigDraft =
    '3 0 obj<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached ' +
    `/ByteRange ${rangePlaceholder} /Contents ${contentsField} >>endobj\n`
  const tail = '%%EOF\n'
  const draft = prefix + sigDraft + tail
  return new TextEncoder().encode(injectByteRange(draft, rangePlaceholder, contentsField))
}

export const buildSignedPdfWithoutByteRangeLabel = (cmsHex: string): Uint8Array => {
  const header = '%PDF-1.4\n'
  const body = '1 0 obj<<>>endobj\n'
  const contentsHex = cmsHex.replace(/[^0-9A-Fa-f]/g, '').padEnd(128, '0')
  if (!contentsHex.startsWith('3082')) {
    throw new Error('fixture cms hex must start with 3082')
  }
  const sig =
    `2 0 obj<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached ` +
    `/Contents <${contentsHex}> >>endobj\n`
  return new TextEncoder().encode(header + body + sig + '%%EOF\n')
}

export const buildSignedPdfFixture = (cmsHex: string): Uint8Array => {
  const header = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const body =
    '1 0 obj<<>>endobj\n' +
    '2 0 obj<< /Type /Catalog /Pages 3 0 R >>endobj\n' +
    '3 0 obj<< /Type /Pages /Kids [4 0 R] /Count 1 >>endobj\n' +
    '4 0 obj<< /Type /Page /Parent 3 0 R /MediaBox [0 0 200 200] /Contents 5 0 R >>endobj\n' +
    '5 0 obj<< /Length 44 >>stream\nBT /F1 12 Tf 50 150 Td (Test) Tj ET\nendstream\nendobj\n'
  const tail = 'xref\n0 7\ntrailer<< /Root 2 0 R >>\nstartxref\n0\n%%EOF\n'
  const contentsHex = cmsHex.replace(/[^0-9A-Fa-f]/g, '').padEnd(128, '0')
  const contentsField = `<${contentsHex}>`
  const prefix = header + body
  const rangePlaceholder = '[0 0 0 0]'
  const sigDraft =
    '6 0 obj<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached ' +
    `/ByteRange ${rangePlaceholder} /Contents ${contentsField} >>endobj\n`
  const draft = prefix + sigDraft + tail
  return new TextEncoder().encode(injectByteRange(draft, rangePlaceholder, contentsField))
}

export const buildX509SignedPdfFixture = (
  signatureHex: string,
  certHex: string,
  contentsPadChars = 16384
): Uint8Array => {
  const header = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const body =
    '1 0 obj<<>>endobj\n' +
    '2 0 obj<< /Type /Catalog /Pages 3 0 R >>endobj\n' +
    '3 0 obj<< /Type /Pages /Kids [4 0 R] /Count 1 >>endobj\n' +
    '4 0 obj<< /Type /Page /Parent 3 0 R /MediaBox [0 0 200 200] /Contents 5 0 R >>endobj\n' +
    '5 0 obj<< /Length 44 >>stream\nBT /F1 12 Tf 50 150 Td (Test) Tj ET\nendstream\nendobj\n'
  const tail = 'xref\n0 7\ntrailer<< /Root 2 0 R >>\nstartxref\n0\n%%EOF\n'
  const paddedSigHex = signatureHex.replace(/[^0-9A-Fa-f]/g, '').padEnd(contentsPadChars, '0')
  const contentsField = `<${paddedSigHex}>`
  const certField = `[ <${certHex.replace(/[^0-9A-Fa-f]/g, '')}> ]`
  const prefix = header + body
  const rangePlaceholder = '[0 0 0 0]'
  const sigDraft =
    '6 0 obj<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.x509.rsa_sha1 ' +
    `/ByteRange ${rangePlaceholder} /Contents ${contentsField} /Cert ${certField} ` +
    `/M (D:20240115103045+05'30') >>endobj\n`
  const draft = prefix + sigDraft + tail
  return new TextEncoder().encode(injectByteRange(draft, rangePlaceholder, contentsField))
}
