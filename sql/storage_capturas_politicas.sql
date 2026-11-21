-- ============================================================================
-- SEGURIDAD 3/5: bucket "capturas" con límites y políticas como payout-images
--
-- - Límite de 10 MB por archivo y solo imágenes de mapa de bits:
--   webp, jpeg, png, gif, heic y heif. Fuera SVG (puede llevar scripts) y
--   cualquier otro tipo. Hoy no había ningún límite.
--     · Estrategia ya sube WebP o JPEG comprimidos (1600 px de ancho como mucho).
--     · El Journal sube el archivo original tal cual (accept="image/*"), así
--       que puede llegar HEIC: desde el Mac, o desde el iPhone si se elige en
--       «Archivos» en vez de en «Fototeca». Por eso heic/heif se permiten.
--   Solo afecta a las subidas nuevas: lo que ya está subido no se toca.
-- - Políticas: TO authenticated, (select auth.uid()) y UPDATE con WITH CHECK.
--   Cada usuario sigue accediendo solo a capturas/<su user_id>/...
-- - El bucket sigue privado (ya lo era).
--
-- Orden: después de rls_referencias_propias.sql (no depende de él).
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Vuelta atrás: sql/rollback/storage_capturas_politicas_rollback.sql
-- ============================================================================

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/heic', 'image/heif']
where id = 'capturas';

drop policy if exists "Ver mis capturas" on storage.objects;
create policy "Ver mis capturas" on storage.objects
  for select to authenticated
  using (bucket_id = 'capturas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Subir mis capturas" on storage.objects;
create policy "Subir mis capturas" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'capturas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Actualizar mis capturas" on storage.objects;
create policy "Actualizar mis capturas" on storage.objects
  for update to authenticated
  using (bucket_id = 'capturas' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'capturas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Borrar mis capturas" on storage.objects;
create policy "Borrar mis capturas" on storage.objects
  for delete to authenticated
  using (bucket_id = 'capturas' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Comprobación 1: public = false, file_size_limit = 10485760 y la lista de tipos
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'capturas';

-- Comprobación 2: 4 políticas, todas {authenticated}
select policyname, cmd, roles::text
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like '%mis capturas'
order by cmd;
