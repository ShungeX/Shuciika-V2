const { EmbedBuilder, ChatInputCommandInteraction, Client, Collection } = require(`discord.js`)
const { SlashCommandBuilder } = require("@discordjs/builders");
const fs   = require('fs');
const path = require('path');
const { devs } = require("../../config/configslash.json");
const { getCharacterData } = require("../../utils/getDataCharacters");


module.exports = {
    data: new SlashCommandBuilder()
        .setName("rol")
        .setDescription("Comandos de Rol")
        .setContexts(['Guild']),

    subcommands: new Collection(),

    /**
     * Carga todos los subcomandos de la carpeta handlers/CMDHandler/Rol
     * y los registra tanto en SlashCommandBuilder como en la colección interna.
     */
    async cargarSubCommands() {
        const commandPath = path.join(__dirname, "../../handlers/CMDHandler/Rol")

        const commandFolders = fs.readdirSync(commandPath).filter(folder =>
            fs.lstatSync(path.join(commandPath, folder)).isDirectory()
        );

        for (const folder of commandFolders) {
            const commandFiles = fs.readdirSync(path.join(commandPath, folder)).filter(file => file.endsWith('.js'))
            for (const file of commandFiles) {
                const filePath = path.join(commandPath, folder, file);
                const subcommand = require(filePath);

                if ('data' in subcommand && 'ejecutar' in subcommand) {
                    this.data.addSubcommand(subcommand.data);
                    this.subcommands.set(subcommand.data.name, subcommand);
                } else {
                    console.warn(`[ADVERTENCIA] El subcomando en ${filePath} no tiene la propiedad "data" o "ejecutar"`)
                }
            }
        }
    },

    /**
     * Punto de entrada del comando /rol.
     * Resuelve el subcomando solicitado, valida mantenimiento/devOnly,
     * obtiene los datos de personaje/soul/caché según requirements y
     * delega la ejecución al handler correspondiente.
     *
     * @param {Client} client
     * @param {ChatInputCommandInteraction} interaction
     */
    async ejecutar(client, interaction) {
        const subcommandName = interaction.options.getSubcommand();
        const subcommand     = this.subcommands.get(subcommandName);
        console.log("Nombre del subcomando:", subcommandName)

        if (!subcommand || subcommand?.enMantenimiento) return interaction.reply({ content: "Este comando esta en mantenimiento. Se paciente （︶^︶)", flags: ["Ephemeral"] })

        try {
            if (subcommand.isDevOnly && !devs.includes(interaction.member.id)) return interaction.reply({ content: "Este comando solo esta disponible para el Staff 〒▽〒", flags: ["Ephemeral"] })

            const requirements = subcommand.requirements || {};

            // Obtiene character, soul y cachepj en una sola llamada optimizada.
            // getCharacterData resuelve el personajeActivo desde usuarios_server
            // y lanza las consultas a Personajes/Soul/CachePJ en paralelo.
            const { character, soul, cachepj } = await getCharacterData(
                interaction.user.id,
                requirements
            );

            if (requirements.character?.required && !character) {
                if (cachepj) {
                    return interaction.reply({ content: "No puedes usar este comando porque necesitas que tu ficha primero se verifique 〒▽〒\n-# Sé paciente y espera a alguien del staff.", flags: ["Ephemeral"] });
                }
                return interaction.reply({ content: "No puedes usar este comando porque necesitas un personaje＞﹏＜\n-# Intenta crear uno con `/rol crear_ficha`.", flags: ["Ephemeral"] });
            }

            if (requirements.soul?.required && !soul) {
                return interaction.reply({ content: "Tu personaje necesita despertar su poder para usar este comando 〒▽〒\n-# Debes esperar a que ocurra en el rol.", flags: ["Ephemeral"] });
            }

            if (requirements.cache?.required && !cachepj) {
                return interaction.reply({ content: "Necesitas tener un personaje en proceso de registro 〒▽〒\n-# Intenta crear uno con `/rol crear_ficha`.", flags: ["Ephemeral"] });
            }

            await subcommand.ejecutar(client, interaction, {
                character,
                soul,
                cachepj,
            })

        } catch (error) {
            console.error("Error al ejecutar subcomando en 01-navi-central.js:", error);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: "Ocurrió un error al ejecutar este comando... 〒▽〒\n-# Envía esta captura al MD del owner (<@!665421882694041630>)", flags: ["Ephemeral"] }).catch(() => {});
                } else {
                    await interaction.reply({ content: "Ocurrió un error al ejecutar este comando... 〒▽〒\n-# Envía esta captura al MD del owner (<@!665421882694041630>)", flags: ["Ephemeral"] }).catch(() => {});
                }

                const stackTrace = require('stack-trace');
                const frames = stackTrace.parse(error);
                const frame = frames && frames[0];
                const archivo    = frame && frame.getFileName()    ? frame.getFileName().replace(process.cwd(), '')  : 'Desconocido';
                const metodo     = frame && frame.getFunctionName() ? frame.getFunctionName()                        : 'Anónimo';
                const lineNumber = frame && frame.getLineNumber()   ? frame.getLineNumber()                          : 'Anónimo';

                const channel = client.channels.cache.get("716518718947065868");
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle("Ocurrió un error al ejecutar el comando")
                        .setDescription("```" + (error.stack || error).slice(0, 4000) + "```")
                        .addFields(
                            { name: "📁 Archivo/función", value: `${archivo}:${lineNumber}` },
                            { name: "🤺 Método",          value: `${metodo}` },
                            { name: "⚡ Comando",         value: `${interaction.commandName}/${subcommandName}` }
                        );
                    await channel.send({ embeds: [embed] }).catch(() => {});
                }
            } catch (e) {
                console.error("Error secundario en catch de 01-navi-central.js:", e);
            }
        }

        return;

    },

    deleted: false
}
