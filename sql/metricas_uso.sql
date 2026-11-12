-- ============================================================================
-- MÉTRICAS DE USO: usuarios que registran trades, por semana.
--
-- Es solo una consulta de lectura: no crea ni modifica nada (por eso no tiene
-- script de vuelta atrás). Pégala en el SQL Editor cuando quieras ver los datos.
--
-- Una fila por semana (la fecha es el lunes), de la más reciente a la más antigua:
--   usuarios_activos    usuarios distintos que han registrado al menos un trade
--                       esa semana.
--   usuarios_3_semanas  de esos, los que también registraron alguno en cada una
--                       de las dos semanas anteriores (tres semanas seguidas
--                       que terminan en esa).
--
-- La semana sale de trades.created_at (cuándo se apuntó el trade en la
-- Bitácora), no de la fecha de la operación: mide uso real de la herramienta.
-- Las semanas van de lunes a domingo en hora de Madrid.
-- Solo devuelve recuentos: ni correos ni identificadores de usuario.
-- La semana en curso sale incompleta hasta que termina.
-- Las semanas en las que nadie registró nada no aparecen.
-- ============================================================================

with semanas as (
  -- una fila por usuario y semana en la que registró al menos un trade
  select distinct
    user_id,
    date_trunc('week', created_at at time zone 'Europe/Madrid')::date as semana
  from public.trades
  where user_id is not null
    and created_at is not null
)
select
  s.semana,
  count(*) as usuarios_activos,
  count(*) filter (
    where exists (select 1 from semanas a where a.user_id = s.user_id and a.semana = s.semana - 7)
      and exists (select 1 from semanas b where b.user_id = s.user_id and b.semana = s.semana - 14)
  ) as usuarios_3_semanas
from semanas s
group by s.semana
order by s.semana desc;
