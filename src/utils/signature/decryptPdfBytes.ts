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

export type PdfEncryptionInfo = {
  encrypted: boolean
  algorithm?: 'AES-256' | 'AES-128' | 'RC4'
  version?: number
  revision?: number
}

export class DecryptPdfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecryptPdfError'
  }
}

export const readPdfEncryptionInfo = async (pdfBytes: Uint8Array): Promise<PdfEncryptionInfo> => {
  try {
    const { isEncrypted } = await import('@localonlytools/pdf-decrypt')
    return await isEncrypted(pdfBytes)
  } catch {
    return { encrypted: pdfHasEncryptionMarker(pdfBytes) }
  }
}

const probePasswordWithPdfJs = async (pdfBytes: Uint8Array, password: string): Promise<boolean> => {
  if (typeof window === 'undefined') return false
  try {
    const { pdfJsAcceptsPassword } = await import('../pdfPasswordProbe')
    return await pdfJsAcceptsPassword(pdfBytes, password)
  } catch {
    return false
  }
}

export const decryptPdfBytesForInspection = async (
  pdfBytes: Uint8Array,
  password?: string
): Promise<Uint8Array> => {
  const trimmed = password?.trim()
  if (!trimmed) return pdfBytes

  const info = await readPdfEncryptionInfo(pdfBytes)
  if (!info.encrypted) return pdfBytes

  const { decryptPDF } = await import('@localonlytools/pdf-decrypt')
  let decrypted: Uint8Array
  try {
    decrypted = await decryptPDF(pdfBytes, trimmed)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not decrypt PDF'
    if (message.includes('Incorrect password')) {
      const pdfJsOk = await probePasswordWithPdfJs(pdfBytes, trimmed)
      if (pdfJsOk) {
        throw new DecryptPdfError(
          'Your password opens this PDF in the browser, but PaperKnife could not decrypt it for signature inspection. Try reloading the page and verifying again.'
        )
      }
      throw new DecryptPdfError(
        'Incorrect e-Aadhaar password. Use the same password that opens this PDF in your browser or Adobe Reader.'
      )
    }
    if (message.includes('Unsupported encryption')) {
      throw new DecryptPdfError(
        `This PDF uses encryption (${message}) that could not be unlocked offline.`
      )
    }
    throw new DecryptPdfError(message)
  }

  if (pdfHasEncryptionMarker(decrypted)) {
    throw new DecryptPdfError(
      'Password did not fully unlock the PDF for signature inspection. Confirm you are using the same password that opens the file elsewhere.'
    )
  }

  return decrypted
}
