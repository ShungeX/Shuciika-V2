// Formato canónico de especialidades: "[Cocina, Deportes, Música]"
// El usuario escribe libremente separando con comas (también se aceptan ; | y saltos de línea).

const MAX_ESPECIALIDADES = 4
const MIN_LARGO = 2
const MAX_LARGO = 20

const SEPARADORES = /[,;|\n\r]+/
// Corchetes, comillas y viñetas que el usuario pudiera escribir por su cuenta
const ENVOLTORIOS = /[\[\]{}()"'`«»“”‘’]/g
const VINETA_INICIAL = /^[\s\-–—•*·.]+/
// Letras (con acentos), números, espacios, guiones y apóstrofes internos
const PATRON_VALIDO = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} '\-]*$/u

function claveComparacion(texto) {
    return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

function capitalizar(texto) {
    return texto.charAt(0).toLocaleUpperCase("es") + texto.slice(1)
}

/**
 * Valida y normaliza el texto de especialidades.
 * @param {string} entrada Texto del modal, ej: "cocina, deportes"
 * @returns {{ ok: true, lista: string[], valor: string } | { ok: false, error: string }}
 *   valor: "[Cocina, Deportes]" o "" si el campo se dejó vacío
 */
function parsearEspecialidades(entrada) {
    const texto = String(entrada ?? "").replace(ENVOLTORIOS, " ")

    const items = texto
        .split(SEPARADORES)
        .map(item => item.replace(VINETA_INICIAL, "").replace(/\s+/g, " ").trim())
        .filter(Boolean)

    if (items.length === 0) return { ok: true, lista: [], valor: "" }

    const lista = []
    const vistos = new Set()

    for (const item of items) {
        if (item.length < MIN_LARGO || item.length > MAX_LARGO) {
            return { ok: false, error: `\`${item}\` debe tener entre ${MIN_LARGO} y ${MAX_LARGO} caracteres` }
        }
        if (!PATRON_VALIDO.test(item)) {
            return { ok: false, error: `\`${item}\` tiene caracteres no permitidos (solo letras, números, espacios y guiones)` }
        }

        const clave = claveComparacion(item)
        if (vistos.has(clave)) continue
        vistos.add(clave)
        lista.push(capitalizar(item))
    }

    if (lista.length > MAX_ESPECIALIDADES) {
        return { ok: false, error: `Solo puedes poner hasta **${MAX_ESPECIALIDADES}** especialidades (escribiste ${lista.length})` }
    }

    return { ok: true, lista, valor: `[${lista.join(", ")}]` }
}

module.exports = { parsearEspecialidades, MAX_ESPECIALIDADES }
