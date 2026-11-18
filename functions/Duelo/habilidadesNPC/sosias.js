// ─── Habilidad única: Sosias (NPC-004) ───────────────────────────────────────
// "Estos seres Kurayami han aprendido a imitar formas familiares, mostrándose primero como el
// reflejo normal del observador antes de revelar su verdadera naturaleza."
//
// 1. Acecho: durante sus primeros TURNOS_ANTES turnos actúa con su IA normal.
// 2. Si no lo han derrotado, en su siguiente turno se convierte en una copia de un jugador:
//    toma todas sus stats (y su nivel, Resplandor, elemento, maestrías y vías: castea como él) y
//    su vida ACTUAL + BONUS_VIDA × su vida máxima. Así no sirve bajarse a 1 HP para que la copia
//    nazca con 1 HP. Al copiarlo le aplica Miedo durante MIEDO_TURNOS turnos y copia sus últimos
//    COPIAS ataques. Ese turno se le va en la transformación.
// 3. Espejo, indefinidamente hasta que lo derroten:
//      sus siguientes COPIAS turnos repite esos ataques, en orden →
//      lanza un ataque al azar de los que el jugador tiene disponibles →
//      vuelve a copiar sus últimos COPIAS ataques para los siguientes COPIAS turnos → ...
//    Si al jugador le faltan ataques registrados, el hueco se llena con uno al azar de su kit.

const { aplicarEfecto, logSistema } = require("../hechizos/efectos")
const { ESTADOS } = require("../hechizos/estados")
const cacheHechizos = require("../hechizos/cache")
const { normalizarStats } = require("../combatientes")

const SOSIAS = Object.freeze({
    TURNOS_ANTES: 3,          // ⚙ turnos propios antes de copiar
    BONUS_VIDA: 0.30,         // ⚙ vida de la copia = vida actual del jugador + 30% de su vida máxima
    MIEDO_TURNOS: 3,          // ⚙ duración del Miedo al copiarlo
    COPIAS: 3,                // ⚙ ataques que copia (y turnos que los repite)
    // Lo que no es un ataque no se copia ni se elige al azar
    EXCLUIR: Object.freeze(["univ-001"]),   // Guardia
})

const GOLPE = Object.freeze({ tipo: "attack" })

const estado = (npc) => (npc.sosias ??= { turnos: 0, fase: "acecho", cola: [], objetivoId: null })

const rivalesJugadores = (session, npc) => {
    const esEquipo1 = session.teams[0].some(c => c.ID === npc.ID)
    return (esEquipo1 ? session.teams[1] : session.teams[0]).filter(c => !c.isNPC && !c.defeated)
}

/** Últimos `n` ataques registrados del jugador (Golpe o hechizos), del más antiguo al más reciente. */
function ultimosAtaques(jugador, n = SOSIAS.COPIAS) {
    return (jugador?.historialAtaques || [])
        .filter(a => a.tipo === "attack" || (a.tipo === "spell" && !SOSIAS.EXCLUIR.includes(a.id)))
        .slice(-n)
        .map(a => ({ ...a }))
}

/** Ataques que el jugador tiene disponibles: Golpe y sus hechizos activos (menos Guardia). */
function kitDisponible(jugador) {
    const ids = (jugador?.hechizos || []).map(h => (typeof h === "object" ? (h.ID ?? h.id) : h)).filter(Boolean)
    const hechizos = ids
        .filter(id => !SOSIAS.EXCLUIR.includes(String(id)) && !String(id).startsWith("default_"))
        .filter(id => cacheHechizos.obtenerSync(id)?.isActive !== false && cacheHechizos.obtenerSync(id))
        .map(id => ({ tipo: "spell", id: String(id) }))
    return [GOLPE, ...hechizos]
}

const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)]

/** Completa la cola hasta COPIAS con ataques al azar del kit si el jugador lanzó pocos. */
function copiarAtaques(jugador) {
    const cola = ultimosAtaques(jugador)
    const kit = kitDisponible(jugador)
    while (cola.length < SOSIAS.COPIAS) cola.unshift({ ...alAzar(kit) })
    return cola
}

/**
 * La transformación: copia stats, vida (+30% de la máxima), elemento, nivel, Resplandor,
 * maestrías y vías del jugador, le aplica Miedo y copia sus últimos ataques.
 */
function transformar(session, npc, jugador) {
    const st = estado(npc)
    const vidaMax = Number(jugador.stats?.hpMax) || Number(jugador.HP) || 1
    const vida = Math.max(1, Math.round((Number(jugador.HP) || 0) + SOSIAS.BONUS_VIDA * vidaMax))

    npc.stats = normalizarStats({ ...jugador.stats })
    npc.stats.hpMax = Math.max(vidaMax, vida)
    npc.HP = vida
    npc.stats.manaMax = Number(jugador.stats?.manaMax) || npc.stats.manaMax
    npc.Mana = npc.stats.manaMax
    npc.tempo = npc.stats.agilidad || npc.tempo
    npc.elemento = jugador.elemento ?? jugador.Elemento ?? npc.elemento
    npc.Elemento = npc.elemento
    npc.nivel = Number(jugador.nivelCombate) || npc.nivel
    Object.defineProperty(npc, "multiplicadorDanio", { value: Number(jugador.multiplicadorDanio) || 1, configurable: true, writable: true })
    npc.maestrias = { ...(jugador.maestrias || {}) }
    npc.esHumano = true                 // castea con las vías del jugador: un Mutismo ya le afecta
    npc.cooldowns = {}
    npc.avatarURL = jugador.avatarURL || npc.avatarURL
    npc.nombreOriginal ??= npc.Nombre
    npc.Nombre = `${npc.nombreOriginal} (${jugador.Nombre})`

    st.fase = "espejo"
    st.objetivoId = jugador.ID
    st.cola = copiarAtaques(jugador)
    st.kit = kitDisponible(jugador)

    // Diálogo aparte (embed efímero con pausa), no en el log de acciones
    require("../dialogoCombate").decir(session, { autor: "✦", texto: `*El reflejo de ${jugador.Nombre} deja de imitar... y se vuelve idéntico. ${npc.nombreOriginal} adopta su forma, su fuerza y sus gestos.*`, cambio: true })
    const miedo = aplicarEfecto({
        sesion: session, caster: npc, target: jugador,
        efecto: { tipo: "degradacion", nombre: ESTADOS.miedo.nombre, degrada: { ...ESTADOS.miedo.degrada }, duracion: SOSIAS.MIEDO_TURNOS },
    })
    if (miedo.aplicado) logSistema(session, `${jugador.Nombre} se ve a sí mismo mirándolo desde fuera. El Miedo le recorre (${SOSIAS.MIEDO_TURNOS} turnos).`, { autor: npc.Nombre })
}

/** Objetivos para un hechizo copiado: el daño al jugador copiado (o al rival que quede), la cura a sí mismo. */
function objetivos(session, npc) {
    const rivales = rivalesJugadores(session, npc)
    const preferido = rivales.find(r => String(r.ID) === String(estado(npc).objetivoId))
    const enemigo = preferido ?? alAzar(rivales) ?? null
    return { damage: enemigo ? [enemigo.ID] : [], healing: [npc.ID] }
}

/** Ejecuta un ataque copiado. Si no puede (costos, estado), recurre a Golpe. */
async function lanzar(session, npc, ataque) {
    const TurnProcessor = require("../turnProcessor")
    const t = objetivos(session, npc)
    if (ataque.tipo === "spell") {
        const h = cacheHechizos.obtenerSync(ataque.id)
        if (h) {
            if (npc.cooldowns) delete npc.cooldowns[h._id]   // repite lo que vio: no tiene "su" enfriamiento
            const r = await TurnProcessor.resolverHechizo(session, npc, h._id, t)
            if (r?.success && !r.requiresInteraction) return r
        }
    }
    return TurnProcessor.resolveAction(session, npc.ID, { tipo: "attack", targetId: t.damage[0] ?? null })
}

/**
 * Turno de Sosias. Devuelve true si la habilidad usó el turno (si no, sigue la IA normal).
 * @param {Object} session
 * @param {Object} npc
 */
async function turno(session, npc) {
    const st = estado(npc)
    st.turnos++

    if (st.fase === "acecho") {
        if (st.turnos <= SOSIAS.TURNOS_ANTES) return false
        const rivales = rivalesJugadores(session, npc)
        if (!rivales.length) return false
        // Copia a quien más daño le ha hecho; si nadie, a uno al azar
        const jugador = [...rivales].sort((a, b) => (Number(b.damageDealt) || 0) - (Number(a.damageDealt) || 0))[0]
        transformar(session, npc, jugador)
        return true
    }

    // Espejo: COPIAS ataques copiados → uno al azar del kit → vuelve a copiar
    const jugador = session.getAllCombatientes().find(c => String(c.ID) === String(st.objetivoId))
    if (st.cola.length) {
        const ataque = st.cola.shift()
        await lanzar(session, npc, ataque)
    } else {
        const kit = jugador ? kitDisponible(jugador) : (st.kit || [GOLPE])
        await lanzar(session, npc, alAzar(kit.length ? kit : [GOLPE]))
        st.cola = jugador ? copiarAtaques(jugador) : Array.from({ length: SOSIAS.COPIAS }, () => ({ ...alAzar(st.kit || [GOLPE]) }))
    }
    return true
}

module.exports = { SOSIAS, turno, transformar, ultimosAtaques, kitDisponible, copiarAtaques }
