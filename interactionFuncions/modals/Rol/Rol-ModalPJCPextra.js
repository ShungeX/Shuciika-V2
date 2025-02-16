const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client} = require("discord.js")
const clientdb = require("../../../Server");
const { UploadStream } = require("cloudinary");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const cloudinary = require("cloudinary").v2


   

module.exports = {
    customId: "Creator_Pjextra",
    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const userfind = await userdb.findOne({_id: interaction.user.id})
        const userbuttons = userfind.buttons
        const channelop = client.channels.cache.get("1009685257215287346")
        const imgURL = interaction.fields.getTextInputValue("imagenpj")
        var history = interaction.fields.getTextInputValue("historiapj")
        var opinionpj = interaction.fields.getTextInputValue("opinionpj")
        var img = ""

    

        async function isValidImage() {
          const xprsn = /^https?:\/\/.*\.(?:png|jpe?g|svg|webp|gif)(\?.*)?$/i;

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
            return interaction.reply({ content: "Tu link parece no ser valido, verifica que contenga una imagen valida. Si tienes dudas revisa el foro <#1065148731164475413>", ephemeral: true})
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



  

    
         await userdb.updateOne({_id: interaction.user.id}, 
            {
                $set: {"buttons.cachepj3": true},
            },
            {upsert: true}
          )

          await Cachedb.updateOne({_id: interaction.user.id}, {
            $setOnInsert: {created: Date.now(),
            },
            $set: {
                historia: history,
                avatarURL: img || "https://media.discordapp.net/attachments/665423320765693982/905282026133938206/unknown.png",
            }
          }, {upsert: true} )

        
          await sendMessage()

          async function sendMessage() {
            const embed = new EmbedBuilder()
            .setTitle("Guia rapida")
            .setDescription("`🔮` "+`*Bienvenido nuevo aprendiz.* Estas a punto de crear tu **ficha de personaje.** \n\n Para comenzar tu viaje, presiona el botón <:uno:804234149967167498> *Inicio*. Sigue las instrucciones y apareceran otros botones`)
            .addFields([ {
                name: "Boton actualizar", value: "Si después de enviar ambos formularios y la opcion **terminar** aun no se desbloquea, presiona el ultimo boton para actualizar el mensaje"
            }, {
                name: "Problemas", value: "Si llegas a tener algun problema al enviar tus formularios, envia un mensaje a <@!665421882694041630>"
            }, {
                name: "Foto de perfil", value: "Antes de colocar una foto de perfil, revisa el foro: <#1330769969428041822>."
            }, {
                name: "Dudas", value: "Cualquier otra duda puedes crear una publicacion en <#1064054917662265404>"
            }, {
                name: "Importante", value: "Recuerda revisa las guias de creacion de ficha antes de comenzar."
            }
        
        ])
            .setColor("Random")
  
                const Row = new ActionRowBuilder()
              const home = new ButtonBuilder()
                .setCustomId(`b1pj-${interaction.user.id}`)
                .setStyle(ButtonStyle.Primary)
                .setLabel("Iniciar")
                .setEmoji("<:1_:804234149967167498>")
                .setDisabled(true)
            
               const continues = new ButtonBuilder()
                .setCustomId(`pjmodal2-${interaction.user.id}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Continuar")
                .setEmoji("\<:2_:804234147907371008> ")
                .setDisabled(userbuttons.cachepj2)
              const mopts =  new ButtonBuilder()
                .setCustomId(`pjmodalextra-${interaction.user.id}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Más opciones")
                .setEmoji("<a:catwhat:1084972549496131644>")
                .setDisabled(true)
               const end = new ButtonBuilder()
                .setCustomId(`pjFinish-${interaction.user.id}`)
                .setStyle(ButtonStyle.Success)
                .setLabel("Terminar")
                .setEmoji("<:TSH_KkannaTomamidinero:798393303170154496>")
                .setDisabled(false)
  
                Row.addComponents(home, continues, mopts, end)

                await interaction.update({ embeds: [embed], components: [Row]})
  
                
                if(opinionpj) {
                  const embedopinion = new EmbedBuilder()
                  .setTitle("Opinion del comando Crear Ficha")
                  .setDescription(`${opinionpj}`)
                  .addFields({name: "Usuario:", value: `${interaction.user.username}`, inline: true})
                
                  await channelop.send({embeds: [embedopinion]})
                 }

        }

        
    }

}