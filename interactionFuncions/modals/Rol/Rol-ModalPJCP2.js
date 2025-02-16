const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")

   

module.exports = {
    customId: "Creator_Pj2",
    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const userfind = await userdb.findOne({_id: interaction.user.id})
        const userbuttons = userfind.buttons
        const messageId = userfind.messageTemp
        const channel = await client.channels.fetch(userfind.channelTemp)
        const msg = await channel.messages.fetch(messageId)
        const family = interaction.fields.getTextInputValue("familiapj") || "Desconocido"
        var cumplepj = interaction.fields.getTextInputValue("cumplepj");
        const ciudadOrg = interaction.fields.getTextInputValue("ciudadpj") || "Desconocido"
        const especialidad = interaction.fields.getTextInputValue("especialidadpj") || "No especificado"
        const personalidad = interaction.fields.getTextInputValue("personalpj") || "Desconocido"
        const personalidades = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", 
      "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"]
        const fechaRegex =  /^(\d{1,2})[\/\-](\d{1,2})$/;




        if(!personalidades.includes(interaction.fields.getTextInputValue("personalpj"))) {
          return interaction.reply({ content: "Recuerda que solo se admiten las personalidades del canal <#926688416433860638>.\ **[Tambien recuerda que todo es en Mayus]**", ephemeral: true})
        }

        

        function validarFecha() {
            console.log(fechaRegex.test(cumplepj))
            return fechaRegex.test(cumplepj)
        }

        function formatearFecha() {
            let [dia, mes] = cumplepj.split("/")

            dia = dia.padStart(2, '0')
            mes = mes.padStart(2, '0')
            cumplepj = `${dia}/${mes}`
            return `${dia}/${mes}`
        }

        function Fechavalida() {
            if(validarFecha()) {
                return formatearFecha()
            }
        }


    
        if(!await Fechavalida()) {
            return interaction.reply({ content: "Algo anda mal en el cumpleaños. \n `[Recuerda seguir el orden xx/xx (Día / Mes)]`", ephemeral: true})
        }

         

    
         await userdb.updateOne({_id: interaction.user.id}, 
            {
                $set: {"buttons.cachepj1": userfind.buttons.cachepj1, "buttons.cachepj2": true},
            },
            {upsert: true}
          )

          await Cachedb.updateOne({_id: interaction.user.id}, {
            $setOnInsert: {created: Date.now(),
            },
            $set: {
                cumpleaños: cumplepj,
                ciudadOrg: ciudadOrg,
                personalidad: personalidad,
                familia: family,
                especialidad: especialidad,
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
                name: "Importante", value: "Recuerda revisa las guias de creacion de ficha antes de comenzar <#1339103959855661096>."
            }
        
        ])
            .setColor("Random")
  
                const Row = new ActionRowBuilder()
              const home = new ButtonBuilder()
                .setCustomId(`pjmodal1-${interaction.user.id}`)
                .setStyle(ButtonStyle.Primary)
                .setLabel("Iniciar")
                .setEmoji("<:1_:804234149967167498>")
                .setDisabled(userbuttons.cachepj1)
            
               const continues = new ButtonBuilder()
                .setCustomId(`pjmodal2-${interaction.user.id}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Continuar")
                .setEmoji("\<:2_:804234147907371008> ")
                .setDisabled(true)
              const mopts =  new ButtonBuilder()
                .setCustomId(`pjmodalextra-${interaction.user.id}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Más opciones")
                .setEmoji("<a:catwhat:1084972549496131644>")
                .setDisabled(userbuttons.cachepj3)
               const end = new ButtonBuilder()
                .setCustomId(`pjFinish-${interaction.user.id}`)
                .setStyle(ButtonStyle.Success)
                .setLabel("Terminar")
                .setEmoji("<:TSH_KkannaTomamidinero:798393303170154496>")
                .setDisabled(false)
  
                Row.addComponents(home, continues, mopts, end)
  
                
                await interaction.update({ embeds: [embed], components: [Row]})
        }

        
    }

}