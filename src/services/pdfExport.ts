import type { jsPDF } from 'jspdf';

const PDF_MARGIN_MM = 10;
const PDF_HEADER_HEIGHT_MM = 14;

export interface PdfSectionMeta {
  title: string;
  subtitle?: string;
  exportedAt: string;
}

async function loadPdfLibraries() {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  return { html2canvas, jsPDF };
}

function canvasSliceHeight(canvasWidth: number, pageWidthMm: number, pageHeightMm: number): number {
  return Math.max(1, Math.floor((pageHeightMm * canvasWidth) / pageWidthMm));
}

function waitForFonts(): Promise<void> {
  if ('fonts' in document) {
    return (document.fonts.ready as Promise<unknown>).then(() => undefined);
  }

  return Promise.resolve();
}

function drawHeader(pdf: jsPDF, meta: PdfSectionMeta) {
  pdf.setFillColor(7, 17, 28);
  pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), 18, 'F');

  pdf.setTextColor(232, 241, 251);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(meta.title, PDF_MARGIN_MM, 9);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  const subtitle = meta.subtitle ? `${meta.subtitle} · ${meta.exportedAt}` : meta.exportedAt;
  pdf.text(subtitle, PDF_MARGIN_MM, 14);
}

export async function createPdfDocumentAsync(): Promise<jsPDF> {
  const { jsPDF } = await loadPdfLibraries();

  return new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
}

export async function appendElementToPdf(pdf: jsPDF, element: HTMLElement, useCurrentPage: boolean, meta: PdfSectionMeta): Promise<void> {
  await waitForFonts();
  const { html2canvas } = await loadPdfLibraries();

  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: null,
    logging: false,
    windowWidth: Math.max(element.scrollWidth, element.clientWidth, 1280),
    windowHeight: Math.max(element.scrollHeight, element.clientHeight),
    ignoreElements: (node) => {
      return node instanceof HTMLElement && node.dataset.exportIgnore === 'true';
    },
  });

  const pageWidth = pdf.internal.pageSize.getWidth() - PDF_MARGIN_MM * 2;
  const pageHeight = pdf.internal.pageSize.getHeight() - PDF_MARGIN_MM * 2 - PDF_HEADER_HEIGHT_MM;
  const sliceHeight = canvasSliceHeight(canvas.width, pageWidth, pageHeight);

  let offsetY = 0;
  let firstSlice = true;

  while (offsetY < canvas.height) {
    const currentSliceHeight = Math.min(sliceHeight, canvas.height - offsetY);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = currentSliceHeight;

    const context = sliceCanvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to prepare PDF export canvas.');
    }

    context.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      currentSliceHeight,
      0,
      0,
      canvas.width,
      currentSliceHeight,
    );

    if (!useCurrentPage || !firstSlice) {
      pdf.addPage();
    }

    drawHeader(pdf, meta);

    const imageHeight = (currentSliceHeight * pageWidth) / canvas.width;
    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', PDF_MARGIN_MM, PDF_MARGIN_MM + PDF_HEADER_HEIGHT_MM, pageWidth, imageHeight, undefined, 'FAST');

    useCurrentPage = false;
    firstSlice = false;
    offsetY += currentSliceHeight;
  }
}