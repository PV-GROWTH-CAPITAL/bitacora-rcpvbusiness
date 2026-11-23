---
name: nueva-tabla
description: Genera el SQL de una tabla nueva de la Bitácora con user_id, RLS y sus cuatro políticas, más su script de vuelta atrás en sql/rollback/. Solo cuando René escribe /nueva-tabla.
argument-hint: <nombre_tabla> [columnas, p. ej. "titulo text not null, importe numeric"]
disable-model-invocation: true
---

# /nueva-tabla

Crea dos archivos para una tabla nueva de la Bitácora: `sql/<nombre>.sql` y `sql/rollback/<nombre>_rollback.sql`. **No ejecutes nada** contra Supabase (ni MCP `execute_sql` / `apply_migration`, ni CLI, ni `curl`): René los pega a mano, primero en el proyecto de pruebas y luego en producción.

Argumentos recibidos: `$ARGUMENTS`

## 1. Entender lo que se pide

- **Nombre**: el primer argumento. Debe ser `snake_case`, en minúsculas, sin tildes ni `ñ` (`[a-z][a-z0-9_]*`). Si no lo es o falta, pregunta antes de seguir.
- **Columnas**: el resto, en sintaxis SQL (`nombre tipo [restricciones]`) o descritas con palabras; tradúcelas a SQL de Postgres. Si no hay ninguna, pregunta qué columnas quiere o genera solo las fijas si te lo confirma.
- Si ya existe `sql/<nombre>.sql` o la tabla aparece en algún `create table` de `sql/`, avisa y no sobrescribas.
- Nombres de columnas y comentarios en español de España.

## 2. Columnas fijas (siempre, en este orden)

```sql
id          uuid primary key default gen_random_uuid(),
user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
-- columnas pedidas aquí
created_at  timestamptz not null default now()
```

No añadas columnas que no se hayan pedido (ni `updated_at`, ni `orden`) salvo que René lo diga. Nada escrito a fuego para un usuario concreto: ni correos, ni firmas, ni instrumentos en `default` o `check`.

## 3. `sql/<nombre>.sql`

Sigue esta plantilla (estilo de `sql/empresas_usuario.sql`). Sustituye `<nombre>` y rellena la descripción:

```sql
-- ============================================================================
-- <TÍTULO EN MAYÚSCULAS>: tabla public.<nombre>
--
-- <Para qué sirve, en una o dos frases. Qué pantalla la usa.>
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Primero en el proyecto de pruebas; después, en producción.
-- Vuelta atrás: sql/rollback/<nombre>_rollback.sql
-- ============================================================================

-- --- TABLA ---
create table if not exists public.<nombre> (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  <columnas pedidas>,
  created_at  timestamptz not null default now()
);

create index if not exists <nombre>_user_id_idx on public.<nombre> (user_id);

-- --- RLS: cada usuario solo ve y toca sus filas ---
alter table public.<nombre> enable row level security;

drop policy if exists "<nombre>_select_propias" on public.<nombre>;
create policy "<nombre>_select_propias" on public.<nombre>
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "<nombre>_insert_propias" on public.<nombre>;
create policy "<nombre>_insert_propias" on public.<nombre>
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "<nombre>_update_propias" on public.<nombre>;
create policy "<nombre>_update_propias" on public.<nombre>
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "<nombre>_delete_propias" on public.<nombre>;
create policy "<nombre>_delete_propias" on public.<nombre>
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- --- PERMISOS: solo usuarios con sesión (anon no entra) ---
revoke all on public.<nombre> from anon;
grant select, insert, update, delete on public.<nombre> to authenticated;

-- Comprobación 1: RLS activado (debe salir true)
select relrowsecurity as rls_activado
from pg_class
where oid = 'public.<nombre>'::regclass;

-- Comprobación 2: deben salir las 4 políticas (DELETE, INSERT, SELECT, UPDATE)
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = '<nombre>'
order by cmd;
```

Si alguna columna pedida referencia otra tabla del usuario (por ejemplo `cuenta_id uuid references public.cuentas(id)`), añade un índice para esa columna y avisa en el resumen de que la política de `insert` no comprueba que la fila referenciada sea del mismo usuario (ver `sql/rls_referencias_propias.sql` como modelo si hace falta).

## 4. `sql/rollback/<nombre>_rollback.sql`

```sql
-- ============================================================================
-- VUELTA ATRÁS de sql/<nombre>.sql:
-- borra la tabla public.<nombre> (con sus políticas e índices).
--
-- Ojo: se pierden todas las filas de todos los usuarios de esta tabla.
-- Si la web ya usa la tabla, vuelve antes a la versión anterior de la web.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================================

drop table if exists public.<nombre>;

-- Comprobación: no debe devolver filas
select tablename from pg_tables
where schemaname = 'public' and tablename = '<nombre>';
```

## 5. Antes de terminar

Relee los dos archivos y comprueba:
- `user_id` con `not null`, `default auth.uid()` y `references auth.users(id) on delete cascade`.
- `enable row level security` presente.
- Cuatro políticas, `to authenticated`, con `(select auth.uid()) = user_id`; `update` con `using` y `with check`.
- El rollback se llama exactamente `sql/rollback/<nombre>_rollback.sql`.

## 6. Cierre (siempre, con esta lista)

Di qué dos archivos has creado y termina con esta lista de comprobación, tal cual:

```
Lista de comprobación
[ ] Pégalo primero en el proyecto de pruebas (SQL Editor > New query > Run).
[ ] Comprueba que la consulta 1 devuelve true y la 2 las cuatro políticas.
[ ] Prueba con dos usuarios: cada uno solo ve, crea, edita y borra sus filas.
[ ] Ten a mano sql/rollback/<nombre>_rollback.sql por si hay que volver atrás.
[ ] Solo entonces, pégalo en producción.
[ ] Si la web va a usar la tabla: cambios en rama nueva y PR en borrador.
```

No hagas commit ni abras PR.
