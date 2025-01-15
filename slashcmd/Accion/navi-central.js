const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType} = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders")
const subcommands = {
    dance: require("../../handlers/CMDHandler/Interactions/DanceInteract")
}


module.exports = {
    data: new SlashCommandBuilder()
    .setName("navi-act")
    .setDescription("Haz una acción.")
    .setContexts(['Guild'])
    .addSubcommand((sub) => 
        sub.setName("dance")
        .setDescription("[💃] Mueve el cuerpo")
        .addUserOption(user => 
            user.setName("usuario")
            .setDescription("Selecciona a tu acompañante (Usuario)")
            .setRequired(false)
        )
        .addIntegerOption(character => 
            character.setName("personaje")
            .setDescription("ingresa la ID del Alumno [Personaje]")
            .setMaxValue(1000)
            .setMinValue(1)
            .setAutocomplete(true)
        )
),
    deleted: false,

    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

ejecutar: async(client, interaction) => {
    const subcommand = interaction.options.getSubcommand()

    if(subcommand === "dance") {
        subcommands.dance(client, interaction)
    }
}
    
}