// Journal de operaciones. Las piezas están en src/journal/ y los cálculos en src/utils/journal.js;
// aquí solo se monta el estado compartido (JournalProvider) y se colocan los paneles.
import React from "react";
import ImportarOperaciones from "./ImportarOperaciones";
import { ESTILOS_JOURNAL } from "./journal/estilos";
import { JournalProvider, useJournal } from "./journal/JournalContext";
import Ticker from "./journal/Ticker";
import CabeceraJournal from "./journal/CabeceraJournal";
import TarjetasStats from "./journal/TarjetasStats";
import AnalisisAvanzado from "./journal/AnalisisAvanzado";
import CurvaCapital from "./journal/CurvaCapital";
import CalendarioJournal from "./journal/CalendarioJournal";
import RegistroOperaciones from "./journal/RegistroOperaciones";
import FormularioOperacion from "./journal/formulario/FormularioOperacion";

export default function TradingJournal({ session }) {
  return (
    <JournalProvider session={session}>
      <PaginaJournal />
    </JournalProvider>
  );
}

function PaginaJournal() {
  const { state, actions, meta } = useJournal();
  const { saveError, errorDetalle, loaded, tickerTrades, stats, analisis, equityData, showImportar, cuentasImportar, filtroCuenta, formulario } = state;

  return (
    <div className="jt-root">
      <style>{ESTILOS_JOURNAL}</style>

      <Ticker tickerTrades={tickerTrades} />

      <CabeceraJournal />

      <div className="jt-main">
        {saveError && (
          <div className="jt-error-banner">
            No se pudo guardar/leer el último cambio. Revisa tu conexión, o que la tabla "trades" y sus permisos estén bien configurados en Supabase.
            {errorDetalle && <div className="jt-error-detalle">Detalle: {errorDetalle}</div>}
          </div>
        )}
        {!loaded && (
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>Cargando tus operaciones…</div>
        )}

        <TarjetasStats stats={stats} />

        <AnalisisAvanzado analisis={analisis} stats={stats} />

        <CurvaCapital equityData={equityData} />

        <CalendarioJournal />

        <RegistroOperaciones />
      </div>

      {showImportar && (
        <ImportarOperaciones
          session={meta.session}
          cuentas={cuentasImportar}
          cuentaInicial={filtroCuenta !== "Todas" ? filtroCuenta : ""}
          onClose={() => actions.setShowImportar(false)}
          onImportado={actions.cargarTrades}
        />
      )}

      {formulario && <FormularioOperacion key={formulario.id} />}
    </div>
  );
}
