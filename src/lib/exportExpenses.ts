/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MyExpensesResult } from './myExpenses';
import { BalanceRow } from './owedBalances';
import { formatCurrency } from './utils';

type CellValue = string | number | null;

const textEncoder = new TextEncoder();

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function colName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function worksheetXml(rows: CellValue[][]): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          if (value === null || value === undefined) return '';
          const ref = `${colName(colIndex)}${rowIndex + 1}`;
          if (typeof value === 'number') {
            return `<c r="${ref}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${body}</sheetData>
</worksheet>`;
}

function workbookXml(sheetNames: string[]): string {
  const sheets = sheetNames
    .map(
      (name, index) =>
        `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets}</sheets>
</workbook>`;
}

function workbookRelsXml(sheetNames: string[]): string {
  const rels = sheetNames
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function contentTypesXml(sheetCount: number): string {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets}
</Types>`;
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function createZip(files: { name: string; content: string }[]): Uint8Array {
  const out: number[] = [];
  const central: number[] = [];
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  files.forEach((file) => {
    const nameBytes = textEncoder.encode(file.name);
    const contentBytes = textEncoder.encode(file.content);
    const checksum = crc32(contentBytes);
    const localOffset = out.length;

    writeUint32(out, 0x04034b50);
    writeUint16(out, 20);
    writeUint16(out, 0);
    writeUint16(out, 0);
    writeUint16(out, dosTime);
    writeUint16(out, dosDate);
    writeUint32(out, checksum);
    writeUint32(out, contentBytes.length);
    writeUint32(out, contentBytes.length);
    writeUint16(out, nameBytes.length);
    writeUint16(out, 0);
    out.push(...nameBytes, ...contentBytes);

    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, dosTime);
    writeUint16(central, dosDate);
    writeUint32(central, checksum);
    writeUint32(central, contentBytes.length);
    writeUint32(central, contentBytes.length);
    writeUint16(central, nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, localOffset);
    central.push(...nameBytes);
  });

  const centralOffset = out.length;
  out.push(...central);
  writeUint32(out, 0x06054b50);
  writeUint16(out, 0);
  writeUint16(out, 0);
  writeUint16(out, files.length);
  writeUint16(out, files.length);
  writeUint32(out, central.length);
  writeUint32(out, centralOffset);
  writeUint16(out, 0);

  return new Uint8Array(out);
}

function safeFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'expenses';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function expenseWorkbookRows(result: MyExpensesResult, title: string) {
  const summaryRows: CellValue[][] = [
    ['BillSplit Expenses Export'],
    ['Scope', title],
    ['Total spending', result.grandTotal],
    ['Receipt count', result.receiptCount],
    ['Currency', result.currency],
    [],
    ['Category', 'Amount'],
    ...result.byCategory.map((c) => [c.category, roundMoney(c.amount)]),
  ];

  const monthRows: CellValue[][] = [
    ['Month', 'Amount'],
    ...result.byMonth.map((m) => [m.monthLabel, roundMoney(m.amount)]),
  ];

  const receiptRows: CellValue[][] = [
    ['Date', 'Merchant', 'Month', 'Total', 'Currency', 'Category breakdown'],
    ...result.entries.map((entry) => [
      entry.date,
      entry.merchantName,
      entry.monthLabel,
      roundMoney(entry.total),
      entry.currency,
      entry.categoryBreakdown
        .map((c) => `${c.category}: ${formatCurrency(c.amount, entry.currency)}`)
        .join('; '),
    ]),
  ];

  const categoryRows: CellValue[][] = [
    ['Receipt date', 'Merchant', 'Category', 'Amount', 'Currency'],
    ...result.entries.flatMap((entry) =>
      entry.categoryBreakdown.map((c) => [
        entry.date,
        entry.merchantName,
        c.category,
        roundMoney(c.amount),
        entry.currency,
      ])
    ),
  ];

  return { summaryRows, monthRows, receiptRows, categoryRows };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function exportExpensesXlsx(result: MyExpensesResult, title: string) {
  const { summaryRows, monthRows, receiptRows, categoryRows } = expenseWorkbookRows(result, title);
  const sheetNames = ['Summary', 'Receipts', 'Categories', 'Months'];
  const zip = createZip([
    { name: '[Content_Types].xml', content: contentTypesXml(sheetNames.length) },
    { name: '_rels/.rels', content: rootRelsXml() },
    { name: 'xl/workbook.xml', content: workbookXml(sheetNames) },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(sheetNames) },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(summaryRows) },
    { name: 'xl/worksheets/sheet2.xml', content: worksheetXml(receiptRows) },
    { name: 'xl/worksheets/sheet3.xml', content: worksheetXml(categoryRows) },
    { name: 'xl/worksheets/sheet4.xml', content: worksheetXml(monthRows) },
  ]);
  downloadBlob(
    new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `billsplit-${safeFilePart(title)}.xlsx`
  );
}

function wrapLine(value: string, maxLength = 92): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function pdfObjectsFromPages(pageContents: string[]): string {
  const objects: string[] = [];
  const pageObjectIds = pageContents.map((_, index) => 5 + index * 2);
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageContents.length} >>`;
  objects[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  pageContents.forEach((content, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${textEncoder.encode(content).length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = textEncoder.encode(pdf).length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = textEncoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

const PDF = {
  width: 612,
  height: 792,
  margin: 46,
  contentWidth: 520,
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function colorCommand(hex: string, mode: 'rg' | 'RG') {
  const [r, g, b] = hexToRgb(hex);
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${mode}`;
}

class PdfReport {
  private pages: string[] = [];
  private content = '';
  private y = 0;
  private pageNumber = 0;

  constructor(
    private title: string,
    private subtitle: string,
    private cards: { label: string; value: string }[]
  ) {
    this.startPage(true);
  }

  finish() {
    if (this.content) this.pages.push(this.content);
    return pdfObjectsFromPages(this.pages);
  }

  section(title: string) {
    this.ensure(38);
    this.y -= 10;
    this.text(title.toUpperCase(), PDF.margin, this.y, 10, '#475569', true);
    this.line(PDF.margin, this.y - 8, PDF.width - PDF.margin, this.y - 8, '#E2E8F0');
    this.y -= 26;
  }

  summaryTable(rows: { label: string; value: string; color?: string }[]) {
    rows.forEach((row, index) => {
      this.ensure(28);
      const bg = index % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
      this.rect(PDF.margin, this.y - 20, PDF.contentWidth, 26, bg);
      this.text(row.label, PDF.margin + 12, this.y - 11, 9, '#64748B', true);
      this.text(row.value, PDF.width - PDF.margin - 12, this.y - 11, 9, row.color || '#0F172A', true, 'right');
      this.y -= 26;
    });
    this.y -= 8;
  }

  receiptCard(options: {
    title: string;
    meta: string;
    total: string;
    lines: { label: string; value: string; muted?: string }[];
  }) {
    const wrappedTitle = wrapLine(options.title, 44);
    const lineCount = options.lines.reduce((sum, line) => sum + Math.max(1, wrapLine(line.label, 54).length), 0);
    const height = 62 + wrappedTitle.length * 11 + lineCount * 18;
    this.ensure(Math.min(height, 260));

    this.rect(PDF.margin, this.y - height + 8, PDF.contentWidth, height, '#FFFFFF', '#E2E8F0');
    this.rect(PDF.margin, this.y - 22, PDF.contentWidth, 30, '#F8FAFC');

    wrappedTitle.slice(0, 2).forEach((line, index) => {
      this.text(line, PDF.margin + 14, this.y - 8 - index * 12, 11, '#0F172A', true);
    });
    this.text(options.total, PDF.width - PDF.margin - 14, this.y - 8, 11, '#4F46E5', true, 'right');
    this.text(options.meta, PDF.margin + 14, this.y - 29, 8, '#64748B');

    this.y -= 50 + wrappedTitle.length * 8;
    options.lines.forEach((line) => {
      const labelLines = wrapLine(line.label, 54);
      labelLines.forEach((label, index) => {
        this.ensure(22);
        this.text(index === 0 ? label : `  ${label}`, PDF.margin + 18, this.y, 8.5, line.muted ? '#64748B' : '#334155');
        if (index === 0) {
          this.text(line.value, PDF.width - PDF.margin - 16, this.y, 8.5, '#0F172A', true, 'right');
        }
        this.y -= 16;
      });
      if (line.muted) {
        this.text(line.muted, PDF.margin + 18, this.y + 3, 7, '#94A3B8');
      }
    });
    this.y -= 18;
  }

  private startPage(includeCards: boolean) {
    this.pageNumber += 1;
    this.content = '';
    this.rect(0, 0, PDF.width, PDF.height, '#F8FAFC');
    this.rect(0, 690, PDF.width, 102, '#4F46E5');
    this.rect(0, 680, PDF.width, 12, '#4338CA');
    this.text('BillSplit', PDF.margin, 756, 10, '#C7D2FE', true);
    this.text(this.title, PDF.margin, 733, 22, '#FFFFFF', true);
    this.text(this.subtitle, PDF.margin, 711, 10, '#E0E7FF');
    this.text(`Page ${this.pageNumber}`, PDF.width - PDF.margin, 756, 8, '#C7D2FE', false, 'right');

    if (includeCards) {
      const cardWidth = (PDF.contentWidth - 20) / Math.min(3, Math.max(1, this.cards.length));
      this.cards.slice(0, 3).forEach((card, index) => {
        const x = PDF.margin + index * (cardWidth + 10);
        this.rect(x, 610, cardWidth, 54, '#FFFFFF');
        this.text(card.label.toUpperCase(), x + 12, 646, 7.5, '#64748B', true);
        this.text(card.value, x + 12, 626, 15, '#0F172A', true);
      });
      this.y = 574;
    } else {
      this.y = 656;
    }
  }

  private ensure(height: number) {
    if (this.y - height < 48) {
      if (this.content) this.pages.push(this.content);
      this.startPage(false);
    }
  }

  private text(
    value: string,
    x: number,
    y: number,
    size: number,
    color: string,
    bold = false,
    align: 'left' | 'right' = 'left'
  ) {
    const safe = escapePdfText(value);
    const tx = align === 'right' ? x - value.length * size * 0.48 : x;
    this.content += `${colorCommand(color, 'rg')} BT /${bold ? 'F2' : 'F1'} ${size} Tf ${tx.toFixed(1)} ${y.toFixed(1)} Td (${safe}) Tj ET\n`;
  }

  private rect(x: number, y: number, width: number, height: number, fill: string, stroke?: string) {
    this.content += `${colorCommand(fill, 'rg')} ${x} ${y} ${width} ${height} re f\n`;
    if (stroke) {
      this.content += `${colorCommand(stroke, 'RG')} ${x} ${y} ${width} ${height} re S\n`;
    }
  }

  private line(x1: number, y1: number, x2: number, y2: number, color: string) {
    this.content += `${colorCommand(color, 'RG')} 0.7 w ${x1} ${y1} m ${x2} ${y2} l S\n`;
  }
}

export function exportExpensesPdf(result: MyExpensesResult, title: string) {
  const report = new PdfReport('Expenses Report', title, [
    { label: 'Total Spending', value: formatCurrency(result.grandTotal, result.currency) },
    { label: 'Receipts', value: String(result.receiptCount) },
    { label: 'Currency', value: result.currency },
  ]);

  report.section('Category Summary');
  report.summaryTable(
    result.byCategory.map((c) => ({
      label: c.category,
      value: formatCurrency(c.amount, result.currency),
      color: '#4F46E5',
    }))
  );

  if (result.byMonth.length > 0) {
    report.section('Monthly Summary');
    report.summaryTable(
      result.byMonth.map((m) => ({
        label: m.monthLabel,
        value: formatCurrency(m.amount, result.currency),
      }))
    );
  }

  report.section('Receipts');
  result.entries.forEach((entry) => {
    report.receiptCard({
      title: entry.merchantName,
      meta: `${entry.date} / ${entry.monthLabel}`,
      total: formatCurrency(entry.total, entry.currency),
      lines: [
        ...entry.items.map((item) => ({
          label: item.name,
          value: formatCurrency(item.sharePrice, entry.currency),
          muted:
            Math.abs(item.fullPrice - item.sharePrice) > 0.01
              ? `Full item: ${formatCurrency(item.fullPrice, entry.currency)}`
              : undefined,
        })),
        ...entry.categoryBreakdown
          .filter((c) => c.category === 'Tax & Fees')
          .map((c) => ({
            label: c.category,
            value: formatCurrency(c.amount, entry.currency),
          })),
      ],
    });
  });

  const pdf = report.finish();
  downloadBlob(
    new Blob([pdf], { type: 'application/pdf' }),
    `billsplit-${safeFilePart(title)}.pdf`
  );
}

function balanceWorkbookRows(balance: BalanceRow) {
  const summaryRows: CellValue[][] = [
    ['BillSplit Individual Total'],
    ['Person', balance.displayName],
    ['Total', roundMoney(balance.total)],
    ['Receipt count', balance.receiptDetails.length],
    ['Currency', balance.currency],
  ];

  const receiptRows: CellValue[][] = [
    ['Date', 'Merchant', 'Total', 'Currency', 'Shared fees and tax'],
    ...balance.receiptDetails.map((detail) => [
      detail.date,
      detail.merchantName,
      roundMoney(detail.totalForReceipt),
      detail.currency,
      roundMoney(detail.sharedFees),
    ]),
  ];

  const itemRows: CellValue[][] = [
    ['Date', 'Merchant', 'Item', 'Share amount', 'Currency'],
    ...balance.receiptDetails.flatMap((detail) => [
      ...detail.items.map((item) => [
        detail.date,
        detail.merchantName,
        item.name,
        roundMoney(item.sharePrice),
        detail.currency,
      ]),
      ...(detail.sharedFees > 0
        ? [[detail.date, detail.merchantName, 'Shared fees and tax', roundMoney(detail.sharedFees), detail.currency]]
        : []),
    ]),
  ];

  return { summaryRows, receiptRows, itemRows };
}

export function exportBalanceXlsx(balance: BalanceRow) {
  const { summaryRows, receiptRows, itemRows } = balanceWorkbookRows(balance);
  const sheetNames = ['Summary', 'Receipts', 'Items'];
  const zip = createZip([
    { name: '[Content_Types].xml', content: contentTypesXml(sheetNames.length) },
    { name: '_rels/.rels', content: rootRelsXml() },
    { name: 'xl/workbook.xml', content: workbookXml(sheetNames) },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(sheetNames) },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(summaryRows) },
    { name: 'xl/worksheets/sheet2.xml', content: worksheetXml(receiptRows) },
    { name: 'xl/worksheets/sheet3.xml', content: worksheetXml(itemRows) },
  ]);
  downloadBlob(
    new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `billsplit-${safeFilePart(balance.displayName)}-total.xlsx`
  );
}

export function exportBalancePdf(balance: BalanceRow) {
  const report = new PdfReport('Individual Total', balance.displayName, [
    { label: 'Total', value: formatCurrency(balance.total, balance.currency) },
    { label: 'Receipts', value: String(balance.receiptDetails.length) },
    { label: 'Currency', value: balance.currency },
  ]);

  report.section('Receipt Details');
  balance.receiptDetails.forEach((detail) => {
    report.receiptCard({
      title: detail.merchantName,
      meta: detail.date,
      total: formatCurrency(detail.totalForReceipt, detail.currency),
      lines: [
        ...detail.items.map((item) => ({
          label: item.name,
          value: formatCurrency(item.sharePrice, detail.currency),
        })),
        ...(detail.sharedFees > 0
          ? [
              {
                label: 'Shared fees and tax',
                value: formatCurrency(detail.sharedFees, detail.currency),
              },
            ]
          : []),
      ],
    });
  });

  const pdf = report.finish();
  downloadBlob(
    new Blob([pdf], { type: 'application/pdf' }),
    `billsplit-${safeFilePart(balance.displayName)}-total.pdf`
  );
}
