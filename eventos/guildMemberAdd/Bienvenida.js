const { Client, GuildMember } = require("discord.js")
const { enviarBienvenidaCanal, enviarCartaMD } = require("../../functions/Miembros/bienvenida")
const { reactivarPersonajes } = require("../../functions/Miembros/salidas")

/**
 * Bienvenida V2 en el canal + carta por MD. Si vuelve alguien que ya tenía personajes, se les quita el flag Inactivo.
 * @param {Client} client
 * @param {GuildMember} member
 * @param {{ simulado?: boolean }} [opciones] Lo pasa /utilidad simular_evento: no toca la base de datos
 */
module.exports = async (client, member, opciones = {}) => {
  if (member.user.bot) return

  if (!opciones.simulado) {
    await reactivarPersonajes(member.id).catch(e => console.error("[bienvenida] No se pudieron reactivar los personajes:", e))
  }

  await enviarBienvenidaCanal(client, member).catch(e => console.error("[bienvenida] Error al enviar la bienvenida:", e))

  // En una simulación la carta se envía sin registrarla, para no gastar el reenvío del botón
  await enviarCartaMD(member.user, member.guild.name, opciones.simulado ? "simulacion" : "entrada")
}
