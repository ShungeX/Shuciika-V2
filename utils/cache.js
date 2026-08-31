const transactionCache = new Map();
const transactionUser = new Map();
const playerStatus = new Map();

// Carga perezosa para evitar dependencia circular con Server.js
let personajes = null;
function getPersonajesCollection() {
    if (!personajes) {
        const clientdb = require("../Server.js");
        const db = clientdb.db("Rol_db");
        personajes = db.collection("Personajes");
    }
    return personajes;
}


module.exports = {
    cache: transactionCache,
    userCache: transactionUser,
    playerStatus: playerStatus,

    set: (id, data, onExpire = null) => {
        transactionCache.set(id, data);
        setTimeout(() => {
            transactionCache.delete(id);
            onExpire?.();
        },  3 * 60 * 60 * 1000)
    },
    get: (id) => transactionCache.get(id),
    delete: (id) => transactionCache.delete(id),
    setUser: (userId, uuid) => {
        transactionUser.set(userId, uuid);
        setTimeout(() => transactionUser.delete(userId),  60 * 60 * 3 * 1000)
    },
    getUser: (id) => transactionUser.get(id),
    deleteUser: (id) => transactionUser.delete(id),

    /**
     * 
     * @param {ID} characterId - ID del personaje 
     * @param {object} status - Estructura: {Nombre, {datos extras}}
     * @param {object} expired - Estructura: {time, active}
     * @returns 
     */
    setStatus: async (characterId, status, expired) => {
        if (!characterId) return;
        const numId = !isNaN(Number(characterId)) ? Number(characterId) : null;
        const strId = String(characterId);

        if (!status) {
            playerStatus.delete(characterId);
            playerStatus.delete(strId);
            if (numId !== null) playerStatus.delete(numId);
            return;
        } else {
            const entry = { status: status, expired: expired?.active };
            playerStatus.set(characterId, entry);
            playerStatus.set(strId, entry);
            if (numId !== null) playerStatus.set(numId, entry);

            if (expired?.active) {
                const timeMs = (typeof expired.time === 'number' ? expired.time : 3000) * 1000;
                setTimeout(() => {
                    playerStatus.delete(characterId);
                    playerStatus.delete(strId);
                    if (numId !== null) playerStatus.delete(numId);
                }, timeMs);
            } else {
                const personajesColl = getPersonajesCollection();
                await personajesColl.updateOne({ _id: numId !== null ? numId : characterId }, {
                    $set: {
                        "status": status
                    }
                }).catch(() => null);
            }
        }
    },
    getStatus: (characterId) => {
        if (!characterId) return null;
        const numId = !isNaN(Number(characterId)) ? Number(characterId) : null;
        const strId = String(characterId);
        return playerStatus.get(characterId) ?? playerStatus.get(strId) ?? (numId !== null ? playerStatus.get(numId) : null);
    },
    deleteStatus: async (characterId, Notexpired) => {
        if (!characterId) return;
        const numId = !isNaN(Number(characterId)) ? Number(characterId) : null;
        const strId = String(characterId);

        playerStatus.delete(characterId);
        playerStatus.delete(strId);
        if (numId !== null) playerStatus.delete(numId);

        if (Notexpired) {
            const personajesColl = getPersonajesCollection();
            await personajesColl.updateOne({ _id: numId !== null ? numId : characterId }, {
                $set: {
                    "status": null
                }   
            }).catch(() => null);
        }
    }


}