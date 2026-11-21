-- ============================================================================
-- SEGURIDAD 1/5: políticas RLS estándar en las tablas creadas a mano
--
-- Reescribe las políticas de 14 tablas con el mismo patrón que empresas_usuario,
-- perfiles y payouts:
--   - TO authenticated (antes casi todas eran TO public);
--   - (select auth.uid()) en vez de auth.uid() (quita los 59 avisos
--     auth_rls_initplan del advisor de rendimiento);
--   - UPDATE con USING y WITH CHECK (cuentas e inversiones_desgravables no
--     tenían WITH CHECK);
--   - las cuatro políticas en todas (configuracion no tenía DELETE).
-- No cambia quién ve qué: cada usuario sigue viendo y tocando solo sus filas.
--
-- Red de seguridad: si la tabla no tiene exactamente las 55 políticas que se
-- leyeron en bitacora-pruebas el 21/11/2026, el script se para sin tocar nada,
-- porque entonces el rollback no devolvería la base de datos a su estado.
-- Antes de producción, compara con la consulta de sql/LEEME_orden_seguridad.md.
--
-- Orden: va PRIMERO. Después, rls_referencias_propias.sql.
-- SQL Editor > New query > Run. Primero en pruebas y luego en producción.
-- Vuelta atrás: sql/rollback/rls_tablas_base_rollback.sql
-- ============================================================================

do $$
declare
  t text;
  p record;
  n integer;
  tablas text[] := array['trades','cuentas_compradas','retiros','diario_emocional',
    'estrategia_criterios','estrategia_registros','estrategia_sesiones','objetivos',
    'habitos','habito_registros','configuracion','inversiones_desgravables',
    'cuentas','retiros_cuentas'];
begin
  select count(*) into n from pg_policies
  where schemaname = 'public' and tablename = any(tablas);
  if n <> 55 then
    raise exception 'Se esperaban 55 políticas en estas tablas y hay %. No se ha cambiado nada: compara antes con pruebas.', n;
  end if;

  foreach t in array tablas loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);

    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_propias', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_propias', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_propias', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_propias', t);
  end loop;
end $$;

-- Comprobación: 14 filas, cada una con 4 políticas y roles = {authenticated}
select tablename, count(*) as politicas, string_agg(distinct roles::text, ', ') as roles
from pg_policies
where schemaname = 'public'
  and tablename in ('trades','cuentas_compradas','retiros','diario_emocional','estrategia_criterios',
    'estrategia_registros','estrategia_sesiones','objetivos','habitos','habito_registros',
    'configuracion','inversiones_desgravables','cuentas','retiros_cuentas')
group by tablename
order by tablename;
