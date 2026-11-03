// functions/eventosMensaje.js
// Mensajes de evento en formato ComponentsV2 que el dashboard envía a un canal, hilo o foro sin pasar por un comando.
// Los eventos son los .js de data/UI_ComponentsV2/eventos; se leen en cada petición para que editar un archivo no exija reiniciar el bot.

const fs = require("fs")
const path = require("path")
const vm = require("vm")
const { createRequire } = require("module")
const { ChannelType, PermissionFlagsBits } = require("discord.js")

const EVENTOS_DIR = path.join(__dirname, "..", "data", "UI_ComponentsV2", "eventos")

// Tipos de componente de Discord válidos en la raíz de un mensaje ComponentsV2
const TIPOS_RAIZ_V2 = new Set([1, 9, 10, 12, 13, 14, 17])
const MAX_COMPONENTES = 40
const MAX_TITULO_FORO = 100

/**
 * Ejecuta un archivo de evento y devuelve lo que produce.
 * Acepta dos formas: `module.exports = [...]` o el array suelto como última expresión del archivo
 * (vm devuelve el valor de la última sentencia, que es lo que un `require` normal descartaría).
 * @param {string} ruta
 */
function ejecutarArchivoEvento(ruta) {
    const codigo = fs.readFileSync(ruta, "utf8")
    const modulo = { exports: {} }
    const contexto = vm.createContext({
        require: createRequire(ruta),
        module: modulo,
        exports: modulo.exports,
        __filename: ruta,
        __dirname: path.dirname(ruta),
        console
    })
    const ultimaExpresion = new vm.Script(codigo, { filename: ruta }).runInContext(contexto, { timeout: 1000 })

    const exportado = modulo.exports
    const exportaAlgo = Array.isArray(exportado) || (exportado && typeof exportado === "object" && Object.keys(exportado).length > 0)
    return exportaAlgo ? exportado : ultimaExpresion
}

/**
 * Normaliza lo que exporta un evento a una lista de variantes { clave, components }.
 * - Array de componentes → una sola variante.
 * - { components: [...] } → una sola variante.
 * - { nombre: [...], otro: [...] } → una variante por clave (las funciones se ignoran, piden parámetros).
 */
function variantesDeEvento(valor) {
    // JSON ida y vuelta: saca los objetos del contexto de vm y descarta funciones y undefined
    const plano = (v) => JSON.parse(JSON.stringify(v))

    if (Array.isArray(valor)) return [{ clave: null, components: plano(valor) }]
    if (valor && typeof valor === "object") {
        if (Array.isArray(valor.components)) return [{ clave: null, components: plano(valor.components) }]
        return Object.entries(valor)
            .filter(([, v]) => Array.isArray(v))
            .map(([clave, v]) => ({ clave, components: plano(v) }))
    }
    return []
}

/** Lista todos los eventos de la carpeta con sus componentes ya resueltos (o el error de carga). */
function listarEventos() {
    if (!fs.existsSync(EVENTOS_DIR)) return []

    return fs.readdirSync(EVENTOS_DIR)
        .filter(archivo => archivo.endsWith(".js"))
        .sort((a, b) => a.localeCompare(b, "es"))
        .map(archivo => {
            const ruta = path.join(EVENTOS_DIR, archivo)
            const id = archivo.slice(0, -3)
            const modificado = fs.statSync(ruta).mtime.toISOString()
            try {
                const variantes = variantesDeEvento(ejecutarArchivoEvento(ruta))
                if (variantes.length === 0) {
                    return { id, archivo, modificado, variantes: [], error: "El archivo no produce ningún array de componentes." }
                }
                for (const variante of variantes) variante.problemas = validarComponentesV2(variante.components)
                return { id, archivo, modificado, variantes, error: null }
            } catch (err) {
                return { id, archivo, modificado, variantes: [], error: err.message }
            }
        })
}

/** Devuelve los componentes de un evento concreto, o lanza si no existe o no carga. */
function obtenerComponentesDeEvento(id, clave = null) {
    const evento = listarEventos().find(e => e.id === id)
    if (!evento) throw new ErrorEvento(404, `No existe el evento '${id}'.`)
    if (evento.error) throw new ErrorEvento(400, `El evento '${id}' no se puede cargar: ${evento.error}`)
    const variante = evento.variantes.find(v => v.clave === (clave || null)) || (clave ? null : evento.variantes[0])
    if (!variante) throw new ErrorEvento(404, `El evento '${id}' no tiene la variante '${clave}'.`)
    return variante.components
}

class ErrorEvento extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}

/**
 * Comprueba la forma mínima de un mensaje ComponentsV2. Devuelve una lista de problemas en español (vacía si está bien).
 * No sustituye a la validación de Discord, solo atrapa lo evidente antes de llamar a la API.
 */
function validarComponentesV2(components) {
    const problemas = []
    if (!Array.isArray(components) || components.length === 0) {
        return ["El mensaje necesita al menos un componente en la raíz."]
    }

    let total = 0
    const contar = (lista) => {
        for (const c of lista || []) {
            if (!c || typeof c !== "object") continue
            total++
            if (Array.isArray(c.components)) contar(c.components)
            if (c.accessory) total++
        }
    }
    contar(components)
    if (total > MAX_COMPONENTES) problemas.push(`Hay ${total} componentes y Discord admite como máximo ${MAX_COMPONENTES}.`)

    components.forEach((c, i) => {
        if (!c || typeof c !== "object") {
            problemas.push(`El elemento ${i + 1} de la raíz no es un objeto.`)
        } else if (!TIPOS_RAIZ_V2.has(Number(c.type))) {
            problemas.push(`El elemento ${i + 1} de la raíz tiene "type": ${JSON.stringify(c.type)}, que no vale en la raíz de un mensaje ComponentsV2.`)
        }
    })
    return problemas
}

/**
 * Prepara los componentes para la API: quita los null (Discord trata "ausente" como el valor por defecto
 * y algunos campos rechazan null) y los proxy_url, que solo existen en las respuestas.
 */
function limpiarParaEnvio(valor) {
    if (Array.isArray(valor)) return valor.map(limpiarParaEnvio)
    if (valor && typeof valor === "object") {
        const limpio = {}
        for (const [k, v] of Object.entries(valor)) {
            if (v === null || v === undefined || k === "proxy_url") continue
            limpio[k] = limpiarParaEnvio(v)
        }
        return limpio
    }
    return valor
}

/**
 * Interpreta un ComponentV2 pegado a mano en el dashboard. Solo JSON: el servidor nunca ejecuta código que llega del navegador.
 * Acepta un array de componentes, un único componente o un objeto { components: [...] }.
 */
function componentesDesdeJson(entrada) {
    let valor = entrada
    if (typeof entrada === "string") {
        try {
            valor = JSON.parse(entrada)
        } catch (err) {
            throw new ErrorEvento(400, `El JSON no es válido: ${err.message}`)
        }
    }
    if (Array.isArray(valor)) return valor
    if (valor && typeof valor === "object") {
        if (Array.isArray(valor.components)) return valor.components
        if (valor.type !== undefined) return [valor]
    }
    throw new ErrorEvento(400, "Se esperaba un array de componentes, un componente suelto o un objeto { components: [...] }.")
}

const TIPOS_DESTINO = {
    [ChannelType.GuildText]: "canal",
    [ChannelType.GuildAnnouncement]: "canal",
    [ChannelType.GuildVoice]: "canal",
    [ChannelType.PublicThread]: "hilo",
    [ChannelType.PrivateThread]: "hilo",
    [ChannelType.AnnouncementThread]: "hilo",
    [ChannelType.GuildForum]: "foro",
    [ChannelType.GuildMedia]: "foro"
}

/**
 * Busca el destino y comprueba que el bot pueda publicar ahí.
 * @param {import('discord.js').Client} client
 * @param {string} guildId - Solo se permite publicar en este servidor
 * @param {string} canalId
 */
async function resolverDestino(client, guildId, canalId) {
    const id = String(canalId || "").trim()
    if (!/^\d{17,20}$/.test(id)) throw new ErrorEvento(400, "El ID del destino debe ser un número de Discord (17 a 20 cifras).")

    const canal = await client.channels.fetch(id).catch(() => null)
    if (!canal) throw new ErrorEvento(404, "No encuentro ese canal, hilo o foro. Revisa el ID y que el bot pueda verlo.")
    if (canal.guildId !== guildId) throw new ErrorEvento(403, "Ese canal pertenece a otro servidor.")

    const tipo = TIPOS_DESTINO[canal.type]
    if (!tipo) throw new ErrorEvento(400, "Ese tipo de canal no admite mensajes (categoría, escenario…).")

    const permisos = canal.permissionsFor(client.user)
    const necesarios = tipo === "hilo"
        ? [[PermissionFlagsBits.SendMessagesInThreads, "Enviar mensajes en hilos"]]
        : tipo === "foro"
            ? [[PermissionFlagsBits.SendMessages, "Enviar mensajes (crear publicaciones)"]]
            : [[PermissionFlagsBits.SendMessages, "Enviar mensajes"]]
    necesarios.unshift([PermissionFlagsBits.ViewChannel, "Ver canal"])
    const faltan = necesarios.filter(([flag]) => !permisos?.has(flag)).map(([, nombre]) => nombre)

    const info = {
        id: canal.id,
        tipo,
        nombre: canal.name,
        padre: canal.parent?.name || null,
        archivado: tipo === "hilo" ? Boolean(canal.archived) : false,
        bloqueado: tipo === "hilo" ? Boolean(canal.locked) : false,
        permisosFaltantes: faltan,
        etiquetas: [],
        etiquetaObligatoria: false
    }

    if (tipo === "foro") {
        info.etiquetas = (canal.availableTags || []).map(t => ({ id: t.id, nombre: t.name, emoji: t.emoji?.name || null }))
        // ChannelFlags.RequireTag = 1 << 4
        info.etiquetaObligatoria = Boolean(canal.flags?.has?.(1 << 4))
    }

    return { canal, info }
}

/**
 * Envía los componentes al destino. En un foro crea una publicación nueva con el título dado.
 * @returns {Promise<{ url: string, messageId: string, channelId: string, tipo: string }>}
 */
async function enviarEventoMensaje(client, guildId, { canalId, components, tituloForo, etiquetas }) {
    const problemas = validarComponentesV2(components)
    if (problemas.length) throw new ErrorEvento(400, problemas.join(" "))

    const { canal, info } = await resolverDestino(client, guildId, canalId)
    if (info.permisosFaltantes.length) {
        throw new ErrorEvento(403, `Al bot le faltan permisos en #${info.nombre}: ${info.permisosFaltantes.join(", ")}.`)
    }

    const payload = { components: limpiarParaEnvio(components), flags: ["IsComponentsV2"] }

    try {
        if (info.tipo === "foro") {
            const titulo = String(tituloForo || "").trim()
            if (!titulo) throw new ErrorEvento(400, "Un foro necesita el título de la publicación.")
            if (titulo.length > MAX_TITULO_FORO) throw new ErrorEvento(400, `El título no puede pasar de ${MAX_TITULO_FORO} caracteres.`)

            const validas = new Set(info.etiquetas.map(t => t.id))
            const appliedTags = (Array.isArray(etiquetas) ? etiquetas : []).map(String).filter(t => validas.has(t)).slice(0, 5)
            if (info.etiquetaObligatoria && appliedTags.length === 0) {
                throw new ErrorEvento(400, "Este foro exige al menos una etiqueta.")
            }

            const hilo = await canal.threads.create({ name: titulo, message: payload, appliedTags })
            const mensaje = await hilo.fetchStarterMessage().catch(() => null)
            return {
                tipo: "foro",
                channelId: hilo.id,
                messageId: mensaje?.id || hilo.id,
                url: mensaje?.url || `https://discord.com/channels/${guildId}/${hilo.id}`
            }
        }

        // Un hilo archivado se desarchiva solo al recibir el mensaje; uno bloqueado solo admite a quien gestiona hilos
        if (info.tipo === "hilo" && info.bloqueado && !canal.permissionsFor(client.user)?.has(PermissionFlagsBits.ManageThreads)) {
            throw new ErrorEvento(403, "El hilo está bloqueado y el bot no tiene «Gestionar hilos».")
        }

        const mensaje = await canal.send(payload)
        return { tipo: info.tipo, channelId: canal.id, messageId: mensaje.id, url: mensaje.url }
    } catch (err) {
        if (err instanceof ErrorEvento) throw err
        // Errores de la API de Discord (componentes inválidos, límites…): se devuelven tal cual para poder corregir el JSON
        const detalle = err.rawError?.errors ? ` ${JSON.stringify(err.rawError.errors).slice(0, 600)}` : ""
        throw new ErrorEvento(400, `Discord rechazó el mensaje: ${err.message}${detalle}`)
    }
}

module.exports = {
    EVENTOS_DIR,
    ErrorEvento,
    listarEventos,
    obtenerComponentesDeEvento,
    validarComponentesV2,
    limpiarParaEnvio,
    componentesDesdeJson,
    resolverDestino,
    enviarEventoMensaje
}
