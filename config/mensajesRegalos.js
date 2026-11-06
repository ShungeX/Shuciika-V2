// ─────────────────────────────────────────────────────────────────────────────
// Textos del Sistema de Regalos, en voz de Shuciika (cálida, tierna, nunca
// acusatoria). Todo lo que ve el jugador sale de aquí, por código.
//
// Reglas:
//   • NO_RECIBE_REGALOS es IDÉNTICO para privacidad y bloqueo: así nadie puede
//     deducir que lo bloquearon.
//   • HP_CERO_ABRIR es el texto exacto del diseño.
// Propuestas: ajustarlas con libertad, solo conservando los códigos.
// ─────────────────────────────────────────────────────────────────────────────

const FIRMA = "♡( ◡‿◡ )"

const MENSAJES = {
    // ── Envío ───────────────────────────────────────────────────────────────
    ESTRUCTURA: `Mmm… a este regalo le falta algo (o le sobra un poquito). ¿Lo revisamos juntos? ${FIRMA}`,
    VACIO: `El regalo está vacío todavía; mete algo bonito antes de cerrarlo ${FIRMA}`,
    HP_CERO_ENVIAR: "Estás agotadito… descansa un poco antes de envolver regalos, ¿sí?",
    OCUPADO: `Ahora mismo estás en medio de algo importante. Cuando termines, aquí te espero ${FIRMA}`,
    DESTINO_NO_EXISTE: "No encuentro a ese alumno en los registros del Instituto (・・ ) ?",
    DESTINO_INVALIDO: `Tus personajes ya comparten todo en el corazón; los regalos son para otras almas ${FIRMA}`,
    MISMO_PERSONAJE: `Un regalo para ti… ¡te lo mereces! Pero esto necesita a alguien más ${FIRMA}`,
    SIN_ALMA: "Ese personaje aún no despierta su alma, así que su buzón no puede guardar regalos todavía (｡•́︿•̀｡)",
    NO_RECIBE_REGALOS: "Parece que ahora no puede recibir regalos de tu parte. Quizá otro día (｡•́︿•̀｡)",
    ITEM_NO_REGALABLE: "Ese objeto está ligado a ti de una forma especial y no puede salir de tus manos (｡•́︿•̀｡)",
    FONDOS: "No te alcanza para eso… revisa tu inventario y tus Lumens, ¿sí? (｡•́︿•̀｡)",
    SIN_BOLSA: "No encuentro esa bolsa de regalo en tu inventario (・・ ) ?",
    NOTA_SIN_BOLSA: `Las notas viajan dentro de una Bolsa de regalo ${FIRMA}`,
    BOLSA_NO_CERRADA: "Esa bolsa todavía se está armando; ciérrala primero desde tu inventario.",
    LIMITE_PENDIENTES: `Ya tiene varios regalos tuyos esperando a ser abiertos. Dale tiempo de descubrirlos ${FIRMA}`,
    LIMITE_DIARIO: `Hoy ya repartiste muchos regalos, ¡qué corazón tan grande! Mañana puedes seguir ${FIRMA}`,
    BUZON_LLENO: "Su buzón está llenito ahora mismo. Inténtalo en otro momento (｡•́︿•̀｡)",
    LUMENS_TOPE: `Por hoy ya no pueden pasar más Lumens entre ustedes dos. Mañana sí ${FIRMA}`,
    LUMENS_MAX: "Eso son demasiados Lumens para un solo regalo (・・ ) ?",
    ENVIADO: `¡Listo! Tu regalo ya va camino a su buzón ${FIRMA}`,

    // ── Armar la bolsa ──────────────────────────────────────────────────────
    EDITOR_EXPIRADO: "Este editor ya se cerró. Vuelve a elegir la bolsa en tu inventario y seguimos donde lo dejaste.",
    EDITOR_OTRO: "Estás editando este regalo en otra ventana; sigamos allí para no confundirnos ♡",
    YA_ARMANDO: `Ya tienes un regalo a medio armar. Terminemos ese primero ${FIRMA}`,
    SIN_CAPACIDAD: "No cabe tanto en la bolsa; es muy pesado para ella (｡•́︿•̀｡)",
    MAX_PILAS: "La bolsa ya no tiene espacio para más tipos de objeto.",
    CANTIDAD_INVALIDA: "Necesito un número entero mayor que cero (・・ ) ?",
    SIN_OBJETOS_PAGINA: `En esta página no hay nada que se pueda regalar; prueba con otra página o con otro filtro ${FIRMA}`,
    PAGINA_INVALIDA: "Esa página no existe (・・ ) ?",
    NOTA_INVALIDA: "Esa nota tiene cosas que no puedo envolver (menciones, enlaces o invitaciones). ¿La escribimos de otra forma?",
    BANNER_INVALIDO: "Necesito un enlace https a una imagen (png, jpg, gif o webp).",
    BANNER_NO_PERMITIDO: "Esta bolsa no admite banner.",
    COLOR_NO_PERMITIDO: "Esta bolsa no admite cambiar de color.",
    BORRADO: `Deshice el regalo; todo volvió a tu inventario, bolsa incluida ${FIRMA}`,
    CERRADO: `¡Regalo cerrado y listo! Lo encontrarás en tu inventario. Para enviarlo usa \`/rol regalar\` ${FIRMA}`,
    ABIERTO_PROPIO: "Abriste tu propia bolsa: todo volvió a tu inventario, pero la bolsa ya no se puede reutilizar.",

    // ── Abrir ───────────────────────────────────────────────────────────────
    HP_CERO_ABRIR: "Te sientes demasiado cansado para emocionarte y abrirlo...",
    NO_ES_TUYO: "Ese regalo no es para este personaje (・・ ) ?",
    NO_EXISTE: "No encuentro ese regalo; quizá ya no está en el buzón.",
    YA_ABIERTO: `Ese regalo ya fue abierto ${FIRMA}`,
    DEVUELTO: "Ese regalo ya regresó a quien lo envió.",
    REPORTADO: "Ese regalo está guardadito mientras revisan el reporte. No se puede abrir por ahora.",
    INVENTARIO_LLENO: "No cabe todo en tu inventario; haz un poquito de espacio y lo abrimos (｡•́︿•̀｡)",
    ABIERTO: `¡Abriste tu regalo! ${FIRMA}`,

    // ── Reportes ────────────────────────────────────────────────────────────
    REPORTE_LIMITE: "Por hoy ya enviaste varios reportes. Si es urgente, busca a alguien del Instituto.",
    REPORTE_YA: "Ya habías reportado este regalo; está en revisión.",
    REPORTE_MOTIVO: "Elige un motivo de la lista, ¿sí?",
    REPORTE_OK: `Gracias por contármelo. Guardé la nota lejos de tu vista y alguien del Instituto la revisará con cuidado ${FIRMA}`,

    // ── Genéricos ───────────────────────────────────────────────────────────
    ERROR: "Algo se enredó mientras lo hacía. No se movió nada; ¿lo intentamos otra vez? (｡•́︿•̀｡)",
    CONFIRMACION_EXPIRADA: "Esta confirmación ya expiró. Vuelve a usar el comando ♡",

    // ── Menú de /rol regalar ────────────────────────────────────────────────
    MENU_EXPIRADO: "Este menú ya se cerró. Vuelve a usar `/rol regalar` y lo armamos otra vez ♡",
    MENU_CANCELADO: "Lo dejamos para otro momento. No se movió nada ♡",
    SIN_SELECCION: `Primero elige qué vas a regalar ${FIRMA}`,
    SIN_DESTINO: `¿Para quién es? Escribe su ID o elígelo de tus relaciones ${FIRMA}`,
    ID_INVALIDA: "Necesito la ID del personaje (solo números) (・・ ) ?",
    LUMENS_CON_BOLSA: "Con una bolsa, los Lumens viajan dentro de ella: agrégalos desde el editor de la bolsa ♡",
    SELECCION_PERDIDA: "Lo que habías elegido ya no está en tu inventario; elige otra cosa, ¿sí?",
    SIN_RELACIONES: `Todavía no tienes relaciones con nadie. ¡Escribe su ID y empieza una! ${FIRMA}`,
}

// Etiquetas del valor (el jugador ve la etiqueta, nunca el número S).
const ETIQUETAS = [
    { min: 75, texto: "Un regalo para recordar" },
    { min: 45, texto: "Un regalo especial" },
    { min: 20, texto: "Un buen gesto" },
    { min: 0, texto: "Un detalle" },
]

// Línea de amistad al abrir (nunca el número).
const LINEA_AMISTAD = {
    suma: `-# Este regalo los acercó un poquito más ${FIRMA}`,
    tope: `-# Por hoy ya no se acercan más ${FIRMA}`,
    sinValor: `-# Lo que cuenta es la intención ${FIRMA}`,
    sinAmistad: "",
}

const texto = (codigo) => MENSAJES[codigo] || MENSAJES.ERROR

module.exports = { FIRMA, MENSAJES, ETIQUETAS, LINEA_AMISTAD, texto }
