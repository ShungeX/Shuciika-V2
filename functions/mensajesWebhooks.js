// functions/mensajesWebhooks.js
// Lo que necesitan los mensajes personalizados del dashboard más allá del bot:
//  - Publicar con webhooks por la API REST, con ?wait=true (devuelve el mensaje y su ID, que hace falta para editarlo)
//    y ?with_components=true (sin él, un webhook que no es de una app ignora los componentes).
//  - Usar webhooks que ya existen en el servidor (listados por el bot o pegando su URL).
//  - Emojis de la aplicación y de los servidores donde está el bot.
//  - Imágenes subidas desde el dashboard que se adjuntan al mensaje (attachment://nombre).

const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { PermissionFlagsBits, WebhookType } = require("discord.js")
const { ErrorEvento } = require("./eventosMensaje")

const API = "https://discord.com/api/v10"
const WEBHOOK_INTERNO = "Navi · Mensajes"
const COLECCION_EXTERNOS = "webhooks_externos"
const COLECCION_ADJUNTOS = "mensajes_adjuntos"
const DIR_ADJUNTOS = path.join(__dirname, "..", "data", "adjuntos_mensajes")
const MAX_ADJUNTO = 8 * 1024 * 1024
const MAX_ADJUNTOS_MENSAJE = 10
const HORAS_ADJUNTO_SUELTO = 24     // una imagen que no acaba en ningún mensaje guardado se borra pasado este tiempo
const TIPOS_IMAGEN = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }
const URL_WEBHOOK = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d{17,20})\/([\w-]{20,})\/?(?:\?.*)?$/i

/* ── REST de webhooks ── */

function queryWebhook(params) {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) q.set(k, String(v))
    const s = q.toString()
    return s ? `?${s}` : ""
}

/** Cuerpo de la petición: JSON normal, o multipart con payload_json + files[n] si hay imágenes. */
function cuerpoWebhook(payload, archivos) {
    if (!archivos?.length) return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    const fd = new FormData()
    fd.append("payload_json", JSON.stringify({ ...payload, attachments: archivos.map((a, i) => ({ id: i, filename: a.nombre })) }))
    archivos.forEach((a, i) => fd.append(`files[${i}]`, new Blob([a.buffer], { type: a.tipo }), a.nombre))
    return { headers: {}, body: fd }
}

async function peticionWebhook(metodo, url, { payload, archivos } = {}, intento = 0) {
    const opciones = { method: metodo }
    if (payload) Object.assign(opciones, cuerpoWebhook(payload, archivos))
    const res = await fetch(url, opciones)
    if (res.status === 429 && intento < 2) {
        const datos = await res.json().catch(() => ({}))
        await new Promise(r => setTimeout(r, Math.ceil((datos.retry_after || 1) * 1000)))
        return peticionWebhook(metodo, url, { payload, archivos }, intento + 1)
    }
    if (res.status === 204) return null
    const datos = await res.json().catch(() => null)
    if (!res.ok) {
        if (res.status === 404) throw new ErrorEvento(404, "Discord no encuentra el webhook o el mensaje (puede que lo borraran).")
        const detalle = datos?.errors ? ` ${JSON.stringify(datos.errors).slice(0, 600)}` : ""
        throw new ErrorEvento(400, `Discord rechazó el mensaje: ${datos?.message || res.statusText}${detalle}`)
    }
    return datos
}

/** Envía con el webhook. wait=true para recibir el mensaje (con su ID); with_components=true para que respete los componentes. */
function ejecutarWebhook(cred, { payload, archivos, threadId }) {
    const q = queryWebhook({ wait: true, with_components: true, thread_id: threadId })
    return peticionWebhook("POST", `${API}/webhooks/${cred.id}/${cred.token}${q}`, { payload, archivos })
}

/** Edita un mensaje enviado por el webhook (hace falta el ID que devolvió el envío con wait=true). */
function editarMensajeWebhook(cred, messageId, { payload, archivos, threadId }) {
    const q = queryWebhook({ with_components: true, thread_id: threadId })
    return peticionWebhook("PATCH", `${API}/webhooks/${cred.id}/${cred.token}/messages/${messageId}${q}`, { payload, archivos })
}

function borrarMensajeWebhook(cred, messageId, threadId) {
    return peticionWebhook("DELETE", `${API}/webhooks/${cred.id}/${cred.token}/messages/${messageId}${queryWebhook({ thread_id: threadId })}`)
}

/* ── Webhooks: el propio del bot y los que ya existen en el servidor ── */

function avatarWebhook(id, hash) {
    return hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=128` : null
}

/** Webhook propio del bot en el canal (o en el padre de un hilo); lo crea si no existe. */
async function webhookDelBot(client, canal) {
    const padre = canal.isThread?.() ? canal.parent : canal
    if (!padre?.fetchWebhooks) throw new ErrorEvento(400, "Ese canal no admite webhooks.")
    if (!padre.permissionsFor(client.user)?.has(PermissionFlagsBits.ManageWebhooks)) {
        throw new ErrorEvento(403, `Al bot le falta el permiso «Gestionar webhooks» en #${padre.name} para publicar con otra identidad.`)
    }
    const existentes = await padre.fetchWebhooks()
    let wh = existentes.find(w => w.owner?.id === client.user.id && w.name === WEBHOOK_INTERNO && w.token)
    if (!wh) wh = await padre.createWebhook({ name: WEBHOOK_INTERNO, reason: "Mensajes personalizados del dashboard" })
    return { id: wh.id, token: wh.token, canalId: padre.id, deApp: true }
}

function parsearUrlWebhook(url) {
    const m = String(url || "").trim().match(URL_WEBHOOK)
    if (!m) throw new ErrorEvento(400, "Eso no parece la URL de un webhook de Discord (https://discord.com/api/webhooks/ID/TOKEN).")
    return { id: m[1], token: m[2] }
}

/** Comprueba una URL de webhook contra Discord y la guarda (el token nunca vuelve al navegador). */
async function registrarWebhookExterno(client, guildId, dbServer, url, autorId) {
    const cred = parsearUrlWebhook(url)
    const info = await peticionWebhook("GET", `${API}/webhooks/${cred.id}/${cred.token}`)
    if (info.guild_id !== guildId) throw new ErrorEvento(403, "Ese webhook es de otro servidor.")
    await dbServer.collection(COLECCION_EXTERNOS).updateOne(
        { _id: cred.id },
        { $set: { token: cred.token, canalId: info.channel_id, nombre: info.name, avatar: info.avatar, applicationId: info.application_id || null, actualizadoEn: new Date(), actualizadoPor: autorId }, $setOnInsert: { creadoEn: new Date() } },
        { upsert: true }
    )
    const canal = client ? await client.channels.fetch(info.channel_id).catch(() => null) : null
    return publicoWebhook({ id: cred.id, nombre: info.name, avatar: info.avatar, canalId: info.channel_id, canalNombre: canal?.name, applicationId: info.application_id, origen: "url" }, client)
}

async function olvidarWebhookExterno(dbServer, id) {
    const r = await dbServer.collection(COLECCION_EXTERNOS).deleteOne({ _id: String(id) })
    if (!r.deletedCount) throw new ErrorEvento(404, "Ese webhook no estaba guardado.")
}

function publicoWebhook(w, client) {
    return {
        id: w.id,
        nombre: w.nombre,
        avatarUrl: avatarWebhook(w.id, w.avatar),
        canalId: w.canalId,
        canalNombre: w.canalNombre || null,
        deApp: Boolean(w.applicationId && client?.application?.id && w.applicationId === client.application.id),
        origen: w.origen,
        usable: w.usable !== false
    }
}

/**
 * Webhooks disponibles: los del servidor que el bot puede ver (necesita «Gestionar webhooks») más los guardados por URL.
 * Se omite el webhook interno del bot, que ya es la opción «Webhook del bot».
 */
async function listarWebhooksServidor(client, guildId, dbServer) {
    const mapa = new Map()
    let aviso = null
    const guild = client ? await client.guilds.fetch(guildId).catch(() => null) : null
    if (guild) {
        if (guild.members.me?.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
            const lista = await guild.fetchWebhooks().catch(() => null)
            for (const w of lista?.values() || []) {
                if (w.type !== WebhookType.Incoming) continue
                if (w.owner?.id === client.user.id && w.name === WEBHOOK_INTERNO) continue
                mapa.set(w.id, { id: w.id, nombre: w.name, avatar: w.avatar, canalId: w.channelId, canalNombre: w.channel?.name, applicationId: w.applicationId, origen: "servidor", usable: Boolean(w.token) })
            }
        } else {
            aviso = "El bot no tiene «Gestionar webhooks» en el servidor: solo se ven los webhooks añadidos por URL."
        }
    }
    const guardados = await dbServer.collection(COLECCION_EXTERNOS).find({}).toArray()
    for (const g of guardados) {
        const previo = mapa.get(g._id)
        const canal = previo ? null : (client ? await client.channels.fetch(g.canalId).catch(() => null) : null)
        mapa.set(g._id, { ...(previo || {}), id: g._id, nombre: previo?.nombre || g.nombre, avatar: previo?.avatar ?? g.avatar, canalId: g.canalId, canalNombre: previo?.canalNombre || canal?.name, applicationId: g.applicationId, origen: "url", usable: true })
    }
    const webhooks = [...mapa.values()].map(w => publicoWebhook(w, client)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    return { webhooks, aviso }
}

/** Credenciales de un webhook existente: primero las guardadas por URL, si no las que da Discord al bot. */
async function credencialesWebhook(client, guildId, dbServer, webhookId) {
    const guardado = await dbServer.collection(COLECCION_EXTERNOS).findOne({ _id: String(webhookId) })
    if (guardado?.token) {
        return { id: guardado._id, token: guardado.token, canalId: guardado.canalId, deApp: Boolean(guardado.applicationId && guardado.applicationId === client?.application?.id) }
    }
    const guild = client ? await client.guilds.fetch(guildId).catch(() => null) : null
    const lista = guild ? await guild.fetchWebhooks().catch(() => null) : null
    const w = lista?.get(String(webhookId))
    if (!w) throw new ErrorEvento(404, "Ese webhook ya no existe en el servidor (o el bot no puede verlo). Elige otro o pega su URL.")
    if (!w.token) throw new ErrorEvento(400, `El bot no tiene acceso al token del webhook «${w.name}». Pega su URL para usarlo.`)
    return { id: w.id, token: w.token, canalId: w.channelId, deApp: w.applicationId === client.application?.id }
}

/* ── Emojis ── */

/** Emojis de la aplicación (del bot) y de cada servidor donde está, el principal primero. */
async function listarEmojis(client, guildId) {
    if (!client) return { aplicacion: [], servidores: [] }
    const app = await client.application?.emojis?.fetch().catch(() => null)
    const aplicacion = [...(app?.values() || [])].map(e => ({ id: e.id, nombre: e.name, animado: Boolean(e.animated) }))
    const servidores = [...client.guilds.cache.values()]
        .map(g => ({
            id: g.id,
            nombre: g.name,
            icono: g.iconURL({ size: 64 }),
            emojis: [...g.emojis.cache.values()].filter(e => e.available !== false).map(e => ({ id: e.id, nombre: e.name, animado: Boolean(e.animated) }))
        }))
        .filter(g => g.emojis.length)
        .sort((a, b) => (b.id === guildId) - (a.id === guildId) || a.nombre.localeCompare(b.nombre, "es"))
    return { aplicacion, servidores }
}

/* ── Imágenes adjuntas ── */

function limpiarNombreArchivo(nombre, ext) {
    const base = String(nombre || "imagen").replace(/\.[^.]*$/, "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "imagen"
    return `${base}_${crypto.randomBytes(2).toString("hex")}.${ext}`
}

/** Guarda una imagen subida. Queda «suelta» hasta que un mensaje guardado la usa. */
async function guardarAdjunto(dbServer, { buffer, tipo, nombre, autorId }) {
    const ext = TIPOS_IMAGEN[String(tipo || "").toLowerCase()]
    if (!ext) throw new ErrorEvento(400, "Solo se admiten imágenes PNG, JPG, GIF o WEBP.")
    if (!buffer?.length) throw new ErrorEvento(400, "La imagen está vacía.")
    if (buffer.length > MAX_ADJUNTO) throw new ErrorEvento(413, `La imagen pesa más de ${MAX_ADJUNTO / 1024 / 1024} MB.`)
    await fs.promises.mkdir(DIR_ADJUNTOS, { recursive: true })
    const id = crypto.randomBytes(12).toString("hex")
    const doc = { _id: id, nombre: limpiarNombreArchivo(nombre, ext), tipo: tipo.toLowerCase(), ext, tamano: buffer.length, creadoEn: new Date(), autorId, mensajeId: null, sueltoDesde: new Date() }
    await fs.promises.writeFile(path.join(DIR_ADJUNTOS, `${id}.${ext}`), buffer)
    await dbServer.collection(COLECCION_ADJUNTOS).insertOne(doc)
    purgarAdjuntos(dbServer).catch(err => console.warn("[Adjuntos] Error purgando:", err.message))
    return publicoAdjunto(doc)
}

function publicoAdjunto(doc) {
    return { id: doc._id, nombre: doc.nombre, tipo: doc.tipo, tamano: doc.tamano }
}

async function leerAdjunto(dbServer, id) {
    if (!/^[a-f0-9]{24}$/.test(String(id))) throw new ErrorEvento(400, "Identificador de imagen no válido.")
    const doc = await dbServer.collection(COLECCION_ADJUNTOS).findOne({ _id: String(id) })
    if (!doc) throw new ErrorEvento(404, "Esa imagen ya no existe (las que no se guardan en un mensaje se borran a las 24 h).")
    const buffer = await fs.promises.readFile(path.join(DIR_ADJUNTOS, `${doc._id}.${doc.ext}`)).catch(() => null)
    if (!buffer) throw new ErrorEvento(404, "Falta el archivo de esa imagen en el servidor.")
    return { doc, buffer }
}

/** Normaliza la lista de imágenes de un mensaje: [{ id, nombre }]. */
function normalizarAdjuntos(valor) {
    const vistos = new Set()
    return (Array.isArray(valor) ? valor : [])
        .filter(a => a && /^[a-f0-9]{24}$/.test(String(a.id)) && !vistos.has(a.id) && vistos.add(a.id))
        .map(a => ({ id: String(a.id), nombre: String(a.nombre || "").slice(0, 80) }))
        .slice(0, MAX_ADJUNTOS_MENSAJE)
}

/** Marca qué imágenes usa el mensaje; las que deja de usar vuelven a quedar sueltas (y se borran a las 24 h). */
async function vincularAdjuntos(dbServer, mensajeId, adjuntos) {
    const col = dbServer.collection(COLECCION_ADJUNTOS)
    const ids = (adjuntos || []).map(a => a.id)
    await col.updateMany({ mensajeId, _id: { $nin: ids } }, { $set: { mensajeId: null, sueltoDesde: new Date() } })
    if (ids.length) await col.updateMany({ _id: { $in: ids } }, { $set: { mensajeId }, $unset: { sueltoDesde: "" } })
    // El nombre guardado en el mensaje es siempre el real del archivo
    const docs = ids.length ? await col.find({ _id: { $in: ids } }).toArray() : []
    return adjuntos.filter(a => docs.some(d => d._id === a.id)).map(a => ({ id: a.id, nombre: docs.find(d => d._id === a.id).nombre }))
}

async function purgarAdjuntos(dbServer) {
    const col = dbServer.collection(COLECCION_ADJUNTOS)
    const limite = new Date(Date.now() - HORAS_ADJUNTO_SUELTO * 3600 * 1000)
    const viejos = await col.find({ mensajeId: null, sueltoDesde: { $lt: limite } }).toArray()
    for (const d of viejos) {
        await fs.promises.unlink(path.join(DIR_ADJUNTOS, `${d._id}.${d.ext}`)).catch(() => null)
        await col.deleteOne({ _id: d._id })
    }
    return viejos.length
}

/** Archivos que hay que subir con el mensaje: solo las imágenes que los componentes usan con attachment://nombre. */
async function archivosParaEnviar(dbServer, adjuntos, components) {
    const json = JSON.stringify(components || [])
    const usados = (adjuntos || []).filter(a => json.includes(`attachment://${a.nombre}`))
    const archivos = []
    for (const a of usados) {
        const { doc, buffer } = await leerAdjunto(dbServer, a.id)
        archivos.push({ nombre: doc.nombre, tipo: doc.tipo, buffer })
    }
    return archivos
}

/** attachment://… que no corresponde a ninguna imagen subida del mensaje. */
function adjuntosQueFaltan(adjuntos, components) {
    const nombres = new Set((adjuntos || []).map(a => a.nombre))
    const refs = [...JSON.stringify(components || []).matchAll(/attachment:\/\/([^"\\]+)/g)].map(m => m[1])
    return [...new Set(refs.filter(r => !nombres.has(r)))]
}

/** Botones que no son de enlace y menús: un webhook que no es de una app no puede enviarlos. */
function tieneComponentesInteractivos(lista) {
    for (const c of lista || []) {
        if (!c || typeof c !== "object") continue
        const t = Number(c.type)
        if ((t === 2 && Number(c.style) !== 5 && Number(c.style) !== 6) || [3, 5, 6, 7, 8].includes(t)) return true
        if (tieneComponentesInteractivos(c.components)) return true
        if (c.accessory && tieneComponentesInteractivos([c.accessory])) return true
    }
    return false
}

module.exports = {
    WEBHOOK_INTERNO,
    MAX_ADJUNTOS_MENSAJE,
    ejecutarWebhook,
    editarMensajeWebhook,
    borrarMensajeWebhook,
    webhookDelBot,
    parsearUrlWebhook,
    registrarWebhookExterno,
    olvidarWebhookExterno,
    listarWebhooksServidor,
    credencialesWebhook,
    listarEmojis,
    guardarAdjunto,
    leerAdjunto,
    normalizarAdjuntos,
    vincularAdjuntos,
    purgarAdjuntos,
    archivosParaEnviar,
    adjuntosQueFaltan,
    tieneComponentesInteractivos
}
