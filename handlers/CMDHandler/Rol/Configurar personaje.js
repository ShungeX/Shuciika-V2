const { EmbedBuilder, ActionRowBuilder,  ChatInputCommandInteraction, StringSelectMenuBuilder, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db= clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const dbconfig = db.collection("usuarios_server")
const version = require("../../../config")

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const personaje = await character.findOne({_id: interaction.user.id})
    const cachepj = await character.findOne({_id: interaction.user.id})
    const userdb = await dbconfig.findOne({_id: interaction.user.id})
    var options = [
        {
            label: "Foto",
            description: "Establece o cambia la foto de tu personaje",
            value: `fotoselect-${interaction.user.id}`,
            emoji: "📷",
        }, 
        {
            label: "Historia", 
            description: "El lore de tu personaje",
            value: `historiaselect-${interaction.user.id}`,
            emoji: "🦜"
        }, 
        {
            label: "Apodo",
            description: "Otras formas de llamar a tu personaje",
            value: `apodoselect-${interaction.user.id}`,
            emoji: "🗿"
        }, 
        {
            label: "Descripcion", 
            description: "Establece una descripcion a tu personaje.",
            value: `descripcionselect-${interaction.user.id}`,
            emoji: "🔖"
        }, 
    ]


    if(!personaje && !cachepj) {
        return interaction.reply({ content: "Primero empecemos por crear tu personaje, ¿que dices (´･ᴗ･´)?\n-# ¿Porque no intentas crear uno?, usa el comando `/rol crear_ficha`"})
    }else if(cachepj.isFinish) {
        return interaction.reply({ content: "No has terminado de crear tu ficha. ☆⌒(>。<)\n usa el comando `/rol crear_ficha para continuar` ", ephemeral: true})
    }


    if(userdb?.Permissions?.especial) {
        options.push (
            {
                label: "Cumpleaños [Especial]",
                description: "Cambia la fecha de cumpleaños de tu personaje",
                value: `cumpleselect-${interaction.user.id}`,
                emoji: "🎂"
            },
            {
                label: "Nombre [Especial]",
                description: "Cambia el nombre de tu personaje",
                value: `nombreselect-${interaction.user.id}`,
                emoji: "📄"
            },
            {
                label: "Familia [Especial]",
                description: "Cambia la familia de tu personaje",
                value: `familiaselect-${interaction.user.id}`,
                emoji: "👨‍👩‍👧‍👦"
            },
        )
    }

    const row = new ActionRowBuilder()
    .addComponents(
        new StringSelectMenuBuilder()
        .setCustomId(`select1-${interaction.user.id}`)
        .setMaxValues(1)
        .setPlaceholder("Selecciona una opcion")
        .addOptions(options)
    )


    const embed = new EmbedBuilder()
    .setTitle("Selecciona una opcion")
    .setDescription("Al seleccionar una opcion se enviara un **`Formulario (Modal)` donde podras colocar la informacion requerida**")
    .addFields(
        {name: "Opciones", value: "`[📷]` **Foto** \n`[🦜]` **Historia** \n`[🗿]`  **Apodo** \n`[🔖]`  **Descripcion**", inline: true},
        {name: "Permiso especial", value: "`[🎂]` **Cumpleaños** \n`[🤸🏻‍♂️]` **Nombre** \n`[👨‍👩‍👧‍👦]` **Familia**", inline: true},
        {name: "¿Falta opción?", value: `¿Crees que falta alguna opcion?, envianos una sugerencia`}
    )
    .setColor("Random")


    await interaction.reply({embeds: [embed], components: [row]})

}