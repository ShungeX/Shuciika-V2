// ─── Habilidades robadas (El Anfitrión, sección V) ──────────────────────────
// Un robo dura hasta que el ladrón usa lo robado; entonces se devuelve. Vive solo en memoria del
// combate: al terminar, todo vuelve (nada se pierde de forma permanente).
//
// Claves: "attack" (botón Atacar/Acciones completo) · "defend" (Defenderse) ·
//         "spell:<ID>" (un hechizo concreto) · "item:<Región>:<ID>" (un objeto concreto)
// Las bendiciones de Heraldo nunca se roban.

const claveHechizo = (id) => `spell:${id}`
const claveObjeto = (region, id) => `item:${region ?? ""}:${Number(id)}`

const robados = (pj) => (pj?.robados instanceof Map ? pj.robados : new Map())

/** ¿Está robada esa clave? */
const estaRobado = (pj, clave) => robados(pj).has(clave)

/** Roba una clave. Devuelve false si ya estaba robada. */
function robar(pj, clave, ladronId) {
    if (!pj || !clave || estaRobado(pj, clave)) return false
    if (!(pj.robados instanceof Map)) pj.robados = new Map()
    pj.robados.set(clave, { ladron: ladronId, desde: Date.now() })
    return true
}

function devolver(pj, clave) {
    return pj?.robados instanceof Map ? pj.robados.delete(clave) : false
}

function devolverTodo(pj) {
    if (pj?.robados instanceof Map) pj.robados.clear()
}

/** Texto para mensajes de rechazo. */
const MENSAJE = "El Anfitrión tiene eso ahora. Lo recuperarás cuando lo use."

/** Nombre legible de una clave robada. */
function nombreClave(clave, { hechizo, objeto } = {}) {
    if (clave === "attack") return "Atacar"
    if (clave === "defend") return "Defenderse"
    if (clave.startsWith("spell:")) return hechizo?.Nombre || "un hechizo"
    if (clave.startsWith("item:")) return objeto?.Nombre || "un objeto"
    return clave
}

module.exports = { claveHechizo, claveObjeto, estaRobado, robar, devolver, devolverTodo, MENSAJE, nombreClave }
