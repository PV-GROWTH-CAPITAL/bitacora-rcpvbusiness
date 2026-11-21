-- ============================================================================
-- VUELTA ATRÁS de sql/indices_fk.sql: borra los 8 índices.
-- No toca datos. Las consultas siguen funcionando, solo más despacio.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================================

drop index if exists public.cuentas_user_id_idx;
drop index if exists public.cuentas_compradas_user_id_idx;
drop index if exists public.retiros_user_id_idx;
drop index if exists public.estrategia_criterios_user_id_idx;
drop index if exists public.estrategia_checks_criterio_id_idx;
drop index if exists public.habitos_user_id_idx;
drop index if exists public.habito_registros_habito_id_idx;
drop index if exists public.inversiones_desgravables_user_id_idx;

-- Comprobación: no debe devolver filas
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in ('cuentas_user_id_idx', 'cuentas_compradas_user_id_idx', 'retiros_user_id_idx',
    'estrategia_criterios_user_id_idx', 'estrategia_checks_criterio_id_idx', 'habitos_user_id_idx',
    'habito_registros_habito_id_idx', 'inversiones_desgravables_user_id_idx');
