/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const ENCRYPT_MARKER_RE = /\/Encrypt[\s\n\r/<>]/

/** Detect /Encrypt in the PDF (head and trailer; trailer is often beyond the first 256KB). */
export const pdfHasEncryptionMarker = (data: ArrayBuffer | Uint8Array): boolean => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const decoder = new TextDecoder('latin1')
  const windowSize = 256 * 1024
  const head = decoder.decode(bytes.subarray(0, Math.min(bytes.length, windowSize)))
  if (ENCRYPT_MARKER_RE.test(head)) return true
  const tailStart = Math.max(0, bytes.length - windowSize)
  return ENCRYPT_MARKER_RE.test(decoder.decode(bytes.subarray(tailStart)))
}
