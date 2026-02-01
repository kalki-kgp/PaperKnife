import * as pdfjsLib from 'pdfjs-dist';
// Explicitly import the worker as a URL so Vite handles it correctly
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PdfMetaData {
  thumbnail: string
  pageCount: number
  isLocked: boolean
}

// Optimized: Load the PDF Document once
export const loadPdfDocument = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: `${window.location.origin}/PaperKnife/cmaps/`,
    cMapPacked: true,
  });
  return loadingTask.promise;
};

// Optimized: Render a specific page from an already loaded PDF Document
export const renderPageThumbnail = async (pdf: any, pageNum: number, scale = 1.5): Promise<string> => {
  try {
    const page = await pdf.getPage(pageNum);
    // Use device pixel ratio for sharper rendering on high-DPI screens
    const outputScale = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * outputScale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error('Canvas context not available');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Scale context to match outputScale
    if (outputScale !== 1) {
      // Not strictly necessary if we just want raw pixels, but helps if we draw overlays
    }
    
    await page.render({ 
      canvasContext: context, 
      viewport, 
      intent: 'display'
    }).promise;
    
    // Return high-quality JPEG
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.error(`Error rendering page ${pageNum}:`, error);
    return '';
  }
};

// Wrapper for backward compatibility
export const generateThumbnail = async (file: File, pageNum: number = 1): Promise<string> => {
  try {
    const pdf = await loadPdfDocument(file);
    return await renderPageThumbnail(pdf, pageNum, 0.8); // Smaller scale for grid thumbnails
  } catch (error) {
    console.error('Thumbnail error:', error);
    return '';
  }
};

export const getPdfMetaData = async (file: File): Promise<PdfMetaData> => {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: await file.arrayBuffer(),
      cMapUrl: `${window.location.origin}/PaperKnife/cmaps/`,
      cMapPacked: true,
    });
    
    loadingTask.onPassword = () => { throw new Error('PASSWORD_REQUIRED'); };
    
    const pdf = await loadingTask.promise;
    const firstPageThumb = await renderPageThumbnail(pdf, 1);
    
    return {
      thumbnail: firstPageThumb,
      pageCount: pdf.numPages,
      isLocked: false
    };
  } catch (error: any) {
    if (error.message === 'PASSWORD_REQUIRED' || error.name === 'PasswordException') {
      return { thumbnail: '', pageCount: 0, isLocked: true };
    }
    return { thumbnail: '', pageCount: 0, isLocked: false };
  }
};

export const unlockPdf = async (file: File, password: string): Promise<PdfMetaData & { success: boolean, pdfDoc?: any }> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password,
      cMapUrl: `${window.location.origin}/PaperKnife/cmaps/`,
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
    
    // If we reach here, password is correct
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
