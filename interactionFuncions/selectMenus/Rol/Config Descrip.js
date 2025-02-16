const {ChatInputCommandInteraction, ModalBuilder,  ActionRowBuilder, EmbedBuilder, Client, TextInputBuilder, TextInputStyle} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const timeconvert = require("humanize-duration");

module.exports = {
    customId: "descripcionselect",
    selectAutor: true,
    

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

     ejecutar: async(client, interaction, character) => {
        const userf = await userdb.findOne({_id: interaction.user.id})

        const db2 = clientdb.db("Rol_db")
        const Cachedb = db2.collection("CachePJ")
        const cachepj = await Cachedb.findOne({_id: interaction.user.id})
        const time =  (1_000*60) - (Date.now() - userf?.time?.pjDescripcion) 

        if(!character) {
            return interaction.reply({ content: "Primero empecemos por crear tu personaje, ¿que dices (´･ᴗ･´)?\n-# ¿Porque no intentas crear uno?, usa el comando `/rol crear_ficha`", ephemeral: true})
        }
    

        if((Date.now() - userf?.time?.pjDescripcion) < 1_000 * 60) {
            return interaction.reply({ content: "¡Oye!, acabo de cambiar tu descripcion (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["m", "s"], round: true, conjunction: " y "})}` + "`** para establecer una nueva descripción (⇀‸↼‶)", ephemeral: true})
        }

        if(cachepj) {
            return interaction.reply({ content: "Esta funcion es exclusiva de personajes registrados\nQue tal si registras tu personaje usando el comando /rol enviar-ficha", ephemeral: true})
        }

        

        const modal = new ModalBuilder()
        .setCustomId("descripcionmodal")
        .setTitle("Descripcion del personaje")
        const descrip = new TextInputBuilder()
        .setCustomId("descripcionset")
        .setLabel("Ingresa la descripcion")
        .setPlaceholder("Las descripciones son cortas. Similares al 'info' de whatsapp")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(50)
        .setMinLength(1)
        .setRequired(true)

        const row = new ActionRowBuilder()
        .setComponents(descrip)

        await modal.addComponents(row)
        await interaction.showModal(modal)
     }
}