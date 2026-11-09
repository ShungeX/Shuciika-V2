// ─── Desbloqueo de hechizos (IX) ─────────────────────────────────────────────
// "Resplandor como puerta, una acción como llave". La puerta (Req.resplandor_min) se comprueba
// al lanzar; aquí se resuelve la llave: un evento / diálogo `{dar_hechizo:ID}`, un Tratado o un
// regalo de moderación. Un hechizo aprendido se queda para siempre.

const cacheHechizos = require("./cache")

/**
 * Enseña un hechizo a un personaje (Soul.dominio.hechizos). Idempotente.
 * @param {number|string} personajeId - _id del personaje activo (= _id del alma)
 * @param {string} hechizoId
 * @returns {Promise<{ ok: boolean, motivo?: string, hechizo?: Object, yaLoConocia?: boolean }>}
 */
async function darHechizo(personajeId, hechizoId) {
    const hechizo = await cacheHechizos.obtener(hechizoId)
    if (!hechizo) return { ok: false, motivo: "hechizo_inexistente" }
    if (hechizo.Adquisicion?.via === "luna") return { ok: false, motivo: "reservado" }   // hechizos de Quietud: no implementar aún

    const souls = require("../../../Server").db("Rol_db").collection("Soul")
    const id = Number(personajeId)
    const r = await souls.updateOne(
        { _id: id, "dominio.hechizos.ID": { $ne: hechizo._id } },
        { $push: { "dominio.hechizos": { ID: hechizo._id, InCombat: true, usos: 0, maestria: 1 } } }
    )
    if (r.modifiedCount === 1) return { ok: true, hechizo }
    const existe = await souls.countDocuments({ _id: id }, { limit: 1 })
    return existe ? { ok: true, hechizo, yaLoConocia: true } : { ok: false, motivo: "sin_alma" }
}

module.exports = { darHechizo }
