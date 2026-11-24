// Campo «Captura de la operación»: vista previa con «Quitar imagen» o zona para elegir archivo.
// `compacto` lo pinta en pequeño (miniatura y botones), para las filas del importador.
import React from "react";
import { X, ImagePlus } from "lucide-react";

export default function CampoCaptura({ formulario, etiqueta = "Captura de la operación (opcional)", compacto = false }) {
  const { capturaPreview, srcVistaPrevia, quitarCaptura, elegirCaptura } = formulario;

  if (compacto) {
    return (
      <div className="jt-captura-compacta">
        {capturaPreview ? (
          <>
            <img src={srcVistaPrevia || undefined} alt="Vista previa de la captura" className="captura-importe" />
            <button type="button" className="jt-link-btn" onClick={quitarCaptura}>Quitar</button>
          </>
        ) : (
          <label className="jt-link-btn">
            <ImagePlus size={13} /> Elegir foto
            <input type="file" accept="image/*" onChange={elegirCaptura} style={{ display: "none" }} />
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="jt-field">
      {etiqueta && <label>{etiqueta}</label>}
      {capturaPreview ? (
        <div className="jt-captura-preview">
          <img src={srcVistaPrevia || undefined} alt="Vista previa de la captura" className="captura-importe" />
          <button type="button" className="jt-btn" onClick={quitarCaptura}>
            <X size={14} /> Quitar imagen
          </button>
        </div>
      ) : (
        <label className="jt-captura-drop">
          <ImagePlus size={20} />
          <span>Toca para subir una captura de pantalla</span>
          <input type="file" accept="image/*" onChange={elegirCaptura} style={{ display: "none" }} />
        </label>
      )}
    </div>
  );
}
