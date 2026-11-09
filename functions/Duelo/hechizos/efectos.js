// ─── Aplicación de efectos de hechizo en combate ─────────────────────────────
// Recibe efectos en el formato nuevo (array con `tipo`, ver adaptador.js) y los aplica sobre
// combatientes: control/degradación (con interrupción), Estasis, Tregua, DoT/HoT, buffs,
// escudos, guardia, provocar, cleanse, revive y maná. También lleva el fin de turno
// (ticks periódicos, duraciones, pausa de Estasis, inmunidades anti-cadena).
// No toca la base de datos.

const {
    CONTROL, ESTASIS, TREGUA, INTERRUPCION, GUARDIA, BUFFS, REVIVE, PROVOCAR, CONCENTRAR,
} = require("./config")
const { quitarTildes } = require("./elementos")
const { MARCAS, perfilEstado, efectosActivos, tieneInmunidad, esNegativo, esControl } = require("./estados")
const { interrumpe } = require("./casteo")

const clave = (t) => quitarTildes(t).replace(/\s+/g, "_")

/** Combate PvE: hay NPCs, no es PvP y no hay apuestas. Tregua y similares solo existen aquí. */
function esPvE(sesion) {
    if (!sesion) return false
    const tipo = String(sesion.type || "").toLowerCase()
    if (tipo === "pvp" || tipo === "ranked") return false
    const ap = sesion.apuestas
    if (ap && ((Number(ap.lumens) || 0) > 0 || (Array.isArray(ap.objetos) && ap.objetos.length > 0))) return false
    const todos = typeof sesion.getAllCombatientes === "function" ? sesion.getAllCombatientes() : []
    return todos.some(c => c.isNPC)
}

function valorEscalado(efecto, caster) {
    const stat = efecto.escala || "inteligencia"
    const v = (Number(efecto.base) || 0) + (Number(efecto.multi) || 0) * (Number(caster?.stats?.[stat]) || 0)
    return Math.max(0, Math.floor(v))
}

/**
 * Línea de log de sistema (canalización, interrupción, turno saltado...). Usa el tipo "objeto"
 * con textoLog, que es el que el formateador del log ya sabe pintar.
 */
function logSistema(sesion, texto, extra = {}) {
    sesion?.addLog?.("objeto", {
        autor: extra.autor || "",
        item: { Nombre: extra.hechizo || "Sistema", Tipo: "sistema", tipo: "sistema" },
        efectos: [],
        objetivos: [],
        textoLog: texto,
        ...extra,
    })
}

function marca(id, contra, duracion, fuente) {
    return { id, Nombre: id, nombre: id, tipo: "inmunidad", contra, duracion, fuente, interno: true }
}

function ponerMarca(target, id, contra, duracion) {
    if (!duracion) return
    target.statusEffect ??= []
    const existente = target.statusEffect.find(e => e.id === id)
    if (existente) existente.duracion = Math.max(Number(existente.duracion) || 0, duracion)
    else target.statusEffect.push(marca(id, contra, duracion, target.ID))
}

/** Agrega o refresca (duración máxima) un estado en el combatiente. */
function agregarEstado(target, entrada) {
    target.statusEffect ??= []
    const existente = target.statusEffect.find(e => e.id === entrada.id)
    if (existente) {
        existente.duracion = Math.max(Number(existente.duracion) || 0, Number(entrada.duracion) || 0)
        if (entrada.puntos !== undefined) existente.puntos = Math.max(Number(existente.puntos) || 0, entrada.puntos)
        if (entrada.base !== undefined && typeof entrada.base !== "object") existente.base = Math.max(Number(existente.base) || 0, Number(entrada.base) || 0)
        if (entrada.origenCast) existente.origenCast = entrada.origenCast
        return existente
    }
    target.statusEffect.push(entrada)
    return entrada
}

// ─── Interrupción (VI.A) ─────────────────────────────────────────────────────

/**
 * Corta el cast en curso del objetivo: se pierde (el maná no vuelve), el hechizo entra a la mitad
 * de su cooldown y el objetivo queda inmune a interrupciones y controles nuevos 1 turno.
 */
function interrumpirCast(sesion, target, motivo) {
    const cast = target.activeCast
    if (!cast) return false
    const hechizo = cast.baseSpell || {}
    const cd = Number(hechizo.Costos?.Cooldown) || 0
    if (cd > 0) {
        target.cooldowns ??= {}
        target.cooldowns[hechizo._id] = Math.max(1, Math.ceil(cd * INTERRUPCION.FRACCION_COOLDOWN))
    }
    delete target.activeCast
    target.interrumpidoRecientemente = sesion?.ronda ?? 0
    if (cast.ataqueId) target.ultimoAtaqueInterrumpido = cast.ataqueId
    ponerMarca(target, MARCAS.INMUNE_INTERRUPCION, "interrupcion", INTERRUPCION.INMUNIDAD_TURNOS)
    ponerMarca(target, MARCAS.INMUNE_CONTROL, "control", INTERRUPCION.INMUNIDAD_TURNOS)
    logSistema(sesion, `¡${target.Nombre} pierde la canalización de ${hechizo.Nombre}${motivo ? ` (${motivo})` : ""}!`, { autor: target.Nombre, hechizo: hechizo.Nombre })
    return true
}

function intentarInterrumpir(sesion, target, perfil) {
    if (!target.activeCast) return false
    if (tieneInmunidad(target, "interrupcion")) return false
    if (!interrumpe(target.activeCast, perfil)) return false
    return interrumpirCast(sesion, target, perfil.nombre)
}

// ─── Aplicar un efecto ───────────────────────────────────────────────────────

/**
 * Aplica un efecto (formato nuevo) de un hechizo sobre un objetivo.
 * @param {Object} p
 * @param {Object} p.sesion
 * @param {Object} p.caster
 * @param {Object} p.target
 * @param {Object} p.efecto
 * @param {Object} [p.ctx] - { castId, hechizo, esInmune(target, clave) }
 * @returns {{ aplicado: boolean, motivo?: string, log?: Object }}
 */
function aplicarEfecto({ sesion, caster, target, efecto, ctx = {} }) {
    if (!target || !efecto) return { aplicado: false, motivo: "sin_objetivo" }
    const tipo = efecto.tipo
    const nombre = efecto.nombre || efecto.Nombre || tipo
    const k = clave(nombre)
    const duracion = Number(efecto.duracion) || 0
    const base = { objetivos: [target.Nombre], targetId: target.ID }

    if (tipo === "revive") return aplicarRevive({ sesion, caster, target, efecto, ctx })
    if (target.defeated) return { aplicado: false, motivo: "derrotado" }

    // Estasis: inmunidad total, no recibe efectos nuevos (ni de aliados)
    if (tieneInmunidad(target, "todo")) return { aplicado: false, motivo: "inmune", log: { ...base, tipo: "custom", clausula: "resistido el efecto (Estasis)" } }

    const prob = efecto.probabilidad ?? 1
    if (Math.random() > prob) return { aplicado: false, motivo: "probabilidad" }
    if (ctx.esInmune && (ctx.esInmune(target, k) || ctx.esInmune(target, nombre))) {
        return { aplicado: false, motivo: "inmune", log: { ...base, tipo: "custom", clausula: `resistido ${nombre} gracias a la inmunidad` } }
    }

    switch (tipo) {
        case "control": {
            if (tieneInmunidad(target, "control")) {
                return { aplicado: false, motivo: "inmune_control", log: { ...base, tipo: "custom", clausula: `resistido ${nombre} (inmunidad tras control)` } }
            }
            const entrada = agregarEstado(target, {
                id: `control_${k}`, Nombre: nombre, nombre, tipo: "control",
                bloquea: [...(efecto.bloquea || [])], duracion, fuente: caster?.ID,
                rompeConDanio: efecto.rompeConDanio, origenCast: ctx.castId,
            })
            const perfil = perfilEstado(entrada)
            if (perfil.rompeConDanio) entrada.rompeConDanio = true
            intentarInterrumpir(sesion, target, perfil)
            return { aplicado: true, log: { ...base, tipo: "estado", Nombre: nombre, duracion } }
        }

        case "degradacion": {
            const entrada = agregarEstado(target, {
                id: `degradacion_${k}`, Nombre: nombre, nombre, tipo: "degradacion",
                degrada: efecto.degrada ? { ...efecto.degrada } : undefined, duracion, fuente: caster?.ID,
            })
            // Lentitud sobre un cast de movimiento/escritura/instinto: +1 al cast en curso
            const perfil = perfilEstado(entrada)
            if (perfil.lentitud && target.activeCast && target.activeCast.vias?.some(v => ["movimiento", "escritura", "instinto"].includes(v))) {
                target.activeCast.remainingTurns = (Number(target.activeCast.remainingTurns) || 0) + 1
            }
            return { aplicado: true, log: { ...base, tipo: "estado", Nombre: nombre, duracion } }
        }

        case "estasis": {
            if (target.esJefe && ESTASIS.JEFES === "inmune") return { aplicado: false, motivo: "jefe", log: { ...base, tipo: "custom", clausula: "resistido la Estasis (jefe)" } }
            if (tieneInmunidad(target, "estasis")) return { aplicado: false, motivo: "anti_estasis", log: { ...base, tipo: "custom", clausula: "resistido la Estasis (aún resuena la anterior)" } }
            const entrada = agregarEstado(target, {
                id: "estasis", Nombre: "Estasis", nombre: "Estasis", tipo: "estasis",
                inmune: true, pausa: true, duracion: ESTASIS.DURACION, fuente: caster?.ID,
            })
            intentarInterrumpir(sesion, target, perfilEstado(entrada))
            return { aplicado: true, log: { ...base, tipo: "estado", Nombre: "Estasis", duracion: ESTASIS.DURACION } }
        }

        case "inmunidad": {
            const contra = efecto.contra || "todo"
            if (contra === "muerte" && TREGUA.SOLO_PVE && !esPvE(sesion)) {
                return { aplicado: false, motivo: "solo_pve", log: { ...base, tipo: "custom", clausula: "visto cómo la Tregua se disuelve (solo PvE)" } }
            }
            agregarEstado(target, {
                id: `inmunidad_${contra}`, Nombre: nombre, nombre, tipo: "inmunidad", contra,
                pausa: Boolean(efecto.pausa), duracion: duracion || TREGUA.DURACION, fuente: caster?.ID,
            })
            return { aplicado: true, log: { ...base, tipo: "estado", Nombre: nombre, duracion: duracion || TREGUA.DURACION } }
        }

        case "dot":
        case "hot": {
            const valor = valorEscalado(efecto, caster)
            if (!valor || !duracion) return { aplicado: false, motivo: "sin_valor" }
            agregarEstado(target, { id: `${tipo}_${k}`, Nombre: nombre, nombre, tipo, base: valor, duracion, fuente: caster?.ID })
            return { aplicado: true, log: { ...base, tipo: "estado", Nombre: `${nombre} (${tipo === "dot" ? "−" : "+"}${valor}/turno)`, duracion } }
        }

        case "buff":
        case "debuff": {
            const stat = clave(efecto.stat || nombre)
            const def = BUFFS[stat] ?? 0
            let valor = efecto.valor !== undefined && efecto.valor !== null ? Number(efecto.valor) : def
            if (tipo === "debuff" && valor > 0 && stat !== "esquive") valor = -valor
            const entrada = { id: `${tipo}_${stat}_${k}`, Nombre: nombre, nombre, tipo, stat, valor, duracion, fuente: caster?.ID }
            if (efecto.cero) entrada.cero = true
            agregarEstado(target, entrada)
            return { aplicado: true, log: { ...base, tipo: "estado", Nombre: nombre, duracion } }
        }

        case "escudo": {
            const puntos = valorEscalado(efecto, caster)
            if (!puntos) return { aplicado: false, motivo: "sin_valor" }
            agregarEstado(target, { id: `escudo_${k}`, Nombre: nombre, nombre, tipo: "escudo", puntos, duracion: duracion || 1, fuente: caster?.ID })
            if (efecto.defensa) {
                agregarEstado(target, { id: `buff_defensa_${k}`, Nombre: `${nombre} (defensa)`, nombre: `${nombre} (defensa)`, tipo: "buff", stat: "defensa", valor: Number(efecto.defensa), duracion: duracion || 1, fuente: caster?.ID })
            }
            return { aplicado: true, log: { ...base, tipo: "estado", Nombre: `${nombre} (${puntos})`, duracion: duracion || 1 } }
        }

        case "guardia": {
            agregarEstado(target, { id: "guardia", Nombre: nombre || "Guardia", nombre: nombre || "Guardia", tipo: "guardia", valor: Number(efecto.valor ?? GUARDIA.REDUCCION), duracion: duracion || GUARDIA.DURACION, fuente: caster?.ID })
            return { aplicado: true, log: { ...base, tipo: "estado", Nombre: nombre || "Guardia", duracion: duracion || GUARDIA.DURACION } }
        }

        case "provocar": {
            agregarEstado(target, { id: "provocar", Nombre: nombre || "Provocar", nombre: nombre || "Provocar", tipo: "provocar", duracion: duracion || PROVOCAR.DURACION, fuente: caster?.ID })
            return { aplicado: true, log: { ...base, tipo: "estado", Nombre: nombre || "Provocar", duracion: duracion || PROVOCAR.DURACION } }
        }

        case "cleanse": {
            const cantidad = Number(efecto.cantidad) || 1
            const quitados = []
            for (let i = (target.statusEffect || []).length - 1; i >= 0 && quitados.length < cantidad; i--) {
                const e = target.statusEffect[i]
                if (e.interno || !esNegativo(e)) continue
                const [q] = target.statusEffect.splice(i, 1)
                ctx.revertir?.(target, q)
                quitados.push(q.Nombre || q.nombre || q.id)
            }
            if (!quitados.length) return { aplicado: false, motivo: "nada_que_limpiar" }
            return { aplicado: true, log: { ...base, tipo: "custom", clausula: `quedado libre de ${quitados.join(", ")}` } }
        }

        case "mana": {
            const max = target.stats?.manaMax ?? 99999
            const valor = efecto.base !== undefined
                ? valorEscalado(efecto, caster)
                : Math.max(CONCENTRAR.MANA_MIN, Math.floor(max * CONCENTRAR.MANA_PCT))
            const antes = target.Mana
            target.Mana = Math.min(max, (Number(target.Mana) || 0) + valor)
            const delta = target.Mana - antes
            if (!delta) return { aplicado: false, motivo: "mana_lleno" }
            return { aplicado: true, log: { ...base, tipo: "mana", valor: delta, stat: "Mana" } }
        }

        default:
            return { aplicado: false, motivo: "tipo_desconocido" }
    }
}

function aplicarRevive({ sesion, caster, target, efecto }) {
    if (!target.defeated || target.surrender) return { aplicado: false, motivo: "no_caido" }
    sesion && (sesion.revivesUsados ??= {})
    const llave = `${caster?.ID}:${efecto.hechizoId || "revive"}`
    const usados = sesion?.revivesUsados?.[llave] || 0
    const limite = efecto.vecesPorCombate ?? REVIVE.VECES_POR_COMBATE
    if (limite && usados >= limite) return { aplicado: false, motivo: "limite_revive" }
    const pct = Number(efecto.porcentaje ?? REVIVE.PORCENTAJE)
    const hpMax = target.stats?.hpMax ?? 100
    target.HP = Math.max(1, Math.floor(hpMax * pct))
    target.defeated = false
    target._alreadyLoggedDefeat = false
    if (sesion) sesion.revivesUsados[llave] = usados + 1
    return { aplicado: true, log: { objetivos: [target.Nombre], targetId: target.ID, tipo: "custom", clausula: `vuelto a la vida con ${target.HP} HP` } }
}

// ─── Modificadores que leen el daño, el esquive y el tempo ───────────────────

/**
 * Suma de los modificadores activos de un combatiente.
 * danio: multiplicador saliente (+0.15 = +15%) · defensa: reducción entrante adicional
 * guardia: reducción de Guardia · velocidad/precision/esquive en fracción · esquiveCero: no esquiva
 */
function modificadores(pj) {
    const m = { danio: 0, defensa: 0, guardia: 0, velocidad: 0, precision: 0, esquive: 0, esquiveCero: false, provoca: false }
    for (const a of efectosActivos(pj)) {
        const e = a.efecto
        if (a.precision) m.precision += a.precision / 100
        if (e.tipo === "guardia") m.guardia = Math.max(m.guardia, Number(e.valor) || 0)
        if (e.tipo === "provocar") m.provoca = true
        if (e.tipo !== "buff" && e.tipo !== "debuff") continue
        const v = Number(e.valor) || 0
        switch (e.stat) {
            case "dano": case "daño": m.danio += v; break
            case "defensa": m.defensa += v; break
            case "velocidad": m.velocidad += v; break
            case "precision": m.precision += v; break
            case "esquive":
                if (e.cero || (e.tipo === "debuff" && v === 0)) m.esquiveCero = true
                else m.esquive += v
                break
        }
    }
    return m
}

/** Consume escudos activos; devuelve el daño que sigue hacia la vida. */
function absorberConEscudo(pj, cantidad) {
    let resto = Math.max(0, Number(cantidad) || 0)
    for (const e of (pj.statusEffect || [])) {
        if (resto <= 0) break
        if (e.tipo !== "escudo" || !(Number(e.puntos) > 0)) continue
        const absorbe = Math.min(resto, e.puntos)
        e.puntos -= absorbe
        resto -= absorbe
        if (e.puntos <= 0) e.duracion = 0
    }
    if (pj.statusEffect) pj.statusEffect = pj.statusEffect.filter(e => !(e.tipo === "escudo" && (Number(e.duracion) || 0) <= 0))
    return resto
}

/** Daño recibido: rompe los estados que se rompen con daño de otra fuente (Congelado). */
function alRecibirDanio(pj, origen = {}) {
    if (!pj.statusEffect?.length) return []
    const rotos = []
    pj.statusEffect = pj.statusEffect.filter(e => {
        if (!(Number(e.duracion) > 0)) return true
        const p = perfilEstado(e)
        if (!p.rompeConDanio) return true
        if (origen.castId && e.origenCast && origen.castId === e.origenCast) return true   // Kryo-002: su propio daño no lo rompe
        rotos.push(p.nombre)
        return false
    })
    return rotos
}

/** Objetivos forzados por Provocar: si algún enemigo provoca, solo se puede elegir a esos. */
function filtrarProvocados(candidatos = []) {
    const provocan = candidatos.filter(c => !c.defeated && modificadores(c).provoca)
    return provocan.length ? provocan : candidatos
}

// ─── Fin de turno ────────────────────────────────────────────────────────────

const ID_PERIODICO_DANIO = new Set(["veneno", "quemadura", "damage", "danio", "degeneracion"])
const ID_PERIODICO_CURA = new Set(["curacion", "heal", "healing", "pasive", "regeneracion"])

function tipoPeriodico(e) {
    if (e.tipo === "dot") return "dot"
    if (e.tipo === "hot") return "hot"
    if (e.tipo) return null
    const id = clave(e.id || e.Nombre || "")
    if (ID_PERIODICO_DANIO.has(id)) return "dot"
    if (ID_PERIODICO_CURA.has(id)) return "hot"
    return null
}

/**
 * Cierra el turno propio de un combatiente: ticks periódicos y duraciones.
 * - En Estasis: todo se congela (ni avanza ni expira) salvo la propia Estasis; al salir, anti-cadena.
 * - Un control que expira deja inmunidad breve a controles nuevos (anti stun-lock).
 * @param {Object} pj
 * @param {Object} [hooks] - { danio(pj, valor, efecto), cura(pj, valor, efecto), revertir(pj, efecto) }
 */
function procesarFinDeTurno(pj, hooks = {}) {
    if (!pj || pj.defeated) return { pausado: false }
    pj.statusEffect ??= []
    const enPausa = pj.statusEffect.some(e => (Number(e.duracion) || 0) > 0 && perfilEstado(e).familia === "total")

    if (enPausa) {
        for (let i = pj.statusEffect.length - 1; i >= 0; i--) {
            const e = pj.statusEffect[i]
            if (perfilEstado(e).familia !== "total") continue
            e.duracion = (Number(e.duracion) || 0) - 1
            if (e.duracion <= 0) {
                pj.statusEffect.splice(i, 1)
                ponerMarca(pj, MARCAS.ANTI_ESTASIS, "estasis", ESTASIS.ANTI_CADENA)
            }
        }
        return { pausado: true }
    }

    for (const e of [...pj.statusEffect]) {
        const t = tipoPeriodico(e)
        const valor = Number(e.base) || 0
        if (!t || valor <= 0) continue
        if (t === "dot") hooks.danio?.(pj, valor, e)
        else hooks.cura?.(pj, valor, e)
        if (pj.defeated) break
    }

    let controlExpirado = false
    for (let i = pj.statusEffect.length - 1; i >= 0; i--) {
        const e = pj.statusEffect[i]
        e.duracion = (Number(e.duracion) || 0) - 1
        if (e.duracion <= 0) {
            const [expirado] = pj.statusEffect.splice(i, 1)
            if (esControl(expirado)) controlExpirado = true
            hooks.revertir?.(pj, expirado)
        }
    }
    if (controlExpirado) ponerMarca(pj, MARCAS.INMUNE_CONTROL, "control", CONTROL.INMUNIDAD_TRAS_CONTROL)
    return { pausado: false }
}

module.exports = {
    esPvE, aplicarEfecto, interrumpirCast, intentarInterrumpir, modificadores, absorberConEscudo,
    alRecibirDanio, filtrarProvocados, procesarFinDeTurno, valorEscalado, agregarEstado, ponerMarca,
    logSistema,
}
