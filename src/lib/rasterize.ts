/**
 * Client-side only. Converts an uploaded File (PDF or image) into an array of
 * SourcePage objects — one rasterized page per PDF page, or a single page for
 * a plain image. Rasterizing client-side (rather than shipping the original
 * PDF to the server) is what lets us hand plain images to the vision model
 * and get back pixel-mappable bounding boxes for the highlight overlay.
 */
import type { SourcePage } from "@/types/exam";

const MAX_DIMENSION = 1600; // keep page images well under Gemini's inline-image size limits
const JPEG_QUALITY = 0.85;

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((lib) => {
      // Match the worker version to the installed package via CDN to avoid
      // bundler/asset-path headaches with pdf.js's worker file.
      lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version}/pdf.worker.min.mjs`;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

async function rasterizePdf(file: File): Promise<SourcePage[]> {
  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  const pages: SourcePage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = MAX_DIMENSION / Math.max(baseViewport.width, baseViewport.height);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    pages.push({
      pageIndex: pageNumber - 1,
      dataUrl: canvasToJpegDataUrl(canvas),
      width: canvas.width,
      height: canvas.height,
    });
  }
  return pages;
}

async function rasterizeImage(file: File): Promise<SourcePage[]> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });

  // Downscale oversized photos the same way PDF pages are, so both paths
  // produce comparably-sized images for the vision model.
  if (Math.max(dims.width, dims.height) <= MAX_DIMENSION) {
    return [{ pageIndex: 0, dataUrl, width: dims.width, height: dims.height }];
  }

  const scale = MAX_DIMENSION / Math.max(dims.width, dims.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(dims.width * scale);
  canvas.height = Math.round(dims.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  context.drawImage(img, 0, 0, canvas.width, canvas.height);

  return [
    {
      pageIndex: 0,
      dataUrl: canvasToJpegDataUrl(canvas),
      width: canvas.width,
      height: canvas.height,
    },
  ];
}

/** Cheap page-count lookup for the upload chip UI — doesn't rasterize anything. */
export async function getPageCount(file: File): Promise<number> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await getPdfjs();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    return pdf.numPages;
  }
  return 1;
}

export async function rasterizeFile(file: File): Promise<SourcePage[]> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return rasterizePdf(file);
  }
  if (file.type.startsWith("image/")) {
    return rasterizeImage(file);
  }
  throw new Error(`Unsupported file type: ${file.type || file.name}`);
}
