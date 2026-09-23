-- ============================================================
-- CAPTURAS DE OPERACIONES: sube la imagen tal cual en vez de
-- solo pegar un enlace.
--
-- PASO 1 (hazlo primero, a mano): crea el bucket de almacenamiento
--   Supabase → menú lateral "Storage" → "New bucket"
--   Nombre: capturas
--   Public bucket: ACTIVADO (para que las imágenes se puedan ver
--   directamente en la web)
--   → Create bucket
--
-- PASO 2: ejecuta este script en SQL Editor > New query > Run
-- ============================================================

alter table public.trades add column if not exists captura_url text;

create policy "Ver mis capturas"
on storage.objects for select
using (bucket_id = 'capturas' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Subir mis capturas"
on storage.objects for insert
with check (bucket_id = 'capturas' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Actualizar mis capturas"
on storage.objects for update
using (bucket_id = 'capturas' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Borrar mis capturas"
on storage.objects for delete
using (bucket_id = 'capturas' and (storage.foldername(name))[1] = auth.uid()::text);
