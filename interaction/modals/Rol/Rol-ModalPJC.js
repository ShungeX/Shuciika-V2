const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")

   

module.exports = {
    customId: "Creator_Pj1",
    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const userfind = await userdb.findOne({_id: interaction.user.id})
        const messageId = userfind.messageTemp
        const channel = await client.channels.fetch(userfind.channelTemp)
        const msg = await channel.messages.fetch(messageId)
        const Si = ["Si", "si", "yes"]
        const No = ["No", "no", "nop"]
        const ejem = ["Puto", "puto", "Pendejo", "Mierda", "Coño",
        "Sexo", "ctm", "Put0", "tamare", "verga", "awa de uwu", "sexooo", "sexoo", "sexo"]
        const xy = ["Hombre", "hombre", "Masculino", "masculino", "Male", "male", " Masculino", "Masculino "]
        const xx = ["Mujer", "mujer", "Femenino", "femenino", "female", "Female"]
        const xxyy = ["No definido", "no definido", "No binario", "no binario"]
        const sexo = ["Hombre", "hombre", "Mujer", "mujer", "No definido", "Masculino", "Femenino", "masculino", "femenino", "No binario", "no binario", "no definido", "Najimi", "najimi", ]
        var mdsop = interaction.fields.getTextInputValue("mds") || false
        const apodo = interaction.fields.getTextInputValue("apodopj") || undefined
        var sexopj = interaction.fields.getTextInputValue("sexopj") 
        const edadpj = interaction.fields.getTextInputValue("edadpj")
        const nombre = interaction.fields.getTextInputValue("nombrepj")

        const fechaRegex = /^([0-2][0-9]|3[01])\/(0[1-9]|1[0-2])$/;

        function validarFecha() {
            return fechaRegex.test(edadpj)
        }

        function formatearFecha() {
            let [dia, mes] = edadpj.split("/")

            dia = dia.padStart(2, '0')
            mes = mes.padStart(2, '0')
            return `${dia}/${mes}`
        }

        function Fechavalida() {
            if(validarFecha()) {
                return formatearFecha()
            }
        }

        async function Badwords() {
            const badwords = await import("bad-words");
            const filter = new badwords.Filter()



            if(filter.isProfane(nombre) || filter.isProfane(apodo)){
                return true
            }else {
                return false
            }
        }



        if(await Badwords()) {
            return interaction.reply({content: "¡Hey! Tu nombre o apodo tiene malas palabras （︶^︶）| [Verifica el nombre de tu personaje]", ephemeral: true})
        }

        if(!sexo.includes(sexopj)) {
            return interaction.reply({ content: "Colocaste un valor incorrecto o no valido en **`Sexo`** (・・ )?.\n `[¿Tienes dudas?, revisa:]` <#920368782126510201>", ephemeral: true})
          }
    
          if(edadpj <= 11 || edadpj >= 19) {
            return interaction.reply({ content: "Colocaste un valor incorrecto en **`Edad`** (・・;).\n `[Solo se permiten edades mayores a 12 y menores a 18]`", ephemeral: true})
          }
    
          if(isNaN(edadpj)) {
            return interaction.reply({ content: "Colocaste un valor incorrecto en **`Edad`** (・・;).\n `[Solo se admiten valores numericos]`", ephemeral: true})
          }


          verifStrings()

    
         await userdb.updateOne({_id: interaction.user.id}, 
            {
                $set: {"buttons.cachepj1": true, statusMd: mdsop},
            },
            {upsert: true}
          )

          await Cachedb.updateOne({_id: interaction.user.id}, {
            $setOnInsert: {created: Date.now(),
            },
            $set: {
                name: nombre,
                apodo: apodo,
                sexo: sexopj,
                edad: edadpj,
                isFinish: false,
                waiting: false,
            }
          }, {upsert: true} )

        
          await sendMessage()

          async function sendMessage() {
            const embed = new EmbedBuilder()
            .setTitle("Guia de creacion de personaje")
            .setDescription("`🔮` "+`*Bienvenido nuevo aprendiz. Estas a punto de crear tu **ficha de personaje.*** \n\n*Para comenzar tu viaje, presiona el boton **Iniciar***.`)
            .addFields([ {
                name: "Obligatorio", value: "Debes enviar minimo los dos primeros formularios para poder enviar tu ficha:  **`Iniciar`** y **`Continuar`**"
            }, {
                name: "Problemas", value: "Si tienes problemas para enviar tus formularios, envia un mensaje al privado de <@!665421882694041630>"
            }, {
                name: "Foto de perfil", value: "Para colocar una foto de perfil a tu ficha, REVISA EL FORO: <#1330769969428041822>."
            }, {
                name: "Dudas", value: "Cualquier duda crea una publicacion en <#1064054917662265404> con tu duda"
            }, {
                name: "Importante", value: "Recuerda revisa las guias de creacion de ficha antes de comenzar: <#1339103959855661096>.\n\n" + 
                '-# Es posible que algunos canales te aparezcan como `#Desconocida`, presiona el canal y funcionara de manera normal (Esto es problema de discord)\n\n' + 
                '-# Puedes cerrar los formularios si necesitas verificar algo, la informacion se guarda automaticamente (por bastante rato)'
            }
        
        ])
            .setColor("Random")
  
                const Row = new ActionRowBuilder()
              const home = new ButtonBuilder()
                .setCustomId(`pjmodal-${interaction.user.id}`)
                .setStyle(ButtonStyle.Primary)
                .setLabel("Iniciar")
                .setEmoji("<:1_:804234149967167498>")
                .setDisabled(true)
            
               const continues = new ButtonBuilder()
                .setCustomId(`pjmodal2-${interaction.user.id}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Continuar")
                .setEmoji("\<:2_:804234147907371008> ")
                .setDisabled(false)
              const mopts =  new ButtonBuilder()
                .setCustomId(`pjmodalextra-${interaction.user.id}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Más opciones")
                .setEmoji("<a:catwhat:1084972549496131644>")
                .setDisabled(false)
               const end = new ButtonBuilder()
                .setCustomId(`pjFinish-${interaction.user.id}`)
                .setStyle(ButtonStyle.Success)
                .setLabel("Terminar")
                .setEmoji("<:TSH_KkannaTomamidinero:798393303170154496>")
                .setDisabled(false)
  
                Row.addComponents(home, continues, mopts, end)
  
                
                await interaction.update({ embeds: [embed], components: [Row]})
        }
        async function verifStrings() {
            if(xy.includes(sexopj)) {
                sexopj = "Masculino"
              }
          
              if(xx.includes(sexopj)) {
                sexopj = "Femenino"
              }
          
              if(xxyy.includes(sexopj)) {
                sexopj = "No definido"
              }
          
              if(Si.includes(mdsop)) {
                mdsop = true
              }else if(No.includes(mdsop)) {
                mdsop = false
              }else {
                return interaction.reply({ content: "No colocaste un valor correcto en la primera pregunta. \n Responde con un **`Si`** o un **`No`**", ephemeral: true })
              }
          }

        
    }

}