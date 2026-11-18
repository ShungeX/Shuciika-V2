// ─────────────────────────────────────────────────────────────────────────────
// Noticias / Blog del servidor.
// Capa de lógica: valida, guarda y lee. Nunca responde HTTP (eso es Server.js).
// Los fallos de validación se lanzan con `status` para que la ruta los devuelva.
//
// Colección Server_db.noticias: UN documento por noticia.
//
//   { _id, slug,                      // slug único y estable: no cambia al editar
//     titulo, resumen, portada,       // portada: URL https o ''
//     etiquetas: [string],
//     secciones: [
//       { tipo: 'texto',  titulo, contenido }      // contenido con formato ligero
//       { tipo: 'imagen', url, pie }
//       { tipo: 'audio',  url, titulo }
//       { tipo: 'cita',   contenido, autor } ],
//     estado: 'borrador' | 'publicada',
//     fijada,                         // las fijadas salen primero
//     autorId, autorNombre,
//     creadoEn, actualizadoEn, publicadoEn }
//
// Los archivos subidos viven en Cloudinary, carpeta Noticias/. Al editar o
// borrar una noticia se eliminan los que dejan de usarse.
// ─────────────────────────────────────────────────────────────────────────────
const { ObjectId } = require("mongodb")
const crypto = require("crypto")
const cloudinary = require("cloudinary").v2
const clientdb = require("../../Server")

const coleccion = clientdb.db("Server_db").collection("noticias")

const CARPETA = "Noticias"
const LIMITES = {
    titulo: 140,
    resumen: 300,
    etiquetas: 8,
    etiqueta: 24,
    secciones: 40,
    tituloSeccion: 120,
    texto: 8000,
    cita: 600,
    autorCita: 80,
    pie: 200,
    imagenBytes: 5 * 1024 * 1024,
    audioBytes: 10 * 1024 * 1024,
}
const TIPOS_SECCION = ["texto", "imagen", "audio", "cita"]
const ESTADOS = ["borrador", "publicada"]

// Lo que ve el público en los listados: todo menos el cuerpo
const PROYECCION_LISTA = { secciones: 0, autorId: 0 }

let indicesListos = null
function asegurarIndices() {
    if (!indicesListos) {
        indicesListos = Promise.all([
            coleccion.createIndex({ slug: 1 }, { unique: true }),
            coleccion.createIndex({ estado: 1, fijada: -1, publicadoEn: -1 }),
        ]).catch(err => {
            indicesListos = null
            console.error("[Noticias] No se pudieron crear los índices:", err.message)
        })
    }
    return indicesListos
}

function fallo(mensaje, status = 400) {
    const err = new Error(mensaje)
    err.status = status
    return err
}

const texto = (v, max) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max)
const linea = (v, max) => texto(v, max).replace(/\s+/g, " ")

function urlHttps(v) {
    const s = String(v ?? "").trim()
    if (!s) return ""
    try {
        const u = new URL(s)
        return u.protocol === "https:" ? u.href : null
    } catch {
        return null
    }
}

function aObjectId(id) {
    if (!ObjectId.isValid(String(id))) throw fallo("Noticia no encontrada.", 404)
    return new ObjectId(String(id))
}

function crearSlugBase(titulo) {
    const base = titulo
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/g, "")
    return base || "noticia"
}

async function slugLibre(titulo) {
    const base = crearSlugBase(titulo)
    let slug = base
    for (let n = 2; await coleccion.countDocuments({ slug }, { limit: 1 }); n++) {
        slug = `${base}-${n}`
    }
    return slug
}

function normalizarSeccion(s, i) {
    if (!s || typeof s !== "object" || !TIPOS_SECCION.includes(s.tipo)) {
        throw fallo(`La sección ${i + 1} no tiene un tipo válido.`)
    }
    if (s.tipo === "texto") {
        const sec = { tipo: "texto", titulo: linea(s.titulo, LIMITES.tituloSeccion), contenido: texto(s.contenido, LIMITES.texto) }
        if (!sec.titulo && !sec.contenido) throw fallo(`La sección ${i + 1} (texto) está vacía.`)
        return sec
    }
    if (s.tipo === "cita") {
        const sec = { tipo: "cita", contenido: texto(s.contenido, LIMITES.cita), autor: linea(s.autor, LIMITES.autorCita) }
        if (!sec.contenido) throw fallo(`La sección ${i + 1} (cita) está vacía.`)
        return sec
    }
    const url = urlHttps(s.url)
    if (!url) throw fallo(`La sección ${i + 1} (${s.tipo}) necesita un archivo o un enlace https.`)
    return s.tipo === "imagen"
        ? { tipo: "imagen", url, pie: linea(s.pie, LIMITES.pie) }
        : { tipo: "audio", url, titulo: linea(s.titulo, LIMITES.tituloSeccion) }
}

/** Valida y limpia lo que llega del editor. Lanza con status 400 si algo no cuadra. */
function normalizar(entrada) {
    const e = entrada && typeof entrada === "object" ? entrada : {}

    const titulo = linea(e.titulo, LIMITES.titulo)
    if (!titulo) throw fallo("La noticia necesita un título.")

    const portada = urlHttps(e.portada)
    if (portada === null) throw fallo("La portada debe ser un enlace https.")

    const vistas = new Set()
    const etiquetas = []
    for (const cruda of Array.isArray(e.etiquetas) ? e.etiquetas : []) {
        const etq = linea(cruda, LIMITES.etiqueta).replace(/^#+/, "")
        const clave = etq.toLowerCase()
        if (!etq || vistas.has(clave)) continue
        vistas.add(clave)
        etiquetas.push(etq)
        if (etiquetas.length === LIMITES.etiquetas) break
    }

    const crudas = Array.isArray(e.secciones) ? e.secciones : []
    if (crudas.length > LIMITES.secciones) throw fallo(`Una noticia admite hasta ${LIMITES.secciones} secciones.`)
    const secciones = crudas.map(normalizarSeccion)

    const estado = ESTADOS.includes(e.estado) ? e.estado : "borrador"
    if (estado === "publicada" && !secciones.length) throw fallo("Agrega al menos una sección antes de publicar.")

    // Sin resumen escrito, se toma el arranque del primer texto
    let resumen = texto(e.resumen, LIMITES.resumen)
    if (!resumen) {
        const primero = secciones.find(s => s.tipo === "texto" && s.contenido)
        if (primero) {
            const plano = primero.contenido.replace(/[*_`#>\[\]]/g, "").replace(/\s+/g, " ").trim()
            resumen = plano.length > 220 ? `${plano.slice(0, 217).trimEnd()}…` : plano
        }
    }

    return { titulo, resumen, portada, etiquetas, secciones, estado, fijada: Boolean(e.fijada) }
}

// ─── Archivos (Cloudinary) ───────────────────────────────────────────────────

function esImagen(b) {
    return (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47)                               // PNG
        || (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF)                                                // JPEG
        || (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)                               // GIF
        || (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP")                  // WEBP
}

function esAudio(b) {
    return b.toString("ascii", 0, 3) === "ID3"                                                              // MP3 con etiquetas
        || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)                                                        // MP3 / AAC sin etiquetas
        || b.toString("ascii", 0, 4) === "OggS"                                                             // OGG / Opus
        || (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE")                  // WAV
        || b.toString("ascii", 4, 8) === "ftyp"                                                             // M4A
}

/**
 * Sube una imagen o un audio que llega como Data URL en base64.
 * @returns {Promise<{ url: string, tipo: 'imagen'|'audio' }>}
 */
async function subirArchivo({ tipo, data }) {
    if (!["imagen", "audio"].includes(tipo)) throw fallo("Tipo de archivo no válido.")
    const partes = typeof data === "string" ? data.match(/^data:[a-zA-Z0-9.+/-]+;base64,(.+)$/s) : null
    if (!partes) throw fallo("El archivo no llegó en un formato válido.")

    const buffer = Buffer.from(partes[1], "base64")
    const maximo = tipo === "imagen" ? LIMITES.imagenBytes : LIMITES.audioBytes
    if (buffer.length < 16) throw fallo("El archivo está vacío.")
    if (buffer.length > maximo) throw fallo(`El archivo pesa más de ${Math.round(maximo / 1048576)} MB.`, 413)
    if (tipo === "imagen" && !esImagen(buffer)) throw fallo("Solo se aceptan imágenes PNG, JPEG, GIF o WEBP.")
    if (tipo === "audio" && !esAudio(buffer)) throw fallo("Solo se aceptan audios MP3, OGG, WAV o M4A.")

    const resultado = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                // Cloudinary guarda el audio bajo el tipo de recurso "video"
                resource_type: tipo === "imagen" ? "image" : "video",
                folder: CARPETA,
                public_id: `${tipo}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
            },
            (error, res) => (error ? reject(error) : resolve(res))
        ).end(buffer)
    })
    if (!resultado?.secure_url) throw fallo("No se pudo subir el archivo.", 502)
    return { url: resultado.secure_url, tipo }
}

function urlsDe(doc) {
    const urls = new Set()
    if (doc?.portada) urls.add(doc.portada)
    for (const s of doc?.secciones || []) if (s.url) urls.add(s.url)
    return urls
}

/** Borra de Cloudinary los archivos nuestros (carpeta Noticias/) que ya no usa ninguna noticia. */
async function limpiarArchivos(urlsAntes, urlsAhora = new Set()) {
    for (const url of urlsAntes) {
        if (urlsAhora.has(url)) continue
        const m = String(url).match(/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/(?:v\d+\/)?(Noticias\/[^.?#]+)/)
        if (!m) continue
        try {
            const enUso = await coleccion.countDocuments({ $or: [{ portada: url }, { "secciones.url": url }] }, { limit: 1 })
            if (!enUso) await cloudinary.uploader.destroy(decodeURIComponent(m[2]), { resource_type: m[1], invalidate: true })
        } catch (err) {
            console.warn("[Noticias] No se pudo borrar un archivo en desuso:", err?.message || err)
        }
    }
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

const serializar = (doc) => (doc ? { ...doc, _id: String(doc._id) } : null)

/** Listado público: solo publicadas, fijadas primero, sin el cuerpo. */
async function listarPublicadas({ limite, pagina, etiqueta } = {}) {
    await asegurarIndices()
    const lim = Math.min(Math.max(parseInt(limite, 10) || 10, 1), 30)
    const pag = Math.max(parseInt(pagina, 10) || 1, 1)
    const filtro = { estado: "publicada" }
    if (etiqueta) filtro.etiquetas = String(etiqueta).slice(0, LIMITES.etiqueta)

    const [docs, total, etiquetas] = await Promise.all([
        coleccion.find(filtro, { projection: PROYECCION_LISTA })
            .sort({ fijada: -1, publicadoEn: -1 }).skip((pag - 1) * lim).limit(lim).toArray(),
        coleccion.countDocuments(filtro),
        coleccion.distinct("etiquetas", { estado: "publicada" }),
    ])
    return {
        noticias: docs.map(serializar),
        total,
        pagina: pag,
        hayMas: pag * lim < total,
        etiquetas: etiquetas.sort((a, b) => a.localeCompare(b, "es")),
    }
}

async function obtenerPublicada(slug) {
    const doc = await coleccion.findOne(
        { slug: String(slug).slice(0, 80), estado: "publicada" },
        { projection: { autorId: 0 } }
    )
    return serializar(doc)
}

/** Listado del panel: todo, lo editado más reciente primero. */
async function listarTodas({ estado } = {}) {
    await asegurarIndices()
    const filtro = ESTADOS.includes(estado) ? { estado } : {}
    const [docs, publicadas, borradores] = await Promise.all([
        coleccion.find(filtro, { projection: { secciones: 0 } }).sort({ actualizadoEn: -1 }).limit(200).toArray(),
        coleccion.countDocuments({ estado: "publicada" }),
        coleccion.countDocuments({ estado: "borrador" }),
    ])
    return { noticias: docs.map(serializar), totales: { publicadas, borradores } }
}

async function obtener(id) {
    const doc = await coleccion.findOne({ _id: aObjectId(id) })
    if (!doc) throw fallo("Noticia no encontrada.", 404)
    return serializar(doc)
}

// ─── Escritura ───────────────────────────────────────────────────────────────

async function crear(entrada, autor) {
    await asegurarIndices()
    const datos = normalizar(entrada)
    const ahora = new Date()
    const doc = {
        slug: await slugLibre(datos.titulo),
        ...datos,
        autorId: String(autor.id),
        autorNombre: linea(autor.nombre, 80) || "Staff",
        creadoEn: ahora,
        actualizadoEn: ahora,
        publicadoEn: datos.estado === "publicada" ? ahora : null,
    }
    const { insertedId } = await coleccion.insertOne(doc)
    return serializar({ _id: insertedId, ...doc })
}

async function actualizar(id, entrada) {
    const _id = aObjectId(id)
    const previa = await coleccion.findOne({ _id })
    if (!previa) throw fallo("Noticia no encontrada.", 404)

    const datos = normalizar(entrada)
    const ahora = new Date()
    const cambios = {
        ...datos,
        actualizadoEn: ahora,
        // La fecha de publicación es la de la primera vez: editar no la mueve
        publicadoEn: datos.estado === "publicada" ? (previa.publicadoEn || ahora) : previa.publicadoEn || null,
    }
    await coleccion.updateOne({ _id }, { $set: cambios })
    const nueva = { ...previa, ...cambios }
    await limpiarArchivos(urlsDe(previa), urlsDe(nueva))
    return serializar(nueva)
}

/** Publicar / despublicar / fijar sin pasar por el editor. */
async function cambiarEstado(id, { estado, fijada }) {
    const _id = aObjectId(id)
    const previa = await coleccion.findOne({ _id })
    if (!previa) throw fallo("Noticia no encontrada.", 404)

    const cambios = { actualizadoEn: new Date() }
    if (ESTADOS.includes(estado)) {
        if (estado === "publicada" && !(previa.secciones || []).length) throw fallo("Agrega al menos una sección antes de publicar.")
        cambios.estado = estado
        if (estado === "publicada" && !previa.publicadoEn) cambios.publicadoEn = cambios.actualizadoEn
    }
    if (typeof fijada === "boolean") cambios.fijada = fijada
    await coleccion.updateOne({ _id }, { $set: cambios })
    return serializar({ ...previa, ...cambios })
}

async function eliminar(id) {
    const _id = aObjectId(id)
    const previa = await coleccion.findOne({ _id })
    if (!previa) throw fallo("Noticia no encontrada.", 404)
    await coleccion.deleteOne({ _id })
    await limpiarArchivos(urlsDe(previa))
    return serializar(previa)
}

module.exports = {
    LIMITES,
    listarPublicadas,
    obtenerPublicada,
    listarTodas,
    obtener,
    crear,
    actualizar,
    cambiarEstado,
    eliminar,
    subirArchivo,
}
