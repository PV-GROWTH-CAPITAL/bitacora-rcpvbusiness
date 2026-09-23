-- ============================================================
-- CUENTAS ACTIVAS: funded vs evaluación y cuentas pasadas
--
-- - tipo: 'funded' | 'evaluacion'. Las cuentas que ya tenías
--   quedan como 'funded' automáticamente.
-- - motivo_cierre / fecha_cierre: se rellenan al pasar una cuenta
--   a "Cuentas pasadas" (quemada / pasada a funded / cerrada).
--
-- Los retiros NO necesitan tabla nueva: se usa la tabla "retiros"
-- que ya usa Contabilidad, enlazada por cuenta = cuentas.nombre.
--
-- Es seguro ejecutarlo varias veces y no borra ningún dato.
-- Ejecuta este script en Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.cuentas
  add column if not exists tipo text not null default 'funded';

alter table public.cuentas
  add column if not exists motivo_cierre text;

alter table public.cuentas
  add column if not exists fecha_cierre date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cuentas_tipo_check') then
    alter table public.cuentas
      add constraint cuentas_tipo_check
      check (tipo in ('funded', 'evaluacion'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cuentas_motivo_cierre_check') then
    alter table public.cuentas
      add constraint cuentas_motivo_cierre_check
      check (motivo_cierre is null or motivo_cierre in ('quemada', 'pasada_a_funded', 'cerrada'));
  end if;
end $$;
