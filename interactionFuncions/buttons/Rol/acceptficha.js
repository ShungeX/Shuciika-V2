const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, PermissionsBitField} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characterPj = db2.collection("Personajes")
const { DateTime } = require('luxon')
const timeMXF = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
const timeMXS = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATE_SHORT)



module.exports = {
    customId: "vfpj_true",
    buttonAuthor: true,

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */
    ejecutar: async(client, interaction) => {
    const author = await userdb.findOne({_id: interaction.user.id})
    const cachepj = await Cachedb.findOne({_id: author.fichaverif})
    const ch = client.channels.cache.get('1137946713827577927')
    const apodo = cachepj.apodo ?? "Sin apodo"
    const user = interaction.guild.members.resolve(cachepj._id)
    const config = await userdb.findOne({_id: user.id})
    const comentario = cachepj.comentario
    const edadesRol = {
        '12': "737711080763162674",
        '13': "717422342875250789",
        '14': "717530248400338944",
        '15': "717530295670276126",
        '16': "717530295670276126",
        '17': "717530295670276126",
        '18': "717530295670276126"
}
    const edad = edadesRol[cachepj.edad]
    var uniqueID = ""
    

    const msg = await interaction.reply({content: "Espera...  (＿ ＿*) Z z z", fetchReply: true})

    const id = await generateId()

    await createCharacter()


    async function generateId() {
        while(true) {
            uniqueID = Math.floor(Math.random() * 99) + 1;
            const verify = await characterPj.findOne({ID: uniqueID},
                {projection: {"Objetos": {$elemMatch: {ID: uniqueID}}}}
            )
            
            if(!verify) break
        }
        return uniqueID
    }


    async function createCharacter() {
        try {
            await characterPj.insertOne({
                _id: user.id,
                ID: id,
                Nombre: cachepj.name,
                Apodo: apodo,
                Sexo: cachepj.sexo,
                Reputacion: 0,
                Edad: cachepj.edad,
                Cumpleaños: cachepj.cumpleaños,
                CiudadOrg: cachepj.ciudadOrg,
                Personalidad: cachepj.personalidad,
                Especialidad: cachepj.especialidad,
                Descripcion: null,
                Historia: cachepj.historia ? historia: "In rol",
                Familia: cachepj.familia || "No especificado",
                Compañero: "Sin compañero",
                Team: "Sin team",
                Mascotas: "Sin mascota",
                FechaF: timeMXF,
                FechaS: timeMXS, 
                avatarURL: cachepj.avatarURL,
                Rol: "Alumno / a",
                Dinero: 0,
                Stats: {},
                DesmpAcademico: {},
                Inventario: []
            })

            edadAsignada()

            const pjuser = await characterPj.findOne({_id: user.id})


            const embed = new EmbedBuilder()
            .setAuthor({name: "Nuevo alumno", iconURL: user.displayAvatarURL({dynamic: true})})
            .setTitle(`${pjuser.Nombre}`)
            .setDescription(pjuser.Historia)
            .addFields(
              {name: "Informacion 1/2", value:"`🎎` **Sexo: **" + pjuser.Sexo + "\n`🍭` **Edad: **" + pjuser.Edad + "\n`🎂` **Cumple: **" + pjuser.Cumpleaños + "\n`🛫` **C/Org: **" + pjuser.CiudadOrg, inline: true},
              {name: "Informacion 2/2", value: "`👑` **Familia: **" + pjuser.Familia +"\n`🎭` **Personalidad: **" + pjuser.Personalidad + "\n `🏈` **Especialidad: **" + pjuser.Especialidad, inline: true},
              {name: "Extra", value: "`🔮` **Rol: **" + pjuser.Rol + "\n`💳` **ID: **" + pjuser.ID + "\n `🎉` **Fecha de creacion: **" + pjuser.FechaS, inline: false}
            )
            .setThumbnail(`${pjuser.avatarURL}`)
            .setColor(`Random`)
      
            const verificado = new EmbedBuilder()
            .setTitle("Tu ficha ha sido verificada. ¡Felicidades! (⁀ᗢ⁀)")
            .setThumbnail(interaction.user.displayAvatarURL({dynamic: true}))
            .setDescription(`**${interaction.user}**` + " Fue quien verifico esta ficha♡\n\n __¿No sabes por donde empezar?. Te dare una mini guia para ayudarte.__")
            .addFields( 
              {name: "Comandos", value: "Ahora puedes usar los comandos del rol. Estos comandos van marcados por una **`r`**. Puedes empezar por usar `/r-configuracion_personaje`", inline: true},
              {name: "Canales", value: "Una vez tengas todo puedes empezar hablando en los canales de Rol, cualquier duda pregunta a un ayudande o moderador", inline: true},
              {name: "Reglas", value: "Te invito a que leas las normas del rol <#716865470648680448> antes de empezar a rolear", inline: true},
              {name: "Tambien...", value: "Se te han asignado roles especiales que te identifican como un verdadero estudiante de este instituto.", inline: false},
            )
            .setColor("Green")
            .setFooter({ text: `¡Gracias y bienvenido/a a este instituto ${user.displayName}! (￣▽￣)/`})

            await ch.send({content: "`Personaje de: `" + `${user}` + "\n `Verificado por:` " + `${interaction.user}`, embeds: [embed]})

            if(config.statusMd) {
                await user.send({embeds: [verificado]})

                if(comentario) {
                    await user.send({content: `${interaction.user} Ha dejado un comentario sobre tu ficha.ヾ(•ω•)o\n` + "`" + `${comentario}` + "`"})
                }
            }else if(!config.statusMd) {
               await createChannel(verificado)
            }

            await Cachedb.deleteOne({_id: user.id})

            msg.edit({content: "`Se ha verificado correctamente [✅]`"})



        } catch (e) {
            console.log(e)
            interaction.deleteReply()
            return interaction.followUp({content: "*Ocurrio un error al insertar los datos del usuario ❌*" + '```' + e + '``` \n-# Envia captura de este error a <@!665421882694041630>', ephemeral: true})
        }
    }


    async function edadAsignada() {
        if(!edad) {
            console.log("No hay una rol asignado para esa edad")
            return;
        }

        try {
            const rol = interaction.guild.roles.cache.get(edad)
            if(!rol) {
                console.error("El rol con la id" + edad + "no existe en el servidor")
                return;
            }

            await user.roles.add(rol)
            await user.roles.add("722611675894906902").catch(e => console.log("error:", e))
            await user.roles.remove("736796685069451305").catch(e => console.log("El usuario no tiene el rol [737058095599058995]"))
        } catch (e) {
            console.log(e)
        }
    }

    async function createChannel(embed2) {
        await interaction.guild.channels.create({
            name: `${user.nickname}_TempChannel`,
            type: 0,
            permissionOverwrites: [
              {
                id: user.id,
                allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ViewChannel],
              },
              {
                id: interaction.guildId,
                deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ViewChannel],
              }
            ],
          }).then(async(channel) => {
            await userdb.updateOne({_id: user.id}, {
              $set: {channelTID: channel.id, channelName: channel.name}
            }) 
            await channel.send({embeds: [embed2]})
            if(comentario) {
              await channel.send({content: `${interaction.user} Ha dejado un comentario sobre tu ficha.ヾ(•ω•)o\n` + "`" + `${comentario}` + "`"})
             }
    
          })
    }
}
}







