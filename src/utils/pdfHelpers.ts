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
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
// Explicitly import the worker as a URL so Vite handles it correctly
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PdfMetaData {
  thumbnail: string
  pageCount: number
  isLocked: boolean
}

// Fixed cMapUrl for true offline usage (relative to base)
const getCMapUrl = () => {
  const isCapacitor = Capacitor.isNativePlatform();
  if (isCapacitor) return 'cmaps/';

  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}cmaps/`;
};

/**
 * Universal file downloader that works on Web and Android
 */
export const downloadFile = async (data: Uint8Array | string, fileName: string, mimeType: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      // For Android, we use the Filesystem API
      let base64Data = '';
      if (typeof data === 'string') {
        base64Data = data.includes(',') ? data.split(',')[1] : data;
      } else {
        // High-performance chunked base64 conversion
        const bytes = new Uint8Array(data);
        const chunks = [];
        const chunkSize = 0x8000; // 32KB chunks
        for (let i = 0; i < bytes.length; i += chunkSize) {
          chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize))));
        }
        base64Data = btoa(chunks.join(''));
      }

      // Resolve duplicate filenames
      let finalName = fileName;
      let counter = 1;
      const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      const extension = fileName.substring(fileName.lastIndexOf('.'));

      while (true) {
        try {
          await Filesystem.stat({
            path: finalName,
            directory: Directory.Documents
          });
          // If stat succeeds, file exists
          finalName = `${baseName} (${counter})${extension}`;
          counter++;
        } catch (e) {
          // If stat fails, file doesn't exist, we can use this name
          break;
        }
      }

      await Filesystem.writeFile({
        path: finalName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true
      });
      
      return true;
    } catch (e) {
      console.error('Download error:', e);
      throw e;
    }
  } else {
    // Standard Web Download
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
  }
};

/**
 * Universal file sharer
 */
export const shareFile = async (data: Uint8Array | string, fileName: string, mimeType: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      // For Android, we save to Cache directory first, then share
      let base64Data = '';
      if (typeof data === 'string') {
        base64Data = data.includes(',') ? data.split(',')[1] : data;
      } else {
        // High-performance chunked base64 conversion
        const bytes = new Uint8Array(data);
        const chunks = [];
        const chunkSize = 0x8000; // 32KB chunks
        for (let i = 0; i < bytes.length; i += chunkSize) {
          chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize))));
        }
        base64Data = btoa(chunks.join(''));
      }

      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache, // Use Cache for temporary sharing
        recursive: true
      });

      await Share.share({
        title: fileName,
        text: `Shared via PaperKnife`,
        url: result.uri,
        dialogTitle: 'Share PDF'
      });
      
      return true;
    } catch (e) {
      console.error('Share error:', e);
      throw e;
    }
  } else {
    // Web Share API
    const blob = typeof data === 'string' 
      ? await (await fetch(data)).blob() 
      : new Blob([data as BlobPart], { type: mimeType });
    
    const file = new File([blob], fileName, { type: mimeType });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: fileName,
          text: 'Shared via PaperKnife'
        });
        return true;
      } catch (e) {
        console.error('Web share failed, falling back to download');
      }
    }
    
    // Fallback to download if sharing is not supported
    return downloadFile(data, fileName, mimeType);
  }
};

// Optimized: Load the PDF Document once
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

// Optimized: Render a specific page from an already loaded PDF Document
export const renderPageThumbnail = async (pdf: any, pageNum: number, scale = 1.0): Promise<string> => {
  try {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: scale });
    
    // High-quality preview (1200px)
    const maxDimension = 1200; 
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
    
    // Memory cleanup
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  } catch (error) {
    console.error(`Error rendering page ${pageNum}:`, error);
    return '';
  }
};

/**
 * ULTRA-FAST: Render a small thumbnail for grids/lists
 * Uses lower dimension and higher compression to save RAM on 100+ page docs
 */
export const renderGridThumbnail = async (pdf: any, pageNum: number): Promise<string> => {
  try {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 0.5 }); // Lower initial scale
    
    const maxDimension = 400; // Small but crisp for grids
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
    
    // Higher compression for grid thumbnails
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  } catch (error) {
    return '';
  }
};

// Wrapper for backward compatibility
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

/** Render each page via pdfjs (which decrypts content) and rebuild a clean PDF with pdf-lib. */
export const stripPdfEncryption = async (file: File, password?: string): Promise<Uint8Array> => {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    password: password || '',
    cMapUrl: getCMapUrl(),
    cMapPacked: true,
  })
  const pdf = await loadingTask.promise
  const { PDFDocument } = await import('pdf-lib')
  const newPdf = await PDFDocument.create()

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const baseViewport = page.getViewport({ scale: 1.0 })
    const renderViewport = page.getViewport({ scale: 2.0 })

    const canvas = document.createElement('canvas')
    canvas.width = renderViewport.width
    canvas.height = renderViewport.height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport: renderViewport }).promise

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(',')[1]), c => c.charCodeAt(0))
    const img = await newPdf.embedJpg(jpegBytes)
    const newPage = newPdf.addPage([baseViewport.width, baseViewport.height])
    newPage.drawImage(img, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height })

    canvas.width = 0
    canvas.height = 0
  }

  return await newPdf.save()
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
  } catch (error: any) {
    return {
      thumbnail: '',
      pageCount: 0,
      isLocked: true,
      success: false
    };
  }
};
