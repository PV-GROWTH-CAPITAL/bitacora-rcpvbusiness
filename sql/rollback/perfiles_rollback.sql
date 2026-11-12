-- ============================================================================
-- VUELTA ATRÁS de sql/perfiles.sql:
-- borra la tabla public.perfiles (con sus políticas y su disparador) y la
-- función public.perfiles_fijar_fechas().
--
-- Ojo: se pierde quién había aceptado recibir correos y desde cuándo. Si hace
-- falta conservarlo como prueba del consentimiento, exporta antes la tabla.
--
-- Ojo: con la web nueva desplegada, el botón "Correos de novedades" queda
-- deshabilitado y "Descargar mis datos" da error hasta que se vuelva a crear
-- la tabla. Vuelve antes a la versión anterior de la web, o ejecuta de nuevo
-- sql/perfiles.sql.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================================

drop table if exists public.perfiles;
drop function if exists public.perfiles_fijar_fechas();

-- Comprobación: ninguna de las dos consultas debe devolver filas
select tablename from pg_tables
where schemaname = 'public' and tablename = 'perfiles';

select proname from pg_proc
where proname = 'perfiles_fijar_fechas' and pronamespace = 'public'::regnamespace;
