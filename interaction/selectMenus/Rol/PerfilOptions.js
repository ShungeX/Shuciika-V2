const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed, StringSelectMenuBuilder } = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const version = require("../../../config");
const petConfig = require("../../../config/configPets");
const dbobjetos = db2.collection("Objetos_globales")
const pets = db2.collection("Mascotas")

const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente")
const { construirPerfilV2 } = require("../../../handlers/CMDHandler/Rol/Personajes/Perfil")

module.exports = crearStringSelectMenu({
    customId: "selectPerfil",
    soloAutor: true,
    requirements: {
        character: {obtener: true, required: false},
        soul: {obtener: true, required: false}
    },
    optionNames: ["action"],

    ejecutar: async({client, interaction, character, soul, componentData: {userId, extras}, options: {action}}) => {
        console.log("extras", extras)
        console.log("options", action)
        const [deff, key] = extras
        const user = interaction.guild.members.resolve(character.ownerID)

        switch (action) {
            case "perfil":
                perfil(character)
                break;
            case "galeria":
                galeria(character)
                break;
            case "historia":
                historia(character)
                break;
            case "alma":
                await alma(character)
                break;
            case "mascota":
                mascotas(character)
                break;
            case "stats":
                stats(character)
                break;
            default:
                break;
        }


        function perfil(pjuser) {
            const perfilV2 = construirPerfilV2(pjuser, userId || interaction.user.id);
            return interaction.update({ components: perfilV2 });
        }

        function galeria(pjuser) {
            const galeriaItems = pjuser?.social?.galeria;
            if (!galeriaItems || !Array.isArray(galeriaItems) || galeriaItems.length === 0) {
                return interaction.reply({
                    content: "Aún no presumes a tu personaje. Puedes editar este apartado desde el dashboard",
                    flags: ["Ephemeral"]
                });
            }

            const imagenes = galeriaItems.slice(0, 9);
            const items = imagenes.map(img => ({
                "media": {
                    "url": img.url,
                    "proxy_url": img.proxy_url || img.url
                },
                "description": img.descripcion || null,
                "spoiler": Boolean(img.spoiler)
            }));

            const galeriaV2 = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 10,
                            "content": `### Galería de ${pjuser?.perfil?.Nombre || "Personaje"}`
                        },
                        {
                            "type": 10,
                            "content": "-# ¿Quieres editar esto? Hazlo desde tu dashboard."
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 12,
                            "items": items
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": `-# Mostrando ${imagenes.length} imagenes (pagina: 1/1)`
                        }
                    ]
                },
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 3,
                            "custom_id": `selectPerfil-${userId || interaction.user.id}-${pjuser._id}`,
                            "options": [
                                {
                                    "label": "Perfil principal",
                                    "value": "perfil",
                                    "description": null,
                                    "emoji": {
                                        "name": "d9056043c1e148e38efd10e4515e33d2",
                                        "id": "1356111301859868823"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Apariencia [Galeria]",
                                    "value": "galeria",
                                    "description": null,
                                    "emoji": {
                                        "name": "EmuNui",
                                        "id": "1370631281028890727"
                                    },
                                    "default": true,
                                    "disabled": false
                                },
                                {
                                    "label": "Historia [Lore]",
                                    "value": "historia",
                                    "description": null,
                                    "emoji": {
                                        "name": "BunnyBook",
                                        "id": "1356111194997395496"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Alma [Núcleo]",
                                    "value": "alma",
                                    "description": null,
                                    "emoji": {
                                        "name": "KrisJojos",
                                        "id": "1350664814414004395"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Mascotas [Nuevo]",
                                    "value": "mascota",
                                    "description": null,
                                    "emoji": {
                                        "name": "pets",
                                        "id": "1356111134758932510"
                                    },
                                    "default": false,
                                    "disabled": false
                                }
                            ],
                            "placeholder": "Selecciona una opción",
                            "min_values": 1,
                            "max_values": 1,
                            "disabled": false
                        }
                    ]
                }
            ];

            return interaction.update({ components: galeriaV2 });
        }

        function historia(pjuser) {
            let title;
            let historiaShow;
            let image;



            if (key) {
                const historiaData = character.perfil.Capitulos.find(c => c.ID === key)
                if (!historiaData) return interaction.reply({ content: "Hubo un error al intentar mostrar este capitulo. Intentalo de nuevo ＞﹏＜", flags: ["Ephemeral"] })

                title = `# ${historiaData.Titulo}`
                historiaShow = historiaData.Historia
                image = historiaData.Imagen || pjuser?.perfil?.avatarURL
            } else {
                title = "# Capitulo principal"
                historiaShow = pjuser.Historia || "In Rol"
                image = `${pjuser?.perfil?.avatarURL}`
            }

            const componentsMain = [
                {
                    "type": 9,
                    "accessory": {
                        "type": 11,
                        "media": {
                            "url": image
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": title
                        },
                        {
                            "type": 10,
                            "content": `*Personaje:* ${pjuser.perfil.Nombre}${pjuser.perfil?.Apodo ? ` | ${pjuser.perfil.Apodo}` : ""}`
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
                    "content": historiaShow
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                }
            ]


            const pincel = character.economia.Inventario.find(i => i.ID === 120 && i.Region === "TOB-01")

            if (pjuser.ownerID === interaction.user.id) {
                const buttons = [
                    {
                        "type": 2,
                        "style": 2,
                        "label": "Tutorial",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": `perfil_options-${interaction.user.id}-${pjuser._id}-tutorial`
                    },
                    {
                        "type": 2,
                        "style": 2,
                        "label": "Agregar capitulo",
                        "emoji": {
                            "name": "pencil",
                            "id": "1356116580555296880"
                        },
                        "disabled": !(pincel?.Cantidad > 0),
                        "custom_id": `perfil_options-${interaction.user.id}-${pjuser._id}-addHistory`
                    }
                ]

                if (key) {
                    buttons.push({
                        "type": 2,
                        "style": 2,
                        "label": "Editar capitulo",
                        "emoji": null,
                        "custom_id": `perfil_options-${interaction.user.id}-${pjuser._id}-editHistory`
                    })
                }

                componentsMain.push({
                    "type": 1,
                    "components": buttons
                })
            }

            if (pjuser.perfil?.Capitulos?.length > 0) {
                const historiasOrdenadas = pjuser.perfil.Capitulos.sort((a, b) => {
                    if (a.Pin !== b.Pin) return b.Pin - a.Pin;
                    if (a.Orden !== b.Orden) return a.Orden - b.Orden;
                    return new Date(a.FechaCreacion) - new Date(b.FechaCreacion);
                });

                const chapters = []

                chapters.push({
                    "label": `Capitulo principal`,
                    "value": `historia`,
                    "description": `Esta es la historia principal de personaje`,
                    "emoji": {
                        "name": "✨",
                        "id": null
                    },
                    "default": !key
                })

                historiasOrdenadas.slice(0, 24).forEach(historia => {
                    const numeroRomano = NumRomano(historia.NumeroCapitulo);
                    let emoji = historia.Pin ? {
                        "name": '📌', id: null
                    } : {
                        "name": '📖',
                        "id": null
                    };

                    chapters.push({
                        "label": `Capitulo ${numeroRomano}`,
                        "value": `historia*${historia.ID}`,
                        "description": `Título: ${historia.Titulo.substring(0, 50)}...`,
                        "emoji": emoji,
                        "default": key === historia.ID
                    });
                });

                const mainSelect = [
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": `selectPerfil-${interaction.user.id}-${pjuser._id}-extras`,
                                "options": chapters,
                                "placeholder": "Selecciona una historia para ver...",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": false
                            }
                        ]
                    }
                ]

                componentsMain.push(...mainSelect)
            }



            const historia = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": componentsMain
                },
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 3,
                            "custom_id": `selectPerfil-${interaction.user.id}-${pjuser._id}`,
                            "options": [
                                {
                                    "label": "Perfil principal",
                                    "value": "perfil",
                                    "description": null,
                                    "emoji": {
                                        "name": "d9056043c1e148e38efd10e4515e33d2",
                                        "id": "1356111301859868823"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Apariencia [Galeria]",
                                    "value": "galeria",
                                    "description": null,
                                    "emoji": {
                                        "name": "EmuNui",
                                        "id": "1370631281028890727"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Historia [Lore]",
                                    "value": "historia",
                                    "description": null,
                                    "emoji": {
                                        "name": "BunnyBook",
                                        "id": "1356111194997395496"
                                    },
                                    "default": true,
                                    "disabled": false
                                },
                                {
                                    "label": "Alma [Núcleo]",
                                    "value": "alma",
                                    "description": null,
                                    "emoji": {
                                        "name": "KrisJojos",
                                        "id": "1350664814414004395"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Mascotas [Nuevo]",
                                    "value": "mascota",
                                    "description": null,
                                    "emoji": {
                                        "name": "pets",
                                        "id": "1356111134758932510"
                                    },
                                    "default": false,
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
            ]

            return interaction.update({ components: historia })
        }

        async function mascotas(pjuser) {
            const petsSystem = require("../../buttons/Rol/petsActs");

            const mascotaComp = await petsSystem.perfilPet(null, pjuser, interaction)

            const embed = new EmbedBuilder()
                .setTitle("Mascotas de " + pjuser.perfil.Nombre)
                .setDescription("Sin mascotas")
                .setAuthor({ name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({ dynamic: true }) || interaction.member.displayAvatarURL({ dynamic: true }) })
                .setThumbnail(pjuser.avatarURL)
                .setColor(`Random`)
                .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}` });
            return interaction.reply(mascotaComp)
            return interaction.update({ components: mascotas4, flags: ["IsComponentsV2"] })


        }

        async function stats(pjuser) {
            console.log(interaction.values[0])
            if (key) {
                if (soul.sendero.StelarFragments < 1) return interaction.reply({ content: "No puedes mejorar esta habilidad porque no tienes los fragmentos estelares suficientes", flags: ["Ephemeral"] })

                await souls.updateOne({ _id: pjuser._id }, {
                    $inc: {
                        [`stats.${key}`]: +1,
                        "sendero.StelarFragments": -1
                    }
                })


                soul.stats[key] += + 1
                soul.sendero.StelarFragments -= 1
            }


            const getst = getStats(soul.stats)

            const statsV2 = [
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
                                    "url": "https://i.pinimg.com/originals/29/d5/c4/29d5c4bce4419d9a16d83dcf3d4a7b93.gif"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Estadisticas de ShungeX"
                                },
                                {
                                    "type": 10,
                                    "content": "<a:PurpleCrystalHeart:1356497588131729458> `Fragmentos estelares:` " + soul.sendero.StelarFragments +
                                        "\n-# Los fragmentos estelares se obtienen subiendo de nivel\n\n-# **¡Una vez asignes los fragmentos no los podras cambiar a menos que compres un item que aún está en desarrollo!**\n\n-# No todos los stats se pueden mejorar mediante fragmentos estelares. \n-# Algunos aún no están disponibles para mejorar"
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
                            "content": "**Stats principales:**\n- `❤️` **HP Max:** " + soul.stats.hpMax +
                                "      `🔷` **Mana Max:** " + soul.stats.manaMax + "\n- `💪` **Fuerza:** " + soul.stats.fuerza +
                                "\n- `💨` **Agilidad:** " + soul.stats.agilidad + "\n- `🔍` **Sabiduria:** " + soul.stats.sabiduria +
                                "\n- `🧠` **Inteligencia:** " + soul.stats.inteligencia +
                                "\n- `🪄` **SE:** " + soul.stats.sintoniaElemental + "\n- `🥊` **RF:** " + soul.stats.resFisica +
                                "\n- `🔥` **RM:** " + `${soul.stats.resMagica}\n`
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 1,
                            "components": getst
                        },
                        {
                            "type": 10,
                            "content": `-# Stats consultados hace: <t:${Math.floor(new Date().getTime() / 1000)}:R>`
                        }
                    ]
                },
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 3,
                            "custom_id": `selectPerfil-${interaction.user.id}-${pjuser._id}`,
                            "options": [
                                {
                                    "label": "Perfil principal",
                                    "value": "perfil",
                                    "description": null,
                                    "emoji": {
                                        "name": "d9056043c1e148e38efd10e4515e33d2",
                                        "id": "1356111301859868823"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Apariencia [Galeria]",
                                    "value": "galeria",
                                    "description": null,
                                    "emoji": {
                                        "name": "EmuNui",
                                        "id": "1370631281028890727"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Historia [Lore]",
                                    "value": "historia",
                                    "description": null,
                                    "emoji": {
                                        "name": "BunnyBook",
                                        "id": "1356111194997395496"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Alma [Núcleo]",
                                    "value": "alma",
                                    "description": null,
                                    "emoji": {
                                        "name": "KrisJojos",
                                        "id": "1350664814414004395"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Mascotas [Nuevo]",
                                    "value": "mascota",
                                    "description": null,
                                    "emoji": {
                                        "name": "pets",
                                        "id": "1356111134758932510"
                                    },
                                    "default": false,
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
            ]

            await interaction.update({ components: statsV2 })

            if (key) {
                await interaction.followUp({ content: "Puntos estelares aplicados correctamente", flags: ["Ephemeral"] })
            }

        }

        async function alma(pjuser) {


            if (interaction.user.id !== pjuser.ownerID) {
                return interaction.reply({ content: "No puedes revisar el alma de este personaje ＞﹏＜", flags: ["Ephemeral"] })
            }

            if (!soul) {
                return interaction.reply({ content: "Este personaje aún no despierta su poder (´･ω･`)?", flags: ["Ephemeral"] })
            }
            const soulV2 = [
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
                                    "url": "https://res.cloudinary.com/dn1cubayf/image/upload/v1737346978/idk3_v2s9hr.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": `# Alma de ${pjuser.perfil.Nombre}`
                                },
                                {
                                    "type": 10,
                                    "content": "-# 𝑻𝒖 𝒕𝒓𝒂𝒚𝒆𝒄𝒕𝒐 𝒉𝒂𝒄𝒊𝒂 𝒍𝒂𝒔 𝒆𝒔𝒕𝒓𝒆𝒍𝒍𝒂𝒔 \n\n" +
                                        "`[💜] 𝙷𝙿:` " + `${soul.nucleo.HP}/${soul.stats.hpMax}` +
                                        "     `[💧] Mana:` " + `${soul.nucleo.Mana}/${soul.stats.manaMax}` +
                                        "\n\n`[✨] Nivel:` " + soul.nucleo.nivelMagico + "\n`[🍪] XP:` " + `${soul.nucleo.XP}/${soul?.sendero?.xpRequired || 1}` +
                                        "\n`[🌱] Elemento:` " + soul.nucleo.Elemento + "\n`[🔮] Resonancia:` " + (soul.nucleo.artefactoMagico === true ? "Lienzo en blanco" : "Magia Elemental")
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
                            "content": await getequipamiento()
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
                                    "custom_id": `selectPerfil-${interaction.user.id}-${character._id}-extra`,
                                    "options": [
                                        {
                                            "label": "Ver stats",
                                            "value": "stats",
                                            "description": null,
                                            "emoji": {
                                                "name": "XP",
                                                "id": "1350575069113352265"
                                            },
                                            "default": false
                                        }
                                    ],
                                    "placeholder": "Opciones extras",
                                    "min_values": 1,
                                    "max_values": 1,
                                    "disabled": false
                                }
                            ]
                        },

                    ]
                },
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 3,
                            "custom_id": `selectPerfil-${interaction.user.id}-${pjuser._id}`,
                            "options": [
                                {
                                    "label": "Perfil principal",
                                    "value": "perfil",
                                    "description": null,
                                    "emoji": {
                                        "name": "d9056043c1e148e38efd10e4515e33d2",
                                        "id": "1356111301859868823"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Apariencia [Galeria]",
                                    "value": "galeria",
                                    "description": null,
                                    "emoji": {
                                        "name": "EmuNui",
                                        "id": "1370631281028890727"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Historia [Lore]",
                                    "value": "historia",
                                    "description": null,
                                    "emoji": {
                                        "name": "BunnyBook",
                                        "id": "1356111194997395496"
                                    },
                                    "default": false,
                                    "disabled": false
                                },
                                {
                                    "label": "Alma [Núcleo]",
                                    "value": "alma",
                                    "description": null,
                                    "emoji": {
                                        "name": "KrisJojos",
                                        "id": "1350664814414004395"
                                    },
                                    "default": true,
                                    "disabled": false
                                },
                                {
                                    "label": "Mascotas [Nuevo]",
                                    "value": "mascota",
                                    "description": null,
                                    "emoji": {
                                        "name": "pets",
                                        "id": "1356111134758932510"
                                    },
                                    "default": false,
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
            ]

            return interaction.update({ components: soulV2 })
        }


        async function getequipamiento() {
            const tiposEquipamiento = {
                "Arma": { nombre: "Arma", emoji: "🪄" },
                "Armadura": { nombre: "Armadura", emoji: "🧤" },
                "Artefacto": { nombre: "Artefactos", emoji: "💍" }
            };

            if (!soul.dominio.equipo || soul.dominio.equipo.length === 0) {
                return "**🥊 Equipamiento**\n\n" + Object.entries(tiposEquipamiento)
                    .map(([type, info]) => `-# \`[${info.emoji}]\` ${info.nombre} : Sin ${info.nombre.toLowerCase()}]`)
                    .join("\n");
            }

            const Regiones = {};
            soul.dominio.equipo.forEach(equip => {
                if (!Regiones[equip.Region]) Regiones[equip.Region] = [];
                Regiones[equip.Region].push(equip.ID);
            });

            const objetosPorTipo = {};

            for (const region in Regiones) {
                const documentoRegion = await dbobjetos.findOne({ _id: region });

                if (documentoRegion) {
                    const objetos = documentoRegion.Objetos.filter(obj =>
                        Regiones[region].includes(obj.ID)
                    );

                    for (const obj of objetos) {
                        if (Array.isArray(obj.Tipo)) {
                            for (const tipo of obj.Tipo) {
                                if (tiposEquipamiento[tipo] && !objetosPorTipo[tipo]) {
                                    objetosPorTipo[tipo] = obj.Nombre;
                                }
                            }
                        } else if (typeof obj.Tipo === "string") {
                            if (tiposEquipamiento[obj.Tipo] && !objetosPorTipo[obj.Tipo]) {
                                objetosPorTipo[obj.Tipo] = obj.Nombre;
                            }
                        }
                    }
                }
            }

            let resultado = "**🥊 Equipamiento**\n\n";
            for (const [type, info] of Object.entries(tiposEquipamiento)) {
                const nombre = objetosPorTipo[type];
                resultado += `-# \`[${info.emoji}]\` **${info.nombre}**: ${nombre || `Sin ${info.nombre.toLowerCase()}`}\n`;
            }

            console.log("Entregando equipamiento...");
            console.log(objetosPorTipo);

            return resultado.trim();
        }
        function getStats(stats) {
            const nombresLegibles = {
                hpMax: "HP Máx",
                manaMax: "Mana Máx",
                fuerza: "Fuerza",
                resistenciaFisica: "Resistencia Física",
                agilidad: "Agilidad",
                sabiduria: "Sabiduría",
                inteligencia: "Inteligencia",
                resistenciaMagica: "Resistencia Mágica",
                poderElemental: "Poder Elemental",
                percepcion: "Percepción",
                determinacion: "Determinación",
                regeneracion: "Regeneración",
                paradoja: "Paradoja",
                destino: "Destino"
            };



            const clavesMostrar = ["hpMax", "manaMax", "fuerza", "inteligencia", "agilidad", "sabiduria", "inteligencia", "resFisica", "resMagica",
                "sintoniaElemental", "determinación"
            ];

            const clavesMejorar = ["fuerza", "inteligencia", "sabiduria", "agilidad", "inteligencia",
                "sintoniaElemental", "voluntad", "resFisica", "resMagica"
            ];



            const optionsSelects = []


            Object.entries(stats)
                .filter(([key]) => clavesMejorar.includes(key))
                .map(([key, value]) => {
                    optionsSelects.push({
                        "label": `+ 1 ${nombresLegibles[key] || key}`,
                        "value": `stats*${key}`,
                        "description": null,
                        "emoji": null,
                        "defualt": false
                    });
                })

            const selectMenu = [{
                "type": 3,
                "custom_id": `selectPerfil-${interaction.user.id}-${character._id}-extras`,
                "options": optionsSelects,
                "placeholder": "Selecciona un stat para mejorar",
                "min_values": 1,
                "max_values": 1,
                "disabled": false
            }]


            return selectMenu
        }


        function NumRomano(num) {
            const romanos = [
                'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
                'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
                'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV'
            ];
            return romanos[num - 1] || num.toString();
        }
    }
})