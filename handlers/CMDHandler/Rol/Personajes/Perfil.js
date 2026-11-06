const { EmbedBuilder, ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const userdbs = db.collection("usuarios_server")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const version = require("../../../../config")
const { crearCustomId } = require("../../../../utils/constructores/customId")


module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("perfil")
        .setDescription("Muestra tu perfil de personaje o el de otro usuario")
        .addUserOption(o =>
            o
                .setName("usuario")
                .setDescription("Selecciona a un usuario")
        )
        .addIntegerOption(o =>
            o
                .setName("personaje")
                .setDescription("Ingresa la ID del personaje")
                .setAutocomplete(true)
        ),
    requirements: {
        character: { obtener: true, required: false },
        soul: { obtener: true, required: false },
        cachepj: { obtener: true, required: false},
    },
    isDevOnly: false,
    enMantenimiento: false,


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async (client, interaction, { character, soul, cachepj }) => {
        let Idfind = interaction.options.getInteger("personaje")
        var user = interaction.options.getUser("usuario")
        var estado = ""
        var statusMsg;

        if (Idfind || user) {
            let personaje;

            if(user) {
                const userdb = await userdbs.findOne({_id: user.id})
                
                if(userdb) {
                    Idfind = userdb?.nix?.personajeActivo
                }else {
                    Idfind = null
                }
            }

            personaje = await characters.findOne({
                $or: [
                    { _id: Idfind },
                ]
            })

            if (!personaje) {
                return interaction.reply({ content: "El usuario que mencionaste no tiene un personaje registrado (╥﹏╥)\n-# ¿O quizás fue la ID?", flags: ["Ephemeral"] })
            }

            user = interaction.guild.members.resolve(personaje.ownerID)
            console.log("verificación por usuario")
            perfil(personaje)
        } else if (cachepj) {
            if (cachepj?.waiting) {
                estado = "En espera"
                statusMsg = "Esto significa que aún no ha sido verificada. espera pacientemente (∪｡∪)｡｡｡zzZ"
            } else {
                estado = "No enviada"
                statusMsg = "Parece que aún estás definiendo tu ficha. para enviar tu ficha y continuar el proceso, usa el comando `/rol crear_ficha` (∪｡∪)｡｡｡zzZ"
            }

            const noverif = new EmbedBuilder()
                .setAuthor({ name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setTitle(`${cachepj?.nombre} ${cachepj?.apodo ? `[${cachepj?.apodo}]` : ''}`)
                .setDescription(cachepj.historia ? cachepj.historia : "Sin Historia (¿In rol?)")
                .addFields(
                    { name: "Informacion", value: "`📑` **Apodo: ** " + (cachepj?.apodo || "Sin apodo") + "\n`🎎` **Sexo biológico: **" + (cachepj?.sexo ? `${cachepj.sexo}${cachepj?.pronombres ? ` (${cachepj.pronombres})` : ''}` : "No especificado") + "\n`🍭` **Edad: **" + (cachepj?.edad || "No especificada") + "\n`🛫` **C/Org: **" + (cachepj?.ciudadOrg || "Desconocida"), inline: true },
                    { name: "Extra", value: "`🎂` **Cumpleaños **" + (cachepj?.cumpleaños || (cachepj?.cumpleDia && cachepj?.cumpleMes ? `${String(cachepj.cumpleDia).padStart(2, '0')}/${String(cachepj.cumpleMes).padStart(2, '0')}` : "** **")) + "\n`👑` **Linaje Familiar **" + cachepj?.familia + "\n`❔`** Estado:** " + estado, inline: true },
                    { name: "🎭 Personalidad", value: cachepj?.personalidad, inline: false },
                    { name: "🎮 Especialidad", value: (cachepj?.especialidad || "No definido"), inline: false }
                )
                .setThumbnail(`${cachepj.avatarURL ? cachepj.avatarURL : "https://cdn.discordapp.com/attachments/665423320765693982/905282026133938206/unknown.png"}`)
                .setColor(`Red`)
            return interaction.reply({ content: `**Vista previa de tu personaje.**\n-# ${statusMsg}`, embeds: [noverif] })
        } else {
            if (!character) {
                await interaction.reply({content: "No tienes un **personaje** o **ficha pendiente** para usar esto.╮(￣～￣)╭\n" + 
                    "-# Puedes usar el comando **`/rol crear_ficha`** para empezar.\n-# tambien puedes buscar un personaje por usuario o ID", flags: ["Ephemeral"]})
                return;
            }

            perfil(character)


        }

        async function perfil(pjuser) {
            const bannerURL = await obtenerBannerPerfil(pjuser, interaction.client);
            const perfilV2 = construirPerfilV2(pjuser, interaction.user.id, bannerURL);
            await interaction.reply({ components: perfilV2, flags: ["IsComponentsV2", "SuppressNotifications"], withResponse: true });
            return;
        }

    },
    construirPerfilV2,
    obtenerBannerPerfil,
    recortarBannerDiscord,
    ajustesBannerDiscord,
    puedeMostrarBanner
}

// Quienes pueden mostrar el banner del dashboard en el perfil de Discord, además de los boosters
const IDS_BANNER_DISCORD = ["1566978771922329665", "665421882694041630", "811049909099692073"];
const GUILD_ID_BANNER = "716342375303217285";

// Grosor de la franja (ancho:alto). 6 = delgado (por defecto), 4 = medio, 3 = alto
const ASPECTOS_BANNER_DISCORD = [6, 4, 3];
const ANCHO_BANNER_DISCORD = 1200;

/**
 * Normaliza perfil.bannerDiscord = { url, x, y, w, h, aspecto, difuminado }.
 * El recorte manual (x, y, w, h en píxeles de la imagen original) solo vale para el banner con el que se hizo:
 * si se sube otro banner (cambia la URL/versión) se vuelve al recorte automático.
 */
function ajustesBannerDiscord(bannerURL, ajustes) {
    const a = ajustes && typeof ajustes === "object" ? ajustes : {};
    const aspecto = ASPECTOS_BANNER_DISCORD.includes(Number(a.aspecto)) ? Number(a.aspecto) : 6;
    const num = (v) => Number.isFinite(Number(v)) ? Math.round(Number(v)) : NaN;
    const [x, y, w, h] = [num(a.x), num(a.y), num(a.w), num(a.h)];
    const recorteValido = a.url === bannerURL && x >= 0 && y >= 0 && w > 0 && h > 0;
    return {
        aspecto,
        difuminado: a.difuminado === true,
        recorte: recorteValido ? { x, y, w, h } : null
    };
}

/**
 * Recorta el banner del dashboard (Cloudinary) a una franja ancha para el perfil de Discord, con el recorte,
 * grosor y difuminado elegidos en el dashboard. Devuelve null si no es una URL de Cloudinary utilizable.
 */
function recortarBannerDiscord(bannerURL, ajustes) {
    if (!bannerURL || typeof bannerURL !== "string") return null;
    if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(bannerURL)) return null;

    const { aspecto, difuminado, recorte } = ajustesBannerDiscord(bannerURL, ajustes);
    const alto = Math.round(ANCHO_BANNER_DISCORD / aspecto);
    const pasos = [];
    if (recorte) {
        pasos.push(`c_crop,x_${recorte.x},y_${recorte.y},w_${recorte.w},h_${recorte.h}`);
        pasos.push(`c_scale,w_${ANCHO_BANNER_DISCORD},h_${alto}`);
    } else {
        // Automático: g_auto centra el recorte en la zona más relevante de la imagen
        pasos.push(`c_fill,g_auto,w_${ANCHO_BANNER_DISCORD},h_${alto}`);
    }
    if (difuminado) {
        // Desvanece la mitad inferior a transparente: en Discord se funde con el fondo (tema claro u oscuro).
        // f_webp explícito: f_auto entrega JPEG al proxy de Discord y se perdería la transparencia.
        pasos.push("e_gradient_fade,y_-0.5", "f_webp,q_auto");
    } else {
        pasos.push("q_auto,f_auto");
    }
    return bannerURL.replace("/upload/", `/upload/${pasos.join("/")}/`);
}

/** Booster del servidor (Discord o marca en usuarios_server) o ID autorizada */
async function puedeMostrarBanner(ownerID, client) {
    if (!ownerID) return false;
    const id = String(ownerID);
    if (IDS_BANNER_DISCORD.includes(id)) return true;

    const guild = client?.guilds?.cache?.get(GUILD_ID_BANNER);
    if (guild) {
        const member = guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
        if (member?.premiumSince) return true;
    }

    const userdb = await userdbs.findOne({ _id: id }, { projection: { roles: 1, isBooster: 1 } }).catch(() => null);
    return Boolean(userdb?.isBooster || (Array.isArray(userdb?.roles) && userdb.roles.includes("booster")));
}

/**
 * URL del banner recortado a mostrar en el perfil de Discord, o null si el dueño no puede/no quiere mostrarlo.
 * Se activa desde /rol configuracion → "Mostrar banner en el perfil de Discord" (perfil.mostrarBannerDiscord).
 */
async function obtenerBannerPerfil(pjuser, client) {
    try {
        if (!pjuser || pjuser.perfil?.mostrarBannerDiscord !== true) return null;
        const recortado = recortarBannerDiscord(pjuser.perfil?.bannerURL, pjuser.perfil?.bannerDiscord);
        if (!recortado) return null;
        return (await puedeMostrarBanner(pjuser.ownerID, client)) ? recortado : null;
    } catch (err) {
        console.warn("[Perfil] No se pudo resolver el banner:", err?.message || err);
        return null;
    }
}

function construirPerfilV2(pjuser, viewerUserId, bannerURL = null) {
    if (!pjuser) return [];
    const perfil = pjuser.perfil || {};
    const userId = viewerUserId || pjuser.ownerID;

    const descripcion = perfil.Descripcion ? perfil.Descripcion : "*Sin descripcion*";
    const reputacion = pjuser?.estado?.Reputacion ? pjuser.estado.Reputacion : "0";
    const grado = pjuser?.estado?.DesmpAcademico?.Grado ? pjuser.estado.DesmpAcademico.Grado : "Aún no calculado";
    const rawAvatar = perfil.avatarURL || "https://res.cloudinary.com/dn1cubayf/image/upload/q_auto,f_auto,w_480,h_480,c_fill/v1753322359/Rol/Avatars/665421882694041630_AvatarRol.jpg";
    const urlavatar = rawAvatar.includes('/upload/')
        ? rawAvatar.replace('/upload/', '/upload/q_auto,f_auto,w_480,h_480,c_fill/')
        : rawAvatar;

    return [
        {
            "type": 17,
            "accent_color": null,
            "spoiler": false,
            "components": [
                ...(bannerURL ? [{
                    "type": 12,
                    "items": [{ "media": { "url": bannerURL }, "description": null, "spoiler": false }]
                }] : []),
                {
                    "type": 9,
                    "accessory": {
                        "type": 11,
                        "media": {
                            "url": urlavatar
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# ${perfil.Nombre || 'Personaje'}${perfil?.Apodo ? ` | ${perfil.Apodo}` : ""}`
                        },
                        {
                            "type": 10,
                            "content": descripcion + "\n\n-# *`Lumens:`* " + (pjuser?.economia?.Lumens ?? 0) + "\n-# *`Reputacion:`* " + reputacion + "\n-# *`Grado:`* " + grado
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
                        "label": "Expandir",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": crearCustomId({
                            action: "perfil_options",
                            userId: userId,
                            characterId: pjuser._id,
                            extras: ["expand"]
                        })
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": "**Información personal:**" + "\n\n-# `🎎` *Sexo:* " + `${`${perfil.Sexo || 'No especificado'} ${perfil.Pronombres ? `(${perfil.Pronombres})` : ''}` || "** **"}` +
                                "\n-# `🍭` *Edad:* " + (perfil.Edad || 'No especificada') + "\n-# `🎂` *Cumpleaños:* " + (perfil.Cumpleaños || (perfil.cumpleDia && perfil.cumpleMes ? `${String(perfil.cumpleDia).padStart(2, '0')}/${String(perfil.cumpleMes).padStart(2, '0')}` : "** **")) +
                                "\n-# `🎭` *Personalidad:* " + (perfil.Personalidad || 'Sin personalidad definida') + "\n-# `🛫` *Ciudad de origen:* " + (perfil.CiudadOrg || 'Desconocida')
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
                    "content": "**Medallas:**\n-# " + `${pjuser.social?.Medallas?.length > 0 ? pjuser.social.Medallas.join("\n") : "Sin medallas"}`
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
                            "custom_id": crearCustomId({
                                action: "selectPerfil",
                                userId: userId,
                                characterId: pjuser._id
                            }),
                            "options": [
                                {
                                    "label": "Perfil principal",
                                    "value": "perfil",
                                    "description": null,
                                    "emoji": {
                                        name: "d9056043c1e148e38efd10e4515e33d2",
                                        id: "1356111301859868823"
                                    },
                                    "default": true,
                                    "disabled": false
                                },
                                {
                                    "label": "Apariencia [Galeria]",
                                    "value": "galeria",
                                    "description": null,
                                    "emoji": {
                                        name: "EmuNui",
                                        id: "1370631281028890727"
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
                {
                    "type": 10,
                    "content": "-# Personaje de: " + `<@!${pjuser.ownerID}>\n` + `-# Sistema de personaje | v1.5`
                }
            ]
        }
    ];
}