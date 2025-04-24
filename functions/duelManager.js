const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, InteractionContextType, Embed, StringSelectMenuBuilder} = require(`discord.js`)
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
const version = require("../config")
const transaccionCache = require("../utils/cache")
const { v4: uuidv4} = require('uuid')
const getGifs = require("../functions/getGifs")
const util = require(`util`);
const sleep = util.promisify(setTimeout)


const { EventEmitter } = require('events');
const dialogoManager = require("./dialogoManager")
class DuelEmitter extends EventEmitter {}
const duelEmitter = new DuelEmitter();

class Duels {
    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

     constructor() {
                    this.activeduels = new Map();

    }

    async createDuel(client, Player1, Soul1, Rival, SoulRival, channel, Mdauthor, MdRival, isNPC = false) {
                   // Referencia al cliente de MongoDB
                   this.mongoClient = clientdb;
                   this.db = db
                   this.duelos = this.db.collection('duelos');
                   
                   // Configuración por defecto
                   this.tiempoLimiteTurno = 30000; // 30 segundos
                   this.duracionMaximaDuelo = 3600000; // 1 hora

                   this.channel = channel
                   this.MdAuthor = Mdauthor
                   this.MdRival = MdRival
                   this.isNPC = isNPC
                   this.client = client

                   this.player1 = {
                       userAuthor: Player1._id,
                       ID: Player1.ID,
                       Nombre: Player1.Nombre,
                       manaMax: Soul1.stats.manaMax,
                       avatarURL: Player1.avatarURL,
                       isTurn: false,
                       ...Soul1,
                       statusEffect: []
                   }

                   if(isNPC) {
                    this.player2 = {
                        ID: Rival.Type,
                        manaMax: Rival.Mana,
                        avatarURL: Rival.avatarURL,
                        isTurn: false,
                        ...Rival,
                        statusEffect: []
                    }
                   }else {
                    this.player2 = {
                        Nombre: Rival.Nombre,
                        userAuthor: Rival._id,
                        ID: Rival.ID,
                        manaMax: SoulRival.stats.manaMax,
                        avatarURL: Rival.avatarURL,
                        isTurn: false,
                        ...SoulRival,
                        statusEffect: []
                    }
                   }


                   if(isNPC) {
                    this.currentTurn = this.player1
                    this.waitingPlayer = this.player2
                   }else {
                    this.currentTurn = Math.random() < 0.5 ? this.player1 : this.player2;
                    this.waitingPlayer = this.currentTurn.ID === this.player1.ID ? this.player2 : this.player1;
                   }






                   await this.startDuel()
    }

     barradeVida(current, max, mini) {

        if(mini) {
            const porcentaje = (current / max) * 100

            const totalBars = 5;
            let filledBars = Math.round((current / max) * totalBars);
            const emptyBars = totalBars - filledBars;
    
           if(current > 0 && filledBars === 0) {
                filledBars = 1
            }

            let heartsCompletos = '❤︎'.repeat(filledBars)
            const heartsVacios = '𖹭'.repeat(emptyBars)

    
            if(porcentaje < 10 && filledBars > 0) {
                heartsCompletos = heartsCompletos.slice(0, -2) + '<a:YellowHeartGif:1345281989883723776>'
            }
            return `**(${current}/${max})** [${heartsCompletos}${heartsVacios}]`;

        }else {
            const porcentaje = (current / max) * 100

            const totalBars = 10;
            let filledBars = Math.round((current / max) * totalBars);
            const emptyBars = totalBars - filledBars;

            if(current > 0 && filledBars === 0) {
                filledBars = 1
            }
    
            let heartsCompletos = '❤︎'.repeat(filledBars)
            const heartsVacios = '𖹭'.repeat(emptyBars)
    
            if(porcentaje < 10 && filledBars > 0) {
                heartsCompletos = heartsCompletos.slice(0, -2) + '<a:YellowHeartGif:1345281989883723776>'
            }
            return `[${heartsCompletos}${heartsVacios}] **(${current}/${max})**`;
        }


     }


     getDuel(duelId) {
        return this.activeduels.get(duelId)
    }


     async startDuel() {

        const duelId = `${this.player1.ID}${this.player2.ID}${Date.now()}`;

        let errorMD;
        const MDAuthorOrg = this.MdAuthor
        const MDRivalOrg = this.MdRival
    

        //Embed donde los miembros del servidor podran espectear


        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`DuelAct-${this.currentTurn.userAuthor}-${this.currentTurn.ID}-attack-${duelId}`).setLabel('Atacar').setStyle(ButtonStyle.Secondary).setEmoji("🤺").setDisabled(this.player2.restrictions?.Attack === true),
            new ButtonBuilder().setCustomId(`DuelAct-${this.currentTurn.userAuthor}-${this.currentTurn.ID}-defend-${duelId}`).setLabel('Defenderse').setStyle(ButtonStyle.Secondary).setEmoji("🛡️").setDisabled(this.player2.restrictions?.Defend === true),
            new ButtonBuilder().setCustomId(`DuelAct-${this.currentTurn.userAuthor}-${this.currentTurn.ID}-bag-${duelId}`).setLabel('Bolsa').setStyle(ButtonStyle.Secondary).setEmoji("🎒").setDisabled(this.player2.restrictions?.Bag === true),
            new ButtonBuilder().setCustomId(`DuelAct-${this.currentTurn.userAuthor}-${this.currentTurn.ID}-spells-${duelId}`).setLabel('Hechizos').setStyle(ButtonStyle.Secondary).setEmoji("🔮").setDisabled(this.player2.restrictions?.Spells === true),
            new ButtonBuilder().setCustomId(`DuelAct-${this.currentTurn.userAuthor}-${this.currentTurn.ID}-surrender-${duelId}`).setLabel('Rendirse').setStyle(ButtonStyle.Danger).setEmoji("🏳️").setDisabled(this.player2.restrictions?.Surrender === true)
          );


        const embed = new EmbedBuilder()
          .setTitle("El duelo ha comenzado")
          .setDescription(`Es el turno de <@!${this.currentTurn.userAuthor}> (${this.currentTurn.Nombre})`)
          .addFields(
              {name: this.player1.Nombre, value: "`HP:`" + ` ${this.barradeVida(this.player1.HP, this.player1.stats.hpMax)}`, inline: true},
              {name: this.player2.Nombre, value: "`HP:`" + ` ${this.barradeVida(this.player2.HP, this.player2.stats.hpMax)}`, inline: true}
          )
          .setThumbnail(this.currentTurn.avatarURL)
          .setFooter({text: "Esperando..."})


        if(this.isNPC) {

            embed.addFields({
                name: "Informacion", 
                value: this.player2.Descripcion || "Un misterioso Enemigo"
            })

            const EmbedAuthor = new EmbedBuilder()
            .setTitle("¡Es tu turno!")
            .setDescription("`HP:`"+ ` ${this.barradeVida(this.player2.HP, this.player2.stats.hpMax)} **(Rival)**`)
            .addFields(
                {name: "Tus Stats", value: "`HP:` " + `${this.barradeVida(this.player1.HP, this.player1.stats.hpMax, true)}` + "\n`Mana:`" +
                `${this.player1.Mana}/${this.player1.manaMax}`}
            )
            .setThumbnail(this.player2.avatarURL)
            .setColor("Green");

            this.authorMD = await this.MdAuthor.send({embeds: [EmbedAuthor], components: [row], fetchReply: true}).catch()
            this.rivalMD = null

        }else {
            if(this.currentTurn.userAuthor === this.player1.userAuthor) {

                //Embeds personales 
                const EmbedAuthor = new EmbedBuilder()
                .setTitle("¡Es tu turno!")
                .setDescription("`HP:`"+ ` ${this.barradeVida(this.player2.HP, this.player2.stats.hpMax)} **(Rival)**`)
                .addFields(
                    {name: "Tus Stats", value: "`HP:` " + `${this.barradeVida(this.player1.HP, this.player1.stats.hpMax, true)}` + "\n`Mana:`" +
                    `${this.player1.Mana}/${this.player1.manaMax}`}
                )
                .setThumbnail(this.player2.avatarURL)
                .setColor("Green");
        
                const EmbedWaiting= new EmbedBuilder()
                .setTitle("Esperando la acción...")
                .setDescription("`HP:`"+ ` ${this.barradeVida(this.player1.HP, this.player1.stats.hpMax)} **(Rival)**`)
                .addFields(
                    {name: "Tus Stats", value: "`HP:` " + `${this.barradeVida(this.player2.HP, this.player2.stats.hpMax, true)}` + "\n`Mana:`" +
                    `${this.player2.Mana}/${this.player2.manaMax}`}
                )
                .setThumbnail(this.player1.avatarURL)
                .setColor("Red");
    
                this.authorMD = await this.MdAuthor.send({embeds: [EmbedAuthor], components: [row], fetchReply: true})
                this.rivalMD = await this.MdRival.send({embeds: [EmbedWaiting], fetchReply: true})
            }else {
                const embed = new EmbedBuilder()
                .setTitle("El duelo ha comenzado")
                .setDescription(`Es el turno de <@!${this.currentTurn.userAuthor}> (${this.currentTurn.Nombre})`)
                .addFields(
                    {name: this.player2.Nombre, value: "`HP:`" + ` ${this.barradeVida(this.player2.HP, this.player2.stats.hpMax)}`, inline: true},
                    {name: this.player1.Nombre, value: "`HP:`" + ` ${this.barradeVida(this.player1.HP, this.player1.stats.hpMax)}`, inline: true}
                )
                .setThumbnail(this.currentTurn.avatarURL)
                .setFooter({text: "Esperando..."})
        
                this.message = await this.channel.send({ embeds: [embed], fetchReply: true})
        
                //Embeds personales 
                const EmbedAuthor = new EmbedBuilder()
                .setTitle("¡Es tu turno!")
                .setDescription("`HP:`"+ ` ${this.barradeVida(this.player1.HP, this.player1.stats.hpMax)} **(Rival)**`)
                .addFields(
                    {name: "Tus Stats", value: "`HP:` " + `${this.barradeVida(this.player2.HP, this.player2.stats.hpMax, true)}` + "\n`Mana:`" +
                    `${this.player2.Mana}/${this.player2.manaMax}`}
                )
                .setThumbnail(this.player1.avatarURL)
                .setColor("Green");
        
                const EmbedWaiting= new EmbedBuilder()
                .setTitle("Esperando la acción...")
                .setDescription("`HP:`"+ ` ${this.barradeVida(this.player1.HP, this.player1.stats.hpMax)} **(Rival)**`)
                .addFields(
                    {name: "Tus Stats", value: "`HP:` " + `${this.barradeVida(this.player2.HP, this.player2.stats.hpMax, true)}` + "\n`Mana:`" +
                    `${this.player2.Mana}/${this.player2.manaMax}`}
                )
                .setThumbnail(this.player2.avatarURL)
                .setColor("Red");

                this.rivalMD = await this.MdRival.send({embeds: [EmbedAuthor], components: [row], fetchReply: true}).catch((e) => {
                    errorMD = e
                    return
                })
                this.authorMD = await this.MdAuthor.send({embeds: [EmbedWaiting], fetchReply: true}).catch((e) => {
                    errorMD = e
                    return 
                })
            }
        }

        if(errorMD?.code === 50007) {
            return
        }else {
            this.message = await this.channel.send({ embeds: [embed], fetchReply: true})
        }




        this.player1Rest = {
            messageOrigin: this.authorMD,
            MDOrigin: MDAuthorOrg,
            ...this.player1,
        }

        this.player2Rest = {
            messageOrigin: this.isNPC ? null : this.rivalMD,
            MDOrigin: this.isNPC ? null : MDRivalOrg,
            ...this.player2,
        }

        const mirrorAttack = this.player2.attacks.find(m => m.effects === "mirror")

        const duel = {
            id: duelId,
            personajes: [this.player1Rest, this.player2Rest],
            userMD: this.isNPC ? [this.authorMD] : [this.authorMD, this.rivalMD],
            channels: this.message,
            turnoActual: this.currentTurn,
            ronda: 1,
            historialAcciones: [],
            finalizado: false,
            tiempoInicio: Date.now(),
            tiempoLimite: 45000, // 45 segundos
            timeoutId: null, // Para almacenar el ID del timeout
            isNPC: this.isNPC,
            mirror: {
                esPosible: this.isNPC && mirrorAttack,
                active: false,
                countdown: 0,
                recordedActions: []
            }
        };


        this.activeduels.set(duelId, duel)
        duel.timeoutId = setTimeout(() => this.handleTimeout(duel), duel.tiempoLimite);
        this.getDialogues(this.player1Rest, this.player2Rest, duel, null, null);

     }

     async nextTurn(duel) {
        if(duel.timeoutId) {
            clearTimeout(duel.timeoutId)
        }


        duel.turnoActual = duel.personajes.find(p => p.ID !== duel.turnoActual.ID)

        const result = await this.applyStatusEffect(duel.turnoActual)
        const notTurn = duel.personajes.find(p => p.ID !== duel.turnoActual.ID)

        const safeSend = async (player, content) => {
            if (player?.MDOrigin) {
              return player?.MDOrigin.send({ content }).then(m => setTimeout(() => m.delete(), 5000));
            } else {
              return notTurn.MDOrigin.send({ content }).then(m => setTimeout(() => m.delete(), 5000));
            }
          };


        if(result.effects.length > 0 || result.finished) {
            const text = `${result.effects.join("\n")}` +
                `\n\n${result.finished  ? `\n${result.finished}` : ""}`

            await safeSend(duel.turnoActual, text)

            duel.historialAcciones.push(`${result.effects.join("\n-# ")}` + `${result.finished  ? `\n${result.finished}` : ""}`)
        }

        duel.ronda++;
        duel.tiempoInicio = Date.now()

        duel.timeoutId = setTimeout(() => this.handleTimeout(duel), duel.tiempoLimite);

        if(duel.turnoActual.HP <= 0) {
            await this.endDuel(duel, "Victoria", notTurn)

            const message = duel.turnoActual.statusEffect > 0 ?  `¡${duel.turnoActual.Nombre} se ha debilitado por los efectos negativos!` : `¡Has derrotado a ${duel.turnoActual.Nombre} `
            return {
                success: true,
                message: message,
                gameOver: true,
                messageId: duel.channels
            }
        
        }
        
        await this.regenerator(duel.personajes)

        const stun = duel.turnoActual.statusEffect?.find(e => e.type === "stun");
        console.log("Efectos activos", duel.turnoActual.statusEffect)

        if (stun) {
          const roll = Math.random();
          if (roll < stun.probabilidad) {
            const text = duel.isNPC ? `-# El enemigo esta paralizado y no puede moverse...` : `💫 estás paralizado y no puedes moverte...`
            await safeSend(duel.turnoActual, text)
            await safeSend(notTurn, `${duel.turnoActual.Nombre} esta paralizado y no puede moverse`)

            duel.turnoActual = notTurn
            return {duel: duel, isNextTurn: false}
          }
        }

        return {duel: duel, isNextTurn: true}
     }

     async handleTimeout(duel) {

        try {
            if(duel.finalizado) return;

            duel.inactiveCount = (duel.inactiveCount || 0) + 1
    
    
            const inactivePlayer = duel.personajes.find(p => p.ID === duel.turnoActual.ID)
    
            if(duel.inactiveCount >= 4) {
                console.log("Terminando duelo por AFK")
                duel.historialAcciones.push(`**El duelo ha sido cancelado por inactividad**`)
                await this.endDuel(duel, "afk", inactivePlayer, 2)
                if(duel.timeoutId) {
                    clearTimeout(duel.timeoutId)
                }
    
    
    
    
                return { success: true, message: "Game Over por AFK", timeOut: true} 
    
            }
    
            duel.historialAcciones.push(`${inactivePlayer.Nombre} perdio su turno por no responder`)
    
            
            await this.nextTurn(duel);
            await this.selectEmbed(duel)
    
            if(duel.isNPC && duel.turnoActual.ID === duel.personajes[1].ID) {
               const results = await this.ejecutarAccionesNPC(duel)

               const result = results.duel

    
                if(result.finalizado) {
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
                        {name: result.ganador.Nombre, value: "`HP:`" + ` ${this.barradeVida(result.ganador.HP, result.ganador.stats.hpMax)}`, inline: true},
                        {name: result.defeated.Nombre, value: "`HP:`" + ` ${this.barradeVida(result.defeated.HP, result.defeated.stats.hpMax)}`, inline: true}
                    )
                    .setThumbnail(result.ganador.avatarURL)
                    .setFooter({text: `Este duelo finalizo en el turno ${(result.ronda - 1)}`})
                    if (result.historialAcciones.length > 0) {
                        const ultimasAcciones = result.historialAcciones.slice(-3).reverse();
                        const historialTexto = ultimasAcciones.map(accion => `• ${accion}`).join('\n');
                        endEmbed.addFields({ name: 'Últimas acciones', value: historialTexto, inline: false });
                    }
        
                    result.channels.edit({embeds: [endEmbed]})
                }else {
                    await this.selectEmbed(duel)
                }
            }
    
            return { success: true, messages: "Tiempo agotado", timeOut: true}
        } catch (e) {
            console.log(e)
        }

     }

     async processAction(duelId, playerId, action, actionParams = {}) {
        const duel = this.activeduels.get(duelId)

        if(!duel) return { success: false, message: "Duelo no encontrado"}

        let result = {success: false, message: "Accion no reconocida"}
        let effects;

        const activeChar = duel.personajes.find(p => p.ID === playerId);
        const targetChar = duel.personajes.find(p => p.ID !== playerId);

        duel.inactiveCount = 0

        switch (action) {
            case 'attack':
                result = await this.handleAttack(duel, activeChar, targetChar, actionParams);

                if(duel.mirror.esPosible) {
                    this.recordarAccionesJugador(duel, 1, null)
                }

                break;
            case 'defend':
                result = this.handleDefend(duel, activeChar, actionParams);

                if(duel.mirror.esPosible) {
                    this.recordarAccionesJugador(duel, 2, null)
                }

                break;
            case 'spells':
                result = await this.handleSpell(duel, activeChar);
                break;
            case 'bag':
                result = await this.handleItem(duel, activeChar);
                break;
            case 'surrender':
                result = this.handleSurrender(duel, activeChar, targetChar);
                break;
        }

        if(result.success) {
            effects = await this.nextTurn(duel)

            if(effects.gameOver) {
                return {...result, message: effects.message, gameOver: effects.gameOver, messageId: effects.messageId}
            }
        }




        return {...result, isNexturn: effects?.isNextTurn};
     }

     async handleAttack(duel, attacker, defender, parametros) {
        let equipamiento;

        const dañoBase = Math.floor(Math.random() * (7 - 4) + 3)
        const characterStrenght = attacker.stats.fuerza || 1;
        const levelBonus = 1 + (attacker.nivelMagico * 0.3)  
        const chanceCritico = ((attacker.stats.sabiduria * 2) + (attacker.stats.agilidad * 2))  / 100
        const CritMultip = 1.5;
        const enemyDefense = (1 + (defender.defenseActual || 1)) * ((defender.stats.resistenciaFisica + 1) + (defender.nivelMagico * 0.27))
        let weaponInfo;
        let messageAuthor
        let critico = false

        if(attacker.ID !== attacker.Type) {
            equipamiento = attacker?.equipo?.find(i => i.Type === 1)
        }

        if(equipamiento) {
        weaponInfo = await this.getObjetInfo(equipamiento.Region, equipamiento.ID)
        }

        let dañoTotal = (weaponInfo?.atributos?.fuerza|| 0) + (dañoBase * (characterStrenght * levelBonus))

        if((Math.random() < chanceCritico)) {
            dañoTotal *= CritMultip
            critico = true
        }


        dañoTotal = Math.max(Math.round(dañoTotal - enemyDefense), 1)

        defender.HP = Math.max(0, defender.HP-dañoTotal)
        defender.defenseActual = 1

        if(critico) {
            duel.historialAcciones.push(`${attacker.Nombre} atacó a ${defender.Nombre} y le provoco un **daño critico** de **${dañoTotal}**`)
            messageAuthor = `Atacaste a ${defender.Nombre} y le provocaste un **daño critico** de **${dañoTotal}**`
        }else {
            duel.historialAcciones.push(`${attacker.Nombre} atacó a ${defender.Nombre} causando **${dañoTotal}** de daño`);
            messageAuthor = `Atacaste a ${defender.Nombre} causando ${dañoTotal} de daño`
        }
        

        if(defender.HP <= 0) {
            await this.endDuel(duel, "Victoria", attacker)
            return {
                success: true,
                message: `¡${attacker.Nombre} ha derrotado a ${defender.Nombre}!`,
                gameOver: true,
                messageId: duel.channels
            }
        }

        await this.getDialogues(duel.personajes[0], duel.personajes[1], duel, null, null);

        return { success: true, message: `${messageAuthor}` };
     }
     
     handleDefend(duel, defender, parametros) {
        const def =  (1 + Math.floor(Math.random() * (6 - 2) + 2))

        duel.historialAcciones.push(`${defender.Nombre} Ha aumentado su defensa en **${def} puntos**`)

        defender.defenseActual = def + (defender.defenseActual || 0)

        return {success: true, message: `Te preparas para el siguiente ataque. Tu defensa ha aumentado un total de **${def} puntos**`}
     }

     async handleItem(duel, owner, page = 0, parametros) {
        try {
            const characterB = await character.findOne({ID: owner.ID})
            if (!characterB || !characterB.Inventario || characterB.Inventario.length === 0) {
                return { success: false, message: "¡No tienes objetos en tu inventario para usar!" };
            }

            const characterInventory = characterB.Inventario

            const inventarioInfo = []

            for(const item of characterInventory) {
                const fullItemInfo = await this.getObjetInfo(item.Region, item.ID)

                if(fullItemInfo) {
                    const completeItem = {
                        ...fullItemInfo,
                        cantidad: item.Cantidad
                    }

                    if (fullItemInfo.restricciones.InCombat) {
                        inventarioInfo.push(completeItem)
                        
                    }
                }
            }

            if(inventarioInfo.length === 0) {
                return { success: false, message: "No tienes objetos que puedan ser usados en combate" };
            }


     

            const itemPorPagina = 15;
            const totalPage = Math.ceil(inventarioInfo.length / itemPorPagina)
            const itemsPaginas = inventarioInfo.slice(page * itemPorPagina, (page + 1) * itemPorPagina)
            const embedBag = new EmbedBuilder()
            .setTitle("Tu bolsa de objetos")
            .setDescription(`Selecciona un objeto para usar en el combate.`)
            .setColor("Blurple")
            .setThumbnail(owner.avatarURL)

            itemsPaginas.forEach((item, index) => {
                embedBag.addFields({
                    name: `${item.ID}. ${item.Nombre} (x${item.cantidad || 1})`,
                    value: `${item.Descripcion?.substring(0, 100) || "Sin descripción"}`,
                    inline: true
                });
            });

            const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`UseItem-${owner.userAuthor}-${duel.id}-${page}`)
            .setPlaceholder("Selecciona el objeto a usar")
            .setMaxValues(1)

            itemsPaginas.forEach((item, index) => {
                selectMenu.addOptions({
                    label: `${item.Nombre} (x${item.cantidad || 1})`,
                    description: item?.Descripcion?.substring(0, 40) || "Sin descripción",
                    value: `UseDuel*${item.ID}*${item.Region}`,
                });
            });


            const navigationRow = new ActionRowBuilder()

            if(totalPage > 1 ) {
                navigationRow.addComponents(
                    new ButtonBuilder()
                    .setCustomId(`BagPage-${owner.userAuthor}-prev-${duel.id}-${page > 0 ? page - 1 : totalPage - 1}`)
                    .setEmoji("⬅️")
                    .setStyle(ButtonStyle.Secondary),

                    new ButtonBuilder()
                    .setCustomId(`BagPage-${owner.userAuthor}-next-${duel.id}-${page < totalPage - 1 ? page + 1 : 0}`)
                    .setEmoji("➡️")
                    .setStyle(ButtonStyle.Secondary),

                    new ButtonBuilder()
                    .setCustomId(`DuelAct-${owner.userAuthor}-${owner.ID}-cancel-${duel.id}-0`)
                    .setEmoji("❌")
                    .setStyle(ButtonStyle.Primary)
                )
            }else {
                navigationRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`DuelAct-${owner.userAuthor}-${owner.ID}-cancel-${duel.id}-0`)
                            .setLabel('Volver')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji("❌")
                )
            }

            const selectRow = new ActionRowBuilder().addComponents(selectMenu)

            await owner.messageOrigin.edit({embeds: [embedBag], components: [selectRow, navigationRow]})

            return {success: false, message: `Selecciona un objeto de tu bolsa`, requiresAction: true}

        } catch (e) {
            console.log(e)
            return {success: false, message: `Ha ocurrido un error al intentar mostrar tus objetos`};
        }
     }

     async handleSpell(duel, owner, page = 0, parametros) {
        try {
            // Buscar el personaje y sus hechizos en la base de datos
            const characterB = await soul.findOne({ ID: owner.ID });
            
            if (!characterB || !characterB.hechizos || characterB.hechizos.length === 0) {
                return { success: false, message: "¡No conoces ningún hechizo para usar en combate!" };
            }

            const characterSpells = characterB.hechizos
            const inventarioInfo = []




            for(const spell of characterSpells) {
                const fullItemInfo = await this.getSpellInfo(spell.ID)



                if(fullItemInfo) {
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
            
            // Crear el embed
            const embed = new EmbedBuilder()
                .setTitle("Libro de Hechizos")
                .setDescription(`**Mana actual:** ${owner.Mana}/${owner.manaMax}\n\n*Selecciona un hechizo para lanzar en combate.*`)
                .setColor("Purple")
                .setFooter({text: `Página ${page + 1} de ${totalPages}`})
                .setThumbnail("https://i.pinimg.com/736x/7d/33/71/7d337139c1c5c6845325e9110aadf12a.jpg");
            
            // Añadir cada hechizo al embed
            paginatedSpells.forEach((spell, index) => {
                embed.addFields({
                    name: `${index + 1}. ${spell.Nombre} (${spell.Costos.mana || 0} mana)`,
                    value: spell.Descripcion || "Sin descripción",
                    inline: true
                });
            });
            
            // Crear el menú select
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`UseSpell-${owner.userAuthor}-${duel.id}-${page}`)
                .setPlaceholder('Selecciona un hechizo para lanzar')
                .setMaxValues(1);
            
            // Añadir opciones al menú
            paginatedSpells.forEach((spell, index) => {
                selectMenu.addOptions({
                    label: `${spell.Nombre} (${spell.Costos.mana || 0} mana)`,
                    description: spell.Descripcion?.substring(0, 50) || "Sin descripción",
                    value: `cast*${spell._id || spell.id}`,
                    emoji: spell.emoji || "🔮"
                });
            });
            
            // Botones de navegación
            const navigationRow = new ActionRowBuilder();
            
            if (totalPages > 1) {
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`SpellPage-${owner.userAuthor}-prev-${duel.id}-${page > 0 ? page - 1 : totalPages - 1}`)
                        .setLabel('Anterior')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji("⬅️"),
                    
                    new ButtonBuilder()
                        .setCustomId(`SpellPage-${owner.userAuthor}-next-${duel.id}-${page < totalPages - 1 ? page + 1 : 0}`)
                        .setLabel('Siguiente')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji("➡️"),
                        
                    new ButtonBuilder()
                        .setCustomId(`DuelAct-${owner.userAuthor}-${owner.ID}-cancel-${duel.id}-0`)
                        .setLabel('Volver')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji("❌")
                );
            } else {
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`DuelAct-${owner.userAuthor}-${owner.ID}-cancel-${duel.id}-0`)
                        .setLabel('Volver')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji("❌")
                );
            }
            
            // Crear el row para el select menu
            const selectRow = new ActionRowBuilder().addComponents(selectMenu);
            
            // Enviar mensaje con el embed y los componentes
            await owner.messageOrigin.edit({
                embeds: [embed],
                components: [selectRow, navigationRow]
            });
            
            return { success: false, message: "Selecciona un hechizo para lanzar", requiresAction: true };
        } catch (error) {
            console.error("Error al mostrar libro de hechizos:", error);
            return { success: false, message: "Ha ocurrido un error al mostrar tus hechizos" };
        }
     }

     handleSurrender(duel, surrender, winner) {
        duel.historialAcciones.push(`**${surrender.Nombre} se ha rendido**`)


        this.endDuel(duel, "Victoria", winner, 1)

        return {
            success: true,
            message: `Te has rendido. ${winner.Nombre} gana el duelo`,
            gameOver: true,
            messageId: duel.channels,
        }
     }


     async endDuel(duel, reason, winner, parametros) {

        const winnerPlayer = duel.personajes.find(p => p.ID === winner.ID);
        const defeatedPlayer = duel.personajes.find(p => p.ID !== winner.ID);
        const player = duel.personajes.find(p => p.messageOrigin !== null)
        const npc = duel.personajes.find(p => p.messageOrigin === null)



        if(!duel) return false;


        if(parametros === 1) {
            const messagesContent = [
                `*"¡Tu varita se cae de tu mano! La enfermería del Instituto espera con pociones reconstituyentes...*`,
                `*El peso de la derrota es inevitable. Rompes tu sello de combate y retrocedes. ¡El orgullo duele más que las heridas!*`,
                `*El oraculo predijo esta derrota... ${winnerPlayer.Nombre} ha hecho que esta profecia se cumpliera*`,
            ]

            const gifsDead = [
                "https://c.tenor.com/MMA6_WvqS60AAAAd/tenor.gif",
                "https://c.tenor.com/am4tzoTsnRoAAAAd/tenor.gif",
                "https://c.tenor.com/mUIXigPWPuYAAAAd/tenor.gif",
                "https://c.tenor.com/XbfdY2Lx-zwAAAAd/tenor.gif",
                "https://c.tenor.com/QflxuGwf_IwAAAAd/tenor.gif", //Apartir de este gif empiezan retiradas normales
                "https://c.tenor.com/sigrrzQkKi4AAAAd/tenor.gif",
                "https://c.tenor.com/ScWPoTxfu5cAAAAd/tenor.gif",
                "https://c.tenor.com/5lvXZOwWSq0AAAAd/tenor.gif",
            ]

            const gifsSelect = gifsDead[Math.floor(Math.random() * gifsDead.length)]
            const messageSelect = messagesContent[Math.floor(Math.random() * messagesContent.length)]

            const objDefeated = {
                selectGif: gifsSelect,
                selectMessage: messageSelect
            }

            const messageContent2 = [
                `¡VICTORIA POR DEFAULT! ${defeatedPlayer.Nombre} ha huido del campo de batalla. La gloria es tuya, aunque el combate quedó inconcluso`,
                `¿Miedo o sabiduría? Aceptas la rendición de ${defeatedPlayer.Nombre} con un gesto noble, pero tu ego pide más acción`,
                `¡LA ARENA CORONA A SU CAMPÉON! Recibes una lluvia de petalos al aceptar la rendición de ${defeatedPlayer.Nombre}`,
                `¡JAQUE MATE PSICOLÓGICO! ${defeatedPlayer.Nombre} no soportó tu mirada intimidante y huyó`,
                `¡BRILLO TÁCTICO! ${defeatedPlayer.Nombre} se rindio al ver tu sonrisa de confianza. ¿Estrategia o suerte?`
            ]

            const gifsWinnerSurrend = [
                "https://c.tenor.com/QyxNhEWGZmgAAAAd/tenor.gif",
                "https://c.tenor.com/rKqdDp_s0oYAAAAd/tenor.gif",
                "https://c.tenor.com/fjgE4PiJdAMAAAAd/tenor.gif",
                "https://c.tenor.com/ZE1DnkL3qigAAAAd/tenor.gif",
            ]

            const messageSelect2 = messageContent2[Math.floor(Math.random() * messageContent2.length)]
            const gifsSelect2 = gifsWinnerSurrend[Math.floor(Math.random() * gifsWinnerSurrend.length)]

            const objWinner = {
                selectGif: gifsSelect2,
                selectMessage: messageSelect2
            }

            if(duel.isNPC) {
                if(winnerPlayer.ID == player) {
                    const EmbedWinner = await this.updateEmbed(winnerPlayer, defeatedPlayer, duel, true, true, false, objWinner);
                    player.messageOrigin.edit({embeds: [EmbedWinner], components: []})
                }else {
                    const EmbedDefeat = await this.updateEmbed(defeatedPlayer, winnerPlayer, duel, false, true, true, objDefeated);
                    player.messageOrigin.edit({embeds: [EmbedDefeat], components: []})
                }

            }else {
                const EmbedWinner = await this.updateEmbed(winnerPlayer, defeatedPlayer, duel, true, true, false, objWinner);
                const EmbedDefeat = await this.updateEmbed(defeatedPlayer, winnerPlayer, duel, false, true, true, objDefeated);

                winnerPlayer.messageOrigin.edit({embeds: [EmbedWinner], components: []})
                defeatedPlayer.messageOrigin.edit({embeds: [EmbedDefeat], components: []})
            }

           
          
    

        }else if(parametros === 2) {
            const messagesContent = [
                `*"El tiempo magico se congeló... el duelo se ha cancelado debido a que los dos jugadores se quedaron afk*`,
                `*¿Siguen ahi? El duelo fue cancelado debido a que los jugadores se quedaron AFK*`,
                `*Fueron enviado al reino de los AFK.  El duelo fue cancelado debido a que los jugadores se quedaron AFK`,
            ]

            const gifsDead = [
                "https://c.tenor.com/wI_7nfZiX2UAAAAd/tenor.gif",
                "https://c.tenor.com/urs-gwqkOV8AAAAd/tenor.gif",
                "https://c.tenor.com/4o5tuOdYvTAAAAAd/tenor.gif",
                "https://c.tenor.com/2TowZVLGj2oAAAAd/tenor.gif",
                "https://c.tenor.com/UVHo2m3hHckAAAAd/tenor.gif", //Apartir de este gif empiezan retiradas normales
                "https://c.tenor.com/gjBx2zbdJjAAAAAd/tenor.gif",
                "https://c.tenor.com/MUh5wIdD-E0AAAAd/tenor.gif",
                "https://c.tenor.com/1fgzvqahPHAAAAAd/tenor.gif",
            ]

            const gifsSelect = gifsDead[Math.floor(Math.random() * gifsDead.length)]
            const messageSelect = messagesContent[Math.floor(Math.random() * messagesContent.length)]

            const objDefeated = {
                selectGif: gifsSelect,
                selectMessage: messageSelect
            }

            if(duel.isNPC) {
                if(winnerPlayer.ID == player) {
                    const EmbedWinner = await this.updateEmbed(winnerPlayer, defeatedPlayer, duel, true, true, true, objDefeated);
                    player.messageOrigin.edit({embeds: [EmbedWinner], components: []})
                }else {
                    const EmbedDefeat = await this.updateEmbed(defeatedPlayer, winnerPlayer, duel, false, true, true, objDefeated);
                    player.messageOrigin.edit({embeds: [EmbedDefeat], components: []})
                }

            }else {
                const EmbedWinner = await this.updateEmbed(winnerPlayer, defeatedPlayer, duel, true, true, true, objDefeated);
                const EmbedDefeat = await this.updateEmbed(defeatedPlayer, winnerPlayer, duel, false, true, true, objDefeated);
        
                winnerPlayer.messageOrigin.edit({embeds: [EmbedWinner], components: []})
                defeatedPlayer.messageOrigin.edit({embeds: [EmbedDefeat], components: []})
            }






            const gifsAFK = [
                "https://c.tenor.com/MUh5wIdD-E0AAAAd/tenor.gif",
                "https://c.tenor.com/LRCE-IlHdv4AAAAd/tenor.gif",
                "https://c.tenor.com/2TowZVLGj2oAAAAd/tenor.gif",
                "https://c.tenor.com/NBQd0KD6n54AAAAd/tenor.gif",
                "https://c.tenor.com/GI8ZFPuS9TwAAAAd/tenor.gif",
                "https://c.tenor.com/5827O35fBsoAAAAd/tenor.gif",
            ]

            const gifSelect = gifsAFK[Math.floor(Math.random() * gifsAFK.length)]

            const endEmbed = new EmbedBuilder()
            .setTitle("¡El duelo ha finalizado por inactividad!")
            .setDescription(`¿Y asi acabó? Al parecer los usuarios nunca más regresaron... **[Nadie ha ganado]** `)
            .addFields(
                {name: winnerPlayer.Nombre, value: "`HP:`" + ` ${this.barradeVida(winnerPlayer.HP, winnerPlayer.stats.hpMax)}`, inline: true},
                {name: defeatedPlayer.Nombre, value: "`HP:`" + ` ${this.barradeVida(defeatedPlayer.HP, defeatedPlayer.stats.hpMax)}`, inline: true}
            )
            .setFooter({text: `Este duelo finalizo en el turno ${(duel.ronda - 1)}`})
            .setImage(gifSelect)
            if (duel.historialAcciones.length > 0) {
                const ultimasAcciones = duel.historialAcciones.slice(-3).reverse();
                const historialTexto = ultimasAcciones.map(accion => `• ${accion}`).join('\n');
                endEmbed.addFields({ name: '¿A esto le llamas acciónes?', value: historialTexto, inline: false });
                duel.channels.edit({embeds: [endEmbed]})
            }

        }else {
            const messagesContent = [
                `*¡La estrella del duelo brilla para ti! ${defeatedPlayer.Nombre} se inclina ante tu dominio*`,
                `*¡Victoria Épica! ${winnerPlayer.Nombre} Celebra con emoción!*`,
                `*¡Increible dominio! ${defeatedPlayer.Nombre}  no pudo descifrar tus runas de combate*`,
            ]

            const gifsWin = [
                "https://c.tenor.com/YXXkNqv16AgAAAAd/tenor.gif",
                "https://c.tenor.com/oTCZi_rw6FsAAAAd/tenor.gif",
                "https://c.tenor.com/mjTBpxxGig8AAAAd/tenor.gif",
                "https://c.tenor.com/cegQvCIt34UAAAAd/tenor.gif",
                "https://c.tenor.com/8Gu7ihnHlr8AAAAd/tenor.gif",
                "https://c.tenor.com/uYUQPKe2S3QAAAAd/tenor.gif",
                "https://c.tenor.com/CcjgaZNW_rkAAAAd/tenor.gif",
                "https://c.tenor.com/S4e7zz52p8gAAAAd/tenor.gif",
                "https://c.tenor.com/lvlf2XuFYrIAAAAd/tenor.gif",
                "https://c.tenor.com/uiak6BECN_sAAAAd/tenor.gif",
                "https://c.tenor.com/hogpCcg50NIAAAAC/tenor.gif"
            ]

            const gifsSelect = gifsWin[Math.floor(Math.random() * gifsWin.length)]
            const messageSelect = messagesContent[Math.floor(Math.random() * messagesContent.length)]

            const objWinner = {
                selectGif: gifsSelect,
                selectMessage: messageSelect
            }

            const messagesContent2 = [
                `*Tu varita se apaga... ${winnerPlayer.Nombre} te ha superado en esta batalla. Suerte la proxima vez*`,
                `*Tu personaje no puede más... ${winnerPlayer.Nombre} ha agotado toda tu energia. ¡Recupera fuerzas para la revancha!*`,
                `*El oraculo predijo esta derrota... ${winnerPlayer.Nombre} ha hecho que esta profecia se cumpliera*`,
            ]

            const gifsDead = [
                "https://c.tenor.com/y0dPmn6pPF8AAAAd/tenor.gif",
                "https://c.tenor.com/sho2lF0Ai2EAAAAd/tenor.gif",
                "https://c.tenor.com/qEBvxi73QRYAAAAd/tenor.gif",
                "https://c.tenor.com/Sm05Mnf5Rr4AAAAd/tenor.gif",
                "https://c.tenor.com/8Gu7ihnHlr8AAAAd/tenor.gif",
                "https://c.tenor.com/ZtMsZWD9jEcAAAAd/tenor.gif",
            ]

            const gifsSelect2 = gifsDead[Math.floor(Math.random() * gifsDead.length)]
            const messageSelect2 = messagesContent2[Math.floor(Math.random() * messagesContent2.length)]

            const objDefeated = {
                selectGif: gifsSelect2,
                selectMessage: messageSelect2
            }


            if(duel.isNPC) {
                if(winnerPlayer.ID == player.ID) {
                    const EmbedWinner = await this.updateEmbed(winnerPlayer, defeatedPlayer, duel, true, true, false, objWinner);
                    player.messageOrigin.edit({embeds: [EmbedWinner], components: []})

                }else {
                    const EmbedDefeat = await this.updateEmbed(defeatedPlayer, winnerPlayer, duel, false, true, true, objDefeated);
                    player.messageOrigin.edit({embeds: [EmbedDefeat], components: []})
                }

            }else {
                const EmbedWinner = await this.updateEmbed(winnerPlayer, defeatedPlayer, duel, true, true, false, objWinner);
                const EmbedDefeat = await this.updateEmbed(defeatedPlayer, winnerPlayer, duel, false, true, true, objDefeated);
        
                winnerPlayer.messageOrigin.edit({embeds: [EmbedWinner], components: []})
                defeatedPlayer.messageOrigin.edit({embeds: [EmbedDefeat], components: []})
            }

        }





        if(duel.timeoutId) {
            clearTimeout(duel.timeoutId)
        }

        if(parametros === 2) {
            duel.finalizado = true;
            duel.razonFinalizacion = reason;
            duel.ganador = winnerPlayer;
            duel.defeated = defeatedPlayer
            duel.isAFK = parametros === 2 ? true : false
    
            this.activeduels.delete(duel.id)
        }else {    
            duel.finalizado = true;
            duel.razonFinalizacion = reason;
            duel.ganador = winnerPlayer;
            duel.defeated = defeatedPlayer
            duel.isSurrender = parametros === 1 ? true : false
    
            this.activeduels.delete(duel.id)
        }


        if(duel.isNPC) {
            await soul.updateOne({ID: player.ID}, {
                $set: {HP: player.HP, Mana: player.Mana},
                $inc: {[`npcDefeated.${npc._id}`]: 1},
                
            }, {upsert: true})

            duelEmitter.emit(`duelEnded-${player.ID}`, {
                winnerId: winnerPlayer,
                defeatedId: defeatedPlayer,
                duelId: duel.id,
                isAFK: duel.isAFK
            })
        }else {

            await soul.updateOne({ID: winnerPlayer.ID}, {
                $set: {HP: winnerPlayer.HP, Mana: winnerPlayer.Mana}
            })
    
            await soul.updateOne({ID: defeatedPlayer.ID}, {
                $set: {HP: defeatedPlayer.HP, Mana: defeatedPlayer.Mana}
            })
        }



        return true
     }


     async useItem(duel, user, target, ItemParam) {
        const isNPCActor = duel?.isNPC && user.ID === duel?.personajes[1].ID
        const atributosValidos = new Set(['HP', 'Mana', 'Stamina', 'Defensa'])

        try {
            const objetoExist = await this.getObjetInfo(ItemParam.Region, ItemParam.ID)

            if(!objetoExist && isNPCActor) {
                return {success: false, message: "No se pudo encontrar el objeto seleccionado"}
            }

            if(objetoExist.usableInCombat && isNPCActor) {
                return { success: false, message: "Este objeto no puede ser usado en combate"}
            }

            const effectsAp = []

            switch(objetoExist.Tipo) {
                case "Consumible":
                    const atributos = objetoExist.atributos;


                    for(const key in atributos) {
                        if(atributosValidos.has(key) && atributos.hasOwnProperty(key) && typeof user[key] === 'number') {
                            
                            user[key] += atributos[key]



                            if(key === 'HP' && user[key] > user.stats.hpMax) {
                                user[key] = user.stats.hpMax
                            }


                            if(key === 'Mana' && user[key] > (user.manaMax || user.stats.manaMax)) {
                                user[key] = (user.manaMax || user.stats.manaMax)
                            }

                            if(!duel) {
                                await soul.updateOne({ID: user.ID}, {
                                    $set: {
                                        [`${key}`]: user[key]
                                    }
                                })
                            }


                            effectsAp.push(`**${key} +${atributos[key]}**`)
                        }
                    }


                break;
                default: effectsAp.push(`Usaste el objeto pero no tuvo ningun efecto especial`)
            }

            if(!isNPCActor) {
                await character.updateOne({ID: user.ID}, {
                    $inc: {
                        "Inventario.$[objeto].Cantidad": -1
                    }
                }, {
                    arrayFilters: [
                        {"objeto.ID": objetoExist.ID}
                    ]
                })
    
                await character.updateOne(
                    { ID: user.ID },
                    { $pull: { Inventario: { Cantidad: { $lte: 0 } } } }
                );
            }



            if(!duel) {
                return {success: true, message: `Has usado ${objetoExist.Nombre} y obtuviste ${effectsAp.join(", ")}`}
            }else {
                if(duel.mirror.esPosible) {
                    const dataItem = {
                        itemID: objetoExist
                    }
    
                    this.recordarAccionesJugador(duel, 3, dataItem)
                }

                duel.historialAcciones.push(`${user.Nombre} usó *${objetoExist.Nombre}*. [${effectsAp.join(", ")}]`)
            }

            return {success: true, message: `Has usado ${objetoExist.Nombre} y obtuviste ${effectsAp.join(", ")}`}




        } catch (e) {
            console.log(e)
            return {success: false, message: `Ha ocurrido un error al usar el objeto`}
        }
     }

     async useSpell(duel, user, target, SpellParam) {
        const isNPCActor = duel.isNPC && user.ID === duel.personajes[1].ID
        if(isNPCActor) {

            console.log("Data spell:", SpellParam, "Dataselect", SpellParam.spellID)
            const spellNPC = await this.getSpellInfo(SpellParam.spellID)
            const validTargets = await this.getAllTargets(spellNPC, user, target, null)

            const result = await this.applyEffectsSpell(spellNPC, user, validTargets.targets, validTargets.targetsEffects, duel);

            duel.historialAcciones.push(result.summaryMessage)

            if(target.HP <= 0) {
                await this.endDuel(duel, "Victoria", user)
                return {
                    success: true,
                    message: `¡${user.Nombre} ha derrotado a ${target.Nombre}!`,
                    gameOver: true,
                    messageId: duel.channels
                }
            }

            return {success: true, message: result.detailedMessage}

        }

        const spellExist = await this.getSpellInfo(SpellParam)

        if(!spellExist) {
            return { success: false, message: "No se ha podido encontrar le hechizo"}
        }

        if(spellExist.isActive && spellExist.InCombat) {
            return { success: false, message: "Al parecer este hechizo esta prohibido o no se puede usar en este momento [¿Desactivado?]"}
        }
        
        const spellCost = await this.deductSpellCost(spellExist, user)

        if(!spellCost.success) {
            return { success: false, message: spellCost.message}
        } 

        try {
            const baseProb = spellExist.Mecanicas.castProbabilidad
            const bonusIntel = user.stats.inteligencia * 0.015
            const probCast = Math.min(1, baseProb + bonusIntel)
            const isCast = Math.random() <= probCast

            console.log("Proabilidad:", `${probCast * 100}%`)
            console.log("Se casteó el hechizo?:", isCast)

            if(!isCast) {
                duel.historialAcciones.push(`${user.Nombre} intento conjurar un hechizo, pero falló en el intento`)
                return { success: true, message: "Intentaste conjurar el hechizo, sin embargo fallaste", spellFailed: true}
            }



            const validTargets = await this.getAllTargets(spellExist, user, target, null)

            const result = await this.applyEffectsSpell(spellExist, user, validTargets.targets, validTargets.targetsEffects, duel);

            //Agregar aqui el cooldown
            duel.historialAcciones.push(result.summaryMessage)

            if(duel.mirror.esPosible) {
                const dataSpell = {
                    spellID: spellExist._id
                }

                this.recordarAccionesJugador(duel, 4, dataSpell)
            }

            if(target.HP <= 0) {
                await this.endDuel(duel, "Victoria", user)
                return {
                    success: true,
                    message: `¡${user.Nombre} ha derrotado a ${target.Nombre}!`,
                    gameOver: true,
                    messageId: duel.channels
                }
            }

            return {success: true, message: result.detailedMessage}


            
        } catch (e) {
            console.log(e)
            return {success: false, message: `Ha ocurrido un error al intentar conjurar el hechizo`}
        }
     }


     async getTargetsForObjetive(objective, caster, selectedTarget, allies, enemies) {


        
        switch (objective) {
            case 1: // Enemigo
              return selectedTarget || enemies[0];
            case 2: // Aliado
              return selectedTarget || (allies.find(ally => ally.id !== caster.id) || allies[0]);
            case 3: // Uno mismo
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

     async getAllTargets(spell, caster, selectedTarget, battleState) {
        const { allies = [], enemies = []} = battleState || {};

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

     async applyEffectsSpell(spell, caster, targets, effectsTargets, duel) {
        const results = {
            damage: [],
            healing: [],
            otherEffects: []
        };
        const mechanics = spell.Mecanicas

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
            Krýo: {
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
        }

        if(!(Object.keys(targets).length === 0)) {
            if(mechanics?.damage) {
                let isElemental = { Bonus: false, message: ""}
    
                let targetDamage = targets.damage
    
                if (!Array.isArray(targetDamage)) {
                    targetDamage = [targetDamage];
                  }
    
                for (const target of targetDamage) {
                    const efecto = efectividadElemental[spell.Elemento];
            
                    if(efecto.fuerteContra.includes(target.Elemento)) {
                        multipElement = 1.3 // 30% de daño adicional
                        isElemental = { Bonus: true, message: "Bonificacion por Fuerte Elemental"}
                    }else if(efecto.debilContra.includes(target.Elemento)) {
                        multipElement = 0.7 // -30% de daño adicional
                        isElemental  = { Bonus: false, message: "Daño Reducido por Debilidad Elemental"}
                    }else {
                        multipElement = 1
                        isElemental = { Bonus: false, message: "Sin bonus elementales"}
                    }
    
                    // Calcular daño base + scaling
                    let damageAmount = this.calculateEffectAmount(mechanics.damage, caster, multipElement)
    
                target.HP = Math.max(0, target.HP-damageAmount)
    
                results.damage.push({
                    target: target,
                    effect: 'damage',
                    amount: damageAmount,
                    isElemental
                });
            }
    
            }
    
            if(mechanics?.healing) {
    
                let isElemental = { Bonus: false, message: ""}
    
    
                let healingTargets = targets.healing
    
                if (!Array.isArray(healingTargets)) {
                    healingTargets = [healingTargets];
                  }
                for (const target of healingTargets) {
    
                    const efecto = efectividadElemental[spell.Elemento];
    
                    if(efecto.fuerteContra.includes(target.Elemento)) {
                        multipElement = 1.3 // 30% de daño adicional
                        isElemental = { Bonus: true, message: "[Bonificacion por Fuerte Elemental]"}
                    }else if(efecto.debilContra.includes(target.Elemento)) {
                        multipElement = 0.7 // -30% de daño adicional
                        isElemental  = { Bonus: false, message: "[Daño Reducido por Debil Elemental]"}
                    }else {
                        multipElement = 1
                        isElemental = { Bonus: false, message: "[Sin bonus elementales]"}
                    }
    
                  const healAmount = this.calculateEffectAmount(mechanics.healing, caster, multipElement);
                  target.HP += healAmount;
                  if (target.HP > target.stats.hpMax) target.HP = target.stats.hpMax;
    
                  
                    results.healing.push({
                      target: target,
                      effect: 'healing',
                      amount: healAmount,
                      isElemental
                    });
                }
            }
        }

        if(!(Object.keys(effectsTargets).length === 0)) {
            for (const key of Object.keys(mechanics.Efectos)) {
                let effectTargets = effectsTargets[key]

                if (!Array.isArray(effectTargets)) {
                    effectTargets = [effectTargets];
                }
            
                for(const target of effectTargets) {

                    target.statusEffect.push({
                            type: key,
                            Nombre: mechanics.Efectos[key].Nombre,
                            base: Math.round(mechanics.Efectos[key].base + (1 + (caster.stats.poderElemental * 2))),
                            duracion: mechanics.Efectos[key].duracion,
                            probabilidad: mechanics.Efectos[key].probabilidad || null
                        })

                    results.otherEffects.push({
                        target: target,
                        effect: key,
                        nombreEfecto: mechanics.Efectos[key].Nombre,
                        duracion: mechanics.Efectos[key].duracion
                    });
                }

        }
        }


        await this.getDialogues(duel.personajes[0], duel.personajes[1], duel, null, null);

        const detailedMessage = this.generateDetailedMessage(spell, caster, results);
        const summaryMessage = this.generateSummaryMessage(spell, caster, results);
    
        return {
            results: results,
            detailedMessage: detailedMessage,
            summaryMessage: summaryMessage
        };
     }

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
            switch(effect.type) {
                case "damage": 
                    const damageBase = effect.base
                    let total

                    if(effect.reduct) {
                        const resist = Math.min(character.stats.voluntad * 0.5, 70)

                        total = Math.max(Math.round((damageBase) * (1 - resist / 100)), 1)
                    }else {
                        total = damageBase
                    }

                    if(isNaN(total)) total = 1


                    character.HP = Math.max(0, character.HP-total)
                    effectAp.push(`${character.Nombre} sufre **${total}** de daño por` + "`" + effect.Nombre + "`")
                    break;
                case "pasive": 
                    const healBase = effect.base
                    let totalHeal;

                    const bonus = Math.max(character.stats.regeneracion * 0.03, 30) 

                    totalHeal = Math.round(healBase * (1 - bonus / 100))

                    character.HP -= totalHeal

                    if(character.HP > character.stats.hpMax) {
                        character.HP = character.stats.hpMax
                    }
                    effectAp.push(`${character.Nombre} ha regenerado **${total} HP** por ` + "`" + effect.nameEffect + "`")
                    break;
            }
        }

        let message;


        if(finished.length > 0) {
            const lista = finished
              .map(name => `**${name}**`)
              .join(', ');
            message = `**Efectos terminados:** ${lista}.`;
        }

        return {finished: message, effects: effectAp}
     }

     calculateEffectAmount(effect, caster, multipler = 1) {
        let amount = effect.base

        if(effect.scaling) {
            const statsValue = caster.stats[effect.scaling.stats] || 0;
            amount +=(statsValue * effect.scaling.multi) * multipler
        }

        return Math.floor(amount)
     } 

    async deductSpellCost(spell, caster) {
        const authorDinero = await character.findOne({ID: caster.ID})
        const cost = spell.Costos;

        if(caster.Mana < cost.mana) return {success: false, message: "No tienes suficiente mana para lanzar este hechizo"};
        if((caster.HP - 1) <= cost.Vida) return {success: false, message: "No tienes suficiente vida para lanzar este hechizo"};

        
        if(caster.cooldowns && caster.cooldowns[spell._id] > turns) return {success: false, message: "No puedes usar este hechizo por que esta en enfriamiento"}



        caster.Mana -= cost.mana
        caster.HP -= cost.Vida
        
        if(cost.Dinero) {
            if((authorDinero.Dinero || 0) < cost.Dinero) return {success: false, message: "No tienes suficiente dinero para lanzar este hechizo"};

            await character.updateOne({ID: authorDinero.ID}, 
                {
                    $inc: {
                        "Dinero": -cost.Dinero
                    }
                }
            ) 
        }

        return {success: true}

     }

    async regenerator(characters) {
        
        for(const personaje of characters) {

            if(!personaje.artefactoMagico) {
                personaje.Mana += 2

                if(personaje.Mana > personaje.manaMax) {
                    personaje.Mana = personaje.manaMax
                }
            }

        }
    }


    async executeSpecialAction(duel, npc, player, action) {
        const finalAction = action.phase.finalAction

        if(finalAction === "Espejear") {
            const clonedPlayer = JSON.parse(JSON.stringify(player))


            clonedPlayer.ID = npc.ID

            clonedPlayer.originalData = {
                stats: {...npc.stats},
                avatarURL: npc.avatarURL,
                attacks: [...npc.attacks],
            };

            clonedPlayer.messageOrigin   = null;
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

            const npcIndex = duel.personajes.findIndex(p => p.ID === npc.ID);
            duel.personajes[npcIndex] = clonedPlayer;

            duel.historialAcciones.push(`**${npc.Nombre}** se ha convertido en el espejo de **${player.Nombre}**`)
            npc.specialPhase.active = "success"
            duel.mirror.active = true

            duel.mirror.toReplay = [...duel.mirror.recordedActions];

        }
    }

    recordarAccionesJugador(duel, action, data) {
        const info = {
            action: action,
            data: data
        }

        duel.mirror.recordedActions.push(info)
    }

    async realizarAccionNPC(duel, npc, player, action, data){

        let actions;
        switch(action?.type || action) {
            case 1: 
                await this.handleAttack(duel, npc, player)
                actions = "attack"
            break;
            case 2: 
                await this.handleDefend(duel, npc)
                actions = "defend"
            break;
            case 3:
                await this.useItem(duel, npc, player, data)
                actions = "bag"
            break;
            case 4: 
                await this.useSpell(duel, npc, player, data)
                actions = "spell"
            break;
            case 5:
                await this.executeSpecialAction(duel, npc, player, action)
                actions = "especial"
            break;
            default: 
            actions = null;
            return {success: false}
        }

        return actions
    }

    getRandomAttackNPC(attacks) {
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


    async ejecutarAccionesNPC(duel) {
        const npc = duel.personajes[1];
        const player = duel.personajes[0]
        const specialAttack = npc?.attacks.find(t => t.type === 5)
        const normalAttacks = specialAttack ? npc.attacks.filter(a => a.type !== specialAttack.type) : [...npc.attacks];  
        let result;
        let selectedAttack;;

        await this.getDialogues(player, npc, duel, null, null);


        if(duel.mirror?.active) {
            console.log("Mirror activo")
            if(duel.mirror.toReplay && duel.mirror.toReplay.length > 0) {
                const next = duel.mirror.toReplay.shift();
                console.log(next)
                result = this.realizarAccionNPC(duel, npc, player, next.action, next?.data);
            }else {
                this.getRandomAttackNPC(normalAttacks)
            }

        }else if(!npc.specialPhase?.active) {
            console.log("Fase no activa")
            selectedAttack = this.getRandomAttackNPC(npc.attacks)
        }else {
            selectedAttack = specialAttack
        }


        if(selectedAttack?.type === specialAttack?.type) {

            npc.specialPhase ??= {};                  
            npc.specialPhase.turns ??= 0;             
            npc.specialPhase.turns += 1; 

            if(npc.specialPhase.turns < specialAttack.phase.preparationTurns) {
                selectedAttack = this.getRandomAttackNPC(specialAttack.phase.behavior)
                result = await this.realizarAccionNPC(duel, npc, player, selectedAttack) 
                duel.historialAcciones.push(`**${npc.Nombre} se preparara para realizar una acción... (${npc.specialPhase.turns}/${specialAttack.phase.preparationTurns})**`)
            }else {
               result = await this.realizarAccionNPC(duel, npc, player, specialAttack)
            }

        }else {
            result = this.realizarAccionNPC(duel, npc, player, selectedAttack)
        }


        await sleep(3000)
        await this.nextTurn(duel)
        return {duel: duel, action: result}
    }


    //Información:
    async getObjetInfo(region, id) {
        const idAutocomplete  = `${region}${id}`

        const documento = await objetos.findOne({_id: region, Objetos: { $elemMatch: { ID_Autocomplete: idAutocomplete}}}, 
            { projection: {"Objetos.$": 1}}
        )

        if (documento && documento.Objetos && documento.Objetos.length > 0) {
            return documento.Objetos[0];
        }

        return null
     }

    async getSpellInfo(id) {

        const documento = await hechizos.findOne({_id: id})

        if (documento) {
            return documento;
        }

        return null
     }


     //Generación de mensajes:

    async selectEmbed(duel, action) {

        const currentPlayer = duel.personajes.find(p => p.ID === duel.turnoActual.ID);
        const waitingPlayer = duel.personajes.find(p => p.ID !== duel.turnoActual.ID);
        const activeEmbed = await this.updateEmbed(currentPlayer, waitingPlayer, duel, true);
        const waitingEmbed = await this.updateEmbed(waitingPlayer, currentPlayer, duel, false);

        const actionButtons = this.createActionButtons(duel)
        const gifAction = await this.actionGifSelect(action)



        try {

            let user = this.client.users?.cache.get(duel.turnoActual.userAuthor)

            if(!user) {
             user = `${duel.turnoActual.Nombre}`
            }
            

            const embed = new EmbedBuilder()
            .setTitle("El duelo esta en curso...")
            .setDescription(user !== duel.turnoActual.Nombre ? `Es el turno de ${user} (${duel.turnoActual.Nombre})` : `Es el turno de ${user}`)
            .addFields(
                {name: currentPlayer.Nombre, value: "`HP:`" + ` ${this.barradeVida(currentPlayer.HP, currentPlayer.stats.hpMax)}`, inline: true},
                {name: waitingPlayer.Nombre, value: "`HP:`" + ` ${this.barradeVida(waitingPlayer.HP, waitingPlayer.stats.hpMax)}`, inline: true}
            )
            .setThumbnail(currentPlayer.avatarURL)
            .setFooter({text: "Esperando..."})
            .setImage(gifAction)
            if (duel.historialAcciones.length > 0) {
                const ultimasAcciones = duel.historialAcciones.slice(-3).reverse();
                const historialTexto = ultimasAcciones.map(accion => `• ${accion}`).join('\n');
                embed.addFields({ name: 'Últimas acciones', value: historialTexto, inline: false });
            }
            duel.channels.edit({embeds: [embed]})


            if(duel.isNPC) {
                const player1 = duel.personajes.find(p => p.messageOrigin !== null);

                if(duel.turnoActual.ID === player1.ID) {
                    player1.messageOrigin.edit({embeds: [activeEmbed], components: [actionButtons]})
                }else {
                    player1.messageOrigin.edit({embeds: [waitingEmbed], components: []})
                }
            }else {
                currentPlayer.messageOrigin.edit({embeds: [activeEmbed], components: [actionButtons]})
                waitingPlayer.messageOrigin.edit({embeds: [waitingEmbed], components: []})
            }


        } catch (e) {
         console.log(e)   
        }
     }

    async updateEmbed(currentChar, enemyChar, duel, isActiveTurn, isEnd, isDefeat, extras) {

        let EmbedAuthor;

 

        if(isEnd) {
            if(isDefeat) {
                    EmbedAuthor = new EmbedBuilder()
                    .setTitle("Tu personaje ha sido derrotado (Game Over)")
                    .setDescription(`${extras.selectMessage}\n` + "`HP:`"+ ` ${this.barradeVida(enemyChar.HP, enemyChar.stats.hpMax)} **(Rival)**`)
                    .addFields(
                        {name: "Tus Stats", value: "`HP:` " + `${this.barradeVida(currentChar.HP, currentChar.stats.hpMax, true)}`+ "\n`Mana:`" +
                        `${currentChar.Mana}/${currentChar.manaMax}`}
                    )
                    .setThumbnail(enemyChar.avatarURL)
                    .setImage(extras.selectGif)
                    .setColor("DarkRed");

            }else {
                EmbedAuthor = new EmbedBuilder()
                .setTitle("¡Felicidades, has ganado! ( •̀ ω •́ )y")
                .setDescription(`${extras.selectMessage}\n` + "`HP:`"+ ` ${this.barradeVida(enemyChar.HP, enemyChar.stats.hpMax)} **(Rival)**`)
                .addFields(
                    {name: "Tus Stats", value: "`HP:` " + `${this.barradeVida(currentChar.HP, currentChar.stats.hpMax, true)}`+ "\n`Mana:`" +
                    `${currentChar.Mana}/${currentChar.manaMax}`}
                )
                .setThumbnail(enemyChar.avatarURL)
                .setImage(extras.selectGif)
                .setColor("Green");
            }

        }else {
            EmbedAuthor = new EmbedBuilder()
            .setTitle(isActiveTurn ? `¡Es tu turno!` : `Esperando turno...`)
            .setDescription("`HP:`"+ ` ${this.barradeVida(enemyChar.HP, enemyChar.stats.hpMax)} **(Rival)**`)
            .addFields(
                {name: "Tus Stats", value: "`HP:`" +`${this.barradeVida(currentChar.HP, currentChar.stats.hpMax, true)}` + "\n`Mana:`" +
                `${currentChar.Mana}/${currentChar.manaMax}`, inline: true}
            )
            .setThumbnail(enemyChar.avatarURL)
            
            .setColor(isActiveTurn ? "Green" : "Red");

            if (duel.historialAcciones.length > 0) {
                const ultimasAcciones = duel.historialAcciones.slice(-3).reverse();
                const historialTexto = ultimasAcciones.map(accion => `• ${accion}`).join('\n');
                EmbedAuthor.addFields({ name: 'Últimas acciones', value: historialTexto, inline: false });
            }
        }

        return EmbedAuthor
    }

    createActionButtons(duel) {
        let attackDisable = false
        let defendDisable = false
        let bagDisable = false
        let spellsDisable = false
        let surrenderDisable = false

        if(duel.isNPC) {
            const npc = duel.personajes.find(p => p.messageOrigin === null)
            attackDisable = npc.restrictions.Attack === true
            defendDisable = npc.restrictions.Defend === true
            bagDisable = npc.restrictions.Bag === true
            spellsDisable = npc.restrictions.Spells === true
            surrenderDisable = npc.restrictions.Surrender === true
        }
        
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`DuelAct-${duel.turnoActual.userAuthor}-${duel.turnoActual.ID}-attack-${duel.id}`).setLabel('Atacar').setStyle(ButtonStyle.Secondary).setEmoji("🤺").setDisabled(attackDisable),
            new ButtonBuilder().setCustomId(`DuelAct-${duel.turnoActual.userAuthor}-${duel.turnoActual.ID}-defend-${duel.id}`).setLabel('Defenderse').setStyle(ButtonStyle.Secondary).setEmoji("🛡️").setDisabled(defendDisable),
            new ButtonBuilder().setCustomId(`DuelAct-${duel.turnoActual.userAuthor}-${duel.turnoActual.ID}-bag-${duel.id}`).setLabel('Bolsa').setStyle(ButtonStyle.Secondary).setEmoji("🎒").setDisabled(bagDisable),
            new ButtonBuilder().setCustomId(`DuelAct-${duel.turnoActual.userAuthor}-${duel.turnoActual.ID}-spells-${duel.id}`).setLabel('Hechizos').setStyle(ButtonStyle.Secondary).setEmoji("🔮").setDisabled(spellsDisable),
            new ButtonBuilder().setCustomId(`DuelAct-${duel.turnoActual.userAuthor}-${duel.turnoActual.ID}-surrender-${duel.id}`).setLabel('Rendirse').setStyle(ButtonStyle.Danger).setEmoji("🏳️").setDisabled(surrenderDisable)
          );
    }

    generateDetailedMessage(spell, caster, results) {
        let message = `**${caster.Nombre}** ha lanzado **[${spell.Nombre}]**`;
        
        // Parte de daño
        if (results.damage.length > 0) {
            message += "\n\n";
            
            results.damage.forEach((result, index) => {
                if (index > 0) message += ", ";
                message += `**${result.target.Nombre}** recibió **${result.amount}** de daño`;
                if (result.isElemental.message) {
                    message += ` [${result.isElemental.message}]`;
                }
            });
            message += ".";
        }
        
        // Parte de curación
        if (results.healing.length > 0) {
            message += "\n\n";
            
            // Agrupar objetivos de curación
            const healingTargets = results.healing.map(r => r.target.Nombre);
            const totalHealing = results.healing.reduce((sum, r) => sum + r.amount, 0);
            
            if (healingTargets.length === 1) {
                message += `**${healingTargets[0]}** recuperó **${totalHealing}** HP`;
            } else {
                // Si el lanzador está entre los objetivos
                if (healingTargets.includes(caster.Nombre)) {
                    const others = healingTargets.filter(name => name !== caster.Nombre);
                    
                    if (others.length === 0) {
                        message += `**${caster.Nombre}** recuperó **${totalHealing}** HP`;
                    } else if (others.length === 1) {
                        message += `**${caster.Nombre}** y **${others[0]}** recuperaron un total de **${totalHealing}** HP`;
                    } else {
                        const lastAlly = others.pop();
                        message += `**${caster.Nombre}**, ${others.join(', ')} y **${lastAlly}** recuperaron un total de **${totalHealing}** HP`;
                    }
                } else {
                    // Si el lanzador no está entre los objetivos
                    const lastAlly = healingTargets.pop();
                    message += `${healingTargets.join(', ')} y ${lastAlly} recuperaron un total de ${totalHealing} HP`;
                }
            }
            message += ".";
        }

        if (results.otherEffects.length > 0) {
            message += "\n\n";

            const grupo = results.otherEffects.reduce((acc, item) => {
                const n = item.nombreEfecto;

                if(!acc[n]) acc[n] = { duracion: item.duracion, targets: [] };
                acc[n].targets.push(item.target.Nombre)
                return acc
            }, {});

            Object.entries(grupo).forEach(([efecto, data], i, arr) => {
                const { duracion, targets} = data;

                const listaNombres = (() => {
                    if(targets.length === 1) return `**${targets[0]}**`;
                    if(targets.length === 2) return `**${targets[0]}** y **${targets[1]}**`;
                    const last = targets.pop()
                    return `**${targets.join('**, **')}** y **${last}**`;
                })();

                
                const verbo = targets.length === 1 ? 'esta' : "estan"

                message += `${listaNombres} ${verbo} bajo el efecto de **` + "`" + efecto + "`**" + `durante **${duracion} turno${duracion > 1 ? 's' : ''}**`

                if(i < arr.length - 1) message += ', ';
                else message += '.'
            })

        }
        
        return message;
    }
    
    // Función para generar mensaje resumido
    generateSummaryMessage(spell, caster, results) {
        let message = `${caster.Nombre} lanzó **[${spell.Nombre}]**`;
        
        // Resumen de daño
        if (results.damage.length > 0) {
            const targets = results.damage.map(r => r.target.Nombre);
            
            if (targets.length === 2) {
                message += ` sobre ${targets.join(' y ')}`;
                message += " y los dañó";
            } else if(targets.length >= 3){
                message += ` sobre ${targets.length} enemigos`;
                message += " y los dañó";
            }

            if(targets.length <= 1) {
                message += ` sobre ${targets}`;
                message += " y lo dañó";
            }
            

        }
        
        // Resumen de curación
        if (results.healing.length > 0) {
            const totalHealing = results.healing.reduce((sum, r) => sum + r.amount, 0);
            const healingTargets = results.healing.map(r => r.target.Nombre);
            
            if (results.damage.length > 0) {
                message += ", además ";
            } else {
                message += " y ";
            }
            
            // Si el lanzador está entre los objetivos de curación
            if (healingTargets.includes(caster.Nombre)) {
                const others = healingTargets.filter(name => name !== caster.Nombre);
                
                if (others.length === 0) {
                    message += `recuperó ${totalHealing} HP`;
                } else if (others.length === 1) {
                    message += `él y ${others[0]} recuperaron ${totalHealing} HP`;
                } else if (others.length <= 3) {
                    const lastAlly = others.pop();
                    message += `él, ${others.join(', ')} y ${lastAlly} recuperaron ${totalHealing} HP`;
                } else {
                    message += `él y sus aliados recuperaron ${totalHealing} HP`;
                }
            } else {
                // Si el lanzador no está entre los objetivos
                if (healingTargets.length === 1) {
                    message += `${healingTargets[0]} recuperó ${totalHealing} HP`;
                } else if (healingTargets.length <= 3) {
                    const lastAlly = healingTargets.pop();
                    message += `${healingTargets.join(', ')} y ${lastAlly} recuperaron ${totalHealing} HP`;
                } else {
                    message += `sus aliados recuperaron ${totalHealing} HP`;
                }
            }
        }

        if (results.otherEffects.length > 0) {
            const grouped = results.otherEffects.reduce((acc, item) => {
              const n = item.nombreEfecto;
              if (!acc[n]) acc[n] = [];
              acc[n].push(item.target.Nombre);
              return acc;
            }, {});
        
            const parts = Object.entries(grouped).map(([efecto, targets]) => {
              return `**${efecto}**: ${targets.join(', ')}`;
            });
        
            message += ` • Efectos → ${parts.join(' | ')}`;
          }
        
        return message;
    }

    getDialogues(user, npc, duel, event, interaction) {
        const triggers = npc.triggers|| [];
        const activeTriggers = [];

        for(const trigger of triggers) {
            let shouldTrigger = false;

            switch(trigger.type) {
                case "InicioCombate": 
                    shouldTrigger = duel.ronda === 1;
                    break;
                case "HpLow": 
                    const currentHpPercent = npc.HP / npc.stats.hpMax;
                    shouldTrigger = currentHpPercent <= trigger.threshold;
                    break;
                case 'statusApplied':
                    shouldTrigger = npc.statusEffect.some(e => e.type === trigger.statusType);
                    break;
                case 'custom': 
                    shouldTrigger = this.evalCustomCondition(trigger.condition, { npc, duel });
                    break;
            }

            if(shouldTrigger && (!trigger.lastTriggered || (duel.ronda - trigger.lastTriggered) >= (trigger.cooldownTurns || 1))) {
                activeTriggers.push(trigger)
            }
        }


        if(activeTriggers.length > 0) {
            const context = {
                    npc_name: npc.Nombre,
                    npcAvatar: npc.avatarURL,
                    code: Date.now()
            }

            const selectedTrigger = activeTriggers[Math.floor(Math.random() * activeTriggers.length)];
            const message = dialogoManager.buildMessageOptions(selectedTrigger, context)

            try {

                if(interaction) {
                    interaction.reply({ ...message, flags: ["Ephemeral"]})
                }else {
                    user.MDOrigin.send({...message}).then(m => setTimeout(() => m.delete(), 10000))
                }

              
            } catch (error) {
                console.error(`No se pudo enviar el dialogo al usuario ${error}`)
                return;
            }

            
            if(selectedTrigger.oncePerCombat) selectedTrigger.lastTriggered = Infinity;
            else selectedTrigger.lastTriggered = duel.ronda;

        } 
    }

    async actionGifSelect(action) {
        const actionGifs = {
            "attack": await getGifs("punch"),
            "defend": [
                "https://c.tenor.com/TeLGX2pYe94AAAAd/tenor.gif",
                "https://c.tenor.com/qkt_l6DMI6sAAAAd/tenor.gif",
                "https://c.tenor.com/rkQm2lOfRa0AAAAd/tenor.gif",
                "https://c.tenor.com/5iJ5pmSxVA4AAAAd/tenor.gif",
                "https://c.tenor.com/dDmhCv5dnTMAAAAd/tenor.gif",
                "https://c.tenor.com/B780LEn87eAAAAAd/tenor.gif",
                "https://c.tenor.com/bDi6iF-AAuQAAAAd/tenor.gif",
            ],
            "spell": [
                "https://c.tenor.com/-J0kOHQMBcYAAAAd/tenor.gif",
                "https://c.tenor.com/06Qk37qmP1wAAAAd/tenor.gif",
                "https://c.tenor.com/1ovlqNMdjsEAAAAd/tenor.gif",
                "https://c.tenor.com/qjzML-7bLkwAAAAd/tenor.gif",
                "https://c.tenor.com/u_SvcUXy2NwAAAAd/tenor.gif",
                "https://c.tenor.com/fHVO05yKkEQAAAAd/tenor.gif",
                "https://c.tenor.com/KuvSZ1kYPFAAAAAd/tenor.gif",
                "https://c.tenor.com/TPLVfoIGoEwAAAAd/tenor.gif"
            ], 
            "spellFailed": [
                "https://c.tenor.com/mSqEgKfI3uUAAAAd/tenor.gif",
                "https://c.tenor.com/VQEadG8MqCMAAAAd/tenor.giff",
                "https://c.tenor.com/gjBx2zbdJjAAAAAC/tenor.gif",
                "https://c.tenor.com/W3jM5w2gvfoAAAAd/tenor.gif",
                "https://c.tenor.com/kEVg4dod34sAAAAd/tenor.gif",
                "https://c.tenor.com/pQ9jr5TqhUEAAAAd/tenor.gif",
                "https://c.tenor.com/clPun4-Kdu0AAAAd/tenor.gif",
            ],
            "bag": [
                "https://i.gifer.com/DXw.gif",
                "https://c.tenor.com/wiEN5dcIkHcAAAAd/tenor.gif",
                "https://nihonnoichigo.wordpress.com/wp-content/uploads/2017/07/t0qlw.gif",
                "https://c.tenor.com/vLWDELtNl6wAAAAd/tenor.gif",
                "https://c.tenor.com/0obmPDN7oeAAAAAd/tenor.gif",
                "https://c.tenor.com/HI0UBctzeRoAAAAd/tenor.gif",
                "https://c.tenor.com/E6l7l4t9ut4AAAAd/tenor.gif",
            ],
            "surrender": [
                "https://c.tenor.com/5lvXZOwWSq0AAAAd/tenor.gif"
            ]
        }

        if(action === "attack") {
            const actionAtacar = actionGifs[action]
            return actionAtacar.url
        }

        const gif = actionGifs[action]
        return gif ? gif[Math.floor(Math.random() * gif.length)] : "https://c.tenor.com/4jSSY5iIH-MAAAAC/tenor.gif"
     }
}

const duelSystem = new Duels()
module.exports = {duelSystem, duelEmitter}