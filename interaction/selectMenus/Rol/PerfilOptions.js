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
const { construirAlmaMain, construirAlmaStats, construirAlmaEquipamiento, filaNavegacionPerfil } = require("../../../data/UI_ComponentsV2/menuAlma")

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
                await stats(character)
                break;
            case "equipamiento":
                await equipamiento(character)
                break;
            case "heraldo":
                await heraldo(character)
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

        /** Fila con el selector principal del perfil (debajo de las vistas del alma) */
        function filaNavegacion(pjuser) {
            return filaNavegacionPerfil(interaction.user.id, pjuser._id)
        }

        /** El alma solo la ve su dueño y solo si ya despertó */
        function puedeVerAlma(pjuser) {
            if (interaction.user.id !== pjuser.ownerID) {
                interaction.reply({ content: "No puedes revisar el alma de este personaje ＞﹏＜", flags: ["Ephemeral"] })
                return false
            }
            if (!soul) {
                interaction.reply({ content: "Este personaje aún no despierta su poder (´･ω･`)?", flags: ["Ephemeral"] })
                return false
            }
            return true
        }

        async function stats(pjuser) {
            if (!puedeVerAlma(pjuser)) return
            const vista = construirAlmaStats({ character: pjuser, soul, userId: interaction.user.id, filaNavegacion: filaNavegacion(pjuser) })
            return interaction.update({ components: vista })
        }

        async function alma(pjuser) {
            if (!puedeVerAlma(pjuser)) return
            const vista = construirAlmaMain({ character: pjuser, soul, userId: interaction.user.id, filaNavegacion: filaNavegacion(pjuser) })
            return interaction.update({ components: vista })
        }

        async function equipamiento(pjuser) {
            if (!puedeVerAlma(pjuser)) return
            const vista = construirAlmaEquipamiento({
                character: pjuser,
                userId: interaction.user.id,
                textoEquipamiento: await getequipamiento(),
                filaNavegacion: filaNavegacion(pjuser)
            })
            return interaction.update({ components: vista })
        }

        async function heraldo(pjuser) {
            if (!puedeVerAlma(pjuser)) return
            const h = soul.sendero?.heraldo
            const nombre = h?.Nombre || h?.nombre || (typeof h === "string" ? h : null)
            return interaction.reply({
                content: nombre
                    ? `\`[🌠]\` Tu alma sigue al Heraldo **${nombre}**.`
                    : "`[🌠]` Tu alma aún no ha elegido un Heraldo. Ese camino se revelará más adelante...",
                flags: ["Ephemeral"]
            })
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