const { ChatInputCommandInteraction, Client } = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdbs = db.collection("usuarios_server")
const { messageBuild } = require("../../../handlers/CMDHandler/Rol/Personajes/Configurar personaje");
const { version, versionEc, versionRol } = require("../../../config");
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const {crearStringSelectMenu} = require("../../../utils/constructores/crearComponente")
const { crearCustomId } = require("../../../utils/constructores/customId")
const { puedeMostrarBanner, recortarBannerDiscord } = require("../../../handlers/CMDHandler/Rol/Personajes/Perfil")

// Mismos campos y niveles que la web (Server.js → POST /api/personaje/privacidad).
const CAMPOS_PRIVACIDAD = [
    { campo: "regalos", label: "🎁 Regalos", ayuda: "¿Quién puede enviarte lumens y regalos?" },
    { campo: "invitaciones", label: "📜 Invitaciones", ayuda: "¿Quién puede invitarte a grupos y misiones cooperativas?" },
    { campo: "tablero", label: "🔮 Tablero Mágico", ayuda: "¿Quién puede escribirte en tu cartelera pública?" },
    { campo: "pvp", label: "⚔️ Retos PvP / Duelos", ayuda: "¿Quién puede retarte a combates? (PvP amistosos y duelos automáticos)" },
    // Sin elegir: cariñosos de todos y golpes solo de amigos (config/amistad.js → PRIVACIDAD_INTERACCIONES).
    { campo: "interacciones", label: "🤗 Interacciones", ayuda: "Abrazos, mimos, golpes... Por defecto: los cariñosos de todos y los golpes solo de amigos", porDefecto: true },
    { campo: "verAlma", label: "✨ Ver Alma", ayuda: "¿Quién puede ver la información y atributos de tu alma?" },
    { campo: "amistades", label: "⭐ Amistades Destacadas", ayuda: "¿Quién puede ver tus vínculos en tu perfil?" },
    { campo: "estadisticas", label: "📊 Estadísticas", ayuda: "¿Quién puede ver tus registros de combate y progreso?" },
]
const NIVELES_PRIVACIDAD = [
    { valor: "todos", label: "Todos", emoji: { id: "1401710472302034985", name: "Cinnamoroll_shock" } },
    { valor: "amigos", label: "Solo amigos", emoji: { id: "1401710462084579470", name: "Cinnamoroll_happy" } },
    { valor: "mejores_amigos", label: "Solo mejores amigos", emoji: { id: "1401710462084579470", name: "Cinnamoroll_happy" } },
    // Solo aparece si el personaje tiene compañero (igual que en la web).
    { valor: "companero", label: "Solo compañero", emoji: { id: "1401710483437785148", name: "Cinnamoroll_love" } },
    { valor: "nadie", label: "Nadie", emoji: { id: "1401710448994287736", name: "Cinnamoroll_sleep" } },
]
const POR_DEFECTO = "defecto"
const EMOJI_DEFECTO = { id: "1401710472302034985", name: "Cinnamoroll_shock" }
// Mismo orden que utils/getDataCharacters.js al resolver el personaje activo.
const activoDe = (userdb) => userdb?.usuario?.nix?.personajeActivo ?? userdb?.nix?.personajeActivo
const tieneCompanero = (pj) => Boolean(pj?.social?.compañero ?? pj?.social?.companero)


module.exports = crearStringSelectMenu({
    customId: "configuracion",
    soloAutor: true,
    requirements: {
        character: {obtener: true},
        soul: {obtener: true}, 
        cachepj: {obtener: true}
    },
    optionNames: ["action", "key"],
    
    ejecutar: async({client, interaction, character, soul, cachepj, componentData: {extras}, options: {action}}) => {

        // Selects de privacidad: customId configuracion-<user>-<pj>-priv-<campo>, valor = nivel.
        // Se guarda en social.privacidad, lo mismo que lee evaluarPermisoPrivacidad y
        // escribe la web (POST /api/personaje/privacidad).
        if (extras?.[0] === "priv") {
            const campo = extras[1]
            const def = CAMPOS_PRIVACIDAD.find(c => c.campo === campo)
            const nivel = action
            const valido = NIVELES_PRIVACIDAD.some(n => n.valor === nivel) || (def?.porDefecto && nivel === POR_DEFECTO)
            // El personaje viene del customId: confirmar que es de quien hace clic.
            if (!character || String(character.ownerID) !== interaction.user.id) {
                return interaction.reply({ content: "Este menú es de otro personaje, abre el tuyo con `/rol configuracion` ♡( ◡‿◡ )", flags: ["Ephemeral"] })
            }
            if (!def || !valido) {
                return interaction.reply({ content: "Esa opción ya no es válida, abre el menú otra vez ♡( ◡‿◡ )", flags: ["Ephemeral"] })
            }
            if (nivel === "companero" && !tieneCompanero(character)) {
                return interaction.reply({ content: "Aún no tienes compañero, así que esa opción todavía no está disponible ♡( ◡‿◡ )", flags: ["Ephemeral"] })
            }

            // "Por defecto" (solo Interacciones) borra el campo: el bot usa el valor de cada categoría.
            const update = nivel === POR_DEFECTO
                ? { $unset: { [`social.privacidad.${campo}`]: "" } }
                : { $set: { [`social.privacidad.${campo}`]: nivel } }
            await characters.updateOne({ _id: character._id }, update)

            character.social ??= {}
            character.social.privacidad ??= {}
            if (nivel === POR_DEFECTO) delete character.social.privacidad[campo]
            else character.social.privacidad[campo] = nivel

            await interaction.update({ components: privMessage(character) })
            return;
        }

        // Banner en el perfil de Discord: customId configuracion-<user>-<pj>-banner, valor = mostrar | ocultar.
        // Se guarda por personaje en perfil.mostrarBannerDiscord (lo lee obtenerBannerPerfil en Perfil.js).
        if (extras?.[0] === "banner") {
            if (!character || String(character.ownerID) !== interaction.user.id) {
                return interaction.reply({ content: "Este menú es de otro personaje, abre el tuyo con `/rol configuracion` ♡( ◡‿◡ )", flags: ["Ephemeral"] })
            }
            if (action !== "mostrar" && action !== "ocultar") {
                return interaction.reply({ content: "Esa opción ya no es válida, abre el menú otra vez ♡( ◡‿◡ )", flags: ["Ephemeral"] })
            }
            const puede = await puedeMostrarBanner(interaction.user.id, interaction.client)
            if (!puede && action === "mostrar") {
                return interaction.reply({ content: "Mostrar el banner en Discord es exclusivo para quienes apoyan al servidor con un boost ♡( ◡‿◡ )", flags: ["Ephemeral"] })
            }

            const mostrar = action === "mostrar"
            await characters.updateOne({ _id: character._id }, { $set: { "perfil.mostrarBannerDiscord": mostrar } })
            character.perfil ??= {}
            character.perfil.mostrarBannerDiscord = mostrar

            await interaction.update({ components: bannerMessage(character, puede) })
            return;
        }

        // "Otro Reflejo": customId configuracion-<user>-<pj>-cambiar, valor = _id del personaje elegido.
        if (extras?.[0] === "cambiar") {
            const nuevoId = Number(action)
            const elegido = Number.isFinite(nuevoId)
                ? await characters.findOne({ _id: nuevoId, ownerID: interaction.user.id }, { projection: { _id: 1 } })
                : null
            if (!elegido) {
                return interaction.reply({ content: "No encuentro ese reflejo entre tus personajes, abre el menú otra vez ♡( ◡‿◡ )", flags: ["Ephemeral"] })
            }

            const userdbActual = await userdbs.findOne({ _id: interaction.user.id })
            if (Number(activoDe(userdbActual)) === nuevoId) {
                return interaction.reply({ content: "Ya estás usando ese reflejo ♡( ◡‿◡ )", flags: ["Ephemeral"] })
            }

            // Cambiar de personaje a mitad de un combate o una exploración dejaría la
            // sesión apuntando a un personaje que ya no es el activo.
            const { duelSystem } = require("../../../functions/Duelo/duelManager")
            const transaccionCache = require("../../../utils/cache")
            const explorando = transaccionCache.getUser?.(interaction.user.id)?.explorarID
            if (duelSystem.estaEnCombate(interaction.user.id) || (explorando && transaccionCache.get(explorando))) {
                return interaction.reply({ content: "Ahora mismo tu personaje está ocupado en una aventura. Termínala y luego cambiamos de reflejo ♡( ◡‿◡ )", flags: ["Ephemeral"] })
            }

            // Los dos campos, igual que la web (POST /api/personaje/cambiar-activo):
            // getDataCharacters lee primero usuario.nix.personajeActivo.
            await userdbs.updateOne({ _id: interaction.user.id }, {
                $set: {
                    "nix.personajeActivo": nuevoId,
                    "usuario.nix.personajeActivo": nuevoId,
                }
            })

            const inicioMess = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 10,
                            "content": "**La sincronización ha comenzado... Transfiriendo tu consciencia al alma elegida**"
                        }
                    ]
                }
            ]

            const intermedio = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 12,
                            "items": [
                                {
                                    "media": {
                                        "url": "https://cdn.discordapp.com/attachments/857300864107282462/1401787286684962857/blackswain-1.gif?ex=68918ba5&is=68903a25&hm=eb70077aa1a7e5d72685ab8af4fc7b298d39cb7b9ecfdac051d147ffc66dd22c&"
                                    },
                                    "description": null,
                                    "spoiler": false
                                }
                            ]
                        }
                    ]
                }
            ]

            const finalSesion = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 10,
                            "content": "**El vínculo se ha transferido. Un nuevo par de ojos se abren a la voluntad de tu alma.**"
                        },
                        {
                            "type": 12,
                            "items": [
                                {
                                    "media": {
                                        "url": "https://i.pinimg.com/originals/48/72/68/4872684130ed1ab447b6ec065562c278.gif"
                                    },
                                    "description": null,
                                    "spoiler": false
                                }
                            ]
                        }
                    ]
                }
            ]

            await interaction.update({ components: inicioMess })
            setTimeout(() => interaction.editReply({ components: intermedio }).catch(() => { }), 4500)
            setTimeout(() => interaction.editReply({ components: finalSesion }).catch(() => { }), 15500)

            setTimeout(() => interaction.deleteReply().catch(() => { }), 21000)
            return;
        }

        const userdb = await userdbs.findOne({ _id: interaction.user.id })

        switch (action) {
            case "personaje":

                const message = await messageBuild(character, userdb, interaction, null)

                await interaction.reply({ components: message, flags: ["IsComponentsV2", "SuppressNotifications"] })
                break;

            case "privacidad":
                const messagePriv = privMessage(character)

                await interaction.update({ components: messagePriv })
                break;
            case "banner": {
                if (!character) {
                    return interaction.reply({ content: "Necesitas un personaje para configurar su banner ♡( ◡‿◡ )", flags: ["Ephemeral"] })
                }
                const puede = await puedeMostrarBanner(interaction.user.id, interaction.client)
                await interaction.update({ components: bannerMessage(character, puede) })
                break;
            }
            case "switch":
                const messageCharacter = await switchCharacter(userdb)
                await interaction.update({ components: messageCharacter })
                break;
            default:
                break;
        }


        function privMessage(character) {
            const priv = character.social?.privacidad || {}
            const niveles = NIVELES_PRIVACIDAD.filter(n => n.valor !== "companero" || tieneCompanero(character))

            const filas = CAMPOS_PRIVACIDAD.flatMap(def => {
                const actual = priv[def.campo] ?? (def.porDefecto ? POR_DEFECTO : "todos")
                const opciones = (def.porDefecto ? [{ valor: POR_DEFECTO, label: "Por defecto", emoji: EMOJI_DEFECTO }] : []).concat(niveles)
                return [
                    { type: 10, content: `**${def.label}**\n-# ${def.ayuda}` },
                    {
                        type: 1,
                        components: [{
                            type: 3,
                            custom_id: crearCustomId({ action: "configuracion", userId: interaction.user.id, characterId: character._id, extras: ["priv", def.campo] }),
                            options: opciones.map(n => ({ label: n.label, value: n.valor, description: null, emoji: n.emoji, default: n.valor === actual })),
                            placeholder: "Sin configurar",
                            min_values: 1,
                            max_values: 1,
                            disabled: false,
                        }],
                    },
                ]
            })

            return [{
                type: 17,
                accent_color: null,
                spoiler: false,
                components: [
                    {
                        type: 9,
                        accessory: { type: 11, media: { url: "https://i.pinimg.com/1200x/55/cb/a5/55cba54b6d1c1cc7f8cefbf11f33ac2d.jpg" }, description: null, spoiler: false },
                        components: [
                            { type: 10, content: "# Configuración de privacidad" },
                            { type: 10, content: `-# Personaje: **${character.perfil?.Nombre ?? "—"}**\n-# Solo aplica dentro del sistema del bot; no afecta el text rol.\n-# Las listas de permitidos y bloqueados se editan desde la web.` },
                        ],
                    },
                    { type: 14, divider: true, spacing: 1 },
                    ...filas,
                    { type: 14, divider: true, spacing: 1 },
                    { type: 10, content: `Sistema de rol | Version: ${versionRol}` },
                ],
            }]
        }

        function bannerMessage(character, puede) {
            const recortado = recortarBannerDiscord(character.perfil?.bannerURL, character.perfil?.bannerDiscord)
            const activo = character.perfil?.mostrarBannerDiscord === true
            let estado
            if (!puede) estado = "-# `🔒` Exclusivo para Server Boosters."
            else if (!recortado) estado = "-# `⚠️` Aún no tienes banner. Súbelo desde tu perfil en el dashboard (click sobre el banner)."
            else estado = activo ? "-# `✅` Tu banner se muestra en `/rol perfil`." : "-# `💤` Tu banner está oculto en Discord."

            return [{
                type: 17,
                accent_color: null,
                spoiler: false,
                components: [
                    { type: 10, content: "# Banner del perfil" },
                    { type: 10, content: `-# Personaje: **${character.perfil?.Nombre ?? "—"}**
-# Se usa el mismo banner que configuras en el dashboard, recortado como franja para Discord.\n-# El recorte, el grosor y el difuminado se ajustan en el dashboard → Configuración.
${estado}` },
                    ...(recortado ? [{ type: 12, items: [{ media: { url: recortado }, description: "Vista previa del banner", spoiler: false }] }] : []),
                    { type: 14, divider: true, spacing: 1 },
                    { type: 10, content: "**Mostrar banner en el perfil de Discord**" },
                    {
                        type: 1,
                        components: [{
                            type: 3,
                            custom_id: crearCustomId({ action: "configuracion", userId: interaction.user.id, characterId: character._id, extras: ["banner"] }),
                            options: [
                                { label: "Mostrar", value: "mostrar", description: null, emoji: null, default: activo },
                                { label: "Ocultar", value: "ocultar", description: null, emoji: null, default: !activo },
                            ],
                            placeholder: "Sin configurar",
                            min_values: 1,
                            max_values: 1,
                            disabled: !puede,
                        }],
                    },
                    { type: 14, divider: true, spacing: 1 },
                    { type: 10, content: `Sistema de rol | Version: ${versionRol}` },
                ],
            }]
        }

        async function switchCharacter(dataUser) {
            const listaDePersonajes = await characters.find({ ownerID: interaction.user.id }).toArray()

            const allCharacters = []
            const selectCharacter = []


            for (const ch of listaDePersonajes) {
                const activo = Number(activoDe(dataUser)) === Number(ch._id);
                const soul = await souls.findOne({ _id: ch._id });

                const apodoFormateado = ch.perfil.apodo ? `[${ch.perfil.apodo}]` : "";

                allCharacters.push({
                    "type": 9,
                    "accessory": {
                        "type": 11,
                        "media": {
                            "url": `${ch.perfil.avatarURL}`
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# ${ch.perfil.Nombre} ${apodoFormateado} - Lv: ${soul ? soul.sendero.nivel : "0"}
                            \n\n- -# ID: ${ch._id} \n- -# Estado: ${activo ? "Activo" : "Inactivo"} \n- -# Rol: ${ch.estado.Rol}
                            \n- -# Lumens: ${ch.economia.Lumens}\n- -# Fecha de creación: <t:${ch.metadata.fechaCreacion}:R>`
                        }
                    ]
                });

                selectCharacter.push({
                    "label": `${ch.perfil.Nombre} - Lv: ${soul ? soul.sendero.nivel : "0"}`,
                    "value": `${ch._id}`,
                    "description": null,
                    "emoji": null,
                    "default": activo
                });
            }

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
                                    "url": "https://i.pinimg.com/736x/f6/4f/43/f64f43b81a346c2be4cdf395efa26716.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Selecciona a tu personaje"
                                },
                                {
                                    "type": 10,
                                    "content": "-# Esta funcion esta en fase de desarrollo."
                                }
                            ]
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        ...allCharacters,
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
                                    "custom_id": crearCustomId({ action: "configuracion", userId: interaction.user.id, extras: ["cambiar"] }),
                                    "options": selectCharacter,
                                    "placeholder": "Selecciona tu personaje",
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
                            "type": 10,
                            "content": `Sistema de personaje | Version: ${versionRol}`
                        }
                    ]
                }
            ]

            return message
        }
    }
})