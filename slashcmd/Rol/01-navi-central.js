const { EmbedBuilder, ChatInputCommandInteraction, Client, Collection } = require(`discord.js`)
const { SlashCommandBuilder } = require("@discordjs/builders");
const clientdb = require("../../Server")
const fs = require('fs');
const path = require('path');
const { devs, } = require("../../configslash.json");
const db2 = clientdb.db("Rol_db")
const db = clientdb.db("Server_db")
const userdbs = db.collection("usuarios_server")
const Cachedb = db2.collection("CachePJ")
const Character = db2.collection("Personajes")
const souls = db2.collection("Soul")


module.exports = {
    data: new SlashCommandBuilder()
        .setName("rol")
        .setDescription("Comandos de Rol")
        .setContexts(['Guild']),

    subcommands: new Collection(),

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
 * 
 * @param {Client} client 
 * @param {ChatInputCommandInteraction} interaction 
 */

    async ejecutar(client, interaction) {
        const subcommandName = interaction.options.getSubcommand();
        const subcommand = this.subcommands.get(subcommandName);
        console.log("Nombre del subcomando:", subcommandName)

        if (!subcommand || subcommand?.enMantenimiento) return interaction.reply({ content: "Este comando esta en mantenimiento. Se paciente （︶^︶)", ephemeral: true })

        try {
            if (subcommand.isDevOnly && !devs.includes(interaction.member.id)) return interaction.reply({ content: "Este comando solo esta disponible para el Staff 〒▽〒", ephemeral: true })
            const userdb = await userdbs.findOne({_id: interaction.user.id})

            const requirements = subcommand.requirements || {};
            const dbPromises = [];

            if (requirements.character?.obtener) dbPromises.push(Character.findOne({ _id: userdb?.nix?.personajeActivo }));
            if (requirements.soul?.obtener) dbPromises.push(souls.findOne({ _id: userdb?.nix?.personajeActivo }));
            if (requirements.cachepj?.obtener) dbPromises.push(Cachedb.findOne({ _id: interaction.user.id }));

            const [character, soul, cachepj] = await Promise.all(dbPromises);

            if (requirements.character?.required && !character) {
                if (cachepj) {
                    return interaction.reply({ content: "No puedes usar este comando porque necesitas que tu ficha primero se verifique 〒▽〒\n-# Sé paciente y espera a alguien del staff.", ephemeral: true });
                }
                return interaction.reply({ content: "No puedes usar este comando porque necesitas un personaje＞﹏＜\n-# Intenta crear uno con `/rol crear_ficha`.", ephemeral: true });
            }

            if (requirements.soul?.required && !soul) {
                return interaction.reply({ content: "Tu personaje necesita despertar su poder para usar este comando 〒▽〒\n-# Debes esperar a que ocurra en el rol.", ephemeral: true });
            }

            if (requirements.cache?.required && !cachepj) {
                return interaction.reply({ content: "Necesitas tener un personaje en proceso de registro 〒▽〒\n-# Intenta crear uno con `/rol crear_ficha`.", ephemeral: true });
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

            if (interaction.deferred || interaction.replied) {
                interaction.editReply({ content: "Ocurrio un error al ejecutar este comando... 〒▽〒\n-# envia esta captura al MD del owner (<@!665421882694041630>)", ephemeral: true });
            } else {
                interaction.reply({ content: "Ocurrio un error al ejecutar este comando... 〒▽〒\n-# envia esta captura al MD del owner (<@!665421882694041630>)", ephemeral: true });
            }


            const embed = new EmbedBuilder()
                .setTitle("Ocurrio un error al ejecutar el comando")
                .setDescription("```" + error + "```")
                .addFields(
                    { name: "📁 Archivo/funcion", value: `${archivo}:${frame.getLineNumber() || "Anonimo"}` },
                    { name: "🤺 Metodo", value: `${metodo}` },
                    { name: "⚡ Comando", value: `${interaction.commandName}/${subcommandName}` }
                )

            channel.send({ embeds: [embed] })
        }

        return;

    },

    deleted: false
}
