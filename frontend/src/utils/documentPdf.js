/*
 * Helpers for the in-app document viewer (components/DocumentViewerModal.jsx), working on a
 * printable clinic document (public/templates/print/) that is already laid out in a frame.
 *
 * paginate():        splits the document's single .page box into paper-sized sheets.
 * saveDocumentPdf(): redraws those sheets as a PDF with real (selectable, sharp) text.
 *
 * The PDF is drawn from the browser's own layout: every word, border and image is copied at
 * the position it has on the sheet, so the file matches the preview. It covers what the
 * templates use: text, borders, plain background colors, the ruled lines of `.block .value`
 * and images. Anything else (list numbers, background pictures) is not drawn.
 */

// Sheets are measured in CSS pixels (96 per inch); a PDF counts in points (72 per inch).
const PT = 72 / 96;

/*
 * A document comes as one .page box that grows with its content. When it is taller than the
 * paper, its last parts move whole (never cut through) to a new sheet after it, like the
 * print's own `break-inside: avoid`. Returns every sheet, in order.
 */
export const paginate = (doc) => {
  const first = doc.querySelector('.page');
  if (!first) return [];
  const pages = [first];
  // The sheet's height on screen is its CSS min-height (the paper height).
  const limit = parseFloat(doc.defaultView.getComputedStyle(first).minHeight) || 0;
  if (!limit) return pages;
  let current = first;
  while (current.offsetHeight > limit + 1 && current.children.length > 1) {
    const next = current.cloneNode(false);
    current.after(next);
    while (current.offsetHeight > limit + 1 && current.children.length > 1) next.prepend(current.lastElementChild);
    pages.push(next);
    current = next;
  }
  return pages;
};

// The PDF's built-in Helvetica (same letter widths as the form's Arial) only has the Windows-1252 letters.
const CP1252 = new Set([8364, 8218, 402, 8222, 8230, 8224, 8225, 710, 8240, 352, 8249, 338, 381, 8216, 8217, 8220, 8221, 8226, 8211, 8212, 732, 8482, 353, 8250, 339, 382, 376]);
const inHelvetica = (char) => char.codePointAt(0) <= 255 || CP1252.has(char.codePointAt(0));
// Signs common in clinical notes that Helvetica lacks, as their codes in the PDF's built-in Symbol font.
const SYMBOLS = { '≤': '\xA3', '≥': '\xB3', '≠': '\xB9', '≈': '\xBB', '→': '\xAE', '←': '\xAC', '↑': '\xAD', '↓': '\xAF', '∞': '\xA5', 'α': 'a', 'β': 'b', 'Δ': 'D', 'μ': 'm' };
// Anything else outside Helvetica: a plain look-alike, or "?".
const SUBSTITUTES = { '−': '-', '₱': 'P', '✓': '/', '✔': '/' };
const pdfText = (text) => Array.from(text, (char) => (inHelvetica(char) ? char : SUBSTITUTES[char] ?? '?')).join('');

// "rgb(0, 0, 0)" → [0, 0, 0]; null when fully transparent.
const rgb = (value) => {
  const parts = /rgba?\(([^)]+)\)/.exec(value || '')?.[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (!parts || parts.length < 3 || parts[3] === 0) return null;
  return parts.slice(0, 3);
};

// An image of the document as PDF data. Photos (JPEG) stay JPEG; logos keep their transparency as PNG.
const imageData = (img) => {
  if (!img.complete || !img.naturalWidth) return null;
  const scale = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const context = canvas.getContext('2d');
  const jpeg = /\.jpe?g(\?|#|$)/i.test(img.currentSrc || img.src);
  if (jpeg) { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.92), format: jpeg ? 'JPEG' : 'PNG' };
};

/*
 * Where each word of a text node sits: [{ text, left, right, top, height }]. A word that the
 * browser broke over two lines is measured letter by letter and returned as one part per line,
 * and a letter that Helvetica lacks is returned on its own, to be drawn in its own place.
 */
const wordBoxes = (node, range) => {
  const boxes = [];
  const measure = (start, end) => {
    range.setStart(node, start);
    range.setEnd(node, end);
    return [...range.getClientRects()].filter((rect) => rect.width > 0);
  };
  const box = (text, rect) => ({ text, left: rect.left, right: rect.right, top: rect.top, height: rect.height });
  for (const match of node.data.matchAll(/\S+/g)) {
    const chars = Array.from(match[0]);
    const rects = measure(match.index, match.index + match[0].length);
    if (rects.length === 1 && chars.every(inHelvetica)) { boxes.push(box(match[0], rects[0])); continue; }
    let part = null;
    let offset = match.index;
    chars.forEach((char) => {
      const rect = measure(offset, offset + char.length)[0];
      offset += char.length;
      if (!rect) return;
      const alone = !inHelvetica(char);
      if (part && !alone && !part.alone && Math.abs(part.top - rect.top) < 1) { part.text += char; part.right = rect.right; }
      else { part = { ...box(char, rect), alone }; boxes.push(part); }
    });
  }
  return boxes;
};

const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

const drawPage = (pdf, page) => {
  const doc = page.ownerDocument;
  const view = doc.defaultView;
  const origin = page.getBoundingClientRect();
  const x = (value) => (value - origin.left) * PT;
  const y = (value) => (value - origin.top) * PT;
  const fill = (color, left, top, width, height) => {
    pdf.setFillColor(...color);
    pdf.rect(x(left), y(top), width * PT, height * PT, 'F');
  };
  const elements = [...page.querySelectorAll('*')].filter((element) => element.getClientRects().length > 0
    && view.getComputedStyle(element).visibility !== 'hidden');

  // 1. Images first: lines and text are drawn over them, like the signature over its line.
  elements.filter((element) => element.tagName === 'IMG').forEach((img) => {
    const image = imageData(img);
    const rect = img.getBoundingClientRect();
    if (image) pdf.addImage(image.data, image.format, x(rect.left), y(rect.top), rect.width * PT, rect.height * PT);
  });

  // 2. Background colors, the ruled lines of long answers, and borders.
  elements.forEach((element) => {
    if (element.tagName === 'IMG') return;
    const style = view.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const background = rgb(style.backgroundColor);
    if (background) fill(background, rect.left, rect.top, rect.width, rect.height);
    // `.block .value`: one line under every line of text (print.css draws it as a repeating gradient).
    const lineHeight = parseFloat(style.lineHeight);
    if (style.backgroundImage.includes('repeating-linear-gradient') && lineHeight > 0) {
      for (let line = 1; line * lineHeight <= rect.height + 0.5; line += 1) {
        fill([0, 0, 0], rect.left, rect.top + line * lineHeight - 1, rect.width, 1);
      }
    }
    SIDES.forEach((side) => {
      const width = parseFloat(style[`border${side}Width`]);
      const color = rgb(style[`border${side}Color`]);
      if (!width || !color || ['none', 'hidden'].includes(style[`border${side}Style`])) return;
      if (side === 'Top') fill(color, rect.left, rect.top, rect.width, width);
      if (side === 'Bottom') fill(color, rect.left, rect.bottom - width, rect.width, width);
      if (side === 'Left') fill(color, rect.left, rect.top, width, rect.height);
      if (side === 'Right') fill(color, rect.right - width, rect.top, width, rect.height);
    });
  });

  // 3. Text, word by word, in the font size, weight and color the sheet shows.
  const walker = doc.createTreeWalker(page, view.NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!/\S/.test(node.data) || !parent || parent.getClientRects().length === 0) continue;
    const style = view.getComputedStyle(parent);
    if (style.visibility === 'hidden') continue;
    const size = parseFloat(style.fontSize);
    const bold = (parseInt(style.fontWeight, 10) || 400) >= 600;
    const italic = style.fontStyle !== 'normal';
    const color = rgb(style.color) || [0, 0, 0];
    // Capital letters set by the stylesheet are written into the text itself (it looks the same),
    // because the browser measures such words by their original letters.
    if (style.textTransform === 'uppercase') node.data = node.data.toUpperCase();
    if (style.textTransform === 'lowercase') node.data = node.data.toLowerCase();
    // The underline may be set on an element further up (text-decoration is not inherited as a value).
    let underline = false;
    for (let element = parent; element && element !== page.parentElement && !underline; element = element.parentElement) {
      underline = view.getComputedStyle(element).textDecorationLine.includes('underline');
    }

    pdf.setFontSize(size * PT);
    pdf.setTextColor(...color);
    const boxes = wordBoxes(node, range);
    const fontStyle = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
    pdf.setFont('helvetica', fontStyle);
    boxes.forEach((box) => {
      // 0.81: where the baseline sits inside a line of Arial/Helvetica text (ascent over ascent + descent).
      const baseline = y(box.top + box.height * 0.81);
      if (SYMBOLS[box.text]) {
        pdf.setFont('symbol', 'normal');
        pdf.text(SYMBOLS[box.text], x(box.left), baseline);
        pdf.setFont('helvetica', fontStyle);
        return;
      }
      const text = pdfText(box.text);
      // The browser tucks some letter pairs closer (kerning) and a PDF reader does not, and a replaced symbol
      // can be wider: the letters are spaced to fill exactly the room the word has on the sheet.
      // Always set, because the PDF keeps the last value for the next word.
      const drawn = pdf.getStringUnitWidth(text, { doKerning: false }) * size * PT;
      const spare = (box.right - box.left) * PT - drawn;
      const charSpace = text.length > 1 ? Math.max(-size * PT * 0.35, Math.min(size * PT * 0.12, spare / (text.length - 1))) : 0;
      // The space after the word is only for copying text out of the PDF.
      pdf.text(`${text} `, x(box.left), baseline, { charSpace });
    });
    if (underline) {
      const lines = new Map();
      boxes.forEach((box) => {
        const key = Math.round(box.top);
        const line = lines.get(key);
        if (line) { line.left = Math.min(line.left, box.left); line.right = Math.max(line.right, box.right); }
        else lines.set(key, { ...box });
      });
      lines.forEach((line) => fill(color, line.left, line.top + line.height * 0.81 + size * 0.1, line.right - line.left, Math.max(0.75, size / 16)));
    }
  }
};

/*
 * Downloads the sheets (from paginate) as `fileName`. The PDF library is loaded only now, so
 * pages that never download a PDF do not carry it.
 */
export const saveDocumentPdf = async (pages, fileName) => {
  if (!pages.length) throw new Error('Nothing to save');
  const { jsPDF } = await import('jspdf');
  const sizeOf = (page) => {
    const rect = page.getBoundingClientRect();
    return [rect.width * PT, rect.height * PT];
  };
  const pdf = new jsPDF({ unit: 'pt', format: sizeOf(pages[0]), orientation: 'portrait', compress: true });
  pdf.setProperties({ title: fileName.replace(/\.pdf$/i, '') });
  pages.forEach((page, index) => {
    if (index > 0) pdf.addPage(sizeOf(page), 'portrait');
    drawPage(pdf, page);
  });
  pdf.save(fileName);
};
