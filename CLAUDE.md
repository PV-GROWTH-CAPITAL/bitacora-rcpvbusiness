# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

There is no lint or test tooling configured in this project (no ESLint/Prettier config, no test runner in `package.json`).

Required environment variables (Vite `.env`, not committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. In production (Netlify) these are set as site environment variables. Without them, `supabaseClient.js` logs an error and the app cannot talk to the backend.

## Architecture

This is a single-page React app ("Bitácora de trading" — a trading journal / accounting tool for prop-firm funded accounts) built with Vite. There is no backend server and no client-side router: **Supabase is the entire backend** (Postgres via PostgREST, Auth, and Storage), accessed directly from components through `src/supabaseClient.js`, and screen switching is done with plain React state, not a routing library.

**Entry chain:** `main.jsx` → `ErrorBoundary.jsx` (class-based global error boundary, catches render errors and offers a reload) → `App.jsx`.

**`App.jsx`** owns Supabase auth state (`supabase.auth.getSession` / `onAuthStateChange`) and renders one of: the marketing `LandingPage.jsx`, inline login/signup/forgot-password/reset-password forms, or — once a session exists — `AppShell.jsx`. It also special-cases the `PASSWORD_RECOVERY` auth event to drop the user straight into the "set new password" form.

**`AppShell.jsx`** is the authenticated shell: a collapsible sidebar with two expandable groups — "Análisis" (Journal / Estrategia / Cuentas activas) and "Contabilidad" (per prop-firm accounting, one sub-item per entry in the hardcoded `CONTABILIDAD_EMPRESAS` list of funded-account providers, e.g. FTMO, Apex, Topstep) — and a `page` state string that decides which page component to render. There is no URL-based navigation; state resets on reload.

**Page components** (all in `src/`, all query Supabase directly, no shared data layer):
- `TradingJournal.jsx` — CRUD on the `trades` table; uploads trade screenshots to the `capturas` storage bucket; reads/writes daily max-risk config in the `configuracion` table.
- `EstrategiaTrading.jsx` — trading-strategy checklist/rules (`estrategia_criterios`) and daily compliance records (`estrategia_registros`).
- `CuentasActivas.jsx` — active funded accounts (`cuentas`) and their linked `trades`.
- `Objetivos.jsx` — periodic goals (`objetivos`, weekly/monthly/quarterly/annual) cross-referenced against `trades`.
- `Informes.jsx` — aggregated reports/charts (via `recharts`) over `trades` and `estrategia_registros`.
- `Contabilidad.jsx` — per-firm accounting: purchased accounts (`cuentas_compradas`), withdrawals (`retiros`), tax-deductible investments (`inversiones_desgravables`).

**`supabaseClient.js`** creates the Supabase client from the env vars above and exports `conReintento()`, a small retry wrapper used on queries fired right after session load — it works around a real race where the very first query can fail because the restored session's token is still refreshing.

**Data/security model:** all tables are expected to use Supabase Row Level Security scoped to `auth.uid()` (see the storage policies in `sql/capturas_schema.sql`). `sql/` contains hand-run migrations, not an automated migration system — each script must be pasted into the Supabase SQL Editor manually; it is not wired into the build or deploy.

**Styling:** no CSS framework. Every component defines its look as inline style objects plus an injected `<style>` block for hover/responsive rules, using a shared dark palette and Google Fonts (`Fraunces`, `IBM Plex Sans`/`Mono`, `Space Grotesk`) pulled in via `@import`.

**Deployment:** Netlify, configured in `netlify.toml` — `npm run build`, publish `dist/`, SPA fallback (`/* → /index.html`), plus baseline security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
