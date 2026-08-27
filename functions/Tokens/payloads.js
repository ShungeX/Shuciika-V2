const Payloads = {
    
    /**
     * Plantilla estricta para Acciones de Duelo.
     * @param {string} duelId - ID del duelo
     * @param {string} authorId - ID del jugador que actúa
     * @param {string} accion - ID de la habilidad usada [Ataque, Cancelar, Aceptar...S]
     * @param {string} skillId - ID de la habilidad usada
     * @param {string|number} targetId - ID del objetivo, "all" o "random"
     * @param {object} [extras={}] - Datos opcionales (flexibilidad)
     */
    duelToken: (duelId, authorId, accion, skillId, targetId, extras = {}) => {
        if (!duelId) throw new Error("Payload Error: Falta duelId");
        if (!authorId) throw new Error("Payload Error: Falta authorId");
        if (!accion) throw new Error("Payload Error: Falta accion");
        return {
            context: 'DUEL',    // Para saber qué handler lo recibe
            accion: accion,   // Acción por defecto
            d_id: duelId,       // Usamos nombres cortos para ahorrar RAM si quieres
            a_id: authorId,
            s_id: skillId,
            t_id: targetId,
            ...extras           // Aquí metes cualquier cosa rara extra si hace falta
        };
    },

    /**
     * Plantilla para Tienda (Ejemplo de escalabilidad)
     */
    shopPurchase: (userId, itemId, price) => {
        return {
            context: 'SHOP',
            action: 'buy',
            u_id: userId,
            i_id: itemId,
            cost: price
        };
    }
};

module.exports = Payloads;