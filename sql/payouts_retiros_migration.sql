-- ============================================================
-- PAYOUTS ↔ RETIROS: un payout es un retiro con captura opcional
--
-- - `retiros` pasa a ser la única fuente de verdad del cobro (fecha, cuenta,
--   empresa, € recibidos y $). Contabilidad, Cuentas activas y Payouts leen
--   y escriben ahí, así que lo que apuntes en uno aparece en los otros.
-- - `payouts` se queda solo con la captura: `retiro_id` la enlaza a su retiro.
--   Las columnas cuenta / importe_eur / fecha de payouts ya no se usan; se
--   dejan (ahora opcionales) para no borrar nada.
-- - Los payouts que ya tienes se enlazan con el retiro que coincide (misma
--   cuenta, importe a ±0,05 € y fecha a ±3 días), sin crear duplicados. Solo si
--   no existe ningún retiro parecido se crea uno.
-- - Si borras un retiro, su fila de payouts se borra con él (el archivo de la
--   imagen se limpia desde la web cuando borras desde Payouts).
--
-- Es seguro ejecutarlo varias veces.
-- Ejecuta este script en Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.payouts
  add column if not exists retiro_id uuid references public.retiros(id) on delete cascade;

create unique index if not exists payouts_retiro_id_key on public.payouts (retiro_id);

alter table public.payouts alter column cuenta drop not null;
alter table public.payouts alter column importe_eur drop not null;
alter table public.payouts alter column fecha drop not null;
alter table public.payouts alter column fecha drop default;

-- Enlazar los payouts existentes con su retiro (o crear el retiro si no existe).
do $$
declare
  p record;
  r_id uuid;
  prov text;
begin
  for p in
    select * from public.payouts
    where retiro_id is null and cuenta is not null and importe_eur is not null and fecha is not null
    order by created_at
  loop
    r_id := null;

    select r.id into r_id
    from public.retiros r
    where r.user_id = p.user_id
      and r.cuenta = p.cuenta
      and abs(r.monto - p.importe_eur) <= 0.05
      and abs(r.fecha - p.fecha) <= 3
      and not exists (select 1 from public.payouts x where x.retiro_id = r.id)
    order by abs(r.fecha - p.fecha), abs(r.monto - p.importe_eur)
    limit 1;

    if r_id is null then
      select t.proveedor into prov
      from (
        select proveedor, 1 as orden, fecha from public.retiros
          where user_id = p.user_id and cuenta = p.cuenta and proveedor is not null
        union all
        select proveedor, 2 as orden, fecha from public.cuentas_compradas
          where user_id = p.user_id and cuenta = p.cuenta and proveedor is not null
      ) t
      order by t.orden, t.fecha desc
      limit 1;

      insert into public.retiros (user_id, fecha, cuenta, proveedor, monto, notas)
      values (p.user_id, p.fecha, p.cuenta, prov, p.importe_eur, '')
      returning id into r_id;
    end if;

    update public.payouts set retiro_id = r_id where id = p.id;
  end loop;
end $$;

-- Una captura solo puede colgar de un retiro del propio usuario.
drop policy if exists "payouts_insert_propios" on public.payouts;
create policy "payouts_insert_propios" on public.payouts
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (retiro_id is null or exists (
      select 1 from public.retiros r where r.id = retiro_id and r.user_id = (select auth.uid())
    ))
  );

drop policy if exists "payouts_update_propios" on public.payouts;
create policy "payouts_update_propios" on public.payouts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (retiro_id is null or exists (
      select 1 from public.retiros r where r.id = retiro_id and r.user_id = (select auth.uid())
    ))
  );
