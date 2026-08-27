const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, InteractionContextType, Embed, StringSelectMenuBuilder } = require(`discord.js`)
const clientdb = require("../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const userdb = db.collection("usuarios_server")
const duelos = db2.collection("Duelos")
const objetos = db2.collection("Objetos_globales")
const hechizos = db2.collection("Hechizos_globales")
const character = db2.collection("Personajes")
const soul = db2.collection("Soul")
const version = require("../config/config")
const transaccionCache = require("../utils/cache")
const { v4: uuidv4 } = require('uuid')
const getGifs = require("./getGifs")
const util = require(`util`);
const sleep = util.promisify(setTimeout)


const { EventEmitter } = require('events');
const dialogoManager = require("./dialogoManager")
class DuelEmitter extends EventEmitter { }
const duelEmitter = new DuelEmitter();

class Duelv2 {
    constructor(equipo1, equipo2, duelType, MDChannelsMap = new Map()) {
        this.id = `${duelType | "Duel"}_${Date.now()}${Math.random().toString(36).substring(2, 7)}`;
        this.equipo1 = equipo1;
        this.equipo2 = equipo2;
        this.espectador = null // El mensaje del espectador
        this.ronda = 1;
        this.historialAcciones = [{ tipo: "inicioDuelo", data: { esJefe: duelType === "jefe" } }];
        this.finalizado = false;
        this.MDChannels = MDChannelsMap
        this.activeDMMessages = new Map()

        this.duelType = duelType;

        this.tiempoInicio = Date.now();
        this.tiempoLimite = 45000; // 45 segundos
        this.timeoutId = null;

        // Determinar el turno inicial
        this.compasMax = 1000;
        this.allCombatientes = [...equipo1, ...equipo2]
        this.allCombatientes.forEach(combatiente => {
            const agiOtros = this.allCombatientes
                .filter(c => c._id !== combatiente._id)
                .map(c => c.stats.agilidad)
                .reduce((sum, agi) => sum + agi, 0) / (this.allCombatientes.length - 1 || 1); //Agilidad promedio de los demas

            combatiente.compas = this.agiSelect(combatiente.stats.agilidad, agiOtros)
        })
        this.turnoActual = null;
        while (this.turnoActual === null) {

            this.turnoActual = this.determinarTurnoActual();

            if (this.turnoActual === null) {
                this.allCombatientes.forEach(c => {
                    if (!c.fueDerrotado() && !c.statusTurn.aturdido) {
                        c.compas += c.stats.agilidad;
                    }
                });
            }
        }

        console.log(this.turnoActual)

        this.turnoActual.compas -= this.compasMax;

        // Otras propiedades específicas del duelo
        const mirrorCaster = this.allCombatientes.find(combatiente =>
            combatiente.isNPC && // 1. ¿Es un NPC?
            combatiente.attacks && // 2. ¿Tiene la propiedad 'attacks'?
            combatiente.attacks.find(atk => atk.effects === "mirror") // 3. ¿Tiene el ataque?
        );

        if (mirrorCaster) {
            this.mirror = {
                esPosible: true,
                active: true, // La habilidad se activa al inicio del combate
                countdown: 3, // 3 turnos
                recordedActions: [],
                casterId: mirrorCaster._id // ¡Importante! Guardamos QUIÉN es el espejo
            };
        } else {
            // Si nadie tiene la habilidad, se desactiva
            this.mirror = {
                esPosible: false,
                active: false,
                countdown: 0,
                recordedActions: []
            };
        }
    }

    /**
     * Determina el turno de acuerdo a la agilidad
     * @param {Number} agiA - Agilidad del jugador A 
     * @param {Number} agiB - Agilidad del jugador B
     * @returns {Boolean} ¿Inicia jugador A?
     */
    agiSelect(agiCombatiente, agiAlls) {
        const diff = agiCombatiente - agiAlls;
        const umbralInicio = 7 // Si se supera el umbral entonces el combate inicia por el jugador de mayor agilidad

        //Diferencia entre A y B (5 puntos)
        if (diff >= umbralInicio) return Math.random() * (this.compasMax * 0.2) + (this.compasMax * 0.8);
        if (diff <= -umbralInicio) return Math.random() * (this.compasMax * 0.2) + (this.compasMax * 0.0);

        const probabilidadBase = (agiCombatiente / (agiCombatiente + agiAlls)) * 0.5 + 0.25

        if (Math.random() < probabilidadBase) {
            return Math.random() * (this.compasMax * 0.4) + (this.compasMax * 0.5); // Rango medio-alto
        } else {
            return Math.random() * (this.compasMax * 0.4) + (this.compasMax * 0.1); // Rango medio-bajo
        }

    }



    /**
     * Asigna el siguiente turno.
    */
    async nextTurn() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
        }


        //Si actuó significa que ya uso su turno, se restablece el compás
        if (this.turnoActual) {
            this.turnoActual.compas = 0
        }
        this.turnoActual = null; // Nadie tiene el turno hasta que se determine el siguiente

        while (!this.turnoActual) {
            // Cada tick de "tiempo", avanzamos el Compás de todos
            this.allCombatientes.forEach(c => {
                if (!c.estaDerrotado() && !c.statusTurn.aturdido) { // Solo si está vivo y no aturdido
                    c.compas += c.effectiveTempo; // Usa el Tempo efectivo
                }
            });

            this.turnoActual = this.determinarTurnoActual();

            if (!this.turnoActual && this.allCombatientes.every(c => c.estaDerrotado() || c.statusTurn.aturdido)) {
                this.verificarFinDeDuelo(); // Todos derrotados o incapaces de actuar
                return;
            }
        }

        this.ronda++;
        this.emit('nuevoTurno')
        this.resetTimeOut()


        const result = await this.applyStatusEffect(this.turnoActual)
        const notTurn = this.personajes.find(p => p.ID !== this.turnoActual.ID)

        const safeSend = async (player, content) => {
            if (player?.MDOrigin) {
                return player?.MDOrigin.send({ content }).then(m => setTimeout(() => m.delete(), 5000));
            } else {
                return notTurn.MDOrigin.send({ content }).then(m => setTimeout(() => m.delete(), 5000));
            }
        };


        if (result.effects.length > 0 || result.finished) {
            const text = `${result.effects.join("\n")}` +
                `\n\n${result.finished ? `\n${result.finished}` : ""}`

            await safeSend(this.turnoActual, text)

            this.historialAcciones.push(`${result.effects.join("\n-# ")}` + `${result.finished ? `\n${result.finished}` : ""}`)
        }

        this.timeoutId = setTimeout(() => this.handleTimeout(), this.tiempoLimite);


        this.tiempoInicio = Date.now()



        if (this.turnoActual.HP <= 0 && result.effects.length > 0) {
            this.historialAcciones.push(`**${this.turnoActual.Nombre} ha perdido la conciencia (sucumbio)**`)
            const message = this.turnoActual.statusEffect > 0 ? `¡${this.turnoActual.Nombre} se ha debilitado por los efectos negativos!` : `¡Has derrotado a ${this.turnoActual.Nombre} `
            await this.endDuel("hp0", notTurn)
            return {
                success: true,
                message: message,
                gameOver: true,
                messageId: this.channels
            }

        }

        await this.regenerator(this.personajes)

        const stun = this.turnoActual.statusEffect?.find(e => e.type === "stun");
        console.log("Efectos activos", this.turnoActual.statusEffect)

        if (stun) {
            const roll = Math.random();
            if (roll < stun.probabilidad) {
                const text = this.isNPC ? `-# El enemigo esta paralizado y no puede moverse...` : `💫 estás paralizado y no puedes moverte...`
                await safeSend(this.turnoActual, text)
                await safeSend(notTurn, `${this.turnoActual.Nombre} esta paralizado y no puede moverse`)

                this.turnoActual = notTurn
                return { isNextTurn: false }
            }
        }

        return { isNextTurn: true }
    }

    determinarTurnoActual() {
        const pjconturno = this.allCombatientes
            .filter(c => !c.fueDerrotado() && !c.statusTurn.aturdido) // Solo vivos y no aturdidos
            .sort((a, b) => b.compas - a.compas)[0]; // El que tiene más Compás
        if (pjconturno && pjconturno.compas >= this.compasMax) {
            return pjconturno;
        }

        return null;
    }

    /**
     * Inicia el tiempo limite de los turnos
     * @returns 
     */
    async handleTimeout() {

        try {
            if (this.finalizado) {
                clearTimeout(this.timeoutId)
                console.warn("⚠️ Timeout ejecutado para duelo ya inexistente:", this.id)
                return;
            }

            this.inactiveCount = (this.inactiveCount || 0) + 1


            const inactivePlayer = this.personajes.find(p => p.ID === this.turnoActual.ID)

            if (this.inactiveCount >= 4) {
                console.log("Terminando duelo por AFK")
                this.historialAcciones.push(`**El duelo ha sido cancelado por inactividad**`)
                await this.endDuel("afk", inactivePlayer, 2)
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId)
                }




                return { success: true, message: "Game Over por AFK", timeOut: true }

            }

            this.historialAcciones.push(`${inactivePlayer.Nombre} perdio su turno por no responder`)
            await this.nextTurn();
            await this.selectEmbed()

            if (this.isNPC && this.turnoActual.ID === this.personajes[1].ID) {
                const results = await this.ejecutarAccionesNPC()

                const result = results.duel


                if (result.finalizado) {
                    const messagesContent = [
                        `¡El piso tiembla! ${result.ganador.Nombre} dejó enterrado a ${result.defeated.Nombre} en escombros`,
                        `¡DUELO LEGENDARIO! ${result.ganador.Nombre} y ${result.defeated.Nombre} chocaron como titanes, pero solo uno pudo alzarse a la victoria (${result.ganador.Nombre})`,
                        `¡Historia en cada hechizo! Luego de ${(result.ronda - 1)} turnos, ${result.ganador.Nombre} se alza con el triunfo`,
                        `¿Eso fue un duelo o un tutorial? ${result.ganador.Nombre} gano en ${result.ronda} turnos. ¡Los espectadores bostezaron!`,
                    ]

                    const messageSelect = messagesContent[Math.floor(Math.random() * messagesContent.length)]

                    const endEmbed = new EmbedBuilder()
                        .setTitle("¡El duelo ha finalizado!")
                        .setDescription(`${messageSelect}`)
                        .addFields(
                            { name: result.ganador.Nombre, value: "`HP:`" + ` ${this.barradeVida(result.ganador.HP, result.ganador.stats.hpMax)}`, inline: true },
                            { name: result.defeated.Nombre, value: "`HP:`" + ` ${this.barradeVida(result.defeated.HP, result.defeated.stats.hpMax)}`, inline: true }
                        )
                        .setThumbnail(result.ganador.avatarURL)
                        .setFooter({ text: `Este duelo finalizo en el turno ${(result.ronda - 1)}` })
                    if (result.historialAcciones.length > 0) {
                        const ultimasAcciones = result.historialAcciones.slice(-3).reverse();
                        const historialTexto = ultimasAcciones.map(accion => `• ${accion}`).join('\n');
                        endEmbed.addFields({ name: 'Últimas acciones', value: historialTexto, inline: false });
                    }

                    result.channels.edit({ embeds: [endEmbed] })
                } else {
                    await this.selectEmbed()
                }
            }

            return { success: true, messages: "Tiempo agotado", timeOut: true }
        } catch (e) {
            console.log(e)
        }

    }

    /**
     * Procesa la acción de un jugador (no NPC)
     * @param {String} playerId - ID del jugador 
     * @param {String} action - Accion realizada
     * @param {Object} actionParams - Acciones adicionales [Vacias por defecto]
     * @returns {Object} - Resultados: message, gameOver, messageId
     */
    async processAction(playerId, action, actionParams = {}) {
        let result = { success: false, history: null };
        let effects;

        // 1. Identificar al Jugador Activo
        const activeChar = this.allCombatientes.find(p => p.ID === playerId);
        if (!activeChar) return { success: false, message: "Jugador no encontrado" };

        this.inactiveCount = 0;

        try {
            switch (action) {
                // CASO A: USAR HABILIDAD (Ataque o Hechizo)
                case 'attack':
                case 'spell':

                    // A.1. Determinar qué habilidad es
                    let skillId;
                    if (action === 'attack') {
                        skillId = activeChar.defaultAttackId || 'default_001';
                    } else {
                        // Si es hechizo, viene en los parámetros
                        skillId = actionParams.skillId;
                    }

                    const spell = await this.getSpellInfo(skillId);

                    if (!spell) return { success: false, message: "Habilidad no encontrada." };


                    let selectedTargets = null;
                    if (actionParams.targetsId) {
                        const ids = Array.isArray(actionParams.targetsId) ? actionParams.targetsId : [actionParams.targetsId];
                        selectedTargets = this.allCombatientes.filter(p => ids.includes(p.ownerId));
                    }

                    const esEquipo1 = this.equipo1.some(p => p._id === activeChar._id);
                    const battleState = {
                        allies: esEquipo1 ? this.equipo1 : this.equipo2,
                        enemies: esEquipo1 ? this.equipo2 : this.equipo1
                    };

                    // A.4. Obtener TODOS los objetivos afectados (Tu función maestra)
                    const targetsDistribution = await this.getAllTargets(spell, activeChar, selectedTargets, battleState);

                    console.log("Data:", actionParams.targetsId, selectedTargets, targetsDistribution)

                    // Validación: Si no hay nadie a quien afectar
                    if (Object.keys(targetsDistribution.targets).length === 0 && Object.keys(targetsDistribution.targetsEffects).length === 0) {
                        return { success: false, message: "No hay objetivos válidos." };
                    }

                    // A.5. Cobrar Costos (Tu función)
                    const costResult = await this.deductSpellCost(spell, activeChar);
                    if (!costResult.success) {
                        return costResult; // Retorna el error (ej: "No tienes maná")
                    }

                    const executionResult = await this.applyEffectsSpell(spell, activeChar, targetsDistribution.targets, targetsDistribution.targetsEffects);

                    result = {
                        success: true,
                        history: {
                            tipo: action === 'attack' ? 'ataque' : 'hechizo',
                            data: {
                                atacante: activeChar.Nombre,
                                habilidad: spell.Nombre,
                                mensaje: executionResult.summaryMessage || "Acción realizada."
                            }
                        }
                    };

                    if (this.mirror.esPosible) {
                        this.recordarAccionesJugador(1, { skillId, targets: actionParams.targetsId });
                    }
                    break;

                case 'defend':
                    result = this.handleDefend(activeChar); 

                    if (this.mirror.esPosible) {
                        this.recordarAccionesJugador(2, null);
                    }
                    break;

                case 'bag':
                    result = await this.handleItem(activeChar, actionParams.itemId, targets);
                    break;

                case 'surrender':
                    result = this.handleSurrender(activeChar);
                    break;

                default:
                    return { success: false, message: "Acción desconocida" };
            }

            // --- FINALIZAR TURNO (Común para todos) ---

            if (result.success) {
                if (result.history) {
                    this.historialAcciones.push(result.history);
                }

                effects = await this.nextTurn();

                if (effects.gameOver) {
                    return { ...result, gameOver: true, winner: effects.winner };
                }
            }

            return { ...result, isNextTurn: effects?.isNextTurn };

        } catch (error) {
            console.error("Error crítico en processAction:", error);
            return { success: false, message: "Error interno al procesar la acción." };
        }
    }


    async generateAttackSkill(attacker) {
        let equipamiento;
        if (attacker.ID !== attacker.Type) {
            equipamiento = attacker?.equipo?.find(i => i.Type === 1)
        }

        let weaponInfo = { atributos: { fuerza: 0 }, nombre: "Emergencia" };

        if (equipamiento) {

            weaponInfo = await this.getObjetInfo(equipamiento.Region, equipamiento.ID)
        }

        const randomBase = Math.floor(Math.random() * (9 - 4) + 2);
        const weaponDamage = weaponInfo?.atribu

        return {
            _id: "basic_attack",
            Nombre: `Ataque (${weaponInfo.Nombre || 'Puños'})`,
            Tipo: 0, // 0 = Físico (Importante para la defensa)
            Elemento: weaponInfo.Elemento || "Neutro",
            Costos: { mana: 0, Vida: 0 },
            Mecanicas: {
                damage: {
                    // Sumamos base aleatoria + daño del arma
                    base: randomBase + weaponDamage,
                    // Tu lógica vieja: characterStrenght * levelBonus
                    // Lo pasamos como scaling para que applyEffectsSpell lo calcule
                    scaling: {
                        stats: "fuerza",
                        // El levelBonus (1 + lvl*0.2) lo calcularemos en el engine o aquí
                        multi: 1 + ((attacker.isNPC ? (attacker.nivelMagico ?? 1) : (attacker.StelarFragmentsTotal ?? attacker.StelarFragments ?? attacker.nivelMagico ?? 1)) * 0.2)
                    },
                    objetivo: [1], // Enemigo
                    esFisico: true // Bandera para activar defensa física
                }
            }
        };
    }

    /**
     * Procesa una acción de defensa [Aumenta la defensa del jugador]
     * @param {Personaje} defender - Jugador que se defiende
     * @param {null} parametros - Sin valor
     * @returns {Object} - sucess, message
     */
    handleDefend(defender, parametros) {
        const def = (1 + Math.floor(Math.random() * (6 - 2) + 2))

        this.historialAcciones.push(`${defender.Nombre} Ha aumentado su defensa en **${def} puntos**`)

        defender.defenseActual = def + (defender.defenseActual || 0)

        return { success: true, message: `Te preparas para el siguiente ataque. Tu defensa ha aumentado un total de **${def} puntos**` }
    }

    /**
     * Despliega el menu de objetos del jugador
     * @param {jugador} owner 
     * @param {Number} page - Pagina actual del jugador
     * @param {null} parametros - Sin valor
     * @returns 
     */
    async handleItem(owner, page = 0, parametros) {
        try {
            const charId = owner._id ?? owner.ID;
            const characterB = await character.findOne({
                $or: [
                    { _id: charId },
                    { _id: Number(charId) },
                    { ID: charId },
                    { ID: Number(charId) }
                ]
            });

            const isExploracion = Boolean(this.duelType === "exploration" || this.type === "exploration" || this.isExploracion === true);
            const characterInventory = isExploracion
                ? (characterB?.economia?.Mochila || [])
                : (characterB?.Inventario || characterB?.economia?.Inventario || []);

            const noItemsMessage = isExploracion
                ? "¡No tienes objetos en tu mochila para usar!"
                : "¡No tienes objetos en tu inventario para usar!";

            if (!characterB || !characterInventory || characterInventory.length === 0) {
                return { success: false, message: noItemsMessage };
            }

            const inventarioInfo = []

            for (const item of characterInventory) {
                const fullItemInfo = await this.getObjetInfo(item.Region, item.ID)

                if (fullItemInfo) {
                    const completeItem = {
                        ...fullItemInfo,
                        cantidad: item.Cantidad
                    }

                    const inCombat = fullItemInfo.uso?.contexto === "combate" || 
                                     fullItemInfo.uso?.contexto === "ambos" || 
                                     fullItemInfo.restricciones?.InCombat === true;
                    if (inCombat) {
                        inventarioInfo.push(completeItem)
                    }
                }
            }

            if (inventarioInfo.length === 0) {
                return { success: false, message: "No tienes objetos que puedan ser usados en combate" };
            }




            const itemPorPagina = 15;
            const totalPage = Math.ceil(inventarioInfo.length / itemPorPagina)
            const itemsPaginas = inventarioInfo.slice(page * itemPorPagina, (page + 1) * itemPorPagina)
            const hechizosList = []
            const optionsList = []

            itemsPaginas.forEach((item, index) => {
                hechizosList.push(`↬ ${item.ID}. ${item.Nombre} *(x${item.cantidad || 1})*\n-# ${item.Descripcion?.substring(0, 100) || "Sin descripción"}`)

                optionsList.push(
                    {
                        "label": `${item.Nombre} (x${item.cantidad || 1})`,
                        "value": `UseDuel*${item.ID}*${item.Region}`,
                        "description": `${item?.Descripcion?.substring(0, 40) || "Sin descripción"}`,
                        "emoji": null,
                        "default": false
                    }
                );
            });

            const tituloText = isExploracion ? "# Has abierto tu mochila <:EmuNui:1370631281028890727>" : "# Has abierto tu inventario <:EmuNui:1370631281028890727>";

            const componentsV2 = [
                {
                    "type": 9,
                    "accessory": {
                        "type": 11,
                        "media": {
                            "url": "https://i.pinimg.com/736x/b2/f7/b2/b2f7b234639e69b9836db08a6323dcc8.jpg"
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": tituloText
                        },
                        {
                            "type": 10,
                            "content": "-# Selecciona el objeto a usar en combate"
                        }
                    ]
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                {
                    "type": 10,
                    "content": `${hechizosList.join("\n")}`
                }
            ]

            const selectOptions = [
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 3,
                            "custom_id": `UseItem-${owner.userAuthor}-${this.id}-${page}`,
                            "options": optionsList,
                            "placeholder": "Selecciona un objeto...",
                            "min_values": 1,
                            "max_values": 1,
                            "disabled": false
                        }
                    ]
                }
            ]

            componentsV2.push(...selectOptions)

            if (totalPage > 1) {
                const buttonComponents = [
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 2,
                                "style": 2,
                                "label": "⬅️ Anterior",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `SpellPage-${owner.userAuthor}-prev-${this.id}-${page > 0 ? page - 1 : totalPages - 1}`
                            },
                            {
                                "type": 2,
                                "style": 2,
                                "label": "Siguiente ➡️",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `SpellPage-${owner.userAuthor}-next-${this.id}-${page < totalPages - 1 ? page + 1 : 0}`
                            },
                            {
                                "type": 2,
                                "style": 1,
                                "label": "Cancelar",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `DuelAct-${owner.userAuthor}-${owner.ID}-cancel-${this.id}-0`
                            }
                        ]
                    }
                ]

                componentsV2.push(...buttonComponents)
            } else {
                const buttonComponents = [
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 2,
                                "style": 1,
                                "label": "Cancelar",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `DuelAct-${owner.userAuthor}-${owner.ID}-cancel-${this.id}-0`
                            }
                        ]
                    }
                ]

                componentsV2.push(...buttonComponents)
            }

            const itemMessage = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": componentsV2
                }
            ]

            await owner.messageOrigin.edit({ components: itemMessage })

            return { success: false, message: `Selecciona un objeto de tu bolsa`, requiresAction: true }

        } catch (e) {
            console.log(e)
            return { success: false, message: `Ha ocurrido un error al intentar mostrar tus objetos` };
        }
    }

    /**
     * Despliega la lista de hechizos del jugador
     * @param {jugador} owner  
     * @param {Number} page - Pagina actual del jugador
     * @param {null} parametros - Sin valor
     * @returns 
     */
    async handleSpell(owner, page = 0, parametros) {
        try {
            // Buscar el personaje y sus hechizos en la base de datos
            const characterB = await soul.findOne({ ID: owner.ID });

            if (!characterB || !characterB.hechizos || characterB.hechizos.length === 0) {
                return { success: false, message: "¡No conoces ningún hechizo para usar en combate!" };
            }

            const characterSpells = characterB.hechizos
            const inventarioInfo = []




            for (const spell of characterSpells) {
                const fullItemInfo = await this.getSpellInfo(spell.ID)



                if (fullItemInfo) {
                    const completeItem = {
                        ...fullItemInfo,
                    }

                    if (fullItemInfo.Req.inCombat) {
                        inventarioInfo.push(completeItem)
                    }
                }
            }

            if (inventarioInfo.length === 0) {
                return { success: false, message: "No tienes hechizos disponibles" };
            }

            // Paginar los resultados (15 hechizos por página)
            const spellsPerPage = 15;
            const totalPages = Math.ceil(inventarioInfo.length / spellsPerPage);
            const paginatedSpells = inventarioInfo.slice(page * spellsPerPage, (page + 1) * spellsPerPage);
            const hechizosList = []
            const optionsList = []
            const selectOptions = [
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 3,
                            "custom_id": `UseSpell-${characterB._id}-${this.id}-${page}`,
                            "options": optionsList,
                            "placeholder": "Selecciona un hechizo...",
                            "min_values": 1,
                            "max_values": 1,
                            "disabled": false
                        }
                    ]
                }
            ]

            // Añadir cada hechizo al componente 
            paginatedSpells.forEach((spell, index) => {
                hechizosList.push(`↬ ${index + 1}. ${spell.Nombre} | <:iconMana:1370897534083534978> ${spell.Costos.mana}\n-# ${spell.Descripcion || "Sin descripcion"}`)

                optionsList.push(
                    {
                        "label": `${spell.Nombre} (${spell.Costos.mana || 0} mana)`,
                        "value": `cast*${spell._id || spell.id}`,
                        "description": `${spell?.Descripcion?.substring(0, 50) || "Sin descripción"}`,
                        "emoji": {
                            name: spell?.emoji?.nombre || "🔮",
                            id: spell?.emoji?.id || null
                        },
                        "default": false
                    }
                );
            });

            const componentsV2 = [{
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://i.pinimg.com/736x/7d/33/71/7d337139c1c5c6845325e9110aadf12a.jpg"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "# **༺ ᨦ Libro de hechizos ᨩ ༻**\n\nMana actual: [] \n\n*Selecciona un hechizo para lanzar en combate*"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 10,
                "content": hechizosList.join("\n")
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 10,
                "content": `-# Pagina ${page + 1} de ${totalPages}`
            }
            ]

            componentsV2.push(...selectOptions)

            if (totalPages > 1) {
                const buttonComponents = [
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 2,
                                "style": 2,
                                "label": "⬅️ Anterior",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `SpellPage-${owner.userAuthor}-prev-${this.id}-${page > 0 ? page - 1 : totalPages - 1}`
                            },
                            {
                                "type": 2,
                                "style": 2,
                                "label": "Siguiente ➡️",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `SpellPage-${owner.userAuthor}-next-${this.id}-${page < totalPages - 1 ? page + 1 : 0}`
                            },
                            {
                                "type": 2,
                                "style": 1,
                                "label": "Cancelar",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `DuelAct-${owner.userAuthor}-${owner.ID}-cancel-${this.id}-0`
                            }
                        ]
                    }
                ]

                componentsV2.push(...buttonComponents)
            } else {
                const buttonComponents = [
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 2,
                                "style": 1,
                                "label": "Cancelar",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `DuelAct-${owner.userAuthor}-${owner.ID}-cancel-${this.id}-0`
                            }
                        ]
                    }
                ]

                componentsV2.push(...buttonComponents)
            }

            // Crear el row para el select menu
            const contenedorSpells = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": componentsV2
                }
            ]


            // Enviar mensaje con el embed y los componentes
            await owner.messageOrigin.edit({
                components: contenedorSpells
            });

            return { success: false, message: "Selecciona un hechizo para lanzar", requiresAction: true };
        } catch (error) {
            console.error("Error al mostrar libro de hechizos:", error);
            return { success: false, message: "Ha ocurrido un error al mostrar tus hechizos" };
        }
    }

    /**
     * Maneja la rendición de un jugador
     * @param {jugador} surrender - Jugador que se rinde
     * @param {jugador} winner - Jugador que gana
     * @returns 
     */
    handleSurrender(surrender, winner) {
        this.historialAcciones.push(`**${surrender.Nombre} se ha rendido**`)


        this.endDuel("surrender", winner, 1)

        return {
            success: true,
            message: `Te has rendido. ${winner.Nombre} gana el duelo`,
            gameOver: true,
            messageId: this.channels,
        }
    }


    /**
     * Realiza la acción de usar un item
     * @param {jugador} user - Jugador que usa el item
     * @param {jugador} target - Objetivo que recibe el item [Actualmente no aplicable]
     * @param {Object} ItemParam - Parametros de item
     * @returns 
     */
    async useItem(user, target, ItemParam) {
        const isNPCActor = this?.isNPC && user.ID === duel?.personajes[1].ID
        const atributosValidos = new Set(['HP', 'Mana', 'Stamina', 'Defensa'])

        try {
            const objetoExist = await this.getObjetInfo(ItemParam.Region, ItemParam.ID)

            if (!objetoExist && isNPCActor) {
                return { success: false, message: "No se pudo encontrar el objeto seleccionado" }
            }

            const usableInCombat = objetoExist.uso?.contexto === "combate" || 
                                   objetoExist.uso?.contexto === "ambos" || 
                                   objetoExist.restricciones?.InCombat === true ||
                                   objetoExist.usableInCombat === true;
            if (!usableInCombat && isNPCActor) {
                return { success: false, message: "Este objeto no puede ser usado en combate" }
            }

            const effectsAp = []
            const tipos = Array.isArray(objetoExist.Tipo) ? objetoExist.Tipo : (objetoExist.Tipo ? [objetoExist.Tipo] : []);
            let hasEffect = false;

            if (tipos.some(t => String(t).toLowerCase() === "consumible")) {
                const atributos = objetoExist.atributos;

                for (const key in atributos) {
                    if (atributosValidos.has(key) && atributos.hasOwnProperty(key) && typeof user[key] === 'number') {

                        user[key] += atributos[key]

                        if (key === 'HP' && user[key] > user.stats.hpMax) {
                            user[key] = user.stats.hpMax
                        }

                        if (key === 'Mana' && user[key] > (user.stats.manaMax || user.stats.manaMax)) {
                            user[key] = (user.stats.manaMax || user.stats.manaMax)
                        }

                        effectsAp.push(`**${key} +${atributos[key]}**`)
                    }
                }
                hasEffect = true;
            }

            if (!hasEffect) {
                effectsAp.push(`Usaste el objeto pero no tuvo ningun efecto especial`)
            }

            if (!isNPCActor) {
                await character.updateOne({ ID: user.ID }, {
                    $inc: {
                        "Inventario.$[objeto].Cantidad": -1
                    }
                }, {
                    arrayFilters: [
                        { "objeto.ID": objetoExist.ID }
                    ]
                })

                await character.updateOne(
                    { ID: user.ID },
                    { $pull: { Inventario: { Cantidad: { $lte: 0 } } } }
                );
            }

            if (this.mirror.esPosible) {
                const dataItem = {
                    itemID: objetoExist
                }

                this.recordarAccionesJugador(3, dataItem)
            }

            this.historialAcciones.push(`${user.Nombre} usó *${objetoExist.Nombre}*. [${effectsAp.join(", ")}]`)
            return { success: true, message: `Has usado ${objetoExist.Nombre} y obtuviste ${effectsAp.join(", ")}` }




        } catch (e) {
            console.log(e)
            return { success: false, message: `Ha ocurrido un error al usar el objeto` }
        }
    }

    /**
     * Realiza la acción de usar un hechizo 
     * @param {jugador} user - Jugador que realiza el hechizo
     * @param {objetivo} target - Objetivo/s que reciben el hechizo
     * @param {Object} SpellParam - Parametros de hechizo
     * @returns 
     */
    async useSpell(user, target, SpellParam) {
        const isNPCActor = this.isNPC && user.ID === this.personajes[1].ID
        if (isNPCActor) {
            const spellNPC = await this.getSpellInfo(SpellParam.spellID)
            const validTargets = await this.getAllTargets(spellNPC, user, target, null)

            const result = await this.applyEffectsSpell(spellNPC, user, validTargets.targets, validTargets.targetsEffects);

            this.historialAcciones.push(result.summaryMessage)

            if (target.HP <= 0) {
                await this.endDuel("hp0", user)
                return {
                    success: true,
                    message: `¡${user.Nombre} ha derrotado a ${target.Nombre}!`,
                    gameOver: true,
                    messageId: this.channels
                }
            }

            return { success: true, message: result.detailedMessage }

        }

        const spellExist = await this.getSpellInfo(SpellParam)

        if (!spellExist) {
            return { success: false, message: "No se ha podido encontrar le hechizo" }
        }

        if (spellExist.isActive && spellExist.InCombat) {
            return { success: false, message: "Al parecer este hechizo esta prohibido o no se puede usar en este momento [¿Desactivado?]" }
        }

        const spellCost = await this.deductSpellCost(spellExist, user)

        if (!spellCost.success) {
            return { success: false, message: spellCost.message }
        }

        try {
            const baseProb = spellExist.Mecanicas.castProbabilidad
            const bonusIntel = user.stats.inteligencia * 0.015
            const probCast = Math.min(1, baseProb + bonusIntel)
            const isCast = Math.random() <= probCast

            console.log("Proabilidad:", `${probCast * 100}%`)
            console.log("Se casteó el hechizo?:", isCast)

            if (!isCast) {
                this.historialAcciones.push(`${user.Nombre} intento conjurar un hechizo, pero falló en el intento`)
                return { success: true, message: "Intentaste conjurar el hechizo, sin embargo fallaste", spellFailed: true }
            }



            const validTargets = await this.getAllTargets(spellExist, user, target, null)

            const result = await this.applyEffectsSpell(spellExist, user, validTargets.targets, validTargets.targetsEffects);

            //Agregar aqui el cooldown
            this.historialAcciones.push(result.summaryMessage)

            if (this.mirror.esPosible) {
                const dataSpell = {
                    spellID: spellExist._id
                }

                this.recordarAccionesJugador(4, dataSpell)
            }

            if (target.HP <= 0) {
                await this.endDuel("hp0", user)
                return {
                    success: true,
                    message: `¡${user.Nombre} ha derrotado a ${target.Nombre}!`,
                    gameOver: true,
                    messageId: this.channels
                }
            }

            return { success: true, message: result.detailedMessage }



        } catch (e) {
            console.log(e)
            return { success: false, message: `Ha ocurrido un error al intentar conjurar el hechizo` }
        }
    }


    /**
     * Obtiene todos los objetivos de un hechizo/ataque
     * @param {*} objective 
     * @param {*} caster 
     * @param {*} selectedTarget 
     * @param {*} allies 
     * @param {*} enemies 
     * @returns 
     */
    async getTargetsForObjetive(objective, caster, selectedTargets, allies, enemies) {



        switch (objective) {
            case 1: // Enemigo
                if (selectedTargets && selectedTarget.length > 0) return selectedTargets
                return selectedTarget || enemies[0];
            case 2: // Aliado
                if (selectedTargets && selectedTargets.length > 0) return selectedTargets
                return allies.filter(a => a.ID !== caster.ID)
                return caster;
            case 4: // Todos (Aliados y Enemigos)
                return [...allies, ...enemies];
            case 5: // Todos los enemigos
                return enemies;
            case 6: // Todos los aliados
                return allies;
            default:
                return null;
        }
    }

    /**
     * Formatea todos los objetivos obtenidos previamente
     * @param {*} spell 
     * @param {*} caster 
     * @param {*} selectedTarget 
     * @param {*} battleState 
     * @returns 
     */
    async getAllTargets(spell, caster, selectedTarget, battleState) {
        const { allies = [], enemies = [] } = battleState || {};

        const targets = {};
        const targetsEffects = {};

        const resolve = async (objective) => {
            if (Array.isArray(objective)) {
                const arrays = await Promise.all(
                    objective.map(code =>
                        this.getTargetsForObjetive(code, caster, selectedTarget, allies, enemies)
                    )
                );
                return arrays.flat();
            } else {
                const single = await this.getTargetsForObjetive(objective, caster, selectedTarget, allies, enemies);
                return Array.isArray(single) ? single : [single];
            }
        };


        for (const key of Object.keys(spell.Mecanicas)) {
            const block = spell.Mecanicas[key];
            if (block && typeof block.objetivo !== 'undefined') {
                targets[key] = await resolve(block.objetivo);
            }
        }

        // Y para los Efectos separados
        if (spell.Mecanicas.Efectos) {
            for (const key of Object.keys(spell.Mecanicas.Efectos)) {
                const eff = spell.Mecanicas.Efectos[key];
                if (eff && typeof eff.objetivo !== 'undefined') {
                    targetsEffects[key] = await resolve(eff.objetivo);
                }
            }
        }

        return { targets, targetsEffects };
    }

    /**
     * Aplica los efectos a los jugadores del combate
     * @param {Hechizo} spell - Hechizo que se esta aplicando
     * @param {personaje} caster - Personaje que realizo el hechizo
     * @param {objetivos} targets - Personajes afectados por el hechizo
     * @param {Array} effectsTargets - Todos los efectos aplicables del hechizo
     * @returns 
     */
    async applyEffectsSpell(spell, caster, targets, effectsTargets) {
        const results = {
            damage: [],
            healing: [],
            otherEffects: []
        };

        const mechanics = spell.Mecanicas || {}

        let multipElement = 1

        const efectividadElemental = {
            Pyró: {
                fuerteContra: ["Rakau", "Krýo", "Wind"],
                debilContra: ["Aqua", "Lapis"]
            },
            Aqua: {
                fuerteContra: ["Pyró", "Lapis"],
                debilContra: ["Electro", "Rakau", "Krýo"]
            },
            Lapis: {
                fuerteContra: ["Electro", "Krýo", "Pyró"],
                debilContra: ["Aqua", "Wind"]
            },
            Rakau: {
                fuerteContra: ["Aqua", "Lapis"],
                debilContra: ["Pyró", "Krýo", "Electro"]
            },
            Electro: {
                fuerteContra: ["Rakau", "Aqua"],
                debilContra: ["Wind", "Lapis"]
            },
            Kryo: {
                fuerteContra: ["Aqua", "Wind"],
                debilContra: ["Pyró", "Lapis"]
            },
            Wind: {
                fuerteContra: [],
                debilContra: ["Krýo", "Pyró"]
            },
            Lux: {
                fuerteContra: [],
                debilContra: []
            },
            Neutro: {
                fuerteContra: [],
                debilContra: []
            }
        }

        if (!(Object.keys(targets).length === 0)) {
            if (mechanics?.damage && targets.damage) {
                let isElemental = { Bonus: false, message: "" }

                let targetDamage = targets.damage

                if (!Array.isArray(targetDamage)) {
                    targetDamage = [targetDamage];
                }

                for (const target of targetDamage) {
                    const efecto = efectividadElemental[spell.Elemento] || efectividadElemental["Neutro"];

                    if (efecto.fuerteContra.includes(target.Elemento)) {
                        multipElement = 1.3 // 30% de daño adicional
                        isElemental = { Bonus: true, message: "Bonificacion por Fuerte Elemental" }
                    } else if (efecto.debilContra.includes(target.Elemento)) {
                        multipElement = 0.7 // -30% de daño adicional
                        isElemental = { Bonus: false, message: "Daño Reducido por Debilidad Elemental" }
                    } else {
                        multipElement = 1
                        isElemental = { Bonus: false, message: "Sin bonus elementales" }
                    }

                    // Calcular daño base + scaling
                    let damageAmount = this.calculateEffectAmount(mechanics.damage, caster, multipElement)

                    const chanceCritico = ((caster.stats.sabiduria * 2) + (caster.stats.agilidad * 2)) / 100;
                    const esCritico = Math.random() < chanceCritico;

                    if (esCritico) {
                        damageAmount = Math.floor(damageAmount * 1.5)
                    }

                    if (spell.Tipo === 0 || mechanics.damage.esFisico) {
                        const targetLvl = target.isNPC ? (target.nivelMagico ?? 1) : (target.StelarFragmentsTotal ?? target.StelarFragments ?? target.nivelMagico ?? 1);
                        const enemyDefense = (1 + (target.defenseActual || 0)) * ((target.stats.resistenciaFisica * 0.6) + (targetLvl * 0.35))

                        damageAmount = Math.max(Math.round(damageAmount - enemyDefense), 1)

                        target.defenseActual = 0;
                    }



                    target.HP = Math.max(0, target.HP - damageAmount)

                    results.damage.push({
                        target: target,
                        effect: 'damage',
                        amount: damageAmount,
                        isElemental: isElemental,
                        isCritico: esCritico
                    });
                }

            }

            if (mechanics?.healing) {
                const healingTargets = Array.isArray(targets.healing) ? targets.healing : [targets.healing];



                for (const target of healingTargets) {
                    let isElemental = { Bonus: false, message: "" }
                    const tabla = efectividadElemental[spell.Elemento] || efectividadElemental["Neutro"];

                    if (efecto.fuerteContra.includes(target.Elemento)) {
                        multipElement = 1.3 // 30% de daño adicional
                        isElemental = { Bonus: true, message: "[Bonificacion por Fuerte Elemental]" }
                    } else if (efecto.debilContra.includes(target.Elemento)) {
                        multipElement = 0.7 // -30% de daño adicional
                        isElemental = { Bonus: false, message: "[Daño Reducido por Debil Elemental]" }
                    } else {
                        multipElement = 1
                        isElemental = { Bonus: false, message: "[Sin bonus elementales]" }
                    }

                    const healAmount = this.calculateEffectAmount(mechanics.healing, caster, multipElement);
                    target.HP += healAmount;
                    if (target.HP > target.stats.hpMax) target.HP = target.stats.hpMax;


                    results.healing.push({
                        target: target,
                        effect: 'healing',
                        amount: healAmount,
                        isElemental: isElemental
                    });
                }
            }
        }

        if (mechanics.Efectos && Object.keys(effectsTargets).length > 0) {
            for (const key of Object.keys(mechanics.Efectos)) {
                // Obtener targets para ESTE efecto específico
                let effectTargetsList = effectsTargets[key];
                if (!effectTargetsList) continue; // Si no hay targets para este efecto, saltar

                if (!Array.isArray(effectTargetsList)) effectTargetsList = [effectTargetsList];

                for (const target of effectTargetsList) {
                    const efectoDatos = mechanics.Efectos[key];

                    target.statusEffect.push({
                        type: key, // ej: "poison"
                        Nombre: efectoDatos.Nombre,
                        // Calculamos la potencia del efecto basada en stats del caster
                        base: Math.round(efectoDatos.base + (1 + (caster.stats.poderElemental * 2))),
                        duracion: efectoDatos.duracion,
                        probabilidad: efectoDatos.probabilidad || 1
                    });

                    results.otherEffects.push({
                        target: target,
                        effect: key,
                        nombreEfecto: efectoDatos.Nombre,
                        duracion: efectoDatos.duracion
                    });
                }
            }
        }


        if (this.personajes && this.personajes.length >= 2) {
            await this.getDialogues(this.personajes[0], this.personajes[1], null, null);
        }

        const detailedMessage = this.generateDetailedMessage(spell, caster, results);
        const summaryMessage = this.generateSummaryMessage(spell, caster, results);

        return {
            success: true,
            results: results,
            detailedMessage: detailedMessage,
            summaryMessage: summaryMessage
        };
    }

    /**
     * Aplica los efectos individuales y el estado actual 
     * @param {personaje} character - Quien se ve afectado por el efecto 
     * @returns 
     */
    async applyStatusEffect(character) {
        const effectAp = []


        const finished = [];

        for (let i = character.statusEffect.length - 1; i >= 0; i--) {
            const effect = character.statusEffect[i];
            effect.duracion--;

            console.log("Duracion restante", effect.duracion)

            if (effect.duracion <= 0) {
                finished.push(effect.Nombre);
                character.statusEffect.splice(i, 1);
            }
        }


        for (const effect of character.statusEffect) {
            switch (effect.type) {
                case "damage":
                    const damageBase = effect.base
                    let total

                    if (effect.reduct) {
                        const resist = Math.min(character.stats.voluntad * 0.5, 70)

                        total = Math.max(Math.round((damageBase) * (1 - resist / 100)), 1)
                    } else {
                        total = damageBase
                    }

                    if (isNaN(total)) total = 1


                    character.HP = Math.max(0, character.HP - total)
                    effectAp.push(`${character.Nombre} sufre **${total}** de daño por` + "`" + effect.Nombre + "`")
                    break;
                case "pasive":
                    const healBase = effect.base
                    let totalHeal;

                    const bonus = Math.max(character.stats.regeneracion * 0.03, 30)

                    totalHeal = Math.round(healBase * (1 - bonus / 100))

                    character.HP -= totalHeal

                    if (character.HP > character.stats.hpMax) {
                        character.HP = character.stats.hpMax
                    }
                    effectAp.push(`${character.Nombre} ha regenerado **${total} HP** por ` + "`" + effect.nameEffect + "`")
                    break;
            }
        }

        let message;


        if (finished.length > 0) {
            const lista = finished
                .map(name => `**${name}**`)
                .join(', ');
            message = `**Efectos terminados:** ${lista}.`;
        }

        return { finished: message, effects: effectAp }
    }

    /**
     * Calcula el daño de un efecto
     * @param {Efecto} effect - Efecto aplicado
     * @param {personaje} caster - Quien realizo el hechizo
     * @param {Number} multipler - Mutiplicador de daño [defecto = 1]
     * @returns 
     */
    calculateEffectAmount(effect, caster, multipler = 1) {
        let amount = effect.base

        if (effect.scaling) {
            const statsValue = caster.stats[effect.scaling.stats] || 0;
            amount += (statsValue * effect.scaling.multi) * multipler
        }

        return Math.floor(amount)
    }

    /**
     * Realiza el costeo de los hechizos
     * @param {hechizo} spell - Información del hechizo
     * @param {personaje} caster - ¿Quien castea el hechizo?
     * @returns 
     */
    async deductSpellCost(spell, caster) {
        const authorDinero = await character.findOne({ ID: caster.ID })
        const cost = spell.Costos;

        if (caster.Mana < cost.mana) return { success: false, message: "No tienes suficiente mana para lanzar este hechizo" };
        if ((caster.HP - 1) <= cost.Vida) return { success: false, message: "No tienes suficiente vida para lanzar este hechizo" };


        if (caster.cooldowns && caster.cooldowns[spell._id] > turns) return { success: false, message: "No puedes usar este hechizo por que esta en enfriamiento" }



        caster.Mana -= cost.mana
        caster.HP -= cost.Vida

        if (cost.Dinero) {
            if ((authorDinero.Dinero || 0) < cost.Dinero) return { success: false, message: "No tienes suficiente dinero para lanzar este hechizo" };

            await character.updateOne({ ID: authorDinero.ID },
                {
                    $inc: {
                        "Dinero": -cost.Dinero
                    }
                }
            )
        }

        return { success: true }

    }


    /**
     * Regeneración pasiva
     * @param {Array} characters 
     */
    async regenerator(characters) {

        for (const personaje of characters) {

            if (!personaje.artefactoMagico) {
                personaje.Mana += 2

                if (personaje.Mana > personaje.stats.manaMax) {
                    personaje.Mana = personaje.stats.manaMax
                }
            }

        }
    }


    /**
     * Ejecuta acciones especiales de los NPC (habilidades unicas)
     * @param {NPC} npc - NPC que realiza la acción
     * @param {jugador} player - Quien recibe la acción especial
     * @param {Object} action - Información de la accion especial
     */
    async executeSpecialAction(npc, player, action) {
        const finalAction = action.phase.finalAction

        if (finalAction === "Espejear") {
            const clonedPlayer = JSON.parse(JSON.stringify(player))


            clonedPlayer.ID = npc.ID

            clonedPlayer.originalData = {
                stats: { ...npc.stats },
                avatarURL: npc.avatarURL,
                attacks: [...npc.attacks],
            };

            clonedPlayer.messageOrigin = null;
            clonedPlayer.MDOrigin = null;
            clonedPlayer.isNPC = true;
            clonedPlayer.avatarURL = `${player.avatarURL}`;
            clonedPlayer.restrictions = npc.restrictions
            clonedPlayer.attacks = npc.attacks
            clonedPlayer.mirrorMetadata = {
                sourcePlayer: player.ID,
                mirroredAt: new Date(),
                turnsRemaining: Infinity // Permanente hasta el duelo
            };

            const npcIndex = this.personajes.findIndex(p => p.ID === npc.ID);
            this.personajes[npcIndex] = clonedPlayer;

            this.historialAcciones.push(`**${npc.Nombre}** se ha convertido en el espejo de **${player.Nombre}**`)
            npc.specialPhase.active = "success"
            this.mirror.active = true

            this.mirror.toReplay = [...this.mirror.recordedActions];

        }

        if (finalAction === "Enredar") {
            player.effects
        }
    }

    recordarAccionesJugador(action, data) {
        const info = {
            action: action,
            data: data
        }

        this.mirror.recordedActions.push(info)
    }

    async realizarAccionNPC(npc, player, action, data) {

        let actions;
        switch (action?.type || action) {
            case 1:
                await this.handleAttack(npc, player)
                actions = "attack"
                break;
            case 2:
                await this.handleDefend(npc)
                actions = "defend"
                break;
            case 3:
                await this.useItem(npc, player, data)
                actions = "bag"
                break;
            case 4:
                await this.useSpell(npc, player, data)
                actions = "spell"
                break;
            case 5:
                await this.executeSpecialAction(npc, player, action)
                actions = "especial"
                break;
            default:
                actions = null;
                return { success: false }
        }

        return actions
    }

    getRandomAttackNPC(attacks, npc) {
        const totalProbabily = attacks.reduce((sum, attack) => sum + attack.probability, 0)

        let randomValue = Math.random() * totalProbabily

        let selectedAttack = null;


        for (const attack of attacks) {
            randomValue -= attack.probability;
            if (randomValue <= 0) {
                selectedAttack = attack;
                break;
            }
        }


        if (!selectedAttack && npc.attacks.length > 0) {
            selectedAttack = npc.attacks[0];
        }

        return selectedAttack
    }


    async ejecutarAccionesNPC() {
        const npc = this.personajes[1];
        const player = this.personajes[0]
        const specialAttack = npc?.attacks.find(t => t.type === 5)
        const normalAttacks = specialAttack ? npc.attacks.filter(a => a.type !== specialAttack.type) : [...npc.attacks];
        let result;
        let selectedAttack;;

        await this.getDialogues(player, npc, null, null);


        if (npc.HP <= 0 || player.HP <= 0) return;

        if (this.mirror?.active) {
            console.log("Mirror activo")
            if (this.mirror.toReplay && this.mirror.toReplay.length > 0) {
                const next = this.mirror.toReplay.shift();
                console.log(next)
                result = this.realizarAccionNPC(npc, player, next.action, next?.data);
            } else {
                this.getRandomAttackNPC(normalAttacks, npc)
            }

        } else if (!npc.specialPhase?.active) {
            console.log("Fase no activa")
            selectedAttack = this.getRandomAttackNPC(npc.attacks, npc)
        } else {
            selectedAttack = specialAttack
        }


        if (selectedAttack?.type === specialAttack?.type) {

            npc.specialPhase ??= {};
            npc.specialPhase.turns ??= 0;
            npc.specialPhase.turns += 1;

            if (npc.specialPhase.turns < specialAttack.phase.preparationTurns) {
                selectedAttack = this.getRandomAttackNPC(specialAttack.phase.behavior, npc)
                result = await this.realizarAccionNPC(npc, player, selectedAttack)
                this.historialAcciones.push(`**${npc.Nombre} se preparara para realizar una acción... (${npc.specialPhase.turns}/${specialAttack.phase.preparationTurns})**`)
            } else {
                result = await this.realizarAccionNPC(npc, player, specialAttack)
            }

        } else {
            result = this.realizarAccionNPC(npc, player, selectedAttack)
        }


        await sleep(3000)
        await this.nextTurn()
        return { action: result }
    }




    async endDuel(reason, winner, parametros) {

        const winnerPlayer = duel.personajes.find(p => p.ID === winner.ID);
        const defeatedPlayer = duel.personajes.find(p => p.ID !== winner.ID);
        const player = duel.personajes.find(p => p.messageOrigin !== null)
        const npc = duel.personajes.find(p => p.messageOrigin === null)

        if (!duel) return false;

        duelEmitter.emit(`duelEnded`, {
            winner: winnerPlayer,
            defeated: defeatedPlayer,
            duelId: duel.id,
            isAFK: duel.isAFK,
            reason: reason,
            context: {
                type: duel.type,
                playerId: player.ID,
                turnos: duel.ronda,
                isNPC: duel.isNPC,
                winnerMd: winnerPlayer.imNPC ? null : winnerPlayer.messageOrigin,
                defeatedMd: defeatedPlayer.imNPC ? null : defeatedPlayer.messageOrigin,
                espectadorMessage: duel.channels,
                historialAcciones: duel.historialAcciones
            }
        })

        if (duel.isNPC) {
            await soul.updateOne({ ID: player.ID }, {
                $set: { HP: player.HP, Mana: player.Mana },
                $inc: { [`npcDefeated.${npc._id}`]: 1 },

            }, { upsert: true })
        } else {

            await soul.updateOne({ ID: winnerPlayer.ID }, {
                $set: { HP: winnerPlayer.HP, Mana: winnerPlayer.Mana }
            })

            await soul.updateOne({ ID: defeatedPlayer.ID }, {
                $set: { HP: defeatedPlayer.HP, Mana: defeatedPlayer.Mana }
            })
        }

        clearInterval(duel.timeoutId)
        clearTimeout(duel.timeoutId)
        this.activeduels.delete(duel.id)

        this.activeduels.get(duel.id)




        return true
    }

    //Información:
    async getObjetInfo(region, id) {
        const catalogoObjetos = require("./catalogoObjetos");
        return catalogoObjetos.getObjetoPorId(region, id) ?? null;
    }

    async getSpellInfo(id) {

        const documento = await hechizos.findOne({ _id: id })

        if (documento) {
            return documento;
        }

        return null
    }


    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

}

module.exports = { Duelv2, duelEmitter }