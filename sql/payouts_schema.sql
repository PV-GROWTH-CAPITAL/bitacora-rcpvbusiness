-- ============================================================================
-- PAYOUTS: capturas de cada payout cobrado + importe en €.
-- Pegar en el SQL Editor de Supabase. Se puede ejecutar varias veces.
-- El importe en $ no se guarda: ya aparece en la captura.
-- ============================================================================

-- --- TABLA ---
create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cuenta       text not null check (length(trim(cuenta)) > 0),
  importe_eur  numeric(12,2) not null check (importe_eur >= 0),
  fecha        date not null default current_date,
  imagen_path  text not null, -- ruta dentro del bucket: <user_id>/<uuid>.webp
  created_at   timestamptz not null default now()
);

create index if not exists payouts_user_fecha_idx on public.payouts (user_id, fecha desc);

alter table public.payouts enable row level security;

drop policy if exists "payouts_select_propios" on public.payouts;
create policy "payouts_select_propios" on public.payouts
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "payouts_insert_propios" on public.payouts;
create policy "payouts_insert_propios" on public.payouts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "payouts_update_propios" on public.payouts;
create policy "payouts_update_propios" on public.payouts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "payouts_delete_propios" on public.payouts;
create policy "payouts_delete_propios" on public.payouts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- --- BUCKET PRIVADO DE IMÁGENES ---
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payout-images', 'payout-images', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Cada usuario solo accede a su carpeta: payout-images/<user_id>/...
drop policy if exists "payout_images_select_propias" on storage.objects;
create policy "payout_images_select_propias" on storage.objects
  for select to authenticated
  using (bucket_id = 'payout-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "payout_images_insert_propias" on storage.objects;
create policy "payout_images_insert_propias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payout-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "payout_images_update_propias" on storage.objects;
create policy "payout_images_update_propias" on storage.objects
  for update to authenticated
  using (bucket_id = 'payout-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'payout-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "payout_images_delete_propias" on storage.objects;
create policy "payout_images_delete_propias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payout-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
