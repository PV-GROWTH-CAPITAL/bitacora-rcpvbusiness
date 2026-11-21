-- ============================================================================
-- SEGURIDAD 4/5: quitar permisos que la app no usa
--
-- - anon (sin sesión iniciada) tenía TODOS los privilegios en las 18 tablas de
--   public, TRUNCATE incluido. La app nunca consulta tablas sin sesión: la
--   landing y los formularios de entrada, registro y contraseña solo usan
--   supabase.auth, y todas las páginas con datos cuelgan de AppShell, que solo
--   se monta con sesión. Hoy RLS ya le cierra el paso; esto es una segunda
--   barrera por si algún día una tabla nueva sale sin RLS.
-- - authenticated pierde TRUNCATE, TRIGGER y REFERENCES, que la API no usa
--   (TRUNCATE además se salta RLS). Conserva SELECT, INSERT, UPDATE y DELETE.
-- - Las tablas que se creen a partir de ahora desde el SQL Editor (dueño
--   postgres) nacen ya sin esos permisos.
--
-- No toca funciones: borrar_mi_cuenta() ya está cerrada a anon.
-- Orden: después de storage_capturas_politicas.sql (no depende de él).
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Vuelta atrás: sql/rollback/revocar_anon_rollback.sql
-- ============================================================================

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

revoke truncate, trigger, references on all tables in schema public from authenticated;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from authenticated;

-- Comprobación 1: no debe devolver filas
select table_name, string_agg(privilege_type, ', ') as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
group by table_name;

-- Comprobación 2: authenticated solo con DELETE, INSERT, SELECT, UPDATE
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'authenticated'
group by table_name
order by table_name;
