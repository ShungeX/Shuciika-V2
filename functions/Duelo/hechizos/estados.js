// ─── Estados de control (V) ──────────────────────────────────────────────────
// Tres familias: Bloqueo (la vía no se puede usar), Degradación (funciona peor) y Total (Estasis).
// Este módulo es la única fuente de verdad sobre qué bloquea / degrada cada estado.
// Entiende tanto los estados nuevos ({ tipo:'control', bloquea:[...] }) como los antiguos
// guardados en personajes y objetos ({ id:'stun', Nombre:'Paralisis' }, { id:'slowed' }...).

const { VIAS, VIAS_VALIDAS, ESTADOS_VALORES } = require("./config")
const { quitarTildes } = require("./elementos")

const { HABLADO, MOVIMIENTO, ESCRITURA, MENTAL, INSTINTO } = VIAS

/**
 * Catálogo de estados. `alias` son fragmentos que reconocen nombres antiguos o de objetos.
 * El orden importa: se busca primero por nombre exacto y luego por alias.
 */
const ESTADOS = Object.freeze({
    paralisis: {
        nombre: "Parálisis", familia: "bloqueo",
        bloquea: [HABLADO, MOVIMIENTO, ESCRITURA, INSTINTO],
        alias: ["paralisis", "paral", "sueno", "sleep"],
    },
    inmovilizado: {
        nombre: "Inmovilizado", familia: "bloqueo",
        bloquea: [MOVIMIENTO, ESCRITURA],
        alias: ["inmovil", "atado", "enredado", "root", "enraiz"],
    },
    mutismo: {
        nombre: "Mutismo", familia: "bloqueo",
        bloquea: [HABLADO],
        alias: ["mutismo", "mudo"],
    },
    aturdimiento: {
        nombre: "Aturdimiento", familia: "bloqueo",
        bloquea: [MENTAL, ESCRITURA, INSTINTO],
        alias: ["aturd", "stun"],
    },
    cegado: {
        nombre: "Cegado", familia: "bloqueo",
        bloquea: [ESCRITURA],
        precision: ESTADOS_VALORES.CEGADO_PRECISION,
        alias: ["cegad", "ceguera", "blind"],
    },
    congelado: {
        nombre: "Congelado", familia: "bloqueo",
        bloquea: [HABLADO, MOVIMIENTO, ESCRITURA, INSTINTO],
        rompeConDanio: true,
        alias: ["congel", "freeze", "frozen"],
    },
    miedo: {
        nombre: "Miedo", familia: "degradacion",
        degrada: { tipo: "falla", valor: ESTADOS_VALORES.MIEDO },
        alias: ["miedo", "fear", "terror"],
    },
    confusion: {
        nombre: "Confusión", familia: "degradacion",
        degrada: { tipo: "desvio", valor: ESTADOS_VALORES.CONFUSION },
        alias: ["confus"],
    },
    lentitud: {
        nombre: "Lentitud", familia: "degradacion",
        lentitud: true,
        alias: ["lentitud", "slowed", "slow", "ralentiz"],
    },
    estasis: {
        nombre: "Estasis", familia: "total",
        bloquea: [...VIAS_VALIDAS],
        inmuneContra: "todo", pausa: true,
        alias: ["estasis", "stasis"],
    },
})

/** Estados que no son "efectos" de cara al jugador: marcas internas del motor. */
const MARCAS = Object.freeze({
    INMUNE_CONTROL: "inmune_control",
    INMUNE_INTERRUPCION: "inmune_interrupcion",
    ANTI_ESTASIS: "anti_estasis",
})

const norm = (t) => quitarTildes(t).replace(/\s+/g, "_")

/** Definición del catálogo que corresponde a un estado activo (o null si no es un estado de control). */
function definicionEstado(efecto) {
    if (!efecto || efecto.inmuneA || efecto.modStat) return null
    if (efecto.tipo === "estasis") return ESTADOS.estasis
    if (efecto.tipo && !["control", "degradacion", "legacy"].includes(efecto.tipo)) return null

    const candidatos = [efecto.nombre, efecto.Nombre, efecto.clave, efecto.id].filter(Boolean).map(norm)
    for (const c of candidatos) if (ESTADOS[c]) return ESTADOS[c]
    for (const c of candidatos) {
        for (const def of Object.values(ESTADOS)) {
            if (def.alias.some(a => c.includes(a))) return def
        }
    }
    return null
}

/**
 * Vista normalizada de un estado activo: qué familia es, qué vías bloquea, cómo degrada.
 * Los campos explícitos del dato (bloquea / degrada) ganan sobre el catálogo.
 */
function perfilEstado(efecto) {
    if (!efecto) return null
    const def = definicionEstado(efecto)
    const bloquea = Array.isArray(efecto.bloquea) ? efecto.bloquea : (def?.bloquea ?? [])
    const degrada = efecto.degrada ?? def?.degrada ?? null
    const inmuneContra = efecto.contra ?? def?.inmuneContra ?? null
    return {
        nombre: def?.nombre ?? efecto.Nombre ?? efecto.nombre ?? efecto.id ?? "Efecto",
        familia: def?.familia ?? (efecto.tipo === "inmunidad" ? "inmunidad" : null),
        bloquea,
        degrada,
        lentitud: Boolean(def?.lentitud || efecto.lentitud),
        rompeConDanio: Boolean(efecto.rompeConDanio ?? def?.rompeConDanio),
        precision: Number(efecto.precision ?? def?.precision ?? 0) || 0,
        inmuneContra,
        pausa: Boolean(efecto.pausa ?? def?.pausa),
    }
}

/** Lista de estados activos con su perfil ya resuelto. */
function efectosActivos(pj) {
    return (pj?.statusEffect || [])
        .filter(e => e && (Number(e.duracion) || 0) > 0)
        .map(e => ({ efecto: e, ...perfilEstado(e) }))
}

function viasBloqueadas(activos) {
    const set = new Set()
    for (const a of activos) for (const v of a.bloquea) set.add(v)
    return set
}

/** Nombres de los estados que bloquean alguna de esas vías ("Mutismo, Parálisis"). */
function quienBloquea(activos, vias) {
    const nombres = activos.filter(a => a.bloquea.some(v => vias.includes(v))).map(a => a.nombre)
    return [...new Set(nombres)].join(", ")
}

function enEstasis(pj) {
    return efectosActivos(pj).some(a => a.familia === "total")
}

/**
 * ¿Tiene una inmunidad contra algo? contra: 'todo' | 'muerte' | 'control' | 'interrupcion' | 'estasis'.
 * Una inmunidad 'todo' (Estasis) cubre cualquier cosa.
 */
function tieneInmunidad(pj, contra) {
    return efectosActivos(pj).some(a => a.inmuneContra === "todo" || a.inmuneContra === contra)
}

/** ¿Es un efecto negativo que un cleanse puede quitar? */
function esNegativo(efecto) {
    if (!efecto || efecto.inmuneA) return false
    if (efecto.modStat) return (Number(efecto.modStat.delta) || 0) < 0
    if (["control", "degradacion", "dot", "debuff"].includes(efecto.tipo)) return true
    if (efecto.tipo) return false
    const p = perfilEstado(efecto)
    if (p.familia === "bloqueo" || p.familia === "degradacion") return true
    return /veneno|quemadura|degeneracion|vulnerab|sangrado/.test(norm(efecto.id || efecto.Nombre))
}

/** ¿Es un estado de control (bloqueo)? Para la inmunidad breve tras control. */
function esControl(efecto) {
    if (!efecto) return false
    if (efecto.tipo === "control") return true
    if (efecto.tipo && efecto.tipo !== "legacy") return false
    return definicionEstado(efecto)?.familia === "bloqueo"
}

module.exports = {
    ESTADOS, MARCAS,
    definicionEstado, perfilEstado, efectosActivos, viasBloqueadas, quienBloquea,
    enEstasis, tieneInmunidad, esNegativo, esControl,
}
