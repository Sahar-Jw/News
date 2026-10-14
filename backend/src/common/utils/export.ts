import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';

export interface ExportColumn {
  key: string;
  label: string;
  value: (row: any) => any;
}

export function pickColumns(all: ExportColumn[], requested: string | undefined): ExportColumn[] {
  const keys = (requested ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!keys.length) throw new BadRequestException('يجب اختيار عمود واحد على الأقل للتصدير');
  const picked = keys.map((k) => all.find((c) => c.key === k));
  if (picked.some((c) => !c)) throw new BadRequestException('عمود غير مدعوم في التصدير');
  return picked as ExportColumn[];
}

function cell(v: any): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.join('، ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Neutralise spreadsheet formula injection. */
function safe(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

export async function sendExport(
  res: Response,
  format: string | undefined,
  baseName: string,
  columns: ExportColumn[],
  rows: any[],
  rtl = true,
) {
  const table = rows.map((r) => columns.map((c) => safe(cell(c.value(r)))));
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(baseName.slice(0, 30), { views: [{ rightToLeft: rtl }] });
    ws.addRow(columns.map((c) => c.label)).font = { bold: true };
    table.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col) => (col.width = 22));
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}-${stamp}.xlsx"`);
    return res.send(buf);
  }
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [columns.map((c) => esc(c.label)), ...table.map((r) => r.map(esc))].map((r) => r.join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}-${stamp}.csv"`);
  return res.send(csv);
}
