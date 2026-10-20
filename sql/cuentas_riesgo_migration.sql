-- ============================================================
-- CUENTAS + CONFIGURACION: calculadora de riesgo por cuenta
--
-- cuentas:
-- - dd_tipo: 'eod_trailing' | 'estatico'
--   (por defecto 'eod_trailing', que es como se calculaba hasta ahora).
-- - dd_maximo (ya existía): distancia del DD. Vacío = 2000 $.
-- - dd_bloqueo: balance donde el trailing deja de subir (p. ej. 50100).
--   Vacío = tamaño × 1.002 en funded y sin bloqueo en evaluación.
-- - margen_manual / margen_manual_fecha: margen real copiado del panel.
--   Solo se usa el día de margen_manual_fecha.
--
-- configuracion (una fila por usuario):
-- - riesgo_pct_funded / riesgo_pct_eval: % del margen que se arriesga
--   por trade (33 por defecto).
-- - riesgo_minimo: riesgo mínimo por trade en $ (250 por defecto).
--
-- Las cuentas que ya tienes siguen igual: los valores vacíos equivalen a
-- lo que se calculaba antes.
--
-- Es seguro ejecutarlo varias veces y no borra ningún dato.
-- Ejecuta este script en Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.cuentas
  add column if not exists dd_tipo text not null default 'eod_trailing';

alter table public.cuentas
  add column if not exists dd_bloqueo numeric;

alter table public.cuentas
  add column if not exists margen_manual numeric;

alter table public.cuentas
  add column if not exists margen_manual_fecha date;

alter table public.configuracion
  add column if not exists riesgo_pct_funded numeric not null default 33;

alter table public.configuracion
  add column if not exists riesgo_pct_eval numeric not null default 33;

alter table public.configuracion
  add column if not exists riesgo_minimo numeric not null default 250;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cuentas_dd_tipo_check') then
    alter table public.cuentas
      add constraint cuentas_dd_tipo_check
      check (dd_tipo in ('eod_trailing', 'estatico'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cuentas_dd_maximo_check') then
    alter table public.cuentas
      add constraint cuentas_dd_maximo_check
      check (dd_maximo is null or dd_maximo > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cuentas_dd_bloqueo_check') then
    alter table public.cuentas
      add constraint cuentas_dd_bloqueo_check
      check (dd_bloqueo is null or dd_bloqueo > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'configuracion_riesgo_pct_funded_check') then
    alter table public.configuracion
      add constraint configuracion_riesgo_pct_funded_check
      check (riesgo_pct_funded > 0 and riesgo_pct_funded <= 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'configuracion_riesgo_pct_eval_check') then
    alter table public.configuracion
      add constraint configuracion_riesgo_pct_eval_check
      check (riesgo_pct_eval > 0 and riesgo_pct_eval <= 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'configuracion_riesgo_minimo_check') then
    alter table public.configuracion
      add constraint configuracion_riesgo_minimo_check
      check (riesgo_minimo >= 0);
  end if;
end $$;
