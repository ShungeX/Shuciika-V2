const { Client } = require("discord.js")
const clientdb = require("../../Server")
const { ROLES_PREMIUM, ROL_EX_SUPPORT } = require("../../functions/Premium/premium")
const { iniciarEspera, cancelarEspera } = require("../../functions/Premium/slotApoyo")

const usuarios = clientdb.db("Server_db").collection("usuarios_server")

/**
 * Al empezar o dejar de apoyar el servidor (rol Boost o Support):
 *  - Empieza: guarda la fecha de la primera vez (ticket de Support) y arranca la espera de 14 días del slot
 *    de personaje. El slot NUNCA se da al instante: lo entrega el barrido de functions/Premium/slotApoyo.js.
 *  - Deja de apoyar: si no había cumplido los 14 días, la espera se cancela; recibe el rol permanente
 *    de ex-supporter ("Si apoyaste alguna vez").
 *
 * @param {Client} client
 */
module.exports = async (client, oldMember, newMember) => {
    // Sin caché, oldMember llega sin roles y parecería un apoyo nuevo
    if (oldMember.partial) return

    const tenia = ROLES_PREMIUM.some(id => oldMember.roles.cache.has(id))
    const tiene = ROLES_PREMIUM.some(id => newMember.roles.cache.has(id))
    const userId = newMember.id

    try {
        if (!tenia && tiene) {
            const ahora = Math.floor(Date.now() / 1000)
            // $min conserva la fecha más antigua
            await usuarios.updateOne({ _id: userId }, { $min: { "apoyo.primeraVez": ahora } }, { upsert: true })
                .catch(err => console.warn(`[apoyo] No se pudo guardar primeraVez de ${userId}:`, err?.message || err))
            if (await iniciarEspera(usuarios, userId, ahora)) console.log(`[apoyo] Espera de 14 días del slot iniciada para ${userId}`)
        }

        if (tenia && !tiene) {
            await cancelarEspera(usuarios, userId)
            if (!newMember.roles.cache.has(ROL_EX_SUPPORT)) {
                await newMember.roles.add(ROL_EX_SUPPORT, "Dejó de apoyar el servidor: rol permanente de ex-supporter")
                console.log(`[apoyo] Rol de ex-supporter entregado a ${userId}`)
            }
        }
    } catch (error) {
        console.error(`[apoyo] Error al procesar los beneficios de apoyo de ${userId}:`, error)
    }
}
