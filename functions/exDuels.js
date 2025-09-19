class Duels {
    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    constructor() {
        this.activeduels = new Map();

    }

    /**
     * Inicia un duelo entre NPC/Usuario
     * @param {Client} client - Cliente de Discord
     * @param {Boolean} isNPC - ¿Es duelo contra NPC?
     * @param {String} duelType - exploration, duelo o otros
     * @param {Object} parametros - Player[Soul], Rival[Soul], Channel(Origen), Mdauthor, MdRival,
     * @param {ChatInputCommandInteraction} interaction 
     */
    async createDuel(client, isNPC, duelType, parametros) {
        // Referencia al cliente de MongoDB
        this.mongoClient = clientdb;
        this.db = db
        this.duelos = this.db.collection('duelos');

        // Configuración por defecto
        this.tiempoLimiteTurno = 30000; // 30 segundos
        this.duracionMaximaDuelo = 3600000; // 1 hora

        this.channel = parametros.channel
        this.MdAuthor = parametros.Mdauthor
        this.MdRival = parametros.Mdrival
        this.isNPC = isNPC
        this.client = client
        this.duelType = duelType

        this.player1 = {
            userAuthor: parametros.Player._id,
            ...parametros.Player,
            isTurn: false,
            statusEffect: []
        }

        if (isNPC) {
            this.player2 = {
                ID: parametros.Rival.Type,
                ...parametros.Rival,
                isTurn: false,
                imNPC: true,
                statusEffect: []
            }
        } else {
            this.player2 = {
                userAuthor: parametros.Rival._id,
                ...parametros.Rival,
                isTurn: false,
                statusEffect: []
            }
        }

        const turnStart = this.selectStart(this.player1.stats.agilidad, this.player2.stats.agilidad)

        this.currentTurn = turnStart ? this.player1 : this.player2
        this.waitingPlayer = turnStart ? this.player2 : this.player1

        await this.startDuel()
    }

    getDuel(duelId) {
        return this.activeduels.get(duelId)
    }


    async startDuel() {

        const duelId = `${this.player1.ID}${this.player2.ID}${Date.now()}${Math.random().toString(36).substring(2, 7)}`;

        let errorMD;
        const MDAuthorOrg = this.MdAuthor
        const MDRivalOrg = this.MdRival

        const mirrorAttack = this.isNPC ? this.player2.attacks.find(m => m.effects === "mirror") : null
        const duel = {
            id: duelId,
            personajes: [this.player1, this.player2],
            userMD: this.isNPC ? [this.authorMD] : [this.authorMD, this.rivalMD],
            turnoActual: this.currentTurn,
            ronda: 1,
            historialAcciones: ["¡Empezó el duelo!"],
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
        }
        this.activeduels.set(duelId, duel)

        //Components donde los miembros del servidor podran espectear





        this.message = await this.channel.send({ components: espectadorJSON, flags: ["IsComponentsV2"], withResponse: true })


        this.player1Rest = {
            messageOrigin: this.authorMD,
            MDOrigin: MDAuthorOrg,
            ...this.deepClone(this.player1),
        }

        this.player2Rest = {
            messageOrigin: this.isNPC ? null : this.rivalMD,
            MDOrigin: this.isNPC ? null : MDRivalOrg,
            ...this.deepClone(this.player2),
        }



        const postDuel = {
            id: duelId,
            personajes: [this.player1Rest, this.player2Rest],
            userMD: this.isNPC ? [this.authorMD] : [this.authorMD, this.rivalMD],
            channels: this.message,
            turnoActual: this.currentTurn,
            ronda: 1,
            historialAcciones: ["¡Empezó el duelo!"],
            finalizado: false,
            tiempoInicio: Date.now(),
            tiempoLimite: 45000, // 45 segundos
            timeoutId: null, // Para almacenar el ID del timeout
            isNPC: this.isNPC,
            type: this.duelType,
            mirror: {
                esPosible: this.isNPC && mirrorAttack,
                active: false,
                countdown: 0,
                recordedActions: []
            }
        }

        this.activeduels.set(duelId, postDuel)
        postDuel.timeoutId = setTimeout(() => this.handleTimeout(postDuel), postDuel.tiempoLimite);
        this.getDialogues(this.player1Rest, this.player2Rest, postDuel, null, null);

        if (this.isNPC && this.player2?.ID === this.currentTurn?.ID) {
            console.log("Turno enemigo!")
            await this.ejecutarAccionesNPC(postDuel)

            const notTurn = postDuel.personajes.find(p => p.ID !== duel.turnoActual.ID)

            await this.selectEmbed(postDuel, "attack")
        }

    }


}
