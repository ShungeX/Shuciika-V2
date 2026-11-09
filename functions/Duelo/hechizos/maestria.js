// ─── Maestría por uso (X) ────────────────────────────────────────────────────
// Sube la FIABILIDAD (cast.probabilidad), nunca el daño. Datos en el alma:
//   Soul.dominio.hechizos = [{ ID: 'Aqua-001', InCombat: true, usos: 0, maestria: 1 }, ...]
// (el documento proponía un objeto por ID; se guarda dentro del array que ya existe para no
// mover el esquema del alma). Anti-farmeo: tope por combate y por hechizo, solo casteos
// resueltos, y tope diario contra el mismo rival en duelos amistosos.

const { MAESTRIA } = require("./config")

/** Nivel (1..4) que corresponde a una cantidad de usos. */
function nivelPorUsos(usos) {
    let nivel = 1
    for (const n of MAESTRIA.NIVELES) if ((Number(usos) || 0) >= n.usos) nivel = n.nivel
    return nivel
}

/** Mapa { idHechizo: { usos, maestria } } a partir de dominio.hechizos (array) o de un objeto. */
function mapaMaestrias(hechizos) {
    const mapa = {}
    if (Array.isArray(hechizos)) {
        for (const h of hechizos) {
            const id = h?.ID ?? h?.id ?? h
            if (typeof id !== "string") continue
            const usos = Number(h?.usos) || 0
            mapa[id] = { usos, maestria: Number(h?.maestria) || nivelPorUsos(usos) }
        }
    } else if (hechizos && typeof hechizos === "object") {
        for (const [id, v] of Object.entries(hechizos)) {
            if (typeof v === "number") mapa[id] = { usos: MAESTRIA.NIVELES[v - 1]?.usos ?? 0, maestria: v }
            else mapa[id] = { usos: Number(v?.usos) || 0, maestria: Number(v?.maestria) || nivelPorUsos(v?.usos) }
        }
    }
    return mapa
}

/**
 * Cuenta un uso RESUELTO (no fallido ni interrumpido) dentro del combate, con tope por hechizo.
 * @returns {boolean} si contó
 */
function registrarUso(pj, hechizoId, sesion) {
    if (!pj || pj.isNPC || !hechizoId) return false
    if (String(hechizoId).startsWith("inline_") || String(hechizoId).startsWith("basic_")) return false
    if (sesion?.modeTest && !MAESTRIA.CONTAR_EN_PRUEBA) return false
    pj.maestriaSesion ??= {}
    const actual = pj.maestriaSesion[hechizoId] || 0
    if (actual >= MAESTRIA.USOS_POR_COMBATE) return false
    pj.maestriaSesion[hechizoId] = actual + 1
    return true
}

/**
 * Reparte los usos de la sesión respetando un cupo total (tope diario amistoso).
 * @returns {Object} { idHechizo: usosQueCuentan }
 */
function recortarACupo(usosSesion, cupo) {
    const out = {}
    let restante = Math.max(0, cupo)
    for (const [id, n] of Object.entries(usosSesion)) {
        const toma = Math.min(n, restante)
        if (toma > 0) out[id] = toma
        restante -= toma
    }
    return out
}

/** Llave de pareja para el tope diario: los IDs de los rivales, ordenados. */
function llaveRivales(rivales = []) {
    return rivales.map(r => String(r.ID)).sort().join("_") || "sin_rival"
}

/**
 * Guarda en las almas los usos contados en el combate. Se llama al finalizar.
 * @param {Object} sesion - sesionesCombate
 */
async function persistirSesion(sesion) {
    if (!sesion || (sesion.modeTest && !MAESTRIA.CONTAR_EN_PRUEBA)) return
    const clientdb = require("../../../Server")
    const souls = clientdb.db("Rol_db").collection("Soul")
    const { esCombateAmistoso } = require("../efectosPersistentes")
    const { fechaMx } = require("../../Economia/lumens")
    const amistoso = esCombateAmistoso(sesion)
    const hoy = fechaMx()

    for (const pj of sesion.getAllCombatientes()) {
        if (pj.isNPC || !pj.maestriaSesion) continue
        let usos = { ...pj.maestriaSesion }
        const set = {}

        if (amistoso) {
            const esEquipo1 = sesion.teams[0].some(c => c.ID === pj.ID)
            const rivales = (esEquipo1 ? sesion.teams[1] : sesion.teams[0]).filter(c => !c.isNPC)
            const llave = llaveRivales(rivales)
            const soul = await souls.findOne({ _id: Number(pj.ID) }, { projection: { "dominio.maestriaDiaria": 1 } })
            const diaria = soul?.dominio?.maestriaDiaria?.fecha === hoy ? soul.dominio.maestriaDiaria : { fecha: hoy, rivales: {} }
            const usado = Number(diaria.rivales?.[llave]) || 0
            usos = recortarACupo(usos, MAESTRIA.TOPE_DIARIO_AMISTOSO - usado)
            const contados = Object.values(usos).reduce((a, b) => a + b, 0)
            set["dominio.maestriaDiaria"] = { fecha: hoy, rivales: { ...(diaria.rivales || {}), [llave]: usado + contados } }
        }

        const ids = Object.keys(usos)
        if (!ids.length && !Object.keys(set).length) continue

        const inc = {}
        const arrayFilters = []
        ids.forEach((id, i) => {
            const previo = Number(pj.maestrias?.[id]?.usos) || 0
            inc[`dominio.hechizos.$[h${i}].usos`] = usos[id]
            set[`dominio.hechizos.$[h${i}].maestria`] = nivelPorUsos(previo + usos[id])
            arrayFilters.push({ [`h${i}.ID`]: id })
        })
        const update = {}
        if (Object.keys(inc).length) update.$inc = inc
        if (Object.keys(set).length) update.$set = set
        try {
            await souls.updateOne({ _id: Number(pj.ID) }, update, arrayFilters.length ? { arrayFilters } : {})
        } catch (e) {
            console.error(`[Maestría] No se pudo guardar la maestría de ${pj.Nombre}:`, e.message)
        }
    }
}

module.exports = { nivelPorUsos, mapaMaestrias, registrarUso, recortarACupo, llaveRivales, persistirSesion }
