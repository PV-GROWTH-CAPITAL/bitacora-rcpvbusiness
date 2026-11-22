// Campo «Captura de la operación»: vista previa con «Quitar imagen» o zona para elegir archivo.
import React from "react";
import { X, ImagePlus } from "lucide-react";

export default function CampoCaptura({ formulario }) {
  const { capturaPreview, srcVistaPrevia, quitarCaptura, elegirCaptura } = formulario;

  return (
    <div className="jt-field">
      <label>Captura de la operación (opcional)</label>
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
