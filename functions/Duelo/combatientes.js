// ─── Escalado de poder y normalización de datos del alma ─────────────────────
// Los jugadores no tienen nivel: su poder sale de los Fragmentos Estelares totales
// (peso bajo, escala logarítmica) y del Resplandor (multiplicador fuerte de daño).
// Los NPCs sí usan nivel (campo `nivel`).
const { resplandorANumero } = require("../Economia/progresionEstelar")
const { cargarEfectos } = require("./efectosPersistentes")
const { normalizarElemento } = require("./hechizos/elementos")
const { tieneInmunidad, efectosActivos } = require("./hechizos/estados")
const { modificadores, absorberConEscudo, alRecibirDanio } = require("./hechizos/efectos")
const { mapaMaestrias } = require("./hechizos/maestria")

const ESCALADO = {
    BONUS_DANIO_RESPLANDOR_POR_RANGO: 0.12, // ⚙ I = ×1.00, II = ×1.12 ... VII = ×1.72
}

/**
 * Nivel de combate interno del jugador a partir de sus FE totales (escala logarítmica,
 * crece poco). Solo se usa en las fórmulas de daño/defensa; no se muestra ni se guarda.
 * 0 FE → 1 | 20 FE → ~5.4 | 100 FE → ~7.7 | 480 FE → ~9.9
 */
function calcularNivelJugador(fe) {
    return Math.round((1 + Math.log2(Math.max(0, Number(fe) || 0) + 1)) * 100) / 100
}

/** Multiplicador de daño saliente por Resplandor (I..VII). */
function multiplicadorResplandor(resplandor) {
    return 1 + (resplandorANumero(resplandor) - 1) * ESCALADO.BONUS_DANIO_RESPLANDOR_POR_RANGO
}

/** Nivel de un NPC: `nivel`; los NPCs sin nivel usan su FE mínima como referencia. */
function nivelNPC(data = {}) {
    return Number(data.nivel ?? data.restrictions?.fe_min) || 1
}

/**
 * Etiqueta de poder para la UI. Jugador: "FE: 120 [III]" (FE totales + Resplandor).
 * NPC: "Lv: 12". Acepta combatientes ya construidos o documentos crudos de BD.
 */
function etiquetaPoder(c = {}, prefijoNPC = "Lv") {
    const esNPC = !!(c.isNPC || (typeof c._id === "string" && c._id.startsWith("NPC-")))
    if (esNPC) return `${prefijoNPC}: ${c.nivel ?? nivelNPC(c)}`
    const sendero = c.sendero || {}
    const fe = Number(c.StelarFragmentsTotal ?? sendero.StelarFragmentsTotal ?? sendero.StelarFragments ?? 0) || 0
    const resplandor = c.resplandor ?? sendero.resplandor ?? "I"
    return `FE: ${fe} [${resplandor}]`
}

/**
 * Copia las stats y rellena los nombres que el combate usa a partir de los campos
 * de las almas nuevas (sintoniaElemental, percepcion) o de los antiguos (resistenciaFisica...).
 */
function normalizarStats(stats = {}) {
    const s = { ...stats }
    s.resFisica = s.resFisica ?? s.resistenciaFisica ?? 1
    s.resMagica = s.resMagica ?? s.resistenciaMagica ?? 1
    s.sintoniaElemental = s.sintoniaElemental ?? s.sintonia ?? 1
    s.sintonia = s.sintonia ?? s.sintoniaElemental
    s.poderElemental = s.poderElemental ?? s.sintoniaElemental
    s.percepcion = s.percepcion ?? 1
    s.precision = s.precision ?? (100 + (s.percepcion - 1) * 2)
    return s
}

/** Contenedor elemental equipado (desafinados). PENDIENTE: los objetos contenedor aún no existen en el catálogo. */
function esContenedor(item) {
    if (!item) return false
    const t = item.tipo ?? item.Type ?? item.type ?? item.Tipo
    const lista = Array.isArray(t) ? t : [t]
    return item.contenedor === true || lista.some(x => String(x).toLowerCase() === "contenedor")
}

/** Reconoce un arma equipada sin importar el formato ({Type: 1}, {Type: "arma"}, {tipo: "arma"}, {Tipo: ["Arma"]}) */
function esArma(item) {
    if (!item) return false
    const t = item.tipo ?? item.Type ?? item.type ?? item.Tipo
    if (Array.isArray(t)) return t.some(x => String(x).toLowerCase() === "arma")
    return t === 1 || String(t).toLowerCase() === "arma"
}

const idEfecto = (eff) => String(eff.id || eff.Nombre || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

class Combatiente {
    constructor(id, data = {}) {
        this.ID = id
        this.ownerId = data.ownerId;
        this.Nombre = data.perfil?.Nombre || "Aventurero";
        this.HP = data.nucleo?.HP ?? 100;
        this.Mana = data.nucleo?.Mana ?? 50;
        this.stats = normalizarStats(data.stats || {});
        this.stats.hpMax = this.stats.hpMax ?? this.HP;
        this.stats.manaMax = this.stats.manaMax ?? this.Mana;
        this.avatarURL = data.perfil?.avatarURL || "";
        this.statusEffect = [];
        this.defenseActual = 0; // guardia antigua (NPCs con defensa inline); la de "Defenderse" es el estado Guardia

        const dominio = data.dominio || {}
        this.hechizos = dominio.hechizos || [];
        this.equipamiento = dominio.equipo || [];

        this.tempo = this.stats.agilidad || 10; // Agilidad del usuario
        this.compas = 0; // Barra de acción
        this.isAct = true;
        this.defeated = false;
        this.surrender = false;
        this.isTurn = false;

        // Arma normalizada: por ahora no aporta efecto; se conserva para cuando tenga datos de combate
        this.arma = (this.equipamiento || []).find(esArma) || null;
        this.ataquePredeterminado = this.arma?.skillId || "default_001";
    }

    /** Nivel usado por el escalado de daño y defensa (lo define cada subclase) */
    get nivelCombate() {
        return 1;
    }

    /** Multiplicador sobre el daño que inflige (los NPCs no tienen Resplandor) */
    get multiplicadorDanio() {
        return 1;
    }

    /**
     * Aplica daño respetando Estasis (inmune), escudos, Tregua (piso de 1 HP) y los estados que
     * se rompen al recibir daño (Congelado). Todas las fuentes de daño pasan por aquí.
     * @param {number} cantidad
     * @param {{ castId?: string }} [origen] - el daño del mismo cast no rompe su propio Congelado
     * @returns {number} daño que llegó a la vida
     */
    aplicarDaño(cantidad, origen = {}) {
        cantidad = Math.max(0, Number(cantidad) || 0);
        if (tieneInmunidad(this, "todo")) return 0;
        cantidad = absorberConEscudo(this, cantidad);
        this.ultimoDanioRecibido = cantidad;
        this.vidaAntesDelGolpe = this.HP;
        let hp = Math.max(0, this.HP - cantidad);
        if (hp < 1 && this.HP >= 1 && tieneInmunidad(this, "muerte")) hp = 1;   // Tregua
        this.HP = hp;
        if (this.fueDerrotado()) this.defeated = true;
        if (cantidad > 0) alRecibirDanio(this, origen);
        return this.vidaAntesDelGolpe - this.HP;
    }

    aplicarCuracion(cantidad, esAccionInstantanea = false) {
        if (this.defeated && !esAccionInstantanea) return;
        if (tieneInmunidad(this, "todo")) return;   // Estasis: tampoco recibe curas
        const hpMax = this.stats?.hpMax ?? 99999;
        this.HP = Math.min(hpMax, this.HP + cantidad);
        if (this.HP > 0 && !this.surrender) {
            this.defeated = false;
            this._alreadyLoggedDefeat = false;
        }
    }

    fueDerrotado() {
        if (this.surrender) return true;
        return this.HP <= 0;
    }

    get effectiveTempo() {
        const baseCompas = Math.floor(1000 / (1 + (this.tempo * 0.08)));

        let modVelocidad = 0;
        for (const a of efectosActivos(this)) {
            const eff = a.efecto;
            if (a.lentitud) { modVelocidad -= 50; continue; }
            if (eff.tipo) continue;   // los efectos nuevos (buff/debuff) se leen con modificadores()
            const id = idEfecto(eff);
            if (id === 'hasted' || id === 'acelerado') {
                modVelocidad += 50;
            } else if (id === 'speed' || id === 'velocidad') {
                modVelocidad += Number(eff.base || 0);
            } else if (id === 'furia' && eff.base?.velocidad !== undefined) {
                modVelocidad += Number(eff.base.velocidad);
            }
        }
        modVelocidad += modificadores(this).velocidad * 100;

        const compasEfectivo = Math.max(1, Math.floor(baseCompas * (1 - modVelocidad / 100)));
        return 1000 / compasEfectivo;
    }

    get effectiveAgilidad() {
        const baseAgilidad = this.stats?.agilidad || 0;
        let modAgilidad = 0;
        for (const eff of (this.statusEffect || [])) {
            if (idEfecto(eff) === 'furia' && eff.base?.agilidad !== undefined) {
                modAgilidad += Number(eff.base.agilidad);
            }
        }
        modAgilidad += modificadores(this).esquive * 100;
        return Math.max(0, baseAgilidad * (1 + modAgilidad / 100));
    }

    /** Modificador de precisión en % (Furia, Cegado, debuffs de precisión). */
    get effectivePrecision() {
        let modPrecision = 0;
        for (const eff of (this.statusEffect || [])) {
            if (idEfecto(eff) === 'furia' && eff.base?.precision !== undefined) {
                modPrecision += Number(eff.base.precision);
            }
        }
        return modPrecision + modificadores(this).precision * 100;
    }

    /** No puede esquivar (Raíz del Mundo: esquive a 0). */
    get sinEsquive() {
        return modificadores(this).esquiveCero;
    }
}

class Personaje extends Combatiente {
    constructor(id, data = {}) {
        super(id, data);
        const sendero = data.sendero || data.Sendero || {};
        const fragmentos = data.fragmentos || data.Fragmentos || {};
        this.resonancia = sendero.resonancia || 0;
        this.disonancia = sendero.disonancia || 0;
        this.resplandor = sendero.resplandor ?? data.resplandor ?? 'I';
        // Las almas antiguas solo tienen StelarFragments; se usa como total si falta
        this.StelarFragmentsTotal = Number(
            sendero.StelarFragmentsTotal
            ?? fragmentos.StelarFragmentsTotal
            ?? data.StelarFragmentsTotal
            ?? sendero.StelarFragments
            ?? 0
        );
        this.StelarFragments = Number(
            sendero.StelarFragments
            ?? fragmentos.StelarFragments
            ?? this.StelarFragmentsTotal
        );

        const nucleo = data.nucleo || {};
        this.elemento = normalizarElemento(nucleo.Elemento);
        this.Elemento = this.elemento;

        // Efectos que el personaje arrastra de combates anteriores (Soul.nucleo.efectos)
        cargarEfectos(this, nucleo.efectos);

        // Maestría por hechizo (dominio.hechizos[i].usos / .maestria)
        this.maestrias = mapaMaestrias(this.hechizos);

        // Contenedor equipado (desafinados): fija el elemento con el que puede lanzar
        this.contenedor = (this.equipamiento || []).find(esContenedor) || null;
    }

    get nivelCombate() {
        return calcularNivelJugador(this.StelarFragmentsTotal);
    }

    get multiplicadorDanio() {
        return multiplicadorResplandor(this.resplandor);
    }

    /** Afinado: resonancia ≥ disonancia. */
    get afinado() {
        return (Number(this.resonancia) || 0) >= (Number(this.disonancia) || 0);
    }

    /**
     * Elemento lanzable (III.E): un afinado lanza su elemento; un desafinado, el del contenedor
     * equipado (si no lleva ninguno con elemento, el suyo).
     * PENDIENTE: si cambiar de contenedor en combate consume un turno (propuesta: sí).
     */
    get elementoActivo() {
        if (this.afinado || !this.contenedor) return this.elemento;
        const el = this.contenedor.Elemento ?? this.contenedor.elemento;
        return el ? normalizarElemento(el) : this.elemento;
    }
}

class NPC extends Combatiente {
    constructor(id, data) {
        super(id, {
            ownerId: "NPC_" + id,
            perfil: { Nombre: data.Nombre, avatarURL: data.avatarURL },
            nucleo: { HP: data.HP, Mana: data.Mana },
            stats: data.stats || {},
            dominio: { hechizos: [], equipo: [] }
        });
        this.isNPC = true;
        this.nivel = nivelNPC(data);
        this.tipoNPC = data.Type || "Enemigo";
        this.elemento = normalizarElemento(data.Elemento);
        this.Elemento = this.elemento;
        this.ataques = data.ataques || [];
        this.loot = data.loot || [];
        this.restrictions = data.restrictions || {};
        this.boss = data.boss || null;
        // Subtipo de recompensa: heraldo > jefe (grieta) > duelo
        this.esHeraldo = data.heraldo === true || String(this.tipoNPC).toLowerCase() === "heraldo";
        this.esJefe = this.esHeraldo || !!this.boss || String(this.tipoNPC).toLowerCase() === "boss";
        this.comportamiento = data.comportamiento || [];
        // Humano: vías normales, como un jugador (puede tener maestría). Resto: solo instinto (VI.B)
        this.esHumano = String(data.tipo ?? data.naturaleza ?? "").toLowerCase() === "humano";
        this.maestrias = mapaMaestrias(data.maestrias || {});
        this.permiteAtaqueBasico = data.permiteAtaqueBasico !== false;
        this.permiteDefensaBasica = data.permiteDefensaBasica !== false;
        this.fase = 1;
        this.fasesCompletadas = [];
        this.damageDealt = 0;
        this.reputacion = 0;
        this.ataquePredeterminado = "default_001";

        if (this.stats) {
            this.stats.resFisica = this.stats.resFisica ?? this.stats.resistenciaFisica ?? 5;
            this.stats.resMagica = this.stats.resMagica ?? this.stats.resistenciaMagica ?? 5;
            this.stats.hpMax = this.stats.hpMax ?? data.HP ?? 100;
            this.stats.manaMax = this.stats.manaMax ?? data.Mana ?? 50;
            this.stats.fuerza = this.stats.fuerza ?? 5;
            this.stats.agilidad = this.stats.agilidad ?? 5;
            this.stats.sabiduria = this.stats.sabiduria ?? 5;
            this.stats.inteligencia = this.stats.inteligencia ?? 5;
            this.stats.sintonia = this.stats.sintonia ?? 1;
            this.stats.precision = this.stats.precision ?? 100;
        }
    }

    get nivelCombate() {
        return this.nivel;
    }
}

module.exports = {
    Personaje,
    NPC,
    ESCALADO,
    calcularNivelJugador,
    multiplicadorResplandor,
    nivelNPC,
    etiquetaPoder,
    resplandorANumero,
    normalizarElemento,
    normalizarStats,
    esArma,
    esContenedor
}
