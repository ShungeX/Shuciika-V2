// functions/mensajesServidor.js
// Mensajes "fijos" del servidor que el dashboard publica y mantiene al día: tiendas por lugar (enfermería, cafetería…)
// y mensajes ComponentsV2 personalizados. Cada uno vive en Server_db.mensajes_servidor con el canal y el messageId
// donde está publicado, así se puede editar en su sitio o volver a enviar si alguien lo borró.
//
// Los objetos de una tienda salen de Rol_db.Objetos_globales: entran los que tienen el lugar en `en_tienda`
// y además `inStore: true` (el mismo interruptor que comprueba /rol comprar).

const crypto = require("crypto")
const { PermissionFlagsBits } = require("discord.js")
const { crearCustomId } = require("../utils/constructores/customId")
const {
    ErrorEvento,
    validarComponentesV2,
    limpiarParaEnvio,
    componentesDesdeJson,
    resolverDestino
} = require("./eventosMensaje")
const vestibulos = require("./vestibulos")
const wh = require("./mensajesWebhooks")

const COLECCION = "mensajes_servidor"
const EMOJI_LUMENS = "<a:Lumens:1335709991130103910>"
const NOTA_TIENDA_DEFECTO = "Elige qué hacer en el menú de abajo"
const MAX_TEXTO_V2 = 4000      // Discord suma el texto de todos los Text Display del mensaje
const MAX_OPCIONES_SELECT = 25
const MAX_FRASES = 30
const MAX_IMAGENES = 15
const ID_VALIDO = /^[a-z0-9_]{3,40}$/   // sin "-": es el separador de crearCustomId
const IDS_RESERVADOS = new Set(["objetos", "servidor", "webhooks", "emojis", "adjuntos"])
const MAX_ETIQUETAS = 8
const MAX_ETIQUETA = 24
const COLECCION_PERFILES = "webhook_perfiles"

// Lo que se puede hacer en cada lugar desde el menú del panel; cada tienda elige las suyas en el dashboard
const ACCIONES_TIENDA = {
    comprar: { label: "Comprar objetos", descripcion: "Abre tu pedido con lo que hay en la estantería" },
    vender: { label: "Vender objetos", descripcion: "Ofrece a la tienda objetos de tu inventario" },
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
    if (IDS_RESERVADOS.has(id)) throw new ErrorEvento(400, `«${id}» es un identificador reservado.`)

    const tipo = ["personalizado", "vestibulo"].includes(datos.tipo) ? datos.tipo : "tienda"
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
            acciones: normalizarAcciones(t.acciones),
            // «Todos»: compra cualquier objeto vendible, no solo los que tienen este lugar en `vender_en`
            compra_todo: Boolean(t.compra_todo)
        }
    } else if (tipo === "vestibulo") {
        config.vestibulo = vestibulos.normalizarVestibulo(datos.vestibulo, id)
        // El vestíbulo se publica por defecto en el canal principal; solo se respeta `canalId` si se pidió otro canal
        if (!config.vestibulo.canalPersonalizado && config.vestibulo.raizId) config.canalId = config.vestibulo.raizId
    } else {
        const components = componentesDesdeJson(datos.components ?? [])
        const problemas = validarComponentesV2(components)
        if (problemas.length) throw new ErrorEvento(400, problemas.join(" "))
        config.components = JSON.parse(JSON.stringify(components))
        config.etiquetas = normalizarEtiquetas(datos.etiquetas)
        config.webhook = normalizarWebhook(datos.webhook)
        config.adjuntos = wh.normalizarAdjuntos(datos.adjuntos)
    }
    return config
}

/** Etiquetas libres de un mensaje personalizado, para filtrarlos en el dashboard. Sin repetir (sin distinguir mayúsculas). */
function normalizarEtiquetas(valor) {
    const vistas = new Set()
    const salida = []
    for (const e of Array.isArray(valor) ? valor : []) {
        const limpia = String(e ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_ETIQUETA)
        const clave = limpia.toLowerCase()
        if (!limpia || vistas.has(clave)) continue
        vistas.add(clave)
        salida.push(limpia)
        if (salida.length >= MAX_ETIQUETAS) break
    }
    return salida
}

/**
 * Identidad con la que se publica un personalizado. Desactivado: lo publica el bot.
 * modo 'propio': el webhook interno del bot en el canal, con el nombre y la foto que se elijan.
 * modo 'existente': un webhook que ya hay en el servidor (o pegado por URL); nombre y foto son opcionales
 * (si faltan se usan los del propio webhook). Discord no deja «discord» ni «clyde» en el nombre (máx. 80).
 */
function normalizarWebhook(valor) {
    const w = valor && typeof valor === "object" ? valor : {}
    const activo = Boolean(w.activo)
    const modo = w.modo === "existente" ? "existente" : "propio"
    const webhookId = String(w.webhookId || "").trim()
    const nombre = String(w.nombre || "").trim().slice(0, 80)
    const avatar = String(w.avatar || "").trim().slice(0, 500)
    if (activo) {
        if (modo === "existente" && !/^\d{17,20}$/.test(webhookId)) throw new ErrorEvento(400, "Elige qué webhook del servidor publica el mensaje.")
        if (modo === "propio" && !nombre) throw new ErrorEvento(400, "El webhook necesita un nombre.")
        if (/discord|clyde/i.test(nombre)) throw new ErrorEvento(400, "Discord no permite «discord» ni «clyde» en el nombre de un webhook.")
        if (avatar && !/^https?:\/\/\S+$/i.test(avatar)) throw new ErrorEvento(400, "La foto del webhook debe ser una URL que empiece por http(s)://.")
    }
    return { activo, modo, webhookId: modo === "existente" ? webhookId : null, nombre, avatar: avatar || null }
}

/** Quién firma el mensaje: si cambia, el mensaje publicado no se puede editar y hay que reenviarlo. */
function remitenteDe(doc) {
    const w = doc?.tipo === "personalizado" ? doc.webhook : null
    if (!w?.activo) return "bot"
    const clave = `${w.modo || "propio"}\n${w.webhookId || ""}\n${w.nombre}\n${w.avatar || ""}`
    return "webhook:" + crypto.createHash("sha1").update(clave).digest("hex").slice(0, 16)
}

/** Credenciales del webhook que publica el doc, comprobando que pueda escribir en ese canal. */
async function webhookParaDoc(client, guildId, dbServer, doc, canal) {
    const threadId = canal.isThread?.() ? canal.id : undefined
    if (doc.webhook.modo !== "existente") return { ...(await wh.webhookDelBot(client, canal)), threadId }
    const cred = await wh.credencialesWebhook(client, guildId, dbServer, doc.webhook.webhookId)
    const canalBase = threadId ? canal.parentId : canal.id
    if (cred.canalId !== canalBase) {
        const destino = await client.channels.fetch(cred.canalId).catch(() => null)
        throw new ErrorEvento(400, `Ese webhook solo publica en #${destino?.name || cred.canalId} (o en sus hilos). Cambia el canal del mensaje.`)
    }
    return { ...cred, threadId }
}

/** Borra un mensaje publicado; si lo mandó un webhook que conocemos se borra con él (no hace falta «Gestionar mensajes»). */
async function borrarMensajeDiscord(client, dbServer, canal, mensaje) {
    if (!mensaje) return false
    if (mensaje.webhookId) {
        try {
            const threadId = canal.isThread?.() ? canal.id : undefined
            const propio = await wh.webhookDelBot(client, canal).catch(() => null)
            const cred = propio?.id === mensaje.webhookId ? propio : await wh.credencialesWebhook(client, canal.guildId, dbServer, mensaje.webhookId)
            await wh.borrarMensajeWebhook(cred, mensaje.id, threadId)
            return true
        } catch { /* se intenta como mensaje normal */ }
    }
    return Boolean(await mensaje.delete().catch(() => null))
}

/* ── Perfiles de webhook guardados (nombre + foto reutilizables) ── */

async function listarPerfilesWebhook(dbServer) {
    return dbServer.collection(COLECCION_PERFILES).find({}).sort({ nombre: 1 }).toArray()
}

async function guardarPerfilWebhook(dbServer, id, entrada, autorId) {
    const limpio = String(id || "").trim().toLowerCase()
    if (!ID_VALIDO.test(limpio)) throw new ErrorEvento(400, "Identificador de perfil no válido.")
    const { nombre, avatar } = normalizarWebhook({ ...entrada, activo: true })
    await dbServer.collection(COLECCION_PERFILES).updateOne(
        { _id: limpio },
        { $set: { nombre, avatar, actualizadoEn: new Date(), actualizadoPor: autorId }, $setOnInsert: { creadoEn: new Date() } },
        { upsert: true }
    )
    return dbServer.collection(COLECCION_PERFILES).findOne({ _id: limpio })
}

async function eliminarPerfilWebhook(dbServer, id) {
    const r = await dbServer.collection(COLECCION_PERFILES).deleteOne({ _id: String(id) })
    if (!r.deletedCount) throw new ErrorEvento(404, "Ese perfil ya no existe.")
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

/**
 * Componentes de cualquier mensaje gestionado, listos para enviar, con sus problemas.
 * Un vestíbulo depende de los demás (sus destinos): se pasan en `extra.vestibulos`, o `extra.dbServer` para leerlos.
 */
async function construirMensaje(config, dbRol, eleccion = {}, objetosCache = null, extra = {}) {
    if (config.tipo === "personalizado") {
        const faltan = wh.adjuntosQueFaltan(config.adjuntos, config.components)
        const problemas = [...validarComponentesV2(config.components), ...faltan.map(n => `Falta la imagen adjunta «${n}»: súbela o quita la referencia attachment://${n}.`)]
        return { components: config.components, eleccion: {}, objetos: null, avisos: [], problemas }
    }
    if (config.tipo === "vestibulo") {
        const guardados = extra.vestibulos || (extra.dbServer ? await vestibulos.listarVestibulos(extra.dbServer) : [])
        const todos = [...guardados.filter(d => d._id !== config._id), config]
        const { bloqueantes, ...r } = vestibulos.construirVestibulo(config, todos)
        return { ...r, problemas: [...validarComponentesV2(r.components), ...bloqueantes] }
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
        // Cambió el nombre o la foto con que se publica: al publicar se reenvía en vez de editarse
        const remitenteCambiado = Boolean(doc.ultimaPublicacion?.firma) && (doc.ultimaPublicacion.remitente || "bot") !== remitenteDe(doc)
        try {
            const ultima = doc.ultimaPublicacion
            const actual = await construirMensaje(doc, dbRol, ultima?.eleccion || {}, objetos, { vestibulos: docs })
            problemas = actual.problemas
            desactualizado = Boolean(ultima?.firma) && (ultima.firma !== firmaComponentes(actual.components) || (ultima.remitente || "bot") !== remitenteDe(doc))
        } catch (err) {
            problemas = [err.message]
        }
        return { ...doc, discord, desactualizado, problemas, remitenteCambiado }
    }))
}

/**
 * Ids de los vestíbulos publicados cuyo mensaje ya no coincide con lo que se publicó. El menú de cada vestíbulo
 * depende de los demás (nombre, emoji, descripción, cerrado), así que se compara de verdad con la huella guardada
 * en vez de dar por pendientes a todos cada vez que se guarda uno.
 */
async function vestibulosDesactualizados(dbServer, dbRol) {
    const docs = await vestibulos.listarVestibulos(dbServer)
    const ids = []
    for (const doc of docs) {
        const firma = doc.ultimaPublicacion?.firma
        if (!firma) continue
        const actual = await construirMensaje(doc, dbRol, {}, null, { vestibulos: docs })
        if (firma !== firmaComponentes(actual.components)) ids.push(doc._id)
    }
    return ids
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
    const propio = config.tipo === "personalizado" ? "components" : config.tipo
    for (const campo of ["tienda", "components", "vestibulo"]) if (campo !== propio) set[campo] = null
    if (config.tipo !== "personalizado") { set.etiquetas = null; set.webhook = null; set.adjuntos = null }
    else set.adjuntos = await wh.vincularAdjuntos(dbServer, config._id, config.adjuntos)
    // Mover el mensaje a otro canal deja huérfano el anterior: se olvida y la próxima publicación lo envía nuevo
    if (previo && previo.canalId !== config.canalId) set.messageId = null

    await coleccion.updateOne(
        { _id: config._id },
        { $set: set, $setOnInsert: { creadoEn: ahora, creadoPor: autorId, ...(previo ? {} : { messageId: null, ultimaPublicacion: null }) } },
        { upsert: true }
    )
    // Solo puede haber un punto de aparición
    if (config.vestibulo?.inicial) {
        await coleccion.updateMany({ tipo: "vestibulo", _id: { $ne: config._id }, "vestibulo.inicial": true }, { $set: { "vestibulo.inicial": false } })
    }
    return coleccion.findOne({ _id: config._id })
}

/** Menciones permitidas al enviar: solo los personalizados hacen ping. */
function mencionesDe(doc) {
    return { parse: doc.tipo === "personalizado" ? ["everyone", "roles", "users"] : [] }
}

/** ¿Algún texto de los componentes cumple el patrón? */
function menciona(componentes, patron) {
    const textos = []
    const recorrer = (lista) => (lista || []).forEach(c => {
        if (typeof c?.content === "string") textos.push(c.content)
        recorrer(c?.components)
    })
    recorrer(componentes)
    return textos.some(t => patron.test(t))
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

    const construido = await construirMensaje(doc, dbRol, eleccion, null, { dbServer })
    if (construido.problemas.length) throw new ErrorEvento(400, construido.problemas.join(" "))
    const payload = { components: limpiarParaEnvio(construido.components), flags: ["IsComponentsV2"] }

    const anterior = doc.messageId ? await canal.messages.fetch(doc.messageId).catch(() => null) : null
    // 'editar' nunca envía nada nuevo: es lo que usan los refrescos automáticos, que no deben resucitar un panel borrado
    if (modo === "editar" && !anterior) return { accion: "omitido", url: null, messageId: null, canalNombre: info.nombre }

    // Con webhook, el nombre y la foto se fijan al enviar: si cambian (o se pasa de bot a webhook) hay que reenviarlo
    const remitente = remitenteDe(doc)
    const conWebhook = remitente !== "bot"
    const cred = conWebhook ? await webhookParaDoc(client, guildId, dbServer, doc, canal) : null
    if (cred && !cred.deApp && wh.tieneComponentesInteractivos(payload.components)) {
        throw new ErrorEvento(400, "Ese webhook no es de una app: Discord solo le deja enviar componentes no interactivos. Quita los botones que no son de enlace o los menús, o usa el webhook del bot.")
    }
    const anteriorEditable = anterior && (conWebhook
        ? anterior.webhookId === cred.id && (doc.ultimaPublicacion?.remitente || "bot") === remitente
        : !anterior.webhookId && anterior.author?.id === client.user.id)
    const reenviar = modo === "reenviar" || (anterior && !anteriorEditable)

    // Imágenes subidas desde el dashboard: se mandan como archivos y los componentes las usan con attachment://nombre
    const archivos = doc.tipo === "personalizado" ? await wh.archivosParaEnviar(dbServer, doc.adjuntos, payload.components) : []
    // Al editar, `attachments` reemplaza los adjuntos anteriores por los que se suben ahora
    // Los personalizados pueden avisar (@everyone, @here, roles, usuarios); tiendas y vestíbulos nunca mencionan
    const menciones = mencionesDe(doc)
    if (!conWebhook && menciona(payload.components, /@(everyone|here)/)) {
        const permisos = canal.permissionsFor(client.user)
        if (!permisos?.has(PermissionFlagsBits.MentionEveryone)) {
            throw new ErrorEvento(403, `El mensaje usa @everyone/@here, pero el bot no tiene «Mencionar @everyone, @here y todos los roles» en #${info.nombre}: no haría ping. Dale ese permiso o publícalo con un webhook.`)
        }
    }
    const cuerpoWh = { components: payload.components, flags: 1 << 15, allowed_mentions: menciones }

    let mensaje
    let accion
    try {
        if (anterior && !reenviar) {
            mensaje = conWebhook
                ? await wh.editarMensajeWebhook(cred, anterior.id, { payload: { components: payload.components, allowed_mentions: menciones, ...(archivos.length ? {} : { attachments: [] }) }, archivos, threadId: cred.threadId })
                : await anterior.edit({ components: payload.components, allowedMentions: { parse: menciones.parse }, files: archivos.map(a => ({ attachment: a.buffer, name: a.nombre })), attachments: [] })
            accion = "editado"
        } else {
            mensaje = conWebhook
                ? await wh.ejecutarWebhook(cred, {
                    payload: { ...cuerpoWh, ...(doc.webhook.nombre ? { username: doc.webhook.nombre } : {}), ...(doc.webhook.avatar ? { avatar_url: doc.webhook.avatar } : {}) },
                    archivos,
                    threadId: cred.threadId
                })
                : await canal.send({ ...payload, allowedMentions: { parse: menciones.parse }, files: archivos.map(a => ({ attachment: a.buffer, name: a.nombre })) })
            accion = anterior ? "reenviado" : (doc.messageId ? "restaurado" : "enviado")
            if (anterior) await borrarMensajeDiscord(client, dbServer, canal, anterior)
        }
    } catch (err) {
        if (err instanceof ErrorEvento) throw err
        const detalle = err.rawError?.errors ? ` ${JSON.stringify(err.rawError.errors).slice(0, 600)}` : ""
        throw new ErrorEvento(400, `Discord rechazó el mensaje: ${err.message}${detalle}`)
    }
    const url = mensaje.url || `https://discord.com/channels/${guildId}/${canal.id}/${mensaje.id}`

    const ultimaPublicacion = {
        fecha: new Date(),
        autor: autorId,
        accion,
        eleccion: construido.eleccion,
        firma: firmaComponentes(construido.components),
        remitente
    }
    await dbServer.collection(COLECCION).updateOne({ _id: doc._id }, { $set: { messageId: mensaje.id, ultimaPublicacion } })
    return { accion, url, messageId: mensaje.id, canalNombre: info.nombre }
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

/** Documento de un vestíbulo guardado; falla si no existe o es otro tipo de mensaje. */
async function obtenerVestibulo(dbServer, id) {
    const doc = await obtenerDoc(dbServer, id)
    if (doc.tipo !== "vestibulo" || !doc.vestibulo) throw new ErrorEvento(400, `'${id}' no es un vestíbulo.`)
    return doc
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
        if (mensaje) borradoEnDiscord = await borrarMensajeDiscord(client, dbServer, canal, mensaje)
    }
    await dbServer.collection(COLECCION).deleteOne({ _id: doc._id })
    if (doc.tipo === "personalizado") await wh.vincularAdjuntos(dbServer, doc._id, [])
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
    vestibulosDesactualizados,
    obtenerTienda,
    obtenerVestibulo,
    normalizarEtiquetas,
    listarPerfilesWebhook,
    guardarPerfilWebhook,
    eliminarPerfilWebhook
}
