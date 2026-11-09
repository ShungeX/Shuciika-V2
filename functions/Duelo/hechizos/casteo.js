// ─── Validación de casteo (XI.E) ─────────────────────────────────────────────
// `evaluarCasteo` es el ÚNICO lugar que decide si un combatiente puede lanzar algo y en qué
// condiciones: Estasis, kit por elemento, vías bloqueadas, casteo solo mental, degradaciones,
// maestría, cooldown y costos. El ataque básico, la guardia y los objetos pasan por aquí como
// pseudo-hechizos de movimiento, así que no queda ningún `if` de estados disperso por el combate.

const { VIAS, VIAS_CORPORALES, VIAS_LENTAS, CASTEO, MAESTRIA, KIT } = require("./config")
const { normalizarElemento, esUniversal } = require("./elementos")
const { efectosActivos, viasBloqueadas, quienBloquea } = require("./estados")
const { normalizarHechizo } = require("./adaptador")

const { MOVIMIENTO, MENTAL, INSTINTO } = VIAS

/** Acciones que no son hechizos pero exigen una vía (III.E: Golpe e ítems cuentan como movimiento). */
const ACCIONES = Object.freeze({
    GOLPE: { _id: "basic_attack", Nombre: "Golpe", _accion: true, Mecanicas: { cast: { vias: [MOVIMIENTO], tiempo: 0, probabilidad: 1, interruptible: false } }, Costos: {} },
    GUARDIA: { _id: "univ-001", Nombre: "Guardia", _accion: true, Mecanicas: { cast: { vias: [MOVIMIENTO], tiempo: 0, probabilidad: 1, interruptible: false } }, Costos: {} },
    OBJETO: { _id: "accion_objeto", Nombre: "Usar objeto", _accion: true, Mecanicas: { cast: { vias: [MOVIMIENTO], tiempo: 0, probabilidad: 1, interruptible: false } }, Costos: {} },
})

/** NPC no humano: castea por instinto, sin voz, gesto ni trazo que bloquear (VI.B). */
function usaInstinto(pj) {
    return Boolean(pj?.isNPC && pj.esHumano !== true)
}

/** Nivel de maestría del combatiente en un hechizo (1 = Novato). */
function nivelMaestria(pj, hechizoId) {
    const dato = pj?.maestrias?.[hechizoId]
    if (dato === undefined || dato === null) return 1
    if (typeof dato === "number") return dato
    return Number(dato.maestria) || 1
}

function datosNivel(nivel) {
    return MAESTRIA.NIVELES.find(n => n.nivel === nivel) ?? MAESTRIA.NIVELES[0]
}

/** Probabilidad base con el bonus de maestría (nunca sube el daño, solo la fiabilidad). */
function probabilidadConMaestria(probBase, nivel) {
    const p = Math.max(0, Math.min(1, Number(probBase) || 0))
    if (p >= 1) return 1
    const bonus = datosNivel(nivel).bonus
    if (!bonus) return p
    return Math.max(p, Math.min(MAESTRIA.TOPE_PROBABILIDAD, p + bonus))
}

/** Elemento con el que el combatiente puede lanzar (afinado: el suyo; desafinado: el del contenedor). */
function elementoActivo(pj) {
    if (!pj) return null
    if (pj.elementoActivo) return normalizarElemento(pj.elementoActivo)
    return normalizarElemento(pj.elemento ?? pj.Elemento)
}

/** ¿El hechizo pertenece al kit lanzable del combatiente? (III.E) */
function enKit(pj, hechizo) {
    if (!KIT.FILTRAR_POR_ELEMENTO) return true
    if (!pj || pj.isNPC || hechizo?._accion) return true
    if (esUniversal(hechizo)) return true
    return normalizarElemento(hechizo.Elemento) === elementoActivo(pj)
}

function puedeModoMental(pj, h) {
    const m = h.Mecanicas?.cast?.mental
    if (!m?.permitido) return false
    if ((Number(h.Escalon) || 1) > CASTEO.MENTAL.escalonMax) return false
    return nivelMaestria(pj, h._id) >= (Number(m.maestria_min) || CASTEO.MENTAL.maestria_min)
}

function fallo(razon, motivo, extra = {}) {
    return { ok: false, razon, motivo, ...extra }
}

/**
 * Decide si `pj` puede lanzar `hechizo` ahora mismo.
 * @param {Object} pj - combatiente (statusEffect, cooldowns, Mana, HP, maestrias, isNPC...)
 * @param {Object} hechizo - en cualquier formato (se normaliza)
 * @param {Object} [opciones]
 * @param {boolean} [opciones.ignorarCostos] - solo vías/estados (p. ej. para saber si puede actuar)
 * @param {boolean} [opciones.ignorarKit]
 * @returns {{ ok: true, modo: 'normal'|'mental', usadas: string[], pCastX: number, pDesvio: number,
 *             manaX: number, tiempoExtra: number, pFinal: number, costoMana: number, costoVida: number,
 *             costoDinero: number, tiempo: number, nivelMaestria: number }
 *          | { ok: false, razon: string[], motivo: string }}
 */
function evaluarCasteo(pj, hechizo, opciones = {}) {
    const h = hechizo?._accion ? hechizo : normalizarHechizo(hechizo)
    if (!h) return fallo(["hechizo"], "el hechizo no existe")

    const activos = efectosActivos(pj)
    if (activos.some(a => a.familia === "total")) return fallo(["estasis"], "en Estasis")

    if (!opciones.ignorarKit && !enKit(pj, h)) {
        return fallo(["elemento"], `no es de tu elemento activo (${elementoActivo(pj)})`)
    }

    const cast = h.Mecanicas?.cast || {}
    const bloq = viasBloqueadas(activos)
    const instinto = usaInstinto(pj)
    let usadas = instinto ? [INSTINTO] : (cast.vias?.length ? cast.vias : [MOVIMIENTO])
    let modo = "normal"

    const faltan = usadas.filter(v => bloq.has(v))
    if (faltan.length) {
        if (!instinto && !h._accion && puedeModoMental(pj, h) && !bloq.has(MENTAL)) {
            modo = "mental"
            usadas = [MENTAL]
        } else {
            return fallo(faltan, `bloqueado: ${quienBloquea(activos, faltan)}`)
        }
    }

    // Degradaciones: se aplican a cada vía que el hechizo usa y se multiplican; la mental sufre la mitad
    let pSinFalla = 1
    let pSinDesvio = 1
    let tiempoExtra = modo === "mental" ? (Number(cast.mental?.tiempoExtra) || CASTEO.MENTAL.tiempoExtra) : 0
    for (const a of activos) {
        if (a.degrada) {
            for (const v of usadas) {
                const f = (v === MENTAL ? CASTEO.FACTOR_MENTAL : 1) * (Number(a.degrada.valor) || 0)
                if (a.degrada.tipo === "falla") pSinFalla *= (1 - f)
                else if (a.degrada.tipo === "desvio") pSinDesvio *= (1 - f)
            }
        }
    }
    if (activos.some(a => a.lentitud) && usadas.some(v => VIAS_LENTAS.includes(v))) {
        tiempoExtra += CASTEO.LENTITUD_TIEMPO_EXTRA
    }

    const nivel = h._accion ? 1 : nivelMaestria(pj, h._id)
    const probBase = Number(cast.probabilidad ?? 1)
    const pFinal = probabilidadConMaestria(probBase, nivel) * pSinFalla
    const manaX = modo === "mental" ? (Number(cast.mental?.manaX) || CASTEO.MENTAL.manaX) : 1

    const costos = h.Costos || {}
    const manaBase = Number(costos.mana ?? costos.Mana ?? 0) || 0
    const descuento = (nivel >= 4 && probBase >= 1) ? MAESTRIA.DESCUENTO_MANA_MAESTRO : 0
    const costoMana = manaBase > 0 ? Math.max(MAESTRIA.MANA_MINIMO, Math.ceil((manaBase - descuento) * manaX)) : 0
    const costoVida = Number(costos.Vida ?? costos.vida ?? 0) || 0
    const costoDinero = Number(costos.Dinero ?? costos.dinero ?? 0) || 0

    if (!opciones.ignorarCostos && !h._accion) {
        const cd = pj?.cooldowns?.[h._id]
        if (cd > 0) return fallo(["cooldown"], `en enfriamiento (${cd} ronda/s)`, { cooldown: cd })
        if ((Number(pj?.Mana) || 0) < costoMana) return fallo(["mana"], `maná insuficiente (${costoMana} PM)`, { costoMana })
        if (costoVida > 0 && ((Number(pj?.HP) || 0) - 1) <= costoVida) return fallo(["vida"], `vida insuficiente (${costoVida} HP)`, { costoVida })
    }

    return {
        ok: true,
        modo,
        usadas,
        pCastX: pSinFalla,             // multiplica cast.probabilidad
        pDesvio: 1 - pSinDesvio,       // se tira al elegir objetivo
        manaX,
        tiempoExtra,
        pFinal,
        costoMana,
        costoVida,
        costoDinero,
        tiempo: Math.max(0, Number(cast.tiempo ?? 1)) + tiempoExtra,
        nivelMaestria: nivel,
    }
}

/**
 * ¿Un efecto nuevo corta el cast en curso? (VI.A) Solo si el cast es interrumpible y el efecto
 * bloquea alguna de las vías con las que se está canalizando.
 */
function interrumpe(casteoEnCurso, efectoNuevo) {
    if (!casteoEnCurso || casteoEnCurso.interruptible === false) return false
    const bloquea = efectoNuevo?.bloquea ?? []
    return bloquea.some(v => (casteoEnCurso.vias || []).includes(v))
}

/**
 * ¿Le queda alguna acción real al combatiente? Si no, el sistema salta su turno.
 * - Estasis: lo salta el sistema (no cuenta como AFK).
 * - NPC no humano: solo depende de `instinto`.
 * - Resto: Golpe / Guardia / objetos exigen movimiento; si está bloqueado, mira sus hechizos.
 * @param {Object} pj
 * @param {Object[]} [hechizos] - hechizos conocidos ya cargados (de la caché)
 * @returns {{ puede: boolean, motivo?: string, sistema?: boolean }}
 */
function puedeActuar(pj, hechizos = []) {
    const activos = efectosActivos(pj)
    if (activos.some(a => a.familia === "total")) return { puede: false, motivo: "Estasis", sistema: true }

    const bloq = viasBloqueadas(activos)
    if (usaInstinto(pj)) {
        return bloq.has(INSTINTO) ? { puede: false, motivo: quienBloquea(activos, [INSTINTO]) } : { puede: true }
    }
    if (!bloq.has(MOVIMIENTO)) return { puede: true }

    const lanzable = hechizos.filter(Boolean).some(h => evaluarCasteo(pj, h, { ignorarCostos: true }).ok)
    if (lanzable) return { puede: true }
    const todas = [...VIAS_CORPORALES, MENTAL].filter(v => bloq.has(v))
    return { puede: false, motivo: quienBloquea(activos, todas.length ? todas : [MOVIMIENTO]) }
}

module.exports = {
    ACCIONES, evaluarCasteo, interrumpe, puedeActuar, usaInstinto, nivelMaestria,
    probabilidadConMaestria, elementoActivo, enKit, datosNivel,
}
