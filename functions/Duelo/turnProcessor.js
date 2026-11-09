const clientdb = require("../../Server")
const db2 = clientdb.db("Rol_db")
const dbobjetos = db2.collection("Objetos_globales")
const characters = db2.collection("Personajes")
const updateInventario = require("../updateInventario")
const { buildActionMessage } = require("../../utils/utilidadesTexto")
const InterfazCreate = require("./combateUI")
const { normalizarElemento, Personaje } = require("./combatientes")
const { leerProgreso } = require("../Economia/progresionEstelar")
const { esFormatoNuevo, aplicarEfectoObjeto, cumpleCondicion, esInmune, revertirModStat } = require("./efectosObjeto")

// ─── Sistema de hechizos (vías, control, Estasis, maestría) ──────────────────
const { CADENA, OFRENDA, GUARDIA, UNIVERSALES_INICIALES } = require("./hechizos/config")
const { normalizarHechizo } = require("./hechizos/adaptador")
const { evaluarCasteo, puedeActuar, ACCIONES, usaInstinto } = require("./hechizos/casteo")
const { efectosActivos, viasBloqueadas, quienBloquea, tieneInmunidad } = require("./hechizos/estados")
const {
    aplicarEfecto, agregarEstado, interrumpirCast, modificadores, filtrarProvocados,
    procesarFinDeTurno, esPvE, logSistema,
} = require("./hechizos/efectos")
const { registrarUso } = require("./hechizos/maestria")
const cacheHechizos = require("./hechizos/cache")

const PRECISION_MINIMA_BASE = 10;
const TECHO_ESQUIVE = 0.85;
const PISO_ESQUIVE = 0.05;

// ─── Balance de daño (ajustable) ─────────────────────────────────────────────
// La defensa es una REDUCCIÓN PORCENTUAL: puntos / (puntos + K). Así nadie queda inmune
// (como mínimo entra el 25% del golpe) y las stats altas no se disparan.
const BALANCE = {
    ATAQUE_BASE_MIN: 4,            // daño base aleatorio del ataque básico (4-9)
    ATAQUE_BASE_RANGO: 6,
    ATAQUE_NIVEL_PLANO: 1.0,       // + nivel × 1.0 de daño plano
    ATAQUE_NIVEL_ESCALA: 0.05,     // fuerza × (1 + nivel × 0.05)
    DEF_FISICA_RES: 1.0,           // puntos de defensa física = resFisica × 1.0 + nivel × 0.5
    DEF_FISICA_NIVEL: 0.5,
    DEF_MAGICA_RES: 1.0,           // puntos de defensa mágica = resMagica × 1.0 + nivel × 0.3
    DEF_MAGICA_NIVEL: 0.3,
    DEF_K: 30,                     // con 30 puntos se reduce el 50%
    DEF_TECHO: 0.75,               // reducción máxima por stats
    GUARDIA_POR_PUNTO: 0.04,       // guardia antigua (defensa inline de NPCs): +4% por punto, se consume con el primer golpe
    REDUCCION_TECHO_TOTAL: 0.85,   // stats + guardia + buffs nunca bloquean más del 85% (la Guardia universal se aplica aparte)
    CRITICO_TECHO: 0.40,           // probabilidad máxima de crítico
    CRITICO_MULTI: 1.5,
};

function reduccionPorDefensa(puntos) {
    const p = Math.max(0, Number(puntos) || 0);
    return Math.min(BALANCE.DEF_TECHO, p / (p + BALANCE.DEF_K));
}

function normalizarObjetivo(objetivo) {
    if (!objetivo) return "enemigos";

    const toNativeNum = (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'object') {
            if (typeof v.toNumber === 'function') return v.toNumber();
            if (v.value !== undefined) return Number(v.value);
        }
        const num = Number(v);
        return isNaN(num) ? null : num;
    };

    if (Array.isArray(objetivo)) {
        const values = objetivo.map(toNativeNum).filter(v => v !== null);
        if (values.includes(4)) return "global";
        if (values.includes(1) || values.includes(5)) return "enemigos";
        if (values.includes(2) || values.includes(6)) return "aliados";
        if (values.includes(3)) return "mismo";
        return "enemigos";
    }

    const singleVal = toNativeNum(objetivo);
    if (singleVal !== null) {
        switch (singleVal) {
            case 1: return "enemigos";
            case 2: return "aliados";
            case 3: return "mismo";
            case 4: return "global";
            case 5: return "todos";
            case 6: return "todos";
        }
    }

    if (typeof objetivo === 'string') return objetivo.toLowerCase();
    return "enemigos";
}


const TABLA_ELEMENTAL = {
    "Pyrós": { fuerteContra: ["Rakau", "Kryo", "Wind"], debilContra: ["Aqua", "Lapis"] },
    Aqua: { fuerteContra: ["Pyrós", "Lapis"], debilContra: ["Electro", "Rakau", "Kryo"] },
    Lapis: { fuerteContra: ["Electro", "Kryo"], debilContra: ["Aqua", "Wind", "Electro"] },
    Rakau: { fuerteContra: ["Aqua", "Lapis"], debilContra: ["Pyrós", "Kryo", "Electro"] },
    Electro: { fuerteContra: ["Aqua", "Rakau"], debilContra: ["Lapis", "Wind"] },
    Kryo: { fuerteContra: ["Pyrós", "Lapis"], debilContra: ["Pyrós", "Lapis"] }, // relación especial
    Wind: { fuerteContra: [], debilContra: ["Kryo", "Pyrós"] },
    Lux: { fuerteContra: [], debilContra: [] },
    Neutro: { fuerteContra: [], debilContra: [] }
}

const BONUS_ELEMENTAL = 1.35
const PENALTY_ELEMENTAL = 0.70

let contadorCast = 0
const nuevoCastId = (caster) => `${caster?.ID ?? "x"}:${Date.now().toString(36)}:${(++contadorCast).toString(36)}`

class TurnProcessor {

    // ─── Utilidades ──────────────────────────────────────────────────────────

    /**
     * Calcula el multiplicador elemental entre atacante y defensor
     * Respeta el caso especial Kryo-Pyrós-Lapis
     */
    _getMultiplicadorElemental(elementoAtacante, elementoDefensor) {
        // Nombres canónicos ("Pyró" → "Pyrós", "Ninguno"/null → "Neutro")
        elementoAtacante = normalizarElemento(elementoAtacante)
        elementoDefensor = normalizarElemento(elementoDefensor)

        // Triángulo especial — se maneja en CombatUI, aquí es neutro
        const esTriangulo =
            (elementoAtacante === "Kryo" && (elementoDefensor === "Pyrós" || elementoDefensor === "Lapis")) ||
            (elementoAtacante === "Pyrós" && elementoDefensor === "Kryo") ||
            (elementoAtacante === "Lapis" && elementoDefensor === "Kryo")

        if (esTriangulo) return { multi: 1, tipo: "triangulo" }

        const tabla = TABLA_ELEMENTAL[elementoAtacante] || TABLA_ELEMENTAL["Neutro"]

        if (tabla.fuerteContra.includes(elementoDefensor)) return { multi: BONUS_ELEMENTAL, tipo: "ventaja" }
        if (tabla.debilContra.includes(elementoDefensor)) return { multi: PENALTY_ELEMENTAL, tipo: "desventaja" }

        return { multi: 1, tipo: "neutro" }
    }

    /**
     * Calcula el valor de un efecto con scaling de stats
     */
    _calculateAmount(mecanica, caster, multiplicador = 1) {
        if (mecanica.base !== undefined && Number(mecanica.base) === 0 && !mecanica.scaling) return 0;
        let amount = Number(mecanica.base) || 0

        if (mecanica.scaling) {
            const statVal = caster?.stats?.[mecanica.scaling.stats] || 0
            amount += (statVal * (Number(mecanica.scaling.multi) || 0)) * multiplicador
        }
        return Math.max(0, Math.floor(amount))
    }

    /**
     * Genera el ataque básico (Golpe) según el nivel del atacante
     */
    _generarAtaqueBasico(atacante) {
        // El arma (atacante.arma) aún no aporta datos de combate: todos usan el ataque básico
        const lvl = Number(atacante.nivelCombate) || 1;
        const baseAleatoria = BALANCE.ATAQUE_BASE_MIN + Math.floor(Math.random() * BALANCE.ATAQUE_BASE_RANGO)
            + Math.round(lvl * BALANCE.ATAQUE_NIVEL_PLANO);

        return {
            _id: "basic_attack",
            Nombre: "Ataque básico",
            Elemento: atacante.elemento || atacante.Elemento || "Neutro",
            isActive: true,
            Costos: { mana: 0, Vida: 0, Cooldown: 0 },
            Mecanicas: {
                damage: {
                    base: baseAleatoria,
                    scaling: {
                        stats: "fuerza",
                        multi: 1 + (lvl * BALANCE.ATAQUE_NIVEL_ESCALA)
                    },
                    objetivo: "enemigos",
                    alcance: "single",
                    esFisico: true
                },
                Efectos: [],
                cast: { vias: ["movimiento"], tiempo: 0, probabilidad: 1, interruptible: false } // Golpe nunca falla
            }
        }
    }

    // ─── Costos ──────────────────────────────────────────────────────────────

    /**
     * Cobra el costo del hechizo (ya calculado por evaluarCasteo: modo mental, maestría...)
     */
    _cobrarCosto(hechizo, caster, evaluacion = null) {
        const mana = evaluacion?.costoMana ?? Number(hechizo.Costos?.mana ?? 0)
        const vida = evaluacion?.costoVida ?? Number(hechizo.Costos?.Vida ?? 0)
        caster.Mana -= mana
        caster.HP -= vida

        if (hechizo.Costos?.Cooldown > 0) {
            caster.cooldowns ??= {}
            caster.cooldowns[hechizo._id] = hechizo.Costos.Cooldown
        }
    }

    /** Costo en Lumens (ofrenda, p. ej. Lux-003). Pasa por el libro de Lumens. */
    async _cobrarOfrenda(session, caster, hechizo, evaluacion) {
        const costo = Number(evaluacion?.costoDinero) || 0
        if (!costo || caster.isNPC) return { ok: true }
        if (OFRENDA.SOLO_PVE && !esPvE(session)) {
            return { ok: false, message: "La ofrenda de este hechizo solo puede hacerse en combates contra NPCs." }
        }
        const { moverLumens } = require("../Economia/lumens")
        const r = await moverLumens({
            personajeId: Number(caster.ID),
            userId: caster.ownerId,
            delta: -costo,
            motivo: OFRENDA.MOTIVO_LEDGER,
            ref: { hechizo: hechizo._id, sesion: session?.sessionId ?? null, ronda: session?.ronda ?? null },
        })
        if (!r.ok) {
            return { ok: false, message: r.motivo === "saldo_insuficiente" ? `No tienes Lumens suficientes para la ofrenda (${costo}).` : "No se pudo cobrar la ofrenda." }
        }
        return { ok: true }
    }

    // ─── Resolución de objetivos ──────────────────────────────────────────────

    _bandos(session, caster) {
        const esEquipo1 = session.teams[0].some(c => c.ID === caster.ID)
        return {
            aliados: esEquipo1 ? session.teams[0] : session.teams[1],
            enemigos: esEquipo1 ? session.teams[1] : session.teams[0],
        }
    }

    /**
     * Resuelve los objetivos del ataque básico: el enemigo elegido (o el primero vivo).
     * Si algún enemigo usa Provocar, el golpe va a él.
     */
    _resolverObjetivoAtaque(caster, targetId, battleState) {
        const vivos = battleState.enemigos.filter(e => !e.defeated)
        const permitidos = filtrarProvocados(vivos)
        if (targetId != null) {
            const elegido = permitidos.find(e => String(e.ID) === String(targetId))
            if (elegido) return [elegido]
        }
        return permitidos.slice(0, 1)
    }

    /** Probabilidad de esquivar un ataque evadible. */
    _chanceEsquive(caster, target) {
        if (target.sinEsquive) return 0
        const agilidadDefensor = target.effectiveAgilidad;
        const precisionMod = caster.effectivePrecision;
        const basePrecision = (caster.stats?.precision !== undefined) ? caster.stats.precision : 100;
        const precisionEfectivaAtacante = Math.max(PRECISION_MINIMA_BASE, basePrecision * (1 + precisionMod / 100));
        const esquive = agilidadDefensor / (agilidadDefensor + precisionEfectivaAtacante);
        return Math.max(PISO_ESQUIVE, Math.min(TECHO_ESQUIVE, esquive));
    }

    // ─── Aplicación de daño y curación ────────────────────────────────────────

    /**
     * Aplica daño a un objetivo
     * @param {Object} mecanica - { base, scaling, esFisico, factor?, yaEsquivado? }
     * @param {Object} [origen] - { castId } (Congelado no se rompe con el daño de su propio cast)
     */
    _aplicarDaño(mecanica, caster, target, hechizo, session, origen = {}) {
        // Estasis: inmunidad total
        if (tieneInmunidad(target, "todo")) {
            return { cantidad: 0, esCritico: false, tipoElemental: "Neutro", inmune: true };
        }

        // Fallback para esquive si no fue precalculado
        const esEvadible = (hechizo._id === "basic_attack" || hechizo.evadible === true);
        if (esEvadible && session && !mecanica.yaEsquivado && caster) {
            if (Math.random() < this._chanceEsquive(caster, target)) {
                session.addLog("esquive", { defensor: target.Nombre, atacante: caster.Nombre });
                return { cantidad: 0, esCritico: false, tipoElemental: "Neutro", esquivado: true };
            }
        }

        const { multi: multiElemental, tipo: tipoElemental } =
            this._getMultiplicadorElemental(hechizo.Elemento, target.elemento)

        let cantidad = this._calculateAmount(mecanica, caster, multiElemental)
        if (cantidad === 0) {
            return { cantidad: 0, esCritico: false, tipoElemental };
        }

        // Cadena (Electro-002): 100% / 70% / 50%
        if (mecanica.factor !== undefined) cantidad = Math.floor(cantidad * Number(mecanica.factor))

        // Resplandor del atacante: multiplicador fuerte de daño (los NPCs devuelven 1)
        cantidad = Math.floor(cantidad * (Number(caster?.multiplicadorDanio) || 1))

        // Buffs / debuffs de daño del atacante (Fulgor Bendito +15%, Invierno Profundo −25%)
        const modsCaster = caster ? modificadores(caster) : { danio: 0 }
        if (modsCaster.danio) cantidad = Math.floor(cantidad * Math.max(0, 1 + modsCaster.danio))

        // Crítico: (sabiduria*2 + agilidad*2) / 100
        const chanceCritico = Math.min(BALANCE.CRITICO_TECHO,
            (((caster?.stats?.sabiduria || 0) * 2) + ((caster?.stats?.agilidad || 0) * 2)) / 100)
        const esCritico = Math.random() < chanceCritico
        if (esCritico) cantidad = Math.floor(cantidad * BALANCE.CRITICO_MULTI)

        // Reducción por resistencia + guardia antigua + buffs de defensa
        const resFis = target.stats?.resFisica ?? target.stats?.resistenciaFisica ?? 0;
        const resMag = target.stats?.resMagica ?? target.stats?.resistenciaMagica ?? 0;
        const lvlDef = Number(target.nivelCombate) || 1;
        const modsTarget = modificadores(target)

        const puntosDefensa = mecanica.esFisico
            ? (resFis * BALANCE.DEF_FISICA_RES) + (lvlDef * BALANCE.DEF_FISICA_NIVEL)
            : (resMag * BALANCE.DEF_MAGICA_RES) + (lvlDef * BALANCE.DEF_MAGICA_NIVEL);
        const guardiaAntigua = (target.defenseActual || 0) * BALANCE.GUARDIA_POR_PUNTO;
        const reduccion = Math.min(BALANCE.REDUCCION_TECHO_TOTAL, reduccionPorDefensa(puntosDefensa) + guardiaAntigua + Math.max(0, modsTarget.defensa));
        cantidad = Math.max(1, Math.round(cantidad * (1 - reduccion)));
        // Guardia (univ-001 / "Defenderse"): ~50% durante su turno de duración
        if (modsTarget.guardia) cantidad = Math.max(1, Math.round(cantidad * (1 - modsTarget.guardia)));
        // La guardia antigua se consume con el primer golpe recibido
        if (target.defenseActual) target.defenseActual = 0;
        if (isNaN(cantidad)) {
            console.error("Cantidad de daño es NaN", { cantidad, mecanica, hechizo: hechizo?._id })
            return { cantidad: 0, esCritico, tipoElemental }
        }
        const aplicado = target.aplicarDaño(cantidad, origen)
        if (caster) caster.damageDealt = (caster.damageDealt || 0) + aplicado
        // El log de "derrota" se registra después del log del ataque en _verificarYRegistrarDerrotas

        return { cantidad: aplicado, esCritico, tipoElemental }
    }

    _verificarYRegistrarDerrotas(session, caster) {
        if (!session) return;
        for (const c of session.getAllCombatientes()) {
            if (c.HP <= 0 && c.defeated && !c._alreadyLoggedDefeat) {
                c._alreadyLoggedDefeat = true;
                delete c.activeCast;
                session.addLog("derrota", { derrotados: [c.Nombre], derrotado: c.Nombre });
                session.emit('jugadorDerrotado', { victima: c, atacante: caster });
            }
        }
    }

    /**
     * Aplica curación a un objetivo. Con `scaling` usa base + stat × multi (como el daño);
     * los datos antiguos sin scaling conservan la fórmula de sintonía.
     */
    _aplicarCuracion(mecanica, caster, target, hechizo, esAccionInstantanea = true) {
        const { multi: multiElemental } =
            this._getMultiplicadorElemental(hechizo.Elemento, target.elemento)

        let cantidad = mecanica.scaling
            ? this._calculateAmount(mecanica, caster, multiElemental)
            : Math.floor((Number(mecanica.base) || 0) + ((caster?.stats?.sintoniaElemental ?? caster?.stats?.sintonia ?? 1) * 1.4 * multiElemental))

        if (isNaN(cantidad)) {
            console.error("Algun valor de curación es NaN", { cantidad, mecanica, hechizo: hechizo?._id })
            cantidad = 0
        }

        const hpPrev = target.HP
        if (target.aplicarCuracion) {
            target.aplicarCuracion(cantidad, esAccionInstantanea);
        } else {
            if (target.defeated && !esAccionInstantanea) return { cantidad: 0 };
            const hpMax = target.stats?.hpMax ?? 99999;
            target.HP = Math.min(hpMax, target.HP + cantidad);
            if (target.HP > 0 && !target.surrender) {
                target.defeated = false;
                target._alreadyLoggedDefeat = false;
            }
        }

        return { cantidad: Math.max(0, target.HP - hpPrev) }
    }

    /**
     * Compatibilidad: antes los estados de hechizo se acumulaban en pendingEffects y se aplicaban
     * al cerrar la ronda. Ahora se aplican en el acto (así un control puede interrumpir un cast).
     */
    _agregarEfectoPendiente(session, efectoDatos, key, target, caster) {
        const probabilidad = efectoDatos.probabilidad ?? 1
        if (Math.random() > probabilidad) return false
        if (esInmune(target, key) || esInmune(target, efectoDatos.Nombre)) return false
        if (tieneInmunidad(target, "todo")) return false
        const nombre = efectoDatos.Nombre || key
        const [convertido] = normalizarHechizo({ _id: "tmp", Mecanicas: { Efectos: { [key]: { ...efectoDatos, probabilidad: 1 } } } }).Mecanicas.Efectos
        if (convertido && !["legacy", "instantaneo"].includes(convertido.tipo)) {
            return aplicarEfecto({ sesion: session, caster, target, efecto: convertido, ctx: { esInmune, revertir: revertirModStat } }).aplicado
        }
        agregarEstado(target, {
            id: String(key).toLowerCase(),
            Nombre: nombre, nombre,
            base: typeof efectoDatos.base === 'object' ? { ...efectoDatos.base } : Number(efectoDatos.base) || 0,
            duracion: Number(efectoDatos.duracion) || 1,
            objetivo: target.ID,
            fuente: caster?.ID,
        })
        return true
    }

    // ─── Acción principal ─────────────────────────────────────────────────────

    /**
     * Procesa la acción de un combatiente en su sub-turno
     * @param {sesionCombate} session
     * @param {String} userId — quien actúa
     * @param {Object} accion — { tipo: 'attack'|'spell'|'defend'|'surrender', spellId, targetId }
     * @returns {Object} resultado de la acción para que CombatUI lo muestre
     */
    async resolveAction(session, userId, accion) {
        const caster = session.getCombatiente(userId)
        if (!caster) return { success: false, message: "Combatiente no encontrado" }

        const battleState = this._bandos(session, caster)

        try {
            switch (accion.tipo) {

                // ── Ataque básico (Golpe: vía movimiento) ────────────────
                case 'attack': {
                    const ev = evaluarCasteo(caster, ACCIONES.GOLPE)
                    if (!ev.ok) return { success: false, message: `No puedes golpear: ${ev.motivo}.` }

                    const hechizo = this._generarAtaqueBasico(caster)
                    const targets = this._resolverObjetivoAtaque(caster, accion.targetId, battleState)
                    if (targets.length === 0) return { success: false, message: "No hay objetivos válidos" }

                    session.resolverTurnoExitoso?.(caster.ID);

                    const esquivaron = new Set();
                    for (const target of targets) {
                        if (tieneInmunidad(target, "todo")) continue
                        if (Math.random() < this._chanceEsquive(caster, target)) {
                            esquivaron.add(target.ID);
                            session.addLog("esquive", { defensor: target.Nombre, atacante: caster.Nombre });
                        }
                    }

                    const resultados = targets.map(target => {
                        if (esquivaron.has(target.ID)) {
                            return { target, cantidad: 0, esCritico: false, tipoElemental: "Neutro", esquivado: true };
                        }
                        return {
                            target,
                            ...this._aplicarDaño({ ...hechizo.Mecanicas.damage, yaEsquivado: true }, caster, target, hechizo, session)
                        };
                    });

                    const inmunes = resultados.filter(r => r.inmune)
                    if (inmunes.length) logSistema(session, `${inmunes.map(r => r.target.Nombre).join(", ")} está en Estasis: el golpe no le afecta.`, { autor: caster.Nombre })
                    const golpeados = resultados.filter(r => !r.esquivado && !r.inmune)
                    if (golpeados.length) {
                        session.addLog("ataque", {
                            atacante: caster.Nombre,
                            defensor: golpeados.map(r => r.target.Nombre).join(", "),
                            daño: golpeados[0]?.cantidad || 0
                        });
                    }
                    this._verificarYRegistrarDerrotas(session, caster);

                    return {
                        success: true,
                        tipo: 'attack',
                        caster,
                        hechizo,
                        resultados,
                        gameOver: session.combateTerminado()
                    }
                }

                // ── Hechizo ───────────────────────────────────────────────
                case 'spell': {
                    return await this.resolverHechizo(session, caster, accion.spellId, accion.targetId ? [accion.targetId] : null);
                }

                // ── Defender (Guardia universal: vía movimiento) ──────────
                case 'defend': {
                    const ev = evaluarCasteo(caster, ACCIONES.GUARDIA)
                    if (!ev.ok) return { success: false, message: `No puedes cubrirte: ${ev.motivo}.` }
                    session.resolverTurnoExitoso?.(caster.ID);
                    aplicarEfecto({ sesion: session, caster, target: caster, efecto: { tipo: "guardia", nombre: "Guardia", valor: GUARDIA.REDUCCION, duracion: GUARDIA.DURACION } })
                    const porcentaje = `${Math.round(GUARDIA.REDUCCION * 100)}%`
                    session.addLog("defender", { defensor: caster.Nombre, defensaObtenida: porcentaje })

                    return {
                        success: true,
                        tipo: 'defender',
                        caster,
                        bonus: porcentaje
                    }
                }

                // ── Rendirse ──────────────────────────────────────────────
                case 'surrender': {
                    session.resolverTurnoExitoso?.(caster.ID);
                    caster.defeated = true
                    caster.surrender = true
                    delete caster.activeCast
                    session.addLog("surrender", { combatiente: caster.Nombre })

                    return {
                        success: true,
                        tipo: 'surrender',
                        caster,
                        gameOver: session.combateTerminado()
                    }
                }

                default:
                    return { success: false, message: "Acción desconocida" }
            }

        } catch (error) {
            console.error("Error en TurnProcessor.resolveAction:", error)
            return { success: false, message: "Error interno al procesar la acción" }
        }
    }

    // ─── Fin de turno y compás ────────────────────────────────────────────────

    /**
     * Cierra el turno propio del combatiente que acaba de actuar (efectos periódicos y duraciones,
     * con la pausa de Estasis) y lo marca como actuado en este subturno.
     */
    _procesarFinDeAccion(session, caster) {
        if (caster && !caster.defeated) {
            procesarFinDeTurno(caster, {
                danio: (pj, valor, eff) => {
                    const aplicado = pj.aplicarDaño(valor, { periodico: true });
                    if (!aplicado) return;
                    session.addLog("efecto_periodico", {
                        personaje: pj.Nombre,
                        valor: aplicado,
                        efecto: eff.Nombre || eff.nombre || eff.id,
                        isDmg: true
                    });
                    if (pj.defeated && !pj._alreadyLoggedDefeat) {
                        pj._alreadyLoggedDefeat = true;
                        delete pj.activeCast;
                        session.addLog("derrota", { derrotado: pj.Nombre });
                        session.emit('jugadorDerrotado', { victima: pj, atacante: session.getCombatiente(eff.fuente) || pj });
                    }
                },
                cura: (pj, valor, eff) => {
                    const hpPrev = pj.HP;
                    pj.aplicarCuracion(valor);
                    if (pj.HP - hpPrev <= 0) return;
                    session.addLog("efecto_periodico", {
                        personaje: pj.Nombre,
                        valor: pj.HP - hpPrev,
                        efecto: eff.Nombre || eff.nombre || eff.id,
                        isDmg: false
                    });
                },
                revertir: revertirModStat, // los buffs temporales de stat se deshacen al expirar
            });
        }

        caster.bolitaPos = caster.valorCompas;
        session.actuaronEsteSubturno.add(caster.ID);
    }

    /**
     * Avanza el estado del compás de ronda (ticks de enfriamientos, regeneración, etc.)
     * y recalcula las bolitaPos de todos los combatientes activos.
     * Devuelve true si se cerró la ronda (no hay bolas activas).
     */
    _avanzarRondaCompleta(session) {
        const todosActivos = session.getAllCombatientes().filter(c => !c.defeated);
        session.avanzarCompas();
        session.actuaronEsteSubturno.clear();
        this.tickCooldowns(session);
        this.tickRegeneracion(session);

        todosActivos.forEach(c => {
            c.valorCompas = Math.min(1000, Math.floor(1000 / c.effectiveTempo));
            c.bolitaPos = c.valorCompas;
            if (c.valorCompas > session.compasMax) {
                session.actuaronEsteSubturno.add(c.ID);
            }
        });

        return !session.hayBolitasActivas();
    }

    /** Hechizos que el combatiente podría usar (para saber si aún tiene alguna acción real). */
    _hechizosDisponibles(actor) {
        if (actor.isNPC) {
            return (actor.ataques || []).map(a => a.hechizoId
                ? cacheHechizos.obtenerSync(a.hechizoId)
                : { _id: `inline_${a.id}`, Elemento: actor.elemento, Mecanicas: { cast: { vias: a.vias || ["movimiento"], tiempo: a.cast?.tiempo ?? 1, probabilidad: 1 } } }
            ).filter(Boolean)
        }
        const ids = [...(actor.hechizos || []).map(h => h?.ID ?? h), ...UNIVERSALES_INICIALES]
        return cacheHechizos.obtenerVariosSync(ids)
    }

    /**
     * Si el combatiente no puede actuar este turno, devuelve el motivo (y si lo salta el sistema).
     * El turno saltado por Estasis o por control NO cuenta como turno saltado ni como AFK.
     */
    motivoSaltoTurno(actor) {
        if (!actor || actor.defeated) return null
        const r = puedeActuar(actor, this._hechizosDisponibles(actor))
        return r.puede ? null : r
    }

    /** Salta el turno de un combatiente que no puede actuar (sin tocar los contadores AFK). */
    _registrarTurnoSaltado(session, actor, salto) {
        const duracion = efectosActivos(actor).find(a => a.nombre === salto.motivo || salto.motivo?.includes(a.nombre))?.efecto?.duracion
        const texto = salto.sistema
            ? `${actor.Nombre} reposa en Estasis: intocable, su turno pasa sin que el tiempo corra.`
            : `${actor.Nombre} no puede actuar en este turno debido a: ${salto.motivo}${duracion ? ` (${duracion} turno(s) restante(s))` : ""}.`
        logSistema(session, texto, { autor: actor.Nombre })
    }

    /** Llamado al iniciar el turno de un humano: si no puede actuar, el sistema lo salta. */
    async saltarTurnoSistema(session, actor, salto = null) {
        salto ??= this.motivoSaltoTurno(actor)
        if (!salto) return false
        this._registrarTurnoSaltado(session, actor, salto)
        await this.advanceCompas(session, actor)
        return true
    }

    /**
     * Turno de un actor que no requiere al jugador: incapacitado / Estasis, canalizando o NPC.
     * @returns {Promise<boolean>} true si se resolvió (el bucle sigue); false si espera a un humano
     */
    async _turnoAutomatico(session, actor, { emitirAntesDeNPC = false } = {}) {
        const salto = this.motivoSaltoTurno(actor)
        if (salto) {
            this._registrarTurnoSaltado(session, actor, salto)
            this._procesarFinDeAccion(session, actor)
            return true
        }

        if (actor.activeCast) {
            this._processActiveCastTick(session, actor)
            this._verificarYRegistrarDerrotas(session, actor)
            this._procesarFinDeAccion(session, actor)
            return true
        }

        if (actor.isNPC) {
            // Emitir la UI antes del retraso para que el humano vea el resultado de su acción
            if (emitirAntesDeNPC) session.emit('actualizarUI')
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 1000) + 2000))
            const NpcAi = require("./npcAi")
            await NpcAi.executeTurn(session, actor)
            this._verificarYRegistrarDerrotas(session, actor)
            session.emit('actualizarUI')
            this._procesarFinDeAccion(session, actor)
            return true
        }
        return false
    }

    // advanceCompas — iterativo, no recursivo
    async advanceCompas(session, caster) {
        await cacheHechizos.asegurar().catch(e => console.error("[Hechizos] No se pudo cargar la caché:", e.message))
        if (caster) this._procesarFinDeAccion(session, caster);

        // Loop principal: seguir procesando mientras el siguiente actor no sea un humano con acciones
        while (true) {
            const gameOver = session.checkGameOver();
            if (gameOver.gameOver) {
                return { rondaCerrada: false, gameOver: true, winners: gameOver.winners, arrayWinner: gameOver.arrayWinner };
            }

            const todosActivos = session.getAllCombatientes().filter(c => !c.defeated);
            const todosActuaron = todosActivos.every(c => session.actuaronEsteSubturno.has(c.ID));
            let rondaCerrada = false;

            if (todosActuaron) {
                // Todos actuaron → avanzar ronda completa
                rondaCerrada = this._avanzarRondaCompleta(session);
                if (rondaCerrada) {
                    const go2 = session.checkGameOver();
                    if (go2.gameOver) return { rondaCerrada: true, gameOver: true, winners: go2.winners, arrayWinner: go2.arrayWinner };
                    session.cerrarRonda();
                    session.calcularPrimerTurno();
                } else {
                    session.calcularPrimerTurno();
                    const go2 = session.checkGameOver();
                    if (go2.gameOver) return { rondaCerrada: true, gameOver: true, winners: go2.winners, arrayWinner: go2.arrayWinner };
                }
            } else {
                // Subturno en curso: avanzar bolas de los pendientes
                const pendientes = todosActivos.filter(c => !session.actuaronEsteSubturno.has(c.ID));
                if (pendientes.length > 0) {
                    const salto = Math.min(...pendientes.map(c => c.bolitaPos));
                    pendientes.forEach(c => c.bolitaPos -= salto);

                    let proximosEnActuar = pendientes.filter(c => c.bolitaPos === 0);
                    if (proximosEnActuar.length > 1) {
                        proximosEnActuar = proximosEnActuar
                            .map(c => ({ c, roll: Math.random() }))
                            .sort((a, b) => b.roll - a.roll)
                            .map(({ c }) => c);
                    }
                    session.turnoQueue = proximosEnActuar;
                }
            }

            const nextActor = session.getCurrentActor();
            if (!nextActor) {
                session.emit('actualizarUI');
                return { rondaCerrada, proximosEnActuar: session.turnoQueue };
            }

            if (await this._turnoAutomatico(session, nextActor, { emitirAntesDeNPC: !todosActuaron })) continue;

            // Jugador humano → detener y esperar su interacción
            session.emit('actualizarUI');
            const clientBot = require("../../bot");
            if (typeof session.iniciarWatchdogTurno === 'function') {
                session.iniciarWatchdogTurno(clientBot);
            }
            return { rondaCerrada, proximosEnActuar: session.turnoQueue };
        }
    }

    tickCooldowns(session) {
        session.getAllCombatientes().forEach(c => {
            // Solo cooldowns de hechizos — las duraciones de statusEffect bajan en el turno propio.
            // Cooldown N = el hechizo vuelve a estar listo N−1 turnos después (Cooldown 1 = cada turno).
            if (c.cooldowns) {
                for (const key of Object.keys(c.cooldowns)) {
                    c.cooldowns[key]--
                    if (c.cooldowns[key] <= 0) delete c.cooldowns[key]
                }
            }
        })
    }

    /**
     * Regeneración pasiva de maná al cerrar una ronda
     */
    tickRegeneracion(session) {
        session.getAllCombatientes().forEach(c => {
            if (c.defeated) return
            if (!c.artefactoMagico) {
                c.Mana = Math.min(
                    c.stats?.manaMax ?? c.Mana,
                    c.Mana + 2
                )
            }
        })
    }

    async resolverObjetos(session, caster, itemData, targetIds = null) {
        // Fuera de combate llega el documento del alma: se usa un combatiente temporal para aplicar efectos
        if (!session && caster && typeof caster.aplicarCuracion !== 'function') {
            caster = new Personaje(Number(caster._id ?? caster.ID), caster);
        }

        // Usar un objeto exige movimiento (III.E). Fuera de combate los estados no cuentan.
        if (session) {
            const ev = evaluarCasteo(caster, ACCIONES.OBJETO);
            if (!ev.ok) return { success: false, message: `No puedes usar objetos: ${ev.motivo}.` };
        }

        // Paso 1 — Obtener el objeto:
        const itemDoc = await dbobjetos.findOne({
            _id: itemData.Region,
            "Objetos.ID": Number(itemData.ID)
        });
        const objetoExist = itemDoc?.Objetos?.find(o => Number(o.ID) === Number(itemData.ID));
        if (!objetoExist) {
            return { success: false, message: "No se pudo encontrar el objeto seleccionado" };
        }

        if (session && !caster.isNPC) {
            session.lastSpellOrItemUser = caster.ID;
        }

        // Paso 2 — Validaciones previas:
        const characterId = Number(caster.ID || caster._id);
        const charDoc = await characters.findOne({ _id: characterId });
        if (!charDoc) {
            return { success: false, message: "Personaje no encontrado." };
        }
        const isExploracion = Boolean(session?.type === "exploration" || session?.duelType === "exploration" || session?.isExploracion === true);
        const inventario = isExploracion 
            ? (charDoc.economia?.Mochila || [])
            : (charDoc.economia?.Inventario || charDoc.Inventario || []);
        const itemInInv = inventario.find(i => 
            (i.ID !== undefined && String(i.ID) === String(objetoExist.ID)) || 
            (i.Nombre && objetoExist.Nombre && i.Nombre.toLowerCase() === objetoExist.Nombre.toLowerCase())
        );
        if (!itemInInv || (itemInInv.Cantidad ?? itemInInv.cantidad ?? 0) <= 0) {
            const noItemMsg = isExploracion
                ? "No tienes este objeto en tu mochila o no te quedan unidades."
                : "No tienes este objeto en tu inventario o no te quedan unidades.";
            return { success: false, message: noItemMsg };
        }

        // Verificar que uso.contexto es compatible con el contexto actual.
        const usoContexto = objetoExist.uso?.contexto || "ambos";
        if (usoContexto === "combate" && !session) {
            return { success: false, message: "Este objeto solo se puede usar en combate." };
        }
        if (usoContexto === "mapa" && session) {
            return { success: false, message: "Este objeto no se puede usar en combate." };
        }
        // Verificar las restricciones del objeto: fe_min, fe_max, resplandor_min, resplandor_max, clase, región y reputación
        const rest = objetoExist.restricciones;
        const soulDoc = await db2.collection("Soul").findOne({ _id: characterId }) || {};
        const { ganados: userFE, resplandor: userResplandor } = leerProgreso(soulDoc || {});

        const userClass = String(caster.Clase || charDoc.Clase || charDoc.clase || "").toLowerCase();
        const userRegion = String(caster.Region || charDoc.Region || charDoc.perfil?.Region || "").toLowerCase();
        const userRep = Number(caster.Reputacion || charDoc.Reputacion || charDoc.reputacion || 0);

        if (rest) {
            // FE Mínimo (reemplaza nivel_minimo)
            const feMin = Number(rest.fe_min ?? rest.nivel_minimo ?? 0);
            if (feMin > 0 && userFE < feMin) {
                return { success: false, message: `No cumples con la FE mínima requerida (${feMin})` };
            }
            // FE Máximo (reemplaza nivel_maximo)
            const feMax = Number(rest.fe_max ?? rest.nivel_maximo ?? 0);
            if (feMax > 0 && userFE > feMax) {
                return { success: false, message: `Superas la FE máxima permitida para este objeto (${feMax})` };
            }
            // Resplandor Mínimo
            const respMin = Number(rest.resplandor_min ?? 0);
            if (respMin > 0 && userResplandor < respMin) {
                return { success: false, message: `No cumples con el Resplandor mínimo requerido (${respMin})` };
            }
            // Resplandor Máximo
            const respMax = Number(rest.resplandor_max ?? 0);
            if (respMax > 0 && userResplandor > respMax) {
                return { success: false, message: `Superas el Resplandor máximo permitido para este objeto (${respMax})` };
            }
            // Clase
            if (rest.clase && userClass !== String(rest.clase).toLowerCase()) {
                return { success: false, message: `Tu clase no es compatible. Requerida: ${rest.clase}` };
            }
            // Región
            if (rest.region && userRegion !== String(rest.region).toLowerCase()) {
                return { success: false, message: `Este objeto solo puede usarse en la región: ${rest.region}` };
            }
            // Reputación
            const repReq = Number(rest.reputacion ?? 0);
            if (repReq > 0 && userRep < repReq) {
                return { success: false, message: `No tienes suficiente reputación. Requerida: ${repReq}` };
            }
        }
        // Si uso.cooldown no es null, verificar que el caster no tenga ese cooldown activo actualmente.
        const itemIdKey = String(objetoExist.ID);
        if (objetoExist.uso?.cooldown && caster.cooldowns?.[itemIdKey] > 0) {
            return { success: false, message: `Este objeto está en enfriamiento (${caster.cooldowns[itemIdKey]} ronda/s restante/s)` };
        }

        // Paso 3 — Determinar objetivos:
        let objetivos = [];
        const tipoObjetivo = objetoExist.uso?.objetivo?.tipo || "mismo";
        const cantidadObjetivo = objetoExist.uso?.objetivo?.cantidad || 1;

        if (tipoObjetivo === "mismo" || !session) {
            objetivos = [caster];
            return await this.añadirEfectos(session, caster, objetoExist, objetivos, characterId);
        } else if (tipoObjetivo === "todos") {
            objetivos = session.getAllCombatientes().filter(c => !c.defeated);
            return await this.añadirEfectos(session, caster, objetoExist, objetivos, characterId);
        } else {
            // Paso 4 — Selección de objetivo:
            const esEquipo1 = session.teams[0].some(c => c.ID === caster.ID);
            const aliados = esEquipo1 ? session.teams[0] : session.teams[1];
            const enemigos = esEquipo1 ? session.teams[1] : session.teams[0];

            let candidatos = [];
            if (tipoObjetivo === "aliados") {
                candidatos = aliados.filter(a => a.ID !== caster.ID && !a.defeated);
            } else if (tipoObjetivo === "enemigos") {
                candidatos = enemigos.filter(e => !e.defeated);
            } else if (tipoObjetivo === "global") {
                candidatos = [...aliados, ...enemigos].filter(c => !c.defeated);
            }

            // Llamar a buildTarget() en combateUI.js
            InterfazCreate.buildTarget(session, caster, candidatos, objetoExist.Nombre, objetoExist.ID);

            if (!targetIds) {
                return {
                    success: true,
                    requiresInteraction: true,
                    message: `Selecciona los objetivos para ${objetoExist.Nombre}.`,
                    candidatos,
                    cantidadObjetivo,
                    objeto: objetoExist
                };
            }

            // Luego llamar a createObjetivesModal() en el mismo archivo
            const selectedIds = InterfazCreate.createObjetivesModal(session, caster, candidatos, cantidadObjetivo, targetIds);
            objetivos = selectedIds.map(id => session.getCombatiente(id)).filter(Boolean);

            if (objetivos.length === 0) {
                return { success: false, message: "No se seleccionaron objetivos válidos." };
            }

            return await this.añadirEfectos(session, caster, objetoExist, objetivos, characterId);
        }
    }

    async añadirEfectos(session, caster, objetoExist, objetivos, characterId) {
        const isExploracion = Boolean(session?.type === "exploration" || session?.duelType === "exploration" || session?.isExploracion === true);

        // Paso 5 — Aplicar efectos:
        // Formato nuevo (suma/resta/limpia/aplica/inmuniza) → efectosObjeto; el antiguo se conserva abajo
        const efectosAplicados = [];
        for (const target of objetivos) {
            // Estasis: inmunidad total, no recibe efectos nuevos
            if (session && tieneInmunidad(target, "todo")) continue;
            for (const efecto of (objetoExist.efectos || [])) {
                if (!cumpleCondicion(efecto.condicion, caster, target)) continue;

                if (esFormatoNuevo(efecto)) {
                    efectosAplicados.push(...aplicarEfectoObjeto({ session, caster, target, efecto, objeto: objetoExist }));
                    continue;
                }

                let valorAplicado = efecto.valor;

                if (efecto.duracion !== null && efecto.duracion !== undefined) {
                    if (!session) continue; // los estados con duración solo existen en combate
                    const key = String(efecto.tipo || objetoExist.ID).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
                    if (esInmune(target, key)) continue;
                    target.statusEffect ??= [];
                    target.statusEffect.push({
                        id: key,
                        Nombre: efecto.Nombre || objetoExist.Nombre,
                        nombre: efecto.Nombre || objetoExist.Nombre,
                        base: efecto.valor,
                        duracion: efecto.duracion,
                        objetivo: target.ID,
                        fuente: caster.ID
                    });
                } else {
                    const tipoLower = String(efecto.tipo || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
                    const statLower = String(efecto.stat || '').toLowerCase();

                    if (tipoLower === 'curacion' || tipoLower === 'heal' || tipoLower === 'hp' || statLower === 'hp' || (tipoLower === 'regeneracion' && statLower === 'hp')) {
                        const hpPrev = target.HP;
                        if (target.aplicarCuracion) target.aplicarCuracion(Number(efecto.valor || 0), true);
                        else target.HP = Math.min(target.stats?.hpMax || 99999, target.HP + Number(efecto.valor || 0));
                        valorAplicado = target.HP - hpPrev;
                    } else if (tipoLower === 'dano' || tipoLower === 'damage') {
                        const res = this._aplicarDaño({ base: efecto.valor, esFisico: false }, caster, target, { Elemento: 'Neutro' }, session);
                        valorAplicado = res.cantidad;
                    } else if (
                        tipoLower === 'mana' || 
                        tipoLower === 'recuperar_mana' || 
                        tipoLower === 'restaurar_mana' || 
                        tipoLower === 'recuperacion_mana' || 
                        tipoLower === 'restauracion_mana' || 
                        tipoLower === 'recuperarmana' || 
                        statLower === 'mana' ||
                        (tipoLower === 'regeneracion' && (statLower === 'mana' || statLower === ''))
                    ) {
                        const manaPrev = target.Mana;
                        const maxMana = target.stats?.manaMax || target.stats?.maxMana || target.manaMax || 99999;
                        target.Mana = Math.min(maxMana, target.Mana + Number(efecto.valor || 0));
                        valorAplicado = target.Mana - manaPrev;
                    } else {
                        // Un stat sin duración fuera del formato nuevo no se puede deshacer: se ignora
                        continue;
                    }
                    if (!valorAplicado) continue;
                }

                efectosAplicados.push({ ...efecto, valor: valorAplicado, objetivos: [target.Nombre], targetId: target.ID });
            }
        }

        // Paso 6 — Registrar en el log:
        if (session) {
            session.addLog("objeto", {
                autor: caster.Nombre,
                autorId: caster.ID,
                item: { Nombre: objetoExist.Nombre, Tipo: objetoExist.Tipo },
                efectos: efectosAplicados,
                objetivos: objetivos.map(o => o.Nombre),
                objetivosDetalle: objetivos.map(o => ({ ID: o.ID, Nombre: o.Nombre }))
            });
            this._verificarYRegistrarDerrotas(session, caster);
        }

        if (!session) {
            // Fuera de combate: si no pasó nada (p. ej. limpia un estado que no tienes) no se gasta el objeto
            if (efectosAplicados.length === 0) {
                return {
                    success: false,
                    message: buildActionMessage({ actor: caster.Nombre, item: objetoExist, efectos: [], objetivos: [], perspectiva: 'tu' })
                };
            }
            // Guardar en el alma lo que cambió (HP y maná son lo único que persiste fuera de combate)
            await Promise.all(objetivos.filter(o => !o.isNPC).map(o =>
                db2.collection("Soul").updateOne({ _id: Number(o.ID) }, { $set: { "nucleo.HP": o.HP, "nucleo.Mana": o.Mana } })
            ));
        }

        // Paso 7 — Consumir (por defecto los objetos son consumibles, igual que en el dashboard):
        if (objetoExist.uso?.consumible !== false) {
            await updateInventario(null, null, characterId, {
                isItem: true,
                ID: Number(objetoExist.ID),
                Region: objetoExist.Region,
                consumir: true,
                isMochila: isExploracion
            });
        }

        const itemIdKey = String(objetoExist.ID);
        if (objetoExist.uso?.cooldown !== null && objetoExist.uso?.cooldown !== undefined) {
            caster.cooldowns ??= {};
            caster.cooldowns[itemIdKey] = Number(objetoExist.uso.cooldown);
        }

        session?.resolverTurnoExitoso?.(caster.ID);

        const personalMsg = buildActionMessage({
            actor: caster.Nombre,
            item: objetoExist,
            efectos: efectosAplicados,
            objetivos: objetivos.map(o => o.Nombre),
            perspectiva: 'tu'
        });

        return {
            success: true,
            message: personalMsg,
            objeto: objetoExist,
            objetivos
        };
    }

    // ─── Hechizos ─────────────────────────────────────────────────────────────

    /** Hechizo normalizado desde un _id (caché en memoria) o un objeto ya armado (ataque inline). */
    async _obtenerHechizo(hechizoId) {
        if (hechizoId && typeof hechizoId === "object") return normalizarHechizo(hechizoId)
        return await cacheHechizos.obtener(hechizoId)
    }

    /**
     * Requisitos de un hechizo: contexto de uso, requisitos de adquisición (FE, Resplandor, clase,
     * stats) y, para todo lo demás (estados, vías, kit, cooldown, costos), evaluarCasteo.
     * @returns {Promise<{ success: boolean, message?: string, evaluacion?: Object }>}
     */
    async checkSpellRequirements(caster, hechizoRaw, session) {
        const hechizo = hechizoRaw?._normalizado ? hechizoRaw : normalizarHechizo(hechizoRaw)
        // Los ataques inline de NPC y ataques básicos son siempre válidos (generados dinámicamente)
        const isInlineOrBasic = hechizo?._id && (
            String(hechizo._id).startsWith('inline_') ||
            String(hechizo._id).startsWith('basic_')
        );

        if (!isInlineOrBasic && (!hechizo || !hechizo.isActive)) {
            return { success: false, message: "El hechizo no está activo o no existe." };
        }

        // 1. Contexto de uso
        const uso = hechizo.uso || "combate";
        if (uso === "combate" && !session) {
            return { success: false, message: "Este hechizo solo se puede usar en combate." };
        }
        if (uso === "mapa" && session) {
            return { success: false, message: "Este hechizo no se puede usar en combate." };
        }

        // 2. Req (solo jugadores: los NPCs no tienen alma ni progreso)
        if (hechizo.Req && !caster.isNPC && !isInlineOrBasic) {
            const characterId = Number(caster.ID || caster._id);
            if (!caster._charDoc) {
                caster._charDoc = await characters.findOne({ _id: characterId }) || {};
            }
            if (!caster._soulDoc) {
                caster._soulDoc = await db2.collection("Soul").findOne({ _id: characterId }) || {};
            }
            const charDoc = caster._charDoc;
            const soulDoc = caster._soulDoc;
            if (!charDoc._id) {
                return { success: false, message: "Personaje no encontrado." };
            }

            const { ganados: userFE, resplandor: userResplandor } = leerProgreso(soulDoc || {});
            const userClass = String(caster.Clase || charDoc.Clase || charDoc.clase || "").toLowerCase();

            const feMin = Number(hechizo.Req.fe_min ?? 0);
            if (feMin > 0 && userFE < feMin) {
                return { success: false, message: `No cumples con la FE mínima requerida (${feMin}).` };
            }
            const feMax = Number(hechizo.Req.fe_max ?? 0);
            if (feMax > 0 && userFE > feMax) {
                return { success: false, message: `Superas la FE máxima permitida (${feMax}).` };
            }
            const respMin = Number(hechizo.Req.resplandor_min ?? 0);
            if (respMin > 0 && userResplandor < respMin) {
                return { success: false, message: `No cumples con el Resplandor mínimo requerido (${respMin}).` };
            }
            const respMax = Number(hechizo.Req.resplandor_max ?? 0);
            if (respMax > 0 && userResplandor > respMax) {
                return { success: false, message: `Superas el Resplandor máximo permitido (${respMax}).` };
            }
            if (hechizo.Req.clase && userClass !== String(hechizo.Req.clase).toLowerCase()) {
                return { success: false, message: `Clase no compatible. Requerida: ${hechizo.Req.clase}.` };
            }
            if (hechizo.Req.stats) {
                for (const [statName, reqVal] of Object.entries(hechizo.Req.stats)) {
                    const casterVal = Number(caster.stats?.[statName] ?? charDoc.stats?.[statName] ?? 0);
                    if (casterVal < Number(reqVal)) {
                        return { success: false, message: `No tienes suficiente ${statName} (Requerido: ${reqVal}).` };
                    }
                }
            }
        }

        // 3. Estados, vías, kit, cooldown y costos: un único punto de decisión
        const evaluacion = evaluarCasteo(caster, hechizo)
        if (!evaluacion.ok) {
            return { success: false, message: `No puedes lanzar ${hechizo.Nombre}: ${evaluacion.motivo}.`, evaluacion };
        }
        return { success: true, evaluacion };
    }

    /**
     * Cómo apunta un hechizo: un "slot" de daño (enemigos) y uno de curación/apoyo (aliados).
     * Sale de damage/healing o, si no hay, del primer efecto de un solo objetivo.
     */
    _planObjetivos(hechizo) {
        const m = hechizo.Mecanicas || {}
        const plan = { damage: null, healing: null }
        if (m.damage) plan.damage = { objetivo: m.damage.objetivo, alcance: m.damage.alcance }
        if (m.healing) plan.healing = { objetivo: m.healing.objetivo, alcance: m.healing.alcance }
        const efectos = m.Efectos || []
        if (efectos.some(e => e.tipo === "revive")) plan.healing = { objetivo: "aliados", alcance: "single", caidos: true }
        for (const e of efectos) {
            if (e.objetivo === "mismo" || e.alcance === "todos") continue
            if ((e.objetivo === "enemigos" || e.objetivo === "global") && !plan.damage) plan.damage = { objetivo: e.objetivo, alcance: "single" }
            if (e.objetivo === "aliados" && !plan.healing) plan.healing = { objetivo: "aliados", alcance: "single" }
        }
        return plan
    }

    /**
     * Candidatos para un slot de un solo objetivo. 'aliados' te incluye a ti; con Provocar,
     * los enemigos que provocan son los únicos elegibles.
     */
    _obtenerCandidatos(session, caster, tipoObjetivo, { caidos = false } = {}) {
        if (!session) return [];
        if (tipoObjetivo === "mismo") return [caster];
        if (tipoObjetivo === "todos") return session.getAllCombatientes().filter(c => !c.defeated);

        const { aliados, enemigos } = this._bandos(session, caster)

        if (tipoObjetivo === "aliados") {
            if (caidos) return aliados.filter(a => a.ID !== caster.ID && a.defeated && !a.surrender);
            return aliados.filter(a => !a.defeated);
        } else if (tipoObjetivo === "enemigos") {
            return filtrarProvocados(enemigos.filter(e => !e.defeated));
        } else if (tipoObjetivo === "global") {
            return [...aliados, ...enemigos].filter(c => !c.defeated);
        }
        return [];
    }

    /** Todos los objetivos de un slot de área. */
    _objetivosArea(session, caster, objetivo, invertido = false) {
        if (!session) return [caster]
        const { aliados, enemigos } = this._bandos(session, caster)
        let lado = objetivo
        if (invertido && objetivo === "enemigos") lado = "aliados"
        else if (invertido && objetivo === "aliados") lado = "enemigos"
        if (lado === "enemigos") return enemigos.filter(c => !c.defeated)
        if (lado === "aliados") return aliados.filter(c => !c.defeated)
        if (lado === "mismo") return [caster]
        return session.getAllCombatientes().filter(c => !c.defeated)
    }

    /** IDs elegidos por el jugador → { damage, healing } con combatientes reales. */
    _leerSeleccion(session, targetIds) {
        const resolver = (id) => {
            const n = Number(id)
            return session?.getCombatiente(isNaN(n) ? id : n) || session?.getCombatiente(id)
        }
        if (!targetIds) return { damage: [], healing: [] }
        if (typeof targetIds === "object" && !Array.isArray(targetIds)) {
            return {
                damage: (targetIds.damage || []).map(resolver).filter(Boolean),
                healing: (targetIds.healing || []).map(resolver).filter(Boolean),
            }
        }
        const lista = (Array.isArray(targetIds) ? targetIds : [targetIds]).map(resolver).filter(Boolean)
        return { damage: lista, healing: lista }
    }

    async resolverHechizo(session, caster, hechizoId, targetIds = null) {
        const hechizo = await this._obtenerHechizo(hechizoId)
        if (!hechizo) {
            return { success: false, message: "No se pudo encontrar el hechizo seleccionado." };
        }

        if (session && !caster.isNPC) {
            session.lastSpellOrItemUser = caster.ID;
        }

        const check = await this.checkSpellRequirements(caster, hechizo, session);
        if (!check.success) {
            return check;
        }
        const evaluacion = check.evaluacion

        // ── Objetivos ────────────────────────────────────────────────────────
        // 'mismo' / alcance 'todos' → automático · un solo candidato → automático
        // 'aliados' / 'enemigos' / 'global' con varios candidatos → el jugador elige
        const plan = this._planObjetivos(hechizo)
        const slot = (p) => {
            if (!p) return { candidatos: [], auto: [], elegir: false }
            if (p.objetivo === "mismo") return { candidatos: [], auto: [caster], elegir: false }
            if (p.alcance === "todos") return { candidatos: [], auto: this._objetivosArea(session, caster, p.objetivo), elegir: false }
            const candidatos = this._obtenerCandidatos(session, caster, p.objetivo, { caidos: p.caidos })
            return { candidatos, auto: candidatos.length === 1 ? candidatos : [], elegir: candidatos.length > 1 }
        }
        const sDamage = slot(plan.damage)
        const sHealing = slot(plan.healing)

        if (plan.healing?.caidos && sHealing.candidatos.length === 0) {
            return { success: false, message: "No hay aliados caídos a los que devolver la vida." }
        }

        if ((sDamage.elegir || sHealing.elegir) && !targetIds) {
            if (session) {
                session._accionPendiente = { tipo: "spell", spellId: hechizo._id };
            }
            return {
                success: true,
                requiresInteraction: true,
                message: `Selecciona los objetivos para ${hechizo.Nombre}.`,
                candidatosDamage: sDamage.elegir ? sDamage.candidatos : [],
                candidatosHealing: sHealing.elegir ? sHealing.candidatos : [],
                // Selector simple (botón "¿Suerte?" → buildTarget): un solo slot a elegir
                candidatos: sDamage.elegir ? sDamage.candidatos : sHealing.candidatos,
                hechizo
            };
        }

        const seleccion = this._leerSeleccion(session, targetIds)
        const elegidos = (s, elegidosRaw) => {
            if (!s.elegir) return s.auto
            const validos = elegidosRaw.filter(t => s.candidatos.some(c => String(c.ID) === String(t.ID)))
            return validos.length ? validos : s.candidatos.slice(0, 1)   // fallback de emergencia
        }
        const objetivosDamage = elegidos(sDamage, seleccion.damage)
        const objetivosHealing = elegidos(sHealing, seleccion.healing)

        // ── Costos ───────────────────────────────────────────────────────────
        const ofrenda = await this._cobrarOfrenda(session, caster, hechizo, evaluacion)
        if (!ofrenda.ok) return { success: false, message: ofrenda.message }
        this._cobrarCosto(hechizo, caster, evaluacion);
        session?.resolverTurnoExitoso?.(caster.ID);

        const castId = nuevoCastId(caster)
        const modoTxt = evaluacion.modo === "mental" ? " (solo con la mente)" : ""

        // ── Canalización (tiempo ≥ 2): se puede interrumpir ─────────────────
        if (evaluacion.tiempo >= 2 && session) {
            const restantes = evaluacion.tiempo - 1
            caster.activeCast = {
                spellId: hechizo._id,
                remainingTurns: restantes,
                vias: evaluacion.usadas,
                modo: evaluacion.modo,
                interruptible: hechizo.Mecanicas?.cast?.interruptible !== false,
                castId,
                ataqueId: caster.isNPC ? (caster._ataqueEnCurso ?? null) : null,
                targets: {
                    damage: objetivosDamage.map(o => o.ID),
                    healing: objetivosHealing.map(o => o.ID)
                },
                evaluacion,
                baseSpell: hechizo
            };

            // Telegrafía: sin este aviso, interrumpir deja de ser una decisión
            logSistema(session, `${caster.Nombre} está canalizando ${hechizo.Nombre}${modoTxt} (${restantes} turno(s)). ¡Un control puede cortarlo!`, { autor: caster.Nombre, hechizo: hechizo.Nombre });

            return {
                success: true,
                message: `Has comenzado a canalizar ${hechizo.Nombre}${modoTxt} (${restantes} turno(s)).`,
                caster,
                hechizo,
                resultados: []
            };
        }

        return this._resolverLanzamiento(session, caster, hechizo, evaluacion, objetivosDamage, objetivosHealing, castId)
    }

    /**
     * Confusión: el hechizo sale, pero puede ir al objetivo equivocado (aliado, uno mismo u otro
     * enemigo). En hechizos de área puede invertir el bando con la misma probabilidad.
     */
    _aplicarDesvio(session, caster, hechizo, pDesvio, objetivosDamage, objetivosHealing) {
        const out = { objetivosDamage, objetivosHealing, invertido: false, texto: null }
        if (!session || !(pDesvio > 0)) return out
        const plan = this._planObjetivos(hechizo)
        const esArea = [plan.damage, plan.healing].some(p => p && p.alcance === "todos" && p.objetivo !== "mismo" && p.objetivo !== "global")

        if (esArea) {
            if (Math.random() < pDesvio) {
                out.invertido = true
                if (plan.damage?.alcance === "todos") out.objetivosDamage = this._objetivosArea(session, caster, plan.damage.objetivo, true)
                if (plan.healing?.alcance === "todos") out.objetivosHealing = this._objetivosArea(session, caster, plan.healing.objetivo, true)
                out.texto = `¡La confusión nubla a ${caster.Nombre}! ${hechizo.Nombre} se vuelve contra el bando equivocado.`
            }
            return out
        }

        const vivos = session.getAllCombatientes().filter(c => !c.defeated)
        const desviar = (lista) => lista.map(t => {
            if (Math.random() >= pDesvio) return t
            const otros = vivos.filter(c => c.ID !== t.ID)
            if (!otros.length) return t
            const nuevo = otros[Math.floor(Math.random() * otros.length)]
            out.texto = `¡La confusión nubla a ${caster.Nombre}! ${hechizo.Nombre} se desvía hacia ${nuevo.Nombre}.`
            return nuevo
        })
        if (plan.damage && plan.damage.objetivo !== "mismo" && plan.damage.alcance !== "todos") out.objetivosDamage = desviar(objetivosDamage)
        if (plan.healing && plan.healing.objetivo !== "mismo" && plan.healing.alcance !== "todos" && !plan.healing.caidos) out.objetivosHealing = desviar(objetivosHealing)
        return out
    }

    /** Tira la probabilidad final, aplica el desvío y resuelve el hechizo. */
    _resolverLanzamiento(session, caster, hechizo, evaluacion, objetivosDamage, objetivosHealing, castId) {
        if (Math.random() > evaluacion.pFinal) {
            // El hechizo falla: maná ya gastado, pero el lanzamiento se interrumpió
            session?.addLog("objeto", {
                autor: caster.Nombre,
                item: { Nombre: hechizo.Nombre, Tipo: "hechizo", tipo: 'hechizo' },
                efectos: [],
                objetivos: [],
                textoLog: `${caster.Nombre} intentó lanzar ${hechizo.Nombre}, pero el conjuro falló.`
            });
            return {
                success: true,
                spellFailed: true,
                message: `El lanzamiento de ${hechizo.Nombre} falló. El mana fue consumido.`,
                caster,
                hechizo
            };
        }

        const desvio = this._aplicarDesvio(session, caster, hechizo, evaluacion.pDesvio, objetivosDamage, objetivosHealing)
        if (desvio.texto) logSistema(session, desvio.texto, { autor: caster.Nombre, hechizo: hechizo.Nombre })

        const todosObjetivos = [...new Set([...desvio.objetivosDamage, ...desvio.objetivosHealing])];
        const efectosAplicados = this._aplicarEfectosHechizoInstante(session, caster, hechizo, desvio.objetivosDamage, desvio.objetivosHealing, { castId, invertido: desvio.invertido });

        session?.addLog("objeto", {
            autor: caster.Nombre,
            autorId: caster.ID,
            item: { Nombre: hechizo.Nombre, Tipo: "hechizo", tipo: 'hechizo', _id: hechizo._id },
            efectos: efectosAplicados,
            objetivos: todosObjetivos.map(t => t.Nombre),
            objetivosDetalle: todosObjetivos.map(t => ({ ID: t.ID, Nombre: t.Nombre }))
        });

        // Maestría: solo cuenta un casteo resuelto (no fallido ni interrumpido)
        registrarUso(caster, hechizo._id, session)
        this._verificarYRegistrarDerrotas(session, caster);

        return {
            success: true,
            tipo: 'spell',
            caster,
            hechizo,
            modo: evaluacion.modo,
            resultados: [],
            gameOver: session ? session.combateTerminado() : false
        };
    }

    /** Objetivos de un efecto concreto según su `objetivo` y `alcance`. */
    _objetivosEfecto(session, caster, efecto, objetivosDamage, objetivosHealing, invertido) {
        const { objetivo, alcance } = efecto
        if (objetivo === "mismo") return [caster]
        if (alcance === "todos") return this._objetivosArea(session, caster, objetivo, invertido)
        if (objetivo === "enemigos") return objetivosDamage
        if (objetivo === "aliados") return objetivosHealing.length ? objetivosHealing : [caster]
        return [...new Set([...objetivosDamage, ...objetivosHealing])]
    }

    /** Objetivos de una cadena: el elegido y hasta dos enemigos más (100% / 70% / 50%). */
    _cadena(session, caster, primarios) {
        const primero = primarios[0]
        if (!primero || !session) return primarios
        const bando = this._bandos(session, caster)
        const lado = bando.enemigos.some(e => e.ID === primero.ID) ? bando.enemigos : bando.aliados
        const resto = lado.filter(c => !c.defeated && c.ID !== primero.ID).sort(() => Math.random() - 0.5)
        return [primero, ...resto].slice(0, CADENA.FACTORES.length)
    }

    _aplicarEfectosHechizoInstante(session, caster, hechizoRaw, objetivosDamage, objetivosHealing, ctx = {}) {
        const hechizo = normalizarHechizo(hechizoRaw)
        const efectosAplicados = [];
        const mecanicas = hechizo.Mecanicas || {};
        const castId = ctx.castId

        const esquivaron = new Set();
        if (hechizo.evadible === true && session) {
            const todosObjetivos = [...new Set([...objetivosDamage, ...objetivosHealing])];
            for (const target of todosObjetivos) {
                if (target.ID === caster.ID) continue
                if (Math.random() < this._chanceEsquive(caster, target)) {
                    esquivaron.add(target.ID);
                    session.addLog("esquive", { defensor: target.Nombre, atacante: caster.Nombre });
                }
            }
        }

        if (mecanicas.damage) {
            const cadena = mecanicas.damage.alcance === "cadena"
            const lista = cadena ? this._cadena(session, caster, objetivosDamage) : objetivosDamage
            lista.forEach((target, i) => {
                if (esquivaron.has(target.ID)) return;
                const factor = cadena ? (CADENA.FACTORES[i] ?? CADENA.FACTORES[CADENA.FACTORES.length - 1]) : undefined
                const dmgRes = this._aplicarDaño({ ...mecanicas.damage, factor, yaEsquivado: true }, caster, target, hechizo, session, { castId });
                if (dmgRes.inmune) {
                    efectosAplicados.push({ tipo: 'custom', clausula: 'resistido el golpe (Estasis)', objetivos: [target.Nombre], targetId: target.ID });
                    return;
                }
                efectosAplicados.push({
                    tipo: 'danio',
                    valor: dmgRes.cantidad,
                    stat: 'HP',
                    objetivos: [target.Nombre],
                    targetId: target.ID
                });
            });
        }

        if (mecanicas.healing) {
            const targets = objetivosHealing.length > 0 ? objetivosHealing : [caster];
            for (const target of targets) {
                if (esquivaron.has(target.ID) && target.ID !== caster.ID) continue;
                if (target.defeated) continue;
                const healRes = this._aplicarCuracion(mecanicas.healing, caster, target, hechizo);
                efectosAplicados.push({
                    tipo: 'curacion',
                    valor: healRes.cantidad,
                    stat: 'HP',
                    objetivos: [target.Nombre],
                    targetId: target.ID
                });
            }
        }

        for (const efecto of (mecanicas.Efectos || [])) {
            const targets = this._objetivosEfecto(session, caster, efecto, objetivosDamage, objetivosHealing, ctx.invertido)
            for (const target of targets) {
                if (esquivaron.has(target.ID)) continue;

                if (efecto.tipo === "instantaneo") {
                    const entrada = this._efectoInstantaneoAntiguo(session, caster, target, hechizo, efecto)
                    if (entrada) efectosAplicados.push(entrada)
                    continue
                }
                if (efecto.tipo === "legacy") {
                    // Estado sin mecánica conocida (lo pintan la UI y las condiciones de NPC)
                    if (target.defeated || tieneInmunidad(target, "todo")) continue
                    if (Math.random() > (efecto.probabilidad ?? 1)) continue
                    if (esInmune(target, efecto.clave) || esInmune(target, efecto.nombre)) continue
                    agregarEstado(target, { id: efecto.clave, Nombre: efecto.nombre, nombre: efecto.nombre, base: efecto.base, duracion: efecto.duracion, fuente: caster.ID })
                    efectosAplicados.push({ tipo: "estado", Nombre: efecto.nombre, duracion: efecto.duracion, objetivos: [target.Nombre], targetId: target.ID })
                    continue
                }

                const r = aplicarEfecto({
                    sesion: session, caster, target,
                    efecto: { ...efecto, hechizoId: hechizo._id },
                    ctx: { castId, hechizo, esInmune, revertir: revertirModStat },
                })
                if (r.log) efectosAplicados.push(r.log)
            }
        }

        return efectosAplicados;
    }

    /** Efecto instantáneo del formato antiguo (curación / daño / stat inmediato). */
    _efectoInstantaneoAntiguo(session, caster, target, hechizo, efecto) {
        const key = efecto.clave
        let valorAplicado = Number(efecto.base) || 0;
        if (key === 'curacion' || key === 'heal' || key === 'healing') {
            valorAplicado = this._aplicarCuracion({ base: valorAplicado }, caster, target, hechizo).cantidad;
        } else if (key === 'daño' || key === 'dano' || key === 'damage') {
            valorAplicado = this._aplicarDaño({ base: valorAplicado, esFisico: false }, caster, target, hechizo, session).cantidad;
        } else {
            const statName = efecto.stat || 'HP';
            if (statName === 'HP') {
                const hpPrev = target.HP;
                target.aplicarCuracion ? target.aplicarCuracion(valorAplicado, true) : (target.HP = Math.min(target.stats?.hpMax || 99999, target.HP + valorAplicado));
                valorAplicado = target.HP - hpPrev;
            } else if (statName === 'Mana') {
                const manaPrev = target.Mana;
                target.Mana = Math.min(target.stats?.manaMax || 99999, target.Mana + valorAplicado);
                valorAplicado = target.Mana - manaPrev;
            } else {
                return null;   // un stat sin duración no se puede deshacer: se ignora
            }
        }
        return {
            tipo: key === 'daño' || key === 'dano' ? 'danio' : key,
            valor: valorAplicado,
            stat: efecto.stat || 'HP',
            objetivos: [target.Nombre],
            targetId: target.ID
        };
    }

    async elegirHechizoAleatorio(session, caster) {
        const ids = (caster.hechizos || []).map(h => h?.ID ?? h)
        if (ids.length === 0) {
            return { success: false, message: "No tienes hechizos disponibles." };
        }

        const allSpells = await cacheHechizos.obtenerVarios(ids);
        const validSpells = [];

        for (const spell of allSpells) {
            const check = await this.checkSpellRequirements(caster, spell, session);
            if (check.success) {
                validSpells.push(spell);
            }
        }

        if (validSpells.length === 0) {
            return { success: false, message: "No cumples con los requisitos para lanzar ningún hechizo actualmente." };
        }

        const spell = validSpells[Math.floor(Math.random() * validSpells.length)];
        return await this.resolverHechizo(session, caster, spell._id, null);
    }

    /**
     * Turno de un combatiente que está canalizando: si alguna vía del cast quedó bloqueada se
     * interrumpe; si no, avanza y al llegar a 0 resuelve el hechizo.
     */
    _processActiveCastTick(session, caster) {
        const ac = caster.activeCast
        if (!ac) return;
        const spell = ac.baseSpell;

        const activos = efectosActivos(caster)
        const bloq = viasBloqueadas(activos)
        const bloqueadas = (ac.vias || []).filter(v => bloq.has(v))
        if (bloqueadas.length && ac.interruptible !== false) {
            interrumpirCast(session, caster, quienBloquea(activos, bloqueadas))
            return;
        }

        ac.remainingTurns--;
        if (ac.remainingTurns > 0) {
            logSistema(session, `${caster.Nombre} está canalizando ${spell.Nombre} (${ac.remainingTurns} turno(s) restante(s)).`, { autor: caster.Nombre, hechizo: spell.Nombre });
            return;
        }

        delete caster.activeCast;
        const targetsData = ac.targets || {};
        const plan = this._planObjetivos(spell)
        const vivos = (ids, permitirCaidos = false) => (ids || []).map(id => session.getCombatiente(id)).filter(c => c && (permitirCaidos || !c.defeated))
        let objetivosDamage = vivos(targetsData.damage)
        const objetivosHealing = vivos(targetsData.healing, plan.healing?.caidos)
        // Si el objetivo de daño cayó mientras canalizaba, la descarga va a otro enemigo vivo
        if (!objetivosDamage.length && plan.damage && plan.damage.objetivo !== "mismo") {
            objetivosDamage = plan.damage.alcance === "todos"
                ? this._objetivosArea(session, caster, plan.damage.objetivo)
                : this._obtenerCandidatos(session, caster, plan.damage.objetivo).slice(0, 1)
        }

        // La degradación se vuelve a leer al resolver (Miedo / Confusión pueden haber cambiado)
        const reevaluada = evaluarCasteo(caster, spell, { ignorarCostos: true, ignorarKit: true })
        const evaluacion = reevaluada.ok ? { ...ac.evaluacion, pFinal: reevaluada.pFinal, pDesvio: reevaluada.pDesvio } : ac.evaluacion
        this._resolverLanzamiento(session, caster, spell, evaluacion, objetivosDamage, objetivosHealing, ac.castId)
    }

    /** ¿El NPC puede usar ahora este ataque? (vías, kit, cooldown y costos vía evaluarCasteo) */
    npcPuedeUsar(npc, ataque) {
        if (!ataque) return false
        const generico = ataque.isGeneric || ataque.id === "basic_attack" || ataque.id === "basic_punch"
        if (generico) return evaluarCasteo(npc, ACCIONES.GOLPE).ok
        if (ataque.id === "basic_defense") return evaluarCasteo(npc, ACCIONES.GUARDIA).ok
        const ref = ataque.hechizoId ? cacheHechizos.obtenerSync(ataque.hechizoId) : null
        const hechizo = ref || {
            _id: `inline_${ataque.id}`,
            Elemento: npc.elemento,
            Mecanicas: { cast: { vias: ataque.vias || ["movimiento"], tiempo: ataque.cast?.tiempo ?? 1, probabilidad: 1, interruptible: ataque.cast?.interruptible !== false } },
            Costos: { mana: Number(ataque.manaCost || 0) },
        }
        return evaluarCasteo(npc, hechizo).ok
    }
}

module.exports = new TurnProcessor()
module.exports.usaInstinto = usaInstinto
module.exports.BALANCE = BALANCE
