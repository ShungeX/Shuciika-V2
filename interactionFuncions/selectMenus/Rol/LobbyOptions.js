const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder, SelectMenuBuilder, StringSelectMenuOptionBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const NPCs = db2.collection("NPCs")
const character = db2.collection("Personajes")
const souls = db2.collection("Soul")
const version = require("../../../config")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')
const { duelSystem } = require("../../../functions/duelManager")
const util = require(`util`);
const getGifs = require("../../../functions/getGifs")
const updateInventario = require("../../../functions/updateInventario")
const dialogueSystem  = require("../../../functions/dialogoManager")
const sleep = util.promisify(setTimeout)

module.exports = {
    customId: "selectLobby",
    selectAutor: true,

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const interact = interaction.values[0]

        switch (interact) {
            case "introduccion":
                const context = {
                    context: {
                        client_avatar: client.user.avatarURL(),
                        user_id: interaction.user.id,
                        code: Date.now()
                    }

                }
                await dialogueSystem.startDialogue("general", "introduccion", interaction, context)
                break;
                case "normas":
                    await normas()
                    break;
                    case "manual":
                        await manual()
                        break;
            default:
                break;
        }

        async function normas() {
            const listNormas = [
                "\n-# 1. ✦ **¡Diviértete!** ¡No hay norma más simple y genial que esta!. <:Z_wow:763856350068604980>",
                "2. ✦ Si tienes alguna **Duda o Pregunta** puedes echar un vistazo a [**Guías del servidor**](https://canary.discord.com/channels/716342375303217285/1326558005168181331) o hacer una publicacion sobre tu duda en [**❓ Dudas**](https://canary.discord.com/channels/716342375303217285/1064054917662265404). Evita hacer uso incorrecto de ese canal ❓",
                "3. ✦ No menciones al Staff sin motivo urgente. Para consultas no prioritarias, usa el canal de [**Tickets**](https://canary.discord.com/channels/716342375303217285/1361480691824726087)",
                "4. ✦ Tener respeto hacía **todos** los miembros del server.",
                "5. ✦ Usa los canales **correctamente**. Evita hablar de temas que no van en el canal.",
                "6. ✦ Ser **pacientes** con las respuestas del **Staff**",
                "7. ✦ **No abusar** de las menciones de cualquier usuario, sobre todo al Staff (esto no esta permitido tampoco en el rol, con esto me refiero a mas de 5 menciones al mismo usuario en un lapso corto de tiempo).",
                "8. ✦ **Nada de racismo**. Si se te ve agrediendo a alguien de esa forma serás baneado de forma indefinida del servidor.",
                "9. ✦ **Esta prohibido** enviar contenido NSFW en este servidor o al MD de los usuarios. Cualquier persona que mande contenido +18 será baneado del servidor.",
                "10. ✦ **No te robes** el contenido ni los banners del servidor. ¡Todo ha sido creado con esfuerzo! Cualquier copia será sancionada con 3 advertencias automáticas.",
                "11. ✦ El uso de una multicuenta esta permitido siempre y cuando no hayas recibido sanciones o bans en tu cuenta principal o esta intente vulnerar alguna función del servidor",
                "12. ✦ Hay normas que no necesitan ser mencionadas, así que haz uso de tu **moralidad y sentido común**.",
                "13. ✦ No se permite la publicidad de otros servidores, redes o proyectos personales sin autorización previa del staff. Usa el canal de alianzas si deseas colaborar.",
                "...",
                "**⫭ ⨠ Queda recalcar que cada canal tiene su propia descripción, por lo que puede llegar a contener sus propias normas así que te recomendamos leer las descripciones de los canales **"
            ]

            const embed = new EmbedBuilder()
            .setTitle("Normas del servidor")
            .setDescription("`◈ Normas Generales para poder convivir sanamente. Recuerda leerlas, así te evitaras problemas con el Staff ◈`" +  
                listNormas.join("\n-# ")
            )
            .addFields(
                {name: "Normas del rol", value: "Para ver las normas del rol revisa el canal <#716865470648680448>"}
            )
            .setColor("Red")
            .setTimestamp()
            .setFooter({ text: "El contenido de las normas pueden cambiar de acuerdo a las necesidades del servidor, al interactuar con el servidor estas de acuerdo con estas mismas."})

            await interaction.reply({embeds: [embed], flags: ["Ephemeral"]})
        }

        async function manual() {
            const embed = new EmbedBuilder()
            .setTitle("Manual del estudiante")
            .setDescription("**Este manual te ayudara a saber donde encontrar contenido importante dentro del servidor** ( •̀ ω •́ )✧\n" + 
                `-# Es posible que algunos canales te aparezcan cómo "#Desconocidos" pero si les das click, funcionan. (Problema de discord)`
            )
            .addFields(
                {name: "Crear ficha", value: "[Creación de personaje](https://discord.com/channels/716342375303217285/1339103959855661096)\n[Personalidades](https://discord.com/channels/716342375303217285/1362988047578435605)\n[Foto de perfil para el personaje](https://discord.com/channels/716342375303217285/1330769969428041822)", inline: true},
                {name: "Lore del servidor", value: "[Lore del servidor](https://discord.com/channels/716342375303217285/1335001008920723598)", inline: true},
                {name: "Canales sobre anime", value: "[Waifus](https://discord.com/channels/716342375303217285/730548705815560334)\n[Husbandos](https://discord.com/channels/716342375303217285/730548931007873174)\n[Wallpapers anime](https://discord.com/channels/716342375303217285/730549164009848854)"},
                {name: "Canales sobre videojuegos", value: "<#872622897548648519>\n<#872622362665824346>\n<#872622542106550294>\n<#1331077659194818570>\n<#1064033792584601670>"},
                {name: "Exploracion", value: "Shuciika tambien se cansa de llevar tantos canales, asi que te invitamos a explorar la gran variedad de canales que tenemos `✨`"}
            )
            .setColor("Random")
            .setThumbnail("https://i.pinimg.com/736x/cf/9e/bc/cf9ebce6e5cc7a6bca44ded592b18bbf.jpg")

            await interaction.reply({ embeds: [embed], flags: ["Ephemeral"]})
        }
    }
}