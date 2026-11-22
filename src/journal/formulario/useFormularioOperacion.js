// Estado y lógica del formulario de operación: valores, alta en varias cuentas con ajustes por
// cuenta, captura (compresión y subida al bucket "capturas") y guardado en `trades`.
import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { rutaDeCaptura, useUrlCaptura } from "../../capturasUrls";
import { comprimirCaptura, extensionDeBlob, ImagenIlegibleError } from "../../comprimirCaptura";
import {
  parseLotes,
  todayIsoLocal,
  alternarCuenta,
  valorDeCuenta,
  errorDeContratos,
  puedeGuardarOperacion,
} from "../../utils/journal";
import { useJournal, TABLE } from "../JournalContext";

// Ojo: la fecha se calcula al cargar el módulo (ver TESTS_PENDIENTES.md).
const emptyForm = {
  fecha: todayIsoLocal(),
  cuenta: "",
  instrumento: "MNQ",
  direccion: "Largo",
  contratos: 1,
  puntos: "",
  resultado: "",
  estrategia: "",
  notas: "",
  enlace: "",
  hora_entrada: "",
  hora_salida: "",
  captura_url: "",
};

function formInicial(trade, filtroCuenta) {
  if (!trade) return { ...emptyForm, cuenta: filtroCuenta !== "Todas" ? filtroCuenta : "" };
  return {
    ...emptyForm,
    ...trade,
    contratos: trade.contratos === null || trade.contratos === undefined ? "1" : String(Number(trade.contratos)).replace(".", ","),
  };
}

export function useFormularioOperacion() {
  const { state, actions, meta } = useJournal();
  const { trades, cuentas, cuentasActivas, estrategiasUsadas, filtroCuenta, errorDetalle } = state;
  const trade = state.formulario.trade;
  const editingId = trade ? trade.id : null;
  const session = meta.session;

  const [form, setForm] = useState(() => formInicial(trade, filtroCuenta));
  const [cuentasSel, setCuentasSel] = useState(() =>
    !trade && cuentasActivas.includes(filtroCuenta) ? [filtroCuenta] : []
  );
  // Valores por cuenta que el usuario ha cambiado a mano; si no hay ajuste, se usa el valor general.
  const [ajustes, setAjustes] = useState({});
  const [capturaFile, setCapturaFile] = useState(null);
  const [capturaPreview, setCapturaPreview] = useState(() => (trade ? trade.captura_url || null : null));
  // Vista previa del formulario: con un archivo recién elegido se usa su blob: (el hook recibe null);
  // si no, la URL firmada de la captura ya guardada.
  const urlCapturaGuardada = useUrlCaptura(capturaFile ? null : capturaPreview);
  const srcVistaPrevia = capturaFile ? capturaPreview : urlCapturaGuardada;
  const [subiendoCaptura, setSubiendoCaptura] = useState(false);
  const [formError, setFormError] = useState(false);
  // Aviso cuando la captura elegida no se puede leer (p. ej. HEIC en Chrome).
  const [avisoCaptura, setAvisoCaptura] = useState("");

  const cerrarForm = actions.cerrarFormulario;

  function elegirCaptura(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setAvisoCaptura("");
    setCapturaFile(file);
    setCapturaPreview(URL.createObjectURL(file));
  }

  function quitarCaptura() {
    setAvisoCaptura("");
    setCapturaFile(null);
    setCapturaPreview(null);
    setForm((f) => ({ ...f, captura_url: "" }));
  }

  // Alta de un trade en varias cuentas a la vez (la edición sigue siendo de una sola cuenta).
  const modoMultiCuenta = !editingId && cuentasActivas.length > 0;
  const todasSel = cuentasActivas.length > 0 && cuentasActivas.every((c) => cuentasSel.includes(c));

  function toggleCuenta(c) {
    setCuentasSel((sel) => alternarCuenta(sel, c, cuentasActivas));
  }

  function toggleTodas() {
    setCuentasSel(todasSel ? [] : [...cuentasActivas]);
  }

  function valorCuenta(c, campo) {
    return valorDeCuenta(form, ajustes, cuentasSel.length, c, campo);
  }

  function ajustarCuenta(c, campo, valor) {
    setAjustes((a) => ({ ...a, [c]: { ...a[c], [campo]: valor } }));
  }

  function restablecerCuenta(c) {
    setAjustes(({ [c]: _, ...resto }) => resto);
  }

  // Primer valor de contratos/lotaje no válido entre los que se van a guardar.
  const errorContratos = errorDeContratos(
    form.contratos,
    modoMultiCuenta && cuentasSel.length > 1 ? cuentasSel.map((c) => ({ cuenta: c, contratos: valorCuenta(c, "contratos") })) : null
  );

  const puedeGuardar = puedeGuardarOperacion({
    fecha: form.fecha,
    subiendoCaptura,
    errorContratos,
    resultados: modoMultiCuenta ? cuentasSel.map((c) => valorCuenta(c, "resultado")) : [form.resultado],
  });

  function mostrarFallo(error) {
    actions.mostrarFallo(error);
    setFormError(true);
  }

  async function guardarForm() {
    if (!puedeGuardar) return;

    let capturaUrlFinal = form.captura_url || null;
    const urlAnterior = editingId ? (trades.find((t) => t.id === editingId)?.captura_url || null) : null;

    if (capturaFile) {
      setSubiendoCaptura(true);
      setAvisoCaptura("");
      let blob;
      try {
        blob = await comprimirCaptura(capturaFile);
      } catch (e) {
        setSubiendoCaptura(false);
        if (e instanceof ImagenIlegibleError) {
          // No se sube el original: se pide otra captura.
          console.error(e);
          setAvisoCaptura(e.message);
        } else {
          mostrarFallo(e);
        }
        return;
      }
      const path = `${session.user.id}/${Date.now()}.${extensionDeBlob(blob)}`;
      const { error: uploadError } = await supabase.storage.from("capturas").upload(path, blob, {
        cacheControl: "3600",
        contentType: blob.type,
        upsert: false,
      });
      setSubiendoCaptura(false);
      if (uploadError) {
        mostrarFallo(uploadError);
        return;
      }
      // Se guarda solo la ruta: la imagen se enseña con una URL firmada (ver capturasUrls.js).
      capturaUrlFinal = path;
    }

    const registro = {
      fecha: form.fecha,
      cuenta: form.cuenta,
      instrumento: form.instrumento,
      direccion: form.direccion,
      contratos: parseLotes(form.contratos),
      puntos: form.puntos === "" ? null : Number(form.puntos),
      resultado: Number(form.resultado),
      estrategia: form.estrategia,
      notas: form.notas,
      enlace: form.enlace,
      hora_entrada: form.hora_entrada === "" ? null : form.hora_entrada,
      hora_salida: form.hora_salida === "" ? null : form.hora_salida,
      captura_url: capturaUrlFinal,
    };

    actions.limpiarFallo();
    setFormError(false);
    if (editingId) {
      const { error } = await supabase.from(TABLE).update(registro).eq("id", editingId);
      if (error) {
        mostrarFallo(error);
        return;
      }
    } else {
      const filas = modoMultiCuenta
        ? cuentasSel.map((c) => ({
            ...registro,
            cuenta: c,
            resultado: Number(valorCuenta(c, "resultado")),
            contratos: parseLotes(valorCuenta(c, "contratos")),
            user_id: session.user.id,
          }))
        : [{ ...registro, user_id: session.user.id }];
      const { error } = await supabase.from(TABLE).insert(filas);
      if (error) {
        mostrarFallo(error);
        return;
      }
    }
    if (urlAnterior && rutaDeCaptura(urlAnterior) !== rutaDeCaptura(capturaUrlFinal)) {
      actions.borrarCapturaStorage(urlAnterior, editingId);
    }
    await actions.cargarTrades();
    cerrarForm();
  }

  return {
    form,
    setForm,
    editingId,
    cuentas,
    cuentasActivas,
    estrategiasUsadas,
    errorDetalle,
    modoMultiCuenta,
    cuentasSel,
    todasSel,
    ajustes,
    toggleCuenta,
    toggleTodas,
    valorCuenta,
    ajustarCuenta,
    restablecerCuenta,
    capturaPreview,
    srcVistaPrevia,
    elegirCaptura,
    quitarCaptura,
    subiendoCaptura,
    formError,
    avisoCaptura,
    errorContratos,
    puedeGuardar,
    guardarForm,
    cerrarForm,
  };
}
