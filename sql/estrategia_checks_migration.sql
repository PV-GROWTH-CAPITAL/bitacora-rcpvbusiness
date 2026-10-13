-- ============================================================
-- ESTRATEGIA: checks en directo con comentario y captura
--
-- - estrategia_checks (nueva): un check por registro y criterio,
--   guardado en el momento en que lo marcas. Lleva comentario,
--   captura (ruta dentro del bucket "capturas") y hora.
--   · criterio_texto guarda el texto del criterio por si luego lo
--     borras (criterio_id pasa a null y el historial no se pierde).
--   · Al borrar un registro se borran sus checks (cascade). Las
--     imágenes del storage las borra la app.
-- - estrategia_registros.en_curso: true mientras la sesión está
--   abierta (para retomarla si recargas la página). Los registros
--   que ya tienes quedan en false y se ven igual que antes: el
--   jsonb "checks" y "cumplida" se siguen rellenando.
--
-- Es seguro ejecutarlo varias veces y no borra ningún dato.
-- Ejecuta este script en Supabase → SQL Editor → New query → Run
-- ANTES de subir el código nuevo de Estrategia.
-- ============================================================

alter table public.estrategia_registros
  add column if not exists en_curso boolean not null default false;

create table if not exists public.estrategia_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  registro_id uuid not null references public.estrategia_registros (id) on delete cascade,
  criterio_id uuid references public.estrategia_criterios (id) on delete set null,
  criterio_texto text,
  cumplido boolean not null default false,
  comentario text,
  captura_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estrategia_checks_registro_criterio_key unique (registro_id, criterio_id)
);

create index if not exists estrategia_checks_registro_idx on public.estrategia_checks (registro_id);
create index if not exists estrategia_checks_user_idx on public.estrategia_checks (user_id);

-- updated_at se actualiza solo en cada UPDATE.
create or replace function public.estrategia_checks_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists estrategia_checks_updated_at on public.estrategia_checks;
create trigger estrategia_checks_updated_at
  before update on public.estrategia_checks
  for each row execute function public.estrategia_checks_touch_updated_at();

-- RLS: cada usuario solo ve y toca sus checks, y solo puede colgarlos
-- de registros suyos.
alter table public.estrategia_checks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'estrategia_checks' and policyname = 'Ver mis checks de estrategia') then
    create policy "Ver mis checks de estrategia" on public.estrategia_checks
      for select using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'estrategia_checks' and policyname = 'Crear mis checks de estrategia') then
    create policy "Crear mis checks de estrategia" on public.estrategia_checks
      for insert with check (
        user_id = auth.uid()
        and exists (select 1 from public.estrategia_registros r where r.id = registro_id and r.user_id = auth.uid())
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'estrategia_checks' and policyname = 'Editar mis checks de estrategia') then
    create policy "Editar mis checks de estrategia" on public.estrategia_checks
      for update using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (select 1 from public.estrategia_registros r where r.id = registro_id and r.user_id = auth.uid())
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'estrategia_checks' and policyname = 'Borrar mis checks de estrategia') then
    create policy "Borrar mis checks de estrategia" on public.estrategia_checks
      for delete using (user_id = auth.uid());
  end if;
end $$;
