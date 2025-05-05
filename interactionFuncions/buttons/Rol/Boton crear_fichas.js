const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, TextInputBuilder, TextInputStyle} = require("discord.js")
const clientdb = require("../../../Server");
const { updateMessage } = require("../../modals/Rol/Modal crearFicha");
const { formatearTextoLim } = require("../../../utils/textStrings")
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const dataCache = new Map()
const util = require(`util`);
const sleep = util.promisify(setTimeout)

module.exports = {
    customId: "crear_ficha",
    buttonAuthor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction, extras) => {

        const userfind = await userdb.findOne({_id: interaction.user.id})
        const messageId = userfind?.messageTemp
        const channel = await client.channels.fetch(userfind.channelTemp)
        const message = await channel.messages.fetch(messageId)

        if(extras === "opinion") {
            const opinion = new TextInputBuilder()
            .setCustomId("opinionpj")
            .setLabel("¿Te gustaria dejar tu opinion?")
            .setPlaceholder("Opinion sobre el metodo para crear personajes.")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setMinLength(20)
            .setRequired(false)

            const modal = new ModalBuilder()
            .setTitle("Creacion de ficha")
            .setCustomId("actualizarPerfil-opinion")
            const row = new ActionRowBuilder()

            row.addComponents(opinion)


            modal.addComponents(row)
           return await interaction.showModal(modal)
        }

        await interaction.deferReply({ flags: ["Ephemeral"]})

        if(extras === "enviar_true") {
            const characterCache = await Cachedb.findOne({_id: interaction.user.id})

            if(!characterCache) return interaction.editReply({content: "Mmm, es raro. no deberia aparecer este mensaje a menos que intentaras buguear el bot =.=\n-# Ficha ya enviada o inexistente"})
            message.delete()
            const channelfichas = await client.channels.fetch("803723665107451904")
            let historia = characterCache?.historia

            if(historia) {
                historia = formatearTextoLim(characterCache?.historia, 1000)
            }

            const familia = characterCache?.familia ? characterCache.familia : "Desconocida"


            channelfichas.send({content: 
                "**✧ Nombre.** " + characterCache.nombre + "\n**✧ Edad.** " + characterCache.edad + "\n**✧ Fecha de cumpleaños.** " + characterCache.cumpleaños 
               + "\n**✧ Genero.** " + characterCache.sexo + "\n**✧ Personalidad.** " 
               + characterCache.personalidad + "\n**✧ Ciudad de origen.** " + characterCache.ciudadOrg + "\n**✧ Familia.** " + familia + "\n**✧ Aptitud.** " 
               + characterCache.especialidad + `\n**✧ Historia:** ` + `${historia || "In rol"}` + "\n**`Ficha y personaje de:`** " + `${interaction.user}`, 
               files: [characterCache.avatarURL]
           })
           await Cachedb.updateOne({_id: interaction.user.id}, 
               {$set: {waiting: true}}
           )

           return await interaction.editReply({content: "Muchas gracias por querer formar parte de este instituto. ♡( ◡‿◡ )\n **Espera hasta que un miembro del staff verifique tu ficha**"})
        }

        if(extras === "foto") {
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

                await Cachedb.updateOne({_id: interaction.user.id}, {
                    $setOnInsert: {created: Date.now(),
                  },
                    $set: {
                        avatarURL: imageUrl,
                    }
                  }, {upsert: true})

      
                const info = {
                    action: "avatarURL",
                    option: imageUrl
                  }
      
                await updateMessage(interaction, message, null, true, info);
    
                await interaction.editReply('✅ Tu foto de perfil ha sido actualizada.');
            });
    
            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                  interaction.editReply('⏰ Se acabó el tiempo. Vuelve a pulsar “Establecer foto” para intentarlo de nuevo.');
                }
              });
        }else if(extras === "guia") {
            const tutorialV2 = [
                {
                    "type": 17,
                    "accent_color": 558079,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 10,
                            "content": "# Guía basica para crear tu ficha"
                        },
                        {
                            "type": 10,
                            "content": "*Bienvenido nuevo aprendiz. Estas a punto de crear tu **ficha de personaje.***"
                        },
                        {
                            "type": 10,
                            "content": "-# Recuerda revisa las guias de creacion de ficha antes de comenzar: [Creación de personaje](https://canary.discord.com/channels/716342375303217285/1339103959855661096), [¿Cómo agregar una foto de perfil?](https://canary.discord.com/channels/716342375303217285/1330769969428041822)"
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 2
                        },
                        {
                            "type": 10,
                            "content": "`✨` **¿Cómo empezar?**\n\n- *Haz clic en el menú desplegable que dice `Personaliza tu personaje...`*\n- *Selecciona el campo que deseas editar (por ejemplo, \"nombre\", \"edad\", \"personalidad\", etc.).*\n- *Se abrirá un modal (una pequeña ventana) donde podrás escribir la información correspondiente.*\n- *Repite este proceso hasta completar tu ficha.*\n\n-# Tranquilo/a, la información se guarda automaticamente y se actualiza cada que cambias algo de tu ficha"
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 2
                        },
                        {
                            "type": 9,
                            "accessory": {
                                "type": 2,
                                "style": 1,
                                "label": "Enviar ficha",
                                "emoji": null,
                                "disabled": true,
                                "custom_id": "a4b19203613e42ccdd6f6d0eb59c6164"
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "`✅` **¿Cuándo puedo `Enviar ficha`?**\n\nEl botón `Enviar ficha` se desbloqueará automáticamente cuando hayas completado los siguientes campos mínimos:\n\n-# - Nombre\n-# - Edad\n-# - Sexo\n-# - Cumpleaños\n-# - Ciudad de origen\n-# - Personalidad"
                                }
                            ]
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": "`⚠️` ¿Tienes problemas para agregar contenido a tu ficha?\n\n-# Realiza un post en <#1319812744035438642> detallando tu problema o contacta al MD de <@!665421882694041630>"
                        }
                    ]
                }
            ]

            interaction.editReply({ components: tutorialV2, flags: ["IsComponentsV2"]})
        }else if(extras === "enviar_Ficha") {
            const characterCache = await Cachedb.findOne({_id: interaction.user.id})

            if(!characterCache?.avatarURL) {
                interaction.editReply({content: "-# Parece que tu personaje aun no tiene una **Foto de perfil**, es opcional... Pero te recomendamos agregar una ＞﹏＜\n-# Puedes asignar una presionando el boton `Establecer foto`**", ephemeral: true})
                await sleep(4000)
            }



            const Row = new ActionRowBuilder()
            const accept = new ButtonBuilder()
            .setCustomId(`crear_ficha-${interaction.user.id}-enviar_true`)
            .setStyle(ButtonStyle.Success)
            .setLabel("Enviar")
            .setEmoji("✅")
    
            Row.addComponents(accept)

            const embed = new EmbedBuilder()
            .setDescription("# ¿Estás seguro de que deseas enviar tu ficha?\n\n-# La información no agregada aparecerá como `Desconocido` o simplemente no se mostrará en tu perfil."
                + "\n-# - Podrás modificar algunos datos de tu personaje más adelante.\n-# - Si deseas cancelar esta acción, simplemente descarta este mensaje." +
                "\n\n-# **¡Una vez enviada tu ficha no podras ajustar nada de ella hasta que sea verificada por un administrador!**"
            )
            .setColor("Red")

            await interaction.editReply({embeds: [embed], components: [Row]})
        }

    }
}