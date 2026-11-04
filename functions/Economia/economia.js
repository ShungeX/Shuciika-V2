const clientdb = require("../../Server")
const db_rol = clientdb.db("Rol_db")
const personajes = db_rol.collection("Personajes")
const { moverLumens } = require("./lumens")

class Economy {

    // ─── Lumens ───────────────────────────────────────────────────────────────

    /**
     * Agrega o resta lumens a un personaje (pasa por el libro de Lumens)
     * @param {Number} characterId - _id del Personaje
     * @param {Number} cantidad - positivo = agregar, negativo = restar
     * @param {String} motivo - ver MOTIVOS en lumens.js
     * @param {Object} [opciones] - { ref, opId, tipo }
     */
    async ajustarLumens(characterId, cantidad, motivo = "admin", opciones = {}) {
        try {
            const r = await moverLumens({ personajeId: characterId, delta: cantidad, motivo, ...opciones })
            return { success: r.ok, ...r }
        } catch (e) {
            console.error("Economy.ajustarLumens error:", e)
            return { success: false }
        }
    }

    // ─── Combates ─────────────────────────────────────────────────────────────

    /**
     * Registra el resultado de un combate en los trackers
     * @param {Number} characterId
     * @param {Boolean} gano
     */
    async registrarCombate(characterId, gano) {
        try {
            const inc = { "estado.progresoAcumulativo.combatesJugados": 1 }
            if (gano) inc["estado.progresoAcumulativo.combatesGanados"] = 1

            await personajes.updateOne({ _id: characterId }, { $inc: inc })
            return { success: true }
        } catch (e) {
            console.error("Economy.registrarCombate error:", e)
            return { success: false }
        }
    }
}

module.exports = new Economy()