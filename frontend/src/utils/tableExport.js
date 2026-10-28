/*
 * Download a table (rows of cells) as CSV or as an Excel (.xlsx) workbook, without a library.
 * A cell is a string, a number, or empty. Strings that Excel could run as a formula (they start with
 * = + - @) are saved as text, so a note typed into the system cannot execute when the file is opened.
 * Numbers are written as numbers, so a negative quantity stays a number.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
const guard = value => (FORMULA_START.test(value) ? `'${value}` : value);

export function toCsv(rows) {
  const cell = value => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    const text = guard(String(value));
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  // The byte-order mark makes Excel read the file as UTF-8, so names with accents show correctly.
  return new Blob([`﻿${rows.map(row => row.map(cell).join(',')).join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
}

// ---------- .xlsx: a ZIP of a few XML files, stored without compression ----------

const encoder = new TextEncoder();
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
export const crc32 = bytes => {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

export function zip(files, now = new Date()) {
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((Math.max(now.getFullYear(), 1980) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [];
  const central = [];
  let offset = 0;
  const push = (list, bytes) => { list.push(bytes); return bytes.length; };
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034B50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, time, true); local.setUint16(12, date, true); local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true); local.setUint32(22, file.data.length, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014B50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x0800, true); entry.setUint16(10, 0, true);
    entry.setUint16(12, time, true); entry.setUint16(14, date, true); entry.setUint32(16, crc, true);
    entry.setUint32(20, file.data.length, true); entry.setUint32(24, file.data.length, true); entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    offset += push(parts, new Uint8Array(local.buffer)) + push(parts, name) + push(parts, file.data);
    push(central, new Uint8Array(entry.buffer)); push(central, name);
  }
  const centralSize = central.reduce((sum, bytes) => sum + bytes.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054B50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((sum, bytes) => sum + bytes.length, 0));
  let at = 0;
  for (const bytes of all) { out.set(bytes, at); at += bytes.length; }
  return out;
}

const escapeXml = value => String(value)
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const columnName = index => {
  let name = ''; let n = index + 1;
  while (n > 0) { name = String.fromCharCode(65 + ((n - 1) % 26)) + name; n = Math.floor((n - 1) / 26); }
  return name;
};
const sheetTitle = value => (String(value).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet1');

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export function xlsxFiles(rows, sheetName = 'Sheet1') {
  const widths = [];
  rows.forEach(row => row.forEach((value, column) => {
    widths[column] = Math.min(60, Math.max(widths[column] || 8, String(value ?? '').length + 2));
  }));
  const sheetRows = rows.map((row, r) => {
    const cells = row.map((value, c) => {
      if (value === null || value === undefined || value === '') return '';
      const ref = `${columnName(c)}${r + 1}`;
      const style = r === 0 ? ' s="1"' : '';
      if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"${style}><v>${value}</v></c>` : '';
      const text = escapeXml(guard(String(value)));
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');
  const cols = widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('');
  const text = value => encoder.encode(value);
  return [
    { name: '[Content_Types].xml', data: text(`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: '_rels/.rels', data: text(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: 'xl/workbook.xml', data: text(`${XML}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="${escapeXml(sheetTitle(sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: text(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`) },
    { name: 'xl/styles.xml', data: text(`${XML}<styleSheet xmlns="${MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`) },
    { name: 'xl/worksheets/sheet1.xml', data: text(`${XML}<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${sheetRows}</sheetData></worksheet>`) },
  ];
}

// The first row is the header: bold, and frozen so it stays in view while scrolling.
export const toXlsx = (rows, sheetName) => new Blob([zip(xlsxFiles(rows, sheetName))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
