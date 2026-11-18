// functions/Premium/slotApoyo.js
// Slot de personaje gratis por apoyar el servidor (rol Boost o Support): UNA sola vez por persona y
// nunca al instante. Se entrega cuando cumple 14 días seguidos apoyando.
//
// Datos en usuarios_server.apoyo:
//   slotEsperaDesde  segundos UNIX desde que empezó la espera (se borra si deja de apoyar antes de los 14 días)
//   slotEntregado    true cuando ya se sumó el slot (nunca se vuelve a dar)
//   slotPendiente    true si cumplió los 14 días sin tener personajes: lo suma el registro de su primera ficha
//
// Sin require de Server.js: quien llama pasa la colección (y así se puede probar sin Mongo).

const premium = require("./premium")

const DIAS_ESPERA_SLOT = 14
const SEGUNDOS_ESPERA = DIAS_ESPERA_SLOT * 86400
const BARRIDO_CADA_MS = 60 * 60 * 1000

const ahoraSeg = () => Math.floor(Date.now() / 1000)
// Solo quien nunca ha recibido el slot ni lo tiene apartado
const SIN_SLOT = { "apoyo.slotEntregado": { $ne: true }, "apoyo.slotPendiente": { $ne: true } }

/** Empieza (o conserva) la espera de 14 días al recibir el rol Boost o Support. */
async function iniciarEspera(coleccion, userId, ahora = ahoraSeg()) {
    const r = await coleccion.updateOne(
        { _id: userId, ...SIN_SLOT, "apoyo.slotEsperaDesde": { $exists: false } },
        { $set: { "apoyo.slotEsperaDesde": ahora } }
    )
    if (r.matchedCount) return true
    // Documento nuevo: solo si no existe (si existe y no coincidió, ya espera o ya tiene su slot)
    const existe = await coleccion.findOne({ _id: userId }, { projection: { _id: 1 } })
    if (existe) return false
    await coleccion.updateOne({ _id: userId }, { $set: { "apoyo.slotEsperaDesde": ahora } }, { upsert: true })
        .catch(err => { if (err?.code !== 11000) throw err })
    return true
}

/** Dejó de apoyar antes de cumplir los 14 días: la espera se reinicia la próxima vez que apoye. */
async function cancelarEspera(coleccion, userId) {
    await coleccion.updateOne({ _id: userId, ...SIN_SLOT }, { $unset: { "apoyo.slotEsperaDesde": "" } })
}

/**
 * Entrega el slot a quienes ya cumplieron 14 días y siguen apoyando. Cada entrega es atómica
 * (el filtro exige que aún no se haya entregado), así que correrlo dos veces no da dos slots.
 * @returns {Promise<{ entregados: string[], apartados: string[], cancelados: string[] }>}
 */
async function entregarSlotsVencidos(client, coleccion, ahora = ahoraSeg()) {
    const resultado = { entregados: [], apartados: [], cancelados: [] }
    const vencidos = await coleccion.find(
        { ...SIN_SLOT, "apoyo.slotEsperaDesde": { $lte: ahora - SEGUNDOS_ESPERA } },
        { projection: { _id: 1, "apoyo.slotEsperaDesde": 1, "nix.slotsPersonajes": 1 } }
    ).toArray()

    for (const doc of vencidos) {
        const id = String(doc._id)
        const espera = doc.apoyo.slotEsperaDesde
        const filtro = { _id: doc._id, ...SIN_SLOT, "apoyo.slotEsperaDesde": espera }

        const member = await premium.obtenerMiembro(client, id)
        if (!premium.esPremiumMiembro(member)) {
            // Sin cliente o sin poder ver al miembro no se decide nada: se reintenta en el siguiente barrido
            if (!client?.guilds?.cache?.get(premium.GUILD_ID)) continue
            await coleccion.updateOne(filtro, { $unset: { "apoyo.slotEsperaDesde": "" } })
            resultado.cancelados.push(id)
            continue
        }

        if (doc.nix?.slotsPersonajes?.total !== undefined) {
            const r = await coleccion.updateOne(
                { ...filtro, "nix.slotsPersonajes.total": { $exists: true } },
                { $inc: { "nix.slotsPersonajes.total": 1 }, $set: { "apoyo.slotEntregado": true, "apoyo.slotEntregadoEn": ahora }, $unset: { "apoyo.slotEsperaDesde": "" } }
            )
            if (r.modifiedCount) resultado.entregados.push(id)
        } else {
            const r = await coleccion.updateOne(filtro, { $set: { "apoyo.slotPendiente": true }, $unset: { "apoyo.slotEsperaDesde": "" } })
            if (r.modifiedCount) resultado.apartados.push(id)
        }
    }
    return resultado
}

/** Barrido al arrancar y cada hora. */
function iniciarBarridoSlots(client, coleccion) {
    const correr = () => entregarSlotsVencidos(client, coleccion)
        .then(({ entregados, apartados, cancelados }) => {
            if (entregados.length || apartados.length || cancelados.length) {
                console.log(`[apoyo] Slots: ${entregados.length} entregados, ${apartados.length} apartados para su primera ficha, ${cancelados.length} esperas canceladas`)
            }
        })
        .catch(err => console.error("[apoyo] Error en el barrido de slots:", err))
    correr()
    return setInterval(correr, BARRIDO_CADA_MS)
}

module.exports = { DIAS_ESPERA_SLOT, iniciarEspera, cancelarEspera, entregarSlotsVencidos, iniciarBarridoSlots }
