# Tests pendientes (para el refactor)

Estos cálculos viven dentro de componentes y todavía no tienen tests. Para probarlos hay que sacarlos
antes a funciones puras (por ejemplo en `src/utils/`). No se han movido en el PR de tests para no
cambiar nada de lo que ve el usuario.

## Fallos detectados (arreglar en el refactor, con su test)

- [ ] **Racha actual del Journal: ordenar por fecha y hora.** `stats` en `src/TradingJournal.jsx`
  recorre `chronological`, que solo ordena por `fecha`. Si un día tiene varias operaciones, la racha
  depende del orden en que llegan de Supabase. Ordenar por `fecha` + `hora_entrada` (y quizá
  `created_at` para desempatar).
- [ ] **Unificar «hoy» en hora de Madrid en Journal y Objetivos.** `todayIsoLocal()` en
  `src/TradingJournal.jsx` y `isoOf(new Date())` en `src/Objetivos.jsx` usan la fecha local del
  navegador, mientras que Contabilidad, Payouts e Informes usan `hoyIso()` de `src/utils/periodo.js`
  (día civil de Madrid). Desde fuera de España, un objetivo puede pasar a «fallido» otro día.
  También afecta a `rangoSugerido()` de Objetivos.
- [ ] **Meta en $ de 0 o negativa: no mostrar «(%)» vacío.** En `src/Objetivos.jsx`, si
  `meta_valor <= 0` el % es `null`: la tarjeta muestra «(%)» y la barra se queda sin ancho. Además, con
  meta negativa solo se da por cumplido si el P&L es ≥ 0. Decidir qué significa una meta negativa
  («no perder más de X») y probarlo.

## Cálculos dentro de componentes

### `src/TradingJournal.jsx`
- `stats` (useMemo): nº de operaciones, P&L total, **win rate** (las de 0 $ cuentan en el total),
  profit factor (∞ sin pérdidas), ganancia y pérdida media, **racha actual** (una de 0 $ la corta).
- `analisis` (useMemo): lotes totales, días activos, media de operaciones por día, día más activo,
  día más y menos rentable, duraciones medias (total, ganadoras, perdedoras), tramos de duración con
  su win rate.
- `dailyTotals`, `monthTotal`, `diasSobreRiesgoMes`: P&L por día, total del mes del calendario y
  días por encima del riesgo máximo.
- `equityData`: curva de capital acumulado.
- Funciones del archivo sin exportar: `duracionSegundos` (cruza medianoche sumando 24 h),
  `horaASegundos`, `bucketLabel`, `parseLotes`, `errorLotes`, `fmtDuration`.

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
- `rangoSugerido(tipo)`: fechas por defecto de semana, mes, trimestre y año.
- `pnlEnRango` y `estadoDe`: logrado / fallido / en curso según la meta en $ o el estado manual.
- % de progreso de la barra y el recuento de logrados, fallidos y en curso.
