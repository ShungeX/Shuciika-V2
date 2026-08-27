const tokens = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of tokens.entries()) {
        if (now > value.expiresAt) {
            tokens.delete(key);
        }
    }
}, 30 * 60 * 1000);


module.exports = {
    /**
     * Crea un token con prefijo.
     * @param {string} prefix - El contexto (ej: "DUEL", "SHOP")
     * @param {object} data - Los datos a guardar
     * @param {number} timeSeconds - Duración en minutos (default 3m)
     * @param {Boolean} doubleCode - Enviar codigo de cancelacion y aceptación con dos codigos distintos
     */
    create: (prefix, data, timeSeconds = 30, doubleCode = false) => {
        const code = Math.random().toString(36).substring(7);
        
        // El ID completo que irá al botón (ej: "DUEL-x9as2")
        const fullId = `${prefix}_${code}`;

        tokens.set(fullId, {
            data: data,
            expiresAt: Date.now() + (timeSeconds * 60 * 1000)
        });

        return fullId;
    },

    /**
     * Consume un token (lo lee y lo borra para que no se use 2 veces)
     * @param {string} fullId - El ID completo del botón
     */
    consume: (fullId) => {
        const token = tokens.get(fullId);

        if (!token) return null;
        if (Date.now() > token.expiresAt) {
            tokens.delete(fullId);
            return null;
        }
        tokens.delete(fullId);
        return token.data;
    },

    peek: (fullId) => {
        const token = tokens.get(fullId);
        if (!token || Date.now() > token.expiresAt) return null;
        return token.data;
    }
};