// ─── Diálogos en combate ─────────────────────────────────────────────────────
// Las voces (El Anfitrión, la narradora, los cambios de fase) no van al log de "Últimas acciones":
// llegan como mensajes aparte, en un embed, igual que el sistema de diálogos. Se mandan EFÍMEROS
// (followUp sobre la última interacción del jugador) para no saturarle el MD; si no hay una
// interacción reciente, se manda al MD y se borra solo.
//
// Cada sesión tiene su cola: los diálogos salen en orden y con una pausa antes de cada uno, para
// que un cambio de fase no suelte todas las frases de golpe.

const { EmbedBuilder } = require("discord.js")

const DIALOGO = Object.freeze({
    PAUSA_MS: 1800,                   // ⚙ antes de cada diálogo
    PAUSA_CAMBIO_MS: 3000,            // ⚙ antes del primero de un cambio de fase (suspenso)
    VIDA_INTERACCION_MS: 14 * 60_000, // los tokens de interacción duran 15 min
    BORRAR_MD_MS: 120_000,            // ⚙ respaldo por MD: se borra a los 2 min
    COLOR: 0x8ee5f5,
})

/** Última interacción de componente de cada usuario (con ella se manda el efímero). */
const ultimas = new Map()

function registrarInteraccion(interaction) {
    const userId = interaction?.user?.id
    if (!userId) return
    ultimas.set(String(userId), { interaction, en: Date.now() })
}

function interaccionVigente(userId) {
    const r = ultimas.get(String(userId))
    if (!r || Date.now() - r.en > DIALOGO.VIDA_INTERACCION_MS) return null
    const i = r.interaction
    return i?.deferred || i?.replied ? i : null
}

const esperar = (ms) => new Promise(r => { const t = setTimeout(r, ms); t.unref?.() })

function embedDe({ autor, avatarURL, texto, color }) {
    const e = new EmbedBuilder().setDescription(String(texto).slice(0, 4000)).setColor(color ?? DIALOGO.COLOR)
    if (autor) e.setAuthor({ name: String(autor).slice(0, 256) })
    if (avatarURL) e.setThumbnail(avatarURL)   // la foto de quien habla, grande, no como icono de autor
    return e
}

async function enviarA(client, userId, embed, canalId) {
    const i = interaccionVigente(userId)
    // Solo una interacción del propio MD de combate: nunca un efímero en otro canal
    const delCombate = i && (!canalId || String(i.channelId) === String(canalId))
    if (delCombate) {
        try { await i.followUp({ embeds: [embed], flags: ["Ephemeral"] }); return "efimero" } catch { /* sigue al MD */ }
    }
    try {
        const user = await client?.users?.fetch?.(userId)
        const m = await user?.send({ embeds: [embed], flags: ["SuppressNotifications"] })
        if (m) setTimeout(() => m.delete().catch(() => { }), DIALOGO.BORRAR_MD_MS).unref?.()
        return m ? "md" : null
    } catch (e) {
        console.error(`[DiálogoCombate] No se pudo entregar a ${userId}:`, e.message)
        return null
    }
}

/**
 * Encola un diálogo de combate.
 * @param {Object} sesion
 * @param {{ autor?: string, avatarURL?: string, texto: string, destinatarios?: string[], cambio?: boolean, color?: number }} d
 *   destinatarios: ownerIds (por defecto, todos los jugadores de la sesión) · cambio: pausa larga
 * @returns {Promise<void>} se resuelve cuando se entregó (las pruebas pueden esperarla)
 */
function decir(sesion, d) {
    if (!sesion || !d?.texto) return Promise.resolve()
    const jugadores = sesion.getAllCombatientes?.().filter(c => !c.isNPC && c.ownerId && !String(c.ownerId).startsWith("NPC_")) || []
    const destinatarios = (d.destinatarios?.length ? d.destinatarios : jugadores.map(c => c.ownerId)).map(String)
    sesion.dialogos ??= []
    sesion.dialogos.push({ ...d, destinatarios, en: Date.now() })   // registro (pruebas / depuración)

    const previa = sesion._colaDialogos || Promise.resolve()
    sesion._colaDialogos = previa.then(async () => {
        if (sesion.state === "FINALIZADO" && !d.final) return
        await esperar(d.cambio ? DIALOGO.PAUSA_CAMBIO_MS : DIALOGO.PAUSA_MS)
        let client = null
        try { client = require("../../bot") } catch { /* entorno de pruebas */ }
        const embed = embedDe(d)
        await Promise.all(destinatarios.map(u => enviarA(client, u, embed, sesion.mensajes?.jugadores?.get(u)?.channelId)))
    }).catch(e => console.error("[DiálogoCombate] Error en la cola:", e.message))
    return sesion._colaDialogos
}

module.exports = { DIALOGO, registrarInteraccion, decir, interaccionVigente }
