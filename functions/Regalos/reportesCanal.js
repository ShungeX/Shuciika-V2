// ─────────────────────────────────────────────────────────────────────────────
// Reportes de regalos → canal del staff (cfg.CANAL_REPORTES).
//
// El mensaje se arma con la INSTANTÁNEA guardada en reportes_regalo, así que
// muestra lo que se reportó aunque el regalo cambie o se purgue después.
// Botones (públicos, solo staff; los valida interaction/buttons/Rol/regalos/regaloStaff.js):
//   regaloStaff---devolver-{reporteId}  → regresa el regalo al autor + aviso en su buzón
//   regaloStaff---liberar-{reporteId}   → lo libera para quien lo recibió (y muestra la nota)
// ─────────────────────────────────────────────────────────────────────────────
const { crearCustomId } = require("../../utils/constructores/customId")
const cfg = require("../../config/regalos")
const { EMOJI_LUMENS } = require("../../data/UI_ComponentsV2/menuRegalo")

const textoV2 = (content) => ({ type: 10, content })
const separador = () => ({ type: 14, divider: true, spacing: 1 })
const ts = (d, f = "R") => (d ? `<t:${Math.floor(new Date(d).getTime() / 1000)}:${f}>` : "—")
const citar = (txt) => String(txt).split("\n").map(l => `> ${l}`).join("\n")
const SIN_MENCIONES = { parse: [] }

const ACCIONES = {
    devuelto: "↩️ Regresado al autor (con aviso)",
    descartado: "🗑️ Descartado (el autor ya no existe; con aviso)",
    liberado: "🎁 Liberado para quien lo recibió",
    nota_visible: "👁️ Cerrado sin cambios (ya estaba abierto; nota visible otra vez)",
    sin_cambios: "📝 Cerrado; el regalo ya no estaba retenido",
}

/**
 * Mensaje del reporte para el canal del staff.
 * @param {object} rep  Documento de reportes_regalo
 */
function construirReporte(rep) {
    const i = rep.instantanea || {}
    const motivo = cfg.MOTIVOS_REPORTE.find(m => m.id === rep.motivo)?.label || rep.motivo
    const retenido = i.estadoAlReportar === "pendiente"

    const cabecera = [
        "# 🚩 Reporte de regalo",
        `**Motivo:** ${motivo}`,
        `**Reportó:** ${i.paraNombre || "?"} (ID ${rep.reportantePj}) · <@${rep.reportanteUserId}>`,
        `**Autor:** ${i.deNombre || "?"} (ID ${i.de}) · <@${i.deUserId}>`,
        `**Para:** ${i.paraNombre || "?"} (ID ${i.para}) · <@${i.paraUserId}>`,
        `-# Enviado ${ts(i.creadoEn)} · reportado ${ts(rep.creadoEn)} · ${retenido ? "🔒 retenido sin abrir" : "📭 ya estaba abierto"}`,
    ]
    if (rep.texto) cabecera.push("", "**Lo que contó:**", citar(rep.texto))

    const env = i.envoltura || {}
    const items = i.contenido?.items || []
    const regalo = [`### ${env.titulo || "Regalo sin título"}`]
    regalo.push(env.nota ? citar(env.nota) : "-# Sin nota")
    regalo.push("", "**Contenido:**")
    regalo.push(items.length ? items.map(x => `- ${x.nombre} x${x.cantidad}`).join("\n") : "-# Sin objetos")
    if (i.contenido?.lumens > 0) regalo.push(`- ${i.contenido.lumens} Lumens ${EMOJI_LUMENS}`)

    const componentes = [textoV2(cabecera.join("\n")), separador(), textoV2(regalo.join("\n"))]
    if (env.banner) componentes.push({ type: 12, items: [{ media: { url: env.banner } }] })
    componentes.push(separador())

    if (rep.estado === "resuelto") {
        componentes.push(textoV2(`-# ✅ ${ACCIONES[rep.resultado] || rep.accion} · por <@${rep.staffId}> ${ts(rep.resueltoEn)}\n-# Reporte ${rep._id}`))
    } else {
        const id = (accion) => crearCustomId({ action: "regaloStaff", userId: "", extras: [accion, String(rep._id)] })
        componentes.push(textoV2(`-# Reporte ${rep._id}`))
        componentes.push({
            type: 1,
            components: [
                { type: 2, style: 4, custom_id: id("devolver"), label: retenido ? "Regresar al autor + aviso" : "Avisar al autor", emoji: { name: "↩️" } },
                { type: 2, style: 3, custom_id: id("liberar"), label: retenido ? "Liberar regalo" : "Cerrar sin cambios", emoji: { name: "🎁" } },
            ],
        })
    }
    return [{ type: 17, accent_color: rep.estado === "resuelto" ? 0x9DE0C2 : 0xD9475C, components: componentes }]
}

/** Manda el reporte al canal del staff. Nunca lanza: el reporte ya quedó guardado. */
async function enviarReporte(client, reporteId) {
    try {
        const rep = await require("./regalos").obtenerReporte(reporteId)
        if (!rep) return false
        const canal = await client.channels.fetch(cfg.CANAL_REPORTES)
        if (!canal?.isTextBased?.()) throw new Error(`el canal ${cfg.CANAL_REPORTES} no existe o no es de texto`)
        const msg = await canal.send({ components: construirReporte(rep), flags: ["IsComponentsV2"], allowedMentions: SIN_MENCIONES })
        // Para poder redibujarlo si el reporte se resuelve desde el dashboard
        await require("./regalos").guardarMensajeReporte(reporteId, { canal: msg.channelId, mensaje: msg.id })
        return true
    } catch (e) {
        console.error("[Regalos] No se pudo mandar el reporte al canal:", e.message)
        return false
    }
}

/**
 * Redibuja el mensaje del canal con el estado actual del reporte (p. ej. tras
 * resolverlo desde el dashboard: así sus botones dejan de estar activos).
 */
async function actualizarMensajeReporte(client, rep) {
    try {
        if (!rep?.discord?.mensaje) return false
        const canal = await client.channels.fetch(rep.discord.canal)
        const msg = await canal.messages.fetch(rep.discord.mensaje)
        await msg.edit({ components: construirReporte(rep), allowedMentions: SIN_MENCIONES })
        return true
    } catch (e) {
        console.error("[Regalos] No se pudo actualizar el mensaje del reporte:", e.message)
        return false
    }
}

module.exports = { construirReporte, enviarReporte, actualizarMensajeReporte, SIN_MENCIONES, ACCIONES }
