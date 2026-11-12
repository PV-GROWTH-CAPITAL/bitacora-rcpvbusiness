-- ============================================================
-- VUELTA ATRÁS de sql/borrar_mi_cuenta.sql:
-- quita la función public.borrar_mi_cuenta().
--
-- Ojo: el botón "Eliminar cuenta" de la web dará error (la cuenta
-- no se borra) hasta que se vuelva a crear.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================

drop function if exists public.borrar_mi_cuenta();

-- Comprobación: no debe devolver filas
select proname from pg_proc
where proname = 'borrar_mi_cuenta' and pronamespace = 'public'::regnamespace;
