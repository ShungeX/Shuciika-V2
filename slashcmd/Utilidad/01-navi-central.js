const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, InteractionContextType, ChannelType} = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders");
const subcommands = {
    climaHora: require("../../handlers//CMDHandler/Utilidad/Hora rol"),
    confesion: require("../../handlers/CMDHandler/Utilidad/Confesion"),
    simuladores: require("../../handlers/CMDHandler/Utilidad/Simuladores"),
}


module.exports = {
    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
     


    ejecutar: async(client, interaction) => {
        const subcommand = interaction.options.getSubcommand()

        switch (subcommand) {
            case "hora_rol":
                subcommands.climaHora(client, interaction)
                break;
            case "confesar":
                subcommands.confesion(client, interaction)
                break;
            case "simular_evento":
                subcommands.simuladores(client, interaction)
                break;
        }

    },

    data: new SlashCommandBuilder()
    .setName("utilidad")
    .setDescription("Comandos de utilidad.")
    .setContexts(['Guild'])
    .addSubcommand(sub => 
        sub
        .setName("hora_rol")
        .setDescription("Ajusta o inicia el tiempo del Rol")
        .addStringOption(clima => 
            clima.setName("clima")
            .setDescription("Ajusta el clima del Rol")
            .setRequired(false)
            .addChoices(
                { name: "Soleado", value: "Soleado"}, 
                { name: "Caluroso", value: "Caluroso"},
                { name: "Ventoso", value: "Ventoso"},
                { name: "Nublado", value: "Nublado"},
                { name: "Lluvioso", value: "Lluvioso"},
                { name: "Granizada", value: "Granizada"},
                { name: "Tormenta", value: "Tormenta"},
                { name: "Nevada", value: "Nevada"}
            )
        )
        .addIntegerOption(hora => 
            hora.setName("hora")
            .setDescription("Agrega la hora del día")
            .setRequired(false)
            .setMaxValue(23)
            .setMinValue(0)
        )
        .addIntegerOption(minutos => 
            minutos.setName("minutos")
            .setDescription("Agrega los minutos del día")
            .setRequired(false)
            .setMaxValue(59)
            .setMinValue(0)
        )
        .addIntegerOption(temp => 
            temp.setName("temperatura")
            .setDescription("Agrega la temperatura del ambiente inicial (°C)")
            .setRequired(false)
            .setMaxValue(40)
            .setMinValue(0)
        ),
    )
    .addSubcommand(sub => 
        sub
        .setName("confesar")
        .setDescription("Envia una confesión al buzon de un personaje o al canal de confesion.")
        .addStringOption(mensaje => 
            mensaje
            .setName("mensaje")
            .setDescription("Escribe el mensaje de la confesión")
            .setRequired(true)
        )
        .addNumberOption(personaje => 
            personaje
            .setName("personaje")
            .setDescription("[Opcional] Envia la confesión / carta a un personaje del rol")
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("simular_evento")
        .setDescription("Simula un evento de Discord. [Administracion]")
        .addStringOption(options => 
            options
            .setName("evento")
            .setDescription("El evento a simular")
            .setChoices(
              {name: "[🏫] Bienvenida", value: "guildMemberAdd"},
              {name: "[🏙️] Despedida", value: "guildMemberRemove"},
              {name: "[⁉️] Boost", value: "guildmemberUpdate"}
            )
            .setRequired(true)
        )
    ),
    


    deleted: false
}