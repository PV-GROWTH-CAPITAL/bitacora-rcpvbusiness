# Seguridad antes de abrir a usuarios externos: orden de los scripts

Salen de la auditoría del 21/11/2026 sobre `bitacora-pruebas` (advisors, `pg_policies`, permisos y buckets). Ninguna tabla dejaba ver ni tocar filas de otro usuario; estos scripts cierran lo que quedaba y dejan todo con el mismo patrón que `empresas_usuario`, `perfiles` y `payouts`.

Se pegan a mano en el SQL Editor, **primero en pruebas y luego en producción**, en este orden:

| # | Script | Qué hace | Vuelta atrás |
|---|--------|----------|--------------|
| 1 | `rls_tablas_base.sql` | 14 tablas: `TO authenticated`, `(select auth.uid())`, UPDATE con `WITH CHECK`, las 4 políticas en todas | `rollback/rls_tablas_base_rollback.sql` |
| 2 | `rls_referencias_propias.sql` | `retiros_cuentas`, `habito_registros` y `estrategia_checks` solo pueden colgar de filas propias | `rollback/rls_referencias_propias_rollback.sql` |
| 3 | `storage_capturas_politicas.sql` | Bucket `capturas`: 10 MB y solo imágenes (webp, jpeg, png, gif, heic, heif); políticas como `payout-images` | `rollback/storage_capturas_politicas_rollback.sql` |
| 4 | `revocar_anon.sql` | Quita todos los permisos a `anon` y `TRUNCATE`/`TRIGGER`/`REFERENCES` a `authenticated` | `rollback/revocar_anon_rollback.sql` |
| 5 | `indices_fk.sql` | 8 índices para las claves foráneas que marca el advisor | `rollback/indices_fk_rollback.sql` |

- **El 1 va antes que el 2**: el 2 sustituye políticas `*_propias` que crea el 1.
- **Para deshacer, al revés**: primero el rollback del 2 y después el del 1. El 3, el 4 y el 5 se deshacen por separado.
- **El 1 solo se ejecuta una vez.** Se para sin tocar nada si las 14 tablas no tienen exactamente las 55 políticas que había en pruebas, y por eso tampoco se puede repetir después de aplicarlo. Los demás se pueden repetir.
- Después de cada script: su comprobación (va al final de cada archivo), abrir la Bitácora y probar lo que toca (Journal con captura, Estrategia con captura, Cuentas activas, Contabilidad, Payouts, Informes, Eliminar cuenta en un usuario de prueba) y pasar `get_advisors`.
- Aparte, en el panel (no es SQL): Authentication → Attack Protection → activar la protección contra contraseñas filtradas.

## Antes de producción: comparar políticas con pruebas

El rollback del 1 tiene escritas las políticas de **pruebas**. Ejecuta esta consulta (solo lectura) en producción **antes** de pegar nada. En pruebas, el 21/11/2026, salió:

- `politicas` = **63**
- `huella` = **b695012e80fbf4e1c74a78d249f76cb5**

Si en producción sale lo mismo, los rollbacks valen tal cual. Si no, ejecuta la segunda consulta en los dos proyectos y compara las filas antes de seguir.

```sql
-- 1) Resumen: número de políticas y huella (debe coincidir con pruebas)
select count(*) as politicas,
  md5(string_agg(schemaname || '|' || tablename || '|' || policyname || '|' || permissive || '|' || cmd || '|'
    || roles::text || '|' || coalesce(qual, '') || '|' || coalesce(with_check, ''),
    E'\n' order by schemaname, tablename, policyname)) as huella
from pg_policies
where (schemaname = 'public' and tablename in ('trades','cuentas_compradas','retiros','diario_emocional',
    'estrategia_criterios','estrategia_registros','estrategia_sesiones','objetivos','habitos','habito_registros',
    'configuracion','inversiones_desgravables','cuentas','retiros_cuentas','estrategia_checks'))
   or (schemaname = 'storage' and tablename = 'objects'
    and policyname in ('Ver mis capturas','Subir mis capturas','Actualizar mis capturas','Borrar mis capturas'));

-- 2) Detalle, para ver qué cambia si la huella no coincide
select schemaname, tablename, policyname, permissive, cmd, roles::text as roles, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('trades','cuentas_compradas','retiros','diario_emocional',
    'estrategia_criterios','estrategia_registros','estrategia_sesiones','objetivos','habitos','habito_registros',
    'configuracion','inversiones_desgravables','cuentas','retiros_cuentas','estrategia_checks'))
   or (schemaname = 'storage' and tablename = 'objects'
    and policyname in ('Ver mis capturas','Subir mis capturas','Actualizar mis capturas','Borrar mis capturas'))
order by schemaname, tablename, policyname;
```

## Respuestas de la auditoría que justifican el 3 y el 4

- **¿Alguna página consulta tablas sin sesión?** No. Sin sesión solo se pintan la landing (`LandingPage.jsx`, no usa Supabase) y los formularios de `App.jsx`, que solo llaman a `supabase.auth` (entrar, registrarse, recuperar y cambiar contraseña), y esas llamadas no dependen de los permisos de las tablas. Todo lo que lee tablas cuelga de `AppShell`, que solo se monta con sesión. El script de `PLANTILLAS/operativa-img/generar.js` no conecta con Supabase.
- **¿Qué sube la app a `capturas`?**
  - Estrategia (`estrategiaChecks.js`): la imagen se reduce a 1600 px de ancho y se convierte a WebP (JPEG si el navegador no sabe hacer WebP). Pocos cientos de KB.
  - Journal (`TradingJournal.jsx`): el archivo original sin comprimir, cualquier `image/*`, con la extensión del nombre. Puede ser PNG, JPEG, GIF, WebP… y también **HEIC**: desde el Mac, o desde el iPhone si se elige en «Archivos» (desde «Fototeca», Safari lo convierte a JPEG). Por eso el 3 admite `heic`/`heif`. Se quedan fuera SVG y cualquier otro tipo.
  - 10 MB cubre de sobra capturas de pantalla y fotos normales. Más adelante convendría que el Journal comprima igual que Estrategia (es un cambio de código, no de base de datos).
