// ─────────────────────────────────────────────────────────────────────────────
// Configuración del Sistema de Amistad (entre PERSONAJES, nunca entre cuentas).
//
// Toda constante de balance vive aquí y está marcada con // ⚙.
//   • "⚙" solo          → valor propuesto en el diseño.
//   • "⚙ PROVISIONAL"   → el diseño no da un número; es un placeholder para que
//                          el código funcione. Ajustar con pruebas antes de abrir.
// ─────────────────────────────────────────────────────────────────────────────

const MINUTO = 60 * 1000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

// ─── Tipos de interacción ────────────────────────────────────────────────────
// Registro ampliable: para añadir un tipo nuevo basta con una entrada en TIPOS
// (y su texto/gif en functions/Amistad/accionesInteraccion.js).
//
// Cada respuesta del receptor define:
//   resultado  "correspondida" | "rechazada" | "neutral"  → qué contador del historial sube
//   mult       multiplicador sobre `base` (negativo = resta puntos)
//   rivalidad  cuánto sube el contador de rivalidad (solo hostiles correspondidas)
//
// Los puntos NO se aplican al enviar, sino cuando el receptor responde.
//
// Simetría (decidido): en las afectuosas/juguetonas "corresponder" SUMA; en las
// hostiles la forma de corresponder es "Devolver", y RESTA con la misma fuerza.
// Así una pareja que se devuelve golpes baja a negativo con rivalidad alta → Rival.
//
// Las tres categorías comparten plantilla para que el balance se ajuste en un
// solo lugar; un tipo puede sobreescribir `base` si se quiere que pese distinto.
const AFECTUOSA = {
    corresponder: { resultado: "correspondida", mult: 6, rivalidad: 0 },            // ⚙
    ignorar:      { resultado: "neutral",       mult: 0, rivalidad: 0 },
    rechazar:     { resultado: "rechazada",     mult: -2, rivalidad: 0 },           // ⚙
}
const JUGUETONA = {
    seguir:      { resultado: "correspondida", mult: 4, rivalidad: 0 },             // ⚙ PROVISIONAL
    ignorar:     { resultado: "neutral",       mult: 0, rivalidad: 0 },
    incomodarse: { resultado: "rechazada",     mult: -2, rivalidad: 0 },            // ⚙
}
const HOSTIL = {
    // `continua`: el menú no se cierra; se invierten los roles (quien devolvió pasa
    // a ser el emisor) y el otro puede volver a responder. Cualquier otra
    // respuesta cierra el intercambio.
    devolver:  { resultado: "correspondida", mult: -6, rivalidad: 1, continua: true }, // ⚙ espejo de corresponder
    // TODO(decisión): "Tomarlo con humor" también corresponde (sube rivalidad), pero
    // ¿suma, resta o deja los puntos igual? Hoy suma poquito.
    humor:     { resultado: "correspondida", mult: 1,  rivalidad: 1 },              // ⚙ PROVISIONAL
    ignorar:   { resultado: "neutral",       mult: 0,  rivalidad: 0 },
    ofenderse: { resultado: "rechazada",     mult: -2, rivalidad: 0 },              // ⚙
}

const tipo = (categoria, respuestas, base = 1) => ({ categoria, base, respuestas })   // base ⚙

// Poke escala a duelo alternando molestar / seguir el juego: su "Seguir el juego"
// continúa el intercambio (se invierten los roles), igual que "Devolver".
const JUGUETONA_CADENA = { ...JUGUETONA, seguir: { ...JUGUETONA.seguir, continua: true } }

// La clave es el `tipo` que viaja en el custom_id: cortita a propósito.
// TODO(decisión): categoría de mordida y disparo (antes contaban como enemistad).
const TIPOS = {
    abrazo:   tipo("afectuosa", AFECTUOSA),   // /interact hug
    mimo:     tipo("afectuosa", AFECTUOSA),   // /interact pat
    beso:     tipo("afectuosa", AFECTUOSA),   // /interact kiss
    baile:    tipo("juguetona", JUGUETONA),   // /act dance
    poke:     tipo("juguetona", JUGUETONA_CADENA),   // /interact poke
    mordida:  tipo("juguetona", JUGUETONA),   // /interact bite
    bofetada: tipo("hostil", HOSTIL),         // /interact slap
    disparo:  tipo("hostil", HOSTIL),         // /interact bang
    punch:    tipo("hostil", HOSTIL),         // /interact punch
    // Regalo (/rol regalar → /rol buzon). Los puntos NO salen de base × mult:
    // los propone config/valorRegalo.js según el puntaje S del regalo y llegan
    // como `puntosBase` a resolverInteraccion. Usa el mismo tope diario por
    // pareja y retornos menguantes que las demás, pero sin cooldown por tipo.
    // Nunca resta (solo los regalos maliciosos de la fase 2 podrán hacerlo).
    regalo: {
        categoria: "afectuosa",
        base: 1,
        puntosVariables: true,
        sinEnfriamiento: true,
        respuestas: { abrir: { resultado: "correspondida", mult: 1, rivalidad: 0 } },
    },
}

// ─── Antiabuso ───────────────────────────────────────────────────────────────
// Por qué es por PAREJA y no por emisor: en la versión anterior A y B alternaban
// (A abraza, B abraza, A abraza...) y cada uno tenía su propio cooldown limpio,
// así que la pareja sumaba el doble de rápido. Al guardar el cooldown en el
// documento de la pareja, da igual quién inicie: el reloj es el mismo.
const ENFRIAMIENTO_TIPO_MS = 30 * 1000                                             // ⚙

// Por qué hay tope de ganancia Y de pérdida por separado: el de ganancia frena
// el farmeo entre dos cuentas cooperando; el de pérdida evita que alguien hunda
// una amistad en una sola tarde de malas respuestas.
const TOPE_DIARIO = {
    ganancia: 30,                                                                   // ⚙
    perdida: 20,   // valor absoluto                                                // ⚙
    // La rivalidad es otro eje y lleva su propio tope: así una pareja que se pasa
    // la tarde devolviéndose golpes no se vuelve "Rival" en un solo día.
    rivalidad: 30,                                                                  // ⚙
}

// Retornos menguantes: la n-ésima repetición del MISMO tipo en el día rinde
// Δ0 · r^n (n empieza en 0). Con r = 0.7 un abrazo da 6, 4, 3, 2, 1, 1, 1, 0...
// Así alternar tipos rinde más que spamear uno, y el spam se apaga solo antes
// incluso de llegar al tope.
const MENGUANTE_R = 0.7                                                             // ⚙

// ─── Pendientes (estado en custom_id) ────────────────────────────────────────
const PREFIJO_CUSTOM_ID = "amistad"
const SEPARADOR_CUSTOM_ID = "*"
const EXPIRACION_PENDIENTE_MS = 10 * MINUTO                                         // ⚙ PROVISIONAL

// ─── Rangos ──────────────────────────────────────────────────────────────────
// Los rangos, la histéresis (10 %), Rival/Enemigo y "Recuerdos Confusos" viven en
// config/rangosAmistad.js (rangoDe). Su ESCALA se calcula con TOPE_DIARIO.ganancia:
// si cambias ese tope, los umbrales de los rangos se recalculan solos.

// Límite de personajes en el tier "mejor_amigo" (desde "Mejores Amigos").
// Amigos sin límite.
const LIMITE_MEJORES_AMIGOS = 5   // rango del diseño: 3–5                          // ⚙

// ─── Enfriamiento de rencores ────────────────────────────────────────────────
// Los puntos NEGATIVOS se acercan a 0 con el tiempo sin contacto: los rencores
// de rol no deben ser eternos. Los positivos nunca decaen.
const ENFRIAMIENTO_NEGATIVO = {
    graciaDias: 3,       // días sin contacto antes de empezar a enfriar            // ⚙ PROVISIONAL
    puntosPorDia: 2,     // cuánto se acerca a 0 por cada día después de la gracia  // ⚙ PROVISIONAL
}

// Un lazo positivo sin contacto pasa a "en reposo" (bonos atenuados) sin perder el rango.
const DIAS_EN_REPOSO = 14                                                           // ⚙ PROVISIONAL

// ─── Duelo automático por cadena (easter egg) ────────────────────────────────
// Golpes seguidos en el mismo mensaje (el primero cuenta) a partir de los cuales,
// al superar el umbral, se intenta un duelo amistoso. punch: 3 → al cuarto golpe.
// Solo escalan tipos cuya respuesta tiene `continua` (hostiles con "Devolver",
// poke con "Seguir el juego").
// TODO(decisión): más tipos con cadena de duelo.
const UMBRAL_DUELO = {
    punch: 3,                                                                       // ⚙
    bofetada: 3,                                                                    // ⚙
    disparo: 3,                                                                     // ⚙
    poke: 10,                                                                       // ⚙
}
// Una misma pareja no puede encadenar duelos automáticos seguidos.
const ENFRIAMIENTO_DUELO_MS = 30 * MINUTO                                           // ⚙ PROVISIONAL
// Canal donde se transmiten los duelos (el mismo que usa sesionesCombate).
const CANAL_DUELOS = "1345239393786527784"

// ─── Privacidad: categoría "Interacciones" ───────────────────────────────────
// Campo social.privacidad.interacciones. Si el personaje lo configuró, aplica a
// todas sus interacciones; si no, se usa el valor por defecto de la categoría.
// Niveles: todos → amigos → mejores_amigos → companero → nadie (+ permitidos /
// bloqueados; el bloqueo se evalúa primero y siempre gana).
const PRIVACIDAD_INTERACCIONES = {
    // TODO(decisión): privacidad por defecto de las interacciones afectuosas.
    afectuosa: "todos",                                                             // ⚙ PROVISIONAL
    juguetona: "todos",                                                             // ⚙ PROVISIONAL
    hostil: "amigos",                                                               // ⚙
}

// ─── Compañero (FASE 4, solo estructura) ─────────────────────────────────────
const COMPANERO = {
    ecoAusente: 0.30,                                                               // ⚙
}

module.exports = {
    MINUTO, HORA, DIA,
    TIPOS,
    ENFRIAMIENTO_TIPO_MS,
    TOPE_DIARIO,
    MENGUANTE_R,
    PREFIJO_CUSTOM_ID,
    SEPARADOR_CUSTOM_ID,
    EXPIRACION_PENDIENTE_MS,
    LIMITE_MEJORES_AMIGOS,
    ENFRIAMIENTO_NEGATIVO,
    DIAS_EN_REPOSO,
    UMBRAL_DUELO,
    ENFRIAMIENTO_DUELO_MS,
    CANAL_DUELOS,
    PRIVACIDAD_INTERACCIONES,
    COMPANERO,
}
