/**
 * PaperKnife - The Swiss Army Knife for PDFs
 * Copyright (C) 2026 kalki-kgp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PdfMetaData {
  thumbnail: string
  pageCount: number
  isLocked: boolean
}

const getCMapUrl = () => {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}cmaps/`;
};

export const downloadFile = async (data: Uint8Array | string, fileName: string, mimeType: string) => {
  const blob = typeof data === 'string'
    ? await (await fetch(data)).blob()
    : new Blob([data as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};

export const shareFile = async (data: Uint8Array | string, fileName: string, mimeType: string) => {
  const blob = typeof data === 'string'
    ? await (await fetch(data)).blob()
    : new Blob([data as BlobPart], { type: mimeType });

  const file = new File([blob], fileName, { type: mimeType });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: fileName,
        text: 'Shared via PaperKnife',
      });
      return true;
    } catch {
      console.error('Web share failed, falling back to download');
    }
  }

  return downloadFile(data, fileName, mimeType);
};

export const loadPdfDocument = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: getCMapUrl(),
      cMapPacked: true,
    });
    return await loadingTask.promise;
  } catch (error: any) {
    if (error.name === 'PasswordException') {
      throw error;
    }
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: getCMapUrl(),
      cMapPacked: true,
      stopAtErrors: false,
    });
    return await loadingTask.promise;
  }
};

export const renderPageThumbnail = async (pdf: any, pageNum: number, scale = 1.0, maxDimension = 1200): Promise<string> => {
  try {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: scale });

    const thumbnailScale = Math.min(maxDimension / viewport.width, maxDimension / viewport.height);
    const dpr = window.devicePixelRatio || 1;
    const renderScale = scale * thumbnailScale * Math.min(dpr, 2);
    const thumbViewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas context not available');

    canvas.height = thumbViewport.height;
    canvas.width = thumbViewport.width;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport: thumbViewport, intent: 'print' }).promise;
    const dataUrl = canvas.toDataURL('image/webp', 0.8) || canvas.toDataURL('image/jpeg', 0.9);

    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  } catch (error) {
    console.error(`Error rendering page ${pageNum}:`, error);
    return '';
  }
};

export const renderGridThumbnail = async (pdf: any, pageNum: number): Promise<string> => {
  try {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 0.5 });

    const maxDimension = 400;
    const thumbnailScale = Math.min(maxDimension / viewport.width, maxDimension / viewport.height);
    const thumbViewport = page.getViewport({ scale: thumbnailScale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) return '';

    canvas.height = thumbViewport.height;
    canvas.width = thumbViewport.width;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport: thumbViewport, intent: 'display' }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  } catch {
    return '';
  }
};

export const generateThumbnail = async (file: File, pageNum: number = 1): Promise<string> => {
  try {
    const pdf = await loadPdfDocument(file);
    return await renderPageThumbnail(pdf, pageNum, 0.8);
  } catch (error) {
    console.error('Thumbnail error:', error);
    return '';
  }
};

const isPasswordRequiredError = (error: { message?: string; name?: string }) =>
  error.message === 'PASSWORD_REQUIRED' || error.name === 'PasswordException'

const ENCRYPT_MARKER_RE = /\/Encrypt[\s\n\r/<>]/

export const pdfHasEncryptionMarker = (data: ArrayBuffer | Uint8Array): boolean => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const decoder = new TextDecoder('latin1')
  const windowSize = 256 * 1024
  const head = decoder.decode(bytes.subarray(0, Math.min(bytes.length, windowSize)))
  if (ENCRYPT_MARKER_RE.test(head)) return true
  const tailStart = Math.max(0, bytes.length - windowSize)
  return ENCRYPT_MARKER_RE.test(decoder.decode(bytes.subarray(tailStart)))
}

export const stripPdfEncryption = async (file: File, password?: string): Promise<Uint8Array> => {
  const { decryptPdfWithQpdf } = await import('./qpdfDecrypt')
  const pdfBytes = await decryptPdfWithQpdf(new Uint8Array(await file.arrayBuffer()), password)
  if (pdfHasEncryptionMarker(pdfBytes)) {
    throw new Error('Could not remove encryption. Check the password and try again.')
  }
  return pdfBytes
}

export const getPdfMetaData = async (file: File): Promise<PdfMetaData> => {
  const arrayBuffer = await file.arrayBuffer()
  const hasEncryption = pdfHasEncryptionMarker(arrayBuffer)

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: getCMapUrl(),
      cMapPacked: true,
    });

    loadingTask.onPassword = () => { throw new Error('PASSWORD_REQUIRED'); };

    const pdf = await loadingTask.promise;
    const firstPageThumb = await renderPageThumbnail(pdf, 1);

    return {
      thumbnail: firstPageThumb,
      pageCount: pdf.numPages,
      isLocked: hasEncryption,
    };
  } catch (error: any) {
    if (isPasswordRequiredError(error)) {
      return { thumbnail: '', pageCount: 0, isLocked: true };
    }
    return { thumbnail: '', pageCount: 0, isLocked: hasEncryption };
  }
};

export const unlockPdf = async (file: File, password: string): Promise<PdfMetaData & { success: boolean, pdfDoc?: any }> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password,
      cMapUrl: getCMapUrl(),
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
    const firstPageThumb = await renderPageThumbnail(pdf, 1);

    return {
      thumbnail: firstPageThumb,
      pageCount: pdf.numPages,
      isLocked: false,
      success: true,
      pdfDoc: pdf
    };
  } catch {
    return {
      thumbnail: '',
      pageCount: 0,
      isLocked: true,
      success: false
    };
  }
};
