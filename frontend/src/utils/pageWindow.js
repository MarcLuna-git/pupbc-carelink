/*
 * The page numbers a pagination bar shows: the first and last page and the ones around the current page,
 * with null where pages are skipped. 1 2 3 stays 1 2 3; page 7 of 20 is 1 … 6 7 8 … 20.
 */
export function pageWindow(current, last) {
  if (last <= 5) return Array.from({ length: Math.max(last, 1) }, (_, i) => i + 1);
  const keep = [...new Set([1, last, current - 1, current, current + 1])].filter(page => page >= 1 && page <= last).sort((a, b) => a - b);
  const out = [];
  keep.forEach((page, i) => {
    if (i > 0 && page - keep[i - 1] > 1) out.push(null);
    out.push(page);
  });
  return out;
}
