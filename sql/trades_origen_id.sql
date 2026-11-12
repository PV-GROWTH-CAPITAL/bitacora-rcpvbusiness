-- ============================================================================
-- TRADES: columna origen_id (importador de operaciones desde CSV)
--
-- El botón «Importar» del Journal lee la exportación de la plataforma
-- (Tradovate, TopstepX) y guarda en origen_id una clave por operación:
--   tradovate:<fills de compra>|<fills de venta>     topstepx:<Id>
-- El índice único (user_id, origen_id) impide que reimportar el mismo archivo
-- duplique operaciones. Es parcial: las operaciones apuntadas a mano tienen
-- origen_id vacío (null) y no entran en el índice.
--
-- No toca ninguna fila ni ninguna política: las de trades ya limitan todo a
-- auth.uid() = user_id y valen también para la columna nueva.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Vuelta atrás: sql/rollback/trades_origen_id_rollback.sql
-- ============================================================================

alter table public.trades add column if not exists origen_id text;

create unique index if not exists trades_user_origen_id_key
  on public.trades (user_id, origen_id)
  where origen_id is not null;

-- Para que la API vea la columna nueva sin esperar
notify pgrst, 'reload schema';

-- Comprobación 1: debe salir la columna origen_id (text, nullable)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'trades' and column_name = 'origen_id';

-- Comprobación 2: debe salir el índice único parcial
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'trades' and indexname = 'trades_user_origen_id_key';
