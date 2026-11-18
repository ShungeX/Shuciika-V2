const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed, StringSelectMenuBuilder } = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const version = require("../../../config");
const dbobjetos = db2.collection("Objetos_globales")

const premium = require("../../../functions/Premium/premium")
const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente")
const { construirPerfilV2, obtenerBannerPerfil, obtenerApoyoPerfil } = require("../../../handlers/CMDHandler/Rol/Personajes/Perfil")
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
                await galeria(character)
                break;
            case "historia":
                historia(character)
                break;
            case "alma":
                await alma(character)
                break;
            case "mascota":
                await mascotas(character)
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


        async function perfil(pjuser) {
            const bannerURL = await obtenerBannerPerfil(pjuser, interaction.client);
            const apoyo = await obtenerApoyoPerfil(pjuser, interaction.client);
            const perfilV2 = construirPerfilV2(pjuser, userId || interaction.user.id, bannerURL, apoyo);
            return interaction.update({ components: perfilV2 });
        }

        async function galeria(pjuser) {
            const galeriaItems = pjuser?.social?.galeria;
            if (!galeriaItems || !Array.isArray(galeriaItems) || galeriaItems.length === 0) {
                return interaction.reply({
                    content: "Aún no presumes a tu personaje. Puedes editar este apartado desde el dashboard",
                    flags: ["Ephemeral"]
                });
            }

            // Galería ampliada (premium): 10 imágenes; sin premium se ven 3 y las demás quedan ocultas, no borradas
            // Beneficio en rol: solo en los personajes elegidos del dueño (máx. 2)
            const usuarioServer = await db.collection("usuarios_server").findOne({ _id: String(pjuser.ownerID) }, { projection: { roles: 1, isBooster: 1, nix: 1, apoyo: 1 } }).catch(() => null)
            const dueñoPremium = await premium.esPremiumEnPersonaje(interaction.client, pjuser.ownerID, pjuser._id, { usuarioServer })
            const limite = dueñoPremium ? premium.LIMITES.galeriaPremium : premium.LIMITES.galeriaLibre
            const imagenes = galeriaItems.filter(img => img?.url).slice(0, limite);
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
            // Las mascotas son del personaje, no del usuario: solo se cuidan con ese personaje activo.
            // Viendo el perfil de otro personaje (propio o ajeno) el panel es de solo lectura.
            const servicioMascotas = require("../../../functions/Mascotas/servicio")
            const pantallasMascotas = require("../../../functions/Mascotas/pantallas")
            const activoId = interaction.user.id === pjuser.ownerID ? await servicioMascotas.idPersonajeActivo(interaction.user.id) : null
            const puedeCuidar = activoId !== null && String(activoId) === String(pjuser._id)

            const pantalla = await pantallasMascotas.mascotas({ userId: interaction.user.id, character: pjuser, puedeCuidar, origen: "p" })
            await interaction.update({ components: pantalla.components, allowedMentions: { parse: [] } })
            return pantallasMascotas.anunciar(interaction, pantalla)
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
            // Equipo + panel del contenedor (Almas Desafinadas): functions/Contenedores/vista.js
            const { construirVistaEquipamiento } = require("../../../functions/Contenedores/vista")
            const vista = construirVistaEquipamiento({ character: pjuser, soul, userId: interaction.user.id })
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