-- ============================================================
-- INVERSIONES DESGRAVABLES: la FK user_id → auth.users pasa a
-- borrar en cascada.
--
-- Sin esto, borrar un usuario que tenga filas en
-- inversiones_desgravables falla con el error 23503. Es la única
-- tabla que no borraba en cascada. Hace falta para "Eliminar
-- cuenta" (sql/borrar_mi_cuenta.sql).
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Vuelta atrás: sql/rollback/inversiones_desgravables_fk_sin_cascade.sql
-- ============================================================

begin;

alter table public.inversiones_desgravables
  drop constraint if exists inversiones_desgravables_user_id_fkey;

alter table public.inversiones_desgravables
  add constraint inversiones_desgravables_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

commit;

-- Comprobación: confdeltype debe ser 'c' (cascade)
select conname, confdeltype
from pg_constraint
where conname = 'inversiones_desgravables_user_id_fkey'
  and conrelid = 'public.inversiones_desgravables'::regclass;
