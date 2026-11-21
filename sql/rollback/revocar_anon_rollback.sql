-- ============================================================================
-- VUELTA ATRÁS de sql/revocar_anon.sql: devuelve los permisos que Supabase
-- concede por defecto (anon con todo; authenticated con TRUNCATE, TRIGGER y
-- REFERENCES además de los demás).
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================================

grant all on all tables in schema public to anon;
grant all on all sequences in schema public to anon;
alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant all on sequences to anon;

grant truncate, trigger, references on all tables in schema public to authenticated;
alter default privileges for role postgres in schema public grant truncate, trigger, references on tables to authenticated;

-- Comprobación: anon debe volver a salir en las 18 tablas
select count(distinct table_name) as tablas_con_anon
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';
