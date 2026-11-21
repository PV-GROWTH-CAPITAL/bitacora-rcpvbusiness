-- ============================================================================
-- VUELTA ATRÁS de sql/rls_referencias_propias.sql
--
-- - retiros_cuentas y habito_registros vuelven a las políticas que deja
--   rls_tablas_base.sql (solo comprueban el user_id de la propia fila).
-- - estrategia_checks vuelve a las de sql/estrategia_checks_migration.sql
--   (TO public, auth.uid() sin select, sin comprobar criterio_id).
--
-- Si vas a deshacer también rls_tablas_base.sql, ejecuta antes este.
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================================

drop policy if exists retiros_cuentas_insert_propias on public.retiros_cuentas;
create policy retiros_cuentas_insert_propias on public.retiros_cuentas
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists retiros_cuentas_update_propias on public.retiros_cuentas;
create policy retiros_cuentas_update_propias on public.retiros_cuentas
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists habito_registros_insert_propias on public.habito_registros;
create policy habito_registros_insert_propias on public.habito_registros
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists habito_registros_update_propias on public.habito_registros;
create policy habito_registros_update_propias on public.habito_registros
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Ver mis checks de estrategia" on public.estrategia_checks;
create policy "Ver mis checks de estrategia" on public.estrategia_checks
  for select using (user_id = auth.uid());

drop policy if exists "Crear mis checks de estrategia" on public.estrategia_checks;
create policy "Crear mis checks de estrategia" on public.estrategia_checks
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.estrategia_registros r where r.id = registro_id and r.user_id = auth.uid())
  );

drop policy if exists "Editar mis checks de estrategia" on public.estrategia_checks;
create policy "Editar mis checks de estrategia" on public.estrategia_checks
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.estrategia_registros r where r.id = registro_id and r.user_id = auth.uid())
  );

drop policy if exists "Borrar mis checks de estrategia" on public.estrategia_checks;
create policy "Borrar mis checks de estrategia" on public.estrategia_checks
  for delete using (user_id = auth.uid());

-- Comprobación: estrategia_checks con roles {public}; ninguna de retiros_cuentas
-- ni habito_registros con "EXISTS"
select tablename, policyname, cmd, roles::text, with_check
from pg_policies
where schemaname = 'public' and tablename in ('retiros_cuentas', 'habito_registros', 'estrategia_checks')
order by tablename, cmd;
