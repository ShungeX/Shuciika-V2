// ─────────────────────────────────────────────────────────────────────────────
// Configuración del Sistema de Regalos (entre PERSONAJES, nunca entre cuentas).
//
// Toda constante de balance vive aquí y está marcada con // ⚙.
//   • "⚙" solo          → valor propuesto en el diseño.
//   • "⚙ PROVISIONAL"   → el diseño no da un número; placeholder para que el
//                          código funcione. Ajustar con pruebas antes de abrir.
//
// El puntaje S y los puntos de amistad están en config/valorRegalo.js.
// Los textos que ve el jugador están en config/mensajesRegalos.js.
// ─────────────────────────────────────────────────────────────────────────────

const MINUTO = 60 * 1000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

// ─── Bolsas ──────────────────────────────────────────────────────────────────
// Clave "Region:ID". Solo los objetos de esta lista funcionan como bolsa de
// regalo (se abren con el editor desde "Usar item" del inventario).
// `capacidad` es PESO: Σ atributos.peso × cantidad de lo que va dentro. Si el
// objeto del catálogo tiene atributos.capacidad, esa manda sobre la de aquí.
const BOLSAS_REGALO = {
    "TOB-01:741": { capacidad: 10 },   // Bolsa de regalo                            // ⚙ PROVISIONAL
}
const CAPACIDAD_POR_DEFECTO = 10                                                    // ⚙ PROVISIONAL

// Bolsas que permiten poner un banner (imagen grande al final del regalo).
// Si la bolsa no está aquí, la opción ni siquiera aparece en el menú.
const BOLSAS_CON_BANNER = [
    "TOB-01:741",   // Bolsa de regalo
]

// Bolsas que permiten cambiar el color del contenedor (accent_color).
const BOLSAS_CON_COLOR = [
    "TOB-01:741",   // Bolsa de regalo
]

// Colores que se ofrecen en "Cambiar color" (máx. 24 + "Sin color").
const COLORES = [
    { nombre: "Rosa sakura", hex: 0xF4A7C0, emoji: "🌸" },
    { nombre: "Lila", hex: 0xB79CED, emoji: "💜" },
    { nombre: "Celeste", hex: 0x8EC9F0, emoji: "🩵" },
    { nombre: "Menta", hex: 0x9DE0C2, emoji: "🍃" },
    { nombre: "Dorado", hex: 0xE8C547, emoji: "✨" },
    { nombre: "Durazno", hex: 0xF7B98B, emoji: "🍑" },
    { nombre: "Rojo cereza", hex: 0xD9475C, emoji: "🍒" },
    { nombre: "Noche", hex: 0x3B3F7A, emoji: "🌙" },
]

// Miniaturas del editor: se elige una al azar en cada render.
const MINIATURAS_EDITOR = [
    "https://i.pinimg.com/736x/4a/02/01/4a020179fa651e984ab1ddfdd18ffc58.jpg",
    "https://i.pinimg.com/736x/74/5a/2c/745a2c65b685858255145a403f0d139e.jpg",
    "https://i.pinimg.com/736x/f8/9d/fb/f89dfb628e6f6053aae8fac3ee90ea96.jpg",
    "https://i.pinimg.com/1200x/55/d1/07/55d1074429cb9f407a98103da68ac21c.jpg",
    "https://i.pinimg.com/736x/a8/04/e8/a804e84ad87c445afb51d43f81c474ad.jpg",
]

// ─── Contenido ───────────────────────────────────────────────────────────────
// Sin bolsa: una sola pila de ítems (+ Lumens), sin nota.
const PILAS_SIN_BOLSA = 1                                                           // ⚙
// Con bolsa manda la capacidad de peso. Este tope de pilas es opcional: null lo
// desactiva. Existe por los ítems de peso 0, que si no podrían meterse sin fin.
const PILAS_MAX_BOLSA = 10                                                          // ⚙ PROVISIONAL
const CANTIDAD_MAX_PILA = 99                                                        // ⚙ PROVISIONAL

const NOTA_MAX = 300                                                                // ⚙
const TITULO_MAX = 40                                                               // ⚙ PROVISIONAL

// Banner: solo https y con extensión de imagen o de un host de imágenes conocido.
// TODO(decisión): ¿lista blanca de hosts más estricta?
const BANNER_HOSTS = ["i.pinimg.com", "res.cloudinary.com", "cdn.discordapp.com", "media.discordapp.net", "i.imgur.com"]

// ─── Lumens ──────────────────────────────────────────────────────────────────
// Al meterlos a la bolsa se CONGELAN (economia.congelado.lumens): salen del saldo
// pero siguen siendo del remitente hasta que el destinatario abre el regalo.
// Por qué por pareja: el tope por remitente no frena a dos cuentas cooperando
// que se pasan dinero a diario; por pareja sí.
const LUMENS_TOPE_DIARIO_PAREJA = 300                                               // ⚙
const LUMENS_MAX_POR_REGALO = 300                                                   // ⚙ PROVISIONAL

// ─── Límites de envío ────────────────────────────────────────────────────────
const LIMITE_PENDIENTES_PAREJA = 3   // regalos sin abrir de A hacia B              // ⚙
const LIMITE_ENVIADOS_DIA = 10       // por remitente                               // ⚙
const BUZON_MAX = 50                 // pendientes por destinatario                 // ⚙

// Estado del remitente para enviar / del destinatario para abrir.
// Por qué se bloquea en combate y exploración: el buzón vive en el Tejido (el
// inventario liminal); si se pudiera abrir allí, los consumibles saltarían el
// tope de la mochila.
const BLOQUEAR_OCUPADO = true                                                       // ⚙

// ─── Editor (bolsa a medio armar) ────────────────────────────────────────────
// El contenido vive en la bolsa del inventario (persistente); en memoria solo
// está el candado que deja editar UN regalo a la vez y el token del mensaje.
const EDITOR_TTL_MS = 15 * MINUTO                                                   // ⚙
const LISTA_EDITOR = 10              // filas visibles en el editor
const LISTA_VISTA_PREVIA = 15        // filas por página en la vista previa

// Envío pendiente de confirmar (/rol regalar → botón Enviar)
const CONFIRMACION_TTL_MS = 15 * MINUTO                                             // ⚙

// ─── Buzón: expiración, barrido y retención ──────────────────────────────────
const DIAS_VENCE = 30                                                               // ⚙
const BARRIDO_CADA_MS = 6 * HORA                                                    // ⚙ PROVISIONAL
// Regla 13 (multicuentas): los regalos resueltos son el registro para detectar
// patrones entre cuentas sospechosas. No se purgan antes de esto.
const RETENCION_DIAS = 90                                                           // ⚙
const BUZON_LISTA = 10               // (obsoleto: el buzón usa config/buzon.js)

// ─── Reportes ────────────────────────────────────────────────────────────────
// TODO(decisión): lista definitiva de motivos.
const MOTIVOS_REPORTE = [
    { id: "ofensivo", label: "Mensaje ofensivo" },                                  // ⚙
    { id: "acoso", label: "Acoso" },                                                // ⚙
    { id: "spam", label: "Spam" },                                                  // ⚙
    { id: "otro", label: "Otro" },                                                  // ⚙
]
// Canal del staff donde llegan los reportes, con botones para resolverlos
const CANAL_REPORTES = "872702942065606666"                                          // ⚙
const REPORTE_TEXTO_MAX = 300                                                       // ⚙ PROVISIONAL
// Por qué hay tope: que reportar no se vuelva una forma de acoso.
const REPORTES_POR_DIA = 3                                                          // ⚙ PROVISIONAL
const RETENCION_REPORTES_DIAS = 90   // mínimo; la instantánea sobrevive al regalo  // ⚙

// ─── Antiabuso de puntos (el puntaje S no evita los ciclos gratis) ───────────
// Reciclado: si el REMITENTE recibió ese mismo itemId de cualquiera en esta
// ventana, esa pila no suma puntos (el ítem se entrega igual). Corta el
// "A→B→A→B" con el mismo objeto dando vueltas.
const RECICLADO_VENTANA_MS = 24 * HORA                                              // ⚙
// Lumens: si el destinatario le mandó al remitente una cantidad parecida en la
// ventana, la pila de Lumens no suma (corta el ping-pong de dinero).
const LUMENS_SIMILAR_VENTANA_MS = 24 * HORA                                         // ⚙
const LUMENS_SIMILAR_TOLERANCIA = 0.20                                              // ⚙

// ─── Notificaciones ──────────────────────────────────────────────────────────
// TODO(decisión): campo real de "configuración de notificaciones". Hoy se lee
// social.notificaciones.regalos (false = no avisar); si no existe, se avisa.
const CAMPO_NOTIF_REGALOS = "regalos"

const claveBolsa = (item) => `${item?.Region}:${Number(item?.ID)}`
const esBolsaRegalo = (item) => Boolean(BOLSAS_REGALO[claveBolsa(item)])
const permiteBanner = (item) => BOLSAS_CON_BANNER.includes(claveBolsa(item))
const permiteColor = (item) => BOLSAS_CON_COLOR.includes(claveBolsa(item))

module.exports = {
    MINUTO, HORA, DIA,
    BOLSAS_REGALO,
    CAPACIDAD_POR_DEFECTO,
    BOLSAS_CON_BANNER,
    BOLSAS_CON_COLOR,
    COLORES,
    MINIATURAS_EDITOR,
    PILAS_SIN_BOLSA,
    PILAS_MAX_BOLSA,
    CANTIDAD_MAX_PILA,
    NOTA_MAX,
    TITULO_MAX,
    BANNER_HOSTS,
    LUMENS_TOPE_DIARIO_PAREJA,
    LUMENS_MAX_POR_REGALO,
    LIMITE_PENDIENTES_PAREJA,
    LIMITE_ENVIADOS_DIA,
    BUZON_MAX,
    BLOQUEAR_OCUPADO,
    EDITOR_TTL_MS,
    LISTA_EDITOR,
    LISTA_VISTA_PREVIA,
    CONFIRMACION_TTL_MS,
    DIAS_VENCE,
    BARRIDO_CADA_MS,
    RETENCION_DIAS,
    BUZON_LISTA,
    MOTIVOS_REPORTE,
    CANAL_REPORTES,
    REPORTE_TEXTO_MAX,
    REPORTES_POR_DIA,
    RETENCION_REPORTES_DIAS,
    RECICLADO_VENTANA_MS,
    LUMENS_SIMILAR_VENTANA_MS,
    LUMENS_SIMILAR_TOLERANCIA,
    CAMPO_NOTIF_REGALOS,
    claveBolsa,
    esBolsaRegalo,
    permiteBanner,
    permiteColor,
}
