const { getConfusionReduction, obtenerEfectoIncapacitante } = require("./turnProcessor");

class NpcAi {
    /**
     * Executes the NPC's AI turn.
     * Evaluates phase transitions, behavior rules, and executes the selected action.
     * @param {object} session - sesionesCombate instance
     * @param {object} npc - NPC combatant instance
     */
    static async executeTurn(session, npc) {
        if (npc.defeated) return;

        console.log(`\n==================================================`);
        console.log(`[CONSOLA - NPC IA] 🤖 ¡TURNO DE NPC! -> "${npc.Nombre}" (ID: ${npc.ID}, HP: ${npc.HP}/${npc.stats?.hpMax ?? npc.HP})`);
        console.log(`==================================================`);

        // 1. Evaluate Boss Phase transitions
        this.evaluatePhaseTransitions(session, npc);

        // 2. Select action based on behavior rules
        let actionExecuted = false;
        const sortedRules = [...(npc.comportamiento || [])].sort((a, b) => a.prioridad - b.prioridad);
        
        // Group rules by priority
        const ruleGroups = {};
        sortedRules.forEach(rule => {
            ruleGroups[rule.prioridad] = ruleGroups[rule.prioridad] || [];
            ruleGroups[rule.prioridad].push(rule);
        });

        const sortedPriorities = Object.keys(ruleGroups).map(Number).sort((a, b) => a - b);

        for (const priority of sortedPriorities) {
            const rulesInGroup = ruleGroups[priority];
            // Filter rules whose conditions are met
            const matchingRules = rulesInGroup.filter(rule => this.checkConditions(rule.condiciones, rule.operador, npc, session));

            if (matchingRules.length > 0) {
                let selectedRule;
                if (matchingRules.length === 1) {
                    selectedRule = matchingRules[0];
                } else {
                    // Weighted random draw
                    selectedRule = this.weightedDraw(matchingRules, 'peso');
                }

                if (selectedRule) {
                    console.log(`[CONSOLA - NPC IA] 📜 ${npc.Nombre} activó regla de comportamiento (Prioridad: ${priority})`);
                    await this.executeActions(selectedRule.acciones, npc, session);
                    actionExecuted = true;
                    break;
                }
            }
        }

        // 3. Fallback: weighted draw of attacks available in current phase
        if (!actionExecuted) {
            console.log(`[CONSOLA - NPC IA] 🎯 ${npc.Nombre} seleccionando ataque aleatorio de la fase actual (${npc.fase})...`);
            const availableAttacks = (npc.ataques || []).filter(attack => {
                const phases = attack.fases || [1];
                return phases.includes(npc.fase);
            });

            if (npc.permiteAtaqueBasico !== false && availableAttacks.length === 0) {
                availableAttacks.push({
                    id: "basic_attack",
                    name: "Ataque General",
                    isGeneric: true,
                    probabilidad: 50,
                    fases: [1, 2, 3, 4]
                });
            }

            if (availableAttacks.length > 0) {
                const selectedAttack = this.weightedDraw(availableAttacks, 'probabilidad');
                await this.executeAttack(selectedAttack, npc, session);
            } else {
                console.log(`[CONSOLA - NPC IA] ⚠️ ${npc.Nombre} no tiene ataques en fase ${npc.fase}. Usando ataque básico de reserva.`);
                const targetObjs = this.resolveTargets("enemigos", "random", 1, npc, session);
                const targetId = targetObjs[0]?.ID || null;
                await TurnProcessor.resolveAction(session, npc.ID, { tipo: 'attack', targetId });
            }
        }

        console.log(`[CONSOLA - NPC IA] ✅ "${npc.Nombre}" FINALIZÓ SU TURNO EXITOSAMENTE`);
        console.log(`==================================================\n`);
    }

    /**
     * Checks if boss phase transition conditions are met and performs transition.
     */
    static evaluatePhaseTransitions(session, npc) {
        if (!npc.boss || !npc.boss.fases || npc.boss.fases.length === 0) return;

        const currentPhaseIndex = npc.fase - 1;
        // Check subsequent phases in order
        for (let i = npc.fase; i < npc.boss.fases.length; i++) {
            const nextPhase = npc.boss.fases[i];
            if (!nextPhase) continue;

            const shouldTransition = this.checkConditions(nextPhase.condiciones, nextPhase.operador || "AND", npc, session);
            if (shouldTransition) {
                const oldPhase = npc.fase;
                npc.fase = i + 1;

                session.addLog("objeto", {
                    autor: npc.Nombre,
                    item: { Nombre: `Fase ${npc.fase}`, Tipo: "Transición", tipo: "fase" },
                    efectos: [],
                    objetivos: [],
                    textoLog: `¡${npc.Nombre} ha entrado en la Fase ${npc.fase}: ${nextPhase.nombre || "Fase Nueva"}! Su poder aumenta drásticamente.`
                });

                // Apply stat bonuses once upon transition
                npc.fasesCompletadas = npc.fasesCompletadas || [];
                if (!npc.fasesCompletadas.includes(npc.fase)) {
                    npc.fasesCompletadas.push(npc.fase);
                    if (nextPhase.bonusStats) {
                        for (const [stat, bonus] of Object.entries(nextPhase.bonusStats)) {
                            if (npc.stats && npc.stats[stat] !== undefined) {
                                npc.stats[stat] = (npc.stats[stat] || 0) + Number(bonus);
                            }
                        }
                    }
                }
                break; // transition to one phase per turn maximum
            }
        }
    }

    /**
     * Checks conditions list with AND/OR operator.
     */
    static checkConditions(conditions, operator, npc, session) {
        if (!conditions || conditions.length === 0) return true;

        if (operator === "OR") {
            return conditions.some(c => this.checkCondition(c, npc, session));
        } else {
            return conditions.every(c => this.checkCondition(c, npc, session));
        }
    }

    /**
     * Checks a single condition.
     */
    static checkCondition(cond, npc, session) {
        const esEquipo1 = session.teams[0].some(c => c.ID === npc.ID);
        const enemigos = esEquipo1 ? session.teams[1] : session.teams[0];
        const rivalesVivos = enemigos.filter(c => !c.defeated);

        const val = Number(cond.valor);

        switch (cond.tipo) {
            case "propio_hp_pct_menor":
                return (npc.HP / npc.stats.hpMax * 100) < val;
            case "propio_hp_pct_mayor":
                return (npc.HP / npc.stats.hpMax * 100) > val;

            case "aliado_hp_pct_menor":
            case "hp_aliado_menor":
                {
                    const esEquipo1 = session.teams[0].some(c => c.ID === npc.ID);
                    const aliados = esEquipo1 ? session.teams[0] : session.teams[1];
                    const aliadosVivos = aliados.filter(c => !c.defeated);
                    return aliadosVivos.some(a => ((a.HP / (a.stats?.hpMax || a.HP || 1)) * 100) < val);
                }
            case "aliado_hp_pct_mayor":
            case "hp_aliado_mayor":
                {
                    const esEquipo1 = session.teams[0].some(c => c.ID === npc.ID);
                    const aliados = esEquipo1 ? session.teams[0] : session.teams[1];
                    const aliadosVivos = aliados.filter(c => !c.defeated);
                    return aliadosVivos.some(a => ((a.HP / (a.stats?.hpMax || a.HP || 1)) * 100) > val);
                }

            case "objetivo_hp_pct_menor":
                return rivalesVivos.some(r => (r.HP / r.stats.hpMax * 100) < val);
            case "objetivo_hp_pct_mayor":
                return rivalesVivos.some(r => (r.HP / r.stats.hpMax * 100) > val);

            case "jugador_tiene_efecto":
                return rivalesVivos.some(r => r.statusEffect?.some(e => 
                    String(e.id || e.Nombre).toLowerCase() === String(cond.efecto).toLowerCase()
                ));

            case "turno_mayor":
                return session.ronda > val;
            case "turno_menor":
                return session.ronda < val;

            case "jugadores_vivos_mayor":
                return rivalesVivos.length > val;
            case "jugadores_vivos_menor":
                return rivalesVivos.length < val;

            case "jugador_uso_hechizo":
                return session.log.some(l => 
                    l.tipo === "objeto" && 
                    l.data.item?.tipo === "hechizo" && 
                    (String(l.data.item?.Nombre).toLowerCase() === String(cond.hechizoId).toLowerCase() || 
                     String(l.data.item?._id).toLowerCase() === String(cond.hechizoId).toLowerCase())
                );

            case "jugador_uso_objeto":
                return session.log.some(l => 
                    l.tipo === "objeto" && 
                    l.data.item?.tipo !== "hechizo" && 
                    (String(l.data.item?.Nombre).toLowerCase() === String(cond.objetoId).toLowerCase() || 
                     String(l.data.item?.ID).toLowerCase() === String(cond.objetoId).toLowerCase())
                );

            case "jugador_reputacion_mayor":
                return rivalesVivos.some(r => Number(r.reputacion || 0) > val);
            case "jugador_reputacion_menor":
                return rivalesVivos.some(r => Number(r.reputacion || 0) < val);

            case "jugador_elemento":
                return rivalesVivos.some(r => String(r.elemento || r.Elemento || "").toLowerCase() === String(cond.elemento).toLowerCase());

            case "jugador_artefacto_magico":
                return rivalesVivos.some(r => r.artefactoMagico === true);

            default:
                return false;
        }
    }

    /**
     * Executes the array of actions in order.
     */
    static async executeActions(actions, npc, session) {
        if (!actions) return;

        for (const act of actions) {
            switch (act.tipo) {
                case "usar_ataque":
                    const attack = (npc.ataques || []).find(a => String(a.id) === String(act.ataqueId));
                    if (attack) {
                        await this.executeAttack(attack, npc, session);
                    }
                    break;

                case "aplicar_efecto":
                    const targetType = act.efecto.objetivo || "enemigos";
                    const targets = this.resolveTargets(targetType, "random", 1, npc, session);
                    const TurnProcessor = require("./turnProcessor");

                    targets.forEach(target => {
                        TurnProcessor._agregarEfectoPendiente(session, {
                            Nombre: act.efecto.Nombre,
                            base: Number(act.efecto.base || 0),
                            duracion: Number(act.efecto.duracion || 1),
                            probabilidad: 1.0
                        }, act.efecto.Nombre, target, npc);

                        session.addLog("objeto", {
                            autor: npc.Nombre,
                            item: { Nombre: "Efecto AI", Tipo: "AI", tipo: "efecto" },
                            efectos: [{ tipo: act.efecto.Nombre, Nombre: act.efecto.Nombre, valor: act.efecto.base, duracion: act.efecto.duracion, objetivos: [target.Nombre] }],
                            objetivos: [target.Nombre],
                            textoLog: `${npc.Nombre} aplica el efecto ${act.efecto.Nombre} a ${target.Nombre}.`
                        });
                    });
                    break;

                case "cambiar_fase":
                    if (npc.boss && npc.boss.fases) {
                        const newFase = Number(act.fase);
                        if (newFase > 0 && newFase <= npc.boss.fases.length && newFase !== npc.fase) {
                            npc.fase = newFase;
                            const faseDoc = npc.boss.fases[newFase - 1];
                            session.addLog("objeto", {
                                autor: npc.Nombre,
                                item: { Nombre: `Fase ${npc.fase}`, Tipo: "Transición", tipo: "fase" },
                                efectos: [],
                                objetivos: [],
                                textoLog: `¡${npc.Nombre} ha cambiado forzosamente a la Fase ${npc.fase}: ${faseDoc?.nombre || "Fase Nueva"}!`
                            });

                            npc.fasesCompletadas = npc.fasesCompletadas || [];
                            if (!npc.fasesCompletadas.includes(npc.fase)) {
                                npc.fasesCompletadas.push(npc.fase);
                                if (faseDoc?.bonusStats) {
                                    for (const [stat, bonus] of Object.entries(faseDoc.bonusStats)) {
                                        if (npc.stats && npc.stats[stat] !== undefined) {
                                            npc.stats[stat] = (npc.stats[stat] || 0) + Number(bonus);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    break;

                case "recuperar_hp":
                    const hpAmount = Number(act.valor || 0);
                    const oldHp = npc.HP;
                    npc.HP = Math.min(npc.stats.hpMax, npc.HP + hpAmount);
                    session.addLog("objeto", {
                        autor: npc.Nombre,
                        item: { Nombre: "Recuperar HP", Tipo: "AI", tipo: "curacion" },
                        efectos: [],
                        objetivos: [npc.Nombre],
                        textoLog: `${npc.Nombre} recupera ${npc.HP - oldHp} HP.`
                    });
                    break;

                case "recuperar_mana":
                    const manaAmount = Number(act.valor || 0);
                    const oldMana = npc.Mana;
                    npc.Mana = Math.min(npc.stats.manaMax, npc.Mana + manaAmount);
                    session.addLog("objeto", {
                        autor: npc.Nombre,
                        item: { Nombre: "Recuperar Maná", Tipo: "AI", tipo: "curacion" },
                        efectos: [],
                        objetivos: [npc.Nombre],
                        textoLog: `${npc.Nombre} recupera ${npc.Mana - oldMana} Maná.`
                    });
                    break;
            }
        }
    }

    /**
     * Executes a single attack (reference or inline).
     */
    static async executeAttack(attack, npc, session) {
        const TurnProcessor = require("./turnProcessor");

        const targetType = attack.objetivo || "enemigos";
        const targetingType = attack.targeting || "random";
        const targetsCant = Number(attack.objetivosCant || 1);

        const targetObjs = this.resolveTargets(targetType, targetingType, targetsCant, npc, session);
        const targetIds = targetObjs.map(t => t.ID);

        const targetNames = targetObjs.map(t => `${t.Nombre} [ID: ${t.ID}, HP: ${t.HP}]`).join(", ");
        const attackName = String(attack.name || attack.Nombre || "Ataque").trim();
        const attackNameLower = attackName.toLowerCase();

        console.log(`[CONSOLA - NPC IA] ⚔️ ${npc.Nombre} EJECUTA ATAQUE: "${attackName}" | OBJETIVOS: [${targetNames || "Ninguno"}]`);

        const isGenericAttack = attack.isGeneric ||
            attack.id === "basic_attack" ||
            attack.id === "basic_punch" ||
            attackNameLower === "attack" ||
            attackNameLower === "ataque" ||
            attack.type === "attack";

        if (isGenericAttack) {
            const targetId = targetIds[0] || null;
            console.log(`[CONSOLA - NPC IA] ⚔️ ${npc.Nombre} ejecutando ataque básico general a objetivo: ${targetId}`);
            await TurnProcessor.resolveAction(session, npc.ID, { tipo: 'attack', targetId });
            return;
        }

        const isGenericDefense = attack.id === "basic_defense" ||
            attackNameLower === "defense" ||
            attackNameLower === "defensa";

        if (isGenericDefense) {
            console.log(`[CONSOLA - NPC IA] 🛡️ ${npc.Nombre} ejecutando defensa básica`);
            await TurnProcessor.resolveAction(session, npc.ID, { tipo: 'defend' });
            return;
        }

        if (Number(attack.type) === 1 && attack.hechizoId && String(attack.hechizoId).trim() !== '') {
            console.log(`NPC ${npc.Nombre} casting spell reference ${attack.hechizoId}`);
            const res = await TurnProcessor.resolverHechizo(session, npc, attack.hechizoId, targetIds);
            if (!res || !res.success) {
                console.log(`NPC ${npc.Nombre} spell reference ${attack.hechizoId} not found/failed. Using basic attack fallback.`);
                const basicAttack = TurnProcessor._generarAtaqueBasico(npc);
                await TurnProcessor.resolverHechizo(session, npc, basicAttack, targetIds);
            }
        } else {
            console.log(`NPC ${npc.Nombre} casting inline attack ${attackName}`);

            let damageObj = attack.damage;
            let healingObj = attack.healing;
            let efectosObj = attack.Efectos || attack.efectos;

            if (Array.isArray(efectosObj) && efectosObj.length > 0) {
                const formattedMap = {};
                efectosObj.forEach(ef => {
                    const key = String(ef.tipo || 'efecto').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    formattedMap[key] = {
                        base: ef.valor !== undefined ? ef.valor : (ef.base || 0),
                        duracion: ef.duracion !== undefined && ef.duracion !== null ? Number(ef.duracion) : null,
                        probabilidad: ef.probabilidad !== undefined ? Number(ef.probabilidad) : 1.0,
                        objetivo: ef.objetivo || attack.objetivo || "enemigos",
                        condicion: ef.condicion || null,
                        stat: ef.stat || null,
                        Nombre: ef.Nombre || attackName
                    };
                });
                efectosObj = formattedMap;
            }

            // Si es un ataque en línea sin mecánicas definidas, aplicar mecánica según nombre o básico
            if (!damageObj && !healingObj && (!efectosObj || Object.keys(efectosObj).length === 0)) {
                if (attackName.toLowerCase().includes("defens") || attackName.toLowerCase().includes("escudo")) {
                    npc.defenseActual = (npc.defenseActual || 0) + 5;
                    session.addLog("defender", { defensor: npc.Nombre, defensaObtenida: 5 });
                    return;
                } else {
                    damageObj = {
                        base: 10,
                        scaling: { stats: "fuerza", multi: 1.0 },
                        objetivo: targetType
                    };
                }
            }

            const inlineSpell = {
                _id: `inline_${attack.id || Math.random().toString(36).substring(7)}`,
                Nombre: attackName,
                Descripcion: attack.description || "",
                Tipo: "movimiento",
                Elemento: npc.Elemento || npc.elemento || "Neutro",
                isActive: true,  // los ataques inline de NPC siempre están activos
                Mecanicas: {
                    damage: damageObj ? {
                        base: Number(damageObj.base !== undefined ? damageObj.base : 0),
                        scaling: damageObj.scaling || { stats: "fuerza", multi: 1.0 },
                        objetivo: targetType,
                        esFisico: true
                    } : null,
                    healing: (healingObj && (healingObj.base !== undefined && Number(healingObj.base) > 0)) ? {
                        base: Number(healingObj.base),
                        scaling: healingObj.scaling || { stats: "sintonia", multi: 1.0 },
                        objetivo: targetType
                    } : null,
                    Efectos: efectosObj || null,
                    cast: attack.cast || { tiempo: 1, probabilidad: 1.0, interruptible: true }
                },
                Costos: {
                    mana: Number(attack.manaCost || 0),
                    Vida: 0,
                    Cooldown: 0
                }
            };

            await TurnProcessor.resolverHechizo(session, npc, inlineSpell, targetIds);
        }
    }

    /**
     * Resolves targets based on targeting type and quantities.
     */
    static resolveTargets(targetType, targetingType, count, npc, session) {
        const esEquipo1 = session.teams[0].some(c => c.ID === npc.ID);
        const aliados = esEquipo1 ? session.teams[0] : session.teams[1];
        const enemigos = esEquipo1 ? session.teams[1] : session.teams[0];

        let pool = [];
        if (targetType === "enemigos") {
            pool = enemigos.filter(c => !c.defeated);
        } else if (targetType === "aliados") {
            pool = aliados.filter(c => !c.defeated && c.ID !== npc.ID);
            if (pool.length === 0) pool = aliados.filter(c => !c.defeated); // Incluirse a sí mismo si no hay otros aliados vivos
        } else if (targetType === "mismo") {
            return [npc];
        } else if (targetType === "todos") {
            return session.getAllCombatientes().filter(c => !c.defeated);
        } else {
            pool = enemigos.filter(c => !c.defeated);
        }

        if (pool.length === 0) return [npc]; // fallback to self if no target

        // Sort pool based on targetingType
        let sorted = [...pool];
        switch (targetingType) {
            case "hp_menor":
                sorted.sort((a, b) => a.HP - b.HP);
                break;
            case "mas_buffs":
                sorted.sort((a, b) => (b.statusEffect || []).length - (a.statusEffect || []).length);
                break;
            case "ultimo_hechizo_item":
                const lastUser = session.lastSpellOrItemUser;
                const match = sorted.find(c => String(c.ID) === String(lastUser));
                if (match) {
                    sorted = [match, ...sorted.filter(c => c.ID !== match.ID)];
                }
                break;
            case "max_danio_acumulado":
                sorted.sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));
                break;
            case "random":
            default:
                sorted.sort(() => Math.random() - 0.5);
                break;
        }

        return sorted.slice(0, count);
    }

    /**
     * Weighted draw helper.
     */
    static weightedDraw(items, weightKey) {
        const totalWeight = items.reduce((sum, item) => sum + (Number(item[weightKey]) || 0), 0);
        if (totalWeight <= 0) {
            return items[Math.floor(Math.random() * items.length)];
        }

        let roll = Math.random() * totalWeight;
        for (const item of items) {
            const weight = Number(item[weightKey]) || 0;
            if (roll < weight) {
                return item;
            }
            roll -= weight;
        }
        return items[items.length - 1];
    }
}

module.exports = NpcAi;
