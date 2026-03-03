import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileUp,
  Gauge,
  LockKeyhole,
  Search,
  Shield,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { BrowserRouter, HashRouter, Link, Route, Routes, useParams } from 'react-router-dom'
import type { PDFDocument as PdfLibDocument } from 'pdf-lib'
import { categories, tools } from './data/tools'
import type { JobRecord } from './types'

type CategoryFilter = (typeof categories)[number]
type OutputArtifact = {
  blob: Blob
  fileName: string
  mimeType: string
}
type OutputRequest = {
  toolId: string
  file: File
  quality: number
  watermarkText: string
  password: string
  additionalFiles?: File[]
}
type PdfViewport = { width: number; height: number }
type PdfJsImageObject = { data: Uint8ClampedArray; width: number; height: number }
type PdfJsPage = {
  getViewport: (params: { scale: number }) => PdfViewport
  render: (params: {
    canvas: HTMLCanvasElement
    canvasContext: CanvasRenderingContext2D
    viewport: PdfViewport
  }) => { promise: Promise<void> }
  getOperatorList: () => Promise<{ argsArray: unknown[][] }>
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>
  objs: { get: (name: string) => Promise<PdfJsImageObject | undefined> }
}
type PdfJsDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfJsPage>
  cleanup: () => void
}
type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>
  destroy: () => Promise<void>
}
type PdfJsBundle = {
  getDocument: (src: unknown) => PdfJsLoadingTask
  GlobalWorkerOptions: { workerSrc: string }
}
type SeoConfig = {
  title: string
  description: string
  path?: string
}

const BRAND_NAME = 'PaperKnife'
const BRAND_SUBTITLE = 'Your PDF Protector'
const BRAND_URL_FALLBACK = 'https://paperknife.app'
const BRAND_LOGO_PATH = '/logos/icon.png'

function upsertMetaTag(attribute: 'name' | 'property', key: string, content: string): void {
  let tag = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.content = content
}

function applySeoMetadata(config: SeoConfig): void {
  if (typeof document === 'undefined') {
    return
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : BRAND_URL_FALLBACK
  const canonicalHref = new URL(config.path ?? '/', origin).toString()
  const logoHref = new URL('/logos/og-image.png', origin).toString()

  document.title = config.title
  upsertMetaTag('name', 'description', config.description)
  upsertMetaTag('name', 'robots', 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1')
  upsertMetaTag('property', 'og:title', config.title)
  upsertMetaTag('property', 'og:description', config.description)
  upsertMetaTag('property', 'og:type', 'website')
  upsertMetaTag('property', 'og:url', canonicalHref)
  upsertMetaTag('property', 'og:site_name', BRAND_NAME)
  upsertMetaTag('property', 'og:image', logoHref)
  upsertMetaTag('property', 'og:image:alt', `${BRAND_NAME} — Private PDF Toolkit`)
  upsertMetaTag('name', 'twitter:card', 'summary_large_image')
  upsertMetaTag('name', 'twitter:title', config.title)
  upsertMetaTag('name', 'twitter:description', config.description)
  upsertMetaTag('name', 'twitter:image', logoHref)

  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.href = canonicalHref
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const size = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / 1024 ** size
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[size]}`
}

function readIncomingFile(list: FileList | null): File | null {
  if (!list || list.length === 0) {
    return null
  }

  const [file] = Array.from(list)
  return file
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function stripExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot <= 0 ? fileName : fileName.slice(0, lastDot)
}

function triggerDownload(downloadUrl: string, fileName: string): void {
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = fileName
  anchor.click()
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not generate image blob.'))
          return
        }

        resolve(blob)
      },
      type,
      quality,
    )
  })
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function toPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' })
}

function assertPdf(file: File, toolName: string): void {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    throw new Error(`${toolName} requires a PDF file.`)
  }
}

let pdfJsBundlePromise: Promise<PdfJsBundle> | undefined

async function getPdfJsBundle(): Promise<PdfJsBundle> {
  if (!pdfJsBundlePromise) {
    pdfJsBundlePromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      }

      return {
        getDocument: pdfjs.getDocument as unknown as PdfJsBundle['getDocument'],
        GlobalWorkerOptions: pdfjs.GlobalWorkerOptions as PdfJsBundle['GlobalWorkerOptions'],
      }
    })
  }

  return pdfJsBundlePromise
}

async function loadPdfLib() {
  return import('pdf-lib')
}

async function loadPdfJsDocument(file: File, password = '') {
  const { getDocument } = await getPdfJsBundle()
  const source = new Uint8Array(await file.arrayBuffer())
  const loadingTask = getDocument({
    data: source,
    ...(password ? { password } : {}),
  })

  return { loadingTask, pdf: await loadingTask.promise }
}

async function createPdfImageOutput(
  file: File,
  quality: number,
  onProgress: (progress: number) => void,
  password = '',
): Promise<OutputArtifact> {
  assertPdf(file, 'PDF to Image')
  const { default: JSZip } = await import('jszip')
  const { loadingTask, pdf } = await loadPdfJsDocument(file, password)
  const zip = new JSZip()
  const baseName = stripExtension(file.name)
  const padWidth = Math.max(2, String(pdf.numPages).length)

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const scale = 1 + quality / 60
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create rendering context.')
    }

    await page.render({ canvas, canvasContext: context, viewport }).promise
    const imageBlob = await canvasToBlob(canvas, 'image/png')
    const pageSuffix = String(pageNumber).padStart(padWidth, '0')
    zip.file(`${baseName}-page-${pageSuffix}.png`, imageBlob)
    onProgress(Math.round((pageNumber / pdf.numPages) * 90))
  }

  const outputBlob = await zip.generateAsync(
    { type: 'blob' },
    ({ percent }) => {
      onProgress(Math.min(99, Math.round(90 + percent / 10)))
    },
  )

  pdf.cleanup()
  await loadingTask.destroy()

  return {
    blob: outputBlob,
    fileName: `${baseName}-images.zip`,
    mimeType: 'application/zip',
  }
}

async function readPdfLibDocument(
  file: File,
  password: string,
  fallbackToolName: string,
): Promise<PdfLibDocument> {
  assertPdf(file, fallbackToolName)
  const { PDFDocument } = await loadPdfLib()
  const bytes = await file.arrayBuffer()
  return PDFDocument.load(bytes, {
    ...(password ? { password } : {}),
    ignoreEncryption: true,
  } as { password?: string; ignoreEncryption: boolean })
}

function outputFileNameFrom(inputName: string, suffix: string, ext: string): string {
  return `${stripExtension(inputName)}-${suffix}.${ext}`
}

async function createMergeOutput(
  file: File,
  additionalFiles: File[] = [],
  password: string,
  onProgress: (progress: number) => void,
): Promise<OutputArtifact> {
  const { PDFDocument } = await loadPdfLib()
  const sources = [file, ...additionalFiles]

  if (sources.length < 2) {
    throw new Error('Merge PDF needs at least 2 PDF files. Select additional PDFs in the file picker.')
  }

  const merged = await PDFDocument.create()
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]
    assertPdf(source, 'Merge PDF')
    const sourceBytes = await source.arrayBuffer()
    const sourceDoc = await PDFDocument.load(sourceBytes, {
      ...(password ? { password } : {}),
      ignoreEncryption: true,
    } as { password?: string; ignoreEncryption: boolean })
    const copied = await merged.copyPages(sourceDoc, sourceDoc.getPageIndices())
    copied.forEach((page) => merged.addPage(page))
    onProgress(Math.round(((index + 1) / sources.length) * 100))
  }

  const bytes = await merged.save()
  return {
    blob: toPdfBlob(bytes),
    fileName: outputFileNameFrom(file.name, 'merged', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createSplitOutput(file: File, password: string, onProgress: (progress: number) => void): Promise<OutputArtifact> {
  const { default: JSZip } = await import('jszip')
  const { PDFDocument } = await loadPdfLib()
  const sourceDoc = await readPdfLibDocument(file, password, 'Split PDF')
  const zip = new JSZip()
  const pages = sourceDoc.getPages()
  const padWidth = Math.max(2, String(pages.length).length)

  for (let index = 0; index < pages.length; index += 1) {
    const single = await PDFDocument.create()
    const [copied] = await single.copyPages(sourceDoc, [index])
    single.addPage(copied)
    const singleBytes = await single.save()
    zip.file(`page-${String(index + 1).padStart(padWidth, '0')}.pdf`, singleBytes)
    onProgress(Math.round(((index + 1) / pages.length) * 100))
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return {
    blob,
    fileName: outputFileNameFrom(file.name, 'split-pages', 'zip'),
    mimeType: 'application/zip',
  }
}

async function createRasterizedPdfOutput(
  file: File,
  quality: number,
  password: string,
  grayscale: boolean,
  onProgress: (progress: number) => void,
): Promise<OutputArtifact> {
  assertPdf(file, grayscale ? 'Grayscale' : 'Compress PDF')
  const { PDFDocument } = await loadPdfLib()
  const { loadingTask, pdf } = await loadPdfJsDocument(file, password)
  const out = await PDFDocument.create()
  const jpegQuality = Math.min(0.94, Math.max(0.35, quality / 110))
  const scale = 0.8 + quality / 120

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create rendering context.')
    }

    await page.render({ canvas, canvasContext: context, viewport }).promise

    if (grayscale) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      for (let px = 0; px < data.length; px += 4) {
        const gray = Math.round(data[px] * 0.299 + data[px + 1] * 0.587 + data[px + 2] * 0.114)
        data[px] = gray
        data[px + 1] = gray
        data[px + 2] = gray
      }
      context.putImageData(imageData, 0, 0)
    }

    const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', jpegQuality)
    const jpegBytes = await jpegBlob.arrayBuffer()
    const image = await out.embedJpg(jpegBytes)
    const outPage = out.addPage([viewport.width, viewport.height])
    outPage.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height })
    onProgress(Math.round((pageNumber / pdf.numPages) * 100))
  }

  pdf.cleanup()
  await loadingTask.destroy()
  const bytes = await out.save()
  return {
    blob: toPdfBlob(bytes),
    fileName: outputFileNameFrom(file.name, grayscale ? 'grayscale' : 'compressed', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createProtectOutput(file: File, password: string): Promise<OutputArtifact> {
  if (!password) {
    throw new Error('Password is required for Protect PDF.')
  }

  const doc = await readPdfLibDocument(file, password, 'Protect PDF')
  const intermediate = await doc.save()
  const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite')
  const encrypted = await encryptPDF(intermediate, password)
  const encryptedBytes = encrypted instanceof Uint8Array ? encrypted : new Uint8Array(encrypted)
  return {
    blob: toPdfBlob(encryptedBytes),
    fileName: outputFileNameFrom(file.name, 'protected', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createUnlockOutput(file: File, password: string): Promise<OutputArtifact> {
  const doc = await readPdfLibDocument(file, password, 'Unlock PDF')
  const bytes = await doc.save()
  return {
    blob: toPdfBlob(bytes),
    fileName: outputFileNameFrom(file.name, 'unlocked', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createRotateOutput(file: File, quality: number, password: string): Promise<OutputArtifact> {
  const { degrees } = await loadPdfLib()
  const doc = await readPdfLibDocument(file, password, 'Rotate PDF')
  const rotation = quality < 40 ? 90 : quality < 75 ? 180 : 270
  doc.getPages().forEach((page) => {
    const current = page.getRotation().angle
    page.setRotation(degrees((current + rotation) % 360))
  })
  const bytes = await doc.save()
  return {
    blob: toPdfBlob(bytes),
    fileName: outputFileNameFrom(file.name, 'rotated', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createRearrangeOutput(file: File, password: string): Promise<OutputArtifact> {
  const { PDFDocument } = await loadPdfLib()
  const source = await readPdfLibDocument(file, password, 'Rearrange PDF')
  const output = await PDFDocument.create()
  const indices = source
    .getPageIndices()
    .slice()
    .reverse()
  const copied = await output.copyPages(source, indices)
  copied.forEach((page) => output.addPage(page))
  const bytes = await output.save()
  return {
    blob: toPdfBlob(bytes),
    fileName: outputFileNameFrom(file.name, 'rearranged', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createPageNumberOutput(file: File, quality: number, password: string): Promise<OutputArtifact> {
  const { StandardFonts, rgb } = await loadPdfLib()
  const doc = await readPdfLibDocument(file, password, 'Page Numbers')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontSize = Math.round(8 + quality / 10)
  const pages = doc.getPages()
  pages.forEach((page, index) => {
    const label = `${index + 1}/${pages.length}`
    const textWidth = font.widthOfTextAtSize(label, fontSize)
    page.drawText(label, {
      x: Math.max(16, (page.getWidth() - textWidth) / 2),
      y: 20,
      size: fontSize,
      font,
      color: rgb(0.1, 0.1, 0.1),
    })
  })
  const bytes = await doc.save()
  return {
    blob: toPdfBlob(bytes),
    fileName: outputFileNameFrom(file.name, 'numbered', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createWatermarkOutput(file: File, watermarkText: string, password: string): Promise<OutputArtifact> {
  const { StandardFonts, degrees, rgb } = await loadPdfLib()
  const doc = await readPdfLibDocument(file, password, 'Watermark')
  const mark = watermarkText.trim() || 'CONFIDENTIAL'
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  doc.getPages().forEach((page) => {
    const size = Math.max(28, page.getWidth() * 0.07)
    page.drawText(mark, {
      x: page.getWidth() * 0.15,
      y: page.getHeight() * 0.45,
      size,
      font,
      color: rgb(0.65, 0.65, 0.65),
      rotate: degrees(-35),
      opacity: 0.45,
    })
  })
  const bytes = await doc.save()
  return {
    blob: toPdfBlob(bytes),
    fileName: outputFileNameFrom(file.name, 'watermarked', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createMetadataOutput(file: File, password: string): Promise<OutputArtifact> {
  const doc = await readPdfLibDocument(file, password, 'Metadata')
  doc.setTitle('')
  doc.setAuthor('')
  doc.setSubject('')
  doc.setKeywords([])
  doc.setProducer('PaperKnife')
  doc.setCreator('PaperKnife Web')
  const bytes = await doc.save()
  return {
    blob: toPdfBlob(bytes),
    fileName: outputFileNameFrom(file.name, 'sanitized', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createSignatureOutput(file: File, watermarkText: string, quality: number, password: string): Promise<OutputArtifact> {
  const { StandardFonts, rgb } = await loadPdfLib()
  const doc = await readPdfLibDocument(file, password, 'Signature')
  const signatureLabel = watermarkText.trim() || 'Signed Digitally'
  const font = await doc.embedFont(StandardFonts.HelveticaOblique)
  const first = doc.getPages()[0]
  const fontSize = Math.max(14, Math.round(quality / 4))
  const width = font.widthOfTextAtSize(signatureLabel, fontSize)
  first.drawText(signatureLabel, {
    x: Math.max(20, first.getWidth() - width - 28),
    y: 26,
    size: fontSize,
    font,
    color: rgb(0.12, 0.12, 0.12),
  })
  const bytes = await doc.save()
  return {
    blob: toPdfBlob(bytes),
    fileName: outputFileNameFrom(file.name, 'signed', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createImageToPdfOutput(file: File): Promise<OutputArtifact> {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    throw new Error('Image to PDF requires an image input (JPG/PNG/WebP).')
  }

  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.create()
  const bytes = await file.arrayBuffer()
  let width = 1080
  let height = 1440
  if (file.type.includes('png')) {
    const embedded = await doc.embedPng(bytes)
    width = embedded.width
    height = embedded.height
    const page = doc.addPage([width, height])
    page.drawImage(embedded, { x: 0, y: 0, width, height })
  } else if (file.type.includes('jpeg') || file.type.includes('jpg')) {
    const embedded = await doc.embedJpg(bytes)
    width = embedded.width
    height = embedded.height
    const page = doc.addPage([width, height])
    page.drawImage(embedded, { x: 0, y: 0, width, height })
  } else {
    const image = new Image()
    const imageUrl = URL.createObjectURL(file)
    const imageLoad = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not load image input.'))
    })
    image.src = imageUrl
    await imageLoad
    width = image.naturalWidth
    height = image.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create rendering context.')
    }
    context.drawImage(image, 0, 0)
    const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
    const jpegBytes = await jpegBlob.arrayBuffer()
    const embedded = await doc.embedJpg(jpegBytes)
    const page = doc.addPage([width, height])
    page.drawImage(embedded, { x: 0, y: 0, width, height })
    URL.revokeObjectURL(imageUrl)
  }

  const output = await doc.save()
  return {
    blob: toPdfBlob(output),
    fileName: outputFileNameFrom(file.name, 'image-to-pdf', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createExtractImagesOutput(
  file: File,
  password: string,
  onProgress: (progress: number) => void,
): Promise<OutputArtifact> {
  assertPdf(file, 'Extract Images')
  const { default: JSZip } = await import('jszip')
  const { loadingTask, pdf } = await loadPdfJsDocument(file, password)
  const zip = new JSZip()
  let imageCounter = 0

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const operatorList = await page.getOperatorList()
    for (let opIndex = 0; opIndex < operatorList.argsArray.length; opIndex += 1) {
      const dep = operatorList.argsArray[opIndex]?.[0]
      if (typeof dep === 'string' && dep.startsWith('img_')) {
        try {
          const imgObj = await page.objs.get(dep)
          if (imgObj && imgObj.data && imgObj.width && imgObj.height) {
            const canvas = document.createElement('canvas')
            canvas.width = imgObj.width
            canvas.height = imgObj.height
            const context = canvas.getContext('2d')
            if (!context) {
              continue
            }
            const imageData = context.createImageData(imgObj.width, imgObj.height)
            imageData.data.set(imgObj.data)
            context.putImageData(imageData, 0, 0)
            const pngBlob = await canvasToBlob(canvas, 'image/png')
            imageCounter += 1
            zip.file(`image-${String(imageCounter).padStart(3, '0')}.png`, pngBlob)
          }
        } catch {
          // Ignore malformed object references.
        }
      }
    }
    onProgress(Math.round((pageNumber / pdf.numPages) * 100))
  }

  pdf.cleanup()
  await loadingTask.destroy()

  if (imageCounter === 0) {
    throw new Error('No embedded images found in this PDF.')
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return {
    blob,
    fileName: outputFileNameFrom(file.name, 'extracted-images', 'zip'),
    mimeType: 'application/zip',
  }
}

async function createPdfToTextOutput(
  file: File,
  password: string,
  onProgress: (progress: number) => void,
): Promise<OutputArtifact> {
  assertPdf(file, 'PDF to Text')
  const { loadingTask, pdf } = await loadPdfJsDocument(file, password)
  let text = ''
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const line = content.items.map((item) => item.str || '').join(' ')
    text += `--- Page ${pageNumber} ---\n${line}\n\n`
    onProgress(Math.round((pageNumber / pdf.numPages) * 100))
  }
  pdf.cleanup()
  await loadingTask.destroy()
  return {
    blob: new Blob([text], { type: 'text/plain' }),
    fileName: outputFileNameFrom(file.name, 'extracted-text', 'txt'),
    mimeType: 'text/plain',
  }
}

async function createRepairOutput(file: File, password: string): Promise<OutputArtifact> {
  const doc = await readPdfLibDocument(file, password, 'Repair PDF')
  const bytes = await doc.save({ useObjectStreams: false })
  return {
    blob: toPdfBlob(bytes),
    fileName: outputFileNameFrom(file.name, 'repaired', 'pdf'),
    mimeType: 'application/pdf',
  }
}

async function createOutputArtifact(request: OutputRequest, onProgress: (progress: number) => void): Promise<OutputArtifact> {
  const { toolId, file, quality, watermarkText, password, additionalFiles } = request

  switch (toolId) {
    case 'merge-pdf':
      return createMergeOutput(file, additionalFiles, password, onProgress)
    case 'split-pdf':
      return createSplitOutput(file, password, onProgress)
    case 'compress-pdf':
      return createRasterizedPdfOutput(file, quality, password, false, onProgress)
    case 'protect-pdf':
      onProgress(30)
      return createProtectOutput(file, password)
    case 'unlock-pdf':
      onProgress(40)
      return createUnlockOutput(file, password)
    case 'rotate-pdf':
      onProgress(70)
      return createRotateOutput(file, quality, password)
    case 'rearrange-pdf':
      onProgress(70)
      return createRearrangeOutput(file, password)
    case 'page-numbers':
      onProgress(70)
      return createPageNumberOutput(file, quality, password)
    case 'watermark':
      onProgress(70)
      return createWatermarkOutput(file, watermarkText, password)
    case 'metadata':
      onProgress(70)
      return createMetadataOutput(file, password)
    case 'signature':
      onProgress(70)
      return createSignatureOutput(file, watermarkText, quality, password)
    case 'grayscale':
      return createRasterizedPdfOutput(file, quality, password, true, onProgress)
    case 'pdf-to-image':
      return createPdfImageOutput(file, quality, onProgress, password)
    case 'image-to-pdf':
      onProgress(70)
      return createImageToPdfOutput(file)
    case 'extract-images':
      return createExtractImagesOutput(file, password, onProgress)
    case 'pdf-to-text':
      return createPdfToTextOutput(file, password, onProgress)
    case 'repair-pdf':
      onProgress(70)
      return createRepairOutput(file, password)
    default: {
      const sourceBuffer = await file.arrayBuffer()
      onProgress(100)
      return {
        blob: new Blob([sourceBuffer], { type: file.type || 'application/octet-stream' }),
        fileName: `${stripExtension(file.name)}-${toolId}-output.${file.name.split('.').pop() || 'bin'}`,
        mimeType: file.type || 'application/octet-stream',
      }
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   APP CHROME
───────────────────────────────────────────────────────────── */
function AppChrome({
  activeFile,
  onFileSelect,
  onFileClear,
  jobs,
  onQueue,
}: {
  activeFile: File | null
  onFileSelect: (file: File | null) => void
  onFileClear: () => void
  jobs: JobRecord[]
  onQueue: (toolId: string, fileName: string) => void
}) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label={`${BRAND_NAME} home`}>
            <img
              className="brand-logo"
              src={BRAND_LOGO_PATH}
              alt={`${BRAND_NAME} logo`}
              width={30}
              height={30}
            />
            <span className="brand-name">
              Paper<span>Knife</span>
            </span>
            <span className="brand-tag">{BRAND_SUBTITLE}</span>
          </Link>

          <div className="header-badges">
            <span className="badge badge-cyan">
              <Shield size={11} />
              Zero Uploads
            </span>
            <span className="badge">
              <Clock3 size={11} />
              {jobs.length} runs
            </span>
          </div>
        </div>
      </header>

      <main className="page-main">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                activeFile={activeFile}
                onFileSelect={onFileSelect}
                onFileClear={onFileClear}
                jobs={jobs}
              />
            }
          />
          <Route
            path="/tool/:toolId"
            element={
              <ToolWorkspace
                activeFile={activeFile}
                onFileSelect={onFileSelect}
                onFileClear={onFileClear}
                onQueue={onQueue}
                jobs={jobs}
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   HOME PAGE
───────────────────────────────────────────────────────────── */
function HomePage({
  activeFile,
  onFileSelect,
  onFileClear,
  jobs,
}: {
  activeFile: File | null
  onFileSelect: (file: File | null) => void
  onFileClear: () => void
  jobs: JobRecord[]
}) {
  const [query, setQuery] = useState('')
  const [selectedGoal, setSelectedGoal] = useState<Exclude<CategoryFilter, 'All'> | null>(null)
  const [showAllTools, setShowAllTools] = useState(false)
  const [dragging, setDragging] = useState(false)

  const goalChoices = useMemo(
    () => categories.filter((c): c is Exclude<CategoryFilter, 'All'> => c !== 'All'),
    [],
  )

  const goalDescription: Record<Exclude<CategoryFilter, 'All'>, string> = {
    Edit: 'Merge, split, rotate, watermark, reorder pages.',
    Secure: 'Encrypt, unlock, and sanitize metadata.',
    Convert: 'PDF ↔ images, text extraction.',
    Optimize: 'Compress, grayscale, repair broken files.',
  }

  const filtered = useMemo(() => {
    return tools.filter((tool) => {
      if (!selectedGoal) return false
      const matchesCategory = tool.category === selectedGoal
      const text = `${tool.title} ${tool.description} ${tool.category}`.toLowerCase()
      const matchesQuery = text.includes(query.trim().toLowerCase())
      return matchesCategory && matchesQuery
    })
  }, [query, selectedGoal])

  const visibleTools = showAllTools ? filtered : filtered.slice(0, 5)
  const lastJob = jobs[0]

  useEffect(() => {
    applySeoMetadata({
      title: `${BRAND_NAME} — Merge, Split, Compress & Convert PDF Online`,
      description:
        'PaperKnife processes PDFs 100% locally in your browser. Merge PDF, split pages, compress, protect, unlock, convert to image or text. Zero uploads, complete privacy.',
      path: '/',
    })
  }, [])

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    onFileSelect(readIncomingFile(event.dataTransfer.files))
  }

  const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelect(readIncomingFile(event.target.files))
  }

  return (
    <div className="home-root">

      {/* Hero */}
      <section className="hero-block fade-up">
        <p className="hero-eyebrow">Your PDF Protector</p>
        <h1 className="hero-title">
          Your PDFs, Your Peace.<br />
          <em>Your Protector.</em>
        </h1>
        <p className="hero-sub">
          Experience effortless security. Process your documents right in your browser
          with the comfort of knowing your files never leave your side.
        </p>
        <div className="hero-flow">
          <div className="flow-step">
            <span className="flow-step-num">1</span>
            Add file
          </div>
          <span className="flow-arrow">→</span>
          <div className="flow-step">
            <span className="flow-step-num">2</span>
            Pick goal
          </div>
          <span className="flow-arrow">→</span>
          <div className="flow-step">
            <span className="flow-step-num">3</span>
            Run tool
          </div>
        </div>
        <p className="hero-meta">
          {lastJob
            ? `↳ last run: ${lastJob.fileName} · ${formatTimestamp(lastJob.createdAt)}`
            : `↳ ${jobs.length} total local runs · files never leave browser memory`}
        </p>
      </section>

      {/* Step 1: Upload */}
      <div
        className={`step-block fade-up fade-up-1${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
        onDrop={handleDrop}
      >
        <div className="step-header">
          <span className="step-num">Step 01</span>
          <h2 className="step-title">Upload your document</h2>
        </div>
        <div className="step-body">
          <label htmlFor="main-file-input" style={{ cursor: 'pointer', display: 'block' }}>
            <div className="drop-zone">
              <div className="drop-icon">
                {activeFile ? <CheckCircle2 size={20} /> : <Upload size={20} />}
              </div>
              <div className="drop-text">
                {activeFile ? (
                  <>
                    <strong>{activeFile.name}</strong>
                    <p>{formatBytes(activeFile.size)} · Click to replace</p>
                  </>
                ) : (
                  <>
                    <strong>Drop file here or click to browse</strong>
                    <p>PDF, JPG, PNG, WebP supported</p>
                  </>
                )}
              </div>
            </div>
          </label>
          <input
            id="main-file-input"
            className="hidden-input"
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            onChange={handleSelect}
          />
          {activeFile && (
            <div className="file-loaded" style={{ marginTop: '0.55rem' }}>
              <span className="file-dot" />
              <span className="file-name">{activeFile.name}</span>
              <span className="file-size">{formatBytes(activeFile.size)}</span>
              <button className="btn btn-icon btn-sm" type="button" onClick={onFileClear} aria-label="Remove file">
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Goal */}
      <div className="step-block fade-up fade-up-2">
        <div className="step-header">
          <span className="step-num">Step 02</span>
          <h2 className="step-title">What do you need?</h2>
        </div>
        <div className="step-body">
          <div className="goal-grid">
            {goalChoices.map((goal) => (
              <button
                key={goal}
                type="button"
                className={`goal-card${selectedGoal === goal ? ' active' : ''}`}
                onClick={() => { setSelectedGoal(goal); setShowAllTools(false) }}
              >
                <span className="goal-name">{goal}</span>
                <span className="goal-desc">{goalDescription[goal]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step 3: Tool */}
      <div className="step-block fade-up fade-up-3">
        <div className="step-header">
          <span className="step-num">Step 03</span>
          <h2 className="step-title">Select a tool</h2>
        </div>
        <div className="step-body">
          {!selectedGoal ? (
            <p className="step-hint">↑ Choose a category above to see matching tools.</p>
          ) : (
            <>
              <div className="search-box">
                <Search size={14} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${selectedGoal.toLowerCase()} tools…`}
                  aria-label="Search tools"
                />
              </div>

              <div className="tool-list">
                {visibleTools.map((tool, idx) => {
                  const Icon = tool.icon
                  return (
                    <Link
                      key={tool.id}
                      className="tool-row fade-up"
                      style={{ '--accent': tool.accent, animationDelay: `${idx * 40}ms` } as React.CSSProperties}
                      to={`/tool/${tool.id}`}
                    >
                      <div className="tool-row-icon">
                        <Icon size={16} />
                      </div>
                      <div className="tool-row-info">
                        <strong>{tool.title}</strong>
                        <p>{tool.description}</p>
                      </div>
                      <div className="tool-row-meta">
                        <span className="tool-eta">{tool.eta}</span>
                        <ArrowRight size={14} style={{ color: 'var(--fg-3)' }} />
                      </div>
                    </Link>
                  )
                })}
              </div>

              {filtered.length === 0 && (
                <p className="step-hint">No tools match "{query}". Try a different keyword.</p>
              )}

              {filtered.length > 5 && (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  style={{ marginTop: '0.65rem' }}
                  onClick={() => setShowAllTools((p) => !p)}
                >
                  {showAllTools ? `Show fewer` : `Show all ${filtered.length} tools`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* SEO content block */}
      <div className="seo-block fade-up fade-up-4">
        <h2>All-in-one private PDF tools</h2>
        <p>
          PaperKnife handles everything from merge PDF, split PDF, compress PDF, protect PDF, unlock PDF,
          rotate, watermark, metadata cleanup, signature, grayscale, PDF to image, image to PDF, extract images,
          PDF to text, and repair. Every operation runs locally — no server, no cloud, no data collected.
        </p>
        <div className="seo-links">
          {tools.map((tool) => (
            <Link key={`seo-${tool.id}`} className="seo-chip" to={`/tool/${tool.id}`}>
              {tool.title}
            </Link>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="faq-block fade-up fade-up-5">
        <h2>FAQ</h2>
        <details>
          <summary>Is this truly private and offline?</summary>
          <p>
            Yes. All PDF processing runs using WebAssembly and JavaScript directly in your browser tab.
            No file is ever transmitted to a server. You can even use PaperKnife with your network disconnected.
          </p>
        </details>
        <details>
          <summary>What file types are supported?</summary>
          <p>
            PDF is the primary format. The Image to PDF and PDF to Image tools also accept JPG, PNG, and WebP images.
          </p>
        </details>
        <details>
          <summary>Which PDF operations are available?</summary>
          <p>
            Merge, split, compress, protect (encrypt), unlock (decrypt), rotate, rearrange pages, add page numbers,
            watermark, metadata sanitization, signature, grayscale, PDF-to-image, image-to-PDF, extract embedded images,
            PDF-to-text, and structural repair.
          </p>
        </details>
        <details>
          <summary>Where do processed files go?</summary>
          <p>
            Output files are downloaded directly by your browser. The latest output is also kept accessible for re-download
            in the tool workspace sidebar during your current session.
          </p>
        </details>
        <details>
          <summary>Is there a file size limit?</summary>
          <p>
            There is no enforced size limit, but very large PDFs (100+ MB) may be slow since processing happens
            on your device CPU. Compression is recommended before working with large files.
          </p>
        </details>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TOOL WORKSPACE
───────────────────────────────────────────────────────────── */
function ToolWorkspace({
  activeFile,
  onFileSelect,
  onFileClear,
  onQueue,
  jobs,
}: {
  activeFile: File | null
  onFileSelect: (file: File | null) => void
  onFileClear: () => void
  onQueue: (toolId: string, fileName: string) => void
  jobs: JobRecord[]
}) {
  const { toolId } = useParams()
  const tool = tools.find((item) => item.id === toolId)

  const [quality, setQuality] = useState(72)
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL')
  const [password, setPassword] = useState('')
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [mergeFiles, setMergeFiles] = useState<File[]>([])
  const [latestOutput, setLatestOutput] = useState<{
    fileName: string
    size: number
    createdAt: number
    downloadUrl: string
    mimeType: string
  } | null>(null)

  const runLockRef = useRef(false)

  useEffect(() => {
    return () => {
      if (latestOutput?.downloadUrl) {
        URL.revokeObjectURL(latestOutput.downloadUrl)
      }
    }
  }, [latestOutput])

  useEffect(() => {
    if (tool?.id !== 'merge-pdf') {
      setMergeFiles([])
    }
  }, [tool?.id])

  useEffect(() => {
    if (!tool) return

    applySeoMetadata({
      title: `${tool.title} — ${BRAND_NAME}`,
      description: `${tool.description} Runs locally in your browser with ${BRAND_NAME}. Private PDF processing, zero uploads.`,
      path: `/tool/${tool.id}`,
    })
  }, [tool])

  if (!tool) {
    return (
      <div className="not-found">
        <h1>Tool not found</h1>
        <p>This module doesn't exist in the current catalog.</p>
        <Link to="/" className="btn btn-ghost">
          <ArrowLeft size={14} />
          Back to home
        </Link>
      </div>
    )
  }

  const Icon = tool.icon

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files
    if (!list || list.length === 0) return

    if (tool.id === 'merge-pdf') {
      const all = Array.from(list).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      )
      if (all.length === 0) {
        setRunError('Merge PDF accepts only PDF files.')
        return
      }
      setMergeFiles(all)
      onFileSelect(all[0])
    } else {
      setMergeFiles([])
      onFileSelect(readIncomingFile(list))
    }

    event.target.value = ''
  }

  const clearCurrentFiles = () => {
    setMergeFiles([])
    onFileClear()
  }

  const startRun = async () => {
    if (!activeFile || running || runLockRef.current) return

    runLockRef.current = true
    setRunError(null)
    setRunning(true)
    setProgress(6)

    try {
      const output = await createOutputArtifact(
        {
          toolId: tool.id,
          file: activeFile,
          quality,
          watermarkText,
          password,
          additionalFiles: tool.id === 'merge-pdf' ? mergeFiles.slice(1) : [],
        },
        (next) => setProgress(Math.max(6, Math.min(99, next))),
      )

      const downloadUrl = URL.createObjectURL(output.blob)
      if (latestOutput?.downloadUrl) URL.revokeObjectURL(latestOutput.downloadUrl)

      setLatestOutput({
        fileName: output.fileName,
        size: output.blob.size,
        createdAt: Date.now(),
        downloadUrl,
        mimeType: output.mimeType,
      })

      triggerDownload(downloadUrl, output.fileName)
      setProgress(100)

      const queueName =
        tool.id === 'merge-pdf' && mergeFiles.length > 1
          ? `${mergeFiles.length} PDF files`
          : activeFile.name
      onQueue(tool.id, queueName)
    } catch (error) {
      setProgress(0)
      setRunError(error instanceof Error ? error.message : 'Failed to generate output.')
    } finally {
      setRunning(false)
      runLockRef.current = false
    }
  }

  const downloadRunSummary = () => {
    if (!activeFile) return

    const lines = [
      `PaperKnife Web Job`,
      `Tool: ${tool.title}`,
      `Input: ${tool.id === 'merge-pdf' && mergeFiles.length > 1 ? `${mergeFiles.length} PDF files` : `${activeFile.name} (${formatBytes(activeFile.size)})`}`,
      `Quality: ${quality}`,
      `Watermark: ${watermarkText || 'none'}`,
      `Password set: ${password ? 'yes' : 'no'}`,
      `Generated: ${new Date().toISOString()}`,
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `${tool.id}-run.txt`
    anchor.click()
    URL.revokeObjectURL(href)
  }

  const recentJobs = jobs
    .filter((job) => job.toolId === tool.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)

  return (
    <div className="workspace-root">

      {/* Main panel */}
      <div className="workspace-card fade-up">
        <Link className="back-nav" to="/">
          <ArrowLeft size={12} />
          All tools
        </Link>

        <div
          className="ws-tool-header"
          style={{ '--accent': tool.accent } as React.CSSProperties}
        >
          <div className="ws-tool-identity">
            <div className="ws-tool-icon">
              <Icon size={20} />
            </div>
            <div>
              <p className="ws-tool-eyebrow">{tool.category}</p>
              <h1 className="ws-tool-name">{tool.title}</h1>
              <p className="ws-tool-desc">{tool.description}</p>
            </div>
          </div>
          <span className="ws-eta-badge">~{tool.eta}</span>
        </div>

        <div className="ws-body">

          {/* File */}
          <div>
            <p className="ws-section-label">Input file</p>
            <div className="ws-file-area">
              {activeFile ? (
                <div className="ws-file-pill">
                  <span className="file-dot" />
                  <span className="fn">{activeFile.name}</span>
                  <span className="fs">{formatBytes(activeFile.size)}</span>
                  <button className="btn btn-icon btn-sm" type="button" onClick={clearCurrentFiles} aria-label="Remove file">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="ws-empty-pill">
                  <FileUp size={14} />
                  No file selected
                </div>
              )}

              <label className="btn btn-ghost btn-sm" htmlFor="workspace-file-input" style={{ cursor: 'pointer' }}>
                {tool.id === 'merge-pdf' ? 'Select PDFs' : activeFile ? 'Replace' : 'Browse'}
              </label>
              <input
                id="workspace-file-input"
                className="hidden-input"
                type="file"
                accept={tool.id === 'image-to-pdf' ? 'image/png,image/jpeg,image/webp' : '.pdf'}
                multiple={tool.id === 'merge-pdf'}
                onChange={handleFileSelect}
              />
            </div>
            {tool.id === 'merge-pdf' && mergeFiles.length > 1 && (
              <p className="merge-info">↳ {mergeFiles.length} PDFs queued for merge</p>
            )}
          </div>

          {/* Controls */}
          <div>
            <p className="ws-section-label">Parameters</p>
            <div className="controls-list">
              <div className="control-item">
                <label className="control-label">
                  Quality profile <strong>{quality}</strong>
                </label>
                <input
                  className="control-input"
                  type="range"
                  min={20}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  aria-label="Quality"
                />
              </div>

              <div className="control-item">
                <label className="control-label" htmlFor="ws-watermark">
                  Watermark / Signature text
                </label>
                <input
                  id="ws-watermark"
                  className="control-input"
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="e.g. CONFIDENTIAL"
                />
              </div>

              <div className="control-item">
                <label className="control-label" htmlFor="ws-password">
                  Password <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(for encrypted PDFs)</span>
                </label>
                <div className="control-input-group">
                  <LockKeyhole size={14} />
                  <input
                    id="ws-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank if not needed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="ws-actions">
            <button
              className="btn btn-primary"
              type="button"
              disabled={!activeFile || running}
              onClick={startRun}
            >
              <Sparkles size={14} />
              {running ? `Processing… ${progress}%` : 'Run Tool'}
            </button>

            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={!activeFile}
              onClick={downloadRunSummary}
            >
              <Gauge size={14} />
              Export job note
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar-card fade-up fade-up-1">
        <div className="sidebar-header">
          <span className="sidebar-title">Run monitor</span>
        </div>

        {/* Progress */}
        <div className="sidebar-section">
          <p className="sidebar-section-label">Progress</p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className={`progress-status${progress === 100 && !running ? ' is-done' : ''}`}>
            {running
              ? `Working… ${progress}%`
              : progress === 100
                ? '✓ Completed'
                : 'Ready to start'}
          </p>
          {runError && <p className="error-text">{runError}</p>}
        </div>

        {/* Latest output */}
        <div className="sidebar-section">
          <p className="sidebar-section-label">Latest output</p>
          {latestOutput ? (
            <div className="output-entry">
              <p className="output-filename">{latestOutput.fileName}</p>
              <p className="output-meta">
                {formatBytes(latestOutput.size)} · {formatTimestamp(latestOutput.createdAt)}
              </p>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => triggerDownload(latestOutput.downloadUrl, latestOutput.fileName)}
                style={{ justifySelf: 'start', marginTop: '0.2rem' }}
              >
                <Download size={13} />
                Download again
              </button>
            </div>
          ) : (
            <p className="muted">Run the tool to generate output.</p>
          )}
        </div>

        {/* History */}
        <div className="sidebar-section">
          <p className="sidebar-section-label">Recent {tool.title} runs</p>
          {recentJobs.length === 0 ? (
            <p className="muted">No runs yet for this tool.</p>
          ) : (
            <ul className="job-list">
              {recentJobs.map((job) => (
                <li key={job.id} className="job-item">
                  <span className="job-item-name">{job.fileName}</span>
                  <span className="job-item-time">{formatTimestamp(job.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   ROOT
───────────────────────────────────────────────────────────── */
export default function App() {
  const [activeFile, setActiveFile] = useState<File | null>(null)
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const RouterComponent = import.meta.env.VITE_USE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter

  const queueJob = (toolId: string, fileName: string) => {
    const now = Date.now()
    setJobs((prev) => {
      const latest = prev[0]
      if (latest && latest.toolId === toolId && latest.fileName === fileName && now - latest.createdAt < 2500) {
        return prev
      }
      return [
        { id: `${toolId}-${now}`, toolId, fileName, createdAt: now, status: 'done' },
        ...prev,
      ]
    })
  }

  return (
    <RouterComponent>
      <AppChrome
        activeFile={activeFile}
        onFileSelect={setActiveFile}
        onFileClear={() => setActiveFile(null)}
        jobs={jobs}
        onQueue={queueJob}
      />
    </RouterComponent>
  )
}
