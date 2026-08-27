const { ObjectId } = require("mongodb");

/**
 * Agrega una notificación de rol en el documento del personaje en la colección Personajes.
 * @param {string} userId - ID de Discord del propietario del personaje.
 * @param {string} tipo - 'recompensa_diaria' | 'loot' | 'rango' | 'evento' | 'gm' | 'regalo'
 * @param {string} titulo - Título de la notificación.
 * @param {string} mensaje - Mensaje/Descripción de la notificación.
 * @param {object|null} accion - Acción opcional (ej: { texto: "Reclamar", url: "..." })
 * @param {object} clientdb - Cliente de MongoDB.
 * @param {string} dbname - Nombre de la base de datos (Nix).
 */
async function agregarNotificacionRol(userId, tipo, titulo, mensaje, accion = null, clientdb, dbname) {
    if (!clientdb) {
        console.error("agregarNotificacionRol: clientdb no provisto.");
        return;
    }
    try {
        const db = clientdb.db(dbname);
        const character = await db.collection("Personajes").findOne({ ownerID: userId });
        if (!character) {
            console.log(`agregarNotificacionRol: No se encontró personaje para el usuario ${userId}`);
            return;
        }

        const newNotif = {
            _id: new ObjectId().toString(),
            tipo,
            titulo,
            mensaje,
            leida: false,
            fecha: new Date(),
            accion
        };

        let notificaciones = character.notificaciones || [];
        notificaciones.unshift(newNotif);

        // Limitar a un máximo de 50 notificaciones (FIFO)
        if (notificaciones.length > 50) {
            notificaciones = notificaciones.slice(0, 50);
        }

        await db.collection("Personajes").updateOne(
            { _id: character._id },
            { $set: { notificaciones } }
        );
    } catch (err) {
        console.error("Error en agregarNotificacionRol:", err);
    }
}

module.exports = {
    agregarNotificacionRol
};
