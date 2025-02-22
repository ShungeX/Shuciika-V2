const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, InteractionContextType, ChannelType} = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders");
const subcommands = {
    crearObjeto: require("../../handlers/CMDHandler/Utilidad/Crear objeto"),
    darObjeto: require("../../handlers/CMDHandler/Utilidad/Dar objeto"),
    climaHora: require("../../handlers//CMDHandler/Utilidad/Hora rol"),
    staffinfo: require("../../handlers/CMDHandler/Utilidad/Crear Embed"),
    foropost: require("../../handlers/CMDHandler/Utilidad/create_post"),
    confesion: require("../../handlers/CMDHandler/Utilidad/Confesion"),
    config_channels: require("../../handlers/CMDHandler/Utilidad/Canales_rol")
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

            case "foro_post":
                subcommands.foropost(client, interaction)
                break;
            case "staff":
                subcommands.staffinfo(client, interaction)
                break;
            case "confesar":
                subcommands.confesion(client, interaction)
                break;
            case "canales_rol":
                subcommands.config_channels(client, interaction)
                break;

        }

    },

    data: new SlashCommandBuilder()
    .setName("utilidad")
    .setDescription("Comandos de utilidad.")
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
        .setName("foro_post")
        .setDescription("Crea una publicacion en el foro con Shuciika. | Envia un mensaje en el foro")
        .addIntegerOption(ismensaje => 
            ismensaje
            .setName("is_mensaje")
            .setDescription("Escribe 1 si es un mensaje o 0 si es un post")
            .setRequired(true)
            .setMaxValue(1)
            .setMinValue(0)
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("staff")
        .setDescription("Los miembros del staff en embed")
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
        .setName("canales_rol")
        .setDescription("Desbloquea categorias especificas del Rol. [Administracion]")
        .addNumberOption(options => 
            options
            .setName("categoria")
            .setDescription("La categoria a desbloquear o bloquear")
            .setChoices(
              {name: "[🏫] Instituto", value: 1},
              {name: "[🏙️] Ciudad", value: 2},
              {name: "[⁉️] Todos los canales", value: 3}
            )
            .setRequired(true)
        )
        .addBooleanOption(sub => 
            sub
            .setName("accion")
            .setDescription("La accion a realizar sobre estos canales [Desbloquear/Bloquear]")
            .setRequired(true)
        )
    ),

    deleted: false
}