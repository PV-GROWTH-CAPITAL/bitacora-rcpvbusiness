-- ============================================================
-- TRADES: contratos con decimales (lotaje)
--
-- - "contratos" pasa de integer a numeric(12,2) para poder guardar
--   lotajes como 4,5 o 0,01. Los valores actuales (1, 2, 40...) se
--   conservan tal cual.
-- - Solo cambia la columna si todavía no es numeric(12,2).
--
-- Es seguro ejecutarlo varias veces y no borra ningún dato.
-- Ejecuta este script en Supabase → SQL Editor → New query → Run
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trades'
      and column_name = 'contratos'
      and (data_type <> 'numeric'
           or numeric_precision is distinct from 12
           or numeric_scale is distinct from 2)
  ) then
    alter table public.trades
      alter column contratos type numeric(12,2) using contratos::numeric(12,2);
  end if;
end $$;

notify pgrst, 'reload schema';
