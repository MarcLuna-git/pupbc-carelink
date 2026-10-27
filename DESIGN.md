# Design system

How the PUPBC CareLink interface is put together. The values live in code; this file says where and why, so new screens stay consistent. Product context is in [PRODUCT.md](PRODUCT.md).

## Color

- **Brand maroon** is one ramp, `--color-maroon-50 … 950` in `frontend/src/index.css` (`@theme static`), anchored on PUP maroon `maroon-800 = #800000`. Use the Tailwind classes (`bg-maroon-800`, `text-maroon-700`, `border-maroon-200`) or `var(--color-maroon-800)` in plain CSS. Do not write raw hex for brand colors.
- `maroon-500` and darker pass 4.5:1 as text on white. Tints (`50`–`200`) are for surfaces only.
- **Gold** is `yellow-300`/`yellow-400`, used on dark maroon surfaces (kiosk, sidebar caption) for emphasis and the main kiosk action.
- **Status colors are semantic, never decorative**: amber = pending, green = approved/completed, blue/purple = queue states, red = error/destructive. A KPI tile or icon tile with no status meaning uses the maroon tint (`bg-maroon-50 text-maroon-700`).
- Neutral surfaces come from the portal variables (`--sp-*` for students, `--np-*` for the nurse portal). They hold the same warm values on purpose.

## Type

- One system sans stack for every surface (Tailwind default). No per-portal font override.
- **Minimum 12 px** for any readable text (`text-xs`). Count badges inside 16 px circles may use 10 px.
- Page title: `text-3xl`/`sm:text-4xl`, bold, maroon. Description: `text-sm`, `max-w-prose`.
- No eyebrow/kicker label above headings, no gradient text, no wide-tracked decorative caps (nav section labels are the exception).

## Shape and depth

- Page hero and cards: `rounded-xl`, 1 px border, no heavy shadow. Nested cards are avoided.
- Primary buttons are solid `maroon-800` (hover `maroon-700`/`900`), no gradient fill.
- No decorative blur blobs, glass panels, shimmer sweeps or looping motion. Motion is for state changes, with `prefers-reduced-motion` honored.

## Page heroes

`StudentPageHero` and `NursePageHero` are the only page banners: title and one-line description, plus optional `leading`, `children` and `action`. The appointments page uses `.ap-hero` with the same structure.

## Kiosk

Dark maroon scrim over the campus photo (`KioskLayout`). Body text is at least `text-white/70`; the main action is a solid gold button with a 4 px focus outline. The welcome screen must fit a 1366×768 display without scrolling.

## Checks

Run `.claude/skills/impeccable/scripts/impeccable detect --json frontend/src` (local skill install, not committed) and `npm run lint` in `frontend/` before merging UI changes. Remaining detector hits are the print documents (`font-family: Arial` in generated PDFs/print windows) and the unrouted `pages/Student/Not-Exist-Pages/`.
