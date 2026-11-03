// functions/mensajesServidor.js
// Mensajes "fijos" del servidor que el dashboard publica y mantiene al día: tiendas por lugar (enfermería, cafetería…)
// y mensajes ComponentsV2 personalizados. Cada uno vive en Server_db.mensajes_servidor con el canal y el messageId
// donde está publicado, así se puede editar en su sitio o volver a enviar si alguien lo borró.
//
// Los objetos de una tienda salen de Rol_db.Objetos_globales: entran los que tienen el lugar en `en_tienda`
// y además `inStore: true` (el mismo interruptor que comprueba /rol comprar).

const crypto = require("crypto")
const { crearCustomId } = require("../utils/constructores/customId")
const {
    ErrorEvento,
    validarComponentesV2,
    limpiarParaEnvio,
    componentesDesdeJson,
    resolverDestino
} = require("./eventosMensaje")

const COLECCION = "mensajes_servidor"
const EMOJI_LUMENS = "<a:Lumens:1335709991130103910>"
const NOTA_TIENDA_DEFECTO = "Elige qué hacer en el menú de abajo"
const MAX_TEXTO_V2 = 4000      // Discord suma el texto de todos los Text Display del mensaje
const MAX_OPCIONES_SELECT = 25
const MAX_FRASES = 30
const MAX_IMAGENES = 15
const ID_VALIDO = /^[a-z0-9_]{3,40}$/   // sin "-": es el separador de crearCustomId

// Lo que se puede hacer en cada lugar desde el menú del panel; cada tienda elige las suyas en el dashboard
const ACCIONES_TIENDA = {
    comprar: { label: "Comprar objetos", descripcion: "Abre tu pedido con lo que hay en la estantería" },
    enfermera: { label: "Solicitar una enfermera", descripcion: "Pide que alguien te atienda" },
    observar: { label: "Observar", descripcion: "Mira con calma a tu alrededor" }
}
const ACCIONES_DEFECTO = ["comprar", "observar"]

// Lo que se ve cuando un lugar no tiene nada a la venta (en el panel y en el pedido)
const FRASES_ESTANTERIA_VACIA = [
    "No puedes comprar nada aquí.",
    "La estantería está vacía.",
    "Parece que esta estantería tiene polvo.",
    "Solo queda una etiqueta de precio sin nada que la acompañe.",
    "Alguien se llevó lo último hace rato.",
    "Las repisas esperan a que llegue el próximo pedido."
]

/**
 * En el panel la frase tiene que ser estable: si cambiara en cada render, la huella cambiaría
 * y el refresco automático editaría el mensaje sin motivo. Se elige por el id de la tienda.
 */
function fraseEstanteriaVacia(semilla) {
    const n = [...String(semilla)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
    return FRASES_ESTANTERIA_VACIA[n % FRASES_ESTANTERIA_VACIA.length]
}

/** Quita espacios y duplicados (sin distinguir mayúsculas) de una lista de lugares de tienda. */
function normalizarTiendas(valor) {
    const lista = Array.isArray(valor) ? valor : (typeof valor === "string" ? valor.split(",") : [])
    const vistos = new Set()
    const resultado = []
    for (const bruto of lista) {
        const lugar = String(bruto ?? "").trim().slice(0, 60)
        const clave = lugar.toLowerCase()
        if (!lugar || vistos.has(clave)) continue
        vistos.add(clave)
        resultado.push(lugar)
    }
    return resultado
}

const mismoLugar = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

function elegirAlAzar(lista) {
    return lista.length ? Math.floor(Math.random() * lista.length) : null
}

function normalizarAcciones(valor) {
    if (!Array.isArray(valor)) return [...ACCIONES_DEFECTO]
    return Object.keys(ACCIONES_TIENDA).filter(clave => valor.includes(clave))
}

/** Valida y deja en forma canónica la configuración que llega del dashboard. */
function normalizarConfig(entrada, idForzado = null) {
    const datos = entrada && typeof entrada === "object" ? entrada : {}
    const id = String(idForzado ?? datos._id ?? datos.id ?? "").trim().toLowerCase()
    if (!ID_VALIDO.test(id)) throw new ErrorEvento(400, "El identificador debe tener de 3 a 40 caracteres: minúsculas, números o «_».")
    if (id === "objetos") throw new ErrorEvento(400, "«objetos» es un identificador reservado.")

    const tipo = datos.tipo === "personalizado" ? "personalizado" : "tienda"
    const nombre = String(datos.nombre || "").trim().slice(0, 80)
    if (!nombre) throw new ErrorEvento(400, "Ponle un nombre al mensaje.")

    const canalId = String(datos.canalId || "").trim()
    if (canalId && !/^\d{17,20}$/.test(canalId)) throw new ErrorEvento(400, "El ID del canal debe ser un número de Discord (17 a 20 cifras).")

    const config = { _id: id, tipo, nombre, canalId: canalId || null }

    if (tipo === "tienda") {
        const t = datos.tienda && typeof datos.tienda === "object" ? datos.tienda : {}
        const lugar = String(t.lugar || "").trim().slice(0, 60)
        if (!lugar) throw new ErrorEvento(400, "La tienda necesita un lugar (el valor que se busca en «en_tienda» de los objetos).")
        const color = t.accent_color === null || t.accent_color === "" || t.accent_color === undefined ? null : Number(t.accent_color)
        config.tienda = {
            lugar,
            titulo: String(t.titulo || `Tienda de ${lugar}`).trim().slice(0, 120),
            frases: (Array.isArray(t.frases) ? t.frases : []).map(f => String(f ?? "").trim().slice(0, 600)).filter(Boolean).slice(0, MAX_FRASES),
            imagenes: (Array.isArray(t.imagenes) ? t.imagenes : []).map(u => String(u ?? "").trim()).filter(u => /^https?:\/\/\S+$/i.test(u)).slice(0, MAX_IMAGENES),
            nota: String(t.nota ?? NOTA_TIENDA_DEFECTO).trim().slice(0, 300),
            accent_color: Number.isInteger(color) && color >= 0 && color <= 0xFFFFFF ? color : null,
            acciones: normalizarAcciones(t.acciones)
        }
    } else {
        const components = componentesDesdeJson(datos.components ?? [])
        const problemas = validarComponentesV2(components)
        if (problemas.length) throw new ErrorEvento(400, problemas.join(" "))
        config.components = JSON.parse(JSON.stringify(components))
    }
    return config
}

/** Objetos de Objetos_globales aplanados, con lo que necesita el editor de tiendas. */
async function listarObjetosTienda(dbRol) {
    const regiones = await dbRol.collection("Objetos_globales").find({}, {
        projection: { "Objetos.ID": 1, "Objetos.ID_Autocomplete": 1, "Objetos.Nombre": 1, "Objetos.Rareza": 1, "Objetos.precio": 1, "Objetos.inStore": 1, "Objetos.en_tienda": 1, "Objetos.Cantidad": 1, "Objetos.imagenURL": 1 }
    }).toArray()

    return regiones.flatMap(r => (r.Objetos || []).map(o => ({
        region: r._id,
        ID: Number(o.ID),
        clave: `${r._id}_${Number(o.ID)}`,
        idVisible: o.ID_Autocomplete || `${r._id}${Number(o.ID)}`,
        Nombre: o.Nombre || "(sin nombre)",
        Rareza: o.Rareza || null,
        precio: Number(o.precio) || 0,
        inStore: o.inStore === true,
        en_tienda: normalizarTiendas(o.en_tienda),
        Cantidad: o.Cantidad ?? null,
        imagenURL: o.imagenURL || null
    }))).sort((a, b) => a.region.localeCompare(b.region, "es") || a.ID - b.ID)
}

/**
 * Construye los componentes de una tienda. `eleccion` fija qué frase e imagen usar (índices);
 * si falta, se eligen al azar. Devuelve también lo elegido para poder repetirlo al publicar.
 */
function construirTienda(tienda, objetos, eleccion = {}) {
    const enLugar = objetos.filter(o => o.en_tienda.some(l => mismoLugar(l, tienda.lugar)))
    const aLaVenta = enLugar.filter(o => o.inStore)
    const avisos = []
    const bloqueantes = []

    const fraseIdx = Number.isInteger(eleccion.frase) && tienda.frases[eleccion.frase] !== undefined ? eleccion.frase : elegirAlAzar(tienda.frases)
    const imagenIdx = Number.isInteger(eleccion.imagen) && tienda.imagenes[eleccion.imagen] !== undefined ? eleccion.imagen : elegirAlAzar(tienda.imagenes)
    const frase = fraseIdx === null ? null : tienda.frases[fraseIdx]
    const imagen = imagenIdx === null ? null : tienda.imagenes[imagenIdx]

    const sinVenta = enLugar.length - aLaVenta.length
    if (sinVenta > 0) avisos.push(`${sinVenta} ${sinVenta === 1 ? "objeto tiene" : "objetos tienen"} este lugar en «en_tienda» pero «En Tienda» desactivado: no aparecen.`)

    const intro = [frase ? `-# ${frase}` : null, tienda.nota ? `-# ${tienda.nota}` : null].filter(Boolean).join("\n\n")
    const lineas = aLaVenta.length
        // El espacio al final de cada línea esquiva el bug de "-#" dentro de una lista en Discord Canary (Windows)
        ? aLaVenta.map(o => `- -# ${o.Nombre} ❥✦ \`${o.precio}\` ${EMOJI_LUMENS} `).join("\n")
        : `-# ${fraseEstanteriaVacia(tienda._idMensaje || tienda.lugar)}`

    const hijos = [{ type: 10, content: `# ${tienda.titulo}` }]
    if (intro) hijos.push({ type: 10, content: intro })
    hijos.push(
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: `### Objetos en la estanteria:\n${lineas}` }
    )
    if (imagen) {
        hijos.push(
            { type: 14, divider: true, spacing: 1 },
            { type: 12, items: [{ media: { url: imagen } }] }
        )
    }
    const acciones = normalizarAcciones(tienda.acciones)
    if (acciones.length) {
        hijos.push(
            { type: 14, divider: true, spacing: 1 },
            {
                type: 1,
                components: [{
                    type: 3,
                    custom_id: crearCustomId({ action: "tienda_accion", extras: [tienda._idMensaje || "tienda"] }),
                    placeholder: "Selecciona una acción...",
                    min_values: 1,
                    max_values: 1,
                    options: acciones.map(clave => ({ label: ACCIONES_TIENDA[clave].label, value: clave, description: ACCIONES_TIENDA[clave].descripcion }))
                }]
            }
        )
    }
    if (acciones.includes("comprar") && !aLaVenta.length) avisos.push("«Comprar objetos» está activo pero la estantería está vacía.")
    // El modal de compra lista los objetos en un select de Discord, que admite 25 opciones
    if (aLaVenta.length > MAX_OPCIONES_SELECT) avisos.push(`El modal de compra solo puede listar ${MAX_OPCIONES_SELECT} objetos; quedan fuera ${aLaVenta.length - MAX_OPCIONES_SELECT}.`)

    const container = { type: 17, components: hijos }
    if (tienda.accent_color !== null && tienda.accent_color !== undefined) container.accent_color = tienda.accent_color
    const components = [container]

    const texto = hijos.filter(h => h.type === 10).reduce((n, h) => n + h.content.length, 0)
    if (texto > MAX_TEXTO_V2) bloqueantes.push(`El texto suma ${texto} caracteres y Discord admite ${MAX_TEXTO_V2} por mensaje: quita objetos o acorta frases.`)

    return {
        components,
        eleccion: { frase: fraseIdx, imagen: imagenIdx },
        objetos: { enLugar: enLugar.length, aLaVenta: aLaVenta.length },
        avisos,
        bloqueantes
    }
}

/** Componentes de cualquier mensaje gestionado, listos para enviar, con sus problemas. */
async function construirMensaje(config, dbRol, eleccion = {}, objetosCache = null) {
    if (config.tipo === "personalizado") {
        return { components: config.components, eleccion: {}, objetos: null, avisos: [], problemas: validarComponentesV2(config.components) }
    }
    const objetos = objetosCache || await listarObjetosTienda(dbRol)
    const { bloqueantes, ...r } = construirTienda({ ...config.tienda, _idMensaje: config._id }, objetos, eleccion)
    return { ...r, problemas: [...validarComponentesV2(r.components), ...bloqueantes] }
}

/** Huella del contenido: si cambia respecto a la publicada, el mensaje está desactualizado. */
function firmaComponentes(components) {
    return crypto.createHash("sha1").update(JSON.stringify(limpiarParaEnvio(components))).digest("hex")
}

/** Comprueba en Discord si el mensaje sigue existiendo. */
async function estadoEnDiscord(client, guildId, doc) {
    if (!doc.canalId) return { estado: "sin_canal" }
    if (!doc.messageId) return { estado: "sin_publicar" }
    try {
        const canal = await client.channels.fetch(doc.canalId).catch(() => null)
        if (!canal || canal.guildId !== guildId) return { estado: "canal_perdido" }
        const mensaje = await canal.messages.fetch(doc.messageId).catch(() => null)
        if (!mensaje) return { estado: "borrado", canalNombre: canal.name }
        return { estado: "publicado", canalNombre: canal.name, url: mensaje.url }
    } catch {
        return { estado: "desconocido" }
    }
}

/** Lista los mensajes con su estado en Discord y si su contenido cambió desde la última publicación. */
async function listarMensajes(client, guildId, dbServer, dbRol) {
    const docs = await dbServer.collection(COLECCION).find({}).sort({ tipo: 1, nombre: 1 }).toArray()
    const objetos = docs.some(d => d.tipo === "tienda") ? await listarObjetosTienda(dbRol) : []

    return Promise.all(docs.map(async doc => {
        const discord = client ? await estadoEnDiscord(client, guildId, doc) : { estado: "desconocido" }
        let desactualizado = false
        let problemas = []
        try {
            const ultima = doc.ultimaPublicacion
            const actual = await construirMensaje(doc, dbRol, ultima?.eleccion || {}, objetos)
            problemas = actual.problemas
            desactualizado = Boolean(ultima?.firma) && ultima.firma !== firmaComponentes(actual.components)
        } catch (err) {
            problemas = [err.message]
        }
        return { ...doc, discord, desactualizado, problemas }
    }))
}

async function obtenerDoc(dbServer, id) {
    const doc = await dbServer.collection(COLECCION).findOne({ _id: String(id) })
    if (!doc) throw new ErrorEvento(404, `No existe el mensaje '${id}'.`)
    return doc
}

/** Crea o reemplaza la configuración. Conserva el messageId y el historial de publicación. */
async function guardarMensaje(dbServer, id, entrada, autorId) {
    const config = normalizarConfig(entrada, id)
    const coleccion = dbServer.collection(COLECCION)
    const previo = await coleccion.findOne({ _id: config._id })
    if (previo && previo.tipo !== config.tipo) throw new ErrorEvento(400, "No se puede cambiar el tipo de un mensaje ya creado; crea otro.")

    const ahora = new Date()
    const set = { ...config, actualizadoEn: ahora, actualizadoPor: autorId }
    delete set._id
    if (config.tipo === "tienda") set.components = null
    else set.tienda = null
    // Mover el mensaje a otro canal deja huérfano el anterior: se olvida y la próxima publicación lo envía nuevo
    if (previo && previo.canalId !== config.canalId) set.messageId = null

    await coleccion.updateOne(
        { _id: config._id },
        { $set: set, $setOnInsert: { creadoEn: ahora, creadoPor: autorId, ...(previo ? {} : { messageId: null, ultimaPublicacion: null }) } },
        { upsert: true }
    )
    return coleccion.findOne({ _id: config._id })
}

/**
 * Publica el mensaje. modo 'actualizar': edita el existente o lo envía si ya no está.
 * modo 'reenviar': borra el anterior (si sigue ahí) y manda uno nuevo al final del canal.
 */
async function publicarMensaje(client, guildId, dbServer, dbRol, id, { modo = "actualizar", eleccion = {} } = {}, autorId) {
    const doc = await obtenerDoc(dbServer, id)
    if (!doc.canalId) throw new ErrorEvento(400, "Este mensaje no tiene canal asignado.")

    const { canal, info } = await resolverDestino(client, guildId, doc.canalId)
    if (info.tipo === "foro") throw new ErrorEvento(400, "Un foro no admite mensajes sueltos: usa el ID de una publicación (hilo) del foro.")
    if (info.permisosFaltantes.length) throw new ErrorEvento(403, `Al bot le faltan permisos en #${info.nombre}: ${info.permisosFaltantes.join(", ")}.`)

    const construido = await construirMensaje(doc, dbRol, eleccion)
    if (construido.problemas.length) throw new ErrorEvento(400, construido.problemas.join(" "))
    const payload = { components: limpiarParaEnvio(construido.components), flags: ["IsComponentsV2"] }

    const anterior = doc.messageId ? await canal.messages.fetch(doc.messageId).catch(() => null) : null
    // 'editar' nunca envía nada nuevo: es lo que usan los refrescos automáticos, que no deben resucitar un panel borrado
    if (modo === "editar" && !anterior) return { accion: "omitido", url: null, messageId: null, canalNombre: info.nombre }
    let mensaje
    let accion
    try {
        if (anterior && modo !== "reenviar") {
            mensaje = await anterior.edit({ components: payload.components })
            accion = "editado"
        } else {
            mensaje = await canal.send(payload)
            accion = anterior ? "reenviado" : (doc.messageId ? "restaurado" : "enviado")
            if (anterior) await anterior.delete().catch(() => null)
        }
    } catch (err) {
        const detalle = err.rawError?.errors ? ` ${JSON.stringify(err.rawError.errors).slice(0, 600)}` : ""
        throw new ErrorEvento(400, `Discord rechazó el mensaje: ${err.message}${detalle}`)
    }

    const ultimaPublicacion = {
        fecha: new Date(),
        autor: autorId,
        accion,
        eleccion: construido.eleccion,
        firma: firmaComponentes(construido.components)
    }
    await dbServer.collection(COLECCION).updateOne({ _id: doc._id }, { $set: { messageId: mensaje.id, ultimaPublicacion } })
    return { accion, url: mensaje.url, messageId: mensaje.id, canalNombre: info.nombre }
}

/**
 * Vuelve a dibujar las tiendas publicadas cuyo contenido cambió (precios, objetos...), editándolas en su sitio.
 * Mantiene la frase e imagen de la última publicación. Se llama al arrancar el bot y al editar objetos desde el dashboard.
 * @param {{ lugares?: string[] }} [filtro] - Solo las tiendas de estos lugares; sin filtro, todas
 * @returns {Promise<{ editadas: string[], fallos: string[] }>}
 */
async function refrescarPaneles(client, guildId, dbServer, dbRol, { lugares = null } = {}) {
    const resultado = { editadas: [], fallos: [] }
    if (!client) return resultado
    const docs = await dbServer.collection(COLECCION).find({ tipo: "tienda", messageId: { $ne: null } }).toArray()
    const afectadas = lugares ? docs.filter(d => lugares.some(l => mismoLugar(l, d.tienda?.lugar || ""))) : docs
    if (!afectadas.length) return resultado

    const objetos = await listarObjetosTienda(dbRol)
    for (const doc of afectadas) {
        try {
            const eleccion = doc.ultimaPublicacion?.eleccion || {}
            const actual = await construirMensaje(doc, dbRol, eleccion, objetos)
            if (doc.ultimaPublicacion?.firma === firmaComponentes(actual.components)) continue
            const r = await publicarMensaje(client, guildId, dbServer, dbRol, doc._id, { modo: "editar", eleccion }, "auto")
            if (r.accion === "editado") resultado.editadas.push(doc._id)
        } catch (err) {
            resultado.fallos.push(`${doc._id}: ${err.message}`)
        }
    }
    if (resultado.editadas.length) console.log(`[Tiendas] Paneles refrescados: ${resultado.editadas.join(", ")}`)
    if (resultado.fallos.length) console.warn(`[Tiendas] No se pudieron refrescar: ${resultado.fallos.join(" · ")}`)
    return resultado
}

/** Configuración de una tienda por su id, o null si no existe. */
async function obtenerTienda(dbServer, id) {
    const doc = await dbServer.collection(COLECCION).findOne({ _id: String(id), tipo: "tienda" })
    return doc ? { ...doc, tienda: { ...doc.tienda, acciones: normalizarAcciones(doc.tienda?.acciones) } } : null
}

/** Borra la configuración y, si se pide, también el mensaje de Discord. */
async function eliminarMensaje(client, dbServer, id, borrarDeDiscord) {
    const doc = await obtenerDoc(dbServer, id)
    let borradoEnDiscord = false
    if (borrarDeDiscord && client && doc.canalId && doc.messageId) {
        const canal = await client.channels.fetch(doc.canalId).catch(() => null)
        const mensaje = canal?.messages ? await canal.messages.fetch(doc.messageId).catch(() => null) : null
        if (mensaje) borradoEnDiscord = Boolean(await mensaje.delete().catch(() => null))
    }
    await dbServer.collection(COLECCION).deleteOne({ _id: doc._id })
    return { borradoEnDiscord }
}

/**
 * Añade o quita un lugar del `en_tienda` de varios objetos.
 * @param {Array<{ region: string, ID: number, en: boolean }>} cambios
 */
async function asignarObjetosATienda(dbRol, lugar, cambios) {
    const lugarLimpio = String(lugar || "").trim().slice(0, 60)
    if (!lugarLimpio) throw new ErrorEvento(400, "Falta el lugar de la tienda.")
    if (!Array.isArray(cambios) || cambios.length === 0) throw new ErrorEvento(400, "No hay cambios que aplicar.")
    if (cambios.length > 200) throw new ErrorEvento(400, "Demasiados cambios a la vez (máximo 200).")

    const coleccion = dbRol.collection("Objetos_globales")
    const lugarRegex = new RegExp(`^${lugarLimpio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
    const ops = []
    for (const c of cambios) {
        const region = String(c?.region || "")
        const id = Number(c?.ID)
        if (!region || !Number.isFinite(id)) continue
        const filtro = { _id: region }
        const arrayFilters = [{ "o.ID": id }]
        // Se quita cualquier variante de mayúsculas antes de añadir, para no acabar con "Cafeteria" y "cafeteria"
        ops.push({ updateOne: { filter: filtro, update: { $pull: { "Objetos.$[o].en_tienda": { $regex: lugarRegex } } }, arrayFilters } })
        if (c.en) ops.push({ updateOne: { filter: filtro, update: { $addToSet: { "Objetos.$[o].en_tienda": lugarLimpio } }, arrayFilters } })
    }
    if (!ops.length) throw new ErrorEvento(400, "Ningún cambio válido.")

    // Los objetos antiguos no tienen en_tienda: $pull sobre un campo ausente no falla, y $addToSet lo crea
    await coleccion.bulkWrite(ops, { ordered: true })
    return { aplicados: cambios.length }
}

module.exports = {
    COLECCION,
    EMOJI_LUMENS,
    FRASES_ESTANTERIA_VACIA,
    NOTA_TIENDA_DEFECTO,
    ACCIONES_TIENDA,
    mismoLugar,
    normalizarTiendas,
    normalizarConfig,
    listarObjetosTienda,
    construirMensaje,
    listarMensajes,
    guardarMensaje,
    publicarMensaje,
    eliminarMensaje,
    asignarObjetosATienda,
    refrescarPaneles,
    obtenerTienda
}
