-- ============================================================
-- VUELTA ATRÁS de sql/inversiones_desgravables_fk_cascade.sql:
-- la FK user_id → auth.users vuelve a NO borrar en cascada.
--
-- Ojo: con esto, "Eliminar cuenta" vuelve a fallar para quien
-- tenga filas en inversiones_desgravables.
--
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================

begin;

alter table public.inversiones_desgravables
  drop constraint if exists inversiones_desgravables_user_id_fkey;

alter table public.inversiones_desgravables
  add constraint inversiones_desgravables_user_id_fkey
  foreign key (user_id) references auth.users(id);

commit;

-- Comprobación: confdeltype debe ser 'a' (no action)
select conname, confdeltype
from pg_constraint
where conname = 'inversiones_desgravables_user_id_fkey'
  and conrelid = 'public.inversiones_desgravables'::regclass;
