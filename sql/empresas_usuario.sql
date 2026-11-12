-- ============================================================================
-- FIRMAS DE FONDEO POR USUARIO: tabla public.empresas_usuario
--
-- Sustituye a las listas fijas de firmas que había en la web. De aquí leen el
-- submenú de Contabilidad, la tabla "Desglose por empresas" y el formulario
-- de Payouts. Cada usuario tiene su lista y su orden.
--
-- Incluye la migración de los usuarios que ya existen (ver más abajo).
-- No toca cuentas_compradas ni retiros: no renombra ni normaliza nada.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Vuelta atrás: sql/rollback/empresas_usuario_rollback.sql
-- ============================================================================

-- --- TABLA ---
create table if not exists public.empresas_usuario (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null check (length(btrim(nombre)) > 0),
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint empresas_usuario_user_nombre_key unique (user_id, nombre)
);

create index if not exists empresas_usuario_user_orden_idx on public.empresas_usuario (user_id, orden);

-- --- RLS: cada usuario solo ve y toca sus filas ---
alter table public.empresas_usuario enable row level security;

drop policy if exists "empresas_usuario_select_propias" on public.empresas_usuario;
create policy "empresas_usuario_select_propias" on public.empresas_usuario
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "empresas_usuario_insert_propias" on public.empresas_usuario;
create policy "empresas_usuario_insert_propias" on public.empresas_usuario
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "empresas_usuario_update_propias" on public.empresas_usuario;
create policy "empresas_usuario_update_propias" on public.empresas_usuario
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "empresas_usuario_delete_propias" on public.empresas_usuario;
create policy "empresas_usuario_delete_propias" on public.empresas_usuario
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- --- MIGRACIÓN DE LOS USUARIOS QUE YA EXISTEN ---
-- A cada usuario que ya tiene contabilidad (filas en cuentas_compradas o en
-- retiros) y todavía no tiene lista, se le crea con:
--   1) las 11 firmas de la lista fija de siempre, en su mismo orden (1-11);
--   2) detrás, por orden alfabético, cualquier otro proveedor que tenga
--      guardado, con el texto exacto con el que está guardado.
-- Los usuarios sin contabilidad se quedan sin filas: eligen sus firmas en la
-- bienvenida. Al repetir el script no se vuelve a tocar a quien ya tiene lista
-- (así no reaparecen las firmas que haya quitado).
with fijas (nombre, orden) as (
  values
    ('MY FUNDED FUTURES', 1),
    ('APEX', 2),
    ('LUCID TRADING', 3),
    ('TOPSTEP', 4),
    ('FUNDING PIPS', 5),
    ('FUNDED NEXT', 6),
    ('ALPHA CAPITAL', 7),
    ('TRADEIFY', 8),
    ('FTMO', 9),
    ('5ERS', 10),
    ('NYS MARKETS', 11)
),
proveedores as (
  select user_id, proveedor from public.cuentas_compradas where user_id is not null
  union
  select user_id, proveedor from public.retiros where user_id is not null
),
usuarios as (
  select distinct p.user_id
  from proveedores p
  where not exists (select 1 from public.empresas_usuario e where e.user_id = p.user_id)
),
extras as (
  select
    p.user_id,
    p.proveedor as nombre,
    11 + row_number() over (partition by p.user_id order by p.proveedor) as orden
  from proveedores p
  join usuarios u on u.user_id = p.user_id
  where p.proveedor is not null
    and btrim(p.proveedor) <> ''
    -- la web ya trata "apex" y " APEX " como APEX: no se duplican en el menú
    and upper(btrim(p.proveedor)) not in (select nombre from fijas)
)
insert into public.empresas_usuario (user_id, nombre, orden)
select u.user_id, f.nombre, f.orden from usuarios u cross join fijas f
union all
select x.user_id, x.nombre, x.orden from extras x
on conflict (user_id, nombre) do nothing;

-- Comprobación 1: deben salir las 4 políticas (SELECT, INSERT, UPDATE, DELETE)
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'empresas_usuario'
order by cmd;

-- Comprobación 2: lista de cada usuario, en orden
select u.email, count(*) as firmas, string_agg(e.nombre, ', ' order by e.orden) as lista
from public.empresas_usuario e
join auth.users u on u.id = e.user_id
group by u.email
order by u.email;
