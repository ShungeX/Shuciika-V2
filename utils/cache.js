const transactionCache = new Map();
const transactionUser = new Map();
const playerStatus = new Map();
const clientdb = require("../Server")
const db = clientdb.db("Rol_db")
const personajes = db.collection("Personajes")


module.exports = {
    cache: transactionCache,
    userCache: transactionUser,
    playerStatus: playerStatus,

    set: (id, data) => {
        transactionCache.set(id, data);
        setTimeout(() => transactionCache.delete(id), 60 * 60 * 3000)
    },
    get: (id) => transactionCache.get(id),
    delete: (id) => transactionCache.delete(id),
    setUser: (userId, uuid) => {
        transactionUser.set(userId, uuid);
        setTimeout(() => transactionUser.delete(userId), 60 * 60 * 3000)
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
                await personajes.updateOne({ _id: characterId }, {
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
            await personajes.updateOne({_id: characterId}, {
                $set: {
                    "status": null
                }   
            })
        }
    }


}