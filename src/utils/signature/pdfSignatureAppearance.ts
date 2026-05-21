/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { PrintCopyMetadata } from './types'

export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  )
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export class EncryptedPdfNeedsPasswordError extends Error {
  constructor() {
    super('Password required to create print copy')
    this.name = 'EncryptedPdfNeedsPasswordError'
  }
}

const formatUtc = (date: Date | null): string => {
  if (!date) return 'Signing time unavailable'
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}

export const createValidationPrintCopy = async (
  inputBytes: Uint8Array,
  metadata: PrintCopyMetadata,
  password?: string
): Promise<Uint8Array> => {
  let source: PDFDocument
  try {
    source = await PDFDocument.load(inputBytes, {
      password,
      ignoreEncryption: true
    } as Parameters<typeof PDFDocument.load>[1])
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : ''
    if (message.includes('password') || message.includes('encrypt')) {
      throw new EncryptedPdfNeedsPasswordError()
    }
    throw err
  }

  const output = await PDFDocument.create()
  const pages = await output.copyPages(source, source.getPageIndices())
  pages.forEach((page) => output.addPage(page))

  const font = await output.embedFont(StandardFonts.Helvetica)
  const bold = await output.embedFont(StandardFonts.HelveticaBold)
  const lastPage = output.getPage(output.getPageCount() - 1)
  const { width, height } = lastPage.getSize()
  const bandHeight = 72

  lastPage.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: bandHeight,
    color: rgb(1, 0.95, 0.93),
    borderColor: rgb(0.9, 0.54, 0.45),
    borderWidth: 1
  })

  const statusColor = metadata.verified ? rgb(0.1, 0.45, 0.2) : rgb(0.6, 0.1, 0.1)
  const title = metadata.verified
    ? 'PaperKnife offline UIDAI validation — print copy'
    : 'PaperKnife validation band — reference copy'

  lastPage.drawText(title, {
    x: 18,
    y: bandHeight - 22,
    size: 9,
    font: bold,
    color: statusColor
  })

  lastPage.drawText(`Signer: ${metadata.signerLabel}`, {
    x: 18,
    y: bandHeight - 36,
    size: 8,
    font,
    color: rgb(0.2, 0.2, 0.2)
  })

  lastPage.drawText(`Signed: ${formatUtc(metadata.signedAt)}`, {
    x: 18,
    y: bandHeight - 48,
    size: 8,
    font,
    color: rgb(0.2, 0.2, 0.2)
  })

  lastPage.drawText(metadata.revocationNote, {
    x: 18,
    y: bandHeight - 60,
    size: 7,
    font,
    color: rgb(0.35, 0.35, 0.35)
  })

  // Footer hash must remain the unmodified input file digest, not the output PDF.
  const footerHash = metadata.inputSha256
  lastPage.drawText(`Input SHA-256: ${footerHash}`, {
    x: 18,
    y: 8,
    size: 6.5,
    font,
    color: rgb(0.45, 0.45, 0.45)
  })

  lastPage.drawText('Verified print copy — original digital signature unchanged in source bytes', {
    x: 18,
    y: height - 14,
    size: 6,
    font,
    color: rgb(0.5, 0.5, 0.5)
  })

  return output.save({ useObjectStreams: false })
}
