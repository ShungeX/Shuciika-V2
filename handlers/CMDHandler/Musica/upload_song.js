const clientdb = require("../../../Server")
const db = clientdb.db("MusicDB")
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, TextInputBuilder, ModalBuilder, TextInputStyle} = require(`discord.js`)
const cloudinary = require("cloudinary").v2
const { DateTime } = require('luxon')
const timeMXF = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
const timeMXS = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATE_SHORT)
const Years = DateTime.now().setZone('UTC-6').setLocale('es').toFormat("yyyyLLddHHss")
const ffmpeg = require("fluent-ffmpeg")
const fs = require("fs")
const path = require("path")
const axios = require("axios")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */


module.exports = async(client, interaction) => {


        const transacciónId = uuidv4().replace(/-/g, "")
        const optionselect = interaction.options.getString("categoria")
        let xpricon = /https?:\/\/.*\.(?:PNG|png|jpg|jpeg|svg|webp)/g; 
        const musicdb = db.collection(`${optionselect}`)
        let xprsn = /https?:\/\/.*\.(?:mp3|ogg)/g; 
        const file = interaction.options.getAttachment("audio")
        const fileimg = interaction.options.getAttachment("portada")
        const archivoTemporal = path.join(__dirname, 'temp_audio.mp3');

        if(!fileimg.url.match(xpricon)) return interaction.reply({content: "El formato que enviaste de la portada no es valido. Verifica que sea un archivo valido"})
        if(!file.url.match(xprsn)) return interaction.reply({content: "El formato que enviaste no es valido. Verifica que sea un **`mp3`** o **`ogg`**"})



        async function downloadFile(url, archivoDest) {
        const respuesta = await axios({
            url,
            method: 'GET',
            responseType: "stream"
        })

        const writeStream = fs.createWriteStream(archivoDest)
        

        await new Promise((resolve, reject) => {
            respuesta.data.pipe(writeStream)
            writeStream.on("finish", resolve)
            writeStream.on("error", reject)
        });

        return new Promise((resolve, reject) => {
            
            ffmpeg(archivoDest)
            .ffprobe((err, metadata) => {
                fs.unlinkSync(archivoDest)

                if(err) {
                    return reject(err)
                } 

                const duracion = metadata.format.duration
                resolve(duracion)
            });
           
        });




    }

 
   
    
    try {


        const duracion = await downloadFile(file.url, archivoTemporal)

        console.log(duracion)

        const objinfo = {
            file: file,
            fileimg: fileimg,
            categoria: optionselect,
            duracion: duracion,
        }

        await transaccionCache.set(transacciónId, objinfo)
    
        const Row = new ActionRowBuilder()
        Row.addComponents([
            new ButtonBuilder()
            .setCustomId(`terminos_true-${interaction.user.id}`)
            .setStyle(ButtonStyle.Success)
            .setLabel("Acepto")
            .setEmoji("✅")
        ], [
            new ButtonBuilder()
            .setCustomId(`terminos_false-${interaction.user.id}`)
            .setStyle(ButtonStyle.Danger)
            .setLabel("Denegar")
            .setEmoji("🚫")
        ])

        const name = new TextInputBuilder()
        .setCustomId("music_name")
        .setLabel("Nombre de la cancion")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        const Author = new TextInputBuilder()
        .setCustomId("music_author")
        .setLabel("Autor de la cancion")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        const album = new TextInputBuilder()
        .setCustomId("music_album")
        .setLabel("Album")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)

        const Modal = new ModalBuilder()
        .setTitle("Metadata")
        .setCustomId(`music_metadata-${transacciónId}`)


        const row = new ActionRowBuilder()
        .addComponents(name)
        const row2 = new ActionRowBuilder()
        .addComponents(Author)
        const row4 = new ActionRowBuilder()
        .addComponents(album)



        Modal.addComponents(row, row2, row4)
        await interaction.showModal(Modal)

        const embed = new EmbedBuilder()
        .setTitle("¡Aviso!")
        .setDescription("**Para agregar una cancion. Es necesario tener en cuenta estos aspectos:**\n"
        + "`◊ Debes colocar los datos que se piden en el formulario tal y cómo son`\n" + "`◊ Cualquier audio LOUD o troll hara que se te banee de usar el comando`\n"
        + "`◊ Si la informacion no es la correcta y decides colocar cualquier otra cosa, provocaras unas sancion sobre el comando`\n")
        .addFields([
            { name: "Terminos", value: "Al darle click al boton de abajo estaras de acuerdo sobre esto."}
        ])

    }catch(e) {
        return interaction.reply({content: "``` Ocurrio Un error inesperado." + e + "```"})
    }

}