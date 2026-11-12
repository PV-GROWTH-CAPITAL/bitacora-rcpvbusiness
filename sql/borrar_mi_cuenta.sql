-- ============================================================
-- ELIMINAR CUENTA: función public.borrar_mi_cuenta()
--
-- La llama la web (supabase.rpc("borrar_mi_cuenta")) cuando el
-- usuario elimina su cuenta. Borra SOLO al usuario que la llama
-- (auth.uid()); no admite parámetros. Sus filas se van con él por
-- las FK en cascada.
--
-- Los archivos de Storage NO se borran solos: la web los borra
-- antes de llamar aquí. Si todavía queda alguno, la función se
-- niega y la cuenta no se borra.
--
-- Antes: sql/inversiones_desgravables_fk_cascade.sql
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Vuelta atrás: sql/rollback/borrar_mi_cuenta_rollback.sql
-- ============================================================

create or replace function public.borrar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No hay sesión iniciada';
  end if;

  -- Red de seguridad: si aún quedan archivos suyos, no se borra la cuenta.
  if exists (
    select 1
    from storage.objects
    where bucket_id in ('capturas', 'payout-images')
      and (storage.foldername(name))[1] = uid::text
  ) then
    raise exception 'ARCHIVOS_PENDIENTES';
  end if;

  delete from auth.users where id = uid;
end;
$$;

-- Solo la pueden ejecutar usuarios con sesión iniciada.
revoke all on function public.borrar_mi_cuenta() from public, anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;

-- Comprobación: debe salir "authenticated" y NO deben salir "anon" ni "PUBLIC"
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public' and routine_name = 'borrar_mi_cuenta'
order by grantee;
