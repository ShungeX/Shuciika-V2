const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client } = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const Cachedb = db2.collection("CachePJ")
const dataCache = new Map()
const { formatearTextoLim } = require("../../../utils/textStrings")
const { crearModal } = require("../../../utils/constructores/crearComponente");
const { crearCustomId } = require("../../../utils/constructores/customId");
const { construirJsonV2Personalidad } = require("../../../utils/constructores/construirPersonalidad");

module.exports = crearModal({
    customId: "actualizarPerfil",
    formatearTextoLim,

    ejecutar: async function ({ client, interaction, componentData: { extras }, options: { defaultField } }) {

        const [selectOption, messageIds] = extras
        const userfind = await userdb.findOne({ _id: interaction.user.id })
        const fechaRegex = /^(\d{1,2})[\/\-](\d{1,2})$/;

        // Validar y formatear elementos de la ficha
        if (messageIds) {
            const messag = await interaction.channel.messages.fetch(messageIds)
            switch (selectOption) {
                case "nombre":
                    const nombre = interaction.fields.getTextInputValue("nombrepj")

                    if (await Badwords()) {
                        return interaction.reply({ content: `¡Hey! El nombre **${nombre}** contiene malas palabras（︶^︶）\n-# [Verifica el nombre de tu personaje]`, flags: ["Ephemeral"] })
                    }

                    try {
                        await characters.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                Nombre: nombre,
                            }
                        }, { upsert: true })


                        await interaction.deferUpdate()

                        await this.updateMessage(interaction, messag, "character")

                    } catch (error) {
                        console.log("Error al actualizar el nombre", error)
                    }

                    return

                    break;
                case "apodo":
                    const apodo = interaction.fields.getTextInputValue("apodopj")

                    if (await Badwords(apodo)) {
                        return interaction.reply({ content: `¡Hey! El apodo **${apodo}** contiene malas palabras（︶^︶）\n-# [Verifica el apodo de tu personaje]`, flags: ["Ephemeral"] })
                    }

                    try {
                        await characters.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                Apodo: apodo,
                            }
                        }, { upsert: true })


                        await interaction.deferUpdate()

                        await this.updateMessage(interaction, messag, "character")
                    } catch (error) {
                        console.log("Error al actualizar el apodo", error)
                    }
                    break;
                case "edad":
                    const edadpj = interaction.fields.getTextInputValue("edadpj")

                    if (isNaN(edadpj)) {
                        return interaction.reply({ content: "Colocaste un valor incorrecto en **`Edad`** (・・;).\n `[Solo se admiten valores numericos]`", flags: ["Ephemeral"] })
                    }

                    if (edadpj <= 13 || edadpj >= 22) {
                        return interaction.reply({ content: "Colocaste un valor incorrecto en **`Edad`** (・・;).\n `[Solo se permiten edades mayores a 13 y menores a 22]`", flags: ["Ephemeral"]   })
                    }

                    try {
                        await characters.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                Edad: edadpj,
                            }
                        }, { upsert: true })

                        await interaction.deferUpdate()

                        await this.updateMessage(interaction, messag, "character")
                    } catch (error) {
                        console.error("Error al actualizar la edad", error)
                    }



                    break;
                case "cumpleaños": {
                    const DIAS_POR_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

                    function validarCumple(mes, dia) {
                        return Number.isInteger(mes) && mes >= 1 && mes <= 12
                            && Number.isInteger(dia) && dia >= 1 && dia <= DIAS_POR_MES[mes - 1];
                    }

                    let mes = null;
                    let dia = null;

                    try {
                        const rawMes = interaction.fields.getStringSelectValues("cumple_mes")?.[0];
                        if (rawMes) mes = parseInt(rawMes, 10);
                    } catch (e) {}

                    try {
                        const rawDia = interaction.fields.getTextInputValue("cumple_dia");
                        if (rawDia) dia = parseInt(rawDia, 10);
                    } catch (e) {}

                    if ((!mes || !dia)) {
                        try {
                            const rawCumple = interaction.fields.getTextInputValue("cumplepj");
                            const match = rawCumple?.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
                            if (match) {
                                dia = parseInt(match[1], 10);
                                mes = parseInt(match[2], 10);
                            }
                        } catch (e) {}
                    }

                    if (!validarCumple(mes, dia)) {
                        return interaction.reply({ content: "Ese día no existe para ese mes, revísalo. ＞﹏＜", flags: ["Ephemeral"] });
                    }

                    const cumpleFormateado = `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;

                    try {
                        await characters.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                Cumpleaños: cumpleFormateado,
                                cumpleaños: cumpleFormateado,
                                CumpleMes: mes,
                                cumpleMes: mes,
                                CumpleDia: dia,
                                cumpleDia: dia
                            }
                        }, { upsert: true });

                        await interaction.deferUpdate();

                        await this.updateMessage(interaction, messag, "character");
                    } catch (error) {
                        console.error("Error al actualizar el cumpleaños", error);
                    }

                    break;
                }
                case "ciudadorg":
                    const ciudadOrg = interaction.fields.getTextInputValue("ciudadpj")

                    if (await Badwords(ciudadOrg)) {
                        return interaction.reply({ content: `¡Hey! la ciudad **${ciudadOrg}** contiene malas palabras（︶^︶）\n-# [Verifica la ciudad de tu personaje]`, flags: ["Ephemeral"] })
                    }

                    try {
                        await characters.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                CiudadOrg: ciudadOrg,
                            }
                        }, { upsert: true })


                        await interaction.deferUpdate()

                        await this.updateMessage(interaction, messag, "character")

                    } catch (error) {
                        console.log("Error al actualizar la ciudad de origen", error)
                    }
                    break;
                case "personalidad":
                    if (extra) {
                        try {
                            await characters.updateOne({ _id: interaction.user.id }, {
                                $setOnInsert: {
                                    created: Date.now(),
                                },
                                $set: {
                                    Personalidad: extra,
                                }
                            }, { upsert: true })


                            const personalidadV2 = construirJsonV2Personalidad(interaction.user.id, extra, "crear_ficha");
                            if (!interaction.deferred && !interaction.replied) {
                                await interaction.update({ components: personalidadV2 });
                            } else {
                                await interaction.editReply({ components: personalidadV2 });
                            }

                            await this.updateMessage(interaction, messag, "character");
                        } catch (error) {
                            console.log("Error al actualizar la personalidad", error);
                        }
                        return;
                    }

                    const char = await characters.findOne({ _id: interaction.user.id });
                    const personalidadV2 = construirJsonV2Personalidad(interaction.user.id, char?.perfil?.Personalidad, "crear_ficha");
                    return interaction.reply({ components: personalidadV2, flags: ["Ephemeral", "IsComponentsV2"] });
                case "apellido":
                    const family = interaction.fields.getTextInputValue("familiapj")

                    if (await Badwords(family)) {
                        return interaction.reply({ content: `¡Hey! el apellido **${family}** contiene malas palabras（︶^︶）\n-# [Verifica el apellido de tu personaje]`, flags: ["Ephemeral"] })
                    }

                    try {
                        await characters.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                Familia: family,
                            }
                        }, { upsert: true })


                        await interaction.deferUpdate()

                        await this.updateMessage(interaction, messag, "character")

                    } catch (error) {
                        console.log("Error al actualizar el apellido", error)
                    }
                    break;
                case "especialidades":
                    const especialidad = interaction.fields.getTextInputValue("especialidadpj")

                    try {
                        await characters.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                Especialidad: especialidad,
                            }
                        }, { upsert: true })


                        await interaction.deferUpdate()

                        await this.updateMessage(interaction, messag, "character")

                    } catch (error) {
                        console.log("Error al actualizar las especialidades", error)
                    }

                    break;
                case "historia":

                    const historia = interaction.fields.getTextInputValue("historiapj")

                    try {
                        await characters.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                Historia: historia,
                            }
                        }, { upsert: true })


                        await interaction.deferUpdate()

                        await this.updateMessage(interaction, messag, "character")

                    } catch (error) {
                        console.log("Error al actualizar la historia", error)
                    }

                    break;
                case "aspiracion":
                    const aspiracion = interaction.fields.getTextInputValue("aspiracion")

                    try {
                        await characters.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                aspiracion: aspiracion
                            }
                        }, { upsert: true })

                        await interaction.deferUpdate()
                        await this.updateMessage(interaction, messag, "character")
                    } catch (error) {
                        console.log("Error al actualizar aspiracion", error)
                    }
                    break;
                case "descripcion":

                    const descripcion = interaction.fields.getTextInputValue("descripcionset")
                    try {
                        await characters.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                Descripcion: descripcion,
                            }
                        }, { upsert: true })


                        await interaction.deferUpdate()

                        await this.updateMessage(interaction, messag, "character")

                    } catch (error) {
                        console.log("Error al actualizar la descripción", error)
                    }

                default:
            }

            return;
        }

        const messageId = userfind?.fichaStatus?.messageTemp
        const channel = await client.channels.fetch(userfind?.fichaStatus?.channelTemp)
        const msg = await channel.messages.fetch(messageId)
        let cacheCharacter = dataCache.get(interaction.user.id)


        if (!cacheCharacter) {
            const dbcharacter = await Cachedb.findOne({ _id: interaction.user.id });

            const obj = {
                nombre: dbcharacter?.nombre,
                apodo: dbcharacter?.apodo,
                edad: dbcharacter?.edad,
                sexo: dbcharacter?.sexo,
                pronombres: dbcharacter?.pronombres,
                cumpleaños: dbcharacter?.cumpleaños || (dbcharacter?.cumpleDia && dbcharacter?.cumpleMes ? `${String(dbcharacter.cumpleDia).padStart(2, '0')}/${String(dbcharacter.cumpleMes).padStart(2, '0')}` : null),
                cumpleMes: dbcharacter?.cumpleMes,
                cumpleDia: dbcharacter?.cumpleDia,
                ciudadOrg: dbcharacter?.ciudadOrg,
                personalidad: dbcharacter?.personalidad,
                familia: dbcharacter?.familia,
                especialidad: dbcharacter?.especialidad,
                historia: dbcharacter?.historia,
                peso: dbcharacter?.peso,
                estatura: dbcharacter?.estatura,
                gustos: dbcharacter?.gustos,
                avatarURL: dbcharacter?.avatarURL,
            }

            dataCache.set(interaction.user.id, obj)

            cacheCharacter = dataCache.get(interaction.user.id)

        }

        switch (selectOption) {
            case "nombre":
                const nombre = interaction.fields.getTextInputValue("nombrepj")

                if (await Badwords(nombre)) {
                    return interaction.reply({ content: `¡Hey! El nombre **${nombre}** contiene malas palabras（︶^︶）\n-# [Verifica el nombre de tu personaje]`, flags: ["Ephemeral"] })
                }

                try {
                    cacheCharacter.nombre = nombre
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            nombre: nombre,
                        }
                    }, { upsert: true })


                    await interaction.deferUpdate()

                    await this.updateMessage(interaction, msg, cacheCharacter)

                } catch (error) {
                    console.log("Error al actualizar el nombre", error)
                }

                return

                break;
            case "apodo":
                const apodo = interaction.fields.getTextInputValue("apodopj")

                if (await Badwords(apodo)) {
                    return interaction.reply({ content: `¡Hey! El apodo **${apodo}** contiene malas palabras（︶^︶）\n-# [Verifica el apodo de tu personaje]`, flags: ["Ephemeral"] })
                }

                try {
                    cacheCharacter.apodo = apodo
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            apodo: apodo,
                        }
                    }, { upsert: true })


                    await interaction.deferUpdate()

                    await this.updateMessage(interaction, msg, cacheCharacter)
                } catch (error) {
                    console.log("Error al actualizar el apodo", error)
                }
                break;
            case "edad":
                const edadpj = interaction.fields.getTextInputValue("edadpj")

                if (isNaN(edadpj)) {
                    return interaction.reply({ content: "Colocaste un valor incorrecto en **`Edad`** (・・;).\n `[Solo se admiten valores numericos]`", flags: ["Ephemeral"] })
                }

                if (edadpj < 13 || edadpj > 22) {
                    return interaction.reply({ content: "Colocaste un valor incorrecto en **`Edad`** (・・;).\n `[Solo se permiten edades mayores a 13 y menores a 22]`", flags: ["Ephemeral"] })
                }

                try {
                    cacheCharacter.edad = edadpj
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            edad: edadpj,
                        }
                    }, { upsert: true })

                    await interaction.deferUpdate()

                    await this.updateMessage(interaction, msg, cacheCharacter)
                } catch (error) {
                    console.error("Error al actualizar la edad", error)
                }



                break;
            case "cumpleaños": {
                const DIAS_POR_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

                function validarCumple(mes, dia) {
                    return Number.isInteger(mes) && mes >= 1 && mes <= 12
                        && Number.isInteger(dia) && dia >= 1 && dia <= DIAS_POR_MES[mes - 1];
                }

                let mes = null;
                let dia = null;

                try {
                    const rawMes = interaction.fields.getStringSelectValues("cumple_mes")?.[0];
                    if (rawMes) mes = parseInt(rawMes, 10);
                } catch (e) {}

                try {
                    const rawDia = interaction.fields.getTextInputValue("cumple_dia");
                    if (rawDia) dia = parseInt(rawDia, 10);
                } catch (e) {}

                if ((!mes || !dia)) {
                    try {
                        const rawCumple = interaction.fields.getTextInputValue("cumplepj");
                        const match = rawCumple?.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
                        if (match) {
                            dia = parseInt(match[1], 10);
                            mes = parseInt(match[2], 10);
                        }
                    } catch (e) {}
                }

                if (!validarCumple(mes, dia)) {
                    return interaction.reply({ content: "Ese día no existe para ese mes, revísalo.  ＞﹏＜", flags: ["Ephemeral"] });
                }

                const cumpleFormateado = `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;

                try {
                    cacheCharacter.cumpleaños = cumpleFormateado;
                    cacheCharacter.cumpleMes = mes;
                    cacheCharacter.cumpleDia = dia;

                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            cumpleaños: cumpleFormateado,
                            cumpleMes: mes,
                            cumpleDia: dia
                        }
                    }, { upsert: true });

                    await interaction.deferUpdate();

                    await this.updateMessage(interaction, msg, cacheCharacter);
                } catch (error) {
                    console.error("Error al actualizar el cumpleaños", error);
                }

                break;
            }
            case "ciudadorg":
                const ciudadOrg = interaction.fields.getTextInputValue("ciudadpj")

                if (await Badwords(ciudadOrg)) {
                    return interaction.reply({ content: `¡Hey! la ciudad **${ciudadOrg}** contiene malas palabras（︶^︶）\n-# [Verifica la ciudad de tu personaje]`, flags: ["Ephemeral"] })
                }

                try {
                    cacheCharacter.ciudadOrg = ciudadOrg
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            ciudadOrg: ciudadOrg,
                        }
                    }, { upsert: true })


                    await interaction.deferUpdate()

                    await this.updateMessage(interaction, msg, cacheCharacter)

                } catch (error) {
                    console.log("Error al actualizar el ciudad origen", error)
                }
                break;
            case "personalidad":
                if (extra) {
                    try {
                        cacheCharacter.personalidad = extra
                        await Cachedb.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                personalidad: extra,
                            }
                        }, { upsert: true });

                        const personalidadV2 = construirJsonV2Personalidad(interaction.user.id, extra, "crear_ficha");
                            if (!interaction.deferred && !interaction.replied) {
                                await interaction.update({ components: personalidadV2 });
                            } else {
                                await interaction.editReply({ components: personalidadV2 });
                            }

                            await this.updateMessage(interaction, msg, cacheCharacter);
                        } catch (error) {
                            console.log("Error al actualizar la personalidad", error);
                        }
                    return;
                }

                const personalidadV2 = construirJsonV2Personalidad(interaction.user.id, cacheCharacter?.personalidad, "crear_ficha");
                return interaction.reply({ components: personalidadV2, flags: ["Ephemeral", "IsComponentsV2"] });
            case "apellido":
                const family = interaction.fields.getTextInputValue("familiapj")

                if (await Badwords(family)) {
                    return interaction.reply({ content: `¡Hey! el apellido **${family}** contiene malas palabras（︶^︶）\n-# [Verifica el apellido de tu personaje]`, flags: ["Ephemeral"] })
                }

                try {
                    cacheCharacter.familia = family
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            familia: family,
                        }
                    }, { upsert: true })


                    await interaction.deferUpdate()

                    await this.updateMessage(interaction, msg, cacheCharacter)

                } catch (error) {
                    console.log("Error al actualizar el apellido", error)
                }
                break;
            case "especialidades":
                const especialidad = interaction.fields.getTextInputValue("especialidadpj")

                try {
                    cacheCharacter.especialidad = especialidad
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            especialidad: especialidad,
                        }
                    }, { upsert: true })


                    await interaction.deferUpdate()

                    await this.updateMessage(interaction, msg, cacheCharacter)

                } catch (error) {
                    console.log("Error al actualizar las especialidades", error)
                }

                break;
            case "historia":

                const historia = interaction.fields.getTextInputValue("historiapj")

                try {
                    cacheCharacter.historia = historia
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            historia: historia,
                        }
                    }, { upsert: true })


                    await interaction.deferUpdate()

                    await this.updateMessage(interaction, msg, cacheCharacter)

                } catch (error) {
                    console.log("Error al actualizar la historia", error)
                }

                break;
            case "aspiracion":
                const aspiracion = interaction.fields.getTextInputValue("aspiracion")

                cacheCharacter.aspiracion = aspiracion
                try {
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            aspiracion: aspiracion
                        }
                    }, { upsert: true })

                    await interaction.deferUpdate()
                    await this.updateMessage(interaction, msg, cacheCharacter)
                } catch (error) {
                    console.log("Error al actualizar aspiracion", error)
                }
                break
            case "peso":
                const peso = interaction.fields.getTextInputValue("peso")

                if (isNaN(peso)) {
                    return interaction.reply({ content: "Colocaste un valor incorrecto en **`estatura`** (・・;).\n `[Solo se admiten valores numericos]`", flags: ["Ephemeral"] })
                }

                if (peso < 20 || peso > 120) {
                    return interaction.reply({ content: "Colocaste un valor incorrecto en **`peso`** (・・;).\n `[Solo se permiten pesos mayores a 20 y menores a 120]`", flags: ["Ephemeral"] })
                }

                cacheCharacter.peso = peso
                try {
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            peso: peso
                        }
                    }, { upsert: true })

                    await interaction.deferUpdate()
                    await this.updateMessage(interaction, msg, cacheCharacter)
                } catch (error) {
                    console.log("Error al actualizar peso", error)
                }
                break
            case "estatura":
                const estatura = interaction.fields.getTextInputValue("estatura")

                if (isNaN(estatura)) {
                    return interaction.reply({ content: "Colocaste un valor incorrecto en **`estatura`** (・・;).\n `[Solo se admiten valores numericos]`", flags: ["Ephemeral"] })
                }

                if (estatura < 120 || estatura > 210) {
                    return interaction.reply({ content: "Colocaste un valor incorrecto en **`estatura`** (・・;).\n `[Solo se permiten estaturas menores a 210 y mayores a 120]`", flags: ["Ephemeral"] })
                }


                cacheCharacter.estatura = estatura
                try {
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            estatura: estatura
                        }
                    }, { upsert: true })

                    await interaction.deferUpdate()
                    await this.updateMessage(interaction, msg, cacheCharacter)
                } catch (error) {
                    console.log("Error al actualizar estatura", error)
                }
                break
            case "gustos":
                const gustos = interaction.fields.getTextInputValue("gustos")

                cacheCharacter.gustos = gustos
                try {
                    await Cachedb.updateOne({ _id: interaction.user.id }, {
                        $setOnInsert: {
                            created: Date.now(),
                        },
                        $set: {
                            gustos: gustos
                        }
                    }, { upsert: true })

                    await interaction.deferUpdate()
                    await this.updateMessage(interaction, msg, cacheCharacter)
                } catch (error) {
                    console.log("Error al actualizar gustos", error)
                }
                break
            case "opinion":
                const channelop = client.channels.cache.get("1009685257215287346")
                const opinionpj = interaction.fields.getTextInputValue("opinionpj")

                const embedopinion = new EmbedBuilder()
                    .setTitle("Opinion del comando Crear Ficha")
                    .setDescription(`${opinionpj}`)
                    .addFields({ name: "Usuario:", value: `${interaction.user.username}`, inline: true })
                    .setColor("Random")

                await channelop.send({ embeds: [embedopinion] })
                await interaction.reply({ content: "Gracias por dar tu opinion, apreciamos a todas las personitas que se toman el tiempo de hacerlo (≧◡≦) ♡", flags: ["Ephemeral"] })
                break;

            default:
        }



        async function Badwords(text) {
            const badwords = await import("bad-words");
            const filter = new badwords.Filter()



            if (filter.isProfane(text)) {
                return true
            } else {
                return false
            }
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

    },

    updateMessage: async function (interaction, message, data, externo, info,) {
        const { messageBuild } = require("../../../handlers/CMDHandler/Rol/Personajes/Configurar personaje");
        if (data === "character") {
            const userCache = await userdb.findOne({ _id: interaction.user.id })
            const char = await characters.findOne({ _id: interaction.user.id })

            const previewCharacter = await messageBuild(char, userCache, interaction, message.id)

            try {
                await message.edit({ components: previewCharacter })
            } catch (error) {
                console.log("Ocurrio un error al intentar mostrar el mensaje", error)
            }

            return;
        }

        if (externo) {
            data = dataCache.get(info.userId)

            if (!data) {
                const dbcharacter = await Cachedb.findOne({ _id: interaction.user.id });

                const obj = {
                    nombre: dbcharacter?.nombre,
                    apodo: dbcharacter?.apodo,
                    edad: dbcharacter?.edad,
                    sexo: dbcharacter?.sexo,
                    pronombres: dbcharacter?.pronombres,
                    cumpleaños: dbcharacter?.cumpleaños || (dbcharacter?.cumpleDia && dbcharacter?.cumpleMes ? `${String(dbcharacter.cumpleDia).padStart(2, '0')}/${String(dbcharacter.cumpleMes).padStart(2, '0')}` : null),
                    cumpleMes: dbcharacter?.cumpleMes,
                    cumpleDia: dbcharacter?.cumpleDia,
                    ciudadOrg: dbcharacter?.ciudadOrg,
                    personalidad: dbcharacter?.personalidad,
                    familia: dbcharacter?.familia,
                    especialidad: dbcharacter?.especialidad,
                    historia: dbcharacter?.historia,
                    peso: dbcharacter?.peso,
                    estatura: dbcharacter?.estatura,
                    gustos: dbcharacter?.gustos,
                    avatarURL: dbcharacter?.avatarURL,
                }

                dataCache.set(interaction.user.id, obj)

                data = dataCache.get(interaction.user.id)

            }

            data[info.action] = info.option
            if (info.pronombres !== undefined) {
                data.pronombres = info.pronombres
            }
        }

        const camposRequeridos = ["nombre", "edad", "sexo", "cumpleaños", "ciudadOrg", "personalidad"];
        const validSend = camposRequeridos.every(campo => data?.[campo])

        const previewCharacter = [
            {
                "type": 10,
                "content": `${interaction.user}`
            },
            {
                "type": 17,
                "accent_color": 8211391,
                "spoiler": false,
                "components": [
                    {
                        "type": 9,
                        "accessory": {
                            "type": 11,
                            "media": {
                                "url": `${data?.avatarURL || "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/v1/Resources/unknowncharacter"}`
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `# ${data?.nombre || "**Tu nombre estara aqui**"} *[${data?.apodo || "Sin apodo"}]* `
                            },
                            {
                                "type": 10,
                                "content": data?.historia ? "-# `Historia:`\n\n" + `${formatearTextoLim(data?.historia, 270)}` :
                                    "-# `Historia:`\n-# *in rol / no establecida*"
                            }
                        ]
                    },
                    {
                        "type": 9,
                        "accessory": {
                            "type": 2,
                            "style": 2,
                            "label": "Establecer foto",
                            "emoji": null,
                            "disabled": false,
                            "custom_id": `crear_ficha-${interaction.user.id}-foto`
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "** **"
                            },
                        ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": "# Información: \n-# `🎎` **Sexo:** " + `${`${data?.sexo} ${data?.pronombres ? `(${data.pronombres})` : ''}` || "** **"}` +
                            "\n-# `🍭` **Edad:** " + `${data?.edad || "** **"}` + "\n-# `🎂` **Cumple:** " + `${data?.cumpleaños || (data?.cumpleDia && data?.cumpleMes ? `${String(data.cumpleDia).padStart(2, '0')}/${String(data.cumpleMes).padStart(2, '0')}` : "** **")}` + "\n-# `🛫` **C/Org:** "
                            + `${data?.ciudadOrg || "** **"}` + "\n-# `👑` **Linaje Familiar:** " + `${data?.familia || "** **"}` +
                            "\n-# `🎭` **Personalidad:** " + `${data?.personalidad || "** **"}` + "\n-# `🏈` **Especialidades:** " + `${data?.especialidad || "** **"}` +
                            "\n\n-# `📏` **Estatura:** " + `${data?.estatura ? `${data.estatura}cm` : "** **"}` +
                            "\n-# `🪨` **Peso:** " + `${data?.peso ? `${data.peso}kg` : "** **"}`
                    },
                    {
                        "type": 10,
                        "content": "-# `Más opciones se irán agregando en un futuro`"
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": `crear_ficha-${interaction.user.id}`,
                                "options": [
                                    {
                                        "label": "» Nombre .ᐟ.ᐟ",
                                        "value": `nombre`,
                                        "description": "El nombre de tu personaje",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Apodo (opcional) .ᐟ.ᐟ",
                                        "value": `apodo`,
                                        "description": "El apodo de tu personaje",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Sexo & Pronombres .ᐟ.ᐟ",
                                        "value": `sexo`,
                                        "description": "Sexo biológico y pronombres de tu personaje",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Edad .ᐟ.ᐟ",
                                        "value": `edad`,
                                        "description": "La edad de tu personaje",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Cumpleaños .ᐟ.ᐟ",
                                        "value": `cumpleaños`,
                                        "description": "Día de cumpleaños (DD/MM)",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Ciudad de origen .ᐟ.ᐟ",
                                        "value": `ciudadorg`,
                                        "description": "Ciudad en la que nació",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Linaje Familiar (opcional) .ᐟ.ᐟ",
                                        "value": `apellido`,
                                        "description": "Apellido ",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Personalidad .ᐟ.ᐟ",
                                        "value": `personalidad`,
                                        "description": "Estructura MBTI",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Especialidades (opcional).ᐟ.ᐟ",
                                        "value": `especialidades`,
                                        "description": "Actividades en las que es bueno",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Peso (opcional).ᐟ.ᐟ",
                                        "value": `peso`,
                                        "description": "El peso de tu personaje (kg)",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» estatura (opcional).ᐟ.ᐟ",
                                        "value": `estatura`,
                                        "description": "Que tan alto o bajo es tu personaje",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Establecer historia (opcional)",
                                        "value": `historia`,
                                        "description": "El transfondo del personaje",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Aspiración (opcional)",
                                        "value": `aspiracion`,
                                        "description": "¿Cual es tu proposito?",
                                        "emoji": null,
                                        "default": false
                                    }
                                ],
                                "placeholder": "Personaliza tu personaje",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": false
                            }
                        ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 2,
                                "style": 3,
                                "label": "Guía / Tutorial",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": crearCustomId({
                                    action: "crear_ficha",
                                    userId: interaction.user.id,
                                    extras: ["guia"]
                                })
                            },
                            {
                                "type": 2,
                                "style": 2,
                                "label": "Da tu opinión",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": crearCustomId({
                                    action: "crear_ficha",
                                    userId: interaction.user.id,
                                    extras: ["opinion"]
                                })
                            },
                            {
                                "type": 2,
                                "style": 1,
                                "label": "Enviar ficha",
                                "emoji": null,
                                "disabled": !validSend,
                                "custom_id": crearCustomId({
                                    action: "crear_ficha",
                                    userId: interaction.user.id,
                                    extras: ["enviar_Ficha"]
                                })
                            }
                        ]
                    }
                ]
            }
        ]

        try {
            await message.edit({ components: previewCharacter })
        } catch (error) {
            console.log("Ocurrio un error al intentar mostrar el mensaje", error)
        }


    }
},
)