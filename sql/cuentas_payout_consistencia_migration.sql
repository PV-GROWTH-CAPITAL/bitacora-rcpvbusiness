-- ============================================================
-- CUENTAS: requisito de payout y regla de consistencia por cuenta
--
-- - modo_payout: 'dias_minimos' | 'colchon' (solo se usa en FUNDED).
--     · dias_minimos / beneficio_minimo_dia: días cerrados con P&L
--       ≥ beneficio_minimo_dia desde el último retiro. Si están
--       vacíos se usan 5 días de ≥ 150 $ (lo que había hasta ahora).
--     · colchon: se puede retirar cuando el balance supera
--       balance_inicial (o el tamaño si está vacío) + colchón
--       (2100 $ por defecto).
-- - consistencia_activa / consistencia_pct: el mejor día no puede
--   superar ese % del beneficio total (en funded, desde el último
--   retiro). Desactivada por defecto.
--
-- Las cuentas que ya tienes quedan en 'dias_minimos' sin consistencia,
-- así que siguen funcionando exactamente igual que antes.
--
-- Es seguro ejecutarlo varias veces y no borra ningún dato.
-- Ejecuta este script en Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.cuentas
  add column if not exists modo_payout text not null default 'dias_minimos';

alter table public.cuentas
  add column if not exists dias_minimos int;

alter table public.cuentas
  add column if not exists beneficio_minimo_dia numeric;

alter table public.cuentas
  add column if not exists colchon numeric default 2100;

alter table public.cuentas
  add column if not exists consistencia_activa boolean not null default false;

alter table public.cuentas
  add column if not exists consistencia_pct numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cuentas_modo_payout_check') then
    alter table public.cuentas
      add constraint cuentas_modo_payout_check
      check (modo_payout in ('dias_minimos', 'colchon'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cuentas_dias_minimos_check') then
    alter table public.cuentas
      add constraint cuentas_dias_minimos_check
      check (dias_minimos is null or dias_minimos > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cuentas_beneficio_minimo_dia_check') then
    alter table public.cuentas
      add constraint cuentas_beneficio_minimo_dia_check
      check (beneficio_minimo_dia is null or beneficio_minimo_dia >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cuentas_colchon_check') then
    alter table public.cuentas
      add constraint cuentas_colchon_check
      check (colchon is null or colchon > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cuentas_consistencia_pct_check') then
    alter table public.cuentas
      add constraint cuentas_consistencia_pct_check
      check (consistencia_pct is null or (consistencia_pct > 0 and consistencia_pct <= 100));
  end if;
end $$;
