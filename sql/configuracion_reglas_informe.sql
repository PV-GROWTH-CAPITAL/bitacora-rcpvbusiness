-- «Mis reglas» de Informes: guarda por usuario los ajustes del semáforo de reglas que no tenían
-- columna propia (días de espera tras un retiro y tras quemar una funded, máximo de cuentas por
-- sesión y horario de las sesiones). El % de riesgo y el mínimo ya viven en riesgo_pct_funded y
-- riesgo_minimo (sql/cuentas_riesgo_migration.sql).
--
-- Es una columna más en `configuracion` (una fila por usuario, clave primaria user_id). La tabla
-- ya tiene RLS activado y sus políticas limitadas a auth.uid() = user_id, así que la columna nueva
-- queda protegida igual que las demás: cada usuario solo lee y escribe sus propias reglas.
--
-- Sin esta migración la app funciona igual: el informe usa los valores por defecto y «Mis reglas»
-- solo deja cambiar el riesgo.
--
-- Forma del jsonb (todas las claves son opcionales; lo que falte usa el valor por defecto):
--   { "diasTrasRetiro": 5, "diasTrasQuemarFunded": 1,
--     "maxCuentasLondres": 2, "maxCuentasNuevaYork": 2,
--     "londresDesde": "03:00", "londresHasta": "04:30",
--     "nuevaYorkDesde": "09:30", "nuevaYorkHasta": "10:45", "corteSesiones": "07:00" }
--
-- Pegar en el SQL Editor: primero en el proyecto de pruebas y, si va bien, en producción.
-- Vuelta atrás: sql/rollback/configuracion_reglas_informe_rollback.sql

alter table public.configuracion
  add column if not exists reglas_informe jsonb;

comment on column public.configuracion.reglas_informe is
  'Ajustes de «Mis reglas» de Informes (días de espera tras retiro y tras quemar una funded, cuentas por sesión y horarios). null = valores por defecto.';

-- Comprobación (solo lectura): debe salir la columna nueva y rls_activado = true.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'configuracion' and column_name = 'reglas_informe') as columna_creada,
  (select relrowsecurity from pg_class where oid = 'public.configuracion'::regclass) as rls_activado,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'configuracion') as politicas;
