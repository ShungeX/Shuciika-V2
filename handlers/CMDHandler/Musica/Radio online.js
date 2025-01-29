const { createReadStream } = require('node:fs');
const { join } = require('node:path')
const { EmbedBuilder, ChatInputCommandInteraction} = require("discord.js")
const { createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection, joinVoiceChannel, StreamType, NoSubscriberBehavior } = require("@discordjs/voice")
const clientdb = require("../../../Server")
const db = clientdb.db("MusicDB")
const { exec, spawn } = require("child_process")
const https = require("https")


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {


    const optionselect = interaction.options.getString("categoria")
    var select = optionselect
    var resource2;
    var player;
    var message;
    var title = ""
    var author = ""
    var album = ""
    var imagen = ""
    var time = ""
    var url = ""
    var oldurl;
    var queue = []
    var ffmpeg;

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

    message = await interaction.deferReply({fetchReply: true})






    await playMusic()

    //Empieza la funcion de PlayMusic (Reproducir)

    async function playMusic() {

        ffmpeg = spawn('ffmpeg', [
            '-re', // Asegura que se procese en tiempo real
            '-i', url, // URL o archivo de entrada
            '-ac', '2', // Fuerza el audio estéreo
            '-b:a', '128k', // Establece una tasa de bits razonable
            '-f', 's16le', // Formato de salida
            '-ar', '48000', // Frecuencia de muestreo compatible con Discord
            '-' // Envía el audio directamente a stdout
        ])

    
  
        oldurl = url


    try {
       
        const resource = createAudioResource(ffmpeg.stdout, {
            inlineVolume: true,
            inputType: StreamType.Raw
        })
        const connect = await getVoiceConnection(channel.guild.id)
         player = createAudioPlayer()
        const connection = joinVoiceChannel({ 
            channelId: channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        resource.volume.setVolume(0.7)
        resource2 = url

        player.play(resource)
        connection.subscribe(player)

        sendEmbed()
        


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

        player.on(AudioPlayerStatus.Playing, () => {
            console.log("Reproduciendo", title)
        })

        player.on("error", (e) => {
            console.log("Ocurrio un error al intentar reproducir el audio.\n", e)
        })



    } catch (e) {
        console.log(e)
        return interaction.reply({content: "Ocurrio un error al intentar reproducir el audio", ephemeral: true})
    }

 

        
    }

    async function nextsong() {
        console.log("Eligiendo cancion...")
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

        if(!url) {
            await nextsong()
        }else if(url === oldurl) {
            await nextsong()
        }else {
            oldurl = url
            ffmpeg = spawn('ffmpeg', [
                '-re', // Asegura que se procese en tiempo real
                '-i', url, // URL o archivo de entrada
                '-ac', '2', // Fuerza el audio estéreo
                '-b:a', '128k', // Establece una tasa de bits razonable
                '-f', 's16le', // Formato de salida
                '-ar', '48000', // Frecuencia de muestreo compatible con Discord
                '-' // Envía el audio directamente a stdout
            ])
            


            return resource2 = createAudioResource(ffmpeg.stdout, {
                inlineVolume: true,
                inputType: StreamType.Raw
            })

        }

       
    }

    async function barra(tiempoactual, duracionTotal, longitudBarra = 20) {
        const porcentaje = tiempoactual / duracionTotal;
        const progreso = Math.round(porcentaje * longitudBarra);;

        let barra = '';

        for (let i = 0; i < longitudBarra; i++) {
            if(i === progreso) {
                barra += 'o';
            }else {
                barra += '-';
            }
        }

        return barra;
    }

    async function formatTime(segundos) {
        const segfix = Math.round(segundos)
        const minutos = Math.floor(segfix / 60);
        const seg = segfix % 60;

        return `${minutos}:${seg.toString().padStart(2, '0')}`;
    }

    async function sendEmbed() {
      
        let tiempoactual = 0;
        console.log( "Player:", player.eventNames(), tiempoactual, )


 try {
        if(!message) {
            const embeds = new EmbedBuilder()
            .setTitle("Sintonizando / Radio Shuciika")
            .setDescription("🌌 *Bajo el cielo estrellado de Tobeya. La música es nuestra guía*\n\n`Album:` " + album + "\n`Nombre:` " + 
                title + "\n`Autor:` " + author + "\n"
            )
            .addFields(
                {name: "Duración", value: `${await formatTime(tiempoactual)} / ${await formatTime(time)}\n${await barra(tiempoactual, time)}`}
            )
            .setColor("Purple")
            .setThumbnail(imagen)
        message = await interaction.channel.send({embeds: [embeds]})
        }else {
            const embeds = new EmbedBuilder()
            .setTitle("Sintonizando / Radio Shuciika")
            .setDescription("🌌 *Bajo el cielo estrellado de Tobeya. La música es nuestra guía*\n\n`Album:` " + album + "\n`Nombre:` " + 
                title + "\n`Autor:` " + author + "\n"
            )
            .addFields(
                {name: "Duración", value: `${await formatTime(tiempoactual)} / ${await formatTime(time)}\n${await barra(tiempoactual, time)}`}
            )
            .setColor("Purple")
            .setThumbnail(imagen)
          message.edit({embeds: [embeds]})
        }



    const interval = setInterval(async () => {
        tiempoactual += 5;

        if(tiempoactual > time) tiempoactual = time;


        const embed = new EmbedBuilder()
        .setTitle("Sintonizando / Radio Shuciika")
        .setDescription("🌌 *Bajo el cielo estrellado de Tobeya. La música es nuestra guía*\n\n`Album:` " + album + "\n`Nombre:` " + 
            title + "\n`Autor:` " + author + "\n"
        )
        .addFields(
            {name: "Duración", value: `${await formatTime(tiempoactual)} / ${await formatTime(time)}\n${await barra(tiempoactual, time)}`}
        )
        .setColor("Purple")
        .setThumbnail(imagen)
       message.edit({embeds: [embed]})

        if(tiempoactual >= time || player.state.status === AudioPlayerStatus.Idle) {
            player.removeAllListeners()
                clearInterval(interval)

                ffmpeg.kill()
                tiempoactual = 0
                await nextsong()
                sendEmbed()
                resource2.volume.setVolume(0.5)
                await player.play(resource2)



            
        }
    }, 5000)

} catch (error) {
    if(error.code === 50027) {
        const embed = new EmbedBuilder()
        .setTitle("Sintonizando / Radio Shuciika")
        .setDescription("🌌 *Bajo el cielo estrellado de Tobeya. La música es nuestra guía*\n\n`Album:` " + album + "\n`Nombre:` " + 
            title + "\n`Autor:` " + author + "\n"
        )
        .addFields(
            {name: "Duración", value: `${await formatTime(tiempoactual)} / ${await formatTime(time)}\n${await barra(tiempoactual, time)}`}
        )
        .setColor("Purple")
        .setThumbnail(imagen)
        message = interaction.channel.send(embed)
    }
    console.log(error)
}



    }

}