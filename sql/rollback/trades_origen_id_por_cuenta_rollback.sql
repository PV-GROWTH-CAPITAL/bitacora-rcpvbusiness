-- ============================================================================
-- VUELTA ATRÁS de sql/trades_origen_id_por_cuenta.sql:
-- vuelve al índice único (user_id, origen_id), sin la cuenta.
--
-- Ojo: si ya has importado la misma operación en varias cuentas, el índice
-- antiguo no se puede crear (error 23505) y el script se para antes de borrar
-- nada. Primero ejecuta la consulta 1 para verlas y decide qué hacer con ellas
-- (por ejemplo, vaciar origen_id en las copias que sobren).
--
-- Ojo: con la web nueva desplegada, importar en varias cuentas dará error
-- hasta que se vuelva a ejecutar sql/trades_origen_id_por_cuenta.sql.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================================

-- Consulta 1 (solo lectura): operaciones importadas en más de una cuenta.
-- Si devuelve filas, el paso siguiente fallará.
select user_id, origen_id, count(*) as cuentas, string_agg(cuenta, ', ') as en
from public.trades
where origen_id is not null
group by user_id, origen_id
having count(*) > 1;

-- Se crea primero el índice antiguo: si falla, el nuevo sigue en su sitio.
create unique index if not exists trades_user_origen_id_key
  on public.trades (user_id, origen_id)
  where origen_id is not null;

drop index if exists public.trades_user_cuenta_origen_id_key;

notify pgrst, 'reload schema';

-- Comprobación: debe salir solo trades_user_origen_id_key
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'trades'
  and indexname in ('trades_user_origen_id_key', 'trades_user_cuenta_origen_id_key');
