const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const dbpj = db2.collection("Personaje")
const objetos = db2.collection("Objetos_globales")
const { duelSystem } = require("../../../functions/Duelo/duelManager")
const TurnProcessor = require("../../../functions/Duelo/turnProcessor")

module.exports = {
    customId: "UseItem",
    selectAutor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async ({ client, interaction, character, componentData, options: { option1: sesionID } }) => {
        console.log("componentData", componentData)

        // componentData format: "Type: {duelo_o_general}*<itemID>*<region>"
        const [Type, IDString, region] = componentData.split("*")
        const ObjID = Number(IDString)
        const sesion = duelSystem.getSesion(sesionID)
        const objData = {
            Region: region,
            ID: ObjID
        }



        if (Type === "duelo") {
            try {

                const actor = sesion.getCurrentActor()
                const UseItem = await duelSystem.useItem(sesion, actor, null, objData)

                if (!UseItem.success) {
                    return interaction.reply({ content: UseItem.message, flags: ["Ephemeral"] })
                }

                const { rondaCerrada, gameOver, winners, arrayWinner } = await TurnProcessor.advanceCompas(sesion, actor)

                // rondaCerrada handled in advanceCompas


                await interaction.reply({ content: `${UseItem.message}`, ephemeral: true })
                return

            } catch (e) {
                console.log(e)
            }
        }
    }
}