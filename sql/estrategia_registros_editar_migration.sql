-- ============================================================
-- ESTRATEGIA: permite editar y borrar registros del historial
--
-- La tabla estrategia_registros se creó a mano y hasta ahora la app
-- solo leía e insertaba. Si tus políticas RLS no cubren UPDATE y
-- DELETE, Supabase no da error pero no toca ninguna fila. Este script
-- crea esas dos políticas solo si todavía no existe ninguna que las
-- cubra (propia de UPDATE/DELETE o una "ALL").
--
-- Es seguro ejecutarlo varias veces y no borra ningún dato.
-- Ejecuta este script en Supabase → SQL Editor → New query → Run
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'estrategia_registros' and cmd in ('UPDATE', 'ALL')
  ) then
    create policy "Actualizar mis registros de estrategia" on public.estrategia_registros
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'estrategia_registros' and cmd in ('DELETE', 'ALL')
  ) then
    create policy "Borrar mis registros de estrategia" on public.estrategia_registros
      for delete using (user_id = auth.uid());
  end if;
end $$;
