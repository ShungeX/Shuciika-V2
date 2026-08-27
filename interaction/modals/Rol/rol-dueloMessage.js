const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client } = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const Cachedb = db2.collection("CachePJ")
const dataCache = new Map()
const transaccionCache = require("../../../utils/cache")
const { formatearTextoLim } = require("../../../utils/textStrings");
const { duelSystem } = require("../../../functions/Duelo/duelManager");
const { buildSalaMessage } = require("../../../functions/Duelo/combateUI")

module.exports = {
    customId: "crearSala",
    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async (client, interaction, selectOption, messageIds) => {
        const userId = interaction.user.id
        const userData = await userdb.findOne({ _id: interaction.user.id })
        const codeSala = await duelSystem.createCode(6)
        const privacidad = interaction.fields.getStringSelectValues("privacidadSala")[0]
        const tipoDuelo = interaction.fields.getStringSelectValues("tipoDuelo")[0]
        const nombreSala = interaction.fields.getTextInputValue("nameSala")
        const limiteEquipo = interaction.fields.getStringSelectValues("limiteEquipo")[0]
        const dataCache = transaccionCache.get(`modalDuel-${interaction.user.id}`)
        if (!dataCache) return interaction.reply({ content: "No se encontraron los datos de tu personaje. Intenta crear la sala nuevamente.", flags: ["Ephemeral"] })
        const { character, soul } = dataCache

        const MODOS_SALA = {
            "1": { limiteEquipo1: 1, limiteEquipo2: 1, nombre: "1 vs 1" },
            "2": { limiteEquipo1: 2, limiteEquipo2: 2, nombre: "2 vs 2" },
            "3": { limiteEquipo1: 3, limiteEquipo2: 3, nombre: "3 vs 3" },
            // "4": { limiteEquipo1: 1, limiteEquipo2: 3, nombre: "1 vs 3" },
        }
        const modo = MODOS_SALA[limiteEquipo]

        if (!modo) return interaction.reply({ content: "Modo de sala no válido ＞﹏＜", flags: ["Ephemeral"] })

        const { limiteEquipo1, limiteEquipo2, nombre } = modo



        const messagesSala = buildSalaMessage(interaction.user, privacidad === "privada", { character, soul, codeSala, nombreSala, modoDuelo: nombre })

        const messageS = await interaction.reply({ components: messagesSala.serverMessage, flags: ["IsComponentsV2"], withResponse: true })

        const messageA = await interaction.user.send({ components: messagesSala.salaMessage, flags: ["IsComponentsV2"] }).catch(err => {
            console.log(err)
            return interaction.channel.send({ content: "No puedo enviarte el mensaje de la sala...\n-# Verifica tus DM" })
        })
        

        

        const { aspiracion, Historia, Cumpleaños, Peso, Estatura, Descripcion, Familia, CiudadOrg, Sexo, ...infoperfil } = character.perfil
        const { XP, energy, lastEnergyUpdate, energiaAlmica, ...infoNucleo } = soul.nucleo
        const { hilosLunares, StelarFragments, ...infoSendero } = soul.sendero

        const characterData = {
            ownerId: interaction.user.id,
            perfil: infoperfil,
            social: { compañero: character.social.compañero, team: character.social.team },
            nucleo: infoNucleo,
            stats: soul.stats,
            dominio: soul.dominio,
            sendero: infoSendero
        }

        const dataSala = {
            autor: interaction.user.id,
            autorCharacter: characterData.perfil.Nombre,
            duelType: tipoDuelo,
            team1: { [character._id]: characterData },
            team2: {},
            limitTeam1: limiteEquipo1,
            limitTeam2: limiteEquipo2,
            code: codeSala,
            isPrivate: privacidad === "privada" ? true : false,
            isNPC: false,
            estado: "En espera...",
            creado: Math.floor(Date.now() / 1000),
            messageAutor: {
                guild: messageA.guildId,
                channel: messageA.channelId,
                message: messageA.id
            },
            messageServer: {
                guild: messageS.resource.message.guildId,
                channel: messageS.resource.message.channelId,
                message: messageS.resource.message.id
            }
        }

        console.log(dataSala.messageAutor)

        await transaccionCache.set(codeSala, dataSala, () => {
            // Limpiar status de todos los personajes que estaban en la sala
            const todosLosPersonajes = [
                ...Object.keys(dataSala.team1),
                ...Object.keys(dataSala.team2)
            ]
            todosLosPersonajes.forEach(characterId => {
                transaccionCache.deleteStatus(characterId)
            })
            console.log(`Sala ${codeSala} expiró, personajes liberados`)
        }),

            await transaccionCache.setStatus(character._id, { code: 1, salaCode: codeSala, Nombre: "En sala" }, { active: true, time: 3000 })
    }
}