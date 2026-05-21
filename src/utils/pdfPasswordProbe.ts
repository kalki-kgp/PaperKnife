/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const getCMapUrl = (): string => {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}cmaps/`
}

export const pdfJsAcceptsPassword = async (
  pdfBytes: Uint8Array,
  password: string
): Promise<boolean> => {
  try {
    const task = pdfjsLib.getDocument({
      data: pdfBytes.slice(),
      password,
      cMapUrl: getCMapUrl(),
      cMapPacked: true,
      disableAutoFetch: true,
      disableStream: true
    })
    await task.promise
    return true
  } catch {
    return false
  }
}
