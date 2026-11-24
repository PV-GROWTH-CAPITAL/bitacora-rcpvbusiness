// Campo «Estrategia / setup»: texto libre con sugerencias de las estrategias ya usadas.
// Lo usan «Añadir operación» y la vista previa del importador.
import React from "react";

export default function CampoEstrategia({ id, value, onChange, opciones, etiqueta = "Estrategia / setup", style }) {
  const lista = `${id}-opciones`;
  return (
    <div className="jt-field" style={style}>
      {etiqueta && <label htmlFor={id}>{etiqueta}</label>}
      <input
        id={id}
        list={lista}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej. Ruptura de apertura"
        aria-label={etiqueta ? undefined : "Estrategia"}
      />
      <datalist id={lista}>
        {opciones.map((s, i) => <option key={i} value={s} />)}
      </datalist>
    </div>
  );
}
