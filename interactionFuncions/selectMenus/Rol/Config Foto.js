const {ChatInputCommandInteraction, ModalBuilder,  ActionRowBuilder, EmbedBuilder, Client, TextInputBuilder, TextInputStyle} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const timeconvert = require("humanize-duration");
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")

module.exports = {
    customId: "configCharacter",
    selectAutor: true,
    

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

     ejecutar: async(client, interaction, character, nan, nan2, nan3, options) => {
        const userf = await userdb.findOne({_id: interaction.user.id})
        
        if(!character) {
            return interaction.reply({ content: "Primero empecemos por crear tu personaje, ¿que dices (´･ᴗ･´)?\n-# ¿Porque no intentas crear uno?, usa el comando `/rol crear_ficha`", ephemeral: true})
        }

        switch (options) {
            
            case "fotoselect" : 
            if((Date.now() - userf?.time?.pjFoto) < 300000) {
                const time =  300000 - (Date.now() - userf?.time?.pjFoto)
                return interaction.reply({ content: "¡Oye!, Acabo de pegar tu foto... Bueno, es lo de menos (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["m", "s"], round: true, conjunction: " y "})}` + "`** para establecer otra foto nueva (⇀‸↼‶)", ephemeral: true})
            }
            await optionFoto()
            break;
            case "historiaselect" : 
            await optionHistory()
            break;
            case "apodoselect" : 
            await optionApodo()
            break;
            case "descripcionselect" : 
            await optionDescripcion()
            break;
            case "cumpleselect" : 
            await optionCumpleaños()
            break;
            case "nombreselect" : 
            await optionNombre()
            break;
            case "familiaselect" : 
            await optionFamilia()
            break;
        }
        


        async function optionFoto() {
            const time =  300000 - (Date.now() - userf?.time?.pjFoto)

            const modal = new ModalBuilder()
            .setCustomId("fotomodal")
            .setTitle("Foto de personaje")
            const imgset = new TextInputBuilder()
            .setCustomId("imagenset")
            .setLabel("Link de la imagen.")
            .setPlaceholder("Antes de enviar el link de tu imagen recuerda revisar el foro.")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setMinLength(20)
            .setRequired(true)
    
            const row = new ActionRowBuilder()
            .setComponents(imgset)
    
            await modal.addComponents(row)
            await interaction.showModal(modal)
        }

        async function optionApodo() {
            const time =  (3600000*24) - (Date.now() - userf?.time?.pjApodo) 

            if((Date.now() - userf?.time?.pjApodo) < (3600000 * 24) ) {
                return interaction.reply({ content: "¡Oye!, Acabo de decirle a mis amigos de tu nuevo apodo... (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["h", "m", "s"], round: true, conjunction: " y "})}` + "`** para establecer un nuevo apodo (⇀‸↼‶)", ephemeral: true})
            }
    
            const modal = new ModalBuilder()
            .setCustomId("apodomodal")
            .setTitle("Apodo del personaje")
            const apodoset = new TextInputBuilder()
            .setCustomId("apodoset")
            .setLabel("Ingresa el apodo")
            .setPlaceholder("No uses apodos ofensivos")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(10)
            .setMinLength(2)
            .setRequired(true)
    
            const row = new ActionRowBuilder()
            .setComponents(apodoset)
    
            await modal.addComponents(row)
            await interaction.showModal(modal)
        }

        async function optionDescripcion() {

            const time =  (1_000*60) - (Date.now() - userf?.time?.pjDescripcion) 
            const cachepj = await Cachedb.findOne({_id: interaction.user.id})


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

        async function optionHistory() {
            const time = 60000 - (Date.now() - userf?.time?.pjHistoria) 

            if((Date.now() - userf?.time?.pjHistoria) < 60000) {
                return interaction.reply({ content: "¡Oye!, Acabo de escribir mucho... estoy cansada (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["m", "s"], round: true, conjunction: " y "})}` + "`** para establecer otra historia(⇀‸↼‶)", ephemeral: true})
            }
        
    
            const modal = new ModalBuilder()
            .setCustomId("historiamodal")
            .setTitle("Historia del personaje")
            const historia = new TextInputBuilder()
            .setCustomId("historiaset")
            .setLabel("Historia a establecer")
            .setPlaceholder("Todo tuyo... [Intenta ser coherente]")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(2000)
            .setMinLength(50)
            .setRequired(true)
    
            const row = new ActionRowBuilder()
            .setComponents(historia)
    
            await modal.addComponents(row)
            await interaction.showModal(modal)
        }

        async function optionNombre() {
            if(userf?.PermissionsTime?.editname <= 0) {
                return interaction.reply({ content: "¡Oye!, no hay más autocorrector para cambiar tu nombre... quizás debas obtener más con un `permiso especial` (￣へ￣)", ephemeral: true})
            }
    
            if(!character) {
                return interaction.reply({ content: "Primero empecemos por crear tu personaje, ¿que dices (´･ᴗ･´)?\n-# ¿Porque no intentas crear uno?, usa el comando `/rol crear_ficha`", ephemeral: true})
            }
        
    
            const modal = new ModalBuilder()
            .setCustomId("nombremodal")
            .setTitle("Nombre del personaje")
            const nombre = new TextInputBuilder()
            .setCustomId("nombreset")
            .setLabel("Ingresa el nombre")
            .setPlaceholder("No uses nombres ofensivos")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(10)
            .setMinLength(3)
            .setRequired(true)
    
            const row = new ActionRowBuilder()
            .setComponents(nombre)
    
            await modal.addComponents(row)
            await interaction.showModal(modal)
        }


     }
}