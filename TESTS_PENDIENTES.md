# Tests pendientes (para el refactor)

Estos cálculos viven dentro de componentes y todavía no tienen tests. Para probarlos hay que sacarlos
antes a funciones puras (por ejemplo en `src/utils/`), sin cambiar nada de lo que ve el usuario.

## Fallos detectados (para el PR B, con su test)

Al arreglar cada fallo se quita de esta lista y su test pasa a comprobar lo correcto.

### Colores
- [ ] **Una operación de 0 $ se ve «plana» en todas partes.** El calendario ya la pinta en azul
  (`cal-flat`), pero el ticker (`src/journal/Ticker.jsx`, `>= 0` → `win`) y la tabla
  (`src/journal/FilaOperacion.jsx`, `>= 0` → `jt-pnl-win`) la pintan en verde.

### Objetivos
- [ ] **Meta en $ de 0 o negativa: no mostrar «(%)» vacío.** En `src/Objetivos.jsx`, si
  `meta_valor <= 0` el % es `null`: la tarjeta muestra «(%)» y la barra se queda sin ancho. Además, con
  meta negativa solo se da por cumplido si el P&L es ≥ 0. Decidir qué significa una meta negativa
  («no perder más de X») y probarlo.

### Mejor / peor operación
- [ ] **Sin resultados numéricos, mostrar «—».** `calcularAnalisis` (`src/utils/journal.js`) se
  queda con la primera operación como mejor y peor cuando ningún resultado es un número, y el panel
  enseña su importe (0,00 $) y su fecha.

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

### `src/Objetivos.jsx`
(`rangoSugerido` ya está en `src/utils/objetivos.js` con sus tests en `tests/objetivos.test.js`.)
- `pnlEnRango` y `estadoDe`: logrado / fallido / en curso según la meta en $ o el estado manual.
- % de progreso de la barra y el recuento de logrados, fallidos y en curso.
