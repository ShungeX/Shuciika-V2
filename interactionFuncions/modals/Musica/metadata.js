const { ActionRowBuilder, ChatInputCommandInteraction, EmbedBuilder, ApplicationCommandOptionType, Client, WebhookClient} = require(`discord.js`)
const cloudinary = require("cloudinary").v2
const clientdb = require("../../../Server")
const { DateTime } = require('luxon')
const timeMXF = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
const Years = DateTime.now().setZone('UTC-6').setLocale('es').toFormat("yyyyLLddHHss")
const db = clientdb.db("MusicDB")
const transaccionCache = require("../../../utils/cache")

module.exports = {
    customId: "music_metadata",

     /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, options) => {
        const names = interaction.fields.getTextInputValue("music_name")
        const authors = interaction.fields.getTextInputValue("music_author")
        const album = interaction.fields.getTextInputValue("music_album")

        const infometa = await transaccionCache.get(options)

        if(!infometa) return interaction.reply({content: "Esta interaccion ya no esta disponible", ephemeral: true})

        const musicdb = await db.collection(`${infometa.categoria}`)

        await interaction.deferReply()

        async function generateID() {
            while(true) {
                uniqueID = Math.floor(Math.random() * 999) + 1;
                const verify = await musicdb.findOne({"Objetos.ID": uniqueID},
                    {projection: {"Objetos": {$elemMatch: {ID: uniqueID}}}}
                )
                
                if(!verify) break
            }
        return uniqueID
        }
       const urlsong = await cloudinary.uploader
        .upload(
            infometa.file.url, {
                resource_type: "auto",
                public_id: `${names}-${album}-${authors}`,
                folder: "Songs"
            }
        ).catch(err => {
            console.log("No pude subir el audio", err)
            return interaction.editReply("No pude subir el audio a la nube. Intenta más tarde o contacta al soporte (_　_)。゜zｚＺ")
        })

        const imgres = await cloudinary.uploader
        .upload(
            infometa.fileimg.url, {
                public_id: `${names}-${album}`,
                folder: "Songs"
            }
        ).catch(err => {
            console.log("No pude subir la imagen:",err)
            return interaction.editReply("No pude subir la imgen a la nube. Intenta más tarde o contacta al soporte (_　_)。゜zｚＺ")
        })



        try {
           await musicdb.insertMany([{
                _id: `${await generateID()}`,
                song_url: urlsong.secure_url,
                song_name: names,
                song_author: authors,
                song_album: album,
                song_imagen: imgres.secure_url,
                song_time: infometa.duracion,
                song_dateUP: timeMXF
            }])

            const embed = new EmbedBuilder()
            .setTitle("Nueva cancion agregada a mi radio")
            .setAuthor({name: `${authors}`})
            .setDescription("`Nombre:`" + ` **${names}** ` + "\n" + "`Author:`" + ` **${authors}**\n` + "`Album:`" + ` ${album}`)
            .setThumbnail(imgres.secure_url)
            .setColor("Green")
            interaction.editReply({embeds: [embed]})

        transaccionCache.delete(options)
        }catch(e) {
            console.log(e)
            return interaction.editReply({content: "Ocurrio un error, revisa la consola"})
        }
    }
}