-- ============================================================================
-- TRADES: la clave de importación (origen_id) pasa a ser única POR CUENTA
--
-- Desde la vista previa del importador se puede guardar la misma operación del
-- CSV en varias cuentas a la vez (como «Añadir operación» con varias cuentas).
-- El índice antiguo (user_id, origen_id) no lo permite: la segunda cuenta
-- chocaría. El nuevo (user_id, cuenta, origen_id) sigue impidiendo duplicar
-- una operación dentro de la misma cuenta al reimportar el archivo.
--
-- No toca ninguna fila ni ninguna política. Las operaciones ya importadas
-- siguen detectándose: la web comprueba ahora la pareja (origen_id, cuenta).
--
-- Requiere haber ejecutado antes sql/trades_origen_id.sql.
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Vuelta atrás: sql/rollback/trades_origen_id_por_cuenta_rollback.sql
-- ============================================================================

drop index if exists public.trades_user_origen_id_key;

create unique index if not exists trades_user_cuenta_origen_id_key
  on public.trades (user_id, cuenta, origen_id)
  where origen_id is not null;

-- Para que la API vea el cambio sin esperar
notify pgrst, 'reload schema';

-- Comprobación: debe salir solo trades_user_cuenta_origen_id_key
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'trades'
  and indexname in ('trades_user_origen_id_key', 'trades_user_cuenta_origen_id_key');
