const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, InteractionContextType, Client} = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders");
const clientdb = require("../../Server")
const {devs, guild, } = require("../../configslash.json");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const Character = db2.collection("Personajes")
const souls = db2.collection("Soul")
const subcommands = {
    crear_ficha: require("../../handlers/CMDHandler/Rol/Crear ficha"),
    enviar_ficha: require("../../handlers/CMDHandler/Rol/Send fcha"),
    verificar_ficha: require("../../handlers/CMDHandler/Rol/Verificar ficha"),
    perfil: require("../../handlers/CMDHandler/Rol/Perfil"),
    relacion: require("../../handlers/CMDHandler/Rol/Relacion personajes"),
    configurar_personaje: require("../../handlers/CMDHandler/Rol/Configurar personaje"),
    mochila: require("../../handlers/CMDHandler/Rol/Mochila"),
    despertar: require("../../handlers/CMDHandler/Rol/Despertar"),
    tienda: require("../../handlers/CMDHandler/Rol/Tienda"),
    recompensa_diaria: require("../../handlers/CMDHandler/Rol/recompensa_diaria"),
    usar: require("../../handlers/CMDHandler/Rol/Usar_item"),
    comprar: require("../../handlers/CMDHandler/Rol/comprar"),
    trabajar: require("../../handlers/CMDHandler/Rol/chamba"),
    duelo: require("../../handlers/CMDHandler/Rol/duelo"),
    explorar: require("../../handlers/CMDHandler/Rol/explorar"),
    regalar: require("../../handlers/CMDHandler/Rol/regalar"),
    buzon: require("../../handlers/CMDHandler/Rol/buzon"),
    craftear: require("../../handlers/CMDHandler/Rol/craftear")
}

module.exports = {
    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
     


    ejecutar: async(client, interaction) => {
        const subcommandName = interaction.options.getSubcommand();
        const subcommand = subcommands[subcommandName];
        console.log(subcommandName)

        if(!subcommand || subcommand?.enMantenimiento) return interaction.reply({content: "Este comando esta en mantenimiento. Se paciente （︶^︶)", ephemeral: true})

        const {requireCharacter, requireCharacterCache, requireSoul, isDevOnly, requireEstrict} = subcommand;
        
        let character, soul, cachepj; 

        try {
            if(isDevOnly && !devs.includes(interaction.member.id)) return interaction.reply({content: "Este comando solo esta disponible para el Staff 〒▽〒", ephemeral: true})

            if(requireCharacter ||  requireSoul) {
                const [charData, soulData] = await Promise.all([
                    requireCharacter ? Character.findOne({_id: interaction.user.id}) : null,
                    requireSoul ? souls.findOne({_id: interaction.user.id}) : null
                ]);

                character = charData;
                soul = soulData;
            }
            

            if(requireCharacterCache || requireEstrict.Cachepj) {
                cachepj = await Cachedb.findOne({_id: interaction.user.id})
            }

            if((requireCharacter && !character) && requireEstrict.Character) {
                if(cachepj) {
                    return interaction.reply({content: "No puedes usar este comando porque necesitas que tu ficha primero se verifique 〒▽〒\n-# Se paciente y espera a alguien del staff lo haga", flags: "Ephemeral"})
                }
                return interaction.reply({content: "No puedes usar este comando porque necesitas un personaje＞﹏＜\n-# Porque no intentas crear uno usando el comando /rol crear_ficha", flags: "Ephemeral"})
            }

            if((requireCharacterCache && !cachepj && requireEstrict.Cachepj) && requireEstrict.Character ) {
                return interaction.reply({content: "Necesitas tener un personaje en proceso de registro 〒▽〒\n-# Porque no intentas crear uno usando el comando /rol crear_ficha", flags: "Ephemeral"})
            }

            if((requireSoul && !soul) && requireEstrict.Soul) {
                return interaction.reply({content: "Tu personaje necesita despertar su poder para usar este comando 〒▽〒-# Debes esperar a que algun profesor o el propio owner realice el evento", flags: "Ephemeral"})
            }

            await subcommand.ejecutar(client, interaction, {
                character,
                soul,
                cachepj,
            })

        } catch (error) {
            const stackTrace = await import('stack-trace').then(m => m.default || m)

            const channel = client.channels.cache.get("716518718947065868")
            const frame = stackTrace.parse(error)[0]
            const archivo = frame.getFileName().replace(process.cwd(), '')
            const metodo = frame.getFunctionName()
            console.error(error);

            if(interaction.deferred || interaction.replied) {
                interaction.editReply({content: "Ocurrio un error al ejecutar este comando... 〒▽〒\n-# envia esta captura al MD del owner (<@!665421882694041630>)", ephemeral: true});
            }else {
                interaction.reply({content: "Ocurrio un error al ejecutar este comando... 〒▽〒\n-# envia esta captura al MD del owner (<@!665421882694041630>)", ephemeral: true});
            }


            const embed = new EmbedBuilder()
            .setTitle("Ocurrio un error al ejecutar el comando")
            .setDescription("```" + error + "```")
            .addFields(
                {name: "📁 Archivo/funcion", value: `${archivo}:${frame.getLineNumber() || "Anonimo"}`},
                {name: "🤺 Metodo", value: `${metodo}`},
                {name: "⚡ Comando", value: `${interaction.commandName}/${subcommandName}`}
            )

            channel.send({embeds: [embed]})
        }

        return;
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
            case "usar":
                subcommands.Usar_item(client, interaction)
                break;
            case "comprar":
                subcommands.comprar(client, interaction)
                break;
            case "trabajar":
                subcommands.trabajar(client, interaction)
                break;
            case "duelo":
                subcommands.duelo(client, interaction)
                break;
            case "explorar":
                subcommands.explorar(client, interaction)
                break;
            case "regalar": 

            break;

        }

    },

    data: new SlashCommandBuilder()
    .setName("rol")
    .setDescription("Comandos de Rol")
    .setContexts(['Guild'])
    .addSubcommand(sub => 
        sub
        .setName("configurar_personaje")
        .setDescription("Establece o cambia información de tu presonaje: Foto, Apodo, Lore, etc.")
        .addAttachmentOption(img => 
            img
            .setName("foto")
            .setDescription("[Solo si quieres cambiar la foto de perfil de tu personaje]")
        )
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
        .setName("usar")
        .setDescription("Usa un objeto de tu inventario.")
        .addStringOption(o => 
            o
            .setName("item")
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
    )
    .addSubcommand(sub => 
        sub
        .setName("duelo")
        .setDescription("Invita a un personaje a un duelo.")
    .addIntegerOption(o => 
        o
        .setName("personaje")
        .setDescription("Ingresa la ID del personaje a retar")
        .setAutocomplete(true)
        .setRequired(true)
    )
    )
    .addSubcommand(sub => 
        sub.setName("explorar")
        .setDescription("Explora una region para obtener recompensas")
        .addNumberOption(num => 
            num.setName("region")
            .setDescription("Selecciona la region a explorar")
            .addChoices(
                {name: "[🏫] Tobeya", value: 1}
            )
            .setRequired(true)
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("regalar")
        .setDescription("Regala un objeto a otro personaje del Rol")
        .addNumberOption(o => 
            o
            .setName("personaje")
            .setDescription("Selecciona o ingresa la ID del personaje a regalar el objeto")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(o => 
            o
            .setName("item")
            .setDescription("Ingresa la ID del objeto a regalar")
            .setRequired(true)
            .setAutocomplete(true)

        )
        .addNumberOption(o => 
            o
            .setName("cantidad")
            .setDescription("Ingresa la cantidad de objetos que vas a regalar")
            .setRequired(true)
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("buzon")
        .setDescription("Mira los correos de tu buzón. Si no seleccionas ninguna opcion se manda la lista completa.")
        .addStringOption(o => 
            o.setName("correo")
            .setDescription("Mira un correo en especifico")
            .setAutocomplete(true)
        )
        .addStringOption(o => 
            o
            .setName("tipo")
            .setDescription("Filtra los correos por tipo especifico")
            .addChoices(
                {name: "[💌] Cartas", value: "Cartas"},
                {name: "[📦] Paquetes", value: "Paquete"},
                {name: "[🤖] Sistema", value: "Sistema"},
            )
        )
        .addBooleanOption(o => 
            o
            .setName("leidos")
            .setDescription("Mostrar los correos leidos")
        )
        .addNumberOption(o => 
            o
            .setName("remitente")
            .setDescription("Mostrar los correos de un remitente especifico")
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub => 
        sub
        .setName("craftear")
        .setDescription("Agrega contenido a objetos disponibles o crea nuevos objetos [experimental]")
        .addStringOption(o => 
            o
            .setName("item_principal")
            .setDescription("ID del Item principal que se usara en la receta")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(o => 
            o
            .setName("item")
            .setDescription("ID del item a mezclar")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addNumberOption(o => 
            o
            .setName("cantidad")
            .setDescription("Cantidad del item secundario que se usara en la receta")
            .setMaxValue(10)
            .setMinValue(1)
            .setRequired(true)
        )
    ),

    deleted: false
}