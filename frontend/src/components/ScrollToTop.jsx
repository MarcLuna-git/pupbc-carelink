import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/*
 * Opens every page at its top when the route changes.
 *
 * Two scrollers are reset:
 *  - the window (phones, public pages, nurse portal);
 *  - any element marked `data-route-scroll` — on tablet/desktop the Student
 *    shell locks the document and scrolls `.student-shell-body` instead.
 *
 * Back/forward (POP) leaves the window alone so the browser can restore it,
 * but still resets inner scrollers, which the browser never restores.
 * Links with a #hash keep their own anchor jump.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (hash) return;

    // 'instant' overrides any CSS scroll-behavior: smooth on the scroller.
    const toTop = { top: 0, left: 0, behavior: 'instant' };

    document
      .querySelectorAll('[data-route-scroll]')
      .forEach((element) => element.scrollTo(toTop));

    if (navigationType !== 'POP') {
      window.scrollTo(toTop);
    }
  }, [pathname, hash, navigationType]);

  return null;
};

export default ScrollToTop;
