const { createReadStream } = require('node:fs');
const { join } = require('node:path')
const { EmbedBuilder} = require("discord.js")
const { joinVoiceChannel, StreamType, NoSubscriberBehavior } = require("@discordjs/voice")
const { createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require("@discordjs/voice")
const Discord = require("discord.js")
const clientdb = require("../../../Server")
const db = clientdb.db("MusicDB")

module.exports = async(client, interaction) => {
    const optionselect = interaction.options.getString("categoria")
    var select = optionselect
    var resource2;
    var m;
    var title = ""
    var author = ""
    var album = ""
    var imagen = ""
    var time = ""
    var url = ""

    if(optionselect === "RND") {
        const options = ["A1", "AN1", "KPOP1", "A2", "PSK1"]
        select = options[Math.floor(Math.random() * options.length)]
    }

    
    const rol = interaction.guild.roles.cache.find((r) => r.id === "745503889297637478")
    if(!interaction.member.roles.cache.has(rol.id)) {
        return interaction.reply({ content: 'Lo siento, solo el **staff** puede usar este comando (╥﹏╥)', ephemeral: true})
      }


    const musicdb = db.collection(`${select}`)
    const pauseoption = interaction.options.getString("options")


    const channel = interaction.member.voice.channel;
    if(!channel) return interaction.reply({content: "No estas conectado a un canal de voz", ephemeral: true})

    
    await musicdb.aggregate([{ $sample: {size: 1}}]).forEach(e => {
        title = e.song_name
        author = e.song_author
        album = e.song_album
        imagen = e.song_imagen
        time = e.song_time
        url = e.song_url
    })


    playMusic()

    async function playMusic() {
  
        console.log(url)


    try {
        const resource = await createAudioResource(url, {
            inlineVolume: true
        })
        const connect = getVoiceConnection(channel.guild.id)
        const player = createAudioPlayer()
        const connection = joinVoiceChannel({ 
            channelId: channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        resource.volume.setVolume(0.5)

        player.play(resource)
        connection.subscribe(player)

        

        const embed = new EmbedBuilder()
        .setTitle("Sintonizando / Radio Shuciika")
        .setDescription("🌌 *Bajo el cielo estrellado de Tobeya. Nuestra música es nuestra guía*\n\n`Album:`" + album + "\n\n`Nombre:`" + 
            title + "\n\n`Autor:`" + author 
        )
        .setColor("Purple")
        .setThumbnail(imagen)
        .setThumbnail(imagen)
       m = await interaction.reply({embeds: [embed], fetchReply: true})
        if(!connect) {

        }

        if(connect) {
            if(pauseoption == "destroypy") {
                connect.destroy()
                return interaction.reply({content: "Conexion Destruida", ephemeral: true})
            }

            if(pauseoption == "pausepy") {
                player.pause()
                return interaction.reply({ content: "Reproductor Pausado", ephemeral: true})
            }
            if(pauseoption == "unpausepy") {
                player.unpause
                return interaction.reply({ content: "Reproductor Resumido", ephemeral: true})
            }

        }

        player.on("stateChange", (old, e) => {
            console.log("Status Resource:", e.status)
            console.log("Old Status:", old.status)
        })

        player.on("error", (e) => {
            console.log("Ocurrio un error al intentar reproducir el audio.\n", e)
        })

        player.on(AudioPlayerStatus.Idle, async () => {
            await nextsong()
            resource2.volume.setVolume(0.5)
            player.play(resource2)
            const embed = new EmbedBuilder()
            .setTitle("Sintonizando / Radio Shuciika")
            .setDescription("🌌 *Bajo el cielo estrellado de Tobeya. Nuestra música es nuestra guía*\n\n`Album:`" + album + "\n\n`Nombre:`" + 
                title + "\n\n`Autor:`" + author 
            )
            .setColor("Purple")
            .setThumbnail(imagen)
        await m.edit({embeds: [embed]})
        })

    } catch (e) {
        console.log(e)
        return interaction.reply({content: "Ocurrio un error al intentar reproducir el audio", ephemeral: true})
    }

 

        
    }

    async function nextsong() {

        if(optionselect === "RND") {
            const options = ["A1", "AN1", "KPOP1","A2", "PSK1"]
            select = options[Math.floor(Math.random() * options.length)]
        }

        const rnddb = db.collection(`${select}`)

        await rnddb.aggregate([{ $sample: {size: 1}}]).forEach(e => {
            title = e.song_name
            author = e.song_author
            album = e.song_album
            imagen = e.song_imagen
            time = e.song_time
            url = e.song_url
        })

        if(resource2 === url) {
            await nextsong()
        }else {
            return resource2 = createAudioResource(url, {
                inlineVolume: true
            })
        }

       
    }

}