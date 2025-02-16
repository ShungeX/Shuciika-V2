const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, InteractionContextType} = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders");
const subcommands = {
    crearficha: require("../../handlers/CMDHandler/Rol/Crear ficha"),
    sendficha: require("../../handlers/CMDHandler/Rol/Send fcha"),
    verificarficha: require("../../handlers/CMDHandler/Rol/Verificar ficha"),
    perfil: require("../../handlers/CMDHandler/Rol/Perfil"),
    relacion: require("../../handlers/CMDHandler/Rol/Relacion personajes"),
    configpj: require("../../handlers/CMDHandler/Rol/Configurar personaje"),
    mochila: require("../../handlers/CMDHandler/Rol/Mochila"),
    despertar: require("../../handlers/CMDHandler/Rol/Despertar"),
    tienda: require("../../handlers/CMDHandler/Rol/Tienda"),
    dailyrecompensa: require("../../handlers/CMDHandler/Rol/recompensa_diaria"),
    Usar_item: require("../../handlers/CMDHandler/Rol/Usar_item"),
    comprar: require("../../handlers/CMDHandler/Rol/comprar"),
    trabajar: require("../../handlers/CMDHandler/Rol/chamba")
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
           case "configurar_personaje":
            subcommands.configpj(client, interaction)
            break;

            case "relacion":
                subcommands.relacion(client, interaction)
                break;
            
            case "reporte":
                interaction.reply({content: "Este comando esta en desarollo", ephemeral: true})
                break;

            case "mochila":
                subcommands.mochila(client, interaction)
                break;

            case "perfil":
                subcommands.perfil(client, interaction)
                break;
            
            case "listado_inscritos":
                interaction.reply({content: "Este comando esta en desarollo", ephemeral: true})
                break;

            case "crear_ficha":
                subcommands.crearficha(client, interaction)
                break;
            case "enviar_ficha": 
                subcommands.sendficha(client, interaction)
            break;
            case "verificar_ficha":
                subcommands.verificarficha(client, interaction)
            break;
            case "despertar":
                subcommands.despertar(client, interaction)
            break;
            case "tienda": 
                subcommands.tienda(client, interaction)
            break;
            case "recompensa_diaria":
                subcommands.dailyrecompensa(client, interaction)
            break;
            case "usar_objeto":
                subcommands.Usar_item(client, interaction)
            break;
            case "comprar":
                subcommands.comprar(client, interaction)
            break;
            case "trabajar":
                subcommands.trabajar(client, interaction)

        }

    },

    data: new SlashCommandBuilder()
    .setName("rol")
    .setDescription("Comandos de Rol.")
    .setContexts(['Guild'])
    .addSubcommand(sub => 
        sub
        .setName("configurar_personaje")
        .setDescription("Establece o cambia información de tu presonaje: Foto, Apodo, Lore, etc.")
    )
    .addSubcommand(sub => 
        sub
        .setName("relacion")
        .setDescription("Obten informacion de tus relaciones con otros personajes")
        .addIntegerOption((o) => 
            o
        .setName("personaje")
        .setDescription("Ingresa la ID del personaje")
        .setAutocomplete(true)
        
    )
    )
    .addSubcommand(sub => 
        sub
        .setName("reporte")
        .setDescription("Reporta a un personaje por mal comportamiento / [Reduce reputacion]")
        .addIntegerOption(o => 
            o
            .setName("personaje")
            .setDescription("Ingresa la ID del personaje")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(o => 
            o
            .setName("opciones")
            .setDescription("Selecciona una opcion de reporte")
            .setRequired(true)
            .addChoices(
                {name: "[📄] Incumplimento de normas", value: "Incumplimento de normas"},
                {name: "[🫵] Falta de respeto", value: "Falta de respeto"},
                {name: "[🤕] Bullying o Pelea", value: "Bullying o Pelea"},
                {name: "[📗] Descuido o maltrato del material escolar", value: "Maltrato del material escolar"},
                {name: "[⚖️] Uso indebido de privilegios o accesos otorgados", value: "Uso indebido de privilegios o accesos otorgados"},

            )
        )
        .addStringOption(o => 
            o
            .setName("razon")
            .setDescription("Ingresa la razon del reporte")
            .setRequired(true)
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("mochila")
        .setDescription("Muestra el contenido de tu mochila [Inventario]")
    )
    .addSubcommand(sub => 
        sub
        .setName("perfil")
        .setDescription("Muestra tu perfil de personaje o el de otro usuario")
        .addUserOption(o => 
            o
            .setName("usuario")
            .setDescription("Selecciona a un usuario")
        )
        .addIntegerOption(o => 
            o
            .setName("personaje")
            .setDescription("Ingresa la ID del personaje")
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("listado_inscritos")
        .setDescription("Muestra el listado de personajes inscritos en el rol y el papel que desempeñan")
    )
    .addSubcommand(sub => 
        sub
        .setName("verificar_ficha")
        .setDescription("Verifica la ficha de un usuario / [Staff - Verificadores]")
        .addStringOption(o => 
            o
            .setName("personaje_cache")
            .setDescription("Selecciona el personaje a verificar de la lista")
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addStringOption(o => 
            o
            .setName("comentario")
            .setDescription("[Opcional] Deja un comentario constructivo, creativo o bonito al usuario de la ficha")
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("crear_ficha")
        .setDescription("Crea tu ficha de personaje para el rol")
    )
    .addSubcommand(sub => 
        sub
        .setName("enviar_ficha")
        .setDescription("Envia tu ficha para que sea verificada")
    )
    .addSubcommand(sub => 
        sub
        .setName("despertar")
        .setDescription("Inicia la historia de tu personaje / Desbloqueable en rol")
        .addNumberOption(o => 
            o
            .setName("omitir_dialogo")
            .setDescription("Omite el dialogo de introducción")
            .setRequired(false)
            .setMaxValue(1)
            .setMinValue(0)

        )
    )
    .addSubcommand(sub => 
        sub
        .setName("tienda")
        .setDescription("Muestra la tienda de objetos")
    )
    .addSubcommand(sub =>
        sub
        .setName("recompensa_diaria")
        .setDescription("Reclama tu recompensa diaria")
    )
    .addSubcommand(sub => 
        sub
        .setName("usar_objeto")
        .setDescription("Usa un objeto de tu inventario.")
        .addStringOption(o => 
            o
            .setName("objeto_id")
            .setDescription("Ingresa la ID del objeto a usar")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("comprar")
        .setDescription("Compra un objeto de la tienda.")
        .addStringOption(o => 
            o
            .setName("objeto")
            .setDescription("Ingresa la ID del objeto a comprar / Puedes filtrarlo por el nombre o ID.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addNumberOption(o => 
            o
            .setName("cantidad")
            .setDescription("Ingresa la cantidad a comprar / Algunos objetos tienen limite de compra")
            .setRequired(true)
            .setMaxValue(20)
            .setMinValue(1)
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("trabajar")
        .setDescription("Trabaja para obtener algunos lumens [Beta]")
    ),


    deleted: false
}