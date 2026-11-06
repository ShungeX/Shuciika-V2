// ─────────────────────────────────────────────────────────────────────────────
// Piezas de la vista de interacciones que comparten el envío
// (ejecutarInteraccion.js) y la respuesta (responderInteraccion.js).
// ─────────────────────────────────────────────────────────────────────────────
const getGifs = require("../getGifs")
const clientdb = require("../../Server")
const { menuInteraccion } = require("../../data/UI_ComponentsV2/menuInteraccion")
const { RESPUESTAS, azar } = require("./accionesInteraccion")
const { resultadoExpirado, lineaPuntos } = require("./amistades")
const pendientes = require("./pendientes")
const cfg = require("../../config/amistad")

const gifsDb = clientdb.db("Interaccion_gifs")
const TIEMPO_GIF_MS = 2000   // Discord da 3 s para responder: el gif no puede comerse ese margen
const GIF_RESPALDO = "https://c.tenor.com/2CjD23b-uaoAAAAd/tenor.gif"

const nombrePj = (pj) => pj?.perfil?.Nombre || pj?.Nombre || "Alguien"

async function gifNekos(endpoint) {
    const respaldo = new Promise(res => setTimeout(() => res(null), TIEMPO_GIF_MS))
    const r = await Promise.race([getGifs(endpoint), respaldo])
    return r?.url || GIF_RESPALDO
}

/** Gif de la acción: primero los gifs propios del servidor, luego nekos.best, con tiempo límite. */
async function obtenerGif(accion, guildId) {
    if (accion.gifsDb) {
        const doc = await gifsDb.collection(accion.gifsDb).findOne({ _id: guildId }).catch(() => null)
        if (doc?.gifs?.length) return azar(doc.gifs)
    }
    return gifNekos(accion.gif)
}

/** Gif al responder: el de la reacción (shrug, nope...) o, si no tiene, el de la acción. */
function gifRespuesta(accion, opcion, guildId) {
    return opcion?.gif ? gifNekos(opcion.gif) : obtenerGif(accion, guildId)
}

/** Opciones del menú según la categoría del tipo, con la elegida marcada. */
function opcionesMenu(tipo, elegida = null) {
    return RESPUESTAS[cfg.TIPOS[tipo].categoria].map(o => ({ label: o.label, value: o.valor, default: o.valor === elegida }))
}

/**
 * Al expirar se deshabilita el menú. Una interacción sin respuesta vale 0 y nunca
 * cuenta como rechazo. Sirve tanto para la interacción del comando como para la
 * del menú (cuando se devuelve): el token de ambas dura 15 min, más que
 * EXPIRACION_PENDIENTE_MS, así que editReply sigue funcionando.
 */
function programarExpiracion(interaction, { tipo, de, a, ts, lineaAccion, avatar, gif, customId }) {
    setTimeout(() => {
        if (!pendientes.liberar(tipo, de, a, ts)) return   // ya se respondió
        interaction.editReply({
            components: menuInteraccion({
                texto: `${lineaAccion}\n${lineaPuntos(resultadoExpirado(tipo))}`,
                avatar,
                gif,
                customId,
                opciones: opcionesMenu(tipo),
                placeholder: "Se quedó en el aire",
                deshabilitado: true,
            }),
            flags: ["IsComponentsV2"],
            allowedMentions: { parse: [] },
        }).catch(() => { })
    }, cfg.EXPIRACION_PENDIENTE_MS + 1000)
}

module.exports = { nombrePj, obtenerGif, gifRespuesta, opcionesMenu, programarExpiracion }
