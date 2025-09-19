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
        const fechaRegex = /^(\d{1,2})[\/\-](\d{1,2})$/;



        if(!personalidades.includes(interaction.fields.getTextInputValue("personalpj"))) {
          return interaction.reply({ content: "Recuerda que solo se admiten las personalidades del canal <#926688416433860638>.\ **[Tambien recuerda que todo es en Mayus]**", ephemeral: true})
        }

        function validarYformatearFecha(input) {
            const diasPorMes = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // indice 0,  valor (0) dummy

            if (!fechaRegex.test(input)) {
                return { error: "Formato inválido. Usa DD/MM ＞﹏＜" };
            }

            let [_, diaStr, mesStr] = fechaRegex.exec(input);
            let dia = parseInt(diaStr);
            let mes = parseInt(mesStr);

            let posiblesFechas = [
                { dia: dia, mes: mes }, // Interpretación original
                { dia: mes, mes: dia }  // Interpretación intercambiada
            ];

            let fechaValida = posiblesFechas.find(f => 
                f.mes >= 1 && f.mes <= 12 && f.dia >= 1 && f.dia <= 31
              );

            if (!fechaValida) {
                return { error: "Fecha inválida. ¿Intentaste día/mes?" };
            }

            dia = fechaValida.dia;
            mes = fechaValida.mes;
        

            const maxDias = diasPorMes[mes];
            if (dia > maxDias) {
                const mensajeFeb = mes === 2 ? "\n¡Recuerda! Febrero tiene máximo 28 días (29 en año bisiesto) ＞﹏＜" : "";
                return { error: `Día inválido para ${nombreMes(mes)} (1-${maxDias})${mensajeFeb}` };
              }
        
            return `${diaStr.padStart(2, '0')}/${mesStr.padStart(2, '0')}`
        }

        function nombreMes(mes) {
            const meses = [
                "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
            ];
            return meses[mes - 1];
        }


        const validarFecha = validarYformatearFecha(cumplepj)

    
        if(validarFecha?.error) {
            return interaction.reply({ content: validarFecha.error, flags: "Ephemeral"})
        }else {
            cumplepj = validarFecha
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