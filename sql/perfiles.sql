-- ============================================================================
-- PERFILES: tabla public.perfiles (una fila por usuario)
--
-- De momento guarda una sola cosa: si el usuario acepta recibir por correo
-- novedades de la Bitácora y contenido de RCPV Business (casilla opcional del
-- registro y de "Mi cuenta"), y desde cuándo.
--
-- La fila la crea la web en el primer acceso de cada usuario:
--   - quien marcó la casilla al registrarse nace con true;
--   - los demás, y todos los que ya tenían cuenta, nacen con false.
-- Por eso este script no crea filas para los usuarios que ya existen.
--
-- acepta_correos_at la pone SIEMPRE la base de datos (disparador de abajo):
-- lo que mande el navegador en esa columna se ignora.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Vuelta atrás: sql/rollback/perfiles_rollback.sql
-- ============================================================================

-- --- TABLA ---
create table if not exists public.perfiles (
  user_id            uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  acepta_correos     boolean not null default false,
  acepta_correos_at  timestamptz, -- último cambio de la casilla; null si nunca ha aceptado
  created_at         timestamptz not null default now()
);

-- --- RLS: cada usuario solo ve y toca su fila ---
alter table public.perfiles enable row level security;

drop policy if exists "perfiles_select_propio" on public.perfiles;
create policy "perfiles_select_propio" on public.perfiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "perfiles_insert_propio" on public.perfiles;
create policy "perfiles_insert_propio" on public.perfiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "perfiles_delete_propio" on public.perfiles;
create policy "perfiles_delete_propio" on public.perfiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- --- DISPARADOR: las fechas no se pueden tocar desde el navegador ---
-- Al insertar: acepta_correos_at = ahora si acepta_correos es true, null si no
--              (se ignora lo que llegue). created_at = ahora.
-- Al actualizar: si acepta_correos no cambia, se conserva la fecha anterior;
--              si cambia, pasa a ser ahora. user_id y created_at no cambian.
create or replace function public.perfiles_fijar_fechas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.acepta_correos_at := case when new.acepta_correos then now() else null end;
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    if new.acepta_correos is distinct from old.acepta_correos then
      new.acepta_correos_at := now();
    else
      new.acepta_correos_at := old.acepta_correos_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_fijar_fechas on public.perfiles;
create trigger perfiles_fijar_fechas
  before insert or update on public.perfiles
  for each row execute function public.perfiles_fijar_fechas();

-- Comprobación 1: deben salir las 4 políticas (SELECT, INSERT, UPDATE, DELETE)
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'perfiles'
order by cmd;

-- Comprobación 2: debe salir el disparador perfiles_fijar_fechas (INSERT y UPDATE)
select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where event_object_schema = 'public' and event_object_table = 'perfiles'
order by event_manipulation;
