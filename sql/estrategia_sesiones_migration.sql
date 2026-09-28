-- ============================================================
-- ESTRATEGIA: checklists y "regla de oro" por sesión
-- (LONDON / NEW YORK)
--
-- - estrategia_criterios.sesion: 'london' | 'new_york'. Cada sesión
--   tiene su propio checklist. Los requisitos que ya tenías pasan a
--   LONDON y se copian a NEW YORK (luego editas cada uno por separado).
-- - estrategia_registros.sesion: sesión en la que se guardó el
--   registro. Los registros antiguos quedan vacíos (null) y siguen
--   contando en Estadísticas e Informes.
-- - estrategia_sesiones (nueva): la "regla de oro" de cada sesión,
--   una fila por usuario y sesión.
--
-- Es seguro ejecutarlo varias veces y no borra ningún dato.
-- Ejecuta este script en Supabase → SQL Editor → New query → Run
-- ANTES de subir el código nuevo de Estrategia.
-- ============================================================

alter table public.estrategia_criterios
  add column if not exists sesion text;

alter table public.estrategia_registros
  add column if not exists sesion text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'estrategia_criterios_sesion_check') then
    alter table public.estrategia_criterios
      add constraint estrategia_criterios_sesion_check
      check (sesion is null or sesion in ('london', 'new_york'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'estrategia_registros_sesion_check') then
    alter table public.estrategia_registros
      add constraint estrategia_registros_sesion_check
      check (sesion is null or sesion in ('london', 'new_york'));
  end if;
end $$;

-- Copia los requisitos sin sesión a NEW YORK y deja los originales en
-- LONDON (conservan su id, así el historial antiguo sigue cuadrando).
-- Al volver a ejecutarlo ya no quedan filas sin sesión: no duplica nada.
insert into public.estrategia_criterios (user_id, texto, orden, sesion)
select user_id, texto, orden, 'new_york'
from public.estrategia_criterios
where sesion is null;

update public.estrategia_criterios
set sesion = 'london'
where sesion is null;

-- Regla de oro por sesión
create table if not exists public.estrategia_sesiones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sesion text not null check (sesion in ('london', 'new_york')),
  regla_oro text,
  updated_at timestamptz not null default now(),
  unique (user_id, sesion)
);

alter table public.estrategia_sesiones enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'estrategia_sesiones' and policyname = 'Ver mis sesiones') then
    create policy "Ver mis sesiones" on public.estrategia_sesiones
      for select using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'estrategia_sesiones' and policyname = 'Crear mis sesiones') then
    create policy "Crear mis sesiones" on public.estrategia_sesiones
      for insert with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'estrategia_sesiones' and policyname = 'Actualizar mis sesiones') then
    create policy "Actualizar mis sesiones" on public.estrategia_sesiones
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'estrategia_sesiones' and policyname = 'Borrar mis sesiones') then
    create policy "Borrar mis sesiones" on public.estrategia_sesiones
      for delete using (user_id = auth.uid());
  end if;
end $$;
