const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, InteractionContextType} = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders");
const subcommands = {
    crearObjeto: require("../../handlers/CMDHandler/Utilidad/Crear objeto"),
    darObjeto: require("../../handlers/CMDHandler/Utilidad/Dar objeto"),
    climaHora: require("../../handlers//CMDHandler/Utilidad/Hora rol")
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
           case "crear_objeto":
                subcommands.crearObjeto(client, interaction)
            break;

            case "dar_objeto":
                subcommands.darObjeto(client, interaction)
                break;
            
            case "hora_rol":
                subcommands.climaHora(client, interaction)
                break;

            case "webhooks":
                interaction.reply({content: "Este comando esta en desarollo", ephemeral: true})
                break;
        }

    },

    data: new SlashCommandBuilder()
    .setName("navi-utilidad")
    .setDescription("Comandos de utilidad")
    .setContexts(['Guild'])
    .addSubcommand(sub => 
        sub
        .setName("crear_objeto")
        .setDescription("Crea objetos para el rol [Administracion]")
        .addStringOption(option => 
            option.setName("nombre")
            .setDescription("Agrega el nombre del objeto")
            .setRequired(true)
            .setMaxLength(30)
            .setMinLength(3)
    
        )
        .addStringOption(option => 
            option.setName("descripcion")
            .setDescription("Agrega la descripcion del objeto")
            .setRequired(true)
            .setMaxLength(500)
            .setMinLength(5)
        )
        .addStringOption(option => 
            option.setName("rareza")
            .setDescription("Agrega la rareza del objeto")
            .addChoices(
                {name: "Ceniza", value: "Comun"},
                {name: "Brote", value: "Raro"},
                {name: "Cristalino", value: "Epico"},
                {name: "Arcano", value: "Legendario"},
                {name: "Etereo", value: "Mitico"},
                {name: "Divino", value: "Divino"},
                {name: "Nix", value: "Nix"},
            )
            .setRequired(true)
        )
        .addStringOption(option => 
            option.setName("tipo")
            .setDescription("Agrega el tipo de objeto que es")
            .addChoices(
                {name: "[⚔️] Arma", value: "Arma"}, 
                {name: "[🛡️] Armadura", value: "Armadura"},
                {name: "[📿] Artefacto", value: "Artefacto"},
                {name: "[🪄] Consumible", value: "Consumible"},
                {name: "[🌱] Material", value: "Material"},
                {name: "[⚒️] Herramienta", value: "Herramienta"},
                {name: "[🎲] Otro", value: "Otro"},
            )
            .setRequired(true)
        )
        .addStringOption(option => 
            option.setName("region")
            .setDescription("Agrega la región de origen del objeto")
            .addChoices(
                {name: "Tobeya", value: "TOB-01"},
                {name: "Sakuiya", value: "SKY-02"},
                {name: "Archaíso", value: "ARC-03"},
                {name: "Miquiztlalli", value: "MQZ-04"},
                {name: "Ameratsy", value: "AMR-05"},
                {name: "Mythalen", value: "MYT-06"},
            )
            .setRequired(true)
        )
        .addIntegerOption(option => 
        option.setName("cantidad")
            .setDescription("Agrega la cantidad global del objeto (Opcional)")
            .setRequired(false)
            .setMaxValue(999)
            .setMinValue(1)
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("dar_objeto")
        .setDescription("Agrega un objeto al inventario de un personaje (╹ڡ╹ )")
        .addIntegerOption((o) => 
            o
        .setName("personaje")
        .setDescription("Ingresa la ID del personaje")
        .setAutocomplete(true)
        .setRequired(true)
        
    )
    .addIntegerOption(option => 
        option.setName("objeto")
        .setDescription("Agrega el ID del objeto") 
        .setMaxValue(999)
        .setMinValue(1)
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addIntegerOption(option => 
    option.setName("cantidad")
        .setDescription("Agrega la cantidad de objetos que se daran")
        .setMaxValue(999)
        .setMinValue(1)
        .setRequired(true)
    )
    )
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
        .setName("webhooks")
        .setDescription("Envia un webhook. [Only Staff]")
        .addStringOption(id => 
            id.setName("url")
            .setRequired(true)
            .setDescription("URL del webhook")
          )
          .addStringOption(messages => 
            messages.setName("mensaje")
            .setDescription("El mensaje de tu webhook")
            .setRequired(false)
          )
          .addAttachmentOption(img => 
            img.setName("imagen")
            .setDescription("Adjunta una imagen para que sea publicada")
            .setRequired(false)
          )
          .addChannelOption(ch => 
            ch.setName("canal")
            .setDescription("Agrega el canal en el que se creara y enviara el weebhook")
            .setRequired(false)
          )
    ),

    deleted: false
}