# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Students of PUP Biñan Campus** (phone or laptop): book clinic appointments, keep a health profile, show a QR code at the clinic, read their clinic records and announcements.
- **Clinic nurse / staff** (desktop at the clinic): approve appointments, run the live queue and consultations, manage students, medicines and records, post announcements.
- **Walk-up patients at the self-service kiosk** (touchscreen in the clinic): scan a QR code or enter a Student ID, accept the terms, state a complaint, and receive a queue number.

## Product Purpose
PUPBC CareLink is the campus clinic's QR-integrated health information system with a self-service triage kiosk. It replaces paper check-in and ad hoc queues with one flow from appointment to student check-in, queue, consultation and record, so students wait less and the nurse works from one reliable record. Success is a student checked in and seen without confusion, and a nurse who trusts what the screen says.

## Positioning
A clinic system built for one campus clinic and its students: the QR check-in, the kiosk triage and the nurse's live queue are one connected flow, not separate tools.

## Operating Context
- The nurse works through the queue during clinic hours (open days, lunch break and slot limits are configured by the clinic).
- The kiosk is a shared public screen: it must be understandable at a glance, touch-friendly, and never leave one patient's details on screen for the next.
- Students use it from phones between classes; the landing page is public, the student and nurse portals are behind login.
- Health information is sensitive; screens must read as calm and trustworthy, and state (queue position, appointment status) must never be ambiguous.

## Capabilities and Constraints
- React 19 + Vite + Tailwind CSS 4 frontend, Laravel 8 API, PostgreSQL (Supabase) in production.
- Student portal, nurse portal and kiosk each have their own layouts; light and dark themes exist for the account portals.
- UI language is English.
- Existing flows and wording are tested and stay as they are in this pass: refinement of the interface, not of behavior.

## Brand Commitments
- PUP Biñan identity: maroon and gold, with the PUPBC CareLink clinic logo (`frontend/src/assets/clinic-logo.webp`) and campus photography already in the product.
- One maroon, used through shared tokens; no new brand colors in this pass.

## Evidence on Hand
- Real campus and clinic photographs in `frontend/src/assets/`.
- No testimonials, usage statistics or partner logos exist; none may be invented.

## Product Principles
1. State is never ambiguous: status, queue position and time windows are always plain and visible.
2. Calm over clever: a health setting earns trust through clarity, not decoration.
3. One system: the student portal, nurse portal, kiosk and landing page share one set of tokens and components.
4. Fast on modest devices: students and the clinic tablet are not on high-end hardware.

## Accessibility & Inclusion
Health-related and used by the whole student body: aim for WCAG 2.2 AA contrast and keyboard/focus support, touch targets of at least 44 px on the kiosk and mobile, and respect for reduced motion.
