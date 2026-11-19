import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, Info, Loader2, Maximize, MoveHorizontal, Printer, X, ZoomIn, ZoomOut } from 'lucide-react';
import { paginate, saveDocumentPdf } from '../utils/documentPdf';
import { whenPrintReady } from '../utils/printReady';

/*
 * A printable clinic document (public/templates/print/) shown like a PDF: paper-sized sheets on
 * a gray background, with page navigation, zoom, Download PDF and Print.
 *
 *   load:    () => Promise<string>, the finished page (buildRecordDocument). What is shown is
 *            that same page, so the preview, the printout and the PDF are one document.
 *   docKey:  changes when another document should be loaded.
 *   details: optional extra content for a side panel (facts that are not on the document).
 *
 * Print sends the untouched page to the printer from a hidden frame, so only the document
 * prints (never this popup or the page behind it) and the browser breaks long content over
 * as many sheets as it needs.
 */

// Space around the sheets inside the frame; same as `.viewer body { padding }` in print.css.
const GUTTER = 12;
const STEPS = [50, 75, 100, 125, 150, 200];
const FIT_LABELS = { auto: 'Automatic', width: 'Fit to Width', page: 'Fit to Page' };

// iPhone and iPad print the whole screen when asked to print a frame, so they get the document in its own tab.
const printsFramesBadly = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500';
const iconButton = `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-gray-200 bg-white text-gray-700 transition hover:bg-maroon-50 hover:text-maroon-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white dark:disabled:hover:bg-gray-800 ${ring}`;
const textButton = `inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${ring}`;

export default function DocumentViewerModal({ title, subtitle, docKey, load, onClose, details = null, detailsLabel = 'Other details', headerExtra = null }) {
  const dialog = useRef(null);
  const scroller = useRef(null);
  const frame = useRef(null);
  const printFrame = useRef(null);
  const pages = useRef([]);
  const loadRef = useRef(load);
  loadRef.current = load;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // null while loading, '' when it could not be loaded, otherwise the page.
  const [html, setHtml] = useState(null);
  // Sizes of the laid-out document, in its own pixels: the frame, one sheet, and where each sheet starts.
  const [layout, setLayout] = useState(null);
  const [printReady, setPrintReady] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState({ mode: 'auto', value: 1 });
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // A real modal dialog: it sits above everything, keeps the keyboard inside and closes on Escape.
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    // Start on the document, so the arrow keys scroll it.
    scroller.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setHtml(null); setLayout(null); setPrintReady(false); setPage(0); setNotice('');
    loadRef.current()
      .then((result) => { if (active) setHtml(result || ''); })
      .catch(() => { if (active) setHtml(''); });
    return () => { active = false; };
  }, [docKey]);

  // The room the sheets have, for Fit to Width and Fit to Page.
  useEffect(() => {
    const element = scroller.current;
    const observer = new ResizeObserver(() => setBox({ w: element.clientWidth, h: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The page has loaded with its styles: split it into sheets and note their sizes.
  const measure = () => {
    const doc = frame.current?.contentDocument;
    if (!doc?.querySelector('.page')) { setHtml(''); return; }
    doc.documentElement.classList.add('viewer');
    pages.current = paginate(doc);
    const rects = pages.current.map((sheet) => sheet.getBoundingClientRect());
    setLayout({
      frameW: rects[0].width + GUTTER * 2,
      frameH: rects.at(-1).bottom + GUTTER,
      pageH: rects[0].height,
      tops: rects.map((rect) => rect.top),
    });
  };

  const fitWidth = layout && box.w ? box.w / layout.frameW : 1;
  const fitPage = layout && box.h ? Math.min(fitWidth, box.h / (layout.pageH + GUTTER * 2)) : fitWidth;
  const wanted = zoom.mode === 'custom' ? zoom.value : zoom.mode === 'width' ? fitWidth : zoom.mode === 'page' ? fitPage : Math.min(1, fitWidth);
  const scale = Math.min(4, Math.max(0.2, wanted));
  const percent = Math.round(scale * 100);
  const pageCount = layout?.tops.length || 1;
  const ready = Boolean(layout);

  // Zoomed out, a 1px ruled line would be thinner than a screen pixel and some would vanish: keep them one pixel thick.
  useEffect(() => {
    if (layout) frame.current?.contentDocument?.documentElement.style.setProperty('--rule', `${Math.max(1, 1 / scale)}px`);
  }, [layout, scale]);

  const larger = STEPS.find((step) => step > percent);
  const smaller = [...STEPS].reverse().find((step) => step < percent);
  const zoomTo = (step) => setZoom({ mode: 'custom', value: step / 100 });
  const chooseZoom = (value) => (FIT_LABELS[value] ? setZoom({ mode: value, value: scale }) : zoomTo(Number(value)));
  const nextFit = zoom.mode === 'width' ? 'page' : 'width';

  // The sheet in the middle of the view is the current page.
  const trackPage = () => {
    if (!layout) return;
    const middle = (scroller.current.scrollTop + scroller.current.clientHeight / 2) / scale;
    setPage(layout.tops.reduce((current, top, index) => (top <= middle ? index : current), 0));
  };
  const goToPage = (index) => {
    if (!layout || index < 0 || index >= pageCount) return;
    setPage(index);
    scroller.current.scrollTo({ top: Math.max(0, (layout.tops[index] - GUTTER) * scale), behavior: 'smooth' });
  };

  const print = () => {
    if (!html) return;
    if (printsFramesBadly()) {
      const tab = window.open('', '_blank');
      if (!tab) { setNotice('Allow pop-ups to print this document.'); return; }
      tab.document.write(html);
      tab.document.close();
      whenPrintReady(tab.document).then(() => tab.setTimeout(() => tab.print(), 200));
      return;
    }
    const target = printFrame.current?.contentWindow;
    if (!target) return;
    target.focus();
    target.print();
    // Back to the popup once the print window is gone, or Escape and the arrow keys would go to the hidden frame.
    const refocus = () => scroller.current?.focus({ preventScroll: true });
    target.addEventListener('afterprint', refocus, { once: true });
    refocus();
  };

  const download = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setNotice('');
    try {
      const name = (frame.current.contentDocument.title || title).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'Document';
      await saveDocumentPdf(pages.current, `${name}.pdf`);
    } catch {
      setNotice('The PDF could not be created. Use Print and choose "Save as PDF" instead.');
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd + P prints the document instead of the page behind the popup.
  const onKeyDown = (event) => {
    // Escape closes the popup. The dialog does this itself; handled here too so it never depends on the browser.
    if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      if (printReady) print();
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="document-viewer-title"
      onCancel={(event) => { event.preventDefault(); closeRef.current(); }}
      // A browser may close the dialog itself without asking first (a second Escape in a row): follow it.
      // Only when it really is closed: the dev server (React StrictMode) closes and reopens the dialog
      // once on mount, and that first close is reported late, after it is already open again.
      onClose={() => { if (!dialog.current?.open) closeRef.current(); }}
      onClick={(event) => { if (event.target === dialog.current) closeRef.current(); }}
      onKeyDown={onKeyDown}
      className="m-auto h-[calc(100dvh-1.5rem)] max-h-[60rem] w-[calc(100%-1.5rem)] max-w-6xl flex-col overflow-hidden rounded-[10px] border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-gray-950/60 open:flex dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-3 sm:px-5 dark:border-gray-700">
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 sm:flex dark:bg-maroon-900/30 dark:text-maroon-300">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="document-viewer-title" className="truncate text-lg font-bold">{title}</h2>
          {subtitle && <p className="truncate text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {details && (
          <button type="button" onClick={() => setShowDetails((open) => !open)} aria-pressed={showDetails} aria-label={detailsLabel} title={detailsLabel}
            className={`${textButton} border ${showDetails
              ? 'border-maroon-800 bg-maroon-50 text-maroon-800 dark:border-maroon-300 dark:bg-maroon-900/30 dark:text-maroon-200'
              : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}`}>
            <Info className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{detailsLabel}</span>
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close"
          className={`rounded-[10px] p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 ${ring}`}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>
      {headerExtra}

      <div role="toolbar" aria-label="Document controls"
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gray-200 bg-gray-50 px-3 py-2 sm:px-5 dark:border-gray-700 dark:bg-gray-900/40">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => goToPage(page - 1)} disabled={!ready || page === 0} aria-label="Previous page" title="Previous page" className={iconButton}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span aria-live="polite" aria-label={`Page ${page + 1} of ${pageCount}`} className="min-w-14 text-center text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {page + 1} / {pageCount}
          </span>
          <button type="button" onClick={() => goToPage(page + 1)} disabled={!ready || page >= pageCount - 1} aria-label="Next page" title="Next page" className={iconButton}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => zoomTo(smaller)} disabled={!ready || !smaller} aria-label="Zoom out" title="Zoom out" className={iconButton}>
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <select value={zoom.mode === 'custom' ? String(percent) : zoom.mode} onChange={(event) => chooseZoom(event.target.value)} disabled={!ready} aria-label="Zoom"
            className={`h-9 cursor-pointer rounded-[10px] border border-gray-200 bg-white px-2 text-sm font-semibold tabular-nums text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 ${ring}`}>
            {Object.entries(FIT_LABELS).map(([mode, label]) => (
              <option key={mode} value={mode}>{zoom.mode === mode && ready ? `${label} (${percent}%)` : label}</option>
            ))}
            {STEPS.map((step) => <option key={step} value={step}>{step}%</option>)}
          </select>
          <button type="button" onClick={() => zoomTo(larger)} disabled={!ready || !larger} aria-label="Zoom in" title="Zoom in" className={iconButton}>
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => chooseZoom(nextFit)} disabled={!ready} aria-label={FIT_LABELS[nextFit]} title={FIT_LABELS[nextFit]}
            className={`${iconButton} w-auto gap-2 px-2.5 text-sm font-semibold`}>
            {nextFit === 'width' ? <MoveHorizontal className="h-4 w-4" aria-hidden="true" /> : <Maximize className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden lg:inline">{FIT_LABELS[nextFit]}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={download} disabled={!ready || saving}
            className={`${textButton} border border-maroon-800 bg-white text-maroon-800 hover:bg-maroon-50 dark:border-maroon-300 dark:bg-transparent dark:text-maroon-200 dark:hover:bg-maroon-900/30`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            <span>Download<span className="hidden sm:inline"> PDF</span></span>
          </button>
          <button type="button" onClick={print} disabled={!printReady} className={`${textButton} bg-maroon-800 text-white hover:bg-maroon-900`}>
            <Printer className="h-4 w-4" aria-hidden="true" /> Print
          </button>
        </div>
      </div>

      {notice && <p role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-5 py-2 text-sm font-medium text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">{notice}</p>}

      <div className="relative flex min-h-0 flex-1">
        <div ref={scroller} onScroll={trackPage} tabIndex={0} aria-label="Document preview"
          className="relative min-w-0 flex-1 overflow-auto bg-gray-200 outline-none [scrollbar-gutter:stable] dark:bg-gray-900">
          {html === null && (
            <p role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Preparing the document…
            </p>
          )}
          {html === '' && (
            <p role="alert" className="m-6 rounded-[10px] bg-red-50 p-4 text-sm font-medium text-red-800 dark:bg-red-900/20 dark:text-red-300">
              The document could not be loaded. Close this window and try again.
            </p>
          )}
          {html && (
            // Sized to the zoomed document so the scrollbars match what is shown; the frame itself keeps its real size and is scaled.
            <div className="relative mx-auto overflow-hidden" style={{ width: layout ? layout.frameW * scale : 0, height: layout ? layout.frameH * scale : 0 }}>
              <iframe
                ref={frame}
                title={`${title} preview`}
                srcDoc={html}
                sandbox="allow-same-origin"
                onLoad={measure}
                tabIndex={-1}
                className="absolute left-0 top-0 origin-top-left border-0 bg-transparent"
                style={{ width: layout ? layout.frameW : 900, height: layout ? layout.frameH : 1200, transform: `scale(${scale})` }}
              />
            </div>
          )}
        </div>

        {details && showDetails && (
          <aside aria-label={detailsLabel}
            className="absolute inset-0 z-10 overflow-y-auto bg-white p-4 sm:p-5 lg:static lg:w-96 lg:shrink-0 lg:border-l lg:border-gray-200 dark:bg-gray-800 dark:lg:border-gray-700">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-maroon-800 dark:text-maroon-300">{detailsLabel}</h3>
              <button type="button" onClick={() => setShowDetails(false)} className={`rounded-[10px] px-2 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 ${ring}`}>
                <span className="lg:hidden">Back to document</span><span className="hidden lg:inline">Hide</span>
              </button>
            </div>
            {details}
          </aside>
        )}
      </div>

      {/* The untouched page, only for printing: the browser paginates it on the paper size the template sets. */}
      {html && (
        <iframe
          ref={printFrame}
          title="Print copy"
          aria-hidden="true"
          tabIndex={-1}
          srcDoc={html}
          sandbox="allow-same-origin allow-modals"
          onLoad={() => setPrintReady(true)}
          className="pointer-events-none absolute h-0 w-0 border-0 opacity-0"
        />
      )}
    </dialog>
  );
}
