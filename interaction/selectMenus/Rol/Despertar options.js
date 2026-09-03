const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder, InteractionWebhook } = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const userdbs = db.collection("usuarios_server")
const character = db2.collection("Personajes")
const soul = db2.collection("Soul")
const util = require(`util`);
const sleep = util.promisify(setTimeout)
const version = require("../../../config/config")
const magicSpell = db2.collection("Hechizos_globales")

/**
 * 
 * @param {Client} client 
 * @param {ChatInputCommandInteraction} interaction 
 */

module.exports = {
    customId: "despertarOptions",
    selectAutor: true,

    /**
    * @param {Object} context
    * @param {Client} context.client - El cliente de Discord.
    * @param {ChatInputCommandInteraction} context.interaction - La interacción del comando.
    */

    ejecutar: async function ({ client, interaction, character, componentData, options: { option1 } }) {
        const dialogoManager = require("../../../functions/dialogoManager")


        console.log(componentData)
        const [pregunta, respuesta, step] = componentData.split("*")

        console.log(pregunta)

        const respuestas = {
            A: { resonancia: 5, disonancia: 0 },
            B: { resonancia: 0, disonancia: 5 },

            A1: { resonancia: 5, disonancia: 0 },
            B1: { resonancia: 0, disonancia: 5 },

            A2: { resonancia: 5, disonancia: 0 },
            B2: { resonancia: 0, disonancia: 5 },

            A3: { resonancia: 5, disonancia: 0 },
            B3: { resonancia: 0, disonancia: 5 },

            A4: { resonancia: 5, disonancia: 0 },
            B4: { resonancia: 0, disonancia: 5 },

            A5: { resonancia: 5, disonancia: 0 },
            B5: { resonancia: 0, disonancia: 5 },
        }


        if (!character) {
            return interaction.reply({ content: "No puedes despertar un personaje que no existe\n Si crees que se trata de un error contacta con administracion." })
        }

        const souls = await soul.findOne({ _id: character._id })

        if (souls?.isFinish === true) {
            return interaction.reply({ content: "Una estrella guarda aquello que resuena en tu alma.", flags: ["Ephemeral"] })
        }

        const md = await interaction.user.createDM()



        if (pregunta === "rf" || pregunta === "rf2") {
            console.log("Preguntas finales", pregunta)

            if (!souls) {
                await soul.insertOne({
                    _id: character._id,
                    ownerID: interaction.user.id,
                    nucleo: {
                        HP: 100,
                        Mana: 50,
                        Elemento: "Ninguno",
                        nivelMagico: 1,
                        XP: 0,
                        energy: 0,
                        lastEnergyUpdate: 0,
                        energiaAlmica: 0,
                    },
                    stats: {
                        hpMax: 100,
                        manaMax: 50,
                        fuerza: 1,
                        resFisica: 1,
                        resMagica: 1,
                        agilidad: 1,
                        sabiduria: 1,
                        inteligencia: 1,
                        sintoniaElemental: 1,
                        percepcion: 1,
                        determinacion: 1,
                        regeneracion: 1,
                        paradoja: 0,
                        destino: 0

                    },
                    dominio: {
                        hechizos: [],
                        transforaciones: [],
                        equipo: [],
                        debilidades: {},
                    },
                    sendero: {
                        hilosLunares: 0,
                        StelarFragments: 0,
                        firmamento: [],
                        heraldo: null,
                        resonancia: 0,
                        disonancia: 0,
                    },
                    registros: {
                        npcDefeat: []


                    },
                    isFinish: false,
                })
            }


            await asignarValor()
        } else {


            const userData = dialogoManager.activeDialogues.get(interaction.user.id)

            if (!userData) return interaction.reply({ content: "Esta interacción ya caducó (Evento terminado...)", flags: ["Ephemeral"] })
            const { savedMessages } = userData
            let messageId = savedMessages["main"]
            const message = await md.messages?.fetch(messageId)


            if (!message) {
                return interaction.reply({ content: "Esta interaccion no esta disponible. Intenta iniciar el evento de nuevo", flags: ["Ephemeral"] })
            }


            if (!souls) {
                await soul.insertOne({
                    _id: character._id,
                    ownerID: interaction.user.id,
                    nucleo: {
                        HP: 100,
                        Mana: 50,
                        Elemento: "Ninguno",
                        nivelMagico: 1,
                        XP: 0,
                        energy: 0,
                        lastEnergyUpdate: 0,
                        energiaAlmica: 0,
                    },
                    stats: {
                        hpMax: 100,
                        manaMax: 50,
                        fuerza: 1,
                        resFisica: 1,
                        resMagica: 1,
                        agilidad: 1,
                        sabiduria: 1,
                        inteligencia: 1,
                        sintoniaElemental: 1,
                        percepcion: 1,
                        determinacion: 1,
                        regeneracion: 1,
                        paradoja: 0,
                        destino: 0

                    },
                    dominio: {
                        hechizos: [],
                        transforaciones: [],
                        equipo: [],
                        debilidades: {},
                    },
                    sendero: {
                        hilosLunares: 0,
                        StelarFragments: 0,
                        firmamento: [],
                        heraldo: null,
                        resonancia: 0,
                        disonancia: 0,
                    },
                    registros: {
                        npcDefeat: []


                    },
                    isFinish: false,
                })
            } else if (userData.context.code !== souls?.codeTemp) {
                console.log("[Despertar | Soul]: Restableciendo valores porque el codigo no es el mismo ")
                await soul.updateOne({ _id: character._id }, {
                    $set:
                        { codeTemp: userData.context.code, "sendero.resonancia": 0, "sendero.disonancia": 0, isFinish: false },
                })
            }

            await asignarValor(userData)
            await nextStep(userData)

        }






        async function asignarValor(userData) {
            const data = respuestas[respuesta]
            console.log("Valor de data:", data)

            if (data) {
                console.log("Actualizando valor...")
                await soul.updateOne({ _id: character._id }, {
                    $inc: {
                        "sendero.resonancia": data.resonancia,
                        "sendero.disonancia": data.disonancia,
                    }
                })
            } else if (pregunta === "rf") {

                const jsonFormat = [
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
                                        "url": "https://i.pinimg.com/736x/82/99/61/829961dfade29dd40544a38ca9e1914b.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "# La Sintonía inicial"
                                    },
                                    {
                                        "type": 10,
                                        "content": "Has escuchado nuestro eco y has sentido nuestra armonía.\n\n-# Ahora, **escultor/a**, es momento de darnos forma y el contorno único de ti\n-# Traza el primer y más importante destino de nuestra alma.\n\n**¿Cómo fluirá el poder a través de este ser?**"
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
                                    "type": 11,
                                    "media": {
                                        "url": "https://i.pinimg.com/736x/a5/06/1c/a5061c5ecc1328673e203d03661c86d3.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "**Afinidad natural** *(resonancia)*\n\n-# ¿Harás que esta alma resuene en perfecta sintonía con uno de los Ocho Pilares de la Realidad?\n-# Una melodía innata, un propósito claro que la ancla a la creación desde su nacimiento. Un camino de claridad, pero definido por una sola nota."
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
                                    "type": 11,
                                    "media": {
                                        "url": "https://i.pinimg.com/736x/09/05/84/09058455b5164376600524ec2d5db1b6.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "**Lienzo en blanco** *(disonancia)*\n\n-# ¿O prefieres que esta alma sea un \"Alma Desafinada\" , un silencio lleno de un potencial vasto pero indefinido? \n-# No tendrá una canción propia, pero será capaz de aprender a interpretar la de otros a través de un foco externo. "
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
                                "content": "-# Los ecos de estas verdades y sus consecuencias resuenan en los archivos del conocimiento. Puedes consultarlos antes de tomar tu decisión final.\n- -# [Afinidad natural](https://discord.com/channels/716342375303217285/1335496371603509288)\n- -# [Lienzo en blanco](https://discord.com/channels/716342375303217285/1339089897172107315)\n"
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
                                        "custom_id": `despertarOptions-${interaction.user.id}`,
                                        "options": [
                                            {
                                                "label": "Afinidad natural",
                                                "value": `rf*afinidad`,
                                                "description": "(Resonancia)",
                                                "emoji": null,
                                                "default": false
                                            },
                                            {
                                                "label": "Lienzo en blanco",
                                                "value": `rf*disonancia`,
                                                "description": "(Disonancia)",
                                                "emoji": null,
                                                "default": false
                                            },
                                            {
                                                "label": "Que el destino eliga",
                                                "value": `rf*aleatorio`,
                                                "description": "(Aleatorio)",
                                                "emoji": null,
                                                "default": false
                                            }
                                        ],
                                        "placeholder": "Moldea su alma...",
                                        "min_values": 1,
                                        "max_values": 1,
                                        "disabled": true
                                    }
                                ]
                            }
                        ]
                    }
                ]

                const message = await interaction.update({ components: jsonFormat })

                if (respuesta === "aleatorio") {
                    const random = Math.floor(Math.random() * 100)

                    const embed1 = new EmbedBuilder()
                        .setAuthor({ name: "Voz unificada" })
                        .setThumbnail("https://i.pinimg.com/736x/5e/61/f0/5e61f0ad73abf6c03e7c54c8cc9643f0.jpg")
                        .setDescription("Asi que... en el momento de tu primer gran decisión, en el instante de la primera pincelada... **eliges no tomar el pincel**")
                        .setColor("DarkPurple")
                    const m = (await interaction.followUp({ embeds: [embed1], withResponse: true }))
                    await sleep(10000)

                    embed1.setDescription("**Interesante.** ")
                    await m.edit({ embeds: [embed1] })
                    await sleep(4000)

                    embed1.setDescription("Una Voluntad que cede su voluntad. ¿Es una muestra de confianza absoluta en el tejido del destino? ¿O es el miedo a la responsabilidad de la creación? Quizás no hay diferencia.")
                    await m.edit({ embeds: [embed1] })
                    await sleep(8000)

                    embed1.setDescription("No importa. Tu no-elección es, en sí misma, una directriz. Has ordenado al recipiente que busque su propio cauce, que se deje llevar por la primera marea de poder que lo toque.")
                    await m.edit({ embeds: [embed1] })
                    await sleep(8000)

                    embed1.setDescription("Observa, escultor/a. Tu silencio ha dejado que las dos posibilidades luchen por el dominio.")
                    await m.edit({ embeds: [embed1] })
                    await sleep(8000)

                    await m.edit({ content: "Las dos llamas danzan y giran una alrededor de la otra en una lucha silenciosa. Finalmente, una de ellas consume a la otra.", embeds: [] })
                    await sleep(9000)

                    if (random <= 49) {
                        await soul.updateOne({ _id: character._id },
                            {
                                $set: {
                                    "nucleo.artefactoMagico": true
                                }
                            }
                        )

                        souls.nucleo.artefactoMagico = true
                        await m.edit({ content: "El destino decidió que su alma sea un lienzo en blanco..." })
                    } else {
                        await soul.updateOne({ _id: character._id },
                            {
                                $set: {
                                    "nucleo.artefactoMagico": false
                                }
                            }
                        )

                        souls.nucleo.artefactoMagico = false
                        await m.edit({ content: "El destino decidió que su alma resonara..." })
                    }

                    await sleep(7000)
                    m.delete()

                }

                if (respuesta === "afinidad") {
                    await soul.updateOne({ _id: character._id },
                        {
                            $set: {
                                "nucleo.artefactoMagico": false
                            }
                        }
                    )

                    souls.nucleo.artefactoMagico = false
                }

                if (respuesta === "disonancia") {
                    await soul.updateOne({ _id: character._id },
                        {
                            $set: {
                                "nucleo.artefactoMagico": true
                            }
                        }
                    )

                    souls.nucleo.artefactoMagico = true
                }


                const { resonancia, disonancia } = souls.sendero;

                // Comprobación corregida para los valores
                if (typeof resonancia === 'undefined' || typeof disonancia === 'undefined') {
                    return interaction.followUp({ content: "No se ha podido asignar los valores a tu personaje, intenta nuevamente. Si el error persiste contacta con administracion", flags: ["Ephemeral"] });
                }

                if (resonancia === disonancia) {
                    interaction.user.send({ content: "El Lienzo en Blanco.\n-# Al despertar, la última sensación que te acompaña es la del silencio absoluto. Ni la paz de un propósito, ni la inquietud de una duda. Solo un vasto potencial y el peso de una libertad total. Tu camino no está escrito; cada paso será una elección enteramente tuya." }).then(m => setTimeout(() => m.delete(), 10000));
                } else {
                    const esVirtuoso = resonancia > disonancia;

                    const messages = {
                        title: esVirtuoso
                            ? "Al despertar, una última sensación perdura en tu mente: la paz de un propósito claro. Sientes que cada fibra de tu ser está exactamente en su lugar, como una nota perfecta en una sinfonía eterna. Tu camino está trazado."
                            : "Al despertar, una última sensación te inquieta: el eco de una pregunta sin respuesta. Sientes un sutil anhelo, un llamado hacia algo que sabes que existe más allá de los muros del jardín. Tu camino apenas comienza, y ya te atrae lo desconocido.",
                        description: esVirtuoso
                            ? "-# Un Pilar para el Mundo"
                            : "-# Un Eco en el Silencio"
                    };

                    interaction.user.send({ content: `${messages.description}\n\n${messages.title}` }).then(m => setTimeout(() => m.delete(), 10000));
                }

                const elementJSON = [
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
                                        "url": "https://i.pinimg.com/736x/06/9f/8f/069f8fe5bd337125bbea58b326ab794e.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "# El Sello del Alma"
                                    },
                                    {
                                        "type": 10,
                                        "content": "-# Has aceptado tu lugar en el gran diseño. Tu alma, forjada con un propósito, resuena con una de las Esencias Primordiales.\n-# Ahora, es momento de nombrar esa verdad. De sellar el pacto.\n\n¿Cuál de los Ocho Pilares de la Realidad es el núcleo de tu Portador?"
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
                                "content": "`[🔥]` **Pyrós:** *La Llama Primordial. Símbolo de poder, civilización y voluntad inquebrantable. *\n\n`[💧]` **Aqua:** *La Fuente de Vida. Una esencia pura con el poder de sanar las heridas y purificar la corrupción. *\n\n`[⛰️]` **Lapis:** *El Pilar del Mundo. Otorga un dominio sólido sobre la roca y los minerales de la tierra.* \n`[🌳]` **Rakau:** *El Aliento de la Naturaleza. Canaliza la energía vital, acelerando los ciclos de la vida y el crecimiento. *\n\n`[⚡]` **Electro:** *La Chispa de Pureza. Una voluntad veloz y certera, un vector de poder que se dispara hacia su objetivo. *\n\n`[❄️]` **Krýo:** *El Vacío Helado. El poder que nace de la disciplina, la paz interior y la calma absoluta de la mente. *\n\n`[🌪️]` **Wind:** *El Aliento del Mundo. La esencia más armónica, un catalizador universal que fluye entre los demás elementos para potenciarlos. *\n\n`[✨]` **Lux:** *El Don de la Sanación. La manifestación más pura del amor del Eón Creador, un abrazo que reconforta el espíritu.*"
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
                                        "custom_id": `despertarOptions-${interaction.user.id}`,
                                        "options": [
                                            {
                                                "label": "[🔥] Pyró",
                                                "value": "rf2*Pyro",
                                                "description": null,
                                                "emoji": null,
                                                "default": false
                                            },
                                            {
                                                "label": "[💧] Aqua",
                                                "value": "rf2*Aqua",
                                                "description": null,
                                                "emoji": null,
                                                "default": false
                                            },
                                            {
                                                "label": "[⛰️] Lapis",
                                                "value": "rf2*Lapis",
                                                "description": null,
                                                "emoji": null,
                                                "default": false
                                            },
                                            {
                                                "label": "[🌳] Rakau",
                                                "value": "rf2*Rakau",
                                                "description": null,
                                                "emoji": null,
                                                "default": false
                                            },
                                            {
                                                "label": "[⚡] Electro",
                                                "value": "rf2*Electro",
                                                "description": null,
                                                "emoji": null,
                                                "default": false
                                            },
                                            {
                                                "label": "[❄️] Krýo",
                                                "value": "rf2*Kryo",
                                                "description": null,
                                                "emoji": null,
                                                "default": false
                                            },
                                            {
                                                "label": "[🌪️] Wind",
                                                "value": "rf2*Wind",
                                                "description": null,
                                                "emoji": null,
                                                "default": false
                                            },
                                            {
                                                "label": "[✨] Lux",
                                                "value": "rf2*Lux",
                                                "description": null,
                                                "emoji": null,
                                                "default": false
                                            }
                                        ],
                                        "placeholder": "Selecciona tu pilar",
                                        "min_values": 1,
                                        "max_values": 1,
                                        "disabled": false
                                    }
                                ]
                            },
                            {
                                "type": 10,
                                "content": "Para un conocimiento más profundo de las Esencias Primordiales, los archivos del Instituto están a tu disposición en [Los 8 pilares de la realidad](https://canary.discord.com/channels/716342375303217285/1335496371603509288)"
                            }
                        ]
                    }
                ]

                await sleep(6000)

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ components: elementJSON, flags: ["IsComponentsV2"] })
                } else {
                    console.log(message)
                    await message.edit({ components: elementJSON, flags: ["IsComponentsV2"] })
                }

            } else if (pregunta === "rf2") {


                const element = {
                    Pyro: "Pyró",
                    Aqua: "Aqua",
                    Lapis: "Lapis",
                    Rakau: "Rakau",
                    Electro: "Electro",
                    Kryo: "Krýo",
                    Wind: "Wind",
                    Lux: "Lux",
                }

                const elementName = element[respuesta]

                if (!elementName) {
                    return interaction.reply({ content: "No se ha podido asignar el elemento a tu personaje, intenta nuevamente. Si el error persiste contacta con administracion", flags: ["Ephemeral"] })
                }

                await soul.updateOne({ _id: character._id }, {
                    $set: {
                        "nucleo.Elemento": elementName
                    }
                })

                const elementJSON = [
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
                                        "url": "https://i.pinimg.com/736x/06/9f/8f/069f8fe5bd337125bbea58b326ab794e.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "# El Sello del Alma"
                                    },
                                    {
                                        "type": 10,
                                        "content": "-# Has aceptado tu lugar en el gran diseño. Tu alma, forjada con un propósito, resuena con una de las Esencias Primordiales.\n-# Ahora, es momento de nombrar esa verdad. De sellar el pacto.\n\n¿Cuál de los Ocho Pilares de la Realidad es el núcleo de tu Portador?"
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
                                "content": "`[🔥]` **Pyrós:** *La Llama Primordial. Símbolo de poder, civilización y voluntad inquebrantable. *\n\n`[💧]` **Aqua:** *La Fuente de Vida. Una esencia pura con el poder de sanar las heridas y purificar la corrupción. *\n\n`[⛰️]` **Lapis:** *El Pilar del Mundo. Otorga un dominio sólido sobre la roca y los minerales de la tierra.* \n`[🌳]` **Rakau:** *El Aliento de la Naturaleza. Canaliza la energía vital, acelerando los ciclos de la vida y el crecimiento. *\n\n`[⚡]` **Electro:** *La Chispa de Pureza. Una voluntad veloz y certera, un vector de poder que se dispara hacia su objetivo. *\n\n`[❄️]` **Krýo:** *El Vacío Helado. El poder que nace de la disciplina, la paz interior y la calma absoluta de la mente. *\n\n`[🌪️]` **Wind:** *El Aliento del Mundo. La esencia más armónica, un catalizador universal que fluye entre los demás elementos para potenciarlos. *\n\n`[✨]` **Lux:** *El Don de la Sanación. La manifestación más pura del amor del Eón Creador, un abrazo que reconforta el espíritu.*"
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
                                        "custom_id": `despertarOptions-${interaction.user.id}`,
                                        "options": [
                                            {
                                                "label": "[🔥] Pyró",
                                                "value": "rf2*Pyro",
                                                "description": null,
                                                "emoji": null,
                                                "default": respuesta === "Pyro"
                                            },
                                            {
                                                "label": "[💧] Aqua",
                                                "value": "rf2*Aqua",
                                                "description": null,
                                                "emoji": null,
                                                "default": respuesta === "Aqua"
                                            },
                                            {
                                                "label": "[⛰️] Lapis",
                                                "value": "rf2*Lapis",
                                                "description": null,
                                                "emoji": null,
                                                "default": respuesta === "Lapis"
                                            },
                                            {
                                                "label": "[🌳] Rakau",
                                                "value": "rf2*Rakau",
                                                "description": null,
                                                "emoji": null,
                                                "default": respuesta === "Rakau"
                                            },
                                            {
                                                "label": "[⚡] Electro",
                                                "value": "rf2*Electro",
                                                "description": null,
                                                "emoji": null,
                                                "default": respuesta === "Electro"
                                            },
                                            {
                                                "label": "[❄️] Krýo",
                                                "value": "rf2*Kryo",
                                                "description": null,
                                                "emoji": null,
                                                "default": respuesta === "Kryo"
                                            },
                                            {
                                                "label": "[🌪️] Wind",
                                                "value": "rf2*Wind",
                                                "description": null,
                                                "emoji": null,
                                                "default": respuesta === "Wind"
                                            },
                                            {
                                                "label": "[✨] Lux",
                                                "value": "rf2*Lux",
                                                "description": null,
                                                "emoji": null,
                                                "default": respuesta === "Lux"
                                            }
                                        ],
                                        "placeholder": "Selecciona tu pilar",
                                        "min_values": 1,
                                        "max_values": 1,
                                        "disabled": true
                                    }
                                ]
                            },
                            {
                                "type": 10,
                                "content": "Para un conocimiento más profundo de las Esencias Primordiales, los archivos del Instituto están a tu disposición en [Los 8 pilares de la realidad](https://canary.discord.com/channels/716342375303217285/1335496371603509288)"
                            }
                        ]
                    }
                ]

                await interaction.update({ components: elementJSON })

                await interaction.followUp({ content: `Tu personaje ha sido bendecido por el éon de la creacion. Ahora posee el elemento **${elementName}**`, flags: ["Ephemeral"] })

                await sleep(5000)

                endDialogo()

            }


        }

        async function nextStep(userData) {
            if (userData?.skipTimeout) {
                console.log("[Dialogo - Despertar] Limpiando timeout ...")
                clearTimeout(userData.skipTimeout);
                delete userData.skipTimeout;
                dialogoManager.activeDialogues.set(interaction.user.id, userData);
            }

            console.log("Saltando al paso:", step)

            userData.currentStep = step
            dialogoManager.activeDialogues.set(interaction.user.id, userData);
            await interaction.deferUpdate();
            await dialogoManager.processNextStep(interaction)
        }


        async function endDialogo() {
            const m = await interaction.user.send({ content: "El claro se desvanece. Las luces de tu alma comienzan a apagarse, cómo si de un teatro se tratara. Dejando solo un foco sobre ti, el jugador. El silencio es total..." })

            let SpellId;

            const soulsactual = await soul.findOne({ _id: character._id })

            const spellsSelect = {
                Pyró: "Pyro-001",
                Aqua: "Aqua-001",
                Lapis: "Lapis-001",
                Rakau: "Rakau-001",
                Electro: "Electro-001",
                Krýo: "Kryo-001",
                Wind: "Wind-001",
                Lux: "Lux-001",
            }

            SpellId = spellsSelect[soulsactual.nucleo.Elemento]

            soul.updateOne({ _id: character._id }, {
                $set: {
                    "metadata.Despertado": Math.floor(Date.now() / 1000),
                    isFinish: true,
                    "dominio.equipo": [
                        {
                            "ID": 748,
                            "Region": "TOB-01",
                            "Type": 1
                        }
                    ],
                    "dominio.hechizos": [
                        {
                            "ID": SpellId,
                            "InCombat": true
                        }
                    ]

                },
                $unset: {
                    "messageTemp": "",
                }
            })

            await sleep(9000)

            const typemagia = souls.nucleo.artefactoMagico === true ? "Lienzo en blanco" : "Alma en resonancia (afinada)"




            const jsonFinal = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 10,
                            "content": "# En busca de un lugar en las estrellas"
                        },
                        {
                            "type": 10,
                            "content": "Tu poder ha despertado, portador. Tu alma ha sido reconocida.\n\nCada lección, cada desafío y cada acto de lealtad te acercará a tu destino final: **la Ascensión.** \nEsfuérzate, mantén tu *resonancia pura* y reclama el lugar que te espera entre los protectores de nuestro firmamento. "
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": `- -# Naturaleza anímica: ${typemagia} \n- -# Pilar de la realidad: ${soulsactual.nucleo.Elemento}\n- -# Potencial Inicial: ${soulsactual.nucleo.nivelMagico}`
                        },
                        {
                            "type": 12,
                            "items": [
                                {
                                    "media": {
                                        "url": "https://i.pinimg.com/736x/82/99/61/829961dfade29dd40544a38ca9e1914b.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
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
                            "content": "-# *Tu perfil ha sido actualizado en los Archivos del Instituto, usa `/rol perfil` para visualizar dichos cambios*"
                        }
                    ]
                }
            ]

            interaction.user.send({ components: jsonFinal, flags: ["IsComponentsV2"] })
        }
    },

    despertarAlma: async function (interaction, context) {
        const jsonFormat = [
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
                                "url": "https://i.pinimg.com/736x/82/99/61/829961dfade29dd40544a38ca9e1914b.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "# La Sintonía inicial"
                            },
                            {
                                "type": 10,
                                "content": "Has escuchado nuestro eco y has sentido nuestra armonía.\n\n-# Ahora, **escultor/a**, es momento de darnos forma y el contorno único de ti\n-# Traza el primer y más importante destino de nuestra alma.\n\n**¿Cómo fluirá el poder a través de este ser?**"
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
                            "type": 11,
                            "media": {
                                "url": "https://i.pinimg.com/736x/a5/06/1c/a5061c5ecc1328673e203d03661c86d3.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "**Afinidad natural** *(resonancia)*\n\n-# ¿Harás que esta alma resuene en perfecta sintonía con uno de los Ocho Pilares de la Realidad?\n-# Una melodía innata, un propósito claro que la ancla a la creación desde su nacimiento. Un camino de claridad, pero definido por una sola nota."
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
                            "type": 11,
                            "media": {
                                "url": "https://i.pinimg.com/736x/09/05/84/09058455b5164376600524ec2d5db1b6.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "**Lienzo en blanco** *(disonancia)*\n\n-# ¿O prefieres que esta alma sea un \"Alma Desafinada\" , un silencio lleno de un potencial vasto pero indefinido? \n-# No tendrá una canción propia, pero será capaz de aprender a interpretar la de otros a través de un foco externo. "
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
                        "content": "-# Los ecos de estas verdades y sus consecuencias resuenan en los archivos del conocimiento. Puedes consultarlos antes de tomar tu decisión final.\n- -# [Afinidad natural](https://discord.com/channels/716342375303217285/1335496371603509288)\n- -# [Lienzo en blanco](https://discord.com/channels/716342375303217285/1339089897172107315)\n"
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
                                "custom_id": `despertarOptions-${context.user_id}`,
                                "options": [
                                    {
                                        "label": "Afinidad natural",
                                        "value": `rf*afinidad`,
                                        "description": "(Resonancia)",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "Lienzo en blanco",
                                        "value": `rf*disonancia`,
                                        "description": "(Disonancia)",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "Que el destino eliga",
                                        "value": `rf*aleatorio`,
                                        "description": "(Aleatorio)",
                                        "emoji": null,
                                        "default": false
                                    }
                                ],
                                "placeholder": "Moldea su alma...",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": false
                            }
                        ]
                    }
                ]
            }
        ]

        try {
            if (interaction?.deferred || interaction?.replied) {
                interaction.followUp(({ components: jsonFormat, flags: ["IsComponentsV2"] }))
            } else {
                console.log("Intente enviar el mensaje (No deferred)")
                interaction.reply({ components: jsonFormat, flags: ["IsComponentsV2"] })
            }
        } catch (error) {

            if (!interaction) {
                context.user.send({ components: jsonFormat, flags: ["IsComponentsV2"] })
            }
        }



    }
}