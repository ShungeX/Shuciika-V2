const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const dbconfig = db.collection("usuarios_server")
const cloudinary = require("cloudinary").v2


module.exports = {
    customId: "fotomodal",

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const cache = await Cachedb.findOne({_id: interaction.user.id})
        const imgURL = interaction.fields.getTextInputValue("imagenset")
        var img = "";

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

        if(cache) {
        
          await Cachedb.updateOne({_id: interaction.user.id}, {
            $set: {
                avatarURL: img,
            }
          }, {upsert: true} )

        


        }else {
         await character.updateOne({_id: interaction.user.id}, 
            {$set: {avatarURL: img}}
          )
        }


        await dbconfig.updateOne({_id: interaction.user.id}, 
          {$set: {"time.pjFoto": Date.now()}}
        )


        const embed = new EmbedBuilder()
        .setTitle("Foto establecida correctamente")
        .setImage(img)
        .setFooter({ text: "Debes esperar 5 minutos para establecer otra foto a tu personaje"})
        .setTimestamp()

        interaction.reply({embeds: [embed]})
    }

}