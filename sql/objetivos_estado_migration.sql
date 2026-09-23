-- ============================================================
-- OBJETIVOS: añade estado "fallido" además de "logrado"
--
-- Hasta ahora los objetivos sin meta en $ solo tenían un checkbox
-- (completado sí/no). Esto añade un estado de tres valores:
-- pendiente / logrado / fallido, y migra los datos que ya tenías.
--
-- Ejecuta este script en Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.objetivos
  add column if not exists estado text not null default 'pendiente';

alter table public.objetivos
  add constraint objetivos_estado_check
  check (estado in ('pendiente', 'logrado', 'fallido'));

-- Migra lo que ya tenías marcado como completado a "logrado"
update public.objetivos
set estado = 'logrado'
where completado = true and estado = 'pendiente';
