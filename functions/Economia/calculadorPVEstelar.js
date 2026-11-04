/**
 * ============================================================================
 * STARDUST CALCULATOR - Motor de cálculo de Polvo Estelar
 * Basado en el documento "Sistema de Polvo Estelar y Progresión"
 * ============================================================================
 */

// Importamos la conexión a la base de datos
const clientdb = require("../../Server");
const db_rol = clientdb.db("Rol_db");
const eventosDB = db_rol.collection("Eventos");
const sistemaCalor = require("../Economia/sistemaCalor")
const { resplandorANumero } = require("./progresionEstelar")

// ⚙ El perdedor de un combate recibe esta fracción del Polvo/Lumens
const MULT_PERDEDOR = 0.1

// ─── 1. TABLAS DE VALORES BASE ──────────────────────────────────────────────

const POLVO_BASE = {
    combate: {
        duelo: [40, 60, 85, 115, 150, 190, 240],
        grieta: [90, 130, 175, 230, 295, 370, 460],
        heraldo: [250, 350, 470, 610, 770, 950, 1150]
    },
    exploracion: {
        zona_nueva: [30, 42, 56, 72, 90, 110, 132],
        zona_conocida: [10, 14, 18, 23, 29, 36, 44]
    },
    mision: {
        menor: [60, 85, 114, 148, 188, 234, 288],
        mayor: [180, 252, 338, 440, 558, 696, 858]
    }
};

const LUMENS_BASE = {
    combate: {
        duelo: [3, 7, 15, 20, 30, 40, 50],
        grieta: [90, 130, 175, 230, 295, 370, 460],
        heraldo: [250, 350, 470, 610, 770, 950, 1150]
    },
    exploracion: {
        zona_nueva: [30, 42, 56, 72, 90, 110, 132],
        zona_conocida: [10, 14, 18, 23, 29, 36, 44]
    },
    mision: {
        menor: [60, 85, 114, 148, 188, 234, 288],
        mayor: [180, 252, 338, 440, 558, 696, 858]
    }
};

class StardustCalculator {

    // ─── A. CÁLCULO DE ENTROPÍA (VARIEDAD EN COMBATE) ────────────────────────



    _calcularEntropia(historialAcciones, jugador) {
        if (!historialAcciones || historialAcciones.length === 0) return 0;

        const freq = {};
        for (const accion of historialAcciones) {
            freq[accion] = (freq[accion] || 0) + 1;
        }

        const n = historialAcciones.length;
        const H = Object.values(freq).reduce((sum, f) => {
            const p = f / n;
            return sum - p * Math.log2(p);
        }, 0);

        const numKeys = Object.keys(freq).length;
        // Si solo usó 1 habilidad, Math.log2(1) es 0. Prevenimos división entre cero.
        const Hmax = numKeys > 1 ? Math.log2(numKeys) : 0;

        return Hmax > 0 ? H / Hmax : 0;
    }

    _multiplicadorEntropia(entropiaNormalizada) {
        if (entropiaNormalizada < 0.2) return 0.40; // Monotonía (Spam)
        if (entropiaNormalizada > 0.9) return 0.50; // Cacofonía (Caos absoluto)

        // Armonía (Variedad estructurada) - Campana con pico en 0.6
        const centro = 0.6;
        const distancia = Math.abs(entropiaNormalizada - centro);
        return 1.30 - (distancia * 1.20);
    }

    // ─── C. MULTIPLICADORES DE EVENTOS EXTERNOS (MONGODB) ───────────────────

    _evaluarCondicion(evento, jugador) {
        if (!evento.tipoCondicion) return true;

        switch (evento.tipoCondicion) {
            case "jugador_nuevo":
                // Sin fecha de creación conocida no se considera jugador nuevo
                return Number.isFinite(jugador.diasRegistrado)
                    && jugador.diasRegistrado <= (evento.valorCondicion || 7);

            case "rango_resplandor":
                return resplandorANumero(jugador.resplandor) <= (evento.valorCondicion || 7);

            default:
                return true;
        }
    }

    async _obtenerMultiplicadorEventos(tipo, subtipo, jugador) {
        try {
            const actividadClave = `${tipo}_${subtipo}`;
            const ahora = new Date();

            // Un solo round-trip a Mongo para todo
            const [eventosActivos, bonusesJugador] = await Promise.all([
                eventosDB.find({ activo: true }).toArray(),
                // STUB: cuando diseñes bonuses por jugador, aquí va la query real
                // Ejemplo futuro: bonusesDB.find({ jugadorId: jugador._id, expira: { $gt: ahora } }).toArray()
                Promise.resolve(jugador.bonuses || [])
            ]);

            let multPolvo = 1.0;
            let multLumens = 1.0;

            // --- Eventos globales ---
            for (const evento of eventosActivos) {
                const aplica = evento.aplica || [];
                if (!aplica.includes(actividadClave) && !aplica.includes(subtipo)) continue;
                if (!this._evaluarCondicion(evento, jugador)) continue;

                // Retrocompatible: si no tiene multiplicadores separados, usa el campo viejo
                const mults = evento.multiplicadores ?? {
                    polvo: evento.multiplicador ?? 1.0,
                    lumens: evento.multiplicador ?? 1.0
                };

                multPolvo *= mults.polvo ?? 1.0;
                multLumens *= mults.lumens ?? 1.0;
            }

            // --- Bonuses individuales del jugador (stub listo para cuando los diseñes) ---
            for (const bonus of bonusesJugador) {
                if (bonus.expira && new Date(bonus.expira) < ahora) continue;

                // bonus.tipo: "polvo" | "lumens" | "ambos"
                if (bonus.tipo === "polvo" || bonus.tipo === "ambos") multPolvo *= bonus.multiplicador ?? 1.0;
                if (bonus.tipo === "lumens" || bonus.tipo === "ambos") multLumens *= bonus.multiplicador ?? 1.0;
            }

            return { polvo: multPolvo, lumens: multLumens };

        } catch (e) {
            console.error("[StardustCalculator] Error al obtener multiplicadores de DB:", e);
            return { polvo: 1.0, lumens: 1.0 }; // fallback seguro
        }
    }

    // ─── ORQUESTADOR PRINCIPAL ──────────────────────────────────────────────

    /**
     * Normaliza tipo/subtipo a las claves de las tablas base.
     * "pve"/"npc"/"duelo" → combate. Subtipos de combate: duelo | grieta | heraldo.
     */
    _normalizarActividad(tipo, subtipo) {
        const t = String(tipo || "combate").toLowerCase();
        const st = String(subtipo || "").toLowerCase();
        const tipoKey = ["npc", "pve", "pvp", "duelo"].includes(t) ? "combate" : (POLVO_BASE[t] ? t : "combate");
        const subtipoKey = POLVO_BASE[tipoKey][st] ? st : Object.keys(POLVO_BASE[tipoKey])[0];
        return { tipoKey, subtipoKey };
    }

    /**
     * Calcula el Polvo Estelar y los Lumens que recibe el jugador.
     * @param {String} tipo - "combate" | "exploracion" | "mision" (acepta "pve"/"pvp" como combate)
     * @param {String} subtipo - combate: "duelo" | "grieta" | "heraldo"; exploracion: "zona_nueva" | "zona_conocida"; mision: "menor" | "mayor"
     * @param {Object} jugador - { resplandor: 'I'..'VII' | 1..7, calor: Number (0-300), diasRegistrado?: Number, bonuses?: [] }
     * @param {Object} contexto - combate: { historialAcciones: [], esGanador: Boolean }
     * @param {Object} calcular - { polvo, lumens } qué valores devolver
     * @returns {Promise<{polvo?: Number, lumens?: Number}>}
     */
    async calcularRecompensas(tipo, subtipo, jugador = {}, contexto = {}, calcular = { polvo: true, lumens: true }) {
        const resplandor = resplandorANumero(jugador?.resplandor);
        const { tipoKey, subtipoKey } = this._normalizarActividad(tipo, subtipo);

        const basePolvo = POLVO_BASE[tipoKey][subtipoKey][resplandor - 1];
        const baseLumens = LUMENS_BASE[tipoKey]?.[subtipoKey]?.[resplandor - 1] ?? basePolvo;

        const multE = this._multiplicadorContexto(tipoKey, contexto);
        const multC = sistemaCalor.multiplicadorCalor(Number(jugador?.calor) || 0);
        const multEv = (calcular.polvo || calcular.lumens)
            ? await this._obtenerMultiplicadorEventos(tipoKey, subtipoKey, jugador)
            : { polvo: 1.0, lumens: 1.0 };

        const resultado = {};
        if (calcular.polvo) resultado.polvo = Math.max(1, Math.floor(basePolvo * multE * multC * multEv.polvo));
        if (calcular.lumens) resultado.lumens = Math.max(1, Math.floor(baseLumens * multE * multC * multEv.lumens));

        return resultado;
    }

    _multiplicadorContexto(tipo, contexto) {
        const t = String(tipo || "").toLowerCase();
        if (t === "combate") {
            const entropia = this._calcularEntropia(contexto.historialAcciones || []);
            const multEnt = this._multiplicadorEntropia(entropia);
            const multVict = contexto.esGanador ? 1.0 : MULT_PERDEDOR;
            return multEnt * multVict;
        }
        switch (t) {
            case "exploracion":
                return 1.0;
            case "mision":
                return 1.0;
            default:
                return 1.0;
        }
    }
}

const calculador = new StardustCalculator();
calculador.POLVO_BASE = POLVO_BASE;
calculador.LUMENS_BASE = LUMENS_BASE;
calculador.MULT_PERDEDOR = MULT_PERDEDOR;
module.exports = calculador;