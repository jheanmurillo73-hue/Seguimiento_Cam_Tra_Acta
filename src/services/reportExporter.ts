import { jsPDF } from 'jspdf';
import { AutoShape } from '../types';

/**
 * Exporta el listado de autoformas a un archivo CSV estructurado para Excel
 */
export function exportAutoShapesToCsv(shapes: AutoShape[], filenameSuffix: string = 'LaNubia'): void {
  const headers = [
    'ID',
    'Capa Asignada',
    'Tipo de Autoforma',
    'Nombre / Identificador',
    'Categoría',
    'Acta',
    'Fecha',
    'Calibre (Tubería / Dimensión)',
    'Campanas Entrada (Lado A)',
    'Campanas Salida 1 (Lado B)',
    'Campanas Salida 2 (Derivación)',
    'Calibre Salida 2',
    'Total Campanas',
    'Metros Lineales (m)',
    'Estado',
    'Notas / Observaciones',
    'Posición X (%)',
    'Posición Y (%)',
  ];

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = shapes.map((s) => {
    const sLayer = s.layer || (s.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas');
    const totalCampanas = (s.campanasEntrada || 0) + (s.campanasSalida || 0) + (s.campanasSalida2 || 0);

    return [
      escapeCell(s.id),
      escapeCell(sLayer === 'camaras_campanas' ? 'Cámaras y Campanas' : 'Canalizaciones'),
      escapeCell(s.type.toUpperCase()),
      escapeCell(s.name),
      escapeCell(s.category.toUpperCase()),
      escapeCell(s.acta),
      escapeCell(s.fecha),
      escapeCell(s.calibre),
      escapeCell(s.campanasEntrada !== undefined ? s.campanasEntrada : ''),
      escapeCell(s.campanasSalida !== undefined ? s.campanasSalida : ''),
      escapeCell(s.campanasSalida2 !== undefined ? s.campanasSalida2 : ''),
      escapeCell(s.campanasSalida2Calibre || ''),
      escapeCell(totalCampanas > 0 ? totalCampanas : ''),
      escapeCell(s.metros !== undefined ? s.metros : ''),
      escapeCell(s.estado),
      escapeCell(s.notas),
      escapeCell(s.x.toFixed(2)),
      escapeCell(s.y.toFixed(2)),
    ];
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows.map((row) => row.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `Trazabilidad_Capas_${filenameSuffix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Genera el informe PDF con el plano anotado y la tabla de actas y calibres
 */
export async function exportAutoShapesToPdf(
  shapes: AutoShape[],
  canvasDataUrl?: string | null
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const today = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  // Cálculos resumen
  const totalMetros = shapes
    .filter((s) => (s.layer || (s.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas')) === 'canalizaciones')
    .reduce((acc, s) => acc + (s.metros || 0), 0);

  const totalCamaras = shapes.filter(
    (s) => s.category === 'camara_mt' || s.category === 'camara_bt' || s.category === 'caja'
  ).length;

  const totalCampanas = shapes.reduce((acc, s) => {
    return acc + (s.campanasEntrada || 0) + (s.campanasSalida || 0) + (s.campanasSalida2 || 0);
  }, 0);

  // PÁGINA 1: PLANO GENERAL CON AUTOFORMAS
  // Encabezado
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 20, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANO DE OBRA · SEGUIMIENTO DE CÁMARAS, CAMPANAS Y CANALIZACIONES', 14, 10.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Proyecto: La Nubia P2 | Emisión: ${today} | Canalizaciones: ${totalMetros.toFixed(1)}m | Cámaras: ${totalCamaras} | Campanas: ${totalCampanas}`,
    14,
    16
  );

  // Captura del plano si está disponible
  if (canvasDataUrl) {
    try {
      const imgMargin = 12;
      const imgTop = 23;
      const availableW = pageWidth - imgMargin * 2;
      const availableH = pageHeight - imgTop - 10;

      doc.addImage(canvasDataUrl, 'PNG', imgMargin, imgTop, availableW, availableH, undefined, 'FAST');
    } catch (e) {
      console.warn('Error al renderizar captura en PDF:', e);
    }
  }

  // PÁGINA 2: TABLA TÉCNICA DE ACTAS, CALIBRES Y ESTADOS
  doc.addPage('letter', 'landscape');

  // Encabezado Pág 2
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TABLA DE SEGUIMIENTO Y TRAZABILIDAD POR CAPAS Y ACTAS', 14, 11);

  // Tabla
  let tableY = 24;
  doc.setFillColor(30, 41, 59);
  doc.rect(14, tableY, pageWidth - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');

  const colWidths = [26, 20, 42, 22, 38, 28, 18, 22, 40];
  const colTitles = ['CAPA', 'FORMA', 'NOMBRE / REF', 'ACTA', 'CALIBRE / DETALLE', 'CAMPANAS', 'METROS', 'ESTADO', 'NOTAS'];
  let currentX = 16;
  colTitles.forEach((t, i) => {
    doc.text(t, currentX, tableY + 5.5);
    currentX += colWidths[i];
  });

  tableY += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  shapes.forEach((s, idx) => {
    // Si la página se llena, agregar otra
    if (tableY > pageHeight - 20) {
      doc.addPage('letter', 'landscape');
      tableY = 20;
    }

    const sLayer = s.layer || (s.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas');
    const totalCampanasForma =
      (s.campanasEntrada || 0) + (s.campanasSalida || 0) + (s.campanasSalida2 || 0);

    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(14, tableY, pageWidth - 28, 7, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(14, tableY + 7, pageWidth - 14, tableY + 7);

    doc.setTextColor(15, 23, 42);
    let rx = 16;

    // CAPA
    doc.setFont('helvetica', 'bold');
    doc.text(sLayer === 'camaras_campanas' ? 'Cámaras' : 'Canaliz.', rx, tableY + 5);
    rx += colWidths[0];

    // FORMA
    doc.setFont('helvetica', 'normal');
    doc.text(s.type.toUpperCase(), rx, tableY + 5);
    rx += colWidths[1];

    // NOMBRE
    doc.text(s.name.slice(0, 24), rx, tableY + 5);
    rx += colWidths[2];

    // ACTA
    doc.text(s.acta.slice(0, 14), rx, tableY + 5);
    rx += colWidths[3];

    // CALIBRE
    doc.text((s.calibre || '-').slice(0, 22), rx, tableY + 5);
    rx += colWidths[4];

    // CAMPANAS
    doc.text(
      totalCampanasForma > 0
        ? `${totalCampanasForma} (${s.campanasEntrada || 0}E/${s.campanasSalida || 0}S1${s.campanasSalida2 ? `/${s.campanasSalida2}S2` : ''})`
        : '-',
      rx,
      tableY + 5
    );
    rx += colWidths[5];

    // METROS
    doc.text(s.metros !== undefined ? `${s.metros} m` : '-', rx, tableY + 5);
    rx += colWidths[6];

    // ESTADO
    doc.text(s.estado, rx, tableY + 5);
    rx += colWidths[7];

    // NOTAS
    doc.text((s.notas || '').slice(0, 26), rx, tableY + 5);

    tableY += 7;
  });

  // Descargar archivo
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Informe_Plano_Capas_${dateStr}.pdf`);
}
