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
        if (!status) {
            return playerStatus.delete(characterId)
        } else {
            playerStatus.set(characterId, { status: status, expired: expired?.active })
            if (expired?.active) {
                setTimeout(() => playerStatus.delete(characterId), 60 * 60 * expired.time)
            } else {
                const personajesColl = getPersonajesCollection();
                await personajesColl.updateOne({ _id: characterId }, {
                    $set: {
                        "status": status
                    }
                })
            }
        }

    },
    getStatus: (characterId) => playerStatus.get(characterId),
    deleteStatus: async (characterId, Notexpired) => {
        playerStatus.delete(characterId)
        if(Notexpired) {
            const personajesColl = getPersonajesCollection();
            await personajesColl.updateOne({_id: characterId}, {
                $set: {
                    "status": null
                }   
            })
        }
    }


}