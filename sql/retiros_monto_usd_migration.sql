-- ============================================================
-- RETIROS: importe en $ además del importe en €
--
-- - "monto" sigue siendo lo que recibiste en € (lo usa Contabilidad,
--   que no cambia).
-- - "monto_usd" (nueva) es lo que salió de la cuenta en $. Es lo que
--   Cuentas activas resta del balance y del DD.
--
-- Los retiros que ya tienes quedan con monto_usd vacío: Cuentas activas
-- te avisará en cada cuenta para que les pongas el importe en $.
--
-- Es seguro ejecutarlo varias veces y no borra ningún dato.
-- Ejecuta este script en Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.retiros
  add column if not exists monto_usd numeric;
