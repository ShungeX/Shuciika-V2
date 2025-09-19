const transactionCache = new Map();
const transactionUser = new Map();

module.exports = {
    cache: transactionCache,
    userCache: transactionUser,
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
    deleteUser: (id) => transactionUser.delete(id)
}