// ─────────────────────────────────────────────────────────────────────────────
// Sistema de Amistad — capa de datos.
//
// Colección Rol_db.amistades: UN documento por pareja de personajes.
//   _id       "idMenor*idMayor" (ids como texto, orden lexicográfico)
//   miembros  [idMenor, idMayor]  (índice multikey)
// Los puntos y contadores viven SOLO aquí, no en el documento del personaje.
//
// Los ids se guardan siempre como texto. Personajes usa _id numérico: convierte
// con String() antes de consultar (las funciones de aquí ya lo hacen).
//
// Concurrencia: cada resolución lee el doc, calcula en reglasAmistad.js y aplica
// el update exigiendo el mismo `rev` que leyó. Si alguien escribió en medio, se
// reintenta con el doc fresco. Así el cooldown y el tope no se pueden saltar con
// dos clics simultáneos, y todos los contadores siguen subiendo con $inc.
// ─────────────────────────────────────────────────────────────────────────────
const clientdb = require("../../Server")
const { fechaMx } = require("../Economia/lumens")
const cfg = require("../../config/amistad")
const reglas = require("./reglasAmistad")
const { IDS_MEJOR_AMIGO } = require("../../config/rangosAmistad")

const coleccion = clientdb.db("Rol_db").collection("amistades")

const MAX_REINTENTOS = 4

// ─── Índices ─────────────────────────────────────────────────────────────────
let indicesListos = null
function asegurarIndices() {
    if (!indicesListos) {
        indicesListos = Promise.all([
            // Búsquedas por personaje (perfil, límite de mejores amigos, borrado).
            coleccion.createIndex({ miembros: 1, rangoBaseId: 1 }, { name: "miembros_rango" }),
            // Un solo Compañero por personaje: entre los docs con esCompanero=true,
            // cada id solo puede aparecer en `miembros` una vez.
            coleccion.createIndex(
                { miembros: 1 },
                { name: "companero_unico", unique: true, partialFilterExpression: { esCompanero: true } }
            ),
        ]).catch(e => {
            indicesListos = null
            console.error("[Amistad] No se pudieron crear los índices:", e.message)
        })
    }
    return indicesListos
}
asegurarIndices()

// ─── Validaciones ────────────────────────────────────────────────────────────
/**
 * ¿Pueden estos dos personajes tener amistad?
 * @param {{ _id?: any, id?: any, ownerID?: any }} a
 * @param {{ _id?: any, id?: any, ownerID?: any }} b
 * @returns {{ ok: true } | { ok: false, motivo: string, texto: string }}
 */
function validarPareja(a, b) {
    const idA = String(a?._id ?? a?.id ?? "")
    const idB = String(b?._id ?? b?.id ?? "")
    const fallo = (motivo) => ({ ok: false, motivo, texto: reglas.TEXTOS[motivo] })
    if (!idA || !idB || !a?.ownerID || !b?.ownerID) return fallo("sin_dueno")
    if (idA === idB) return fallo("mismo_personaje")
    // No hay transferencias entre personajes de la misma cuenta, así que tampoco
    // amistad: sería una vía para farmear bonos de amistad/Compañero contigo misma.
    if (String(a.ownerID) === String(b.ownerID)) return fallo("misma_cuenta")
    return { ok: true }
}

// ─── Lecturas ────────────────────────────────────────────────────────────────
async function obtenerAmistad(idA, idB, ahora = Date.now()) {
    const doc = await coleccion.findOne({ _id: reglas.idPareja(idA, idB) })
    return { doc, estado: reglas.estadoAmistad(doc, ahora) }
}

async function contarMejoresAmigos(idPj) {
    // `nivel` es del modelo anterior; se cuenta mientras queden documentos viejos.
    return coleccion.countDocuments({
        miembros: String(idPj),
        $or: [{ rangoBaseId: { $in: IDS_MEJOR_AMIGO } }, { nivel: "mejor_amigo" }],
    })
}

// ─── Resolución ──────────────────────────────────────────────────────────────
/**
 * Aplica la respuesta del receptor a una interacción. Es el ÚNICO punto que
 * modifica puntos, contadores brutos, rivalidad, rangoBaseId, historial y tope diario.
 *
 * Una interacción que expira NO pasa por aquí (usa reglas.resultadoExpirado):
 * vale 0, no es rechazo y no crea el documento.
 *
 * @param {object}  p
 * @param {string}  p.tipo       abrazo | punch | ... (config/amistad.js)
 * @param {string}  p.respuesta  corresponder | rechazar | ignorar | devolver | ...
 * @param {{ _id: any, ownerID: any }} p.emisor    Personaje que inició
 * @param {{ _id: any, ownerID: any }} p.receptor  Personaje que respondió
 * @param {number}  [p.ahora]
 * @param {number}  [p.puntosBase] Solo para tipos con puntos variables (regalo)
 * @returns {Promise<{ ok: true, resultado: object } | { ok: false, motivo: string, texto?: string }>}
 */
async function resolverInteraccion({ tipo, respuesta, emisor, receptor, ahora = Date.now(), puntosBase = null }) {
    const valida = validarPareja(emisor, receptor)
    if (!valida.ok) return valida
    if (!cfg.TIPOS[tipo]?.respuestas?.[respuesta]) return { ok: false, motivo: "respuesta_desconocida" }

    const idE = String(emisor._id ?? emisor.id)
    const idR = String(receptor._id ?? receptor.id)
    const _id = reglas.idPareja(idE, idR)
    const hoy = fechaMx(ahora)

    // Se crea al primer intercambio (no al conocerse). Si dos resoluciones llegan
    // a la vez, una de las dos puede chocar con la clave duplicada: no pasa nada.
    try {
        await coleccion.updateOne({ _id }, { $setOnInsert: reglas.docNuevo(idE, idR, ahora) }, { upsert: true })
    } catch (e) {
        if (e?.code !== 11000) throw e
    }

    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
        const doc = await coleccion.findOne({ _id })
        if (!doc) continue

        let calc = reglas.calcularResolucion({ doc, tipo, respuesta, de: idE, ahora, hoy, puntosPropuestos: puntosBase })
        if (!calc.ok) return calc

        // Límite de Mejores amigos: solo se consulta cuando la pareja estaría por subir.
        // TODO(decisión): dos subidas simultáneas podrían pasarse del límite por uno;
        // ¿vale la pena bloquearlo con un contador en el personaje?
        if (calc.subeAMejorAmigo) {
            const [nE, nR] = await Promise.all([contarMejoresAmigos(idE), contarMejoresAmigos(idR)])
            if (nE >= cfg.LIMITE_MEJORES_AMIGOS || nR >= cfg.LIMITE_MEJORES_AMIGOS) {
                calc = reglas.calcularResolucion({ doc, tipo, respuesta, de: idE, ahora, hoy, mejorAmigoBloqueado: true, puntosPropuestos: puntosBase })
            }
        }

        const r = await coleccion.updateOne({ _id, rev: doc.rev ?? 0 }, calc.update)
        if (r.matchedCount === 1) return { ok: true, resultado: calc.resultado }
        // Otro proceso escribió entre la lectura y el update: se recalcula.
    }

    console.error(`[Amistad] No se pudo resolver ${tipo}/${respuesta} en ${_id} tras ${MAX_REINTENTOS} intentos`)
    return { ok: false, motivo: "concurrencia", texto: reglas.TEXTOS.concurrencia }
}

// ─── Duelos entre la pareja ──────────────────────────────────────────────────
/**
 * Suma un duelo 1 vs 1 al historial de la pareja (se muestra en /rol amistad).
 * No toca puntos ni `rev`: es solo un contador, así que no compite con
 * resolverInteraccion. Si la pareja aún no tenía documento, se crea: pelear
 * también es conocerse.
 *
 * @param {{ _id: any, ownerID: any }} a
 * @param {{ _id: any, ownerID: any }} b
 * @param {any|null} idGanador  null = empate
 */
async function registrarDuelo(a, b, idGanador, ahora = Date.now()) {
    if (!validarPareja(a, b).ok) return false
    const idA = String(a._id), idB = String(b._id)
    const inc = { "duelos.total": 1 }
    if (idGanador != null && [idA, idB].includes(String(idGanador))) inc[`duelos.ganados.${idGanador}`] = 1
    try {
        await coleccion.updateOne(
            { _id: reglas.idPareja(idA, idB) },
            { $setOnInsert: reglas.docNuevo(idA, idB, ahora), $inc: inc },
            { upsert: true }
        )
        return true
    } catch (e) {
        if (e?.code === 11000) return registrarDuelo(a, b, idGanador, ahora)   // upsert simultáneo: el doc ya existe
        throw e
    }
}

// ─── Baja de personaje ───────────────────────────────────────────────────────
/**
 * Borra todas las parejas donde aparece el personaje.
 * Devuelve el id del Compañero (si lo tenía) para avisarle al otro lado.
 *
 * TODO(decisión): falta conectarlo donde se borra un personaje
 * (eventos/guildMemberRemove/Despedida.js y cualquier baja manual) y definir el
 * mensaje de aviso al Compañero.
 */
async function borrarAmistadesDePersonaje(idPj) {
    const id = String(idPj)
    const pacto = await coleccion.findOne({ miembros: id, esCompanero: true }, { projection: { miembros: 1 } })
    const companero = pacto ? pacto.miembros.find(m => m !== id) ?? null : null
    const { deletedCount } = await coleccion.deleteMany({ miembros: id })
    return { borradas: deletedCount, companero }
}

module.exports = {
    coleccion,
    asegurarIndices,
    validarPareja,
    obtenerAmistad,
    contarMejoresAmigos,
    resolverInteraccion,
    registrarDuelo,
    borrarAmistadesDePersonaje,
    // Re-export de lo que la UI necesita sin tocar Mongo
    idPareja: reglas.idPareja,
    estadoAmistad: reglas.estadoAmistad,
    lineaPuntos: reglas.lineaPuntos,
    resultadoExpirado: reglas.resultadoExpirado,
}
