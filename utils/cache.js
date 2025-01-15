const transactionCache = new Map();

module.exports = {
    cache: transactionCache,
    set: (id, data) => {
        transactionCache.set(id, data);
        setTimeout(() => transactionCache.delete(id), 60 * 1000)
    },
    get: (id) => transactionCache.get(id),
    delete: (id) => transactionCache.delete(id)
}