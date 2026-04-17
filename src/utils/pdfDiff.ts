/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import pixelmatch from 'pixelmatch'

export type DiffOp = 'equal' | 'add' | 'remove' | 'modified'

export interface WordBox {
  text: string
  x: number
  y: number
  w: number
  h: number
}

export interface WordDiffItem {
  op: DiffOp
  aIndex?: number
  bIndex?: number
  text: string
}

export interface PageTextDiff {
  ops: WordDiffItem[]
  wordsA: WordBox[]
  wordsB: WordBox[]
  addedCount: number
  removedCount: number
  modifiedCount: number
  hasText: boolean
}

export interface RenderedPage {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

export interface VisualDiffResult {
  diffCanvas: HTMLCanvasElement
  width: number
  height: number
  changedPixels: number
  totalPixels: number
  similarity: number
}

// Treat punctuation clusters around a word as part of the word so that "foo." and "foo" can't
// silently match. Splits a text item into runs with per-run widths.
function splitTextItem(item: {
  str: string
  width: number
  height: number
  transform: number[]
}, viewport: { transform: number[] }): WordBox[] {
  const words: WordBox[] = []
  const raw = item.str
  if (!raw || raw.trim().length === 0) return words

  // The item's transform encodes [a, b, c, d, e, f]; e/f is the origin in PDF space.
  // pdfjs exposes `util.transform` for composing; we just apply viewport.transform to (e, f).
  const [a, b, c, d, e, f] = item.transform
  const vt = viewport.transform
  // Apply viewport.transform to point (e, f)
  const x = vt[0] * e + vt[2] * f + vt[4]
  const y = vt[1] * e + vt[3] * f + vt[5]

  // Height is in PDF units; multiply by viewport scale (vt[3] is negative for standard flip).
  const scaleY = Math.abs(vt[3])
  const height = item.height * scaleY
  // Width of the whole string in viewport units
  const totalWidth = item.width * Math.abs(vt[0])

  // Split into whitespace-separated tokens, preserve non-empty ones only.
  const tokens = raw.split(/(\s+)/)
  let cursor = 0
  const totalChars = raw.length || 1

  for (const token of tokens) {
    const tokenLen = token.length
    const tokenWidth = (tokenLen / totalChars) * totalWidth
    if (token.trim().length > 0) {
      words.push({
        text: token,
        x: x + (cursor / totalChars) * totalWidth,
        // pdfjs viewport y-origin is the bottom of the text box; subtract the height so
        // overlays sit on top of the rendered glyph.
        y: y - height,
        w: tokenWidth,
        h: height,
      })
    }
    cursor += tokenLen
  }

  // Keep transform params referenced so TypeScript doesn't complain when we narrow the tuple.
  void a
  void b
  void c
  void d
  return words
}

/**
 * Extract word boxes from a pdfjs page at the given viewport scale. Returns one box per
 * whitespace-delimited token with its rendered bounding box in canvas pixel space.
 */
export async function extractWordBoxes(page: any, scale: number): Promise<WordBox[]> {
  const viewport = page.getViewport({ scale })
  const textContent = await page.getTextContent({ disableCombineTextItems: false })
  const boxes: WordBox[] = []
  for (const item of textContent.items) {
    // Marked-content items have no `str`; skip them.
    if (typeof item.str !== 'string') continue
    boxes.push(...splitTextItem(item, viewport))
  }
  return boxes
}

/**
 * Myers-style O(N*M) word diff using LCS dynamic programming. N and M are small per page
 * (rarely > a few thousand), so the simple table is fine and keeps bundle size down.
 * Adjacent remove+add runs are collapsed into a single `modified` marker.
 */
export function diffWords(aWords: WordBox[], bWords: WordBox[]): WordDiffItem[] {
  const a = aWords.map(w => w.text)
  const b = bWords.map(w => w.text)
  const n = a.length
  const m = b.length

  // Build LCS length table.
  const dp: Uint32Array = new Uint32Array((n + 1) * (m + 1))
  const stride = m + 1
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i * stride + j] = dp[(i + 1) * stride + (j + 1)] + 1
      } else {
        const down = dp[(i + 1) * stride + j]
        const right = dp[i * stride + (j + 1)]
        dp[i * stride + j] = down > right ? down : right
      }
    }
  }

  const rawOps: WordDiffItem[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rawOps.push({ op: 'equal', aIndex: i, bIndex: j, text: a[i] })
      i++
      j++
    } else if (dp[(i + 1) * stride + j] >= dp[i * stride + (j + 1)]) {
      rawOps.push({ op: 'remove', aIndex: i, text: a[i] })
      i++
    } else {
      rawOps.push({ op: 'add', bIndex: j, text: b[j] })
      j++
    }
  }
  while (i < n) {
    rawOps.push({ op: 'remove', aIndex: i, text: a[i] })
    i++
  }
  while (j < m) {
    rawOps.push({ op: 'add', bIndex: j, text: b[j] })
    j++
  }

  // Tag adjacent remove+add pairs as `modified` on both sides for nicer amber highlights.
  for (let k = 0; k < rawOps.length - 1; k++) {
    const cur = rawOps[k]
    const next = rawOps[k + 1]
    if (
      (cur.op === 'remove' && next.op === 'add') ||
      (cur.op === 'add' && next.op === 'remove')
    ) {
      cur.op = 'modified'
      next.op = 'modified'
      k++ // skip the paired op so we don't chain across unrelated runs
    }
  }

  return rawOps
}

/**
 * Diff the text of two pdfjs pages. Produces ops plus the raw word boxes for overlay rendering.
 */
export async function diffPageText(pageA: any | null, pageB: any | null, scale: number): Promise<PageTextDiff> {
  const wordsA = pageA ? await extractWordBoxes(pageA, scale) : []
  const wordsB = pageB ? await extractWordBoxes(pageB, scale) : []
  const ops = diffWords(wordsA, wordsB)

  let addedCount = 0
  let removedCount = 0
  let modifiedCount = 0
  for (const op of ops) {
    if (op.op === 'add') addedCount++
    else if (op.op === 'remove') removedCount++
    else if (op.op === 'modified') modifiedCount++
  }

  return {
    ops,
    wordsA,
    wordsB,
    addedCount,
    removedCount,
    modifiedCount: Math.floor(modifiedCount / 2), // paired on both sides
    hasText: wordsA.length > 0 || wordsB.length > 0,
  }
}

/**
 * Render a pdfjs page to a canvas at the given scale. Uses opaque rendering for accurate
 * pixel diffing (pixelmatch cares about alpha too).
 */
export async function renderPageCanvas(page: any, scale: number): Promise<RenderedPage> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!ctx) throw new Error('Canvas context unavailable')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise
  return { canvas, width: canvas.width, height: canvas.height }
}

/**
 * Pick a shared render scale for two pages so both canvases end up the same pixel size,
 * bounded to avoid blowing out memory on huge PDFs.
 */
export function pickSharedScale(pageA: any | null, pageB: any | null, maxLongEdge = 1400): {
  scaleA: number
  scaleB: number
  width: number
  height: number
} {
  // If either page is missing, pick a scale from the one that exists.
  const ref = pageA || pageB
  if (!ref) return { scaleA: 1, scaleB: 1, width: 0, height: 0 }

  const vA = pageA ? pageA.getViewport({ scale: 1 }) : null
  const vB = pageB ? pageB.getViewport({ scale: 1 }) : null

  // Target a common output size: max of each dimension so we preserve detail.
  const targetW = Math.max(vA?.width ?? 0, vB?.width ?? 0)
  const targetH = Math.max(vA?.height ?? 0, vB?.height ?? 0)

  const cap = maxLongEdge / Math.max(targetW, targetH, 1)
  const finalW = Math.ceil(targetW * Math.min(1.5, cap))
  const finalH = Math.ceil(targetH * Math.min(1.5, cap))

  const scaleA = vA ? finalW / vA.width : 1
  const scaleB = vB ? finalW / vB.width : 1

  return { scaleA, scaleB, width: finalW, height: finalH }
}

/**
 * Compute a pixel diff of two rendered canvases. If dimensions don't match, the smaller one
 * is letterboxed onto a white canvas matching the larger size before diffing.
 */
export function visualDiff(a: HTMLCanvasElement, b: HTMLCanvasElement, threshold = 0.1): VisualDiffResult {
  const width = Math.max(a.width, b.width)
  const height = Math.max(a.height, b.height)

  const normalize = (src: HTMLCanvasElement): ImageData => {
    if (src.width === width && src.height === height) {
      const ctx = src.getContext('2d')
      if (!ctx) throw new Error('Canvas context unavailable')
      return ctx.getImageData(0, 0, width, height)
    }
    const tmp = document.createElement('canvas')
    tmp.width = width
    tmp.height = height
    const tctx = tmp.getContext('2d', { alpha: false })
    if (!tctx) throw new Error('Canvas context unavailable')
    tctx.fillStyle = '#ffffff'
    tctx.fillRect(0, 0, width, height)
    tctx.drawImage(src, 0, 0)
    const data = tctx.getImageData(0, 0, width, height)
    tmp.width = 0
    tmp.height = 0
    return data
  }

  const imgA = normalize(a)
  const imgB = normalize(b)

  const diffCanvas = document.createElement('canvas')
  diffCanvas.width = width
  diffCanvas.height = height
  const dctx = diffCanvas.getContext('2d', { alpha: true })
  if (!dctx) throw new Error('Canvas context unavailable')
  const diffImage = dctx.createImageData(width, height)

  const changed = pixelmatch(
    imgA.data,
    imgB.data,
    diffImage.data,
    width,
    height,
    {
      threshold,
      includeAA: false,
      alpha: 0,
      diffColor: [230, 60, 60],
      diffColorAlt: [60, 180, 90],
      diffMask: true, // transparent background, only diff pixels colored
    } as any,
  )

  dctx.putImageData(diffImage, 0, 0)

  const total = width * height
  return {
    diffCanvas,
    width,
    height,
    changedPixels: changed,
    totalPixels: total,
    similarity: total === 0 ? 1 : 1 - changed / total,
  }
}

/**
 * Cheaply decide whether two pages differ visually. Used for the per-page summary chip.
 * Samples at a low resolution to stay fast.
 */
export async function quickVisualSimilarity(pageA: any, pageB: any): Promise<number> {
  const viewportA = pageA.getViewport({ scale: 1 })
  const viewportB = pageB.getViewport({ scale: 1 })
  const targetW = 200
  const scaleA = targetW / viewportA.width
  const scaleB = targetW / viewportB.width
  const [renderedA, renderedB] = await Promise.all([
    renderPageCanvas(pageA, scaleA),
    renderPageCanvas(pageB, scaleB),
  ])
  const result = visualDiff(renderedA.canvas, renderedB.canvas, 0.15)
  renderedA.canvas.width = 0
  renderedA.canvas.height = 0
  renderedB.canvas.width = 0
  renderedB.canvas.height = 0
  return result.similarity
}
