-- ============================================================
-- CAPTURAS: el bucket "capturas" pasa a ser PRIVADO.
--
-- Ejecutar SOLO cuando la web ya enseñe las capturas con URLs
-- firmadas (src/capturasUrls.js) y esté comprobado en producción.
-- A partir de aquí las URLs públicas antiguas
-- (…/object/public/capturas/…) dejan de abrir; la app las sigue
-- enseñando porque firma la ruta. No toca archivos ni políticas.
--
-- SQL Editor > New query > Run
-- Vuelta atrás: sql/rollback/capturas_publico.sql
-- ============================================================

update storage.buckets set public = false where id = 'capturas';

-- Comprobación: debe devolver public = false
select id, public from storage.buckets where id = 'capturas';
