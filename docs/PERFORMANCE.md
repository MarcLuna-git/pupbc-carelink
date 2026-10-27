# Performance notes

What the system already does, what was added in the October 2026 pass, and what
is deliberately left out. Numbers are from a production build served locally;
Render and Z.com will differ.

## Already in place (earlier work)

| Area | Where |
| --- | --- |
| Route-level code splitting, chunks preloaded on hover | `frontend/src/App.jsx`, `utils/preloadStudentPages.js` |
| Loading skeletons / route loading bar | `RouteLoadingBar`, `NursePageSkeleton`, page-level ghosts |
| In-flight request de-duplication | `frontend/src/services/requestPool.js` |
| Visibility-aware polling with back-off | `hooks/useVisiblePolling.js` |
| Paginated lists (students, appointments, medicines, consultations) | `Api/Nurse/*Controller` |
| Database indexes for the hot queries | `2026_10_10_000001_add_clinic_read_indexes.php` |
| Server-side cache for the nurse dashboard stats (300 s) | `Api/Nurse/DashboardController` |
| OPcache, persistent DB connections, Supabase session pooler | `backend/Dockerfile`, `render.yaml` |
| Frontend on a CDN (Render static site) | `render.yaml` |

## Added in this pass

- **Images**: the three large JPEGs are WebP now (`pupstatue` 433 KB to 131 KB,
  `pupbg` 163 KB to 69 KB, logo 141 KB to 13 KB). Unused assets were removed
  (about 2.1 MB of PNGs and an SVG). The two remaining JPEGs did not get smaller
  as WebP, so they were kept. Student-directory avatars load lazily.
- **Kiosk QR scanner**: `html5-qrcode` and `jsqr` are loaded on demand. The
  `KioskScan` chunk went from 518 KB to 20 KB, and a kiosk user who types a
  Student ID never downloads the decoders.
- **Search debounce**: the nurse Appointments search sent one request per
  keystroke; it now waits 300 ms (`hooks/useDebouncedValue.js`).
- **API compression**: `CompressResponse` gzips JSON of 1 KB or more when the
  client sends `Accept-Encoding: gzip`. `php artisan serve` on Render has no web
  server in front to do it. It skips streams, files, HEAD and anything already
  encoded, so it does nothing extra behind Apache/nginx that compresses.
- **Long-lived caching** for the content-hashed `/assets/*` files
  (`render.yaml` `headers`). Z.com needs the equivalent rule in its
  `.htaccess`: `Cache-Control: public, max-age=31536000, immutable` for `/assets/`.
- **Head hints**: `preconnect` to the API origin and an early preload of the
  landing hero image (`vite.config.js`), plus a meta description and
  `robots.txt` (Lighthouse SEO 83 to 100).

## Deliberately not done

- **Client-side caching of API responses.** The request pool only shares
  requests that are in flight. Queue position, appointment status and records
  are clinical state; a stale cached answer could show the wrong status. The
  backend already caches the one expensive, tolerant-of-staleness read
  (dashboard stats).
- **Load balancer, CDN of our own, extra connection pooling.** These are hosting
  decisions, not code. Render's free web service is a single instance, and the
  static frontend is already served from Render's CDN. Persistent connections
  and the Supabase pooler are already configured. Revisit when there is a paid
  plan with more than one instance.
- **Blanket `memo`/`useMemo`.** No measured re-render problem; the lists are
  paginated and polls are slow (10 to 30 s). Add it where a profile shows a hot
  component.
- **Moving the entry bundle further down.** About 90% of the 309 KB entry chunk
  is React, React Router and axios.

## Lighthouse (production build, local `vite preview`, median of 3)

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Landing, mobile | 72 (LCP 3.7 s, TBT 0.4 s) | 91 | 96 | 100 |
| Student login, mobile | 78 (LCP 3.4 s, TBT 0.3 s) | 95 | 100 | 100 |
| Landing, desktop | 95 (LCP 1.0 s) | 96 | 96 | 100 |

Before this pass the first run on the same machine measured landing 69 and
login 53 on mobile, SEO 83 on both. Re-run with `npx lighthouse <url>` against
`npm run build && npm run preview`.

## Known limits

- Mobile Lighthouse (4x CPU throttle, slow 4G) is limited by running the React
  entry bundle, not by the network, and swings by 10 or more points between
  runs, especially while the machine is busy. Judge it by the median of a few
  runs.
- Remaining accessibility findings on the landing page are low-contrast gray
  captions (about 2.6:1) and small carousel dots. Not touched here because they
  change the visual design.
- The nurse Appointments search matches first name, last name or student ID
  separately, so a full name such as "Ee Student" finds nothing.
