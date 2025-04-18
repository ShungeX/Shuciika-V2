const { createReadStream } = require('node:fs');
const { join } = require('node:path')
const { EmbedBuilder, ChatInputCommandInteraction} = require("discord.js")
const { createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection, joinVoiceChannel, StreamType, NoSubscriberBehavior, VoiceConnectionStatus } = require("@discordjs/voice")
const clientdb = require("../../../Server")
const db = clientdb.db("MusicDB")
const { exec, spawn } = require("child_process")
const https = require("https")
const transaccionCache = require("../../../utils/cache")


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {

    const cacheget = transaccionCache.get("ShuciikaMusic")


    const optionselect = interaction.options.getString("categoria")
    console.log("Version", 1.5)
    var select = optionselect
    var resource2;
    var player = cacheget?.player || "";
    var message = cacheget?.message || "";
    var title = ""
    var author = ""
    var album = ""
    var imagen = ""
    var time = ""
    var url = ""
    var oldurl;
    var ffmpeg = cacheget?.ffmpeg || "";
    var tiempoactual = 0;
    var interval = cacheget?.interval || "";
    var canciones_tocadas = 0;
    const TimeTotal = Math.floor(Date.now() / 1000)



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



    if(cacheget) {
        await player.stop()
        await clearInterval(interval)
        await ffmpeg?.kill()
        console.log("Eligiendo nuevamente...")
        interval = false
        ffmpeg = ""
        resource2 = ""
    }


    await playMusic()

    //Empieza la funcion de PlayMusic (Reproducir)

    async function playMusic() {

       url = url.replace('/upload/', '/upload/q_auto:low,br_96k/')

        ffmpeg = spawn('ffmpeg', [
            '-re', // Asegura que se procese en tiempo real
            '-i', url, // URL o archivo de entrada
            '-ac', '2', // Fuerza el audio estéreo
            '-b:a', '96k', // Establece una tasa de bits razonable
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
        const connection = joinVoiceChannel({ 
            channelId: channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        player = connection.state.subscription?.player || createAudioPlayer();

        resource.volume.setVolume(0.7)
        resource2 = url

        player.play(resource)
        connection.subscribe(player)
        if(connect) {
            if(pauseoption == "destroypy") {
                connect.destroy()
                clearInterval(interval)
                ffmpeg.kill()
                player.stop()
                transaccionCache.delete("ShuciikaMusic")
                return interaction.editReply({content: "Conexion Destruida", ephemeral: true})
            }

            if(pauseoption == "pausepy") {
                player.pause()
                return interaction.editReply({ content: "Reproductor Pausado", ephemeral: true})
            }
            if(pauseoption == "unpausepy") {
                player.unpause
                return interaction.editReply({ content: "Reproductor Resumido", ephemeral: true})
            }

        }

        await interaction.editReply({content: `Reproduciendo desde: <t:${TimeTotal}:R>`})
        sendEmbed()

       
        




        player.on(AudioPlayerStatus.Playing, () => {
            console.log("Reproduciendo", title)
        })

        player.on("error", (e) => {
            console.log("Ocurrio un error al intentar reproducir el audio.\n", e)
        })

        connection.on("stateChange", async (oldState, newState) => {
            if(newState.status === VoiceConnectionStatus.Disconnected) {

                if(player) {
                    clearInterval(interval)
                    interval = null
                    console.log("Se ha desconectado del canal de voz. Volviendo a Reconectar...")
                    await new Promise((resolve) => setTimeout(resolve, 5000))
                    reconnect()
                }
            }
        })



    } catch (e) {
        console.log(e)
        return interaction.reply({content: "Ocurrio un error al intentar reproducir el audio", ephemeral: true})
    }

 

        
    }

    async function nextsong() {
        if(ffmpeg) await ffmpeg.kill();
        if(player) await player.stop();

        

        tiempoactual = 0;

        if(optionselect === "RND") {
            const options = ["A1", "AN1", "KPOP1","A2", "PSK1"]
            select = options[Math.floor(Math.random() * options.length)]
        }

        const rnddb = db.collection(`${select}`)

        let [randomSong] = await rnddb.aggregate([{ $sample: {size: 1}}]).toArray()

        title = randomSong.song_name;
        author = randomSong.song_author;
        album = randomSong.song_album;
        imagen = randomSong.song_imagen;
        time = randomSong.song_time;
        url = randomSong.song_url;




        if(!url) {
            return await nextsong()
        }else if(url === oldurl) {
           return await nextsong()
        }else {
            sendEmbed()
            oldurl = url

            url = url.replace('/upload/', '/upload/q_auto:low,br_96k/')

            console.log("Cancion seleccionada:", `${title} - ${author} - ${album} - ${url}`)
            ffmpeg = spawn('ffmpeg', [
                '-re', // Asegura que se procese en tiempo real
                '-i', url, // URL o archivo de entrada
                '-ac', '2', // Fuerza el audio estéreo
                '-b:a', '96k', // Establece una tasa de bits razonable
                '-f', 's16le', // Formato de salida
                '-ar', '48000', // Frecuencia de muestreo compatible con Discord
                '-' // Envía el audio directamente a stdout
            ])
            


          resource2 = createAudioResource(ffmpeg.stdout, {
                inlineVolume: true,
                inputType: StreamType.Raw
            })


        player.play(resource2)
        canciones_tocadas += 1

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



        if(!interval) {
            interval = setInterval(async () => {
                tiempoactual += 7;
        
                if(tiempoactual > time) tiempoactual = time;
        
        
                const embed = new EmbedBuilder()
                .setTitle("Sintonizando / Radio Shuciika")
                .setDescription("🌌 *Bajo el cielo estrellado de Tobeya. La música es nuestra guía*\n\n`Album:` " + album + "\n`Nombre:` " + 
                    title + "\n`Autor:` " + author + "\n"
                )
                .addFields(
                    {name: "Duración", value: `${await formatTime(tiempoactual)} / ${await formatTime(time)}\n${await barra(tiempoactual, time)}`},
                )
                .setColor("Purple")
                .setThumbnail(imagen)
                .setFooter({text: " Canciones reproducidas:" + ` ${canciones_tocadas}` })
                
               message.edit({embeds: [embed]}).catch(e => {
                console.log(`Parece ser que borraron el mensaje, ${e}`)
                interaction.followUp({content: "He detenido la reproduccion de la radio porque se ha borrado el mensaje. Vuelve a usar el comando ＞﹏＜", ephemeral: true})
                player.removeAllListeners()
                clearInterval(interval)
                interval = false
                ffmpeg.kill()
                player.stop()
                player = null
                transaccionCache.delete("ShuciikaMusic")
               })
        
                if(tiempoactual >= time || player.state.status === AudioPlayerStatus.Idle) {
                    player.removeAllListeners()
                        await clearInterval(interval)
                        interval = false;
                        await nextsong()
                        transaccionCache.delete("ShuciikaMusic")          
                }
            }, 7000)
        }

    const obj = {
        player: player,
        message: message,
        ffmpeg: ffmpeg,
        interval: interval,
    }

    transaccionCache.set("ShuciikaMusic", obj)

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

    async function reconnect() {
        try {
            
            if(player) player.stop()
            if(ffmpeg) ffmpeg.kill()
            
                const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                })

        ffmpeg = spawn('ffmpeg', [
            '-ss', tiempoactual.toString(),
            '-re', // Asegura que se procese en tiempo real
            '-i', url, // URL o archivo de entrada
            '-ac', '2', // Fuerza el audio estéreo
            '-b:a', '128k', // Establece una tasa de bits razonable
            '-f', 's16le', // Formato de salida
            '-ar', '48000', // Frecuencia de muestreo compatible con Discord
            '-' // Envía el audio directamente a stdout
        ]);

        resource2 = createAudioResource(ffmpeg.stdout, {
            inlineVolume: true,
            inputType: StreamType.Raw
        })

        resource2.volume.setVolume(0.7);

        player = createAudioPlayer();
        player.play(resource2);
        connection.subscribe(player);

        // Mantener el embed existente
        console.log('Reconectado exitosamente');
        } catch (e) {
            console.log("Error al intentar reconectar", e)
            interaction.channel.send("Ocurrio un error al intentar reconectar")
        }

        sendEmbed()
     
    }


}