import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/*
 * Batch Release → a finished document shown on the page, as it will print. `autoPrint` opens the print
 * dialog once this html has loaded; `ref.current.print()` prints it again.
 */
const BatchPreview = forwardRef(function BatchPreview({ html, title, autoPrint = false }, ref) {
  const frame = useRef(null);
  const pending = useRef(autoPrint);
  const [height, setHeight] = useState(1100);

  useEffect(() => { pending.current = autoPrint; }, [html, autoPrint]);

  const print = () => {
    frame.current?.contentWindow?.focus();
    frame.current?.contentWindow?.print();
  };
  useImperativeHandle(ref, () => ({ print }));

  const loaded = () => {
    const page = frame.current?.contentDocument;
    if (page?.documentElement) setHeight(Math.max(640, page.documentElement.scrollHeight + 8));
    if (pending.current) {
      pending.current = false;
      print();
    }
  };

  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin allow-modals"
      onLoad={loaded}
      style={{ height }}
      className="w-full rounded-[10px] border border-gray-200 bg-[#f4f1f0] dark:border-gray-600"
    />
  );
});

export default BatchPreview;
