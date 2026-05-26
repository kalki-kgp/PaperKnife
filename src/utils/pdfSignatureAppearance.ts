/**
 * PaperKnife - Print-ready signature copy builder (Verify Signature, Phase 1)
 * Copyright (C) 2026 kalki-kgp
 *
 * Produces a "Print Ready" PDF that copies every original page and overlays
 * a green validation band on page 1 plus a per-page footer attesting
 * verification.
 *
 * Path selection:
 *   - Unencrypted source → pdf-lib copyPages (vectors preserved 1:1, QR safe).
 *   - Encrypted source (with password) → pdfjs decrypts and renders each page
 *     to a 300 DPI JPEG which we re-embed. pdf-lib can't decrypt content
 *     streams on its own; rasterizing at 300 DPI keeps Aadhaar QR codes
 *     scannable in print. The signature math is still validated against the
 *     original signed bytes — the rasterization only affects what gets
 *     printed.
 */

import { PDFArray, PDFDict, PDFDocument, PDFFont, PDFName, PDFNumber, PDFPage, PDFRef, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const PRINT_DPI = 300
const POINTS_PER_INCH = 72
const RASTER_SCALE = PRINT_DPI / POINTS_PER_INCH

export interface PrintCopyOptions {
  signerLabel: string
  signingTime?: Date | null
  trustLabel: string
  /** Optional password if the source PDF is encrypted */
  password?: string
}

export interface PrintCopyResult {
  bytes: Uint8Array
  buildPath: 'vector-copy' | 'raster-decrypted'
}

export async function buildPrintReadyCopy(
  originalPdfBytes: Uint8Array,
  options: PrintCopyOptions,
): Promise<PrintCopyResult> {
  const outDoc = await PDFDocument.create()
  const helvetica = await outDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await outDoc.embedFont(StandardFonts.HelveticaBold)

  // Source-of-truth encryption check: ask pdf-lib directly. The
  // pdfHasEncryptionMarker heuristic in pdfHelpers misses some V=5 docs
  // because their /Encrypt sits inside a compressed xref stream.
  let sourceDoc: PDFDocument | null = null
  let sourceIsEncrypted = false
  try {
    sourceDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true })
    sourceIsEncrypted = sourceDoc.isEncrypted
  } catch {
    sourceIsEncrypted = true
  }

  // Capture original widget positions BEFORE building the output. /Rect is
  // a numeric array, never encrypted, so this works on locked PDFs too.
  const widgetRects = sourceDoc ? extractWidgetRects(sourceDoc) : []

  let buildPath: PrintCopyResult['buildPath']
  if (sourceIsEncrypted) {
    if (!options.password) {
      throw new Error('This PDF is encrypted. Enter the password to generate a print copy.')
    }
    await populateFromEncryptedSource(outDoc, originalPdfBytes, options.password)
    buildPath = 'raster-decrypted'
  } else if (sourceDoc) {
    await populateByCopyingPagesFromDoc(outDoc, sourceDoc)
    buildPath = 'vector-copy'
  } else {
    await populateByCopyingPages(outDoc, originalPdfBytes)
    buildPath = 'vector-copy'
  }

  // The original signature widget + AcroForm references confuse Acrobat
  // into showing a "?" on the print copy. Strip them — the verification
  // band/footer we add is the source of truth.
  stripSignatureScaffolding(outDoc)

  // Cover the baked-in "Validity unknown" / question-mark stamp from the
  // original signature appearance stream by painting a verified tick at
  // the same position on the output page.
  overlayVerifiedStamps(outDoc, widgetRects, options, helvetica, helveticaBold)

  const pages = outDoc.getPages()
  pages.forEach((page, idx) => {
    drawFooter(page, helvetica, options, idx + 1, pages.length)
  })
  if (pages[0]) drawValidationBand(pages[0], helveticaBold, helvetica, options)

  return { bytes: await outDoc.save(), buildPath }
}

interface WidgetRect {
  pageIndex: number
  llx: number
  lly: number
  urx: number
  ury: number
}

function extractWidgetRects(doc: PDFDocument): WidgetRect[] {
  const out: WidgetRect[] = []
  doc.getPages().forEach((page, pageIndex) => {
    let annots: unknown
    try {
      annots = page.node.lookup(PDFName.of('Annots'))
    } catch {
      return
    }
    if (!(annots instanceof PDFArray)) return
    for (let i = 0; i < annots.size(); i++) {
      const item = annots.get(i)
      const annot = item instanceof PDFRef ? doc.context.lookup(item) : item
      if (!(annot instanceof PDFDict)) continue
      const subtype = annot.lookup(PDFName.of('Subtype'))
      if (!(subtype instanceof PDFName)) continue
      if (subtype.asString() !== '/Widget') continue
      const rect = annot.lookup(PDFName.of('Rect'))
      if (!(rect instanceof PDFArray) || rect.size() < 4) continue
      const llx = numberAt(rect, 0)
      const lly = numberAt(rect, 1)
      const urx = numberAt(rect, 2)
      const ury = numberAt(rect, 3)
      if (llx === null || lly === null || urx === null || ury === null) continue
      const w = Math.abs(urx - llx)
      const h = Math.abs(ury - lly)
      // Filter out tiny widgets (button decorations, form-field tick boxes).
      if (w < 40 || h < 15) continue
      out.push({
        pageIndex,
        llx: Math.min(llx, urx),
        lly: Math.min(lly, ury),
        urx: Math.max(llx, urx),
        ury: Math.max(lly, ury),
      })
    }
  })
  return out
}

function numberAt(arr: PDFArray, idx: number): number | null {
  const v = arr.get(idx)
  if (v instanceof PDFNumber) return v.asNumber()
  return null
}

function overlayVerifiedStamps(
  outDoc: PDFDocument,
  rects: WidgetRect[],
  options: PrintCopyOptions,
  font: PDFFont,
  fontBold: PDFFont,
) {
  const pages = outDoc.getPages()
  const fill = rgb(0.92, 0.99, 0.94)
  const border = rgb(0.18, 0.62, 0.36)
  const titleColor = rgb(0.08, 0.32, 0.18)
  const subtleColor = rgb(0.18, 0.36, 0.24)

  for (const r of rects) {
    if (r.pageIndex >= pages.length) continue
    const page = pages[r.pageIndex]
    const w = r.urx - r.llx
    const h = r.ury - r.lly

    // Solid white underlay first, so the original stamp can't bleed
    // through (especially in the raster build path where the page is
    // already a JPEG of the original content).
    page.drawRectangle({ x: r.llx, y: r.lly, width: w, height: h, color: rgb(1, 1, 1) })

    // Verified colour fill + dark green border.
    page.drawRectangle({
      x: r.llx, y: r.lly, width: w, height: h,
      color: fill,
      borderColor: border,
      borderWidth: 1.4,
    })

    // Vector tick (no Unicode glyph needed).
    const tickSize = Math.min(h * 0.55, 18)
    const tickX = r.llx + 8
    const tickMidY = r.lly + h / 2
    page.drawLine({
      start: { x: tickX, y: tickMidY },
      end: { x: tickX + tickSize * 0.35, y: tickMidY - tickSize * 0.35 },
      color: border,
      thickness: 2.2,
    })
    page.drawLine({
      start: { x: tickX + tickSize * 0.35, y: tickMidY - tickSize * 0.35 },
      end: { x: tickX + tickSize * 0.9, y: tickMidY + tickSize * 0.45 },
      color: border,
      thickness: 2.2,
    })

    const textX = tickX + tickSize + 8
    const titleSize = Math.min(11, h * 0.32)
    const subSize = Math.min(8, h * 0.22)
    const titleY = r.lly + h * 0.58 - titleSize / 2
    const subY = r.lly + h * 0.28 - subSize / 2

    page.drawText('Signature verified', {
      x: textX, y: titleY, size: titleSize, font: fontBold, color: titleColor,
    })
    page.drawText(`Signer: ${options.signerLabel} · ${options.trustLabel}`, {
      x: textX, y: subY, size: subSize, font, color: subtleColor,
    })
  }
}

async function populateByCopyingPages(outDoc: PDFDocument, originalPdfBytes: Uint8Array) {
  const originalDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true })
  await populateByCopyingPagesFromDoc(outDoc, originalDoc)
}

async function populateByCopyingPagesFromDoc(outDoc: PDFDocument, originalDoc: PDFDocument) {
  const indices = originalDoc.getPageIndices()
  const copied = await outDoc.copyPages(originalDoc, indices)
  copied.forEach(page => outDoc.addPage(page))
}

function stripSignatureScaffolding(outDoc: PDFDocument) {
  // Drop annotations on every page. Print copy doesn't need form fields,
  // signature widgets, or links — and removing them prevents Acrobat from
  // treating leftover /Widget/Sig refs as a "validity unknown" signature.
  for (const page of outDoc.getPages()) {
    page.node.delete(PDFName.of('Annots'))
  }
  // Belt-and-suspenders: remove the document-level /AcroForm dictionary.
  outDoc.catalog.delete(PDFName.of('AcroForm'))
  outDoc.catalog.delete(PDFName.of('Perms'))
}

async function populateFromEncryptedSource(outDoc: PDFDocument, originalPdfBytes: Uint8Array, password: string) {
  const loadingTask = pdfjsLib.getDocument({ data: originalPdfBytes, password })
  const pdf = await loadingTask.promise

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const baseViewport = page.getViewport({ scale: 1 })
    const renderViewport = page.getViewport({ scale: RASTER_SCALE })

    const canvas = document.createElement('canvas')
    canvas.width = renderViewport.width
    canvas.height = renderViewport.height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport: renderViewport }).promise

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95)
    const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(',')[1]), c => c.charCodeAt(0))
    const img = await outDoc.embedJpg(jpegBytes)
    const newPage = outDoc.addPage([baseViewport.width, baseViewport.height])
    newPage.drawImage(img, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height })

    canvas.width = 0
    canvas.height = 0
  }
}

function drawValidationBand(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  options: PrintCopyOptions,
) {
  const { width, height } = page.getSize()
  const bandHeight = 44
  const padding = 12

  page.drawRectangle({
    x: padding,
    y: height - bandHeight - padding,
    width: width - padding * 2,
    height: bandHeight,
    color: rgb(0.92, 0.99, 0.94),
    borderColor: rgb(0.18, 0.62, 0.36),
    borderWidth: 1.2,
  })

  page.drawRectangle({
    x: padding + 8,
    y: height - bandHeight - padding + bandHeight / 2 - 6,
    width: 12,
    height: 12,
    color: rgb(0.18, 0.62, 0.36),
  })

  const title = 'Digital signature verified'
  page.drawText(title, {
    x: padding + 28,
    y: height - padding - 18,
    size: 11,
    font: bold,
    color: rgb(0.08, 0.32, 0.18),
  })

  const subtitle = formatSubtitle(options)
  page.drawText(subtitle, {
    x: padding + 28,
    y: height - padding - 32,
    size: 8,
    font: regular,
    color: rgb(0.18, 0.36, 0.24),
  })
}

function drawFooter(
  page: PDFPage,
  font: PDFFont,
  options: PrintCopyOptions,
  pageNumber: number,
  pageCount: number,
) {
  const text = `Verified by PaperKnife · Signer: ${options.signerLabel} · ${options.trustLabel}${
    options.signingTime ? ` · Signed ${formatDate(options.signingTime)}` : ''
  } · Page ${pageNumber}/${pageCount}`
  page.drawText(text, {
    x: 18,
    y: 12,
    size: 7,
    font,
    color: rgb(0.35, 0.35, 0.35),
  })
}

function formatSubtitle(options: PrintCopyOptions): string {
  const parts = [`Signer: ${options.signerLabel}`, options.trustLabel]
  if (options.signingTime) parts.push(`Signed ${formatDate(options.signingTime)}`)
  return parts.join('   ·   ')
}

function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${dd}-${mm}-${yyyy} ${hh}:${min} UTC`
}
