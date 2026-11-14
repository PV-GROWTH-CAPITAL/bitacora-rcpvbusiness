-- Vuelta atrás de sql/configuracion_reglas_informe.sql.
-- Borra los ajustes de «Mis reglas» guardados por los usuarios (el informe vuelve a los valores
-- por defecto). El % de riesgo y el mínimo no se tocan: tienen sus propias columnas.

alter table public.configuracion
  drop column if exists reglas_informe;
