const { EmbedBuilder, ActionRowBuilder,  ChatInputCommandInteraction, StringSelectMenuBuilder, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db= clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const timeconvert = require("humanize-duration");
const dbconfig = db.collection("usuarios_server")
const version = require("../../../config")
const { procesarFoto } = require("../../../interactionFuncions/modals/Rol/Modal Foto")

module.exports = {
    requireCharacter: true,
    requireSoul: false,
    requireCharacterCache: true,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: false,
        Character: false,
        Cachepj: false
    },


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */


 ejecutar: async(client, interaction, {character, cachepj}) => {
    const userdb = await dbconfig.findOne({_id: interaction.user.id})
    const imgs = await interaction.options.getAttachment("foto")
    var options = [
        {
            label: "Foto",
            description: "Establece o cambia la foto de tu personaje",
            value: `fotoselect`,
            emoji: "📷",
        }, 
        {
            label: "Historia", 
            description: "El lore de tu personaje",
            value: `historiaselect`,
            emoji: "🦜"
        }, 
        {
            label: "Apodo",
            description: "Otras formas de llamar a tu personaje",
            value: `apodoselect`,
            emoji: "🗿"
        }, 
        {
            label: "Descripcion", 
            description: "Establece una descripcion a tu personaje.",
            value: `descripcionselect`,
            emoji: "🔖"
        }, 
    ]

     if(!cachepj.isFinish) {
        return interaction.reply({ content: "No has terminado de crear tu ficha. ☆⌒(>。<)\n usa el comando `/rol crear_ficha para continuar` ", ephemeral: true})
    }

    if(imgs) {
        const time =  300000 - (Date.now() - userdb?.time?.pjFoto) 

        if((Date.now() - userdb?.time?.pjFoto) < 300000) {
            return interaction.reply({ content: "¡Oye!, Acabo de pegar tu foto... Bueno, es lo de menos (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["m", "s"], round: true, conjunction: " y "})}` + "`** para establecer otra foto nueva (⇀‸↼‶)", ephemeral: true})
        }
  
        
        await procesarFoto(interaction, imgs.url)
        return 
    }



    if(userdb?.Permissions?.especial) {
        options.push (
            {
                label: "Cumpleaños [Especial]",
                description: "Cambia la fecha de cumpleaños de tu personaje",
                value: `cumpleselect`,
                emoji: "🎂"
            },
            {
                label: "Nombre [Especial]",
                description: "Cambia el nombre de tu personaje",
                value: `nombreselect`,
                emoji: "📄"
            },
            {
                label: "Familia [Especial]",
                description: "Cambia la familia de tu personaje",
                value: `familiaselect`,
                emoji: "👨‍👩‍👧‍👦"
            },
        )
    }

    const row = new ActionRowBuilder()
    .addComponents(
        new StringSelectMenuBuilder()
        .setCustomId(`configCharacter-${interaction.user.id}`)
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
}