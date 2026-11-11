/*
 * Resolves when a print window's stylesheets and images have loaded, so the printout has its
 * styles and logos. The styles are external files (the site's Content-Security-Policy blocks
 * inline <style>), and these load after document.write() returns. Gives up after `timeout` ms
 * so a missing file never stops the print.
 */
const loaded = (element) => new Promise((done) => {
  element.addEventListener('load', done, { once: true });
  element.addEventListener('error', done, { once: true });
});

export const whenPrintReady = (doc, timeout = 5000) => {
  const pending = [
    ...[...doc.querySelectorAll('link[rel="stylesheet"]')].filter((link) => !link.sheet),
    ...[...doc.images].filter((img) => !img.complete),
  ].map(loaded);

  return Promise.race([
    Promise.all(pending),
    new Promise((done) => setTimeout(done, timeout)),
  ]);
};
