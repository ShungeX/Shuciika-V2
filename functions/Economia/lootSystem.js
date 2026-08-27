/**
 * ============================================================================
 * LOOT MANAGER - Sistema de Botín de 4 Capas
 * Capa 1: Categorías (Qué tipo de ítem cae)
 * Capa 2: Calidad/Entropía (Qué tan puro es el ítem basado en la habilidad)
 * Capa 3: Piedad (Soft Pity para evitar mala suerte)
 * Capa 4: Loot Pool (Los bolsillos reales del enemigo)
 * ============================================================================
 */

// ─── CONSTANTES DEL SISTEMA ─────────────────────────────────────────────────

const CATEGORIAS = {
    COMUN: 'material_comun',
    RARO: 'material_raro',
    FUNCIONAL: 'item_funcional',
    NARRATIVO: 'objeto_narrativo'
};

// Se les asigna un 'nivel' numérico para poder compararlas matemáticamente
// al momento de hacer el "downgrade" si el enemigo no soporta esa calidad.
const CALIDAD = {
    FRAGMENTADO: { nivel: 1, nombre: 'Fragmentado' },
    RESONANTE:   { nivel: 2, nombre: 'Resonante' },
    AFINADO:     { nivel: 3, nombre: 'Afinado' },
    ARCANO:      { nivel: 4, nombre: 'Arcano' },
    NIX:         { nivel: 5, nombre: 'Nix' }
};

// ─── BASE DE DATOS SIMULADA (Aquí agregarás tus ítems en el futuro) ───────

const LOOT_POOLS = {
    // Ejemplo de familia/enemigo: "eco_del_caos"
    "eco_del_caos": {
        // CAPA 1: Las probabilidades base de que este enemigo suelte cada categoría
        probabilidades: {
            [CATEGORIAS.COMUN]: 1.00,  // 100% garantizado
            [CATEGORIAS.RARO]: 0.35,   // 35% base
            [CATEGORIAS.FUNCIONAL]: 0.15, // 15% base
            [CATEGORIAS.NARRATIVO]: 0.05  // 5% base
        },
        // CAPA 4: Los ítems reales que tiene en los bolsillos
        items: [
            { id: "esencia_oscura",     categoria: CATEGORIAS.COMUN,     maxCalidad: CALIDAD.AFINADO },
            { id: "cristal_roto",       categoria: CATEGORIAS.RARO,      maxCalidad: CALIDAD.ARCANO },
            { id: "pocion_eco",         categoria: CATEGORIAS.FUNCIONAL, maxCalidad: CALIDAD.RESONANTE },
            { id: "diario_perdido_pag", categoria: CATEGORIAS.NARRATIVO, maxCalidad: CALIDAD.NIX }
        ]
    },
    
    // Ejemplo: Un enemigo débil (Slime)
    "slime_basico": {
        probabilidades: {
            [CATEGORIAS.COMUN]: 1.00,
            [CATEGORIAS.RARO]: 0.10 // Probabilidad bajísima, sin acceso a lo demás
        },
        items: [
            { id: "gelatina_viscosa", categoria: CATEGORIAS.COMUN, maxCalidad: CALIDAD.RESONANTE },
            { id: "nucleo_slime",     categoria: CATEGORIAS.RARO,  maxCalidad: CALIDAD.FRAGMENTADO }
        ]
    }
};

class LootManager {

    // ─── CAPA 3: SISTEMA DE PIEDAD (PITY) ───────────────────────────────────
    
    /**
     * Tira los dados para una categoría aplicando protección contra mala suerte.
     * @private
     */
    _checkDropConPiedad(jugador, categoria, probBase) {
        // Prevenir errores si el jugador es nuevo y no tiene el objeto
        if (!jugador.pity) jugador.pity = {};
        
        const contador = jugador.pity[categoria] || 0;
        
        // Soft Pity: +3% por cada vez que no le salió. Tope en 1.0 (100%)
        const probFinal = Math.min(1.0, probBase + (contador * 0.03));

        if (Math.random() < probFinal) {
            jugador.pity[categoria] = 0; // ¡Ganó! Reiniciar contador
            return true;
        }

        jugador.pity[categoria] = contador + 1; // Falló. Acumular lástima
        return false;
    }

    // ─── CAPA 1: SORTEO DE CATEGORÍAS ───────────────────────────────────────
    
    /**
     * Decide qué "cajas" le cayeron al jugador (ej. cayÓ 1 común y 1 raro)
     * @private
     */
    _rollCategorias(jugador, tablaProbabilidades) {
        const categoriasGanadas = [];
        
        for (const [categoria, probBase] of Object.entries(tablaProbabilidades)) {
            // Si es garantizado, no gastamos el Pity System
            if (probBase >= 1.00) {
                categoriasGanadas.push(categoria);
            } else {
                if (this._checkDropConPiedad(jugador, categoria, probBase)) {
                    categoriasGanadas.push(categoria);
                }
            }
        }
        return categoriasGanadas;
    }

    // ─── CAPA 2: SORTEO DE CALIDAD POR ENTROPÍA ─────────────────────────────
    
    /**
     * Decide qué tan puro es el ítem basado en si hizo spam o jugó bien.
     * @private
     */
    _rollCalidadBase(entropiaNormalizada) {
        const r = Math.random();
        
        // Nivel Experto (Variedad perfecta)
        if (entropiaNormalizada >= 0.85) {
            if (r < 0.40) return CALIDAD.FRAGMENTADO;
            if (r < 0.70) return CALIDAD.RESONANTE;
            if (r < 0.90) return CALIDAD.AFINADO;
            if (r < 0.98) return CALIDAD.ARCANO;
            return CALIDAD.NIX;
        } 
        // Nivel Estándar (Combate normal)
        else if (entropiaNormalizada >= 0.5) {
            if (r < 0.50) return CALIDAD.FRAGMENTADO;
            if (r < 0.85) return CALIDAD.RESONANTE;
            return CALIDAD.AFINADO;
        } 
        // Nivel Monótono (Puro spam)
        else {
            if (r < 0.75) return CALIDAD.FRAGMENTADO;
            return CALIDAD.RESONANTE;
        }
    }

    // ─── ORQUESTADOR FINAL ──────────────────────────────────────────────────
    
    /**
     * Genera la lista final de objetos que el jugador se lleva a casa.
     * @param {String} enemigoId - El identificador del monstruo (ej. "eco_del_caos")
     * @param {Object} jugador - El objeto de base de datos del jugador (para leer/escribir pity)
     * @param {Number} entropia - Valor de entropía del combate (0.0 a 1.0)
     * @returns {Array} Lista de objetos obtenidos
     */
    generarLootFinal(enemigoId, jugador, entropia) {
        const pool = LOOT_POOLS[enemigoId];
        
        // Si el enemigo no tiene loot registrado, regresamos vacío
        if (!pool) return [];

        // 1. ¿Qué categorías ganamos? (Capas 1 y 3)
        const categoriasGanadas = this._rollCategorias(jugador, pool.probabilidades);
        
        // 2. ¿Qué calidad base merecemos por nuestra jugabilidad? (Capa 2)
        const calidadBase = this._rollCalidadBase(entropia);

        const lootObtenido = [];

        // 3. Transformar las categorías en ítems reales (Capa 4)
        for (const cat of categoriasGanadas) {
            
            // Filtramos solo los ítems que sean de esta categoría específica
            const itemsPosibles = pool.items.filter(item => item.categoria === cat);
            
            // Si el enemigo no tiene ítems de esta categoría, la saltamos
            if (itemsPosibles.length === 0) continue;

            // Elegimos un ítem al azar de los posibles
            const itemElegido = itemsPosibles[Math.floor(Math.random() * itemsPosibles.length)];

            // 4. Corrección de Límite (Downgrade)
            // Si el jugador sacó "Nix" pero el ítem máximo llega a "Afinado", se lo bajamos.
            let calidadFinal = calidadBase;
            if (calidadBase.nivel > itemElegido.maxCalidad.nivel) {
                calidadFinal = itemElegido.maxCalidad;
            }

            // Agregamos al carrito
            lootObtenido.push({
                itemId: itemElegido.id,
                categoria: cat,
                calidad: calidadFinal.nombre,
                calidadNivel: calidadFinal.nivel // Útil para colores o iconos en UI
            });
        }

        return lootObtenido;
    }
}

module.exports = new LootManager();