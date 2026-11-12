-- ============================================================================
-- VUELTA ATRÁS de sql/trades_origen_id.sql:
-- borra el índice único y la columna origen_id de public.trades.
--
-- Ojo: las operaciones importadas NO se borran, pero pierden su clave de
-- origen. Si después se vuelve a crear la columna, la web ya no sabrá que
-- esas operaciones estaban importadas y reimportar el mismo archivo las
-- duplicará.
--
-- Ojo: con la web nueva desplegada, el botón «Importar» dará error hasta que
-- se vuelva a crear la columna (el resto del Journal sigue funcionando).
-- Vuelve antes a la versión anterior de la web, o ejecuta de nuevo
-- sql/trades_origen_id.sql.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================================

drop index if exists public.trades_user_origen_id_key;

alter table public.trades drop column if exists origen_id;

notify pgrst, 'reload schema';

-- Comprobación: no debe devolver filas
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'trades' and column_name = 'origen_id';
