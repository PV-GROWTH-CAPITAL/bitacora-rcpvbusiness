-- ============================================================================
-- VUELTA ATRÁS de sql/empresas_usuario.sql:
-- borra la tabla public.empresas_usuario (con sus políticas e índice).
--
-- Ojo: se pierden las listas de firmas de todos los usuarios (lo que hayan
-- añadido, quitado o reordenado). La contabilidad no se toca: cuentas_compradas
-- y retiros quedan como estaban.
--
-- Ojo: con la web nueva desplegada, el menú de Contabilidad mostrará un error
-- hasta que se vuelva a crear la tabla. Vuelve antes a la versión anterior de
-- la web, o ejecuta de nuevo sql/empresas_usuario.sql.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================================

drop table if exists public.empresas_usuario;

-- Comprobación: no debe devolver filas
select tablename from pg_tables
where schemaname = 'public' and tablename = 'empresas_usuario';
