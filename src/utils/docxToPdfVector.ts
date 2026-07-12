/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import mammoth from 'mammoth'
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'

/**
 * Vector Word -> PDF: convert a .docx to a PDF whose text is real, selectable
 * text (not a rasterized image). Uses mammoth to recover semantic HTML, then
 * lays it out with pdf-lib's standard fonts. Complex layout (columns, exact
 * spacing, advanced tables) is intentionally simplified — this trades layout
 * fidelity for a searchable, copy-pasteable, smaller PDF.
 */

// A4 in points, 1-inch (72pt) margins.
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 64
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const CONTENT_BOTTOM = MARGIN

const BASE_SIZE = 11
const LINE_FACTOR = 1.35
const PARAGRAPH_GAP = 6
const LIST_INDENT = 20
const HEADING_SIZES: Record<string, number> = { h1: 24, h2: 19, h3: 16, h4: 14, h5: 12, h6: 11 }

const LINK_COLOR = rgb(0.12, 0.33, 0.74)
const TEXT_COLOR = rgb(0.1, 0.1, 0.1)
const TABLE_BORDER = rgb(0.8, 0.8, 0.8)
const TABLE_HEADER_FILL = rgb(0.94, 0.94, 0.94)

interface Fonts {
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
  boldItalic: PDFFont
}

interface InlineCtx {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  link?: string
  sup: boolean
  sub: boolean
}

interface Token {
  text?: string
  br?: boolean
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  link?: string
  sup: boolean
  sub: boolean
}

interface TableCell {
  tokens: Token[]
  header: boolean
}

type Block =
  | { kind: 'para'; tokens: Token[]; size: number; bold: boolean; indent: number; marker?: string; align: 'left' | 'center' | 'right'; gapAfter: number }
  | { kind: 'image'; data: Uint8Array; isPng: boolean }
  | { kind: 'table'; rows: TableCell[][] }
  | { kind: 'rule' }
  | { kind: 'space'; height: number }

function pickFont(fonts: Fonts, bold: boolean, italic: boolean): PDFFont {
  if (bold && italic) return fonts.boldItalic
  if (bold) return fonts.bold
  if (italic) return fonts.italic
  return fonts.regular
}

// --- Inline extraction -----------------------------------------------------

// Block-level tags stop inline extraction so nested lists / paragraphs are not
// pulled into their parent's text run (they are emitted as their own blocks).
const BLOCK_TAGS = new Set([
  'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'blockquote', 'hr', 'div', 'section', 'header', 'footer', 'article',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
])

function isBlockElement(node: Node): node is HTMLElement {
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  return BLOCK_TAGS.has((node as HTMLElement).tagName.toLowerCase())
}

function extractInline(node: Node, ctx: InlineCtx, out: Token[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.textContent ?? ''
    const words = raw.split(/\s+/).filter(Boolean)
    for (const word of words) {
      out.push({ text: word, bold: ctx.bold, italic: ctx.italic, underline: ctx.underline, strike: ctx.strike, link: ctx.link, sup: ctx.sup, sub: ctx.sub })
    }
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') {
    out.push({ br: true, bold: ctx.bold, italic: ctx.italic, underline: ctx.underline, strike: ctx.strike, sup: ctx.sup, sub: ctx.sub })
    return
  }
  if (BLOCK_TAGS.has(tag)) return

  const next: InlineCtx = { ...ctx }
  if (tag === 'strong' || tag === 'b') next.bold = true
  if (tag === 'em' || tag === 'i') next.italic = true
  if (tag === 'u' || tag === 'ins') next.underline = true
  if (tag === 's' || tag === 'strike' || tag === 'del') next.strike = true
  if (tag === 'sup') next.sup = true
  if (tag === 'sub') next.sub = true
  if (tag === 'a') next.link = el.getAttribute('href') || ctx.link

  el.childNodes.forEach(child => extractInline(child, next, out))
}

function inlineTokens(el: Element): Token[] {
  const out: Token[] = []
  const base: InlineCtx = { bold: false, italic: false, underline: false, strike: false, sup: false, sub: false }
  el.childNodes.forEach(child => extractInline(child, base, out))
  return out
}

function plainTokens(el: Element): Token[] {
  return (el.textContent ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(text => ({ text, bold: false, italic: false, underline: false, strike: false, sup: false, sub: false }))
}

function dataUriToImage(src: string): { data: Uint8Array; isPng: boolean } | null {
  const match = /^data:(image\/[a-z+]+);base64,(.*)$/i.exec(src)
  if (!match) return null
  const mime = match[1].toLowerCase()
  const isPng = mime.includes('png')
  if (!isPng && !mime.includes('jpeg') && !mime.includes('jpg')) return null
  try {
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { data: bytes, isPng }
  } catch {
    return null
  }
}

function textAlign(el: Element): 'left' | 'center' | 'right' {
  const align = (el as HTMLElement).style?.textAlign
  if (align === 'center') return 'center'
  if (align === 'right') return 'right'
  return 'left'
}

// --- Block extraction ------------------------------------------------------

function collectBlocks(container: Element, blocks: Block[], level = 0) {
  container.childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) processElement(node as HTMLElement, blocks, level)
  })
}

function processElement(el: HTMLElement, blocks: Block[], level: number) {
  const tag = el.tagName.toLowerCase()

  if (tag in HEADING_SIZES) {
    blocks.push({ kind: 'para', tokens: inlineTokens(el), size: HEADING_SIZES[tag], bold: true, indent: 0, align: textAlign(el), gapAfter: PARAGRAPH_GAP })
    return
  }

  if (tag === 'p') {
    // A paragraph may contain inline images; split text and images into blocks.
    const imgs = el.querySelectorAll('img')
    const tokens = inlineTokens(el)
    if (tokens.length > 0) {
      blocks.push({ kind: 'para', tokens, size: BASE_SIZE, bold: false, indent: level * LIST_INDENT, align: textAlign(el), gapAfter: PARAGRAPH_GAP })
    }
    imgs.forEach(img => {
      const parsed = dataUriToImage(img.getAttribute('src') || '')
      if (parsed) blocks.push({ kind: 'image', data: parsed.data, isPng: parsed.isPng })
    })
    return
  }

  if (tag === 'ul' || tag === 'ol') {
    const ordered = tag === 'ol'
    let n = 1
    el.childNodes.forEach(liNode => {
      if (liNode.nodeType !== Node.ELEMENT_NODE) return
      const li = liNode as HTMLElement
      if (li.tagName.toLowerCase() !== 'li') return
      const marker = ordered ? `${n}.` : '•'
      n++
      blocks.push({ kind: 'para', tokens: inlineTokens(li), size: BASE_SIZE, bold: false, indent: (level + 1) * LIST_INDENT, marker, align: 'left', gapAfter: 2 })
      // Nested block content (sub-lists, images, tables) inside this <li>.
      li.childNodes.forEach(child => {
        if (isBlockElement(child)) processElement(child, blocks, level + 1)
      })
    })
    return
  }

  if (tag === 'blockquote') {
    collectBlocks(el, blocks, level + 1)
    return
  }

  if (tag === 'hr') {
    blocks.push({ kind: 'rule' })
    return
  }

  if (tag === 'img') {
    const parsed = dataUriToImage(el.getAttribute('src') || '')
    if (parsed) blocks.push({ kind: 'image', data: parsed.data, isPng: parsed.isPng })
    return
  }

  if (tag === 'table') {
    const rows: TableCell[][] = []
    el.querySelectorAll('tr').forEach(tr => {
      const cells: TableCell[] = []
      tr.querySelectorAll('td, th').forEach(cell => cells.push({ tokens: plainTokens(cell), header: cell.tagName.toLowerCase() === 'th' }))
      if (cells.length > 0) rows.push(cells)
    })
    if (rows.length > 0) blocks.push({ kind: 'table', rows })
    return
  }

  // Unknown wrapper (div, section, etc.) — recurse into children.
  collectBlocks(el, blocks, level)
}

// --- Layout / drawing ------------------------------------------------------

class Layout {
  page: PDFPage
  y: number

  constructor(private doc: PDFDocument, private fonts: Fonts) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y = PAGE_HEIGHT - MARGIN
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y = PAGE_HEIGHT - MARGIN
  }

  private ensure(height: number) {
    if (this.y - height < CONTENT_BOTTOM) this.newPage()
  }

  drawParagraph(tokens: Token[], size: number, bold: boolean, indent: number, align: 'left' | 'center' | 'right', marker: string | undefined, gapAfter: number) {
    const startX = MARGIN + indent
    const maxWidth = PAGE_WIDTH - MARGIN - startX
    const lineHeight = size * LINE_FACTOR

    // Group tokens into lines of words with per-word measurements.
    type Placed = { text: string; font: PDFFont; size: number; width: number; link?: string; sub: boolean; sup: boolean; underline: boolean; strike: boolean }
    const lines: Placed[][] = []
    let line: Placed[] = []
    let lineWidth = 0
    const spaceWidth = this.fonts.regular.widthOfTextAtSize(' ', size)

    const flush = () => {
      lines.push(line)
      line = []
      lineWidth = 0
    }

    for (const tok of tokens) {
      if (tok.br) {
        flush()
        continue
      }
      if (!tok.text) continue
      const tokSize = tok.sup || tok.sub ? size * 0.72 : size
      const font = pickFont(this.fonts, tok.bold || bold, tok.italic)
      const wordWidth = font.widthOfTextAtSize(tok.text, tokSize)
      const addWidth = (line.length > 0 ? spaceWidth : 0) + wordWidth
      if (line.length > 0 && lineWidth + addWidth > maxWidth) flush()
      line.push({ text: tok.text, font, size: tokSize, width: wordWidth, link: tok.link, sub: tok.sub, sup: tok.sup, underline: tok.underline, strike: tok.strike })
      lineWidth += (line.length > 1 ? spaceWidth : 0) + wordWidth
    }
    if (line.length > 0) flush()
    if (lines.length === 0) lines.push([])

    lines.forEach((placed, index) => {
      this.ensure(lineHeight)
      const baseline = this.y - size

      // Marker (bullet / number) on the first line only, in the hanging indent.
      if (index === 0 && marker) {
        this.page.drawText(marker, { x: startX - LIST_INDENT + 2, y: baseline, size, font: this.fonts.regular, color: TEXT_COLOR })
      }

      const totalWidth = placed.reduce((sum, w, i) => sum + w.width + (i > 0 ? spaceWidth : 0), 0)
      let x = startX
      if (align === 'center') x = startX + (maxWidth - totalWidth) / 2
      else if (align === 'right') x = startX + (maxWidth - totalWidth)

      placed.forEach((w, i) => {
        if (i > 0) x += spaceWidth
        const yOffset = w.sup ? size * 0.32 : w.sub ? -size * 0.14 : 0
        const color = w.link ? LINK_COLOR : TEXT_COLOR
        const yBase = baseline + yOffset
        this.page.drawText(w.text, { x, y: yBase, size: w.size, font: w.font, color })
        if (w.link || w.underline) {
          this.page.drawLine({ start: { x, y: yBase - 1.5 }, end: { x: x + w.width, y: yBase - 1.5 }, thickness: 0.5, color })
        }
        if (w.strike) {
          this.page.drawLine({ start: { x, y: yBase + w.size * 0.3 }, end: { x: x + w.width, y: yBase + w.size * 0.3 }, thickness: 0.5, color })
        }
        x += w.width
      })
      this.y -= lineHeight
    })

    this.y -= gapAfter
  }

  async drawImage(data: Uint8Array, isPng: boolean) {
    try {
      const img = isPng ? await this.doc.embedPng(data) : await this.doc.embedJpg(data)
      const scale = Math.min(1, CONTENT_WIDTH / img.width)
      const w = img.width * scale
      const h = img.height * scale
      this.ensure(h + PARAGRAPH_GAP)
      this.page.drawImage(img, { x: MARGIN, y: this.y - h, width: w, height: h })
      this.y -= h + PARAGRAPH_GAP
    } catch {
      // Unsupported image — skip rather than fail the whole conversion.
    }
  }

  drawRule() {
    this.ensure(PARAGRAPH_GAP * 2)
    this.y -= PARAGRAPH_GAP
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.5, color: TABLE_BORDER })
    this.y -= PARAGRAPH_GAP
  }

  drawTable(rows: TableCell[][]) {
    const cols = rows.reduce((max, r) => Math.max(max, r.length), 0)
    if (cols === 0) return
    const colWidth = CONTENT_WIDTH / cols
    const pad = 4
    const size = BASE_SIZE
    const lineHeight = size * 1.2
    const spaceWidth = this.fonts.regular.widthOfTextAtSize(' ', size)

    const wrapCell = (cell: TableCell | undefined, font: PDFFont): string[] => {
      const lines: string[] = []
      let current = ''
      let width = 0
      const avail = colWidth - pad * 2
      for (const tok of cell?.tokens ?? []) {
        if (!tok.text) continue
        const wWidth = font.widthOfTextAtSize(tok.text, size)
        const add = (current ? spaceWidth : 0) + wWidth
        if (current && width + add > avail) {
          lines.push(current)
          current = tok.text
          width = wWidth
        } else {
          current = current ? `${current} ${tok.text}` : tok.text
          width += add
        }
      }
      if (current) lines.push(current)
      return lines.length ? lines : ['']
    }

    for (const row of rows) {
      const fonts = Array.from({ length: cols }, (_, c) => (row[c]?.header ? this.fonts.bold : this.fonts.regular))
      const cellLines = Array.from({ length: cols }, (_, c) => wrapCell(row[c], fonts[c]))
      const rowHeight = Math.max(...cellLines.map(l => l.length)) * lineHeight + pad * 2
      this.ensure(rowHeight)
      const top = this.y
      for (let c = 0; c < cols; c++) {
        const x = MARGIN + c * colWidth
        const isHeader = row[c]?.header ?? false
        this.page.drawRectangle({
          x,
          y: top - rowHeight,
          width: colWidth,
          height: rowHeight,
          borderColor: TABLE_BORDER,
          borderWidth: 0.5,
          ...(isHeader ? { color: TABLE_HEADER_FILL } : {}),
        })
        cellLines[c].forEach((text, li) => {
          this.page.drawText(text, { x: x + pad, y: top - pad - size - li * lineHeight, size, font: fonts[c], color: TEXT_COLOR })
        })
      }
      this.y -= rowHeight
    }
    this.y -= PARAGRAPH_GAP
  }
}

export async function convertDocxToVectorPdf(arrayBuffer: ArrayBuffer): Promise<Uint8Array> {
  // Preserve explicit underline (mammoth ignores it by default); strikethrough,
  // bold, and italic are already emitted by the default style map.
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer }, { styleMap: ['u => u'] })
  return htmlToVectorPdf(html)
}

export async function htmlToVectorPdf(html: string): Promise<Uint8Array> {
  const dom = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')

  const blocks: Block[] = []
  collectBlocks(dom.body, blocks)

  const doc = await PDFDocument.create()
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  }

  const layout = new Layout(doc, fonts)
  for (const block of blocks) {
    switch (block.kind) {
      case 'para':
        layout.drawParagraph(block.tokens, block.size, block.bold, block.indent, block.align, block.marker, block.gapAfter)
        break
      case 'image':
        await layout.drawImage(block.data, block.isPng)
        break
      case 'table':
        layout.drawTable(block.rows)
        break
      case 'rule':
        layout.drawRule()
        break
      case 'space':
        break
    }
  }

  return doc.save()
}
