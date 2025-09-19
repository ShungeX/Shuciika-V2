const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, PermissionsBitField } = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const UIDs = db.collection("contadores")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characterPj = db2.collection("Personajes")
const { DateTime } = require('luxon')
const timeMXF = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
const timeMXS = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATE_SHORT)
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4 } = require('uuid');
const { procesarFoto } = require("./ActualizarFoto");
const staff = require("../../../staff.json");
const { Mdbloqued, sendMD, errorMessage } = require("../../../functions/verifMD");
const { ObjectId } = require("mongodb");


module.exports = {
    customId: "vfpj_true",
    buttonAuthor: true,

    /**
    * @param {Client} client 
    * @param {ChatInputCommandInteraction} interaction
    */
    ejecutar: async (client, interaction, cache) => {
        const informacion = transaccionCache.get(cache)


        if (!informacion) {
            return interaction.reply({ content: "La interacción ya no es valida, intenta verificar de nuevo al usuario", flags: ["Ephemeral"] })
        }

        const cachepj = await Cachedb.findOne({ _id: informacion.fichaverif })
        const ch = client.channels.cache.get('1396662146783514715')
        const user = interaction.guild.members.resolve(cachepj._id)
        const config = await userdb.findOne({ _id: user.id })
        const comentario = informacion.comentario
        const edadesRol = {
            '13': "717422342875250789",
            '14': "717530248400338944",
            '15': "717530295670276126",
            '16': "717530295670276126",
            '17': "717530295670276126",
            '18': "717530295670276126",
            '19': "717530295670276126",
            '20': "717530295670276126",
            '21': "717530295670276126",
            '22': "717530295670276126",
        }

        const edad = edadesRol[cachepj.edad]

        const msg = (await interaction.reply({ content: "Espera...  (＿ ＿*) Z z z", withResponse: true })).resource.message

        const id = await generateId()

        await createCharacter()


        async function generateId() {
            const uniqueID = await UIDs.findOneAndUpdate(
                { _id: 'personajes_uid' },
                { $inc: { seq: 1 } },
                { returnDocument: 'after' }
            );
            return uniqueID.seq
        }


        async function createCharacter() {

            if (isNaN(id)) {
                return msg.edit({ content: `${id}` })
            }

            try {

                await characterPj.insertOne({
                    _id: id,
                    ownerID: user.id,
                    perfil: {
                        Nombre: cachepj.nombre,
                        Apodo: defaultIfEmpty(cachepj?.apodo, ""),
                        Sexo: cachepj.sexo,
                        Edad: cachepj.edad,
                        Cumpleaños: cachepj.cumpleaños,
                        CiudadOrg: cachepj.ciudadOrg,
                        Personalidad: cachepj.personalidad,
                        Peso: cachepj.peso,
                        Estatura: cachepj.estatura,
                        Especialidad: defaultIfEmpty(cachepj?.especialidad, "Sin especialidades"),
                        Descripcion: null,
                        Historia: defaultIfEmpty(cachepj?.historia, "In rol"),
                        Familia: defaultIfEmpty(cachepj?.familia, "No especificado"),
                        avatarURL: cachepj?.avatarURL,
                        aspiracion: cachepj?.aspiracion
                    },
                    estado: {
                        Reputacion: 0,
                        Rol: "Alumno / a",
                        DesmpAcademico: {},
                        progresoAcumulativo: {
                            lumens: 0,
                            xp: 0,
                        }
                    },
                    economia: {
                        Lumens: 0,
                        Inventario: [],
                        MisionesDiarias: []
                    },
                    social: {
                        Compañero: "Sin compañero",
                        Team: "Sin team",
                        Mascotas: "Sin mascota",
                        Medallas: []
                    },
                    metadata: {
                        FechaF: timeMXF,
                        FechaS: timeMXS,
                        fechaCreacion: Math.floor(Date.now() / 1000),
                    }
                })

                const usuariodb = await userdb.findOne({ _id: user.id })

                procesarFoto(interaction, cachepj.avatarURL, true, id)

                edadAsignada()

                const pjuser = await characterPj.findOne({ _id: id })
                const perfil = pjuser.perfil


                const perfilV3 = [
                    {
                        "type": 17,
                        "accent_color": null,
                        "spoiler": false,
                        "components": [
                            {
                                "type": 9,
                                "accessory": {
                                    "type": 11,
                                    "media": {
                                        "url": perfil.avatarURL
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "# Ficha de inscrito"
                                    },
                                    {
                                        "type": 10,
                                        "content": `-# **Nombre:** ${perfil.Nombre}` + `\n-# **Apodo:** ${perfil?.Apodo ? `${perfil.Apodo}` : "Apodo no establecido"}`
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
                                "content": "**Información personal:**" + "\n\n-# `🎎` *Sexo:* " + perfil.Sexo +
                                    "\n-# `🍭` *Edad:* " + perfil.Edad + "\n-# `🎂` *Cumpleaños:* " + perfil.Cumpleaños +
                                    "\n-# `🎭` *Personalidad:* " + perfil.Personalidad + "\n-# `🛫` *Ciudad de origen:* " + perfil.CiudadOrg +
                                    "\n-# `👑` *Linaje familiar:* " + (perfil.Familia) +
                                    "\n-# `🏈` *Especialidad:* " + perfil.Especialidad +
                                    "\n\n-# `🔮` *Rol:* " + pjuser.estado.Rol + "\n-# `💳` *ID:* " + pjuser.ID +
                                    "\n-# `🎉` *Fecha de creacion:* " + `<t:${pjuser.metadata.fechaCreacion}:R>`


                            },
                            {
                                "type": 14,
                                "divider": true,
                                "spacing": 1
                            },
                            {
                                "type": 10,
                                "content": `-# Verificado por: ${interaction.user}` + `\n-# Personaje de: ${user}`
                            }
                        ]
                    }
                ]

                let verificado;
                if (usuariodb?.nix?.personajeActivo) {
                    await userdb.updateOne({ _id: user.id }, {
                        $inc: {
                            "nix.slotsPersonajes.usados": 1,
                        },
                        $push: {
                            "nix.personajes": { "id": id, nombre: cachepj.nombre }
                        }
                    })


                    verificado = [
                        {
                            "type": 17,
                            "accent_color": null,
                            "spoiler": false,
                            "components": [
                                {
                                    "type": 9,
                                    "accessory": {
                                        "type": 11,
                                        "media": {
                                            "url": "https://i.pinimg.com/736x/9e/e7/d3/9ee7d3a8aba958ea3cee267f469bc9df.jpg"
                                        },
                                        "description": null,
                                        "spoiler": false
                                    },
                                    "components": [
                                        {
                                            "type": 10,
                                            "content": "# Ficha académica verificada"
                                        },
                                        {
                                            "type": 10,
                                            "content": `**Saludos de nuevo, Conciencia Viajera.**` + "\n\nTras una cuidadosa revisión de tu postulación, nos complace informarte que tu registro ha sido **validado y aceptado** por el instituto.\n\nUna nueva chispa se enciende dentro del mundo **Nix**. Que esta nueva identidad te permita explorar otras facetas del conocimiento y la magia \n\n " + `**¡Bienvenido/a a tu nuevo hogar ${perfil.Nombre}!**`
                                        }
                                    ]
                                },
                                {
                                    "type": 14,
                                    "divider": true,
                                    "spacing": 2
                                },
                                {
                                    "type": 10,
                                    "content": "**✧ Perfil nuevo, mismo legado**\n- -# Tu conexión con el instituto se ha expandido. Ahora puedes alternar entre tus perfiles para interactuar en el mundo. Usa `/rol configuracion` para más detalles"
                                },
                                {
                                    "type": 10,
                                    "content": "**✧ Un Recordatorio Amistoso**\n- -# Aunque explores nuevos caminos, las normas del instituto y la senda de la Resonancia se mantienen inalterables. Te instamos a mantener el honor y la disciplina que ya has demostrado."
                                },
                                {
                                    "type": 1,
                                    "components": [
                                        {
                                            "type": 2,
                                            "style": 5,
                                            "label": "Normas del rol",
                                            "emoji": null,
                                            "disabled": false,
                                            "url": "https://discord.com/channels/716342375303217285/716865470648680448"
                                        },
                                        {
                                            "type": 2,
                                            "style": 2,
                                            "label": "Canales principales",
                                            "emoji": null,
                                            "disabled": false,
                                            "custom_id": "informacionRol-null-chprincipales"
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
                                    "content": `-# Ficha revisada y verificada por ${staff[interaction.user.id] ? staff[interaction.user.id] : "Asistente academico "} ${interaction.user} | Instituto mágico Shuciika`
                                }
                            ]
                        }
                    ]
                } else {
                    await userdb.updateOne({ _id: user.id }, {
                        $set: {
                            nix: {
                                personajeActivo: id,
                                slotsPersonajes: {
                                    total: 1,
                                    usados: 1,
                                },
                                personajes: [
                                    { "id": id, nombre: cachepj.nombre }
                                ],
                                fechaRegistro: Math.floor(Date.now() / 1000),
                            }
                        }
                    })
                    verificado = [
                        {
                            "type": 17,
                            "accent_color": null,
                            "spoiler": false,
                            "components": [
                                {
                                    "type": 9,
                                    "accessory": {
                                        "type": 11,
                                        "media": {
                                            "url": "https://i.pinimg.com/736x/9e/e7/d3/9ee7d3a8aba958ea3cee267f469bc9df.jpg"
                                        },
                                        "description": null,
                                        "spoiler": false
                                    },
                                    "components": [
                                        {
                                            "type": 10,
                                            "content": "# Ficha académica verificada"
                                        },
                                        {
                                            "type": 10,
                                            "content": `*Estimado/a ${perfil.Nombre}*` + "\n\nTras una cuidadosa revisión de tu postulación, nos complace informarte que tu registro ha sido **validado y aceptado** por el instituto.\n\nUn gran viaje de conocimiento y poder te espera entre nuestros muros. A partir de este momento, eres oficialmente aprendiz de las artes arcanas. Que tus estudios sean fructíferos y tu lealtad a los principios que nos rigen sea tan brillante como tu propia magia. \n\n**¡Bienvenido/a a tu nuevo hogar!**"
                                        }
                                    ]
                                },
                                {
                                    "type": 14,
                                    "divider": true,
                                    "spacing": 2
                                },
                                {
                                    "type": 10,
                                    "content": "**✧ Tus Herramientas Mágicas**\n- -# Tu conexión con el instituto ha sido activada. Ahora puedes usar los comandos de rol `(/rol + comando)` para interactuar con el mundo. Comienza por consultar tu perfil con `/rol perfil` en el canal de comandos."
                                },
                                {
                                    "type": 10,
                                    "content": "**✧ Tu Identidad Institucional**\n- -# Se te han asignado roles que reflejan datos de tu personaje. con tu nueva credencial, ahora podrás acceder a más lugares dentro del rol. Llévalos con orgullo"
                                },
                                {
                                    "type": 10,
                                    "content": "**✧ Siguientes Pasos**\n- -# Para asegurar una transición fluida y honorable a tu nueva vida como estudiante, te instamos a familiarizarte con los siguientes recursos:"
                                },
                                {
                                    "type": 1,
                                    "components": [
                                        {
                                            "type": 2,
                                            "style": 5,
                                            "label": "Normas del rol",
                                            "emoji": null,
                                            "disabled": false,
                                            "url": "https://discord.com/channels/716342375303217285/716865470648680448"
                                        },
                                        {
                                            "type": 2,
                                            "style": 2,
                                            "label": "Canales principales",
                                            "emoji": null,
                                            "disabled": false,
                                            "custom_id": "informacionRol-null-chprincipales"
                                        },
                                        {
                                            "type": 2,
                                            "style": 2,
                                            "label": "Primeros pasos",
                                            "emoji": null,
                                            "disabled": false,
                                            "custom_id": "informacionRol-null-inicioRol"
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
                                    "content": `-# Ficha revisada y verificada por ${staff[interaction.user.id] ? staff[interaction.user.id] : "Asistente academico "} ${interaction.user} | Instituto mágico Shuciika`
                                }
                            ]
                        }
                    ]
                }





                await ch.send({ components: perfilV3, flags: ["IsComponentsV2"] })
                await sendMD(user, { components: verificado, flags: ["IsComponentsV2"] })
                if (comentario) {
                    await sendMD(user, { content: `${interaction.user} Ha dejado un comentario sobre tu ficha.ヾ(•ω•)o\n` + "`" + `${comentario}` + "`" })
                }

                await Cachedb.deleteOne({ _id: user.id })
                try {
                    const message = await interaction.channel.messages.fetch(informacion.message)
                    await message.delete

                    await msg.edit({ content: "`Se ha verificado correctamente [✅]`" })
                } catch (error) {
                    errorMessage(error, interaction)
                }




            } catch (e) {
                console.log(e)
                interaction.deleteReply()
                await errorMessage(e, interaction)
                return interaction.followUp({ content: "*Ocurrio un error al insertar los datos del usuario ❌*" + '```' + e + '``` \n-# Envia captura de este error a <@!665421882694041630>', ephemeral: true })

            }
        }


        async function edadAsignada() {
            if (!edad) {
                console.log("No hay una rol asignado para esa edad")
                return;
            }

            try {
                const rol = interaction.guild.roles.cache.get(edad)
                if (!rol) {
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
        function defaultIfEmpty(str, defaultVal) {
            return (typeof str === "string" && str.trim().length > 0)
                ? str
                : defaultVal;
        }
    }
}







