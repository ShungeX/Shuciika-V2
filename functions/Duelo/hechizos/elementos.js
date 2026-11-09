// Nombre canónico de elementos: un solo lugar para "Pyró" / "Pyros" / "pyro" → "Pyrós".
const { ELEMENTOS, PREFIJO_ID } = require("./config")

const quitarTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

const MAPA = {
    pyro: ELEMENTOS.PYROS, pyros: ELEMENTOS.PYROS, piro: ELEMENTOS.PYROS, fuego: ELEMENTOS.PYROS,
    aqua: ELEMENTOS.AQUA, agua: ELEMENTOS.AQUA,
    lux: ELEMENTOS.LUX, luz: ELEMENTOS.LUX,
    rakau: ELEMENTOS.RAKAU,
    lapis: ELEMENTOS.LAPIS,
    electro: ELEMENTOS.ELECTRO,
    wind: ELEMENTOS.WIND, viento: ELEMENTOS.WIND,
    kryo: ELEMENTOS.KRYO, kyro: ELEMENTOS.KRYO, cryo: ELEMENTOS.KRYO,
    neutro: ELEMENTOS.NEUTRO, ninguno: ELEMENTOS.NEUTRO, none: ELEMENTOS.NEUTRO, universal: ELEMENTOS.NEUTRO,
}

/** "Pyró", "pyros", "Krýo", "Ninguno", null... → nombre canónico ("Pyrós", "Kryo", "Neutro"). */
function normalizarElemento(elemento) {
    if (elemento === null || elemento === undefined || elemento === "") return ELEMENTOS.NEUTRO
    return MAPA[quitarTildes(elemento)] ?? String(elemento).trim()
}

/** ¿El hechizo no tiene elemento (universal / Golpe)? */
function esUniversal(hechizo) {
    const id = String(hechizo?._id ?? "")
    if (id.startsWith("univ-") || id.startsWith("default_")) return true
    return normalizarElemento(hechizo?.Elemento) === ELEMENTOS.NEUTRO
}

/** Prefijo de _id para un elemento ("Pyrós" → "Pyro"). */
function prefijoId(elemento) {
    const canonico = normalizarElemento(elemento)
    return PREFIJO_ID[canonico] ?? quitarTildes(canonico).replace(/^./, c => c.toUpperCase())
}

/** Siguiente _id libre para un elemento a partir de los IDs existentes ("Pyro-001", "Pyro-002"...). */
function siguienteIdHechizo(elemento, idsExistentes = []) {
    const prefijo = prefijoId(elemento)
    const re = new RegExp(`^${prefijo}-(\\d+)$`, "i")
    let max = 0
    for (const id of idsExistentes) {
        const m = String(id).match(re)
        if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return `${prefijo}-${String(max + 1).padStart(3, "0")}`
}

module.exports = { normalizarElemento, esUniversal, prefijoId, siguienteIdHechizo, quitarTildes }
