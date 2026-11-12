// Textos legales de la Bitácora: aviso legal, política de privacidad y política de cookies.
// Los datos del titular están todos en DATOS_LEGALES: es lo único que hay que editar si cambian.
// Los lee LegalModal (src/App.jsx).
//
// Si cambias lo que hace la web (nuevo proveedor, analítica, otra herramienta de correo...),
// actualiza aquí el texto que corresponda y la fecha de ACTUALIZACION.

export const DATOS_LEGALES = {
  titular: "[NOMBRE Y APELLIDOS DEL TITULAR]",
  nif: "[NIF DEL TITULAR]",
  domicilio: "[DOMICILIO A EFECTOS DE NOTIFICACIONES]",
  email: "crespocampos622@gmail.com",
  marca: "RCPV Business",
  servicio: "Bitácora",
};

const ACTUALIZACION = "12 de noviembre de 2026";

const { titular, nif, domicilio, email, marca, servicio } = DATOS_LEGALES;

const aviso = {
  titulo: "Aviso legal",
  parrafos: [
    {
      titulo: "1. Datos identificativos.",
      texto: `En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de que el titular de este sitio web y del servicio «${servicio}» es ${titular}, con NIF ${nif} y domicilio en ${domicilio}, que actúa bajo el nombre comercial ${marca} (en adelante, el «Titular»). Correo electrónico de contacto: ${email}.`,
    },
    {
      titulo: "2. Objeto.",
      texto: `La ${servicio} es una herramienta en línea para que cada usuario registre y analice sus propias operaciones de trading, sus cuentas de fondeo, sus cobros y gastos y sus objetivos. Este aviso legal regula el acceso y el uso del sitio web y del servicio. Acceder o registrarte supone aceptarlo.`,
    },
    {
      titulo: "3. Condiciones de uso.",
      texto: `El servicio es gratuito durante la fase inicial. El Titular podrá modificarlo, limitarlo o convertirlo en un servicio de pago, avisando antes a los usuarios registrados y sin que los cambios afecten a lo ya cobrado. Para registrarte debes ser mayor de 18 años y facilitar datos veraces. Eres responsable de custodiar tu contraseña y de la actividad realizada con tu cuenta; si sospechas de un uso no autorizado, cámbiala y avísanos. Te comprometes a no usar el servicio para fines ilícitos, a no intentar acceder a datos de otros usuarios y a no perjudicar su funcionamiento.`,
    },
    {
      titulo: "4. Naturaleza del servicio: no es asesoramiento.",
      texto: `La ${servicio} solo organiza y calcula con los datos que introduces tú. No presta asesoramiento financiero, de inversión, fiscal ni contable, ni recomienda operaciones, firmas de fondeo ni productos. Las cifras que muestra (resultados, estadísticas, resúmenes de contabilidad) son informativas, dependen de lo que hayas registrado y pueden contener errores; no sustituyen a tus extractos oficiales ni al criterio de un profesional. Operar en mercados financieros, y en especial con instrumentos apalancados como los futuros, conlleva un alto riesgo de pérdida, y los resultados pasados no garantizan resultados futuros. Cualquier decisión que tomes es solo tuya.`,
    },
    {
      titulo: "5. Disponibilidad y responsabilidad.",
      texto: `El Titular procura que el servicio funcione de forma continua, pero no garantiza que esté libre de errores o interrupciones, que pueden deberse a mantenimiento, fallos técnicos o causas ajenas a su control, y no responde de los daños que se deriven de ello, salvo en los casos en que la ley lo impida. Como medida de prudencia, puedes descargar una copia de tus datos cuando quieras desde «Mi cuenta». Esta cláusula no limita los derechos que la normativa de consumidores y usuarios reconoce a los consumidores.`,
    },
    {
      titulo: "6. Propiedad intelectual e industrial.",
      texto: `El diseño, el código, los textos, los logotipos y demás elementos del sitio y del servicio pertenecen al Titular o se usan con licencia, y están protegidos por la normativa de propiedad intelectual e industrial. No se permite copiarlos, distribuirlos ni transformarlos sin su autorización. Los datos y las imágenes que registras en tu cuenta siguen siendo tuyos: el Titular solo los trata para prestarte el servicio, según su política de privacidad.`,
    },
    {
      titulo: "7. Enlaces.",
      texto: `El sitio puede contener enlaces a páginas de terceros. El Titular no controla su contenido ni se hace responsable de él.`,
    },
    {
      titulo: "8. Protección de datos y cookies.",
      texto: `El tratamiento de tus datos personales se rige por la Política de privacidad y la Política de cookies de este sitio.`,
    },
    {
      titulo: "9. Modificaciones.",
      texto: `El Titular puede actualizar este aviso legal cuando cambie la normativa o el servicio. Se aplica la versión publicada en el momento en que accedes. Última actualización: ${ACTUALIZACION}.`,
    },
    {
      titulo: "10. Legislación aplicable y jurisdicción.",
      texto: `Este aviso legal se rige por la legislación española. Si eres consumidor, para cualquier controversia podrás acudir a los juzgados y tribunales de tu domicilio, conforme a la normativa de consumidores y usuarios. En los demás casos, las partes se someten a los juzgados y tribunales del domicilio del Titular, salvo que la ley disponga otro fuero.`,
    },
  ],
};

const privacidad = {
  titulo: "Política de privacidad",
  parrafos: [
    {
      titulo: "1. Quién es el responsable.",
      texto: `El responsable del tratamiento de tus datos personales en la ${servicio} es ${titular}, con NIF ${nif} y domicilio en ${domicilio}, que actúa bajo el nombre comercial ${marca}. Para cualquier cuestión sobre tus datos puedes escribir a ${email}. Esta política se aplica de acuerdo con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).`,
    },
    {
      titulo: "2. Qué datos tratamos.",
      texto: `Datos de tu cuenta: tu correo electrónico y tu contraseña (esta se guarda cifrada y no podemos verla). Datos que registras tú: operaciones, cuentas de fondeo, contabilidad (cuentas compradas, retiros e inversiones), objetivos, hábitos, listas de comprobación de tu estrategia y tus firmas de fondeo; también las imágenes que subas, como capturas de operaciones o justificantes de cobros. Datos de preferencias: si aceptas recibir novedades por correo y la fecha del último cambio. Datos técnicos: la dirección IP y los registros de acceso que generan los proveedores de infraestructura para que el servicio funcione y sea seguro. La ${servicio} no se conecta a tus cuentas de bróker ni de firmas de fondeo: solo contiene lo que tú introduces. No te pedimos datos de categorías especiales ni documentos de identidad.`,
    },
    {
      titulo: "3. Para qué los usamos y con qué base legal.",
      texto: `(a) Prestarte el servicio: crear y mantener tu cuenta, identificarte y guardar y mostrarte tus datos. Base: la ejecución del contrato que aceptas al registrarte (art. 6.1.b RGPD). (b) Enviarte avisos necesarios sobre el servicio, como confirmar el alta o recuperar la contraseña. Misma base. (c) Enviarte novedades de la ${servicio} y contenido de ${marca}. Base: tu consentimiento (art. 6.1.a), que es opcional y puedes retirar cuando quieras. (d) Mantener la seguridad, prevenir abusos y obtener estadísticas internas y agregadas de uso (por ejemplo, cuántos usuarios registran operaciones cada semana) para mejorar el servicio. Base: nuestro interés legítimo (art. 6.1.f). No usamos herramientas de analítica de terceros ni elaboramos perfiles sobre ti. (e) Cumplir obligaciones legales y atender reclamaciones. Base: art. 6.1.c y 6.1.f.`,
    },
    {
      titulo: "4. Comunicaciones por correo.",
      texto: `Usamos tu correo electrónico para gestionar tu cuenta: confirmar el alta, recuperar la contraseña y enviarte avisos necesarios sobre el servicio. Solo si marcas la casilla correspondiente al registrarte o en «Mi cuenta», te enviaremos además novedades de la ${servicio} y contenido de ${marca}. La base de este envío es tu consentimiento: es opcional, no condiciona el uso de la ${servicio} y puedes retirarlo en cualquier momento desmarcando la casilla en «Mi cuenta». Guardamos si lo has aceptado y la fecha del último cambio. No cedemos tu correo a terceros para que te envíen publicidad. Si usamos una herramienta externa para enviar estos correos, actuará como encargado del tratamiento y actualizaremos esta política.`,
    },
    {
      titulo: "5. Cuánto tiempo conservamos tus datos.",
      texto: `Mientras mantengas tu cuenta. Si la eliminas, se borran de forma definitiva tu usuario, tus datos y tus imágenes. Después no conservamos datos tuyos, salvo las copias de seguridad técnicas que pueda mantener el proveedor de la base de datos, que se sobrescriben de forma periódica. Los datos técnicos de acceso se conservan el tiempo que fijan los proveedores de infraestructura.`,
    },
    {
      titulo: "6. Quién más accede a tus datos.",
      texto: `No vendemos tus datos ni los cedemos a terceros con fines comerciales. Para prestar el servicio recurrimos a proveedores que tratan datos por nuestra cuenta, como encargados del tratamiento y con el contrato correspondiente: Supabase, Inc., que ofrece la base de datos, la autenticación (incluido el envío de los correos de la cuenta) y el almacenamiento de imágenes, con los datos alojados en servidores de la Unión Europea (Irlanda); y Netlify, Inc., que aloja la web y está establecida en Estados Unidos. Cuando un proveedor trate datos fuera del Espacio Económico Europeo, la transferencia se ampara en el Marco de Privacidad de Datos UE-EE. UU. o en las cláusulas contractuales tipo aprobadas por la Comisión Europea. Además, la web descarga sus tipografías de Google Fonts, por lo que tu navegador se conecta a servidores de Google, que pueden recibir tu dirección IP; no se envía ningún dato de tu cuenta. Podremos comunicar datos a las autoridades cuando la ley lo exija.`,
    },
    {
      titulo: "7. Descarga y borrado de tus datos.",
      texto: `Desde «Mi cuenta» puedes descargar en cualquier momento una copia de tus datos en un archivo JSON: todo lo que has registrado en la ${servicio} y la lista de tus imágenes (las imágenes no van dentro del archivo). También puedes eliminar tu cuenta tú mismo: al hacerlo se borran de forma definitiva tu usuario, tus datos y tus imágenes, y no se pueden recuperar. Con estas dos opciones puedes ejercer directamente tus derechos de acceso, portabilidad y supresión.`,
    },
    {
      titulo: "8. Tus derechos.",
      texto: `Puedes ejercer en cualquier momento los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, y retirar tu consentimiento sin que ello afecte a lo ya realizado. Muchos de ellos los tienes a un clic en «Mi cuenta» (apartado anterior); para cualquier otra solicitud, escríbenos a ${email} indicando qué quieres y desde qué correo te registraste, y te responderemos en el plazo máximo de un mes. Si crees que tus datos no se tratan como corresponde, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).`,
    },
    {
      titulo: "9. Seguridad.",
      texto: `Aplicamos medidas técnicas y organizativas razonables para proteger tus datos: conexión cifrada, contraseñas almacenadas de forma cifrada y control de acceso en la propia base de datos para que cada usuario solo pueda acceder a sus datos. Ningún sistema es infalible; te recomendamos usar una contraseña única y no compartirla.`,
    },
    {
      titulo: "10. Menores.",
      texto: `La ${servicio} está dirigida a personas mayores de 18 años. No tratamos de forma consciente datos de menores y, si detectamos que una cuenta pertenece a un menor, la eliminaremos.`,
    },
    {
      titulo: "11. Cambios en esta política.",
      texto: `Podemos actualizar esta política cuando cambie la normativa o el servicio. Si el cambio es importante, te lo comunicaremos. Última actualización: ${ACTUALIZACION}.`,
    },
  ],
};

const cookies = {
  titulo: "Política de cookies",
  parrafos: [
    {
      titulo: "Qué usamos.",
      texto: `Este sitio no utiliza cookies propias ni de terceros, ni con fines de analítica, ni de publicidad, ni de seguimiento. Cuando inicias sesión, la web guarda en el almacenamiento local de tu navegador (localStorage) la clave de sesión que gestiona Supabase Auth. Es un elemento estrictamente necesario para que el servicio funcione y mantenga tu sesión abierta, por lo que no requiere tu consentimiento (art. 22.2 LSSI-CE). Se elimina al cerrar sesión.`,
    },
    {
      titulo: "Tipografías de Google.",
      texto: `Para mostrar sus tipografías, la web descarga archivos desde Google Fonts (fonts.googleapis.com y fonts.gstatic.com). Al hacerlo, tu navegador se conecta a servidores de Google, que pueden recibir tu dirección IP y datos técnicos del navegador. No se envía ningún dato de tu cuenta.`,
    },
    {
      titulo: "Cómo gestionarlo.",
      texto: `Puedes borrar el almacenamiento local desde los ajustes de tu navegador o cerrando sesión. Si en el futuro incorporamos cookies de analítica u otras no necesarias, te pediremos antes tu consentimiento y actualizaremos esta política. Más información en la Política de privacidad. Última actualización: ${ACTUALIZACION}.`,
    },
  ],
};

export const TEXTOS_LEGALES = { aviso, privacidad, cookies };
