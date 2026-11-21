-- ============================================================================
-- VUELTA ATRÁS de sql/rls_tablas_base.sql: deja las políticas como estaban.
--
-- Las políticas de abajo se leyeron de bitacora-pruebas el 21/11/2026. Si en
-- producción eran otras (compáralo antes con la consulta de
-- sql/LEEME_orden_seguridad.md), este script no las devuelve exactas.
--
-- Si ya pegaste rls_referencias_propias.sql, deshaz antes ese
-- (sql/rollback/rls_referencias_propias_rollback.sql).
--
-- configuracion vuelve a no tener política DELETE.
-- SQL Editor > New query > Run. Se puede ejecutar varias veces.
-- ============================================================================

do $$
declare
  t text;
  c text;
  r record;
  tablas text[] := array['trades','cuentas_compradas','retiros','diario_emocional',
    'estrategia_criterios','estrategia_registros','estrategia_sesiones','objetivos',
    'habitos','habito_registros','configuracion','inversiones_desgravables',
    'cuentas','retiros_cuentas'];
begin
  -- Quita las políticas nuevas
  foreach t in array tablas loop
    foreach c in array array['select','insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I', t || '_' || c || '_propias', t);
    end loop;
  end loop;

  -- Vuelve a crear las de antes (nombre, rol, USING / WITH CHECK tal cual)
  for r in select * from (values
    ('trades','Ver solo mis operaciones','select','public',true,false,'auth.uid() = user_id'),
    ('trades','Crear solo mis operaciones','insert','public',false,true,'auth.uid() = user_id'),
    ('trades','Editar solo mis operaciones','update','public',true,true,'auth.uid() = user_id'),
    ('trades','Borrar solo mis operaciones','delete','public',true,false,'auth.uid() = user_id'),
    ('cuentas_compradas','Ver solo mis compras','select','public',true,false,'auth.uid() = user_id'),
    ('cuentas_compradas','Crear solo mis compras','insert','public',false,true,'auth.uid() = user_id'),
    ('cuentas_compradas','Editar solo mis compras','update','public',true,true,'auth.uid() = user_id'),
    ('cuentas_compradas','Borrar solo mis compras','delete','public',true,false,'auth.uid() = user_id'),
    ('retiros','Ver solo mis retiros','select','public',true,false,'auth.uid() = user_id'),
    ('retiros','Crear solo mis retiros','insert','public',false,true,'auth.uid() = user_id'),
    ('retiros','Editar solo mis retiros','update','public',true,true,'auth.uid() = user_id'),
    ('retiros','Borrar solo mis retiros','delete','public',true,false,'auth.uid() = user_id'),
    ('diario_emocional','Ver solo mi diario','select','public',true,false,'auth.uid() = user_id'),
    ('diario_emocional','Crear solo mi diario','insert','public',false,true,'auth.uid() = user_id'),
    ('diario_emocional','Editar solo mi diario','update','public',true,true,'auth.uid() = user_id'),
    ('diario_emocional','Borrar solo mi diario','delete','public',true,false,'auth.uid() = user_id'),
    ('estrategia_criterios','Ver solo mis criterios','select','public',true,false,'auth.uid() = user_id'),
    ('estrategia_criterios','Crear solo mis criterios','insert','public',false,true,'auth.uid() = user_id'),
    ('estrategia_criterios','Editar solo mis criterios','update','public',true,true,'auth.uid() = user_id'),
    ('estrategia_criterios','Borrar solo mis criterios','delete','public',true,false,'auth.uid() = user_id'),
    ('estrategia_registros','Ver solo mis registros de estrategia','select','public',true,false,'auth.uid() = user_id'),
    ('estrategia_registros','Crear solo mis registros de estrategia','insert','public',false,true,'auth.uid() = user_id'),
    ('estrategia_registros','Editar solo mis registros de estrategia','update','public',true,true,'auth.uid() = user_id'),
    ('estrategia_registros','Borrar solo mis registros de estrategia','delete','public',true,false,'auth.uid() = user_id'),
    ('estrategia_sesiones','Ver mis sesiones','select','public',true,false,'user_id = auth.uid()'),
    ('estrategia_sesiones','Crear mis sesiones','insert','public',false,true,'user_id = auth.uid()'),
    ('estrategia_sesiones','Actualizar mis sesiones','update','public',true,true,'user_id = auth.uid()'),
    ('estrategia_sesiones','Borrar mis sesiones','delete','public',true,false,'user_id = auth.uid()'),
    ('objetivos','Ver solo mis objetivos','select','public',true,false,'auth.uid() = user_id'),
    ('objetivos','Crear solo mis objetivos','insert','public',false,true,'auth.uid() = user_id'),
    ('objetivos','Editar solo mis objetivos','update','public',true,true,'auth.uid() = user_id'),
    ('objetivos','Borrar solo mis objetivos','delete','public',true,false,'auth.uid() = user_id'),
    ('habitos','Ver solo mis habitos','select','public',true,false,'auth.uid() = user_id'),
    ('habitos','Crear solo mis habitos','insert','public',false,true,'auth.uid() = user_id'),
    ('habitos','Editar solo mis habitos','update','public',true,true,'auth.uid() = user_id'),
    ('habitos','Borrar solo mis habitos','delete','public',true,false,'auth.uid() = user_id'),
    ('habito_registros','Ver solo mis registros de habitos','select','public',true,false,'auth.uid() = user_id'),
    ('habito_registros','Crear solo mis registros de habitos','insert','public',false,true,'auth.uid() = user_id'),
    ('habito_registros','Editar solo mis registros de habitos','update','public',true,true,'auth.uid() = user_id'),
    ('habito_registros','Borrar solo mis registros de habitos','delete','public',true,false,'auth.uid() = user_id'),
    ('configuracion','Ver mi configuracion','select','public',true,false,'auth.uid() = user_id'),
    ('configuracion','Crear mi configuracion','insert','public',false,true,'auth.uid() = user_id'),
    ('configuracion','Editar mi configuracion','update','public',true,true,'auth.uid() = user_id'),
    ('inversiones_desgravables','Usuarios pueden ver sus propias inversiones','select','public',true,false,'auth.uid() = user_id'),
    ('inversiones_desgravables','Usuarios pueden insertar sus propias inversiones','insert','public',false,true,'auth.uid() = user_id'),
    ('inversiones_desgravables','Usuarios pueden actualizar sus propias inversiones','update','public',true,false,'auth.uid() = user_id'),
    ('inversiones_desgravables','Usuarios pueden eliminar sus propias inversiones','delete','public',true,false,'auth.uid() = user_id'),
    ('cuentas','cuentas_select_propia','select','public',true,false,'user_id = auth.uid()'),
    ('cuentas','cuentas_insert_propia','insert','public',false,true,'user_id = auth.uid()'),
    ('cuentas','cuentas_update_propia','update','public',true,false,'user_id = auth.uid()'),
    ('cuentas','cuentas_delete_propia','delete','public',true,false,'user_id = auth.uid()'),
    ('retiros_cuentas','retiros_select_own','select','authenticated',true,false,'auth.uid() = user_id'),
    ('retiros_cuentas','retiros_insert_own','insert','authenticated',false,true,'auth.uid() = user_id'),
    ('retiros_cuentas','retiros_update_own','update','authenticated',true,true,'auth.uid() = user_id'),
    ('retiros_cuentas','retiros_delete_own','delete','authenticated',true,false,'auth.uid() = user_id')
  ) v(tabla, nombre, cmd, rol, con_using, con_check, expr) loop
    execute format('drop policy if exists %I on public.%I', r.nombre, r.tabla);
    execute format('create policy %I on public.%I for %s to %s', r.nombre, r.tabla, r.cmd, r.rol)
      || case when r.con_using then ' using (' || r.expr || ')' else '' end
      || case when r.con_check then ' with check (' || r.expr || ')' else '' end;
  end loop;
end $$;

-- Comprobación: debe salir 55
select count(*) as politicas
from pg_policies
where schemaname = 'public'
  and tablename in ('trades','cuentas_compradas','retiros','diario_emocional','estrategia_criterios',
    'estrategia_registros','estrategia_sesiones','objetivos','habitos','habito_registros',
    'configuracion','inversiones_desgravables','cuentas','retiros_cuentas');
