import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker to use the local copy in /public
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface PdfDocumentInfo {
  doc: pdfjsLib.PDFDocumentProxy;
  numPages: number;
  firstPageWidth: number;
  firstPageHeight: number;
  aspectRatio: number;
}

/**
 * Carga un documento PDF desde una URL, ArrayBuffer o Uint8Array
 */
export async function loadPdfDocument(source: string | ArrayBuffer | Uint8Array): Promise<PdfDocumentInfo> {
  const loadingTask = typeof source === 'string'
    ? pdfjsLib.getDocument({ url: source })
    : pdfjsLib.getDocument({ data: source });

  const doc = await loadingTask.promise;
  const page1 = await doc.getPage(1);
  const viewport = page1.getViewport({ scale: 1.0 });

  return {
    doc,
    numPages: doc.numPages,
    firstPageWidth: viewport.width,
    firstPageHeight: viewport.height,
    aspectRatio: viewport.width / viewport.height,
  };
}

/**
 * Renderiza una página específica del PDF sobre un HTMLCanvasElement
 */
export async function renderPdfPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo obtener el contexto 2D del canvas');
  }

  // Clear canvas
  context.clearRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  return {
    width: viewport.width,
    height: viewport.height,
  };
}
