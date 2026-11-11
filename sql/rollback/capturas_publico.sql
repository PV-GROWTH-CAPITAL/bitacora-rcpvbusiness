-- ============================================================
-- VUELTA ATRÁS de sql/capturas_privado.sql:
-- el bucket "capturas" vuelve a ser PÚBLICO.
--
-- SQL Editor > New query > Run
-- ============================================================

update storage.buckets set public = true where id = 'capturas';

-- Comprobación: debe devolver public = true
select id, public from storage.buckets where id = 'capturas';
