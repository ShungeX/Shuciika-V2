// ─── Validación de esquema al guardar (XII.B) ────────────────────────────────
// Mejor rechazar al guardar desde el dashboard que fallar en pleno combate.

const { VIAS_VALIDAS, ESCALONES, ROLES, ALCANCES, OBJETIVOS, ELEMENTOS, VIAS_ADQUISICION } = require("./config")
const { normalizarHechizo, convertirEfectos, normalizarVias, separarObjetivo, TIPOS_EFECTO } = require("./adaptador")
const { normalizarElemento } = require("./elementos")

const ELEMENTOS_VALIDOS = new Set(Object.values(ELEMENTOS))

/** Errores de un hechizo ya normalizado ([] = válido). */
function validarHechizo(h) {
    const errores = []
    if (!h) return ["hechizo vacío"]
    if (!String(h.Nombre || "").trim()) errores.push("Nombre vacío")
    if (h.Elemento !== null && !ELEMENTOS_VALIDOS.has(h.Elemento)) errores.push(`Elemento desconocido: ${h.Elemento}`)

    const cast = h.Mecanicas?.cast || {}
    const vias = cast.vias || []
    if (!vias.length) errores.push("cast.vias vacío")
    for (const v of vias) if (!VIAS_VALIDAS.includes(v)) errores.push(`vía inválida: ${v}`)

    if (h.Escalon !== null && h.Escalon !== undefined) {
        const esc = ESCALONES[h.Escalon]
        if (!esc) errores.push(`Escalon inválido: ${h.Escalon} (1 Nota, 2 Acorde, 3 Cántico)`)
        else if (vias.length !== esc.vias) errores.push(`${esc.nombre} exige ${esc.vias} vía(s) y tiene ${vias.length}`)
        if (h.Escalon === 3 && cast.mental?.permitido) errores.push("los Cánticos nunca admiten casteo solo mental")
    }
    if (!(cast.probabilidad >= 0 && cast.probabilidad <= 1)) errores.push("cast.probabilidad debe estar entre 0 y 1")
    if (!(cast.tiempo >= 0)) errores.push("cast.tiempo debe ser ≥ 0")
    if (h.Rol && !ROLES.includes(h.Rol)) errores.push(`Rol inválido: ${h.Rol}`)
    if (h.Adquisicion?.via && !VIAS_ADQUISICION.includes(h.Adquisicion.via)) errores.push(`Adquisicion.via inválida: ${h.Adquisicion.via}`)

    for (const [nombre, mec] of [["damage", h.Mecanicas?.damage], ["healing", h.Mecanicas?.healing]]) {
        if (!mec) continue
        if (!OBJETIVOS.includes(mec.objetivo)) errores.push(`${nombre}.objetivo inválido: ${mec.objetivo}`)
        if (!ALCANCES.includes(mec.alcance)) errores.push(`${nombre}.alcance inválido: ${mec.alcance}`)
    }

    ;(h.Mecanicas?.Efectos || []).forEach((e, i) => {
        const pre = `Efectos[${i}]`
        if (!TIPOS_EFECTO.has(e.tipo)) errores.push(`${pre}: tipo desconocido (${e.tipo})`)
        if (e.probabilidad !== undefined && !(e.probabilidad >= 0 && e.probabilidad <= 1)) errores.push(`${pre}: probabilidad fuera de 0..1`)
        if (["control", "degradacion", "dot", "hot", "buff", "debuff"].includes(e.tipo) && !(Number(e.duracion) > 0)) errores.push(`${pre}: necesita duracion > 0`)
        if (e.tipo === "control") {
            if (!Array.isArray(e.bloquea) || !e.bloquea.length) errores.push(`${pre}: un control debe declarar las vías que bloquea`)
            else for (const v of e.bloquea) if (!VIAS_VALIDAS.includes(v)) errores.push(`${pre}: vía bloqueada inválida (${v})`)
        }
        if (e.tipo === "degradacion" && !e.degrada && e.nombre !== "Lentitud") errores.push(`${pre}: una degradación necesita degrada { tipo, valor }`)
        if (e.degrada && !["falla", "desvio"].includes(e.degrada.tipo)) errores.push(`${pre}: degrada.tipo debe ser 'falla' o 'desvio'`)
        if (e.tipo === "estasis" && Number(e.duracion) !== 1) errores.push(`${pre}: la Estasis dura 1 turno fijo`)
        if (!OBJETIVOS.includes(e.objetivo)) errores.push(`${pre}: objetivo inválido (${e.objetivo})`)
    })
    return errores
}

/**
 * Efectos al guardar. El editor actual del dashboard solo conoce { Nombre, base, duracion,
 * objetivo, probabilidad } por entrada: si el hechizo ya tiene Efectos en formato nuevo, cada
 * entrada sin `tipo` se superpone a la que ocupa su misma posición, para no perder tipo / bloquea /
 * degrada. Las entradas nuevas se convierten desde el formato antiguo.
 */
function fusionarEfectos(inMec, prevMec) {
    if (!tiene(inMec, "Efectos")) return convertirEfectos(prevMec.Efectos)
    const previos = Array.isArray(prevMec.Efectos) ? convertirEfectos(prevMec.Efectos) : []
    const pares = Array.isArray(inMec.Efectos) ? inMec.Efectos.map((v, i) => [String(i), v]) : Object.entries(inMec.Efectos || {})
    if (!previos.length || pares.some(([, v]) => v && v.tipo)) return convertirEfectos(inMec.Efectos)

    return pares.map(([clave, v], i) => {
        const base = previos[i]
        if (!base) return convertirEfectos({ [clave]: v })[0]
        const out = { ...base }
        if (v?.Nombre ?? v?.nombre) out.nombre = v.Nombre ?? v.nombre
        for (const k of ["base", "duracion", "probabilidad", "objetivo", "alcance"]) {
            if (v?.[k] !== undefined && v[k] !== null && v[k] !== "") out[k] = v[k]
        }
        return convertirEfectos([out])[0]
    }).filter(Boolean)
}

const tiene = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null && o[k] !== ""

/**
 * Completa lo que arma Server.js al guardar desde el dashboard con los campos nuevos
 * (vías, escalón, rol, adquisición, alcance, Efectos array). Sin esto, editar un hechizo ya
 * migrado borraría sus vías y volvería a convertir sus Efectos en objeto.
 * @param {Object} armado - documento que construye el endpoint (tipos Int32 incluidos)
 * @param {Object} entrada - req.body.hechizo tal cual
 * @param {Object|null} previo - documento actual en la BD (null al crear)
 * @returns {{ ok: boolean, doc: Object, errores: string[] }}
 */
function completarHechizoParaGuardar(armado, entrada = {}, previo = null) {
    const inMec = entrada.Mecanicas || {}
    const prevMec = previo?.Mecanicas || {}
    const doc = { ...armado, Mecanicas: { ...armado.Mecanicas, cast: { ...(armado.Mecanicas?.cast || {}) } } }

    doc.Nombre = String(doc.Nombre || "").trim()
    doc.Elemento = armado.Elemento === null ? null : (normalizarElemento(armado.Elemento) === ELEMENTOS.NEUTRO ? null : normalizarElemento(armado.Elemento))

    for (const campo of ["Escalon", "Rol", "Adquisicion"]) {
        if (tiene(entrada, campo)) doc[campo] = entrada[campo]
        else if (tiene(previo, campo)) doc[campo] = previo[campo]
    }

    const viasEntrada = normalizarVias(inMec.cast?.vias)
    const viasPrevias = normalizarVias(prevMec.cast?.vias)
    // El dashboard actual siempre manda `Tipo`: si el hechizo ya tiene vías, se conservan
    if (viasEntrada) doc.Mecanicas.cast.vias = viasEntrada
    else if (viasPrevias) doc.Mecanicas.cast.vias = viasPrevias
    if (inMec.cast?.mental) doc.Mecanicas.cast.mental = inMec.cast.mental
    else if (prevMec.cast?.mental) doc.Mecanicas.cast.mental = prevMec.cast.mental

    for (const k of ["damage", "healing"]) {
        if (!doc.Mecanicas[k]) continue
        const alcance = inMec[k]?.alcance ?? prevMec[k]?.alcance
        const sep = separarObjetivo(doc.Mecanicas[k].objetivo, alcance)
        doc.Mecanicas[k] = { ...doc.Mecanicas[k], objetivo: sep.objetivo, alcance: sep.alcance }
    }

    doc.Mecanicas.Efectos = fusionarEfectos(inMec, prevMec)

    // El adaptador completa lo que falte (vías por elemento, escalón, rol...) y quita `Tipo`
    const final = normalizarHechizo(doc)
    const limpio = { ...final }
    const errores = validarHechizo(limpio)
    return { ok: errores.length === 0, doc: limpio, errores }
}

module.exports = { validarHechizo, completarHechizoParaGuardar }
