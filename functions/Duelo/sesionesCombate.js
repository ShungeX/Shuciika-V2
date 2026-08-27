const EventEmitter = require('events')

class sesionesCombate extends EventEmitter{
    constructor({ sessionId, type, teams, apuestas = null, tipoApuesta = null, modeTest = false }) {

        console.log("=== Nueva sesión de combate ===")
        console.log("sessionId:", sessionId)
        console.log("type:", type)
        console.log("teams:", teams)
        console.log("apuestas:", apuestas)
        console.log("tipoApuesta:", tipoApuesta)
        console.log("modeTest:", modeTest)
        super();

        this.sessionId = sessionId      // channelId donde ocurre
        this.type = type                // "pvp" | "pve" | "ranked"
        this.modeTest = modeTest
        this.state = "PENDING"          // PENDIENTE | INICIANDO | ACTIVO | FINALIZADO
        this.teams = teams              // [[Personaje, Personaje], [NPC, NPC]]
        this.apuestas = apuestas            // apuestas si las hay
        this.tipoApuesta = tipoApuesta      // tipo de apuesta ('espejo', 'equivalente', etc.)
        this.ronda = 1
        this.compasMax = 1000
        this.decayFactor = 0.57
        this.pendingEffects = []        // efectos acumulados en la ronda actual
        this.compas = this;
        this.log = []
        this.winner = null
        this.startedAt = Date.now()
        this.mensajes = {
            espectador: { channelId: "1345239393786527784", messageId: null },
            jugadores: new Map()
        }
        this.actuaronEsteSubturno = new Set()
        this.turnoQueue = []

        // ── Watchdog de turno y Control AFK (en memoria por sesión) ────────
        this.afkCounters = new Map()       // characterID (String) -> turnos saltados consecutivos
        this.afkStates = new Map()         // characterID (String) -> boolean afk
        this.afkThreshold = 5              // Umbral de turnos saltados para marcar AFK (5 turnos)
        this.turnTimeoutMs = 40000         // Tiempo límite de respuesta por turno (40 segundos)
        this.watchdogTimer = null          // Referencia al temporizador de watchdog en memoria
        this.activeTurnActorId = null      // ID del combatiente cuyo turno está corriendo bajo supervisión

        this._initCompas()
        this._initMensajes()
        this.calcularPrimerTurno()

    }

    // ── Métodos del Sistema AFK individual por combatiente ───────────────────

    obtenerTurnosSaltados(characterID) {
        return this.afkCounters.get(String(characterID)) || 0;
    }

    incrementarTurnosSaltados(characterID) {
        const key = String(characterID);
        const actual = this.obtenerTurnosSaltados(key) + 1;
        this.afkCounters.set(key, actual);
        return actual;
    }

    resetearTurnosSaltados(characterID) {
        this.afkCounters.set(String(characterID), 0);
    }

    esAFK(characterID) {
        const key = String(characterID);
        const c = this.getCombatiente(key);
        if (c && c.afk === true) return true;
        return this.afkStates.get(key) === true;
    }

    marcarAFK(characterID) {
        const key = String(characterID);
        this.afkStates.set(key, true);
        const c = this.getCombatiente(key);
        if (c) c.afk = true;
    }

    /**
     * Verifica si TODOS los combatientes activos de ambos lados están en estado AFK
     * (o acumulando inactividad consecutiva).
     */
    todosCombatientesAFK() {
        const activos = this.getAllCombatientes().filter(c => !c.defeated);
        if (activos.length === 0) return false;
        
        // Al menos un combatiente debe haber alcanzado el umbral AFK
        const algunoMarcadoAFK = activos.some(c => this.esAFK(c.ID) || this.obtenerTurnosSaltados(c.ID) >= this.afkThreshold);
        if (!algunoMarcadoAFK) return false;

        // Y todos los demás combatientes activos deben tener inactividad consecutiva (turnos saltados > 0 o afk)
        return activos.every(c => this.esAFK(c.ID) || this.obtenerTurnosSaltados(c.ID) > 0);
    }

    // ── Métodos del Watchdog de Turnos (Supervisión independiente en carrera) ─

    limpiarWatchdog() {
        if (this.watchdogTimer) {
            clearTimeout(this.watchdogTimer);
            this.watchdogTimer = null;
        }
        this.activeTurnActorId = null;
    }

    /**
     * Notifica que el combatiente actual resolvió su turno normalmente.
     * Cancela el temporizador de watchdog activo y reinicia su contador de inactividad a 0.
     */
    resolverTurnoExitoso(characterID) {
        if (!characterID) return;
        const key = String(characterID);
        this.resetearTurnosSaltados(key);
        if (String(this.activeTurnActorId) === key) {
            this.limpiarWatchdog();
        }
    }

    /**
     * Inicia la supervisión independiente (watchdog) para el turno del combatiente activo.
     * Corre en "carrera" contra la resolución del turno (40s max).
     */
    iniciarWatchdogTurno(client) {
        this.limpiarWatchdog();

        if (this.state === "FINALIZADO") return;

        const actor = this.getCurrentActor();
        if (!actor || actor.defeated) return;

        this.activeTurnActorId = actor.ID;

        // Si el combatiente ya fue marcado como AFK, omitir su turno automáticamente de inmediato
        if (this.esAFK(actor.ID)) {
            console.log(`[Watchdog AFK] Combatiente ${actor.Nombre} (ID: ${actor.ID}) está AFK. Omitiendo turno de inmediato.`);
            this.procesarTimeoutTurno(actor, client);
            return;
        }

        // Si el combatiente es un NPC, su turno es resuelto por la IA sin watchdog de tiempo
        if (actor.isNPC) return;

        // Programar el temporizador watchdog de 40 segundos para el jugador humano
        this.watchdogTimer = setTimeout(async () => {
            console.log(`[Watchdog Timeout] El combatiente ${actor.Nombre} (ID: ${actor.ID}) agotó sus 40s de turno.`);
            await this.procesarTimeoutTurno(actor, client);
        }, this.turnTimeoutMs);
    }

    /**
     * Procesa la expiración o salto de turno por inactividad de un combatiente.
     */
    async procesarTimeoutTurno(actor, client) {
        if (this.state === "FINALIZADO") return;

        const actorId = actor.ID;
        const turnosSaltados = this.incrementarTurnosSaltados(actorId);

        this.addLog("turno_timeout", {
            personaje: actor.Nombre,
            turnosSaltados,
            textoLog: `${actor.Nombre} no respondió a tiempo (40s). Turnos omitidos consecutivos: ${turnosSaltados}/${this.afkThreshold}.`
        });

        // Al alcanzar el umbral (5), marcar afk: true
        if (turnosSaltados >= this.afkThreshold && !this.esAFK(actorId)) {
            this.marcarAFK(actorId);
            this.addLog("afk", {
                personaje: actor.Nombre,
                textoLog: `¡${actor.Nombre} ha acumulado ${this.afkThreshold} turnos sin actuar y fue marcado como AFK!`
            });
        }

        // Caso especial: ¿Todos los combatientes activos de la sesión (ambos lados) quedaron AFK?
        if (this.todosCombatientesAFK()) {
            console.log(`[Watchdog AFK] Todos los participantes de la sesión ${this.sessionId} están AFK. Cancelando duelo.`);
            this.addLog("afk_total", {
                textoLog: "Los jugadores se durmieron mientras peleaban. El combate ha finalizado."
            });
            this.checkGameOver();
            return;
        }

        // Avanzar el turno del combatiente inactivo
        this.actuaronEsteSubturno.add(actorId);
        if (actor.bolitaPos !== undefined) actor.bolitaPos = actor.valorCompas;

        // Verificar si la inactividad causó la eliminación del equipo por AFK
        const check = this.checkGameOver();
        if (check.gameOver) return;

        // Avanzar compás y cola de turnos correctamente
        const TurnProcessor = require("./turnProcessor");
        await TurnProcessor.advanceCompas(this, null);
    }

    // Calcula el valorCompas inicial de cada combatiente
    _initCompas() {
        this.getAllCombatientes().forEach(c => {
            c.valorCompas = Math.floor(1000 / c.effectiveTempo)
            c.bolitaPos = c.valorCompas
        })
    }

    // Devuelve todos los combatientes de ambos equipos en un solo array
    getAllCombatientes() {
        return this.teams.flat()
    }

    calcularPrimerTurno() {
        const activos = this.getAllCombatientes().filter(c => !c.defeated && c.valorCompas <= this.compasMax)
        console.log("=== calcularPrimerTurno ===")
        console.log("Activos:", activos.map(c => `${c.Nombre} bolitaPos=${c.bolitaPos} valorCompas=${c.valorCompas}`))

        const salto = Math.min(...activos.map(c => c.bolitaPos))
        console.log("Salto:", salto)
        activos.forEach(c => c.bolitaPos -= salto)

        let primeros = activos.filter(c => c.bolitaPos === 0)
        console.log("Primeros en 0:", primeros.map(c => c.Nombre))

        if (primeros.length > 1) {
            primeros = primeros
                .map(c => ({ c, roll: Math.random() }))
                .sort((a, b) => b.roll - a.roll)
                .map(({ c }) => c)
        }

        this.turnoQueue = primeros
        console.log("turnoQueue resultante:", this.turnoQueue.map(c => c.Nombre))
    }

    // El que actúa ahora: menor valorCompas que siga activo, no esté derrotado y no haya actuado en este subturno
    getCurrentActor() {
        if (this.turnoQueue.length > 0) {
            const nextInQueue = this.turnoQueue.find(c => !c.defeated && !this.actuaronEsteSubturno.has(c.ID))
            if (nextInQueue) return nextInQueue
        }
        return this.getAllCombatientes()
            .filter(c => !c.defeated && !this.actuaronEsteSubturno.has(c.ID))
            .sort((a, b) => a.bolitaPos - b.bolitaPos)[0] ?? null
    }

    _initMensajes() {
        this.getAllCombatientes().forEach(c => {
            if (c.ownerId) {
                this.mensajes.jugadores.set(String(c.ownerId), { channelId: null, messageId: null })
            }
        })
    }

    // ¿Quedan bolitas activas en esta ronda?
    hayBolitasActivas() {
        return this.getAllCombatientes().some(c => !c.defeated && c.valorCompas <= this.compasMax)
    }

    // Avanza el compás tras cada sub-turno
    avanzarCompas() {
        this.compasMax = Math.floor(this.compasMax * this.decayFactor)
    }

    // Busca un combatiente por su ID
    getCombatiente(characterID) {
        return this.getAllCombatientes().find(c => String(c.ID) === String(characterID)) ?? null
    }

    // ¿Algún equipo fue eliminado completamente? (por derrota o AFK)
    combateTerminado() {
        if (this.todosCombatientesAFK()) return true;
        return this.teams.some(equipo => equipo.every(c => c.defeated || this.esAFK(c.ID)))
    }

    checkGameOver() {
        const condicion = this._evaluarCondicionVictoria()
        if (!condicion.terminado) return { gameOver: false }

        this.state = "FINALIZADO";
        this.limpiarWatchdog();

        const ganadores = condicion.winner ? condicion.winner.map(c => c.Nombre).join(", ") : "Empate"
        const losser = condicion.perdedor ? condicion.perdedor.map(c => c.Nombre).join(", ") : "Empate"

        this.emit('combateFinalizado', {
            sessionId: this.sessionId,
            winners: ganadores,
            arrayWinner: condicion.winner || [],
            lossers: losser,
            arrayLosser: condicion.perdedor || [],
            typeWin: condicion.typeWin,
        })
        return { gameOver: true, winners: ganadores, arrayWinner: condicion.winner }
    }

    _evaluarCondicionVictoria() {
        // Caso especial 1: Si TODOS los combatientes activos de ambos lados están AFK o acumulando inactividad
        if (this.todosCombatientesAFK()) {
            return {
                terminado: true,
                winner: null,
                perdedor: null,
                typeWin: "afk"
            };
        }

        const equipoFuera = (equipo) => equipo.every(c => c.defeated || this.esAFK(c.ID));
        const equipoTieneJugadorActivo = (equipo) => equipo.some(c => !c.defeated && !this.esAFK(c.ID) && (c.isNPC || this.obtenerTurnosSaltados(c.ID) === 0));

        switch (this.type) {
            case "pvp":
            case "pve":
            default: {
                const perdedor = this.teams.find(equipoFuera);
                if (!perdedor) return { terminado: false };

                const ganador = this.teams.find(equipo => equipoTieneJugadorActivo(equipo));
                if (!ganador) {
                    // Si el bando opuesto tampoco tiene ningún jugador activamente jugando (todos acumulan inactividad), resolver como AFK neutral
                    return {
                        terminado: true,
                        winner: null,
                        perdedor: null,
                        typeWin: "afk"
                    };
                }

                const fueRendicion = perdedor.some(c => c.surrender);
                const typeWin = fueRendicion ? "surrender" : "hp0";

                return { terminado: true, winner: ganador, perdedor: perdedor, typeWin };
            }
        }
    }

    cerrarRonda() {
        this.addLog("ronda_fin", {
            textoLog: `La ronda ${this.ronda} ha finalizado.`
        });
        this.ronda++
        this.compasMax = 1000



        // Aplicar los efectos pendientes a los combatientes antes de vaciar la lista
        const pending = this.pendingEffects || [];
        const turnProcessor = require("./turnProcessor");

        pending.forEach(eff => {
            const target = this.getCombatiente(eff.objetivo);
            const caster = this.getCombatiente(eff.fuente);
            if (target && !target.defeated) {
                if (eff.id.endsWith("_damage")) {
                    // Daño demorado (de hechizo con cast > 1)
                    turnProcessor._aplicarDaño({ base: eff.base }, caster, target, { Elemento: "Neutro" }, this);
                } else if (eff.id.endsWith("_healing")) {
                    // Curación demorada (de hechizos)
                    turnProcessor._aplicarCuracion({ base: eff.base }, caster, target, { Elemento: "Neutro" });
                } else {
                    // Efectos de estado persistentes
                    target.statusEffect ??= [];
                    const existente = target.statusEffect.find(e => e.id === eff.id || e.Nombre === eff.nombre || e.nombre === eff.nombre);
                    if (existente) {
                        existente.duracion = Math.max(existente.duracion, eff.duracion);
                    } else {
                        target.statusEffect.push({
                            id: eff.id,
                            Nombre: eff.nombre,
                            nombre: eff.nombre,
                            base: eff.base,
                            duracion: eff.duracion,
                            fuente: eff.fuente
                        });
                    }
                }
            }
        });

        this.pendingEffects = []
        this.actuaronEsteSubturno.clear()
        this.getAllCombatientes().forEach(c => {
            if (!c.defeated) {
                c.valorCompas = Math.min(1000, Math.floor(1000 / c.effectiveTempo))
                c.bolitaPos = c.valorCompas
                if (c.valorCompas > this.compasMax) {
                    this.actuaronEsteSubturno.add(c.ID)
                }
            }
        })
    }

    // Agrega una línea al log del combate
    /**
     * 
     * @param {String} tipo - tipo de evento: "ataque", "defensa" "spell", "objeto", "efecto", etc.
     * @param {Object} data - datos relevantes del evento, como { actorId, targetId, damage, spellId, itemId, effectId, etc. }
     * @returns {void}
     */
    addLog(tipo, data) {
        this.log.push({
            tipo,
            ronda: this.ronda,
            data,
            timestamp: Date.now()
        })
    }
}

module.exports = sesionesCombate 