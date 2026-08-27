const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed, StringSelectMenuBuilder } = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const souls = db2.collection("Soul")
const character = db2.collection("Personajes")
const version = require("../../../config");
const { petConfig, petDesgaste, modificadoresLv, modifEtapa, pesosEstados } = require("../../../config/configPets");
const { duelSystem } = require("../../../functions/Duelo/duelManager");
const estadosMascota = require("../../../functions/petsStatus");
const dbobjetos = db2.collection("Objetos_globales")
const pets = db2.collection("Mascotas")




module.exports = {
    customId: "mascotas",
    buttonAuthor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */


    ejecutar: async function (client, interaction, action, petID, characterId) {

        if (action) {
            const act = await this.actionExecute(petID, characterId, action)
            if (!act.success) {
                return interaction.reply({ content: act.razon, flags: ["Ephemeral"] })
            }

            const edit = await this.perfilPet(null, characterId, interaction)
            await interaction.update({ components: edit })

            if (act.levelUp || act.etapaUp) {
                const title = act.etapaUp ? "Una nueva etapa florece bajo la mirada de las estrellas..." : "Un nuevo resplandor envuelve a tu mascota..."
                const levelM = `ha subido al nivel **${act.pet.lv}**`
                const levelEt = `a trascendido de su antigua forma y ha entrado en la etapa de **${act.pet.etapa}**`
                const poetic = act.etapaUp ? "\n-# *Sigan caminando juntos, pues aún quedan muchos secretos por descubrir...*" : "\n-# *Los sabios dicen que el crecimiento es una danza entre el tiempo, el alma y el amor*"
                const message = [
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
                                        "url": `${act.pet?.avatarURL || "https://i.pinimg.com/736x/88/84/49/8884495fca5c3040940759b4e9098727.jpg"}`
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "# ¡Tu mascota ha tenido un cambio!"
                                    },
                                    {
                                        "type": 10,
                                        "content": `${title}\n-# ¡Felicidades cuidador de mascotas! ${act.pet.Nombre}${act.levelUp ? levelM : ""} ${act.etapaUp ? `y ${levelEt}` : ""} ${poetic}`
                                    }
                                ]
                            },
                            {
                                "type": 14,
                                "divider": true,
                                "spacing": 1
                            },
                            {
                                "type": 12,
                                "items": [
                                    {
                                        "media": {
                                            "url": "https://c.tenor.com/D-QwKDFNrLIAAAAC/tenor.gif"
                                        },
                                        "description": null,
                                        "spoiler": false
                                    }
                                ]
                            }
                        ]
                    }
                ]

                interaction.followUp({ components: message, flags: ["Ephemeral", "IsComponentsV2"] })
            }

        } else {

        }
    },

    actionExecute: async function (petID, characterID, key) {
        const actions = {
            alimentar: {
                objID: 483, region: "SKY-02",
                messageContext: "alimento",
                keyMascota: "hambre",
                globalConfig: "hambrestd"
            },
            limpiar: {
                objID: 767, region: "SKY-02",
                messageContext: "limpiador",
                keyMascota: "higiene",
                globalConfig: "higienestd"
            },
            jugar: {
                objID: 728, region: "SKY-02",
                messageContext: "juguetes",
                keyMascota: "felicidad",
                globalConfig: "felicidadstd"
            },
            dormir: {
                objID: 728, region: "SKY-02",
                messageContext: "camas",
                keyMascota: "energia",
                globalCOnfig: "energiastd"
            }
        }

        const context = actions[key]

        if (!context) return { success: false, razon: "Interacción de mascota no valida (´･ω･`)?" }


        const mascota = await pets.findOne({ _id: petID })

        if (!mascota) return { success: false, razon: "No se ha podido encontrar la mascota... 〒▽〒\n-# Verifica que la mascota sea valida o este activa" }

        const personaje = await character.findOne({ ID: Number(characterID) })

        if (!personaje) return { success: false, razon: "error, personaje no valido =.=" }

        const alimento = personaje.Inventario.find((obj) => obj.ID == context.objID && obj.Region === context.region)

        if (alimento?.Cantidad === 0 || !alimento) return { success: false, razon: `No tienes suficiente ${context.messageContext} para mascota =.=\n-# ¿Por qué no intentas comprar **${context.messageContext}** en la tienda?` }


        const item = await duelSystem.getObjetInfo(context.region, context.objID)

        if (!item) return { success: false, razon: "El objeto ya no existe... =.=\n" + context.objID + context.region }

        if (mascota[context.keyMascota] === petConfig[context.globalConfig]) return { success: false, razon: "Tu mascota no necesita más de eso ＞﹏＜" }

        if (key === "dormir") {
            await pets.updateOne({ _id: petID }, {
                $push: {
                    penalizaciones: {
                        tipo: "dormido",
                        tiemporestante: null,
                        fechadeInicio
                    }
                }
            })
        } else {

        }

        const points = (mascota[context.keyMascota] + item.atributos[context.keyMascota]) >= petConfig[context.globalConfig] ? petConfig[context.globalConfig] : mascota[context.keyMascota] + item.atributos[context.keyMascota]
        if ((Date.now() - mascota.lastDay) / 100 >= 86400) {
            mascota.diasCuidado += 1
            mascota.lastDay = Date.now()
        }

        await pets.updateOne({ _id: petID }, {
            $set: {
                [context.keyMascota]: points,
                diasCuidado: mascota.diasCuidado,
                lastDay: mascota.lastDay
            },
        })

        const sumXP = await this.levelFunction(mascota, Math.floor(Math.random() * (9 - 4) + 2))

        return { success: true, razon: "¡Mascota alimentada correctamente! ( •̀ ω •́ )✧", ...sumXP, }
    },

    perfilPet: async function (petID, userId, interaction) {
        const pjuser = userId?.ID || userId

        const mascotasU = await pets.find({ characterID: Number(pjuser) }).toArray()

        if (petID) {

        } else {


            const mas = await pets.findOne({ characterID: Number(pjuser), activePet: true })


            if (!mas) {
                return ({ content: mascotasU.length > 0 ? "No tienes una mascota activa 〒▽〒\n-# Usa `/rol mascota [activa]` para asignar a una mascota en tus aventuras" : "No tienes ninguna mascota aun... 〒▽〒", flags: ["Ephemeral"] })
            }

            const mascotaActiva = await this.actualizarStats(mas, petDesgaste)
            const penalizacion = Object.entries(mascotaActiva.penalizaciones).map(([type, info]) =>
                `- -# ${type}: <t:${info.desde}:R>`
            ).join(`\n`);

            const mascotaComponents = [
                {
                    "type": 9,
                    "accessory": {
                        "type": 11,
                        "media": {
                            "url": mascotaActiva.avatarURL || "https://i.pinimg.com/736x/88/84/49/8884495fca5c3040940759b4e9098727.jpg"
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# **${mascotaActiva.Nombre}**\n-# *Nivel:* ${mascotaActiva.lv} [${mascotaActiva.etapa}]\n-# *Experiencia:* ${mascotaActiva.xp}/${mascotaActiva.xpRq}\n-# *Personalidad:* ${mascotaActiva.personalidad === null ? "Sin determinar" : mascotaActiva.personalidad}\n-# *Tipo:* ${mascotaActiva.tipo}`
                        }
                    ]
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                {
                    "type": 9,
                    "accessory": {
                        "type": 2,
                        "style": 2,
                        "label": "Alimentar",
                        "emoji": {
                            "name": "cupcake",
                            "id": "1374267364702425119"
                        },
                        "disabled": false,
                        "custom_id": `mascotas-${interaction.user.id}-alimentar-${mascotaActiva._id}-${pjuser}`
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `${getBarStatus(mascotaActiva.hambre, petConfig.hambrestd)} Hambre`
                        }
                    ]
                },
                {
                    "type": 9,
                    "accessory": {
                        "type": 2,
                        "style": 2,
                        "label": "Limpiar",
                        "emoji": {
                            "name": "MimmySwim",
                            "id": "1374267620756422736"
                        },
                        "disabled": false,
                        "custom_id": `mascotas-${interaction.user.id}-limpiar-${mascotaActiva._id}-${pjuser}`
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `${getBarStatus(mascotaActiva.higiene, petConfig.higienestd)} Higiene`
                        }
                    ]
                },
                {
                    "type": 9,
                    "accessory": {
                        "type": 2,
                        "style": 2,
                        "label": "Jugar",
                        "emoji": {
                            "name": "butterflies",
                            "id": "1374267802361532436"
                        },
                        "disabled": false,
                        "custom_id": `mascotas-${interaction.user.id}-jugar-${mascotaActiva._id}-${pjuser}`
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `${getBarStatus(mascotaActiva.felicidad, petConfig.felicidadstd)} Felicidad`
                        }
                    ]
                },
                {
                    "type": 9,
                    "accessory": {
                        "type": 2,
                        "style": 2,
                        "label": "Dormir",
                        "emoji": {
                            "name": "eepy_cat",
                            "id": "1374267940534358066"
                        },
                        "disabled": false,
                        "custom_id": `mascotas-${interaction.user.id}-dormir-${mascotaActiva._id}-${pjuser}`
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `${getBarStatus(mascotaActiva.energia, petConfig.energiastd)} Energia`
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
                    "content": `**Adoptada:** <t:${mascotaActiva.adoptada}:R>\n-# **Dias de cuidado:** ${mascotaActiva?.diasCuidado}\n` +
                        "-# **Estados:** " + `${penalizacion.length > 0 ? `\n${penalizacion}` : "Ninguno"}`
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
            ]



            if (mascotasU) {
                const menuMascotas = mascotasU.map(m => ({
                    "label": `${m.Nombre} [lv: ${m.lv}]`,
                    "description": `${m.tipo} | ${m.etapa}`,
                    "value": m._id,
                    "emoji": m.emoji ? {
                        "name": m.emoji.name,
                        "id": m.emoji.id
                    } : null,
                    "default": (m.activePet === true && m._id === mascotaActiva._id)
                }));
                const components = [
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": `select_mascota-${interaction.user.id}`,
                                "placeholder": "Selecciona una mascota",
                                "options": menuMascotas,
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": false
                            }
                        ]
                    }
                ];

                mascotaComponents.push(...components)
            }

            mascotaComponents.push(...[
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                {
                    "type": 10,
                    "content": `-# *Sistema de mascotas [v${version.versionPETS}]* | Actualizado hace: <t:${Math.floor(new Date().getTime() / 1000)}:R>`
                }
            ])

            return ({components: [
                {
                    "type": 17,
                    "accent_color": 15703927,
                    "spoiler": false,
                    "components": mascotaComponents
                },
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 3,
                            "custom_id": `selectPerfil-${interaction.user.id}-${pjuser}`,
                            "options": [
                                {
                                    "label": "Perfil principal",
                                    "value": "perfil",
                                    "description": null,
                                    "emoji": {
                                        name: "d9056043c1e148e38efd10e4515e33d2",
                                        id: "1356111301859868823"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Historia [Lore]",
                                    "value": "historia",
                                    "description": null,
                                    "emoji": {
                                        name: "BunnyBook",
                                        id: "1356111194997395496"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Alma [Núcleo]",
                                    "value": "alma",
                                    "description": null,
                                    "emoji": {
                                        name: "KrisJojos",
                                        id: "1350664814414004395"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Mascotas [Nuevo]",
                                    "value": "mascota",
                                    "description": null,
                                    "emoji": {
                                        name: "pets",
                                        id: "1356111134758932510"
                                    },
                                    "default": true,
                                    "disabled": false
                                }
                            ],
                            "placeholder": "Selecciona una opción",
                            "min_values": 1,
                            "max_values": 1,
                            "disabled": false
                        }
                    ]
                },
            ], flags: ["IsComponentsV2"]})

        }




        function getBarStatus(current, max, mini) {
            if (mini) {
                const porcentaje = (current / max) * 100

                const totalBars = 3;
                let filledBars = Math.round((current / max) * totalBars);
                const emptyBars = totalBars - filledBars;

                if (current > 0 && filledBars === 0) {
                    filledBars = 1
                }

                let heartsCompletos = '<:iconMana:1370897534083534978>'.repeat(filledBars)
                const heartsVacios = '.'.repeat(emptyBars)
                return `**(${current}/${max})** [${heartsCompletos}${heartsVacios}]`;

            } else {
                const porcentaje = (current / max) * 100

                const totalBars = 8;
                let filledBars = Math.round((porcentaje / 100) * totalBars);
                const emptyBars = totalBars - filledBars;
                let filledBarsEspacio = porcentaje === 100 ? 1 : porcentaje >= 10 ? 3 : 5

                let barEspacio = " ".repeat(filledBarsEspacio)

                let barInicio = porcentaje > 1 ? "<:PI:1374224204253237258>" : "<:EI:1374227001950601266>"
                let barMid = '<:PM:1374224241708240947>'.repeat(filledBars)
                let barEnd = porcentaje >= 98 ? "<:PE:1374224322943647744>" : "<:EE:1374224348289699985>"
                const EmptyMidBar = '<:EM:1374224400819294219>'.repeat(emptyBars)

                return "**`" + Math.round(porcentaje) + "%`**" + `${barEspacio}` + "| " + `${barInicio}${barMid}${EmptyMidBar}${barEnd}`;
            }
        }
    },

    actualizarStats: async function (pet, atributosGlobal) {
        console.log("Actualizando stats de mascota...", pet.Nombre)
        const ahora = Date.now();
        const lastUpdate = pet?.lastSeen || ahora
        const minutosPasados = (ahora - lastUpdate) / (1000 * 60)

        const actualizaciones = {}
        let modificado = false;

        for (const [atributo, config] of Object.entries(atributosGlobal)) {
            let { intervalo, desgasteIntervalo, min = 0 } = config

            pet.etapa === "Bebé" ? desgasteIntervalo += 4 : pet.etapa === "Niñez" ? desgasteIntervalo += 3 : pet.etapa === "Juventud" ? desgasteIntervalo += 2 : desgasteIntervalo

            const veces = Math.floor(minutosPasados / intervalo)



            if (veces > 0) {
                const desgasteTotal = veces * desgasteIntervalo;
                const valorActual = pet[atributo] ?? 300;
                const nuevoValor = Math.max(valorActual - desgasteTotal, min)

                actualizaciones[atributo] = nuevoValor;
                pet[atributo] = nuevoValor
                modificado = true
            }
        }

        console.log(actualizaciones)
        console.log(modificado)

        if (modificado || !pet?.lastSeen) {
            actualizaciones.lastSeen = ahora
            await pets.updateOne({ _id: pet._id }, {
                $set: actualizaciones
            })
        }

        const lastSave = {
            higiene: { points: pet.higiene, time: Math.floor(Date.now() / 1000) }, // hace 5 minutos
            felicidad: { points: pet.felicidad, time: Math.floor(Date.now() / 1000) },
            hambre: { points: pet.hambre, time: Math.floor(Date.now() / 1000) },
            energia: { points: pet.energia, time: Math.floor(Date.now() / 1000) }
        }

        await pets.updateOne({ _id: pet._id }, {
            $set: {
                saveStats: lastSave
            }
        })



        const estadoActivo = await estadosMascota.evaluarEstados(pet, petDesgaste)

        console.log("estadoaplicado: ", estadoActivo)

        return { ...pet }

    },

    levelFunction: async function (pet, xp, bonus) {
        const baseCrecimiento = 2; // Dias
        const baseXpRequire = 100;
        const xpGet = (bonus || 1) * (xp)

        let levelUp = false;
        let nextLevel;
        let etapa;

        pet.xp += xpGet

        if (pet.xp >= pet.xpRq) {
            levelUp = true
            console.log("Xp proximo nivel", pet.lv * (baseXpRequire * modificadoresLv[pet.rareza].xp) + (pet.xpRq * 0.3))
            nextLevel = Math.floor(pet.lv * (baseXpRequire * modificadoresLv[pet.rareza].xp) + (pet.xpRq * 0.3))
        }

        if (levelUp) pet.lv += 1
        console.log("XP para proxima etapa", modifEtapa[pet.etapa] * modificadoresLv[pet.rareza].xp)

        if (pet.diasCuidado >= Math.ceil((pet?.crecimiento || baseCrecimiento) * modificadoresLv[pet.rareza].tiempo) && pet.xp >= (modifEtapa[pet.etapa] * modificadoresLv[pet.rareza].xp)) {
            etapa = pet.etapa === "Bebé" ? "Niñez" : pet.etapa === "Niñez" ? "Juventud" : "Adultez"
            pet.crecimiento = Math.ceil((pet?.crecimiento || baseCrecimiento) * modificadoresLv[pet.rareza].tiempo)
            pet.etapa = etapa
        }

        if ((pet.etapa === "Niñez" || pet.etapa === "Juventud" || pet.etapa === "Adultez") && pet.personalidad === null) {
            const personalidades = [
                "Floja", "Juguetona", "Cariñosa", "Curiosa", "Glotona", "Leal", "Astuta", "Fuerte", "Valiente", "Sabia", "Temerosa", "Torpe", "Fria", "Debil"
            ]

            const selectPersonalidad = personalidades[Math.floor(Math.random() * personalidades.length)]
            pet.personalidad = selectPersonalidad
        }

        await pets.updateOne({ _id: pet._id }, {
            $set: {
                xp: pet.xp,
                xpRq: levelUp ? nextLevel : pet.xpRq,
                lv: pet.lv,
                etapa: etapa ? etapa : pet.etapa,
                crecimiento: pet?.crecimiento || 2,
                personalidad: pet.personalidad || null
            }
        })

        return { levelUp: levelUp, etapaUp: etapa?.length > 0, pet: pet }
    },

}