-- ============================================================================
-- VUELTA ATRÁS de sql/storage_capturas_politicas.sql
--
-- Quita los límites de tamaño y tipo del bucket "capturas" y deja sus
-- políticas como en sql/capturas_schema.sql (TO public, sin WITH CHECK en
-- UPDATE). El bucket sigue PRIVADO: para hacerlo público está
-- sql/rollback/capturas_publico.sql, y no hace falta.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================================

update storage.buckets
set file_size_limit = null,
    allowed_mime_types = null
where id = 'capturas';

drop policy if exists "Ver mis capturas" on storage.objects;
create policy "Ver mis capturas" on storage.objects
  for select
  using (bucket_id = 'capturas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Subir mis capturas" on storage.objects;
create policy "Subir mis capturas" on storage.objects
  for insert
  with check (bucket_id = 'capturas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Actualizar mis capturas" on storage.objects;
create policy "Actualizar mis capturas" on storage.objects
  for update
  using (bucket_id = 'capturas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Borrar mis capturas" on storage.objects;
create policy "Borrar mis capturas" on storage.objects
  for delete
  using (bucket_id = 'capturas' and (storage.foldername(name))[1] = auth.uid()::text);

-- Comprobación: file_size_limit y allowed_mime_types a null; public = false
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'capturas';
