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

**`AppShell.jsx`** is the authenticated shell: a collapsible sidebar with two expandable groups — "Análisis" (Journal / Estrategia / Cuentas activas) and "Contabilidad" (per prop-firm accounting, one sub-item per firm in the user's own list, table `empresas_usuario`, loaded once here via `src/empresasUsuario.js` and passed as the `empresas` prop to `Contabilidad` and `Payouts`; new users pick their firms in a one-step welcome and everyone can add/remove/reorder them from the "Mis firmas" button in the sidebar footer, both in `src/MisFirmas.jsx`) — and a `page` state string that decides which page component to render. There is no URL-based navigation; state resets on reload.

**Page components** (all in `src/`, all query Supabase directly, no shared data layer):
- `TradingJournal.jsx` — CRUD on the `trades` table; uploads trade screenshots to the `capturas` storage bucket; reads/writes daily max-risk config in the `configuracion` table.
- `ImportarOperaciones.jsx` — modal «Importar» del Journal: lee en el navegador el CSV de la plataforma (Tradovate "Performance", TopstepX "Trades") y, tras la vista previa, inserta en `trades` por lotes. Los formatos son módulos puros en `src/importar/` (registro en `index.js`; pruebas con `node scripts/probar-importador.js`). Cada operación importada lleva `trades.origen_id` (`sql/trades_origen_id.sql`, índice único parcial por `user_id`) para que reimportar el mismo archivo no duplique; los precios van en `trades.entrada` / `trades.salida`. Los formatos devuelven las operaciones en crudo y `procesar()` (`src/importar/index.js`) aplica dos opciones del paso 1: descontar comisiones (solo TopstepX, si el CSV trae `Fees` y `Commissions`: neto = PnL − Fees − Commissions, en céntimos; `puntos` sigue en bruto) y convertir las horas a Nueva York con `convertirZona()` de `comun.js` (solo `Intl`, nunca restar horas fijas; TopstepX usa el desfase de cada fila, Tradovate la zona elegida, Europe/Madrid por defecto). La conversión no cambia `origen_id`.
- `EstrategiaTrading.jsx` — trading-strategy checklist/rules (`estrategia_criterios`) and daily compliance records (`estrategia_registros`).
- `CuentasActivas.jsx` — active funded accounts (`cuentas`) and their linked `trades`.
- `Objetivos.jsx` — periodic goals (`objetivos`, weekly/monthly/quarterly/annual) cross-referenced against `trades`.
- `Informes.jsx` — aggregated reports/charts (via `recharts`) over `trades` and `estrategia_registros`.
- `Contabilidad.jsx` — per-firm accounting: purchased accounts (`cuentas_compradas`), withdrawals (`retiros`), tax-deductible investments (`inversiones_desgravables`).
- `Payouts.jsx` — wall of payout screenshots. A payout **is a `retiros` row** (the same table Contabilidad and Cuentas activas use: fecha, cuenta, proveedor, `monto` €, `monto_usd` $), so anything entered in any of the three places shows up in the others; the `payouts` table only holds the optional screenshot (`retiro_id` → `retiros`, `imagen_path`). Images live in the private `payout-images` bucket (folder per `user_id`, signed URLs, client-side WebP compression). Schema in `sql/payouts_schema.sql` + `sql/payouts_retiros_migration.sql`.

**Filtro global de periodo y empresa** — `AppShell.jsx` guarda `filtroFondeo = { modo, anio, mes, trimestre, empresa }` (arranca en el año en curso, se pierde al recargar) y lo pasa como `filtro` / `onFiltroCambio` a `Contabilidad` y `Payouts`; ambas pintan la misma barra, `src/FiltroPeriodo.jsx` (Todo / 12M / 90D / 30D / Mes / Trimestre / Año + empresa). `filtro.empresa` es a la vez el subapartado activo de Contabilidad (`"GENERAL"` = todas). La lógica es pura y está en `src/utils/periodo.js`: `rangoDeFiltro()` devuelve `{ desde, hasta }` y se aplica con `enRango()` / las funciones de `src/utils/estadisticasFondeo.js`. Las fechas `YYYY-MM-DD` se comparan como texto y la aritmética de días va con `Date.UTC`: nunca `new Date("YYYY-MM-DD")`. «Hoy» es el día civil de Madrid. «Neto a tributar» solo se llama así con Año o Trimestre; en el resto, «Neto del periodo».

**Calendario de dinero** — panel `src/CalendarioDinero.jsx` dentro de `Contabilidad.jsx` (en Resumen general y en cada firma): un mes en rejilla lunes–domingo con fin de semana compacto, interruptor Payouts / Gastos / Beneficio neto, total por semana, total del mes y los 12 meses del año. Tiene su propia navegación de mes: sigue la empresa del filtro global, no su periodo. Los retiros se colocan en `retiros.fecha` (el día en que llegan en €; no hay fecha de solicitud) y los gastos siguen el criterio de Contabilidad (General: `cuentas_compradas` + `inversiones_desgravables`; una firma: solo sus compras). `costo` y `monto` están en €; `monto_usd` no se usa aquí. La rejilla (`celdasMes`, `semanasMes` en `src/utils/calendario.js`) es la misma que usa el calendario del Journal, y la suma por día (`movimientosPorDia`, `totalesPorMes`) está en `src/utils/estadisticasFondeo.js`. Pruebas: `node scripts/probar-calendario.js`.

**`perfil.js`** — one row per user in `perfiles` (`sql/perfiles.sql`), created on first login by `AppShell.jsx`. Holds the optional marketing-email consent (`acepta_correos`): the signup checkbox in `App.jsx` travels in the signup metadata (`user_metadata.acepta_correos`) and is copied into the row on first access; it can be changed from the envelope button in the sidebar footer. `acepta_correos_at` is set only by a database trigger. Usage metrics have no tooling: `sql/metricas_uso.sql` is a read-only query over `trades.created_at`, run by hand.

**`supabaseClient.js`** creates the Supabase client from the env vars above and exports `conReintento()`, a small retry wrapper used on queries fired right after session load — it works around a real race where the very first query can fail because the restored session's token is still refreshing.

**Data/security model:** all tables are expected to use Supabase Row Level Security scoped to `auth.uid()` (see the storage policies in `sql/capturas_schema.sql`). `sql/` contains hand-run migrations, not an automated migration system — each script must be pasted into the Supabase SQL Editor manually; it is not wired into the build or deploy.

**Styling:** no CSS framework. Every component defines its look as inline style objects plus an injected `<style>` block for hover/responsive rules, using a shared dark palette and Google Fonts (`Fraunces`, `IBM Plex Sans`/`Mono`, `Space Grotesk`) pulled in via `@import`.

**Deployment:** Netlify, configured in `netlify.toml` — `npm run build`, publish `dist/`, SPA fallback (`/* → /index.html`), plus baseline security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).

## Imagen "Operativa Trading"
- Botón "Imagen operativa" en `TradingJournal.jsx`. Solo aparece con un único día filtrado. El diseño está en `src/OperativaImagen.jsx`.
- La lógica de cálculo está en `src/utils/operativa.js` y la comparten la web y el script de `PLANTILLAS/operativa-img/generar.js` (`~/Desktop/RCPV BUSINESS/PLANTILLAS/operativa-img`). Si la cambias, comprueba que el script sigue funcionando.
- Modos: "porcentaje" (por defecto; % de cada cuenta sobre su propio tamaño, total = suma de los %) y "dolares" (resultado en $ por cuenta, total = suma de los $). No existe modo capital.
- Paleta de marca: navy #0B132B/#0D1B2A, dorado #D4AF37/#C5A059, blanco cálido #F8F9FA/#E0E1DD. Fuentes: Cinzel + Montserrat.
- Cambios grandes: siempre en una rama con PR en borrador para ver el deploy preview de Netlify antes de fusionar.

## Producto multiusuario
- La Bitácora va a abrirse a usuarios externos. Un solo proyecto de Supabase para todos; el aislamiento es por fila con RLS y auth.uid().
- Toda tabla nueva lleva user_id, RLS activado y las cuatro políticas (select, insert, update, delete) limitadas a auth.uid() = user_id.
- Storage: buckets privados, carpeta raíz = user_id, imágenes con URLs firmadas. El modelo a copiar es src/Payouts.jsx. Nunca getPublicUrl para contenido de usuario.
- Nada escrito a fuego para un usuario concreto: ni correos, ni listas de firmas, ni instrumentos. Lo configurable se guarda por usuario.
- Sin Edge Functions salvo que no haya alternativa: preferimos funciones SQL (RPC) que René pega en el SQL Editor.
- Cada cambio de base de datos va en un archivo nuevo en sql/ y viene con su script de vuelta atrás en sql/rollback/. René los pega a mano, primero en el proyecto de pruebas y luego en producción.
- Cambios de más de un archivo: rama nueva y PR en borrador, para probar en el deploy preview de Netlify antes de fusionar.
- No añadir dependencias sin preguntar antes.
- Los textos de la interfaz, en español de España.
