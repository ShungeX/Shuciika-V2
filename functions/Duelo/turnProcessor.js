const clientdb = require("../../Server")
const db2 = clientdb.db("Rol_db")
const hechizos = db2.collection("Hechizos_globales")
const dbobjetos = db2.collection("Objetos_globales")
const characters = db2.collection("Personajes")
const updateInventario = require("../updateInventario")
const { asciiText, buildActionMessage } = require("../../utils/utilidadesTexto")
const InterfazCreate = require("./combateUI")

const PRECISION_MINIMA_BASE = 10;
const TECHO_ESQUIVE = 0.85;
const PISO_ESQUIVE = 0.05;


function romanToInt(roman) {
    if (!roman) return 0;
    if (typeof roman === 'number') return roman;
    const map = { 'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000 };
    let total = 0;
    let prev = 0;
    const str = String(roman).toLowerCase().trim();
    for (let i = str.length - 1; i >= 0; i--) {
        const current = map[str[i]] || 0;
        if (current < prev) {
            total -= current;
        } else {
            total += current;
        }
        prev = current;
    }
    return total;
}

const CONFUSION_REDUCTIONS = {
    I: 0.15,
    II: 0.30,
    III: 0.50,
};

function getConfusionReduction(caster) {
    if (!caster.statusEffect) return 0;
    const confusion = caster.statusEffect.find(e => {
        const id = String(e.id || e.Nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return id.includes("confusion");
    });
    if (!confusion) return 0;
    
    let grade = confusion.grado;
    if (!grade) {
        const name = String(confusion.id || confusion.Nombre || "").toUpperCase();
        if (name.includes("III") || name.endsWith("3")) grade = "III";
        else if (name.includes("II") || name.endsWith("2")) grade = "II";
        else grade = "I";
    } else {
        if (grade === 1) grade = "I";
        else if (grade === 2) grade = "II";
        else if (grade === 3) grade = "III";
    }
    
    return CONFUSION_REDUCTIONS[grade] || CONFUSION_REDUCTIONS.I;
}

function verificarCancelacionCast(caster, hechizo) {
    if (!caster.statusEffect || caster.statusEffect.length === 0) {
        return { cancelled: false };
    }
    
    const spellType = String(hechizo.Tipo || "").toLowerCase();
    
    const hasStunOrEstasis = caster.statusEffect.some(e => {
        const id = String(e.id || e.Nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const type = String(e.type || "").toLowerCase();
        return id.includes("stun") || id.includes("aturd") || id.includes("estasis") || id.includes("paral") || id.includes("sleep") || id.includes("sueno") ||
               type.includes("stun") || type.includes("aturd") || type.includes("estasis");
    });
    
    if (hasStunOrEstasis) {
        return { cancelled: true, reason: "Incapacitado (Aturdimiento/Estasis)" };
    }
    
    if (spellType !== 'mental') {
        const hasImmovable = caster.statusEffect.some(e => {
            const id = String(e.id || e.Nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return id.includes("inmovil") || id.includes("atado") || id.includes("enredado") || id.includes("root") || id.includes("freeze") || id.includes("congel");
        });
        if (hasImmovable) {
            return { cancelled: true, reason: "Inmovilizado" };
        }
    }
    
    return { cancelled: false };
}

function obtenerEfectoIncapacitante(combatiente) {
    if (!combatiente.statusEffect || combatiente.statusEffect.length === 0) return null;
    
    const incapacitante = combatiente.statusEffect.find(e => {
        const id = String(e.id || e.Nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const type = String(e.type || "").toLowerCase();
        const name = String(e.Nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return id.includes("stun") || id.includes("aturd") || id.includes("estasis") || id.includes("paral") || 
               id.includes("sleep") || id.includes("sueno") || id.includes("congel") || id.includes("freeze") ||
               type.includes("stun") || type.includes("aturd") || type.includes("estasis") || type.includes("congel") ||
               name.includes("stun") || name.includes("aturd") || name.includes("estasis") || name.includes("paral") || 
               name.includes("sueno") || name.includes("congel");
    });
    return incapacitante ? { Nombre: (incapacitante.Nombre || incapacitante.id), duracion: incapacitante.duracion } : null;
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
    Pyros: { fuerteContra: ["Rakau", "Kryo", "Wind"], debilContra: ["Aqua", "Lapis"] },
    Aqua: { fuerteContra: ["Pyros", "Lapis"], debilContra: ["Electro", "Rakau", "Kryo"] },
    Lapis: { fuerteContra: ["Electro", "Kryo"], debilContra: ["Aqua", "Wind", "Electro"] },
    Rakau: { fuerteContra: ["Aqua", "Lapis"], debilContra: ["Pyros", "Kryo", "Electro"] },
    Electro: { fuerteContra: ["Aqua", "Rakau"], debilContra: ["Lapis", "Wind"] },
    Kryo: { fuerteContra: ["Pyros", "Lapis"], debilContra: ["Pyros", "Lapis"] }, // relación especial
    Wind: { fuerteContra: [], debilContra: ["Kryo", "Pyros"] },
    Lux: { fuerteContra: [], debilContra: [] },
    Neutro: { fuerteContra: [], debilContra: [] }
}

const BONUS_ELEMENTAL = 1.35
const PENALTY_ELEMENTAL = 0.70

class TurnProcessor {

    // ─── Utilidades ──────────────────────────────────────────────────────────

    /**
     * Calcula el multiplicador elemental entre atacante y defensor
     * Respeta el caso especial Kryo-Pyros-Lapis
     */
    _getMultiplicadorElemental(elementoAtacante, elementoDefensor) {
        // Triángulo especial — se maneja en CombatUI, aquí es neutro
const esTriangulo =
            (elementoAtacante === "Kryo" && (elementoDefensor === "Pyros" || elementoDefensor === "Lapis")) ||
            (elementoAtacante === "Pyros" && elementoDefensor === "Kryo") ||
            (elementoAtacante === "Lapis" && elementoDefensor === "Kryo")

        if (esTriangulo) return { multi: 1, tipo: "triangulo" }

        const tabla = TABLA_ELEMENTAL[elementoAtacante] || TABLA_ELEMENTAL["Neutro"]

        if (tabla.fuerteContra.includes(elementoDefensor)) return { multi: BONUS_ELEMENTAL, tipo: "ventaja" }
        if (tabla.debilContra.includes(elementoDefensor)) return { multi: PENALTY_ELEMENTAL, tipo: "desventaja" }

        return { multi: 1, tipo: "neutro" }
    }

    /**
     * Calcula el valor de un efecto con scaling de stats
     * (Reciclado del código anterior)
     */
    _calculateAmount(mecanica, caster, multiplicador = 1) {
        if (mecanica.base !== undefined && Number(mecanica.base) === 0) return 0;
        let amount = mecanica.base

        if (mecanica.scaling) {
            const statVal = caster.stats[mecanica.scaling.stats] || 0
            amount += (statVal * mecanica.scaling.multi) * multiplicador
        }
        return Math.max(0, Math.floor(amount))
    }

    /**
     * Genera el ataque básico dinámicamente según el arma equipada
     * (Reciclado y adaptado del código anterior)
     */
    _generarAtaqueBasico(atacante) {
        const arma = atacante.equipamiento?.find(i => i.tipo === "arma")
        const baseAleatoria = Math.floor(Math.random() * 6) + 2 // 2-8
        const lvl = atacante.isNPC 
            ? (atacante.nivelMagico ?? atacante.stats?.nivelMagico ?? 1) 
            : (atacante.StelarFragmentsTotal ?? atacante.StelarFragments ?? atacante.sendero?.StelarFragmentsTotal ?? atacante.nivelMagico ?? 1);

        return {
            _id: "basic_attack",
            Nombre: "Ataque básico",
            Tipo: 0,
            Elemento: atacante.elemento || atacante.Elemento || "Neutro",
            Costos: { Mana: 0, Vida: 0, Cooldown: 0 },
            Mecanicas: {
                damage: {
                    base: baseAleatoria,
                    scaling: {
                        stats: "fuerza",
                        multi: 1 + (lvl * 0.2)
                    },
                    objetivo: 1,
                    esFisico: true
                },
                Efectos: {},
                castProbabilidad: 1 // ataque básico nunca falla
            }
        }
    }

    // ─── Verificaciones pre-acción ────────────────────────────────────────────

    /**
     * Verifica si el combatiente puede usar el hechizo
     */
    _verificarCosto(hechizo, caster) {
        if (caster.Mana < hechizo.Costos.mana) {
            return { success: false, message: "No tienes suficiente maná para lanzar este hechizo ＞﹏＜" }
        }
        if ((caster.HP - 1) <= hechizo.Costos.Vida) {
            return { success: false, message: "No tienes suficiente vida para lanzar este hechizo ＞﹏＜" }
        }
        if (caster.cooldowns?.[hechizo._id] > 0) {
            return { success: false, message: `Este hechizo está en enfriamiento (${caster.cooldowns[hechizo._id]} ronda/s restante/s)` }
        }
        return { success: true }
    }

    /**
     * Cobra el costo del hechizo al caster
     */
    _cobrarCosto(hechizo, caster) {
        caster.Mana -= hechizo.Costos.mana
        caster.HP -= hechizo.Costos.Vida

        if (hechizo.Costos.Cooldown > 0) {
            caster.cooldowns ??= {}
            caster.cooldowns[hechizo._id] = hechizo.Costos.Cooldown
        }
    }

    // ─── Resolución de objetivos ──────────────────────────────────────────────

    /**
     * Resuelve los objetivos según el código de objetivo del hechizo
     * objetivo: 1=enemigo, 2=aliado, 3=self, 4=todos, 5=todos enemigos, 6=todos aliados
     */
    _resolverObjetivos(codigoObjetivo, caster, targetId, battleState) {
        const { aliados, enemigos } = battleState

        switch (codigoObjetivo) {
            case 1: // Enemigo seleccionado o primero disponible
                if (targetId) return enemigos.filter(e => e.ID === targetId && !e.defeated)
                return enemigos.filter(e => !e.defeated).slice(0, 1)
            case 2: // Aliado seleccionado
                if (targetId) return aliados.filter(a => a.ID === targetId && !a.defeated)
                return aliados.filter(a => a.ID !== caster.ID && !a.defeated).slice(0, 1)
            case 3: // Self
                return [caster]
            case 4: // Todos
                return [...aliados, ...enemigos].filter(c => !c.defeated)
            case 5: // Todos los enemigos
                return enemigos.filter(e => !e.defeated)
            case 6: // Todos los aliados
                return aliados.filter(a => !a.defeated)
            default:
                return []
        }
    }

    // ─── Aplicación de efectos ────────────────────────────────────────────────

    /**
     * Aplica daño a un objetivo
     */
    _aplicarDaño(mecanica, caster, target, hechizo, session) {
        // Fallback para esquive si no fue precalculado
        const esEvadible = (hechizo._id === "basic_attack" || hechizo.evadible === true);
        if (esEvadible && session && !mecanica.yaEsquivado) {
            const agilidadDefensor = target.effectiveAgilidad;
            const precisionMod = caster.effectivePrecision;
            const basePrecision = (caster.stats?.precision !== undefined) ? caster.stats.precision : 100;
            const precisionEfectivaAtacante = Math.max(PRECISION_MINIMA_BASE, basePrecision * (1 + precisionMod / 100));

            const esquive = agilidadDefensor / (agilidadDefensor + precisionEfectivaAtacante);
            const chanceEsquive = Math.max(PISO_ESQUIVE, Math.min(TECHO_ESQUIVE, esquive));

            if (Math.random() < chanceEsquive) {
                session.addLog("esquive", { defensor: target.Nombre, atacante: caster.Nombre });
                return { cantidad: 0, esCritico: false, tipoElemental: "Neutro", esquivado: true };
            }
        }

        const { multi: multiElemental, tipo: tipoElemental } =
            this._getMultiplicadorElemental(hechizo.Elemento, target.elemento)

        if (mecanica.base !== undefined && Number(mecanica.base) === 0) {
            return { cantidad: 0, esCritico: false, tipoElemental };
        }

        let cantidad = this._calculateAmount(mecanica, caster, multiElemental)
        if (cantidad === 0) {
            return { cantidad: 0, esCritico: false, tipoElemental };
        }

        // Crítico: (sabiduria*2 + agilidad*2) / 100
        const chanceCritico = ((caster.stats.sabiduria * 2) + (caster.stats.agilidad * 2)) / 100
        const esCritico = Math.random() < chanceCritico
        if (esCritico) cantidad = Math.floor(cantidad * 1.5)

        // Reducción por resistencia
        const resFis = target.stats?.resFisica ?? target.stats?.resistenciaFisica ?? 0;
        const resMag = target.stats?.resMagica ?? target.stats?.resistenciaMagica ?? 0;
        const lvlMag = target.isNPC 
            ? (target.nivelMagico ?? target.stats?.nivelMagico ?? 1) 
            : (target.StelarFragmentsTotal ?? target.StelarFragments ?? target.sendero?.StelarFragmentsTotal ?? target.nivelMagico ?? 1);

        if (mecanica.esFisico) {
            const defensa = (1 + (target.defenseActual || 0)) *
                ((resFis * 0.6) + (lvlMag * 0.35));
            cantidad = Math.max(1, Math.round(cantidad - defensa));
            target.defenseActual = 0;
        } else {
            const resM = resMag * 0.8;
            cantidad = Math.max(1, Math.round(cantidad - resM));
        }
        if (isNaN(cantidad)) {
            console.error("Cantidad de daño es NaN", { cantidad, mecanica, caster, target, hechizo })
            return { cantidad: 0, esCritico, tipoElemental }
        }
        target.aplicarDaño(cantidad)
        caster.damageDealt = (caster.damageDealt || 0) + cantidad
        // El log de "derrota" se registrará cronológicamente después del log del ataque en _verificarYRegistrarDerrotas

        return { cantidad, esCritico, tipoElemental }
    }

    _verificarYRegistrarDerrotas(session, caster) {
        if (!session) return;
        for (const c of session.getAllCombatientes()) {
            if (c.HP <= 0 && c.defeated && !c._alreadyLoggedDefeat) {
                c._alreadyLoggedDefeat = true;
                session.addLog("derrota", { derrotados: [c.Nombre], derrotado: c.Nombre });
                session.emit('jugadorDerrotado', { victima: c, atacante: caster });
            }
        }
    }

    /**
     * Aplica curación a un objetivo
     */
    _aplicarCuracion(mecanica, caster, target, hechizo, esAccionInstantanea = true) {
        const { multi: multiElemental } =
            this._getMultiplicadorElemental(hechizo.Elemento, target.elemento)

        // Curación usa sintonía en lugar de fuerza
        let cantidad = Math.floor(
            mecanica.base + ((caster?.stats?.sintonia || 1)  * 1.4 * multiElemental)
        )

        if(isNaN(cantidad)) {
            console.error("Algun valor de curación es NaN", { cantidad, mecanica, caster, target, hechizo })
            cantidad = 0
        }
        
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

        console.log("Cantidad de curación aplicada:", cantidad)

        return { cantidad }
    }

    /**
     * Agrega efectos de estado al combatiente objetivo de forma inmediata.
     * También los registra en pendingEffects para daño/curación demorados.
     */
    _agregarEfectoPendiente(session, efectoDatos, key, target, caster) {
        const probabilidad = efectoDatos.probabilidad ?? 1
        if (Math.random() > probabilidad) return false // no procede

        const effectPayload = {
            id: key,
            nombre: efectoDatos.Nombre || key,
            Nombre: efectoDatos.Nombre || key,
            base: typeof efectoDatos.base === 'object'
                ? { ...efectoDatos.base }
                : Math.round(efectoDatos.base + ((caster?.stats?.poderElemental || 1) * 2)),
            duracion: efectoDatos.duracion,
            objetivo: target.ID,
            fuente: caster.ID,
            instancia: 1
        };

        // Registrar en pendingEffects (para daño/curación/estado demorados al cerrar ronda)
        const existente = session.pendingEffects.find(
            e => e.id === key && e.objetivo === target.ID
        )
        if (existente) {
            existente.instancia = (existente.instancia || 1) + 1
        } else {
            session.pendingEffects.push({ ...effectPayload })
        }

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

        // Bloquear acciones si el combatiente está incapacitado
        const incapacitante = obtenerEfectoIncapacitante(caster);
        if (incapacitante) {
            return { success: false, message: `No puedes actuar, estás afectado por: ${incapacitante.Nombre} (${incapacitante.duracion} turno(s) restante(s)).` }
        }

        const esEquipo1 = session.teams[0].some(c => c.ID === caster.ID)
        const battleState = {
            aliados: esEquipo1 ? session.teams[0] : session.teams[1],
            enemigos: esEquipo1 ? session.teams[1] : session.teams[0]
        }

        if (session && typeof session.resolverTurnoExitoso === 'function') {
            session.resolverTurnoExitoso(caster.ID);
        }

        try {
            switch (accion.tipo) {

                // ── Ataque básico ─────────────────────────────────────────
                case 'attack': {
                    const hechizo = this._generarAtaqueBasico(caster)
                    const targets = this._resolverObjetivos(1, caster, accion.targetId, battleState)

                    if (targets.length === 0) return { success: false, message: "No hay objetivos válidos" }

                    const esquivaron = new Set();
                    if (session) {
                        for (const target of targets) {
                            const agilidadDefensor = target.effectiveAgilidad;
                            const precisionMod = caster.effectivePrecision;
                            const basePrecision = (caster.stats?.precision !== undefined) ? caster.stats.precision : 100;
                            const precisionEfectivaAtacante = Math.max(PRECISION_MINIMA_BASE, basePrecision * (1 + precisionMod / 100));

                            const esquive = agilidadDefensor / (agilidadDefensor + precisionEfectivaAtacante);
                            const chanceEsquive = Math.max(PISO_ESQUIVE, Math.min(TECHO_ESQUIVE, esquive));

                            if (Math.random() < chanceEsquive) {
                                esquivaron.add(target.ID);
                                session.addLog("esquive", { defensor: target.Nombre, atacante: caster.Nombre });
                            }
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

                    if (resultados.every(r => r.esquivado)) {
                        // Todos esquivaron, no registramos el log de ataque estándar
                    } else {
                        session.addLog("ataque", {
                            atacante: caster.Nombre,
                            defensor: targets.filter(t => !esquivaron.has(t.ID)).map(t => t.Nombre).join(", "),
                            daño: resultados.find(r => !r.esquivado)?.cantidad || 0
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

                // ── Defender ──────────────────────────────────────────────
                case 'defend': {
                    const bonus = Math.floor(Math.random() * 5) + 2 // 2-6
                    caster.defenseActual = (caster.defenseActual || 0) + bonus
                    session.addLog("defender", { defensor: caster.Nombre, defensaObtenida: bonus })

                    return {
                        success: true,
                        tipo: 'defender',
                        caster,
                        bonus
                    }
                }

                // ── Rendirse ──────────────────────────────────────────────
                case 'surrender': {
                    caster.defeated = true
                    caster.surrender = true
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

    /**
     * Avanza el compás tras una acción:
     * recalcula valorCompas del caster y aplica el decay
     */
    // ─── Helpers internos para advanceCompas ──────────────────────────────────

    /**
     * Aplica efectos periódicos y decrementa duraciones del combatiente que acaba de actuar,
     * luego lo marca como actuado en este subturno.
     */
    _procesarFinDeAccion(session, caster) {
        if (caster && !caster.defeated) {
            caster.statusEffect ??= [];

            caster.statusEffect.forEach(eff => {
                const id = String(eff.id || eff.Nombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (id === 'veneno' || id === 'quemadura' || id === 'damage' || id === 'danio') {
                    const dmg = Number(eff.base || 0);
                    if (dmg > 0) {
                        caster.aplicarDaño(dmg);
                        session.addLog("efecto_periodico", {
                            personaje: caster.Nombre,
                            valor: dmg,
                            efecto: eff.Nombre || eff.id,
                            isDmg: true
                        });
                        if (caster.defeated && !caster._alreadyLoggedDefeat) {
                            caster._alreadyLoggedDefeat = true;
                            session.addLog("derrota", { derrotado: caster.Nombre });
                            session.emit('jugadorDerrotado', { victima: caster, atacante: session.getCombatiente(eff.fuente) || caster });
                        }
                    }
                } else if (id === 'curacion' || id === 'heal' || id === 'healing' || id === 'pasive') {
                    const heal = Number(eff.base || 0);
                    if (heal > 0) {
                        const hpPrev = caster.HP;
                        caster.HP = Math.min(caster.stats?.hpMax || 99999, caster.HP + heal);
                        session.addLog("efecto_periodico", {
                            personaje: caster.Nombre,
                            valor: caster.HP - hpPrev,
                            efecto: eff.Nombre || eff.id,
                            isDmg: false
                        });
                    }
                }
            });

            for (let i = caster.statusEffect.length - 1; i >= 0; i--) {
                caster.statusEffect[i].duracion--;
                if (caster.statusEffect[i].duracion <= 0) caster.statusEffect.splice(i, 1);
            }
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

    // advanceCompas — iterativo, no recursivo
    async advanceCompas(session, caster) {
        console.log("=== advanceCompas START ===")
        if (caster) {
            console.log("Caster:", caster.Nombre)
            this._procesarFinDeAccion(session, caster);
        } else {
            console.log("Caster: null (inicio de combate / avance automático)")
        }

        // ── 2. Loop principal: seguir procesando mientras el siguiente actor sea NPC ──
        while (true) {
            // a) ¿Hay game over?
            const gameOver = session.checkGameOver();
            if (gameOver.gameOver) {
                return { rondaCerrada: false, gameOver: true, winners: gameOver.winners, arrayWinner: gameOver.arrayWinner };
            }

            const todosActivos = session.getAllCombatientes().filter(c => !c.defeated);
            const todosActuaron = todosActivos.every(c => session.actuaronEsteSubturno.has(c.ID));

            if (todosActuaron) {
                // b) Todos actuaron → avanzar ronda completa
                const cerrRonda = this._avanzarRondaCompleta(session);

                if (cerrRonda) {
                    // Ronda cerrada
                    const go2 = session.checkGameOver();
                    if (go2.gameOver) return { rondaCerrada: true, gameOver: true, winners: go2.winners, arrayWinner: go2.arrayWinner };
                    session.cerrarRonda();
                    session.calcularPrimerTurno();
                } else {
                    session.calcularPrimerTurno();
                    const go2 = session.checkGameOver();
                    if (go2.gameOver) return { rondaCerrada: true, gameOver: true, winners: go2.winners, arrayWinner: go2.arrayWinner };
                }

                // c) Quién actúa ahora
                const nextActor = session.getCurrentActor();
                if (!nextActor) {
                    session.emit('actualizarUI');
                    return { rondaCerrada: cerrRonda };
                }

                // Incapacitado → procesar y continuar el while
                const incap = obtenerEfectoIncapacitante(nextActor);
                if (incap) {
                    session.addLog("objeto", {
                        autor: nextActor.Nombre,
                        item: { Nombre: "Incapacitado", Tipo: "efecto", tipo: 'efecto' },
                        efectos: [], objetivos: [],
                        textoLog: `${nextActor.Nombre} no puede actuar en este turno debido a: ${incap.Nombre} (${incap.duracion} turno(s) restante(s)).`
                    });
                    this._procesarFinDeAccion(session, nextActor);
                    continue;
                }

                // ActiveCast → procesar y continuar
                if (nextActor.activeCast) {
                    this._processActiveCastTick(session, nextActor);
                    this._procesarFinDeAccion(session, nextActor);
                    continue;
                }

                if (nextActor.isNPC) {
                    // NPC: ejecutar turno con 2-3s de cooldown, emitir UI y continuar el while
                    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 1000) + 2000));
                    const NpcAi = require("./npcAi");
                    await NpcAi.executeTurn(session, nextActor);
                    session.emit('actualizarUI');
                    this._procesarFinDeAccion(session, nextActor);
                    continue;
                }

                // Jugador humano → detener y esperar su interacción
                session.emit('actualizarUI');
                const clientBot = require("../../bot");
                if (typeof session.iniciarWatchdogTurno === 'function') {
                    session.iniciarWatchdogTurno(clientBot);
                }
                return { rondaCerrada: cerrRonda, proximosEnActuar: session.turnoQueue };

            } else {
                // d) Subturno en curso: avanzar bolas de los pendientes
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

                console.log("turnoQueue resultante:", session.turnoQueue.map(c => c.Nombre));
                console.log("=== advanceCompas END ===");

                const nextActor = session.getCurrentActor();
                if (!nextActor) {
                    session.emit('actualizarUI');
                    return { rondaCerrada: false, proximosEnActuar: session.turnoQueue };
                }

                // Incapacitado
                const incap = obtenerEfectoIncapacitante(nextActor);
                if (incap) {
                    session.addLog("objeto", {
                        autor: nextActor.Nombre,
                        item: { Nombre: "Incapacitado", Tipo: "efecto", tipo: 'efecto' },
                        efectos: [], objetivos: [],
                        textoLog: `${nextActor.Nombre} no puede actuar en este turno debido a: ${incap.Nombre} (${incap.duracion} turno(s) restante(s)).`
                    });
                    this._procesarFinDeAccion(session, nextActor);
                    continue;
                }

                // ActiveCast
                if (nextActor.activeCast) {
                    this._processActiveCastTick(session, nextActor);
                    this._procesarFinDeAccion(session, nextActor);
                    continue;
                }

                if (nextActor.isNPC) {
                    // Emitir UI inmediatamente para que el usuario humano vea el resultado de su acción sin esperar el delay del NPC
                    session.emit('actualizarUI');

                    // NPC: ejecutar turno con 2-3s de cooldown, emitir UI y continuar el while
                    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 1000) + 2000));
                    const NpcAi = require("./npcAi");
                    await NpcAi.executeTurn(session, nextActor);
                    session.emit('actualizarUI');
                    this._procesarFinDeAccion(session, nextActor);
                    continue;
                }

                // Jugador humano → parar
                session.emit('actualizarUI');
                const clientBot = require("../../bot");
                if (typeof session.iniciarWatchdogTurno === 'function') {
                    session.iniciarWatchdogTurno(clientBot);
                }
                return { rondaCerrada: false, proximosEnActuar: session.turnoQueue };
            }
        }
    }
    tickCooldowns(session) {
        session.getAllCombatientes().forEach(c => {
            // Solo cooldowns de hechizos — las duraciones de statusEffect
            // se decrementan en advanceCompas cuando el combatiente actúa.
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
                    c.stats.manaMax,
                    c.Mana + 2
                )
            }
        })
    }

    async resolverObjetos(session, caster, itemData, targetIds = null) {
        // Bloquear si el caster está incapacitado
        const incapacitante = obtenerEfectoIncapacitante(caster);
        if (incapacitante) {
            return { success: false, message: `No puedes actuar, estás afectado por: ${incapacitante.Nombre} (${incapacitante.duracion} turno(s) restante(s)).` };
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
        const userFE = Number(
            soulDoc.sendero?.StelarFragmentsTotal 
            ?? soulDoc.fragmentos?.StelarFragmentsTotal 
            ?? soulDoc.sendero?.StelarFragments 
            ?? soulDoc.fragmentos?.StelarFragments 
            ?? soulDoc.StelarFragments 
            ?? caster.StelarFragmentsTotal 
            ?? caster.StelarFragments 
            ?? 0
        );
        const userResplandorStr = soulDoc.sendero?.resplandor ?? soulDoc.resplandor ?? 'I';
        const userResplandor = romanToInt(userResplandorStr);

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
        const efectosAplicadosMap = new Map();

        // Paso 5 — Aplicar efectos:
        for (const target of objetivos) {
            for (const efecto of (objetoExist.efectos || [])) {
                if (efecto.condicion !== null && efecto.condicion !== undefined) {
                    let conditionMet = true;
                    try {
                        if (typeof efecto.condicion === 'string') {
                            const evalFunc = new Function('caster', 'target', `return ${efecto.condicion}`);
                            conditionMet = evalFunc(caster, target);
                        }
                    } catch (e) {
                        console.error("Error al evaluar condición del efecto:", e);
                        conditionMet = false;
                    }
                    if (!conditionMet) continue;
                }

                let valorAplicado = efecto.valor;

                if (efecto.duracion !== null && efecto.duracion !== undefined) {
                    if (session) {
                        this._agregarEfectoPendiente(session, {
                            Nombre: objetoExist.Nombre,
                            base: efecto.valor,
                            duracion: efecto.duracion,
                            probabilidad: 1
                        }, `${objetoExist.ID}_${efecto.tipo}`, target, caster);
                    } else {
                        target.statusEffect ??= [];
                        target.statusEffect.push({
                            id: `${objetoExist.ID}_${efecto.tipo}`,
                            nombre: objetoExist.Nombre,
                            base: efecto.valor,
                            duracion: efecto.duracion,
                            objetivo: target.ID,
                            fuente: caster.ID
                        });
                    }
                } else {
                    const tipoLower = String(efecto.tipo || '').toLowerCase();
                    const statLower = String(efecto.stat || '').toLowerCase();

                    if (tipoLower === 'curacion' || tipoLower === 'heal' || tipoLower === 'hp' || statLower === 'hp' || (tipoLower === 'regeneracion' && statLower === 'hp')) {
                        const hpPrev = target.HP;
                        const maxHp = target.stats?.hpMax || target.stats?.maxHp || target.hpMax || 99999;
                        target.HP = Math.min(maxHp, target.HP + Number(efecto.valor || 0));
                        valorAplicado = target.HP - hpPrev;
                    } else if (tipoLower === 'daño' || tipoLower === 'damage') {
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
                    } else if (target.stats) {
                        const statName = efecto.stat || 'HP';
                        const valPrev = target.stats[statName] || 0;
                        target.stats[statName] = (target.stats[statName] || 0) + Number(efecto.valor || 0);
                        valorAplicado = target.stats[statName] - valPrev;
                    }
                }

                const key = `${efecto.tipo}_${efecto.stat || ''}`;
                if (!efectosAplicadosMap.has(key)) {
                    efectosAplicadosMap.set(key, { ...efecto, valor: valorAplicado });
                }
            }
        }

        const efectosAplicados = Array.from(efectosAplicadosMap.values());

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

        // Paso 7 — Consumir:
        if (objetoExist.uso?.consumible === true) {
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

    async checkSpellRequirements(caster, hechizo, session) {
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
        
        // 2. Cooldown
        if (caster.cooldowns?.[hechizo._id] > 0) {
            return { success: false, message: `Este hechizo está en enfriamiento (${caster.cooldowns[hechizo._id]} ronda/s restante/s).` };
        }
        
        // 3. Costos
        const manaCost = Number(hechizo.Costos?.mana ?? 0);
        const vidaCost = Number(hechizo.Costos?.Vida ?? hechizo.Costos?.vida ?? 0);
        if (caster.Mana < manaCost) {
            return { success: false, message: `No tienes suficiente maná (Costo: ${manaCost} PM).` };
        }
        if ((caster.HP - 1) <= vidaCost) {
            return { success: false, message: `No tienes suficiente HP (Costo: ${vidaCost} HP).` };
        }
        
        // 4. Req
        if (hechizo.Req) {
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
            
            const userFE = Number(
                soulDoc.sendero?.StelarFragmentsTotal 
                ?? soulDoc.fragmentos?.StelarFragmentsTotal 
                ?? soulDoc.sendero?.StelarFragments 
                ?? soulDoc.fragmentos?.StelarFragments 
                ?? soulDoc.StelarFragments 
                ?? caster.StelarFragmentsTotal 
                ?? caster.StelarFragments 
                ?? 0
            );
            const userResplandorStr = soulDoc.sendero?.resplandor ?? soulDoc.resplandor ?? 'I';
            const userResplandor = romanToInt(userResplandorStr);
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
        
        return { success: true };
    }

    async resolverHechizo(session, caster, hechizoId, targetIds = null) {
        // Bloquear si el caster está incapacitado
        const incapacitante = obtenerEfectoIncapacitante(caster);
        if (incapacitante) {
            return { success: false, message: `No puedes actuar, estás afectado por: ${incapacitante.Nombre} (${incapacitante.duracion} turno(s) restante(s)).` };
        }

        let hechizo;
        if (typeof hechizoId === 'object' && hechizoId !== null) {
            hechizo = hechizoId;
        } else {
            hechizo = await hechizos.findOne({ _id: hechizoId });
        }
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

        // Obtener candidatos para daño y curación por separado
        // 'mismo' / 'todos' → automático, sin selección
        // 'global' → pool combinado aliados+enemigos, el usuario elige
        // 'aliados' / 'enemigos' → pool del bando correspondiente, el usuario elige
        let candidatosDamage = [];
        let needsDamageTarget = false;
        if (hechizo.Mecanicas?.damage) {
            const tgt = normalizarObjetivo(hechizo.Mecanicas.damage.objetivo || "enemigos");
            if (tgt !== "mismo" && tgt !== "todos") {
                // 'global' devuelve aliados+enemigos, 'aliados'/'enemigos' solo su bando
                candidatosDamage = this._obtenerCandidatos(session, caster, tgt);
                needsDamageTarget = candidatosDamage.length > 0;
            }
        }

        let candidatosHealing = [];
        let needsHealingTarget = false;
        if (hechizo.Mecanicas?.healing) {
            const tgt = normalizarObjetivo(hechizo.Mecanicas.healing.objetivo || "aliados");
            if (tgt !== "mismo" && tgt !== "todos") {
                candidatosHealing = this._obtenerCandidatos(session, caster, tgt);
                needsHealingTarget = candidatosHealing.length > 0;
            }
        }

        // Si se requiere interacción (selección de objetivos) y no se han provisto targetIds
        if ((needsDamageTarget || needsHealingTarget) && !targetIds) {
            if (session) {
                session._accionPendiente = { tipo: "spell", spellId: hechizo._id };
            }
            return {
                success: true,
                requiresInteraction: true,
                message: `Selecciona los objetivos para ${hechizo.Nombre}.`,
                candidatosDamage,
                candidatosHealing,
                hechizo
            };
        }

        // Resolver objetivos reales
        let objetivosDamage = [];
        let objetivosHealing = [];

        if (targetIds) {
            if (typeof targetIds === 'object' && !Array.isArray(targetIds)) {
                if (targetIds.damage) {
                    objetivosDamage = targetIds.damage.map(id => session.getCombatiente(id)).filter(Boolean);
                }
                if (targetIds.healing) {
                    objetivosHealing = targetIds.healing.map(id => session.getCombatiente(id)).filter(Boolean);
                }
            } else if (Array.isArray(targetIds)) {
                const resolved = targetIds.map(id => session.getCombatiente(id)).filter(Boolean);
                objetivosDamage = resolved;
                objetivosHealing = resolved;
            } else {
                // Preservar IDs de NPC como string; solo convertir si es un número válido
                const _scalarNum = Number(targetIds);
                const _scalarId = isNaN(_scalarNum) ? targetIds : _scalarNum;
                const resolved = [session.getCombatiente(_scalarId)].filter(Boolean);
                objetivosDamage = resolved;
                objetivosHealing = resolved;
            }
        }

        // Fallbacks para objetivos automáticos (mismo/todos)
        // 'global', 'aliados', 'enemigos' → ya resueltos por selección del usuario
        if (hechizo.Mecanicas?.damage) {
            const tgt = normalizarObjetivo(hechizo.Mecanicas.damage.objetivo || "enemigos");
            if (tgt === "mismo") {
                objetivosDamage = [caster];
            } else if (tgt === "todos") {
                objetivosDamage = session.getAllCombatientes().filter(c => !c.defeated);
            } else if (objetivosDamage.length === 0 && candidatosDamage.length > 0) {
                // Fallback de emergencia si el usuario no seleccionó nada
                objetivosDamage = candidatosDamage.slice(0, 1);
            }
        }

        if (hechizo.Mecanicas?.healing) {
            const tgt = normalizarObjetivo(hechizo.Mecanicas.healing.objetivo || "aliados");
            if (tgt === "mismo") {
                objetivosHealing = [caster];
            } else if (tgt === "todos") {
                objetivosHealing = session.getAllCombatientes().filter(c => !c.defeated);
            } else if (objetivosHealing.length === 0 && candidatosHealing.length > 0) {
                // Fallback de emergencia si el usuario no seleccionó nada
                objetivosHealing = candidatosHealing.slice(0, 1);
            }
        }

        this._cobrarCosto(hechizo, caster);

        const castTime = hechizo.Mecanicas?.cast?.tiempo ?? 1;

        if (castTime > 1 && session) {
            caster.activeCast = {
                spellId: hechizo._id,
                remainingTurns: castTime,
                targets: {
                    damage: objetivosDamage.map(o => o.ID),
                    healing: objetivosHealing.map(o => o.ID)
                },
                baseSpell: hechizo
            };

            session.addLog("objeto", {
                autor: caster.Nombre,
                item: { Nombre: hechizo.Nombre, Tipo: hechizo.Tipo },
                efectos: [],
                objetivos: [],
                textoLog: `${caster.Nombre} ha comenzado a canalizar ${hechizo.Nombre} (${castTime} turnos).`
            });

            return {
                success: true,
                message: `Has comenzado a canalizar ${hechizo.Nombre} (${castTime} turnos).`,
                caster,
                hechizo,
                resultados: []
            };
        } else {
            // Verificar probabilidad de lanzamiento (confusión, etc.)
            const confusionRed = getConfusionReduction(caster);
            const baseProb = hechizo.Mecanicas?.cast?.probabilidad ?? 1.0;
            const precisionMod = caster.effectivePrecision; // Furia precision mod
            const finalProb = Math.max(0, Math.min(1, baseProb * (1 + precisionMod / 100) - confusionRed));

            if (Math.random() > finalProb) {
                // El hechizo falla: mana ya gastado, objetivos ya elegidos, pero el lanzamiento se interrumpió
                session?.addLog("objeto", {
                    autor: caster.Nombre,
                    item: { Nombre: hechizo.Nombre, Tipo: hechizo.Tipo, tipo: 'hechizo' },
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

            // Aplicar efectos instantáneamente
            const todosObjetivos = [...new Set([...objetivosDamage, ...objetivosHealing])];
            const efectosAplicados = this._aplicarEfectosHechizoInstante(session, caster, hechizo, objetivosDamage, objetivosHealing);

            session?.addLog("objeto", {
                autor: caster.Nombre,
                autorId: caster.ID,
                item: { Nombre: hechizo.Nombre, Tipo: hechizo.Tipo, tipo: 'hechizo' },
                efectos: efectosAplicados,
                objetivos: todosObjetivos.map(t => t.Nombre),
                objetivosDetalle: todosObjetivos.map(t => ({ ID: t.ID, Nombre: t.Nombre }))
            });

            this._verificarYRegistrarDerrotas(session, caster);

            return {
                success: true,
                tipo: 'spell',
                caster,
                hechizo,
                resultados: [],
                gameOver: session ? session.combateTerminado() : false
            };
        }
    }

    _obtenerCandidatos(session, caster, tipoObjetivo) {
        if (!session) return [];
        if (tipoObjetivo === "mismo") return [caster];
        if (tipoObjetivo === "todos") return session.getAllCombatientes().filter(c => !c.defeated);

        const esEquipo1 = session.teams[0].some(c => c.ID === caster.ID);
        const aliados = esEquipo1 ? session.teams[0] : session.teams[1];
        const enemigos = esEquipo1 ? session.teams[1] : session.teams[0];

        if (tipoObjetivo === "aliados") {
            return aliados.filter(a => a.ID !== caster.ID && !a.defeated);
        } else if (tipoObjetivo === "enemigos") {
            return enemigos.filter(e => !e.defeated);
        } else if (tipoObjetivo === "global") {
            return [...aliados, ...enemigos].filter(c => !c.defeated);
        }
        return [];
    }

    _aplicarEfectosHechizoInstante(session, caster, hechizo, objetivosDamage, objetivosHealing) {
        const efectosAplicados = [];
        const mecanicas = hechizo.Mecanicas || {};

        const esquivaron = new Set();
        const esEvadible = (hechizo.evadible === true);

        if (esEvadible && session) {
            const todosObjetivos = [...new Set([...objetivosDamage, ...objetivosHealing])];
            for (const target of todosObjetivos) {
                const agilidadDefensor = target.effectiveAgilidad;
                const precisionMod = caster.effectivePrecision;
                const basePrecision = (caster.stats?.precision !== undefined) ? caster.stats.precision : 100;
                const precisionEfectivaAtacante = Math.max(PRECISION_MINIMA_BASE, basePrecision * (1 + precisionMod / 100));

                const esquive = agilidadDefensor / (agilidadDefensor + precisionEfectivaAtacante);
                const chanceEsquive = Math.max(PISO_ESQUIVE, Math.min(TECHO_ESQUIVE, esquive));

                if (Math.random() < chanceEsquive) {
                    esquivaron.add(target.ID);
                    session.addLog("esquive", { defensor: target.Nombre, atacante: caster.Nombre });
                }
            }
        }

        if (mecanicas.damage) {
            const targets = objetivosDamage.length > 0 ? objetivosDamage : [];
            for (const target of targets) {
                if (esquivaron.has(target.ID)) continue;
                const dmgRes = this._aplicarDaño({ ...mecanicas.damage, yaEsquivado: true }, caster, target, hechizo, session);
                efectosAplicados.push({
                    tipo: 'danio',
                    valor: dmgRes.cantidad,
                    stat: 'HP',
                    objetivos: [target.Nombre],
                    targetId: target.ID
                });
            }
        }

        if (mecanicas.healing) {
            const targets = objetivosHealing.length > 0 ? objetivosHealing : [caster];
            for (const target of targets) {
                if (esquivaron.has(target.ID) && target.ID !== caster.ID) continue;
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

        if (mecanicas.Efectos) {
            for (const [key, efectoDatos] of Object.entries(mecanicas.Efectos)) {
                const targetType = normalizarObjetivo(efectoDatos.objetivo || "enemigos");
                let targets;
                if (targetType === "mismo") {
                    targets = [caster];
                } else if (targetType === "todos") {
                    targets = session ? session.getAllCombatientes().filter(c => !c.defeated) : [caster];
                } else if (targetType === "enemigos") {
                    targets = objetivosDamage;
                } else if (targetType === "aliados") {
                    // Si no hay aliados resueltos (ej: 1v1), aplicar al lanzador (mismo comportamiento que healing)
                    targets = objetivosHealing.length > 0 ? objetivosHealing : [caster];
                } else {
                    targets = [caster];
                }

                for (const target of targets) {
                    if (esquivaron.has(target.ID)) continue;
                    if (efectoDatos.duracion !== null && efectoDatos.duracion !== undefined && efectoDatos.duracion > 0) {
                        const procedio = this._agregarEfectoPendiente(session, efectoDatos, key, target, caster);
                        if (procedio) {
                            efectosAplicados.push({
                                tipo: key === 'daño' ? 'danio' : key,
                                Nombre: efectoDatos.Nombre || key,  // nombre display del efecto (ej: 'Aturdimiento')
                                valor: efectoDatos.base || 0,
                                duracion: efectoDatos.duracion,
                                objetivos: [target.Nombre],          // quién queda afectado
                                targetId: target.ID
                            });
                        }
                    } else {
                        let valorAplicado = efectoDatos.base || 0;
                        if (key === 'curacion' || key === 'heal' || key === 'healing') {
                            const res = this._aplicarCuracion({ base: valorAplicado }, caster, target, hechizo);
                            valorAplicado = res.cantidad;
                        } else if (key === 'daño' || key === 'damage') {
                            const res = this._aplicarDaño({ base: valorAplicado, esFisico: false }, caster, target, hechizo, session);
                            valorAplicado = res.cantidad;
                        } else {
                            const statName = efectoDatos.stat || 'HP';
                            if (statName === 'HP') {
                                const hpPrev = target.HP;
                                target.HP = Math.min(target.stats?.hpMax || 99999, target.HP + valorAplicado);
                                valorAplicado = target.HP - hpPrev;
                            } else if (statName === 'Mana') {
                                const manaPrev = target.Mana;
                                target.Mana = Math.min(target.stats?.manaMax || 99999, target.Mana + valorAplicado);
                                valorAplicado = target.Mana - manaPrev;
                            } else if (target.stats) {
                                const valPrev = target.stats[statName] || 0;
                                target.stats[statName] = (target.stats[statName] || 0) + valorAplicado;
                                valorAplicado = target.stats[statName] - valPrev;
                            }
                        }
                        efectosAplicados.push({
                            tipo: key === 'daño' ? 'danio' : key,
                            valor: valorAplicado,
                            stat: efectoDatos.stat || 'HP',
                            objetivos: [target.Nombre],
                            targetId: target.ID
                        });
                    }
                }
            }
        }

        return efectosAplicados;
    }

    async elegirHechizoAleatorio(session, caster) {
        if (!caster.hechizos || caster.hechizos.length === 0) {
            return { success: false, message: "No tienes hechizos disponibles." };
        }

        const allSpells = await hechizos.find({ _id: { $in: caster.hechizos } }).toArray();
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

    _processActiveCastTick(session, caster) {
        if (!caster.activeCast) return;
        
        const isCancelled = verificarCancelacionCast(caster, caster.activeCast.baseSpell);
        if (isCancelled.cancelled) {
            session.addLog("objeto", {
                autor: caster.Nombre,
                item: { Nombre: caster.activeCast.baseSpell.Nombre, Tipo: caster.activeCast.baseSpell.Tipo },
                efectos: [],
                objetivos: [],
                textoLog: `${caster.Nombre} ha interrumpido la canalización de ${caster.activeCast.baseSpell.Nombre} (${isCancelled.reason}).`
            });
            delete caster.activeCast;
        } else {
            caster.activeCast.remainingTurns--;
            
            const confusionRed = getConfusionReduction(caster);
            if (confusionRed > 0 && Math.random() < confusionRed) {
                session.addLog("objeto", {
                    autor: caster.Nombre,
                    item: { Nombre: caster.activeCast.baseSpell.Nombre, Tipo: caster.activeCast.baseSpell.Tipo },
                    efectos: [],
                    objetivos: [],
                    textoLog: `${caster.Nombre} se confunde y falla la canalización de ${caster.activeCast.baseSpell.Nombre}.`
                });
                delete caster.activeCast;
                return;
            }
            
            if (caster.activeCast.remainingTurns === 0) {
                const spell = caster.activeCast.baseSpell;
                const targetsData = caster.activeCast.targets || {};
                
                // Mapear targets de IDs a combatientes reales
                const objetivosDamage = (targetsData.damage || []).map(id => session.getCombatiente(id)).filter(Boolean);
                const objetivosHealing = (targetsData.healing || []).map(id => session.getCombatiente(id)).filter(Boolean);
                const todosObjetivos = [...new Set([...objetivosDamage, ...objetivosHealing])];

                const efectosAplicados = this._aplicarEfectosHechizoInstante(session, caster, spell, objetivosDamage, objetivosHealing);
                
                session.addLog("objeto", {
                    autor: caster.Nombre,
                    autorId: caster.ID,
                    item: { Nombre: spell.Nombre, Tipo: spell.Tipo, tipo: 'hechizo' },
                    efectos: efectosAplicados,
                    objetivos: todosObjetivos.map(t => t.Nombre),
                    objetivosDetalle: todosObjetivos.map(t => ({ ID: t.ID, Nombre: t.Nombre }))
                });
                
                delete caster.activeCast;
            } else {
                session.addLog("objeto", {
                    autor: caster.Nombre,
                    item: { Nombre: caster.activeCast.baseSpell.Nombre, Tipo: caster.activeCast.baseSpell.Tipo },
                    efectos: [],
                    objetivos: [],
                    textoLog: `${caster.Nombre} está canalizando ${caster.activeCast.baseSpell.Nombre} (${caster.activeCast.remainingTurns} turno(s) restante(s)).`
                });
            }
        }
    }

    _aplicarEfectosHechizo(session, caster, hechizo, objetivos, alFinalizarRonda = false) {
        const mecanicas = hechizo.Mecanicas || {};
        
        if (mecanicas.damage) {
            if (!alFinalizarRonda) {
                for (const target of objetivos) {
                    this._aplicarDaño(mecanicas.damage, caster, target, hechizo, session);
                }
            } else {
                for (const target of objetivos) {
                    this._agregarEfectoPendiente(session, {
                        Nombre: hechizo.Nombre,
                        base: mecanicas.damage.base,
                        duracion: null,
                        probabilidad: 1
                    }, `${hechizo._id}_damage`, target, caster);
                }
            }
        }
        
        if (mecanicas.healing) {
            for (const target of objetivos) {
                this._agregarEfectoPendiente(session, {
                    Nombre: hechizo.Nombre,
                    base: mecanicas.healing.base,
                    duracion: null,
                    probabilidad: 1
                }, `${hechizo._id}_healing`, target, caster);
            }
        }
        
        if (mecanicas.Efectos) {
            for (const [key, efectoDatos] of Object.entries(mecanicas.Efectos)) {
                for (const target of objetivos) {
                    this._agregarEfectoPendiente(session, efectoDatos, key, target, caster);
                }
            }
        }
    }
}

module.exports = new TurnProcessor()