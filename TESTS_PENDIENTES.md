# Tests pendientes (para el refactor)

Estos cálculos viven dentro de componentes y todavía no tienen tests. Para probarlos hay que sacarlos
antes a funciones puras (por ejemplo en `src/utils/`), sin cambiar nada de lo que ve el usuario.

## Cálculos dentro de componentes

(Los del Journal ya están en `src/utils/journal.js` con sus tests en `tests/journal.test.js`.)

### `src/Informes.jsx`
- `weekPorDia`: P&L y nº de operaciones de lunes a domingo.
- `monthPorSemana`, mejor y peor semana del mes (la semana se agrupa por su lunes, aunque empiece en el mes anterior).
- `porEstrategia`: P&L, nº y win rate por estrategia (histórico completo).
- `porHora` y `FRANJAS`: franjas de 15 min entre 9:30 y 11:00, más «antes» y «después»; mejor y peor hora.
- `equityDe`: curva de capital.
- (`resumenDePeriodo` y `resumenReglas` ya se exportan y tienen tests en `tests/informes-resumen.test.js`.)

### `src/Contabilidad.jsx`
- `historicoGlobal` y `resumenPeriodo`: neto = retiros − cuentas − inversiones desgravables.
- `resumenPorEmpresa`: cuentas, gasto, retiros y beneficio por firma; las firmas del usuario salen
  aunque estén a cero.
- `datosEmpresaActiva`: neto del periodo y neto histórico de una firma.
- `tablaPeriodos`: filas por trimestre o mes con ingresos, gastos, neto y acumulado; marca «en curso» y futuros.

(Los de Objetivos ya están en `src/utils/objetivos.js` con sus tests en `tests/objetivos.test.js`.)

## Pendiente antes de abrir a usuarios externos

- **Quitar el reparto automático de `FIRMAS_SUGERIDAS`** (`src/empresasUsuario.js`). Hoy
  `src/AppShell.jsx:86` hace `crearLista(userId, FIRMAS_SUGERIDAS)` a quien tiene contabilidad pero
  aún no tiene lista: le pone las 11 firmas de siempre, sean o no las suyas. Choca con la regla de
  «nada escrito a fuego para un usuario concreto». Antes de abrir, ese caso debe ir a la bienvenida
  (o crear la lista solo con los proveedores de sus `cuentas_compradas` y `retiros`). La lista puede
  seguir existiendo como sugerencias en la bienvenida y en «Mis firmas» (`src/MisFirmas.jsx`).
  Encontrado por el revisor `revisor-rls`.
