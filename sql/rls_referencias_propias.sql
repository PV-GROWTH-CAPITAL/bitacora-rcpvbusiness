-- ============================================================================
-- SEGURIDAD 2/5: una fila solo puede colgar de filas del mismo usuario
--
-- Hasta ahora las políticas solo miraban el user_id de la propia fila. Un
-- usuario que conociera el UUID de una fila ajena podía enlazar la suya a ella:
--   - retiros_cuentas.cuenta_id      → cuentas de otro usuario
--   - habito_registros.habito_id     → hábitos de otro usuario
--   - estrategia_checks.criterio_id  → criterios de otro usuario
-- (estrategia_checks.registro_id y payouts.retiro_id ya se comprobaban.)
-- Esto añade esa comprobación en INSERT y UPDATE, y pasa estrategia_checks a
-- TO authenticated + (select auth.uid()) como el resto.
--
-- Orden: DESPUÉS de rls_tablas_base.sql, que crea las políticas *_propias que
-- este script sustituye en retiros_cuentas y habito_registros.
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- Vuelta atrás: sql/rollback/rls_referencias_propias_rollback.sql
-- ============================================================================

-- --- retiros_cuentas: la cuenta tiene que ser tuya ---
drop policy if exists retiros_cuentas_insert_propias on public.retiros_cuentas;
create policy retiros_cuentas_insert_propias on public.retiros_cuentas
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cuentas c where c.id = cuenta_id and c.user_id = (select auth.uid()))
  );

drop policy if exists retiros_cuentas_update_propias on public.retiros_cuentas;
create policy retiros_cuentas_update_propias on public.retiros_cuentas
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cuentas c where c.id = cuenta_id and c.user_id = (select auth.uid()))
  );

-- --- habito_registros: el hábito tiene que ser tuyo ---
drop policy if exists habito_registros_insert_propias on public.habito_registros;
create policy habito_registros_insert_propias on public.habito_registros
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.habitos h where h.id = habito_id and h.user_id = (select auth.uid()))
  );

drop policy if exists habito_registros_update_propias on public.habito_registros;
create policy habito_registros_update_propias on public.habito_registros
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.habitos h where h.id = habito_id and h.user_id = (select auth.uid()))
  );

-- --- estrategia_checks: registro y criterio tienen que ser tuyos ---
drop policy if exists "Ver mis checks de estrategia" on public.estrategia_checks;
create policy "Ver mis checks de estrategia" on public.estrategia_checks
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Crear mis checks de estrategia" on public.estrategia_checks;
create policy "Crear mis checks de estrategia" on public.estrategia_checks
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.estrategia_registros r where r.id = registro_id and r.user_id = (select auth.uid()))
    and (criterio_id is null
      or exists (select 1 from public.estrategia_criterios c where c.id = criterio_id and c.user_id = (select auth.uid())))
  );

drop policy if exists "Editar mis checks de estrategia" on public.estrategia_checks;
create policy "Editar mis checks de estrategia" on public.estrategia_checks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.estrategia_registros r where r.id = registro_id and r.user_id = (select auth.uid()))
    and (criterio_id is null
      or exists (select 1 from public.estrategia_criterios c where c.id = criterio_id and c.user_id = (select auth.uid())))
  );

drop policy if exists "Borrar mis checks de estrategia" on public.estrategia_checks;
create policy "Borrar mis checks de estrategia" on public.estrategia_checks
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Comprobación: las de INSERT y UPDATE deben llevar "EXISTS" en with_check
select tablename, policyname, cmd, roles::text, with_check
from pg_policies
where schemaname = 'public' and tablename in ('retiros_cuentas', 'habito_registros', 'estrategia_checks')
order by tablename, cmd;
