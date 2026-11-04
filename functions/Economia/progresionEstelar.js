/**
 * ============================================================================
 * PROGRESIÓN ESTELAR — Polvo → Fragmentos Estelares → Resplandor
 * Basado en "Sistema de Polvo Estelar y Progresión" (secciones V y VI).
 *
 * Dónde vive cada cosa en el documento Soul (_id = personajeActivo):
 *   nucleo.polvoEstelar            → Polvo acumulado, se gasta al condensar
 *   sendero.StelarFragments        → Fragmentos disponibles (se gastan en stats)
 *   sendero.StelarFragmentsTotal   → Fragmentos ganados en total (nunca baja)
 *   sendero.resplandor             → 'I' … 'VII' (nunca retrocede)
 *
 * El Resplandor depende SOLO de StelarFragmentsTotal: gastar fragmentos en
 * stats no retrasa el rango.
 * Las variables marcadas con ⚙ están pensadas para ajustarse en pruebas.
 * ============================================================================
 */

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII"]

const UMBRALES_RESPLANDOR = [
    { rango: 1, fragmentosNecesarios: 0 },
    { rango: 2, fragmentosNecesarios: 20 },
    { rango: 3, fragmentosNecesarios: 50 },
    { rango: 4, fragmentosNecesarios: 100 },
    { rango: 5, fragmentosNecesarios: 180 },
    { rango: 6, fragmentosNecesarios: 300 },
    { rango: 7, fragmentosNecesarios: 480 },
]

// ─── Conversión de formatos ──────────────────────────────────────────────────

/** 'IV', 'iv', 4, null… → 1..7 */
function resplandorANumero(resplandor) {
    if (typeof resplandor === "number" && Number.isFinite(resplandor)) {
        return Math.min(7, Math.max(1, Math.floor(resplandor)))
    }
    const idx = ROMANOS.indexOf(String(resplandor ?? "I").toUpperCase().trim())
    return idx >= 0 ? idx + 1 : 1
}

/** 1..7 → 'I'..'VII' */
function numeroARomano(n) {
    return ROMANOS[resplandorANumero(n) - 1]
}

// ─── Curva de Valle (costo por fragmento) ────────────────────────────────────

/** Destellos de la fase de tensión: el costo cae brevemente en tramos fijos. */
function puntoDeIgnicion(f) {
    if (f >= 300 && f <= 320) return 0.35 // ⚙ Primer destello — Resplandor V
    if (f >= 380 && f <= 395) return 0.30 // ⚙ Segundo destello — Resplandor VI
    if (f >= 445 && f <= 455) return 0.40 // ⚙ Tercer destello — antesala de Ascensión
    return 0
}

/**
 * Polvo que cuesta el SIGUIENTE fragmento, según los fragmentos ganados en total.
 * Nube (lento) → Boom (barato) → Tensión épica (sube, con destellos).
 */
function costoFragmento(fragmentosGanadosTotales) {
    const f = Math.max(0, Number(fragmentosGanadosTotales) || 0)

    if (f < 120) return Math.floor(120 - f * 0.35)        // Nube: 120 → 78
    if (f < 250) return Math.floor(78 - (f - 120) * 0.45) // Boom: 78 → 20

    const baseSubida = 20 + (f - 250) * 0.28              // ⚙ pendiente de tensión
    return Math.max(1, Math.floor(baseSubida * (1 - puntoDeIgnicion(f))))
}

// ─── Resplandor ──────────────────────────────────────────────────────────────

/** Rango (1..7) que corresponde a un total de fragmentos ganados. */
function rangoPorFragmentos(fragmentosGanadosTotales) {
    const total = Math.max(0, Number(fragmentosGanadosTotales) || 0)
    let rango = 1
    for (const u of UMBRALES_RESPLANDOR) {
        if (total >= u.fragmentosNecesarios) rango = u.rango
    }
    return rango
}

/** Fragmentos totales que faltan para el siguiente rango (null si ya es VII). */
function fragmentosParaSiguienteRango(fragmentosGanadosTotales, resplandorActual) {
    const actual = resplandorANumero(resplandorActual)
    const siguiente = UMBRALES_RESPLANDOR.find(u => u.rango === actual + 1)
    if (!siguiente) return null
    return Math.max(0, siguiente.fragmentosNecesarios - (Number(fragmentosGanadosTotales) || 0))
}

/** Máximo de puntos que se pueden invertir en un mismo stat. */
function techoStatPorResplandor(resplandor) {
    return resplandorANumero(resplandor) * 5 // ⚙
}

// ─── Lectura normalizada del alma ────────────────────────────────────────────

/**
 * Extrae el progreso de un documento Soul.
 * Las almas antiguas sin StelarFragmentsTotal usan StelarFragments como total.
 */
function leerProgreso(soul = {}) {
    const sendero = soul.sendero || {}
    const disponibles = Number(sendero.StelarFragments ?? 0) || 0
    const ganados = Number(sendero.StelarFragmentsTotal ?? disponibles) || 0
    const resplandor = resplandorANumero(sendero.resplandor)
    return {
        polvo: Number(soul.nucleo?.polvoEstelar ?? 0) || 0,
        disponibles,
        ganados,
        resplandor,
        resplandorRomano: numeroARomano(resplandor),
        tieneTotal: sendero.StelarFragmentsTotal !== undefined && sendero.StelarFragmentsTotal !== null,
    }
}

/**
 * Calcula, sin tocar la BD, cuántos fragmentos se pueden condensar.
 * El costo se recalcula fragmento a fragmento porque la curva cambia con cada uno.
 */
function simularConversion(polvo, ganados, maxFragmentos = Infinity) {
    let restante = Math.max(0, Number(polvo) || 0)
    let total = Math.max(0, Number(ganados) || 0)
    let fragmentos = 0
    let gasto = 0
    const limite = Number.isFinite(maxFragmentos) ? Math.max(0, Math.floor(maxFragmentos)) : Infinity

    while (fragmentos < limite) {
        const costo = costoFragmento(total)
        if (restante < costo) break
        restante -= costo
        gasto += costo
        total += 1
        fragmentos += 1
    }

    const costoSiguiente = costoFragmento(total)
    return {
        fragmentos,
        gasto,
        polvoRestante: restante,
        nuevoTotal: total,
        costoSiguiente,
        faltante: Math.max(0, costoSiguiente - restante),
    }
}

// ─── Conversión persistente ──────────────────────────────────────────────────

/**
 * Condensa Polvo Estelar en Fragmentos Estelares para un personaje.
 * Solo backend: la UI que lo dispare decide cuándo llamarla.
 *
 * La escritura es condicional al estado leído (polvo y total previos), así dos
 * conversiones simultáneas no pueden gastar el mismo polvo; si el alma cambió
 * entre la lectura y la escritura se reintenta.
 *
 * @param {Number} personajeId - _id del Soul (personaje activo)
 * @param {Object} [opciones]
 * @param {Number} [opciones.maxFragmentos=Infinity] - 1 para convertir de uno en uno
 * @returns {Promise<{exito:Boolean, fragmentos:Number, gasto:Number, polvoRestante:Number,
 *   nuevoTotal:Number, disponibles:Number, costoSiguiente:Number, faltante:Number,
 *   resplandorAnterior:String, resplandorNuevo:String, subioResplandor:Boolean, motivo?:String}>}
 */
async function convertirPolvo(personajeId, { maxFragmentos = Infinity } = {}) {
    // Carga perezosa: el resto del módulo es puro y lo importa el combate
    const souls = require("../../Server").db("Rol_db").collection("Soul")
    const id = Number(personajeId)

    for (let intento = 0; intento < 3; intento++) {
        const soul = await souls.findOne(
            { _id: id },
            { projection: { "nucleo.polvoEstelar": 1, sendero: 1 } }
        )
        if (!soul) return { exito: false, motivo: "sin_alma", fragmentos: 0, gasto: 0 }

        const prog = leerProgreso(soul)
        const sim = simularConversion(prog.polvo, prog.ganados, maxFragmentos)
        const base = {
            polvoRestante: prog.polvo,
            nuevoTotal: prog.ganados,
            disponibles: prog.disponibles,
            costoSiguiente: sim.costoSiguiente,
            faltante: sim.faltante,
            resplandorAnterior: prog.resplandorRomano,
            resplandorNuevo: prog.resplandorRomano,
            subioResplandor: false,
        }

        if (sim.fragmentos === 0) {
            return { exito: false, motivo: "polvo_insuficiente", fragmentos: 0, gasto: 0, ...base }
        }

        // El Resplandor nunca retrocede
        const rangoNuevo = Math.max(prog.resplandor, rangoPorFragmentos(sim.nuevoTotal))
        const filtro = { _id: id, "nucleo.polvoEstelar": prog.polvo }
        filtro["sendero.StelarFragmentsTotal"] = prog.tieneTotal ? prog.ganados : { $exists: false }

        const r = await souls.updateOne(filtro, {
            $inc: {
                "nucleo.polvoEstelar": -sim.gasto,
                "sendero.StelarFragments": sim.fragmentos,
            },
            $set: {
                "sendero.StelarFragmentsTotal": sim.nuevoTotal,
                "sendero.resplandor": numeroARomano(rangoNuevo),
            },
        })

        if (r.modifiedCount === 1) {
            return {
                exito: true,
                fragmentos: sim.fragmentos,
                gasto: sim.gasto,
                polvoRestante: sim.polvoRestante,
                nuevoTotal: sim.nuevoTotal,
                disponibles: prog.disponibles + sim.fragmentos,
                costoSiguiente: sim.costoSiguiente,
                faltante: sim.faltante,
                resplandorAnterior: prog.resplandorRomano,
                resplandorNuevo: numeroARomano(rangoNuevo),
                subioResplandor: rangoNuevo > prog.resplandor,
            }
        }
        // El alma cambió entre lectura y escritura: volver a leer
    }

    return { exito: false, motivo: "conflicto", fragmentos: 0, gasto: 0 }
}

// ─── Mejora de stats con Fragmentos ──────────────────────────────────────────

const COSTO_FE_POR_PUNTO = 10 // ⚙ FE que cuesta subir 1 punto de un stat

/** Stats que se muestran en el menú del alma, en orden. */
const STATS_MOSTRAR = [
    { clave: "hpMax", nombre: "HP Máx", emoji: "❤️" },
    { clave: "manaMax", nombre: "Mana Máx", emoji: "🔷" },
    { clave: "fuerza", nombre: "Fuerza", emoji: "💪" },
    { clave: "agilidad", nombre: "Agilidad", emoji: "💨" },
    { clave: "sabiduria", nombre: "Sabiduría", emoji: "🔍" },
    { clave: "inteligencia", nombre: "Inteligencia", emoji: "🧠" },
    { clave: "sintoniaElemental", nombre: "Sintonía Elemental", emoji: "🪄" },
    { clave: "resFisica", nombre: "Resistencia Física", emoji: "🥊" },
    { clave: "resMagica", nombre: "Resistencia Mágica", emoji: "🔥" },
    { clave: "determinacion", nombre: "Determinación", emoji: "🛡️" },
]

/** Stats que se pueden mejorar con Fragmentos Estelares. */
const STATS_MEJORABLES = ["fuerza", "agilidad", "sabiduria", "inteligencia", "sintoniaElemental", "resFisica", "resMagica", "determinacion"]

/** Nombres alternativos con los que algunas almas antiguas guardan el mismo stat. */
const ALIAS_STAT = {
    resFisica: ["resFisica", "resistenciaFisica"],
    resMagica: ["resMagica", "resistenciaMagica"],
    sintoniaElemental: ["sintoniaElemental", "sintonia"],
    determinacion: ["determinacion", "voluntad"],
}

/** Clave con la que ESTA alma guarda el stat (o la canónica si no tiene ninguna). */
function claveStatEnAlma(stats = {}, clave) {
    const alias = ALIAS_STAT[clave] || [clave]
    return alias.find(a => stats[a] !== undefined && stats[a] !== null) || clave
}

function valorStat(stats = {}, clave) {
    return Number(stats[claveStatEnAlma(stats, clave)]) || 0
}

/** Mejoras compradas con FE en un stat (Soul.sendero.mejoras.<clave>). */
function mejorasCompradas(soul = {}, clave) {
    return Number(soul.sendero?.mejoras?.[clave]) || 0
}

/**
 * Sube un stat gastando Fragmentos Estelares disponibles.
 * Respeta el techo por Resplandor (Resplandor × 5 mejoras compradas por stat).
 * La escritura es condicional: si otra acción gastó los FE o subió el stat entre
 * la lectura y la escritura, no se aplica nada.
 *
 * @param {Number} personajeId - _id del Soul
 * @param {String} clave - una de STATS_MEJORABLES
 * @param {Number} puntos - puntos a subir (entero ≥ 1)
 * @returns {Promise<{exito:Boolean, motivo?:String, clave?:String, puntos?:Number, costo?:Number,
 *   valorNuevo?:Number, disponibles?:Number, compradas?:Number, techo?:Number}>}
 */
async function mejorarStat(personajeId, clave, puntos) {
    if (!STATS_MEJORABLES.includes(clave)) return { exito: false, motivo: "stat_invalido" }
    const n = Math.floor(Number(puntos))
    if (!Number.isFinite(n) || n < 1) return { exito: false, motivo: "puntos_invalidos" }

    const souls = require("../../Server").db("Rol_db").collection("Soul")
    const id = Number(personajeId)
    const soul = await souls.findOne({ _id: id }, { projection: { stats: 1, sendero: 1 } })
    if (!soul) return { exito: false, motivo: "sin_alma" }

    const prog = leerProgreso(soul)
    const techo = techoStatPorResplandor(prog.resplandor)
    const compradas = mejorasCompradas(soul, clave)
    const costo = n * COSTO_FE_POR_PUNTO
    const base = { clave, puntos: n, costo, disponibles: prog.disponibles, compradas, techo }

    if (compradas + n > techo) return { exito: false, motivo: "techo", ...base }
    if (prog.disponibles < costo) return { exito: false, motivo: "fe_insuficiente", ...base }

    const claveReal = claveStatEnAlma(soul.stats || {}, clave)
    const rutaMejoras = `sendero.mejoras.${clave}`
    const filtro = {
        _id: id,
        "sendero.StelarFragments": { $gte: costo },
        $or: [{ [rutaMejoras]: { $exists: false } }, { [rutaMejoras]: { $lte: techo - n } }],
    }
    const r = await souls.updateOne(filtro, {
        $inc: {
            [`stats.${claveReal}`]: n,
            "sendero.StelarFragments": -costo,
            [rutaMejoras]: n,
        },
    })
    if (r.modifiedCount !== 1) return { exito: false, motivo: "conflicto", ...base }

    return {
        exito: true,
        ...base,
        valorNuevo: valorStat(soul.stats || {}, clave) + n,
        disponibles: prog.disponibles - costo,
        compradas: compradas + n,
    }
}

module.exports = {
    COSTO_FE_POR_PUNTO,
    STATS_MOSTRAR,
    STATS_MEJORABLES,
    claveStatEnAlma,
    valorStat,
    mejorasCompradas,
    mejorarStat,
    ROMANOS,
    UMBRALES_RESPLANDOR,
    resplandorANumero,
    numeroARomano,
    puntoDeIgnicion,
    costoFragmento,
    rangoPorFragmentos,
    fragmentosParaSiguienteRango,
    techoStatPorResplandor,
    leerProgreso,
    simularConversion,
    convertirPolvo,
}
