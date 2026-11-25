import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PengaturanData, RecapResponse } from '../types.ts';
import { formatTanggalIndo, getTodayJakartaDate } from './period.ts';

function getCodeExcelColors(code: string): { fill: string; font: string } {
  switch (code) {
    case 'H':
      return { fill: 'FFDCFCE7', font: 'FF166534' };
    case 'B':
      return { fill: 'FFE0F2FE', font: 'FF075985' };
    case 'H+B':
      return { fill: 'FFDBEAFE', font: 'FF1E3A8A' };
    case 'I':
      return { fill: 'FFFEF3C7', font: 'FF92400E' };
    case 'S':
      return { fill: 'FFFFEDD5', font: 'FF9A3412' };
    case 'A':
      return { fill: 'FFFEE2E2', font: 'FF991B1B' };
    case 'L':
      return { fill: 'FFF1F5F9', font: 'FF475569' };
    default:
      return { fill: 'FFFFFFFF', font: 'FF94A3B8' };
  }
}

function getCodePdfColors(code: string): { fill: [number, number, number]; text: [number, number, number] } | null {
  switch (code) {
    case 'H':
      return { fill: [220, 252, 231], text: [22, 101, 52] };
    case 'B':
      return { fill: [224, 242, 254], text: [7, 89, 133] };
    case 'H+B':
      return { fill: [219, 234, 254], text: [30, 58, 138] };
    case 'I':
      return { fill: [254, 243, 199], text: [146, 64, 14] };
    case 'S':
      return { fill: [255, 237, 213], text: [154, 52, 18] };
    case 'A':
      return { fill: [254, 226, 226], text: [153, 27, 27] };
    case 'L':
      return { fill: [241, 245, 249], text: [71, 85, 105] };
    default:
      return null;
  }
}

export async function exportRecapToExcel(
  recap: RecapResponse,
  pengaturan: PengaturanData,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Absensi Security Al-Muhajirin';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Rekap Absensi', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const dateCount = recap.period.dates.length;
  const totalCols = 2 + dateCount + 7; // No + Nama + dates + H,B,I,S,A,L,Total

  // Row 1: Title
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = 'REKAP ABSENSI SECURITY AL-MUHAJIRIN';
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0B2B52' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 26;

  // Row 2: Institution & Unit
  sheet.mergeCells(2, 1, 2, totalCols);
  const subCell = sheet.getCell(2, 1);
  subCell.value = `${pengaturan.namaInstansi} — ${pengaturan.namaUnit}`;
  subCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  // Row 3: Period & Print Date
  sheet.mergeCells(3, 1, 3, totalCols);
  const periodCell = sheet.getCell(3, 1);
  const printDate = formatTanggalIndo(getTodayJakartaDate());
  periodCell.value = `Periode Laporan: ${recap.period.label}   |   Tanggal Pembuatan Laporan: ${printDate}`;
  periodCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).height = 18;

  // Blank spacer row 4
  sheet.getRow(4).height = 8;

  // Row 5: Table Header
  const headerValues: (string | number)[] = [
    'No',
    'Nama Anggota',
    ...recap.period.dates.map((d) => d.day),
    'H',
    'B',
    'I',
    'S',
    'A',
    'L',
    'Total',
  ];

  const headerRow = sheet.getRow(5);
  headerRow.values = headerValues;
  headerRow.height = 24;

  for (let c = 1; c <= totalCols; c++) {
    const cell = headerRow.getCell(c);
    const isSummaryCol = c > 2 + dateCount;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isSummaryCol ? 'FF15437A' : 'FF0B2B52' },
    };
    cell.alignment = {
      horizontal: c === 2 ? 'left' : 'center',
      vertical: 'middle',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  }

  // Data rows
  let maxNameLength = 'Nama Anggota'.length;
  recap.rows.forEach((member, idx) => {
    const rowIdx = 6 + idx;
    maxNameLength = Math.max(maxNameLength, member.nama.length + (member.statusAktif ? 0 : 11));
    const displayName = member.statusAktif ? member.nama : `${member.nama} (Nonaktif)`;

    const rowValues: (string | number)[] = [
      idx + 1,
      displayName,
      ...recap.period.dates.map((d) => member.daily[d.date]?.code || '-'),
      member.totalH,
      member.totalB,
      member.totalI,
      member.totalS,
      member.totalA,
      member.totalL,
      member.totalKehadiran,
    ];

    const row = sheet.getRow(rowIdx);
    row.values = rowValues;
    row.height = 20;

    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      if (c === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
      } else if (c === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      } else if (c <= 2 + dateCount) {
        const code = String(cell.value || '-');
        const colors = getCodeExcelColors(code);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = {
          name: 'Calibri',
          size: 9,
          bold: code !== '-',
          color: { argb: colors.font },
        };
        if (code !== '-') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colors.fill },
          };
        }
      } else if (c === totalCols) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0B2B52' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0F2FE' },
        };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      }
    }
  });

  // Totals Footer Row
  const totalRowIdx = 6 + recap.rows.length;
  const totalRow = sheet.getRow(totalRowIdx);
  const totalValues: (string | number)[] = [
    '',
    'TOTAL KESELURUHAN',
    ...recap.period.dates.map(() => ''),
    recap.summary.totalH,
    recap.summary.totalB,
    recap.summary.totalI,
    recap.summary.totalS,
    recap.summary.totalA,
    recap.summary.totalL,
    recap.summary.totalKehadiran,
  ];
  totalRow.values = totalValues;
  totalRow.height = 22;
  sheet.mergeCells(totalRowIdx, 1, totalRowIdx, 2 + dateCount);

  for (let c = 1; c <= totalCols; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = {
      horizontal: c <= 2 + dateCount ? 'right' : 'center',
      vertical: 'middle',
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF64748B' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF64748B' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  }

  // Legend row
  const legendRowIdx = totalRowIdx + 2;
  sheet.mergeCells(legendRowIdx, 1, legendRowIdx, totalCols);
  const legendCell = sheet.getCell(legendRowIdx, 1);
  legendCell.value =
    'Keterangan: H = Hadir (1) | B = Badal (1) | H+B = Hadir + Badal (2) | I = Izin (0) | S = Sakit (0) | A = Alpa (0) | L = Libur (0) | Total Kehadiran = H + B';
  legendCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };

  // Signature block
  const sigStart = legendRowIdx + 2;
  const leftStartCol = 2;
  const leftEndCol = Math.min(8, Math.floor(totalCols / 2));
  const rightStartCol = Math.max(leftEndCol + 2, totalCols - 7);
  const rightEndCol = totalCols;

  sheet.mergeCells(sigStart, leftStartCol, sigStart, leftEndCol);
  sheet.getCell(sigStart, leftStartCol).value = 'Mengetahui,';
  sheet.getCell(sigStart, leftStartCol).alignment = { horizontal: 'center' };
  sheet.getCell(sigStart, leftStartCol).font = { name: 'Calibri', size: 10 };

  sheet.mergeCells(sigStart, rightStartCol, sigStart, rightEndCol);
  sheet.getCell(sigStart, rightStartCol).value = `Dibuat pada ${printDate}`;
  sheet.getCell(sigStart, rightStartCol).alignment = { horizontal: 'center' };
  sheet.getCell(sigStart, rightStartCol).font = { name: 'Calibri', size: 10 };

  sheet.mergeCells(sigStart + 1, leftStartCol, sigStart + 1, leftEndCol);
  sheet.getCell(sigStart + 1, leftStartCol).value = pengaturan.jabatanPimpinan;
  sheet.getCell(sigStart + 1, leftStartCol).alignment = { horizontal: 'center' };
  sheet.getCell(sigStart + 1, leftStartCol).font = { name: 'Calibri', size: 10, bold: true };

  sheet.mergeCells(sigStart + 1, rightStartCol, sigStart + 1, rightEndCol);
  sheet.getCell(sigStart + 1, rightStartCol).value = pengaturan.jabatanPetugas;
  sheet.getCell(sigStart + 1, rightStartCol).alignment = { horizontal: 'center' };
  sheet.getCell(sigStart + 1, rightStartCol).font = { name: 'Calibri', size: 10, bold: true };

  const nameRow = sigStart + 5;
  sheet.mergeCells(nameRow, leftStartCol, nameRow, leftEndCol);
  sheet.getCell(nameRow, leftStartCol).value = `( ${pengaturan.namaPimpinan} )`;
  sheet.getCell(nameRow, leftStartCol).alignment = { horizontal: 'center' };
  sheet.getCell(nameRow, leftStartCol).font = { name: 'Calibri', size: 10, bold: true, underline: true };

  sheet.mergeCells(nameRow, rightStartCol, nameRow, rightEndCol);
  sheet.getCell(nameRow, rightStartCol).value = `( ${pengaturan.namaPetugas} )`;
  sheet.getCell(nameRow, rightStartCol).alignment = { horizontal: 'center' };
  sheet.getCell(nameRow, rightStartCol).font = { name: 'Calibri', size: 10, bold: true, underline: true };

  // Set column widths
  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = Math.max(20, Math.min(34, maxNameLength + 4));
  for (let i = 0; i < dateCount; i++) {
    sheet.getColumn(3 + i).width = 5.4;
  }
  for (let s = 0; s < 6; s++) {
    sheet.getColumn(3 + dateCount + s).width = 5.2;
  }
  sheet.getColumn(totalCols).width = 7.5;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Rekap_Absensi_Security_AlMuhajirin_${recap.period.periodKey}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRecapToPdf(
  recap: RecapResponse,
  pengaturan: PengaturanData,
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const printDate = formatTanggalIndo(getTodayJakartaDate());

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(11, 43, 82);
  doc.text('REKAP ABSENSI SECURITY AL-MUHAJIRIN', pageWidth / 2, 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`${pengaturan.namaInstansi} — ${pengaturan.namaUnit}`, pageWidth / 2, 18.5, {
    align: 'center',
  });

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Periode: ${recap.period.label}   |   Tanggal Cetak: ${printDate}`,
    pageWidth / 2,
    23.5,
    { align: 'center' },
  );

  // Build table columns & body
  const headRow = [
    'No',
    'Nama Anggota',
    ...recap.period.dates.map((d) => String(d.day)),
    'H',
    'B',
    'I',
    'S',
    'A',
    'L',
    'Total',
  ];

  const bodyRows = recap.rows.map((member, idx) => [
    String(idx + 1),
    member.statusAktif ? member.nama : `${member.nama} (Nonaktif)`,
    ...recap.period.dates.map((d) => member.daily[d.date]?.code || '-'),
    String(member.totalH),
    String(member.totalB),
    String(member.totalI),
    String(member.totalS),
    String(member.totalA),
    String(member.totalL),
    String(member.totalKehadiran),
  ]);

  // Footer total row
  const dateCount = recap.period.dates.length;
  const totalColCount = 2 + dateCount + 7;

  const columnStyles: Record<number, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }> = {
    0: { cellWidth: 6.5, halign: 'center' },
    1: { cellWidth: 32, halign: 'left' },
  };

  // Remaining width: 297 - 16 (margins) - 6.5 - 32 = 242.5mm for (dateCount + 7) columns
  const remainingCols = dateCount + 7;
  const colW = Number((242.5 / remainingCols).toFixed(2));
  for (let i = 2; i < totalColCount - 1; i++) {
    columnStyles[i] = { cellWidth: colW, halign: 'center' };
  }
  columnStyles[totalColCount - 1] = { cellWidth: Math.max(colW + 1.5, 9), halign: 'center' };

  autoTable(doc, {
    startY: 27,
    margin: { left: 8, right: 8, bottom: 16 },
    head: [headRow],
    body: [
      ...bodyRows,
      [
        {
          content: 'TOTAL KESELURUHAN',
          colSpan: 2 + dateCount,
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] },
        },
        { content: String(recap.summary.totalH), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: String(recap.summary.totalB), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: String(recap.summary.totalI), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: String(recap.summary.totalS), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: String(recap.summary.totalA), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: String(recap.summary.totalL), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: String(recap.summary.totalKehadiran), styles: { halign: 'center', fontStyle: 'bold', fillColor: [219, 234, 254], textColor: [11, 43, 82] } },
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.4,
      cellPadding: { top: 1.5, bottom: 1.5, left: 0.6, right: 0.6 },
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [11, 43, 82],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'center',
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index < bodyRows.length) {
        const colIdx = data.column.index;
        if (colIdx >= 2 && colIdx < 2 + dateCount) {
          const code = String(data.cell.raw || '-');
          const colors = getCodePdfColors(code);
          if (colors) {
            data.cell.styles.fillColor = colors.fill;
            data.cell.styles.textColor = colors.text;
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [148, 163, 184];
          }
        } else if (colIdx === totalColCount - 1) {
          data.cell.styles.fillColor = [224, 242, 254];
          data.cell.styles.textColor = [11, 43, 82];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = ((doc as any).lastAutoTable?.finalY as number | undefined) ?? 130;
  const pageHeight = doc.internal.pageSize.getHeight();
  let cursorY = finalY + 5;

  if (cursorY + 38 > pageHeight) {
    doc.addPage();
    cursorY = 16;
  }

  // Legend
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Keterangan: H = Hadir (1) | B = Badal (1) | H+B = Hadir + Badal (2) | I = Izin | S = Sakit | A = Alpa | L = Libur | Rumus Total = H + B',
    8,
    cursorY,
  );

  // Signatures
  const sigY = cursorY + 8;
  const leftCenterX = 62;
  const rightCenterX = pageWidth - 62;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Mengetahui,', leftCenterX, sigY, { align: 'center' });
  doc.text(`Dibuat pada ${printDate}`, rightCenterX, sigY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text(pengaturan.jabatanPimpinan, leftCenterX, sigY + 4.5, { align: 'center' });
  doc.text(pengaturan.jabatanPetugas, rightCenterX, sigY + 4.5, { align: 'center' });

  doc.text(`( ${pengaturan.namaPimpinan} )`, leftCenterX, sigY + 22, { align: 'center' });
  doc.text(`( ${pengaturan.namaPetugas} )`, rightCenterX, sigY + 22, { align: 'center' });

  doc.save(`Rekap_Absensi_Security_AlMuhajirin_${recap.period.periodKey}.pdf`);
}
