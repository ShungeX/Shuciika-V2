// ─────────────────────────────────────────────────────────────────────────────
// Imágenes temporales: fotos que el usuario SUBE en un modal (componente de
// archivo). El adjunto de Discord caduca, así que se copia a Cloudinary en la
// carpeta Temporales/<uso> y se registra aquí. Se borra sola cuando ya nadie la usa.
//
// Colección Server_db.imagenes_temporales:
//   { _id: publicId, url, uso: "regalo" | "ficha", userId, creadoEn, revisarEn }
//
// Ciclo de vida:
//   • Al reemplazarla o quitarla → liberar(url) la borra en el acto si ya no se usa.
//   • Barrido cada BARRIDO_CADA_MS: las que llegaron a revisarEn se comprueban con
//     enUso(); si siguen en uso se posponen REVISAR_CADA_MS, si no se borran.
//   • Ficha: al verificarla, promover() la copia a su carpeta definitiva y borra la temporal.
//   • Regalo: vive mientras la bolsa, el regalo del buzón o un reporte la usen
//     (el buzón purga los regalos resueltos a los RETENCION_DIAS de config/regalos).
// ─────────────────────────────────────────────────────────────────────────────
const cloudinary = require("cloudinary").v2
const clientdb = require("../Server")

const coleccion = clientdb.db("Server_db").collection("imagenes_temporales")

const HORA = 60 * 60 * 1000
const GRACIA_MS = 1 * HORA                 // margen entre subirla y que quede guardada en su sitio
const REVISAR_CADA_MS = 24 * HORA          // si sigue en uso, se vuelve a mirar en un día
const BARRIDO_CADA_MS = 6 * HORA
const MAX_BYTES = 8 * 1024 * 1024
const TIPOS = /^image\/(png|jpe?g|gif|webp)$/i
const EXT = /\.(png|jpe?g|gif|webp)$/i

// Dónde se guarda cada uso. Requires perezosos para no crear ciclos al cargar.
const REFERENCIAS = {
    regalo: async (url) => {
        const dbRol = clientdb.db("Rol_db")
        const { INV } = require("./Regalos/comun")
        const consultas = [
            dbRol.collection("Personajes").countDocuments({ [`${INV}.Metadata.regalo.banner`]: url }, { limit: 1 }),
            dbRol.collection("buzon").countDocuments({ "envoltura.banner": url }, { limit: 1 }),
            dbRol.collection("reportes_regalo").countDocuments({ "instantanea.envoltura.banner": url }, { limit: 1 }),
        ]
        return (await Promise.all(consultas)).some(n => n > 0)
    },
    ficha: async (url) => {
        const dbRol = clientdb.db("Rol_db")
        const consultas = [
            dbRol.collection("CachePJ").countDocuments({ avatarURL: url }, { limit: 1 }),
            dbRol.collection("Personajes").countDocuments({ $or: [{ avatarURL: url }, { "perfil.avatarURL": url }] }, { limit: 1 }),
        ]
        return (await Promise.all(consultas)).some(n => n > 0)
    },
}

/**
 * Lee el primer archivo de un componente de subida de un modal.
 * @returns {import("discord.js").Attachment|null}
 */
function archivoDelModal(interaction, customId) {
    try {
        return interaction.fields.getUploadedFiles(customId)?.first() || null
    } catch {
        return null
    }
}

/** Valida que el adjunto sea una imagen admitida y no pase del límite. */
function validarAdjunto(adjunto) {
    if (!adjunto?.url) return { ok: false, codigo: "SIN_ARCHIVO" }
    const tipo = adjunto.contentType || ""
    if (tipo ? !TIPOS.test(tipo) : !EXT.test(adjunto.name || "")) return { ok: false, codigo: "NO_ES_IMAGEN" }
    if (adjunto.size && adjunto.size > MAX_BYTES) return { ok: false, codigo: "MUY_GRANDE" }
    return { ok: true }
}

/**
 * Copia un adjunto de Discord a Cloudinary (Temporales/<uso>) y lo registra.
 * @param {{ adjunto: import("discord.js").Attachment, uso: keyof REFERENCIAS, userId: string }} p
 * @returns {Promise<{ ok: true, url: string } | { ok: false, codigo: string }>}
 */
async function subirTemporal({ adjunto, uso, userId }) {
    if (!REFERENCIAS[uso]) throw new Error(`[imagenesTemporales] Uso desconocido: ${uso}`)
    const v = validarAdjunto(adjunto)
    if (!v.ok) return v

    try {
        const resp = await fetch(adjunto.url)
        if (!resp.ok) return { ok: false, codigo: "DESCARGA" }
        const buffer = Buffer.from(await resp.arrayBuffer())
        if (buffer.length > MAX_BYTES) return { ok: false, codigo: "MUY_GRANDE" }

        const resultado = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { resource_type: "image", folder: `Temporales/${uso}`, public_id: `${userId}_${Date.now()}` },
                (error, res) => (error ? reject(error) : resolve(res))
            ).end(buffer)
        })
        if (!resultado?.secure_url) return { ok: false, codigo: "SUBIDA" }

        const ahora = Date.now()
        await coleccion.insertOne({
            _id: resultado.public_id,
            url: resultado.secure_url,
            uso,
            userId,
            creadoEn: new Date(ahora),
            revisarEn: new Date(ahora + GRACIA_MS),
        })
        return { ok: true, url: resultado.secure_url }
    } catch (e) {
        console.error("[imagenesTemporales] No se pudo subir:", e)
        return { ok: false, codigo: "SUBIDA" }
    }
}

async function registroDe(url) {
    if (!url || typeof url !== "string") return null
    return coleccion.findOne({ url })
}

async function esTemporal(url) {
    return Boolean(await registroDe(url))
}

async function destruir(doc) {
    await cloudinary.uploader.destroy(doc._id, { resource_type: "image", invalidate: true })
    await coleccion.deleteOne({ _id: doc._id })
}

/**
 * Borra la imagen ya mismo si es temporal y nada la usa. Llamar después de
 * guardar el valor nuevo (así la referencia vieja ya no cuenta).
 */
async function liberar(url) {
    try {
        const doc = await registroDe(url)
        if (!doc) return false
        if (await REFERENCIAS[doc.uso]?.(doc.url)) return false
        await destruir(doc)
        return true
    } catch (e) {
        console.warn("[imagenesTemporales] No se pudo liberar:", e?.message || e)
        return false
    }
}

/**
 * Si la URL es temporal, la copia a una ubicación definitiva y borra la temporal.
 * Si no es temporal, la devuelve tal cual.
 * @returns {Promise<string>} URL definitiva
 */
async function promover(url, { folder, public_id }) {
    const doc = await registroDe(url)
    if (!doc) return url
    const res = await cloudinary.uploader.upload(doc.url, { resource_type: "image", folder, public_id, overwrite: true, invalidate: true })
    // La temporal se borra aunque aún figure en CachePJ: la definitiva ya la sustituye
    await destruir(doc).catch(e => console.warn("[imagenesTemporales] No se pudo borrar tras promover:", e?.message || e))
    return res.secure_url
}

let barridoEnCurso = false
async function barrer() {
    if (barridoEnCurso) return { omitido: true }
    barridoEnCurso = true
    const resumen = { borradas: 0, pospuestas: 0 }
    try {
        const ahora = Date.now()
        const vencidas = await coleccion.find({ revisarEn: { $lte: new Date(ahora) } }).limit(200).toArray()
        for (const doc of vencidas) {
            try {
                const verificar = REFERENCIAS[doc.uso]
                if (verificar && await verificar(doc.url)) {
                    await coleccion.updateOne({ _id: doc._id }, { $set: { revisarEn: new Date(ahora + REVISAR_CADA_MS) } })
                    resumen.pospuestas++
                } else {
                    await destruir(doc)
                    resumen.borradas++
                }
            } catch (e) {
                console.warn("[imagenesTemporales] Error con", doc._id, e?.message || e)
            }
        }
        return resumen
    } finally {
        barridoEnCurso = false
    }
}

let intervalo = null
function iniciarBarrido() {
    if (intervalo) return
    const correr = () => barrer()
        .then(r => { if (r?.borradas) console.log("[imagenesTemporales] Barrido:", r) })
        .catch(e => console.error("[imagenesTemporales] Error en el barrido:", e))
    correr()
    intervalo = setInterval(correr, BARRIDO_CADA_MS)
    intervalo.unref?.()
}

const MENSAJES = {
    SIN_ARCHIVO: "No recibí ningún archivo.",
    NO_ES_IMAGEN: "El archivo debe ser una imagen (png, jpg, gif o webp).",
    MUY_GRANDE: "La imagen pesa demasiado (máx. 8 MB).",
    DESCARGA: "No pude leer el archivo que subiste. Inténtalo de nuevo.",
    SUBIDA: "No pude guardar la imagen. Inténtalo de nuevo en un momento.",
}

module.exports = {
    archivoDelModal,
    validarAdjunto,
    subirTemporal,
    esTemporal,
    liberar,
    promover,
    barrer,
    iniciarBarrido,
    MENSAJES,
    MAX_BYTES,
}
