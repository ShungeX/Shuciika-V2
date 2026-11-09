// ─── Adaptador de compatibilidad (XI.C) ──────────────────────────────────────
// Lee un hechizo en cualquier formato (el antiguo con `Tipo` y `Efectos` como objeto de llave
// dinámica, o el nuevo) y devuelve SIEMPRE el formato final:
//   Escalon, Rol, Adquisicion, Mecanicas.cast.{vias, mental, tiempo, probabilidad, interruptible},
//   damage/healing con { objetivo, alcance }, Efectos como array de objetos con `tipo`.
// No escribe en la base de datos: la colección se migra con scripts/migrarHechizosVias.js.

const {
    VIAS, VIA_NATIVA, ESCALONES, ROLES, BUFFS, UNIVERSALES_INICIALES, CASTEO,
} = require("./config")
const { normalizarElemento, esUniversal, quitarTildes } = require("./elementos")
const { ESTADOS, definicionEstado } = require("./estados")

const TIPOS_EFECTO = new Set([
    "control", "degradacion", "estasis", "inmunidad", "dot", "hot", "buff", "debuff",
    "escudo", "cleanse", "revive", "mana", "guardia", "provocar", "legacy", "instantaneo",
])

// ─── Objetivo / alcance ──────────────────────────────────────────────────────

/** Valor antiguo de objetivo (número, array, string) → { objetivo, alcance }. */
function separarObjetivo(objetivo, alcanceDato) {
    let alcance = normalizarAlcance(alcanceDato)
    const num = (v) => {
        if (v === null || v === undefined) return null
        if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber()
        const n = Number(v)
        return Number.isNaN(n) ? null : n
    }

    let quien = "enemigos"
    if (Array.isArray(objetivo)) {
        const nums = objetivo.map(num).filter(n => n !== null)
        const strs = objetivo.filter(v => typeof v === "string").map(s => quitarTildes(s))
        if (nums.includes(4) || strs.includes("todos")) { quien = "global"; alcance ??= "todos" }
        else if (nums.includes(2) || nums.includes(6) || strs.some(s => s.startsWith("aliad"))) quien = "aliados"
        else if (nums.includes(3) || strs.includes("mismo")) quien = "mismo"
        else quien = "enemigos"
        if (nums.includes(5) || nums.includes(6)) alcance ??= "todos"
    } else if (num(objetivo) !== null) {
        const n = num(objetivo)
        quien = { 1: "enemigos", 2: "aliados", 3: "mismo", 4: "global", 5: "enemigos", 6: "aliados" }[n] ?? "enemigos"
        if (n === 4 || n === 5 || n === 6) alcance ??= "todos"
    } else if (typeof objetivo === "string" && objetivo) {
        const s = quitarTildes(objetivo)
        if (s === "todos") { quien = "global"; alcance ??= "todos" }       // antiguo "todos" = todos los combatientes
        else if (s.startsWith("aliad")) quien = "aliados"
        else if (s.startsWith("enemig")) quien = "enemigos"
        else if (s === "mismo" || s === "self") quien = "mismo"
        else if (s === "global") quien = "global"
    }
    return { objetivo: quien, alcance: quien === "mismo" ? "single" : (alcance ?? "single") }
}

function normalizarAlcance(valor) {
    if (valor === null || valor === undefined) return null
    const v = Array.isArray(valor) ? valor[0] : valor
    const s = quitarTildes(v)
    if (!s) return null
    if (s === "single" || s === "uno" || s === "individual") return "single"
    if (s === "todos" || s === "area" || s === "all") return "todos"
    if (s === "cadena" || s === "chain") return "cadena"
    return null
}

// ─── Vías ────────────────────────────────────────────────────────────────────

function viaDesdeTipo(tipo) {
    const s = quitarTildes(tipo)
    if (!s) return null
    if (s.startsWith("habl") || s === "voz" || s === "canto") return VIAS.HABLADO
    if (s.startsWith("mov") || s === "danza" || s === "gesto") return VIAS.MOVIMIENTO   // 'danza' se fusiona en movimiento
    if (s.startsWith("escri") || s === "trazo") return VIAS.ESCRITURA                  // 'escrito' pasa a escritura
    if (s === "mental") return VIAS.MENTAL
    if (s === "instinto") return VIAS.INSTINTO
    return null
}

function normalizarVias(vias) {
    if (!Array.isArray(vias)) return null
    const limpias = [...new Set(vias.map(viaDesdeTipo).filter(Boolean))]
    return limpias.length ? limpias : null
}

/**
 * Vías de un hechizo antiguo: Notas elementales → su vía nativa (III.B);
 * `Tipo: 'mental'` explícito se respeta; si no, se traduce `Tipo`.
 */
function inferirVias(doc, elemento, escalon) {
    const desdeTipo = viaDesdeTipo(doc.Tipo)
    if (desdeTipo === VIAS.MENTAL) return [VIAS.MENTAL]
    if (escalon === 3) return [VIAS.HABLADO, VIAS.MOVIMIENTO, VIAS.ESCRITURA, VIAS.MENTAL]
    const nativa = VIA_NATIVA[elemento]
    if (nativa && (escalon ?? 1) === 1) return [nativa]
    return [desdeTipo ?? nativa ?? VIAS.MOVIMIENTO]
}

// ─── Efectos ─────────────────────────────────────────────────────────────────

const num = (v, def = 0) => {
    if (v === null || v === undefined || v === "") return def
    const n = Number(typeof v === "object" && typeof v.toNumber === "function" ? v.toNumber() : v)
    return Number.isFinite(n) ? n : def
}

/** Convierte una entrada antigua { clave: datos } al formato nuevo. */
function efectoDesdeLegacy(clave, datos = {}) {
    const k = quitarTildes(clave)
    const { objetivo, alcance } = separarObjetivo(datos.objetivo ?? "enemigos", datos.alcance)
    const duracion = datos.duracion === null || datos.duracion === undefined ? null : num(datos.duracion)
    const comun = { objetivo, alcance }
    if (datos.probabilidad !== undefined && datos.probabilidad !== null) comun.probabilidad = num(datos.probabilidad, 1)

    const def = definicionEstado({ id: k, Nombre: datos.Nombre, tipo: "legacy" })
    if (def && duracion) {
        if (def.familia === "bloqueo") {
            return { tipo: "control", nombre: def.nombre, duracion, bloquea: [...def.bloquea], ...comun }
        }
        if (def.familia === "degradacion") {
            const e = { tipo: "degradacion", nombre: def.nombre, duracion, ...comun }
            if (def.degrada) e.degrada = { ...def.degrada }
            return e
        }
        if (def.familia === "total") return { tipo: "estasis", nombre: "Estasis", duracion: 1, inmune: true, pausa: true, ...comun }
    }

    if (k === "tregua") {
        return { tipo: "inmunidad", nombre: datos.Nombre || "Tregua", contra: "muerte", duracion: duracion || 1, ...comun }
    }
    if (duracion && ["speed", "velocidad", "hasted", "acelerado"].includes(k)) {
        const base = num(datos.base, 0)
        return { tipo: "buff", nombre: datos.Nombre || "Velocidad", stat: "velocidad", valor: base > 1 ? base / 100 : BUFFS.velocidad, duracion, ...comun }
    }
    if (duracion && ["quemadura", "veneno", "sangrado", "damage", "dano", "danio", "degeneracion"].includes(k)) {
        return { tipo: "dot", nombre: datos.Nombre || clave, base: num(datos.base), multi: num(datos.multi), duracion, ...comun }
    }
    if (duracion && ["curacion", "heal", "healing", "regeneracion", "pasive"].includes(k)) {
        return { tipo: "hot", nombre: datos.Nombre || "Regeneración", base: num(datos.base), multi: num(datos.multi), duracion, ...comun }
    }
    if (duracion && ["escudo", "shield"].includes(k)) {
        return { tipo: "escudo", nombre: datos.Nombre || "Escudo", base: num(datos.base), multi: num(datos.multi), duracion, ...comun }
    }
    if (duracion) {
        // Estado sin significado mecánico conocido: se conserva tal cual (lo pinta la UI y lo usan las condiciones)
        return { tipo: "legacy", clave: k, nombre: datos.Nombre || clave, base: datos.base ?? 0, duracion, ...comun }
    }
    // Sin duración: efecto instantáneo antiguo (curación/daño/stat inmediato)
    return { tipo: "instantaneo", clave: k, nombre: datos.Nombre || clave, base: num(datos.base), stat: datos.stat || "HP", ...comun }
}

/** Completa un efecto ya en formato nuevo (rellena bloquea/degrada del catálogo, normaliza objetivo). */
function completarEfecto(e) {
    const out = { ...e }
    out.tipo = quitarTildes(out.tipo)
    if (out.tipo === "degradación") out.tipo = "degradacion"
    const { objetivo, alcance } = separarObjetivo(out.objetivo ?? (["buff", "hot", "escudo", "guardia", "provocar", "estasis", "mana", "revive", "cleanse"].includes(out.tipo) ? "aliados" : "enemigos"), out.alcance)
    out.objetivo = objetivo
    out.alcance = alcance
    if (out.duracion !== undefined && out.duracion !== null) out.duracion = num(out.duracion)
    if (out.probabilidad !== undefined && out.probabilidad !== null) out.probabilidad = num(out.probabilidad, 1)

    if (out.tipo === "control" || out.tipo === "degradacion") {
        const def = definicionEstado({ Nombre: out.nombre ?? out.Nombre, tipo: out.tipo })
        if (def) {
            out.nombre = def.nombre
            if (out.tipo === "control" && !Array.isArray(out.bloquea)) out.bloquea = [...(def.bloquea || [])]
            if (out.tipo === "degradacion" && !out.degrada && def.degrada) out.degrada = { ...def.degrada }
        }
        if (Array.isArray(out.bloquea)) out.bloquea = normalizarVias(out.bloquea) ?? []
    }
    if (out.tipo === "estasis") {
        out.nombre = ESTADOS.estasis.nombre
        out.duracion = 1
        out.inmune = true
        out.pausa = true
    }
    if (out.Nombre && !out.nombre) out.nombre = out.Nombre
    delete out.Nombre
    return out
}

/** Efectos en cualquier formato → array del formato nuevo. */
function convertirEfectos(efectos) {
    if (!efectos) return []
    if (Array.isArray(efectos)) return efectos.filter(Boolean).map(e => (e.tipo && TIPOS_EFECTO.has(quitarTildes(e.tipo)) ? completarEfecto(e) : efectoDesdeLegacy(e.tipo || e.clave || e.Nombre || "efecto", e)))
    if (typeof efectos !== "object") return []
    return Object.entries(efectos).map(([clave, datos]) => {
        // Un objeto cuyos valores ya traen `tipo` (p. ej. un array serializado por el dashboard) es formato nuevo
        if (datos && datos.tipo && TIPOS_EFECTO.has(quitarTildes(datos.tipo))) return completarEfecto(datos)
        return efectoDesdeLegacy(clave, datos || {})
    })
}

// ─── Mecánicas principales ───────────────────────────────────────────────────

function normalizarMecanica(mec, objetivoDefecto, alcanceGlobal) {
    if (!mec || typeof mec !== "object") return null
    const base = num(mec.base)
    const multi = num(mec.scaling?.multi)
    const { objetivo, alcance } = separarObjetivo(mec.objetivo ?? objetivoDefecto, mec.alcance ?? alcanceGlobal)
    const out = { ...mec, base, objetivo, alcance }
    if (mec.scaling) out.scaling = { stats: mec.scaling.stats || "inteligencia", multi }
    return out
}

function inferirRol(m) {
    const efectos = m.Efectos || []
    const tiene = (t) => efectos.some(e => e.tipo === t)
    if (m.damage && m.healing) return "híbrido"
    if (tiene("revive") || (m.healing && !m.damage)) return "curación"
    if (tiene("escudo") || tiene("guardia")) return "defensa"
    if (m.damage && (tiene("control") || tiene("degradacion"))) return "control"
    if (m.damage) return "daño"
    if (tiene("control") || tiene("degradacion")) return "control"
    return "soporte"
}

/**
 * Hechizo en cualquier formato → formato final. Idempotente.
 * @param {Object} doc - documento de Hechizos_globales (o ataque inline ya armado)
 */
function normalizarHechizo(doc) {
    if (!doc || typeof doc !== "object") return null
    if (doc._normalizado) return doc

    const universal = esUniversal(doc)
    const elemento = universal ? null : normalizarElemento(doc.Elemento)
    const mecOriginal = doc.Mecanicas || {}
    const castOriginal = mecOriginal.cast || {}

    let escalon = doc.Escalon !== undefined && doc.Escalon !== null ? num(doc.Escalon) : null
    if (!escalon && !universal) {
        const viasDato = normalizarVias(castOriginal.vias)
        escalon = viasDato ? (viasDato.length >= 4 ? 3 : viasDato.length === 2 ? 2 : 1) : 1
    }

    const alcanceGlobal = normalizarAlcance(mecOriginal.alcance)
    const damage = normalizarMecanica(mecOriginal.damage, "enemigos", alcanceGlobal)
    const healing = normalizarMecanica(mecOriginal.healing, "aliados", alcanceGlobal)

    const vias = normalizarVias(castOriginal.vias) ?? inferirVias(doc, elemento, escalon)
    const mentalDato = castOriginal.mental || {}
    const cast = {
        vias,
        mental: {
            permitido: Boolean(mentalDato.permitido) && (escalon ?? 1) <= CASTEO.MENTAL.escalonMax,
            maestria_min: num(mentalDato.maestria_min, CASTEO.MENTAL.maestria_min),
            manaX: num(mentalDato.manaX, CASTEO.MENTAL.manaX),
            tiempoExtra: num(mentalDato.tiempoExtra, CASTEO.MENTAL.tiempoExtra),
        },
        tiempo: num(castOriginal.tiempo ?? doc.castTime ?? mecOriginal.castTime, 1),
        probabilidad: Math.max(0, Math.min(1, num(castOriginal.probabilidad ?? doc.castProbabilidad ?? mecOriginal.castProbabilidad, 1))),
        interruptible: castOriginal.interruptible !== false,
    }

    const Mecanicas = { ...mecOriginal, cast, Efectos: convertirEfectos(mecOriginal.Efectos) }
    delete Mecanicas.castTime
    delete Mecanicas.castProbabilidad
    if (damage) Mecanicas.damage = damage; else delete Mecanicas.damage
    if (healing && (healing.base > 0 || healing.scaling)) Mecanicas.healing = healing; else delete Mecanicas.healing
    if (alcanceGlobal) Mecanicas.alcance = alcanceGlobal; else delete Mecanicas.alcance
    if (Array.isArray(Mecanicas.objetivo)) delete Mecanicas.objetivo

    const costos = doc.Costos || {}
    const Costos = {
        mana: num(costos.mana ?? costos.Mana),
        Vida: num(costos.Vida ?? costos.vida),
        Dinero: num(costos.Dinero ?? costos.dinero),
        Cooldown: num(costos.Cooldown ?? costos.cooldown),
    }

    const rol = doc.Rol && ROLES.includes(doc.Rol) ? doc.Rol : inferirRol(Mecanicas)
    const adquisicion = doc.Adquisicion && doc.Adquisicion.via
        ? { ...doc.Adquisicion }
        : (UNIVERSALES_INICIALES.includes(String(doc._id)) || (!universal && escalon === 1)
            ? { via: "inicio" }
            : { via: escalon === 2 ? "tratado" : "evento" })

    const out = {
        ...doc,
        Nombre: String(doc.Nombre ?? "").trim(),
        Elemento: elemento,
        Escalon: universal ? (doc.Escalon ?? null) : escalon,
        Rol: rol,
        Adquisicion: adquisicion,
        Mecanicas,
        Costos,
        isActive: doc.isActive !== false,
        uso: doc.uso || "combate",
    }
    delete out.Tipo
    delete out.castTime
    delete out.castProbabilidad
    Object.defineProperty(out, "_normalizado", { value: true, enumerable: false })
    return out
}

/** Nombre de escalón para la UI. */
function nombreEscalon(escalon) {
    return ESCALONES[escalon]?.nombre ?? "Universal"
}

module.exports = {
    normalizarHechizo, convertirEfectos, separarObjetivo, normalizarVias, viaDesdeTipo,
    nombreEscalon, TIPOS_EFECTO,
}
