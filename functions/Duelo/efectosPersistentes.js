// ─── Efectos persistentes ────────────────────────────────────────────────────
// Los efectos (hechizos, objetos, venenos, buffs...) se quedan en el personaje al
// terminar un combate: se guardan en Soul.nucleo.efectos con sus rondas restantes.
// Fuera de combate no cambian; solo bajan cuando el personaje actúa en otro combate.
// Excepción: los combates amistosos no los consumen ni los guardan.

/** Campos de un estado que se conservan entre combates (lo demás es propio de la sesión). */
const CAMPOS_EFECTO = [
    "id", "Nombre", "nombre", "base", "duracion", "modStat", "grado", "objetivo",
    // Formato de efectos de hechizo (Sistema de hechizos): sin esto, un control guardado
    // perdería las vías que bloquea al volver a cargarse.
    "tipo", "bloquea", "degrada", "stat", "valor", "cero", "puntos", "contra", "rompeConDanio",
]

/**
 * Estados que solo tienen sentido dentro del combate en que nacieron: marcas internas del motor
 * (inmunidad tras control, anti-Estasis), la propia Estasis, Guardia, Provocar, Tregua y escudos.
 */
const TIPOS_SOLO_COMBATE = new Set(["estasis", "guardia", "provocar", "inmunidad", "escudo"])

/**
 * Combate amistoso: los efectos no se guardan en los personajes.
 * - Salas de prueba (modeTest)
 * - Salas creadas como "amistoso"
 * - PvP (sin NPCs) sin apuestas de Lumens ni objetos
 */
function esCombateAmistoso(sesion = {}) {
    if (sesion.modeTest) return true
    if (String(sesion.type || "").toLowerCase() === "amistoso") return true

    const combatientes = typeof sesion.getAllCombatientes === "function" ? sesion.getAllCombatientes() : []
    const esPvP = combatientes.length > 0 && !combatientes.some(c => c.isNPC)
    return esPvP && !hayApuestas(sesion.apuestas)
}

function hayApuestas(apuestas) {
    if (!apuestas) return false
    return (Number(apuestas.lumens) || 0) > 0 || (Array.isArray(apuestas.objetos) && apuestas.objetos.length > 0)
}

/** Copia limpia de los estados activos de un combatiente, lista para guardarse en BD. */
function serializarEfectos(statusEffect = []) {
    return (statusEffect || [])
        .filter(e => e && (Number(e.duracion) || 0) > 0 && !e.interno && !TIPOS_SOLO_COMBATE.has(e.tipo))
        .map(e => {
            const limpio = {}
            for (const campo of CAMPOS_EFECTO) {
                if (e[campo] !== undefined) limpio[campo] = e[campo]
            }
            limpio.duracion = Math.floor(Number(e.duracion))
            return limpio
        })
}

/**
 * Carga los efectos guardados en un combatiente recién construido.
 * Los buffs de stat (modStat) se vuelven a aplicar sobre sus stats, porque
 * Soul.stats guarda el valor base, sin modificadores temporales.
 */
function cargarEfectos(combatiente, efectosGuardados = []) {
    if (!Array.isArray(efectosGuardados) || !efectosGuardados.length) return
    combatiente.statusEffect = efectosGuardados
        .filter(e => e && (Number(e.duracion) || 0) > 0)
        .map(e => ({ ...e, modStat: e.modStat ? { ...e.modStat } : undefined, fuente: combatiente.ID }))

    for (const e of combatiente.statusEffect) {
        if (!e.modStat || !combatiente.stats) continue
        const { stat, delta } = e.modStat
        combatiente.stats[stat] = (Number(combatiente.stats[stat]) || 0) + (Number(delta) || 0)
        if (stat === "agilidad") combatiente.tempo = combatiente.stats.agilidad || 10
    }
}

/** ¿El efecto beneficia al personaje? (para colorearlo en la UI) */
function esBeneficioso(efecto = {}) {
    if (efecto.modStat) return (Number(efecto.modStat.delta) || 0) > 0
    if (["buff", "hot", "escudo", "guardia", "estasis", "inmunidad", "provocar"].includes(efecto.tipo)) return true
    if (["control", "degradacion", "dot", "debuff"].includes(efecto.tipo)) return false
    const id = String(efecto.id || efecto.nombre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    return /curacion|heal|regeneracion|pasive|acelerado|hasted|speed|velocidad|inmun|escudo|furia/.test(id)
}

module.exports = {
    esCombateAmistoso,
    hayApuestas,
    serializarEfectos,
    cargarEfectos,
    esBeneficioso,
}
