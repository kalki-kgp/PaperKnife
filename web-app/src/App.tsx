import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
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
import { HashRouter, Link, Route, Routes, useParams } from 'react-router-dom'
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
    <div className="control-room">
      <div className="texture-overlay" />
      <div className="accent-wave accent-wave-a" />
      <div className="accent-wave accent-wave-b" />

      <header className="command-header reveal-up">
        <Link to="/" className="brand-mark" aria-label="PaperKnife home">
          <span className="brand-monogram">PK</span>
          <div>
            <p>PaperKnife / Web Ops</p>
            <small>Local-only Document Forge</small>
          </div>
        </Link>

        <div className="header-pills">
          <span>
            <Shield size={14} />
            Zero Uploads
          </span>
          <span>
            <Clock3 size={14} />
            {jobs.length} Runs Logged
          </span>
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <HomePage activeFile={activeFile} onFileSelect={onFileSelect} onFileClear={onFileClear} jobs={jobs} />
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
    </div>
  )
}

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
    () => categories.filter((category): category is Exclude<CategoryFilter, 'All'> => category !== 'All'),
    [],
  )

  const goalDescription: Record<Exclude<CategoryFilter, 'All'>, string> = {
    Edit: 'Merge, split, rotate, watermark, and reorder pages.',
    Secure: 'Protect files, remove locks, and clean metadata.',
    Convert: 'Move between PDF, images, and text formats.',
    Optimize: 'Compress, grayscale, and repair heavy documents.',
  }

  const filtered = useMemo(() => {
    return tools.filter((tool) => {
      if (!selectedGoal) {
        return false
      }

      const matchesCategory = tool.category === selectedGoal
      const text = `${tool.title} ${tool.description} ${tool.category}`.toLowerCase()
      const matchesQuery = text.includes(query.trim().toLowerCase())
      return matchesCategory && matchesQuery
    })
  }, [query, selectedGoal])

  const visibleTools = showAllTools ? filtered : filtered.slice(0, 4)

  const totalRuns = jobs.length
  const lastJob = jobs[0]

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    onFileSelect(readIncomingFile(event.dataTransfer.files))
  }

  const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelect(readIncomingFile(event.target.files))
  }

  return (
    <main className="home-flow">
      <section className="panel welcome-panel reveal-up">
        <p className="kicker">Start Here</p>
        <h1>One clear flow for every user.</h1>
        <p>
          Upload your document, select what you want to do, then pick from a short recommended tool list.
          No noisy dashboard.
        </p>
        <div className="flow-strip">
          <span>1. Add file</span>
          <span>2. Pick goal</span>
          <span>3. Run tool</span>
        </div>
        <small className="flow-meta">
          {lastJob
            ? `Last run: ${lastJob.fileName} at ${formatTimestamp(lastJob.createdAt)}`
            : `${totalRuns} total local runs. Files never leave browser memory.`}
        </small>
      </section>

      <section
        className={`panel step-panel reveal-up ${dragging ? 'dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
        onDrop={handleDrop}
      >
        <div className="step-head">
          <span className="step-number">Step 1</span>
          <h2>Upload your document</h2>
        </div>
        <div className="drop-zone-lite">
          <div className="ingest-icon">{activeFile ? <CheckCircle2 size={26} /> : <Upload size={26} />}</div>
          {activeFile ? (
            <div className="active-file-inline">
              <strong>{activeFile.name}</strong>
              <small>{formatBytes(activeFile.size)}</small>
              <button type="button" onClick={onFileClear} aria-label="Clear file">
                <X size={14} />
              </button>
            </div>
          ) : (
            <p>Drag PDF/JPG/PNG/WebP here or choose from device.</p>
          )}
        </div>
        <label className="ink-btn" htmlFor="main-file-input">
          <FileUp size={16} />
          Choose Local File
        </label>
        <input
          id="main-file-input"
          className="hidden-input"
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          onChange={handleSelect}
        />
      </section>

      <section className="panel step-panel reveal-up">
        <div className="step-head">
          <span className="step-number">Step 2</span>
          <h2>What do you want to do?</h2>
        </div>
        <div className="goal-grid">
          {goalChoices.map((goal) => (
            <button
              key={goal}
              className={`goal-card ${selectedGoal === goal ? 'active' : ''}`}
              onClick={() => {
                setSelectedGoal(goal)
                setShowAllTools(false)
              }}
              type="button"
            >
              <strong>{goal}</strong>
              <span>{goalDescription[goal]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel step-panel reveal-up">
        <div className="step-head">
          <span className="step-number">Step 3</span>
          <h2>Pick a tool</h2>
        </div>

        {!selectedGoal ? (
          <p className="step-placeholder">Choose a goal in Step 2 to unlock suggested tools.</p>
        ) : (
          <>
            <div className="search-slot compact">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search within ${selectedGoal.toLowerCase()} tools`}
                aria-label="Search tools"
              />
            </div>

            <div className="guided-tools">
              {visibleTools.map((tool, idx) => {
                const Icon = tool.icon
                return (
                  <Link
                    key={tool.id}
                    className="guided-tool reveal-up"
                    style={{ ['--accent' as string]: tool.accent, animationDelay: `${Math.min(idx * 45, 300)}ms` }}
                    to={`/tool/${tool.id}`}
                  >
                    <div className="guided-tool-main">
                      <span className="guided-icon">
                        <Icon size={18} />
                      </span>
                      <div>
                        <strong>{tool.title}</strong>
                        <p>{tool.description}</p>
                      </div>
                    </div>
                    <div className="guided-tool-meta">
                      <span>{tool.eta}</span>
                      <ArrowRight size={14} />
                    </div>
                  </Link>
                )
              })}
            </div>

            {filtered.length > 4 && (
              <button className="wire-btn show-more" type="button" onClick={() => setShowAllTools((prev) => !prev)}>
                {showAllTools ? 'Show fewer tools' : `Show all ${filtered.length} tools`}
              </button>
            )}

            {filtered.length === 0 && <p className="step-placeholder">No match for this search. Try another keyword.</p>}
          </>
        )}
      </section>
    </main>
  )
}

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

  if (!tool) {
    return (
      <main className="workspace-grid">
        <article className="panel workspace-main">
          <h1>Tool not found</h1>
          <p>This module does not exist in the current catalog.</p>
          <Link to="/" className="wire-btn">
            Back to tool list
          </Link>
        </article>
      </main>
    )
  }

  const Icon = tool.icon

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files
    if (!list || list.length === 0) {
      return
    }

    if (tool.id === 'merge-pdf') {
      const all = Array.from(list).filter(
        (candidate) => candidate.type === 'application/pdf' || candidate.name.toLowerCase().endsWith('.pdf'),
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
    if (!activeFile || running || runLockRef.current) {
      return
    }

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
        (nextProgress) => {
        setProgress(Math.max(6, Math.min(99, nextProgress)))
        },
      )

      const downloadUrl = URL.createObjectURL(output.blob)
      if (latestOutput?.downloadUrl) {
        URL.revokeObjectURL(latestOutput.downloadUrl)
      }

      setLatestOutput({
        fileName: output.fileName,
        size: output.blob.size,
        createdAt: Date.now(),
        downloadUrl,
        mimeType: output.mimeType,
      })

      triggerDownload(downloadUrl, output.fileName)
      setProgress(100)
      const queueName = tool.id === 'merge-pdf' && mergeFiles.length > 1 ? `${mergeFiles.length} PDF files` : activeFile.name
      onQueue(tool.id, queueName)
    } catch (error) {
      setProgress(0)
      setRunError(error instanceof Error ? error.message : 'Failed to generate output.')
    } finally {
      setRunning(false)
      runLockRef.current = false
    }
  }

  const recentJobs = jobs
    .filter((job) => job.toolId === tool.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4)

  const downloadRunSummary = () => {
    if (!activeFile) {
      return
    }

    const lines = [
      `PaperKnife Web Job`,
      `Tool: ${tool.title}`,
      `Input: ${
        tool.id === 'merge-pdf' && mergeFiles.length > 1
          ? `${mergeFiles.length} PDF files`
          : `${activeFile.name} (${formatBytes(activeFile.size)})`
      }`,
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

  return (
    <main className="workspace-grid">
      <article className="panel workspace-main reveal-up">
        <Link className="back-link" to="/">
          Back to Tool Deck
        </Link>

        <header className="workspace-head" style={{ ['--accent' as string]: tool.accent }}>
          <div className="workspace-title">
            <span className="workspace-icon">
              <Icon size={18} />
            </span>
            <div>
              <p className="kicker">Active Operation</p>
              <h1>{tool.title}</h1>
              <p>{tool.description}</p>
            </div>
          </div>
          <span className="eta-badge">{tool.eta}</span>
        </header>

        <section className="file-bay">
          <div className="file-row">
            {activeFile ? (
              <div className="file-pill">
                <strong>{activeFile.name}</strong>
                <span>{formatBytes(activeFile.size)}</span>
                <button onClick={clearCurrentFiles} type="button" aria-label="Clear file">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="empty-pill">
                <p>No file selected yet.</p>
              </div>
            )}

            <label className="wire-btn" htmlFor="workspace-file-input">
              {tool.id === 'merge-pdf' ? 'Select PDFs' : 'Replace file'}
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
            <p className="muted">{mergeFiles.length} PDFs selected for merge.</p>
          )}
        </section>

        <section className="controls-grid">
          <label>
            Quality Profile <strong>{quality}</strong>
            <input
              type="range"
              min={20}
              max={100}
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
          </label>

          <label>
            Watermark Label
            <input
              type="text"
              value={watermarkText}
              onChange={(event) => setWatermarkText(event.target.value)}
              placeholder="Optional label"
            />
          </label>

          <label>
            Password (optional)
            <div className="inline-input">
              <LockKeyhole size={16} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Only needed for secure tools"
              />
            </div>
          </label>
        </section>

        <section className="run-actions">
          <button className="ink-btn" type="button" disabled={!activeFile || running} onClick={startRun}>
            <Sparkles size={16} />
            {running ? 'Processing...' : 'Run Tool'}
          </button>

          <button className="wire-btn" type="button" disabled={!activeFile} onClick={downloadRunSummary}>
            <Gauge size={16} />
            Export Job Note
          </button>
        </section>
      </article>

      <aside className="panel workspace-side reveal-up">
        <h2>Run Monitor</h2>

        <section className="progress-box" style={{ ['--accent' as string]: tool.accent }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p>{running ? `Working... ${progress}%` : progress === 100 ? 'Completed.' : 'Ready to start.'}</p>
          {runError && <p className="error-text">{runError}</p>}
        </section>

        <section className="output-box">
          <h3>Latest Output</h3>
          {latestOutput ? (
            <div className="output-entry">
              <strong>{latestOutput.fileName}</strong>
              <span>
                {formatBytes(latestOutput.size)} • {formatTimestamp(latestOutput.createdAt)}
              </span>
              <button
                className="wire-btn output-btn"
                type="button"
                onClick={() => triggerDownload(latestOutput.downloadUrl, latestOutput.fileName)}
              >
                <Download size={14} />
                Download again
              </button>
              <small>Saved via browser download.</small>
            </div>
          ) : (
            <p className="muted">Run the tool to generate output.</p>
          )}
        </section>

        <section className="timeline">
          <h3>Recent {tool.title} Runs</h3>
          {recentJobs.length === 0 ? (
            <p className="muted">No runs for this tool yet.</p>
          ) : (
            <ul className="job-list">
              {recentJobs.map((job) => (
                <li key={job.id}>
                  <strong>{job.fileName}</strong>
                  <span>{formatTimestamp(job.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </main>
  )
}

export default function App() {
  const [activeFile, setActiveFile] = useState<File | null>(null)
  const [jobs, setJobs] = useState<JobRecord[]>([])

  const queueJob = (toolId: string, fileName: string) => {
    const now = Date.now()

    setJobs((prev) => {
      const latest = prev[0]
      if (latest && latest.toolId === toolId && latest.fileName === fileName && now - latest.createdAt < 2500) {
        return prev
      }

      return [
        {
          id: `${toolId}-${now}`,
          toolId,
          fileName,
          createdAt: now,
          status: 'done',
        },
        ...prev,
      ]
    })
  }

  return (
    <HashRouter>
      <AppChrome
        activeFile={activeFile}
        onFileSelect={setActiveFile}
        onFileClear={() => setActiveFile(null)}
        jobs={jobs}
        onQueue={queueJob}
      />
    </HashRouter>
  )
}
