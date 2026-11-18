const { Client } = require('discord.js')
const { ROL_BOOST } = require('../../functions/Premium/premium')
const { anunciarBoost, retirarBoost } = require('../../functions/Premium/boost')

/**
 * Boost nuevo → carta por MD + anuncio con botón "Agradecer · N".
 * Boost retirado → se borran sus anuncios.
 * La lógica vive en functions/Premium/boost.js.
 *
 * @param {Client} client
 */
module.exports = async (client, oldMember, newMember) => {
    // Si el miembro no estaba en caché, oldMember llega vacío (sin roles) y parecería un boost nuevo
    if (oldMember.partial) return

    // Solo el rol Boost dispara el agradecimiento; Support da los mismos beneficios pero no es un boost
    const oldStatus = oldMember.roles.cache.has(ROL_BOOST)
    const newStatus = newMember.roles.cache.has(ROL_BOOST)

    try {
        if (!oldStatus && newStatus) await anunciarBoost(client, newMember)
        if (oldStatus && !newStatus) await retirarBoost(client, newMember.id)
    } catch (error) {
        console.error(`[boost] Error al procesar el boost de ${newMember.id}:`, error)
    }
}
