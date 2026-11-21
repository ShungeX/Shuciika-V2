const { Client, EmbedBuilder, GuildMember } = require('discord.js')
const entorno = require("../../config/entorno")
const { enviarDespedida, marcarInactivos, borrarFichaEnCache, embedPersonajesInactivos } = require("../../functions/Miembros/salidas")

const CANAL_LOGS = "716518718947065868"
const CANAL_STAFF = "803723665107451904"

/**
 * Despedida V2 (máx. 4 por minuto) + personajes marcados como inactivos. Solo se borra la ficha en caché.
 * @param {Client} client
 * @param {GuildMember} member
 * @param {{ simulado?: boolean }} [opciones] Lo pasa /utilidad simular_evento: no toca la base de datos
 */
module.exports = async (client, member, opciones = {}) => {
    // Las salidas reales solo las atiende la versión final (en Navi saldrían duplicadas)
    if (!opciones.simulado && !entorno.esProduccion) return
    if (member.user?.bot) return

    if (!opciones.simulado) {
        try {
            const personajes = await marcarInactivos(member.id)
            if (personajes.length) {
                client.channels.cache.get(CANAL_LOGS)?.send({ embeds: [embedPersonajesInactivos(member, personajes)] }).catch(() => { })
            }

            const ficha = await borrarFichaEnCache(member.id)
            if (ficha) {
                const embed = new EmbedBuilder()
                    .setTitle("Se ha borrado una ficha")
                    .setDescription(`Se borró la ficha en proceso de <@${member.id}> porque salió del servidor.`)
                    .setColor("Red")
                client.channels.cache.get(CANAL_STAFF)?.send({ embeds: [embed] }).catch(() => { })
            }
        } catch (e) {
            console.error("[despedida] Error al procesar la salida:", e)
            const errorembed = new EmbedBuilder()
                .setTitle("Ha ocurrido un error / Revisa la consola")
                .setDescription("```" + e + "```")
                .setColor("Random")
            client.channels.cache.get(CANAL_LOGS)?.send({ embeds: [errorembed] }).catch(() => { })
        }
    }

    await enviarDespedida(client, member).catch(e => console.error("[despedida] Error al enviar la despedida:", e))
}
