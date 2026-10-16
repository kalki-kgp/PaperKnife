/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const SITE_URL = 'https://paperknife.app'

export interface RouteSeo {
  title: string
  description: string
  /** Utility routes that should stay out of the index. */
  noindex?: boolean
}

/**
 * Every indexable route needs its own title, description and canonical.
 * Without these each route served the homepage's head, canonical included,
 * which told Google all 22 sitemap URLs were duplicates of "/".
 */
export const routeSeo: Record<string, RouteSeo> = {
  '/': {
    title: 'PaperKnife — Merge, Split, Compress & Convert PDF Online (100% Private)',
    description:
      'PaperKnife is a free, private PDF toolkit that runs 100% in your browser. Merge PDF, split pages, compress, protect, unlock, rotate, watermark, convert to images, and more — zero uploads.'
  },
  '/merge': {
    title: 'Merge PDF Files Online — Free & 100% Private | PaperKnife',
    description:
      'Combine multiple PDFs into a single file in your browser. Drag to reorder, no uploads, no account, no watermark — your files never leave your device.'
  },
  '/split': {
    title: 'Split PDF — Extract Pages Free, No Upload | PaperKnife',
    description:
      'Split a PDF into separate files or pull out a page range. Runs entirely in your browser, so your document is never sent to a server.'
  },
  '/compress': {
    title: 'Compress PDF — Reduce File Size Privately | PaperKnife',
    description:
      'Shrink PDF file size with adjustable quality presets. Compression runs locally in your browser — no uploads, no sign-up, no file size limits.'
  },
  '/protect': {
    title: 'Password Protect PDF — Encrypt Locally | PaperKnife',
    description:
      'Add a password and encrypt a PDF in your browser. The document and the password never leave your device, so nothing is transmitted or stored.'
  },
  '/unlock': {
    title: 'Unlock PDF — Remove Password In Your Browser | PaperKnife',
    description:
      'Remove a known password from a PDF locally. Decryption happens on your device — the file is never uploaded to a server.'
  },
  '/rotate-pdf': {
    title: 'Rotate PDF Pages — Free, Private, No Upload | PaperKnife',
    description:
      'Rotate some or all pages of a PDF and save the result. Runs fully in your browser, with no uploads and no account required.'
  },
  '/crop-pdf': {
    title: 'Crop PDF Pages Online — Private & Free | PaperKnife',
    description:
      'Trim margins or crop PDF pages visually in your browser. Nothing is uploaded — the document stays on your device the whole time.'
  },
  '/rearrange-pdf': {
    title: 'Rearrange PDF Pages — Drag to Reorder | PaperKnife',
    description:
      'Reorder, duplicate or delete PDF pages by dragging thumbnails. Everything runs locally in your browser with zero uploads.'
  },
  '/page-numbers': {
    title: 'Add Page Numbers to PDF — Free & Private | PaperKnife',
    description:
      'Insert page numbers into a PDF with control over position, format and starting number. Runs in your browser; no file ever leaves your device.'
  },
  '/watermark': {
    title: 'Add Watermark to PDF — Free, No Upload | PaperKnife',
    description:
      'Stamp text or image watermarks across PDF pages with opacity and rotation control. Processed locally in your browser.'
  },
  '/metadata': {
    title: 'Edit & Remove PDF Metadata — Clean Documents | PaperKnife',
    description:
      'View, edit or strip PDF metadata such as author, title and producer to anonymise a document. Runs locally — nothing is uploaded.'
  },
  '/signature': {
    title: 'Sign PDF Online — Draw or Upload a Signature | PaperKnife',
    description:
      'Add an electronic signature to a PDF by drawing it or placing an image. Your signature and your document stay in your browser.'
  },
  '/fill-pdf': {
    title: 'Fill PDF Forms Online — Free, No Upload | PaperKnife',
    description:
      'Type into PDF form fields, tick checkboxes and pick options, then download or sign the completed form. Runs in your browser; nothing is uploaded.'
  },
  '/grayscale': {
    title: 'Convert PDF to Grayscale — Free & Private | PaperKnife',
    description:
      'Turn a colour PDF into grayscale to cut file size or prepare it for printing. Conversion runs entirely in your browser.'
  },
  '/pdf-to-image': {
    title: 'PDF to JPG & PNG — Convert Pages Privately | PaperKnife',
    description:
      'Export PDF pages as JPG or PNG images at your chosen resolution. Rendering happens in your browser with no uploads.'
  },
  '/image-to-pdf': {
    title: 'Image to PDF — JPG & PNG to PDF Free | PaperKnife',
    description:
      'Turn JPG, PNG or WebP images into a single PDF. Reorder them before converting; everything runs locally in your browser.'
  },
  '/extract-images': {
    title: 'Extract Images from PDF — Free & Private | PaperKnife',
    description:
      'Pull every embedded image out of a PDF at original quality and download them. Runs in your browser — no uploads.'
  },
  '/pdf-to-text': {
    title: 'PDF to Text — Extract & OCR In Your Browser | PaperKnife',
    description:
      'Extract text from a PDF, including scanned pages via on-device OCR. Tesseract runs in your browser, so nothing is uploaded.'
  },
  '/repair': {
    title: 'Repair a Corrupted PDF — Free, No Upload | PaperKnife',
    description:
      'Attempt to rebuild a damaged or unreadable PDF locally in your browser. Your file is never sent to a server.'
  },
  '/compare': {
    title: 'Compare Two PDFs — Visual Page Diff | PaperKnife',
    description:
      'Spot the differences between two PDFs with a visual page-by-page diff. Both documents stay in your browser.'
  },
  '/word-to-pdf': {
    title: 'Word to PDF — DOCX Converter With Real Text | PaperKnife',
    description:
      'Convert DOCX to PDF in your browser with selectable, searchable text rather than flat images. No uploads, no account.'
  },
  '/about': {
    title: 'About PaperKnife — Private, Local PDF Tools',
    description:
      'Why PaperKnife processes PDFs entirely in your browser, how the zero-server architecture works, and what that means for your privacy.'
  },
  '/privacy': {
    title: 'Privacy Policy — PaperKnife',
    description:
      'PaperKnife does not upload, store or transmit your documents. Read exactly what does and does not happen to your files and your data.'
  },
  '/feedback': {
    title: 'Feedback & Feature Requests — PaperKnife',
    description:
      'Report a bug or request a PDF tool. Tell us what is missing from PaperKnife.'
  },
  '/settings': {
    title: 'Settings — PaperKnife',
    description: 'Configure auto-wipe, theme and workspace behaviour for PaperKnife.',
    noindex: true
  },
  '/thanks': {
    title: 'Thanks — PaperKnife',
    description: 'Credits and acknowledgements for the projects PaperKnife is built on.',
    noindex: true
  }
}

export const getRouteSeo = (pathname: string): RouteSeo =>
  routeSeo[pathname] ?? routeSeo['/']

/** Routes that describe the project rather than perform a task. */
const INFO_PATHS = new Set(['/about', '/privacy', '/feedback'])

export const indexablePaths = (): string[] =>
  Object.keys(routeSeo).filter((path) => !routeSeo[path].noindex)

export const isToolPath = (path: string): boolean =>
  path !== '/' && !INFO_PATHS.has(path) && !routeSeo[path].noindex

/** Breadcrumb and structured-data label, taken from the title's leading phrase. */
export const shortName = (path: string): string =>
  routeSeo[path].title.split(' — ')[0].split(' | ')[0].trim()

export const sitemapPriority = (path: string): string =>
  path === '/' ? '1.0' : INFO_PATHS.has(path) ? '0.5' : '0.9'

export const sitemapChangefreq = (path: string): string =>
  path === '/' ? 'weekly' : 'monthly'
