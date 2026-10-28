import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crc32, toCsv, xlsxFiles, zip } from './tableExport.js';

// ignoreBOM keeps the byte-order mark in the text, so the test can see it.
const text = async blob => new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blob.arrayBuffer());

test('csv: quotes what needs quoting, keeps numbers as numbers, and guards formulas', async () => {
  const csv = await text(toCsv([
    ['Date', 'Movement', 'Quantity Change', 'Reason'],
    ['2026-10-15 09:24 AM', 'Restock', 50, 'Supplier Delivery, #SD-1'],
    ['2026-10-16', 'Adjustment', -10, 'He said "damaged"\nand wet'],
    ['2026-10-17', 'Dispensed', 0, '=HYPERLINK("http://evil")'],
    ['2026-10-18', '+cmd', null, '@SUM(1)'],
  ]));
  assert.ok(csv.startsWith('﻿Date,Movement,Quantity Change,Reason\r\n'), 'byte-order mark and header');
  assert.match(csv, /,Restock,50,"Supplier Delivery, #SD-1"\r\n/);
  assert.match(csv, /,Adjustment,-10,"He said ""damaged""\nand wet"\r\n/, 'a negative number is not treated as a formula');
  assert.match(csv, /,0,"'=HYPERLINK\(""http:\/\/evil""\)"\r\n/, 'a formula typed as a note is saved as text');
  assert.match(csv, /,'\+cmd,,'@SUM\(1\)\r\n/);
  assert.ok(csv.endsWith('\r\n'));
});

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('xlsx: a valid zip with the workbook parts, a bold frozen header, and escaped text', () => {
  const files = xlsxFiles([
    ['Date & Time', 'Quantity Change', 'Note'],
    ['2026-10-15', -30, 'Tom & "Jerry" <b>'],
    ['2026-10-16', 50, '  spaced  '],
  ], 'Stock History: Paracetamol/500 mg [x]');
  assert.deepEqual(files.map(file => file.name), ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']);
  const byName = Object.fromEntries(files.map(file => [file.name, new TextDecoder().decode(file.data)]));
  const sheet = byName['xl/worksheets/sheet1.xml'];
  assert.match(sheet, /<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Date &amp; Time<\/t><\/is><\/c>/);
  assert.match(sheet, /<c r="B2"><v>-30<\/v><\/c>/, 'numbers are numbers');
  assert.match(sheet, /Tom &amp; &quot;Jerry&quot; &lt;b&gt;/);
  assert.match(sheet, /<t xml:space="preserve">  spaced  <\/t>/);
  assert.match(sheet, /<pane ySplit="1"/);
  // Sheet names cannot hold \ / ? * [ ] : and stop at 31 characters.
  const sheetName = byName['xl/workbook.xml'].match(/<sheet name="([^"]*)"/)[1];
  assert.ok(sheetName.length <= 31 && !/[\\/?*[\]:]/.test(sheetName), sheetName);

  // The zip itself: signatures, entry count and every CRC.
  const bytes = zip(files, new Date(2026, 9, 28, 10, 30, 0));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034B50, 'starts with a local file header');
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054B50, 'ends with the end-of-archive record');
  assert.equal(view.getUint16(end + 10, true), files.length, 'entry count');
  let at = view.getUint32(end + 16, true); // start of the central directory
  for (const file of files) {
    assert.equal(view.getUint32(at, true), 0x02014B50);
    assert.equal(view.getUint32(at + 16, true), crc32(file.data), `crc of ${file.name}`);
    assert.equal(view.getUint32(at + 24, true), file.data.length);
    const local = view.getUint32(at + 42, true);
    assert.equal(view.getUint32(local, true), 0x04034B50);
    assert.deepEqual(bytes.slice(local + 30 + view.getUint16(local + 26, true), local + 30 + view.getUint16(local + 26, true) + file.data.length), file.data, `data of ${file.name}`);
    at += 46 + view.getUint16(at + 28, true);
  }
});
