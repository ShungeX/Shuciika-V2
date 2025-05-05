const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const { updateMessage } = require("../../modals/Rol/Modal crearFicha");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const dbconfig = db.collection("usuarios_server")
const cloudinary = require("cloudinary").v2

module.exports = {
    customId: "configurar_personaje",
    buttonAuthor: true,

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async function(client, interaction, act, messageId) {

             await interaction.deferReply({ flags: ["Ephemeral"]})

            await interaction.editReply({content: "Por favor, envía tu imagen (archivo/desde tu galeria o URL) en este canal en los próximos dos minutos"})
    
            const filter = msg => msg.author.id === interaction.user.id && 
            ( msg.attachments.size > 0 ||
                /^https?:\/\/.+\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i.test(msg.content) );
    
            const collector = interaction.channel.createMessageCollector({
                filter,
                max: 1,
                time: 120_000
            });
    
            collector.on('collect', async msg => {
                let imageUrl;
                if (msg.attachments.size > 0) {
                  imageUrl = msg.attachments.first().url;
                } else {
                  imageUrl = msg.content.trim();
                }
      

                await this.procesarFoto(interaction, imageUrl)  
      


                try {
                    const message = await interaction.channel.messages.fetch(messageId)

                    await msg.delete()

                    await updateMessage(interaction, message, "character", true);
                } catch (error) {
                    console.log("No se pudo borrar el mensaje del autor (foto)", error)
                }
                await interaction.editReply('✅ Tu foto de perfil ha sido actualizada.');
            });
    
            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                  interaction.editReply('⏰ Se acabó el tiempo. Vuelve a pulsar “Establecer foto” para intentarlo de nuevo.');
                }
              });


    },

    procesarFoto: async function test(interaction, imgURL, ignore) {
      var img = "";

      async function isValidImage() {
          const xprsn = /^https?:\/\/.*\.(?:png|jpe?g|svg|webp|gif)(\?.*)?$/i;

          console.log(imgURL)

          if(!xprsn.test(imgURL)) {
            console.log("test:", xprsn.test(imgURL))
            return false;
          }

          try {
            const response = await fetch(imgURL, { method: 'HEAD'});

            const contentType = response.headers.get('content-type')
            return response.ok && contentType && contentType.startsWith('image/')
            
          } catch (e) {
            console.log(e)
            return false
        }
      }

      if(imgURL) {
          if(await isValidImage() === false) {
            if(!ignore) {
              return interaction.editReply({ content: "Tu link parece no ser valido, verifica que contenga una imagen valida. Si tienes dudas revisa el foro <#1330769969428041822>", ephemeral: true})
            }else {
              return;
            }
           
          }else {
           await uploadCloudinarys()
          }
      }

      async function uploadCloudinarys() {
        
          try {

              const getResponse = await fetch(imgURL)
              if(!getResponse.ok) throw new Error("Error al descargar la imagen")

              const buff = await getResponse.arrayBuffer()
              const resource = Buffer.from(buff)

             const uploadCloudinary = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                  {
                    resource_type: "auto",
                    folder: "Rol/Avatars",
                    public_id: `${interaction.user.id}_AvatarRol`
                  },
                  (error, result) => {
                    if(error) return reject(error)
                      resolve(result)
                  }
                );
                uploadStream.end(resource)
              });

                  console.log("Imagen subida correctamente!\n Link:", uploadCloudinary.secure_url)
                  img = uploadCloudinary.secure_url
              

          } catch (e) {
            console.log(e)
          }
      }


        await dbconfig.updateOne({_id: interaction.user.id}, 
            {$set: {"time.pjFoto": Date.now()}}
          )
       await character.updateOne({_id: interaction.user.id}, 
          {$set: {avatarURL: img}}
        )

    }

}