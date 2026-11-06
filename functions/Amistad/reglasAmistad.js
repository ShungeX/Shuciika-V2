// ─────────────────────────────────────────────────────────────────────────────
// Reglas puras del Sistema de Amistad: sin base de datos ni Discord.
//
// Todo lo que decide CUÁNTOS puntos da una interacción vive aquí, para poder
// probarlo con `node` sin conectarse a Mongo. `amistades.js` lee el documento,
// llama a `calcularResolucion` y aplica el update que devuelve.
//
// Recordatorios del diseño:
//   • La amistad es entre personajes. Dos personajes de la misma cuenta no pueden
//     tener amistad (se valida en amistades.js con ownerID).
//   • Rechazar o ser rechazado NO toca la Reputación Social. Este módulo no la lee
//     ni la escribe a propósito.
//   • El tope controla los PUNTOS, nunca la acción: la interacción siempre se
//     resuelve, el historial siempre sube, y si no hay puntos siempre hay una
//     línea que explica por qué.
// ─────────────────────────────────────────────────────────────────────────────
const cfg = require("../../config/amistad")
const rangos = require("../../config/rangosAmistad")

const FIRMA = "♡( ◡‿◡ )"
// Cuando la respuesta resta puntos, el corazón no pega con el momento.
const FIRMA_NEGATIVA = '(¬_¬")'

/** _id de la pareja: los dos ids como texto, ordenados, unidos por "*". */
const idPareja = (a, b) => [String(a), String(b)].sort().join("*")

function docNuevo(a, b, ahora = Date.now()) {
    return {
        _id: idPareja(a, b),
        miembros: [String(a), String(b)].sort(),
        // Se escribe una sola vez, en el upsert del primer intercambio.
        creadoEn: new Date(ahora),
        puntos: 0,              // neto, puede ser negativo
        // Acumulados BRUTOS de por vida (nunca bajan). Sostienen "Recuerdos Confusos":
        // el neto solo no distingue "nunca pasó nada" de "pasó de todo".
        ganadosTotal: 0,
        perdidosTotal: 0,       // valor absoluto
        rivalidad: 0,
        // Último rango base calculado: es la memoria de la histéresis.
        rangoBaseId: "desconocidos",
        esCompanero: false,
        historial: {},
        ultima: null,
        // Mapa acotado (una clave por TIPO, no por interacción): última vez que
        // cada tipo dio puntos. Es lo que sostiene el cooldown por pareja y tipo;
        // `ultima` solo recuerda el último tipo y se esquivaría alternando tipos.
        ultimaPorTipo: {},
        diario: { fecha: null, ganados: 0, perdidos: 0, rivalidad: 0, porTipo: {} },
        // Control de concurrencia optimista: cada update exige el `rev` que leyó.
        rev: 0,
    }
}

const ms = (fecha) => (fecha instanceof Date ? fecha.getTime() : Number(fecha) || 0)

/** Redondeo simétrico que nunca devuelve -0. */
function redondear(x) {
    const r = Math.sign(x) * Math.round(Math.abs(x))
    return r === 0 ? 0 : r
}

/**
 * Puntos con el enfriamiento de rencores aplicado. Solo los negativos se acercan
 * a 0; los positivos no decaen nunca.
 */
function puntosEnfriados(puntos, ultimaFecha, ahora = Date.now()) {
    if (!(puntos < 0) || !ultimaFecha) return puntos
    const { graciaDias, puntosPorDia } = cfg.ENFRIAMIENTO_NEGATIVO
    const dias = (ahora - ms(ultimaFecha)) / cfg.DIA
    const diasEfectivos = Math.max(0, dias - graciaDias)
    return Math.min(0, puntos + Math.floor(diasEfectivos * puntosPorDia))
}

/** Pareja con el rencor enfriado aplicado (lo que se usa para leer el rango). */
function parejaEnfriada(doc, ahora = Date.now()) {
    if (!doc) return null
    return { ...doc, puntos: puntosEnfriados(doc.puntos || 0, doc.ultima?.fecha, ahora) }
}

/**
 * Lectura del estado de una pareja (no se guarda nada de esto).
 *   rango:    rangoDe() de config/rangosAmistad.js
 *   tier:     "conocido" | "amigo" | "mejor_amigo" (privacidad)
 *   etiqueta: "rival" | "enemigo" | null   (solo con puntos < 0)
 *   enReposo: lazo positivo sin contacto reciente (bonos atenuados, rango intacto)
 */
function estadoAmistad(doc, ahora = Date.now()) {
    const p = parejaEnfriada(doc, ahora)
    const rango = rangos.rangoDe(p)
    const etiqueta = rango.estado === "rival" || rango.estado === "enemigo" ? rango.estado : null
    if (!doc) return { existe: false, puntos: 0, rango, tier: rango.tier, esCompanero: false, etiqueta, enReposo: false, rivalidad: 0 }
    const ultimaFecha = doc.ultima?.fecha
    const enReposo = p.puntos > 0 && !!ultimaFecha && (ahora - ms(ultimaFecha)) >= cfg.DIAS_EN_REPOSO * cfg.DIA
    return {
        existe: true,
        puntos: p.puntos,
        rango,
        tier: rango.tier,
        esCompanero: !!doc.esCompanero,
        etiqueta,
        enReposo,
        rivalidad: doc.rivalidad || 0,
    }
}

/**
 * Calcula el desenlace de una respuesta del receptor y el update de Mongo que lo
 * aplica. No escribe nada.
 *
 * @param {object} p
 * @param {object} p.doc        Documento actual de la pareja (debe existir, ver amistades.js)
 * @param {string} p.tipo       Clave de cfg.TIPOS (abrazo, punch...)
 * @param {string} p.respuesta  Clave de cfg.TIPOS[tipo].respuestas
 * @param {string} p.de         _id del personaje que INICIÓ la interacción
 * @param {number} p.ahora      ms
 * @param {string} p.hoy        "YYYY-MM-DD" (día de México, mismo corte que la economía)
 * @param {boolean} [p.mejorAmigoBloqueado] Si alguno ya llegó al límite de Mejores amigos
 * @param {number}  [p.puntosPropuestos] Solo tipos con `puntosVariables` (regalo): puntos propuestos
 *                                 antes de menguantes y tope; sustituye a base × mult.
 */
function calcularResolucion({ doc, tipo, respuesta, de, ahora, hoy, mejorAmigoBloqueado = false, puntosPropuestos = null }) {
    const tipoCfg = cfg.TIPOS[tipo]
    if (!tipoCfg) return { ok: false, motivo: "tipo_desconocido" }
    const resp = tipoCfg.respuestas[respuesta]
    if (!resp) return { ok: false, motivo: "respuesta_desconocida" }
    // Tipos de puntos variables: sin puntos propuestos no hay nada que aplicar; nunca negativos.
    const variable = Boolean(tipoCfg.puntosVariables)
    if (variable && (puntosPropuestos === null || puntosPropuestos === undefined || !(Number(puntosPropuestos) >= 0))) return { ok: false, motivo: "puntos_requeridos" }
    const propuesta = variable ? Math.max(0, Math.round(Number(puntosPropuestos))) : null

    // ── Día: el tope se reinicia comparando la fecha guardada, sin cron ─────
    const mismoDia = doc.diario?.fecha === hoy
    const diario = mismoDia
        ? { ganados: doc.diario.ganados || 0, perdidos: doc.diario.perdidos || 0, rivalidad: doc.diario.rivalidad || 0, porTipo: doc.diario.porTipo || {} }
        : { ganados: 0, perdidos: 0, rivalidad: 0, porTipo: {} }

    // ── Rencor enfriado antes de sumar lo nuevo ─────────────────────────────
    const puntosPrevios = doc.puntos || 0
    const puntosBase = puntosEnfriados(puntosPrevios, doc.ultima?.fecha, ahora)

    // ── ¿Esta respuesta puede mover puntos? ─────────────────────────────────
    // Un regalo sin valor (propuesta 0) no cuenta como repetición: no gasta el menguante del día.
    const neutral = resp.resultado === "neutral" || resp.mult === 0 || propuesta === 0
    const ultimaTipo = ms(doc.ultimaPorTipo?.[tipo])
    // Cooldown por PAREJA y TIPO, en ambas direcciones (ver config: ping-pong).
    const enEnfriamiento = !neutral && !tipoCfg.sinEnfriamiento && ultimaTipo > 0 && (ahora - ultimaTipo) < cfg.ENFRIAMIENTO_TIPO_MS
    const cuenta = !neutral && !enEnfriamiento   // ¿cuenta como repetición del día?

    let bruto = 0
    let aplicado = 0
    let motivoSinPuntos = null
    let recortado = false

    if (neutral) {
        motivoSinPuntos = propuesta === 0 ? "sin_valor" : "neutral"
    } else if (enEnfriamiento) {
        motivoSinPuntos = "enfriamiento"
    } else {
        // Retornos menguantes: n = cuántas veces este tipo ya contó hoy en la pareja.
        const n = diario.porTipo[tipo] || 0
        bruto = redondear((variable ? propuesta : tipoCfg.base * resp.mult) * Math.pow(cfg.MENGUANTE_R, n))

        if (bruto === 0) {
            motivoSinPuntos = "menguante"
        } else if (bruto > 0) {
            const disponible = Math.max(0, cfg.TOPE_DIARIO.ganancia - diario.ganados)
            aplicado = Math.min(bruto, disponible)
        } else {
            const disponible = Math.max(0, cfg.TOPE_DIARIO.perdida - diario.perdidos)
            aplicado = -Math.min(-bruto, disponible)
        }
        if (bruto !== 0 && aplicado === 0) motivoSinPuntos = bruto > 0 ? "tope_ganancia" : "tope_perdida"
        else if (aplicado !== bruto) recortado = true
    }

    // Rivalidad: sube con hostiles CORRESPONDIDAS (devuelta o con humor). Respeta
    // el cooldown para que no se pueda inflar a clics, y tiene su PROPIO tope
    // diario (no comparte el de puntos: llegar al tope de amistad no congela la
    // rivalidad ni al revés).
    const rivalidadBruta = (cuenta && resp.resultado === "correspondida") ? (resp.rivalidad || 0) : 0
    const rivalidadDisponible = Math.max(0, cfg.TOPE_DIARIO.rivalidad - diario.rivalidad)
    const incRivalidad = Math.min(rivalidadBruta, rivalidadDisponible)

    // ── Rango ───────────────────────────────────────────────────────────────
    // El rango base nuevo se calcula aquí, con el doc que se leyó, y viaja en el
    // MISMO update protegido por `rev`. Es equivalente a "aplicar el $inc, releer
    // y guardar rangoBaseId si cambió", pero sin una segunda escritura que pueda
    // cruzarse con otra resolución.
    const puntosNuevos = puntosBase + aplicado
    const ganados = aplicado > 0 ? aplicado : 0
    const perdidos = aplicado < 0 ? -aplicado : 0
    const rangoAnterior = rangos.rangoDe({ ...doc, puntos: puntosBase })
    const despues = {
        ...doc,
        puntos: puntosNuevos,
        rivalidad: (doc.rivalidad || 0) + incRivalidad,
        ganadosTotal: (doc.ganadosTotal || 0) + ganados,
        perdidosTotal: (doc.perdidosTotal || 0) + perdidos,
        rangoBaseId: rangoAnterior.baseId,
        rangoTope: undefined,
    }
    // Límite de Mejores amigos: si la pareja entraría al tier "mejor_amigo" y alguno
    // ya tiene el cupo lleno, se queda en el techo de "amigo" (rangoTope) hasta que
    // haya lugar. Cada resolución lo vuelve a comprobar.
    const esMejor = (id) => rangos.IDS_MEJOR_AMIGO.includes(id)
    const baseLibre = rangos.baseIdDe(puntosNuevos, despues.rangoBaseId)
    const subeAMejorAmigo = esMejor(baseLibre) && !esMejor(rangoAnterior.baseId)
    const limiteMejoresAmigos = subeAMejorAmigo && mejorAmigoBloqueado
    if (limiteMejoresAmigos) despues.rangoTope = rangos.TECHO_SIN_MEJOR_AMIGO
    const rango = rangos.rangoDe(despues)
    const idxRango = (id) => rangos.RANGOS.findIndex(r => r.id === id)

    // ── Update ──────────────────────────────────────────────────────────────
    const inc = { rev: 1, [`historial.${tipo}.total`]: 1 }
    if (ganados) inc.ganadosTotal = ganados
    if (perdidos) inc.perdidosTotal = perdidos
    if (resp.resultado === "correspondida") inc[`historial.${tipo}.correspondidas`] = 1
    if (resp.resultado === "rechazada") inc[`historial.${tipo}.rechazadas`] = 1
    if (puntosNuevos !== puntosPrevios) inc.puntos = puntosNuevos - puntosPrevios
    if (incRivalidad) inc.rivalidad = incRivalidad

    const set = {
        rangoBaseId: rango.baseId,
        ultima: {
            tipo,
            de: String(de),
            respuesta,
            fecha: new Date(ahora),
            repeticiones: doc.ultima?.tipo === tipo ? (doc.ultima.repeticiones || 1) + 1 : 1,
        },
    }
    if (cuenta) set[`ultimaPorTipo.${tipo}`] = new Date(ahora)
    if (limiteMejoresAmigos) set.rangoTope = despues.rangoTope
    const unset = {}
    if (!limiteMejoresAmigos && doc.rangoTope) unset.rangoTope = ""
    // Documentos de la versión anterior: `nivel` ya no se usa (lo reemplaza rangoBaseId).
    if (doc.nivel !== undefined) unset.nivel = ""
    if (mismoDia) {
        if (ganados) inc["diario.ganados"] = ganados
        if (perdidos) inc["diario.perdidos"] = perdidos
        if (incRivalidad) inc["diario.rivalidad"] = incRivalidad
        if (cuenta) inc[`diario.porTipo.${tipo}`] = 1
    } else {
        // Racha: días SEGUIDOS (día de México) con al menos un intercambio
        // resuelto. Se calcula solo al cambiar de día; si el último día con
        // intercambio fue ayer, sigue; si no, vuelve a empezar.
        set.racha = doc.diario?.fecha && doc.diario.fecha === diaAnterior(hoy) ? (doc.racha || 1) + 1 : 1
        // Día nuevo: se reemplaza el bloque entero (no se puede $set y $inc la misma ruta).
        set.diario = {
            fecha: hoy,
            ganados,
            perdidos,
            rivalidad: incRivalidad,
            porTipo: cuenta ? { [tipo]: 1 } : {},
        }
    }

    const h = doc.historial?.[tipo] || {}
    const historial = {
        total: (h.total || 0) + 1,
        correspondidas: (h.correspondidas || 0) + (resp.resultado === "correspondida" ? 1 : 0),
        rechazadas: (h.rechazadas || 0) + (resp.resultado === "rechazada" ? 1 : 0),
    }

    const docDespues = { ...despues, ultima: set.ultima }
    const update = { $inc: inc, $set: set }
    if (Object.keys(unset).length) update.$unset = unset

    return {
        ok: true,
        subeAMejorAmigo,
        update,
        resultado: {
            tipo,
            categoria: tipoCfg.categoria,
            respuesta,
            resultado: resp.resultado,
            puntos: aplicado,
            puntosSinTope: bruto,
            // Hacia dónde iba la respuesta aunque no haya movido puntos (cooldown,
            // tope...): decide el kaomoji de la línea de puntos.
            signo: Math.sign(tipoCfg.base * resp.mult),
            motivoSinPuntos,
            recortado,
            puntosTotales: puntosNuevos,
            rangoAnterior,
            rango,
            cambioRango: rango.nombre !== rangoAnterior.nombre,
            subioRango: idxRango(rango.baseId) > idxRango(rangoAnterior.baseId),
            bajoRango: idxRango(rango.baseId) < idxRango(rangoAnterior.baseId),
            limiteMejoresAmigos,
            rivalidad: docDespues.rivalidad,
            rivalidadTopeada: rivalidadBruta > 0 && incRivalidad < rivalidadBruta,
            historial,
            estado: estadoAmistad(docDespues, ahora),
            // Para la cadena del duelo (FASE 3): la cadena vive en el custom_id y
            // sigue aunque se haya llegado al tope, porque no depende de los puntos.
            continuaCadena: resp.resultado === "correspondida",
        },
    }
}

/** "YYYY-MM-DD" del día anterior. */
function diaAnterior(hoy) {
    const d = new Date(`${hoy}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().slice(0, 10)
}

/**
 * Racha que se muestra hoy: si el último día con intercambio no es hoy ni ayer,
 * la racha ya se rompió aunque el documento guarde el número viejo.
 */
function rachaVigente(doc, hoy) {
    const f = doc?.diario?.fecha
    if (!f || (f !== hoy && f !== diaAnterior(hoy))) return 0
    return doc.racha || 1   // documentos anteriores a la racha: al menos el día guardado
}

/** Una interacción que expiró (o cuyo receptor cayó a HP 0) vale 0 y no es rechazo. No se escribe nada. */
function resultadoExpirado(tipo) {
    return { tipo, resultado: "expirada", puntos: 0, motivoSinPuntos: "expirada", continuaCadena: false }
}

// ─── Textos (voz de Shuciika) ────────────────────────────────────────────────
const TEXTOS = {
    misma_cuenta: `Tus personajes ya se conocen de memoria; la amistad florece con otras almas ${FIRMA}`,
    mismo_personaje: `Quererse a una misma es precioso, pero esto necesita a alguien más ${FIRMA}`,
    sin_dueno: `No logro reconocer a uno de los dos personajes, ¿lo intentamos en un ratito? ${FIRMA}`,
    concurrencia: `Pasaron muchas cosas a la vez y me enredé un poquito, ¿lo intentan otra vez? ${FIRMA}`,
}

/**
 * Línea de puntos para el mensaje. Nunca devuelve vacío: si no hubo puntos,
 * explica por qué con cariño.
 */
function lineaPuntos(r) {
    if (!r) return ""
    const k = (r.puntos < 0 || r.signo < 0) ? FIRMA_NEGATIVA : FIRMA
    if (r.puntos > 0) return `-# P. amistad: +${r.puntos}${r.recortado ? ` · por hoy ya no se acercan más ${k}` : ""}`
    if (r.puntos < 0) return `-# P. amistad: ${r.puntos}${r.recortado ? ` · por hoy no se alejan más ${k}` : ""}`
    switch (r.motivoSinPuntos) {
        case "tope_ganancia": return `-# Por hoy ya no se acercan más ${k}`
        case "tope_perdida": return `-# Por hoy ya no se alejan más, mañana será otro día ${k}`
        case "enfriamiento": return `-# Acaban de compartir un momento así, dejemos que respire un poquito ${k}`
        case "menguante": return `-# Ya interactuaron muchas veces hoy, ¿y si prueban algo distinto? ${k}`
        case "neutral": return `-# Esta vez lo dejaron pasar ${k}`
        case "expirada": return `-# Se quedó en el aire, no pasa nada ${k}`
        default: return `-# Esta vez no cambió nada entre ustedes ${k}`
    }
}

// ─── Hooks para fases futuras (no implementados a propósito) ─────────────────
/** FASE 3+: pequeño bonus en duelos entre Rivales. Hoy no da nada. */
function bonusDueloRivales(/* estado */) {
    // TODO(decisión): magnitud y en qué stat se aplica.
    return 0
}

/** FASE 4: bonos del Compañero (mismo bando en combate, botín al romperse el Talismán de Umbral, eco ~30%). */
function bonoCompanero(/* { estado, contexto, presente } */) {
    // TODO(decisión): bonos concretos del Compañero. Si la amistad cae, los bonos se
    // apagan pero el pacto (esCompanero) se mantiene.
    return null
}

module.exports = {
    FIRMA,
    FIRMA_NEGATIVA,
    TEXTOS,
    idPareja,
    docNuevo,
    puntosEnfriados,
    parejaEnfriada,
    estadoAmistad,
    calcularResolucion,
    resultadoExpirado,
    diaAnterior,
    rachaVigente,
    lineaPuntos,
    bonusDueloRivales,
    bonoCompanero,
}
