-- ============================================================================
-- SEGURIDAD 5/5 (rendimiento): índices para las claves foráneas sin índice
--
-- El advisor de rendimiento marca 8 claves foráneas sin índice
-- (unindexed_foreign_keys). Con usuarios externos, cada consulta filtra por
-- user_id (RLS) y cada borrado en cascada (Eliminar cuenta) recorre estas
-- columnas: sin índice, Postgres lee la tabla entera.
-- No cambia datos ni permisos. Las tablas son pequeñas, así que se crean sin
-- CONCURRENTLY (bloquean escrituras en la tabla un instante).
--
-- Orden: el último. No depende de los anteriores.
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Vuelta atrás: sql/rollback/indices_fk_rollback.sql
-- ============================================================================

create index if not exists cuentas_user_id_idx                  on public.cuentas (user_id);
create index if not exists cuentas_compradas_user_id_idx        on public.cuentas_compradas (user_id);
create index if not exists retiros_user_id_idx                  on public.retiros (user_id);
create index if not exists estrategia_criterios_user_id_idx     on public.estrategia_criterios (user_id);
create index if not exists estrategia_checks_criterio_id_idx    on public.estrategia_checks (criterio_id);
create index if not exists habitos_user_id_idx                  on public.habitos (user_id);
create index if not exists habito_registros_habito_id_idx       on public.habito_registros (habito_id);
create index if not exists inversiones_desgravables_user_id_idx on public.inversiones_desgravables (user_id);

-- Comprobación: deben salir los 8 índices
select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and indexname in ('cuentas_user_id_idx', 'cuentas_compradas_user_id_idx', 'retiros_user_id_idx',
    'estrategia_criterios_user_id_idx', 'estrategia_checks_criterio_id_idx', 'habitos_user_id_idx',
    'habito_registros_habito_id_idx', 'inversiones_desgravables_user_id_idx')
order by tablename;
