const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente");
const { crearCustomId } = require("../../../utils/constructores/customId");
const clientdb = require("../../../Server");
const db2 = clientdb.db("Rol_db");
const Cachedb = db2.collection("CachePJ");

const MAPA_CAMPOS = {
    "1": { id: "nombre", label: "Nombre" },
    "2": { id: "apodo", label: "Apodo" },
    "3": { id: "ciudadOrg", label: "Ciudad de Origen" },
    "4": { id: "especialidad", label: "Especialidades" },
    "5": { id: "estatura", label: "Estatura" },
    "6": { id: "peso", label: "Peso" },
    "7": { id: "avatarURL", label: "Foto de perfil" },
    "8": { id: "edad", label: "Edad" },
    "9": { id: "cumpleaños", label: "Cumpleaños" },
    "10": { id: "familia", label: "Linaje Familiar" },
    "11": { id: "personalidad", label: "Personalidad" },
    "12": { id: "historia", label: "Historia" },
    // Mapeo por clave directa
    "nombre": { id: "nombre", label: "Nombre" },
    "apodo": { id: "apodo", label: "Apodo" },
    "ciudadorg": { id: "ciudadOrg", label: "Ciudad de Origen" },
    "especialidad": { id: "especialidad", label: "Especialidades" },
    "especialidades": { id: "especialidad", label: "Especialidades" },
    "estatura": { id: "estatura", label: "Estatura" },
    "peso": { id: "peso", label: "Peso" },
    "avatarurl": { id: "avatarURL", label: "Foto de perfil" },
    "foto": { id: "avatarURL", label: "Foto de perfil" },
    "edad": { id: "edad", label: "Edad" },
    "cumpleaños": { id: "cumpleaños", label: "Cumpleaños" },
    "cumple": { id: "cumpleaños", label: "Cumpleaños" },
    "familia": { id: "familia", label: "Linaje Familiar" },
    "personalidad": { id: "personalidad", label: "Personalidad" },
    "historia": { id: "historia", label: "Historia" }
};

/**
 * Construye el ComponenteV2 que se enviará al hilo del foro con las correcciones requeridas.
 *
 * @param {Object} pj - Documento del personaje en CachePJ
 * @param {Array<Object>} correcciones - Lista de correcciones [{ campo, etiqueta, motivo }]
 * @returns {Array<Object>} ComponenteV2
 */
function construirMensajeCorreccionesHilo(pj, correcciones = []) {
    const userId = pj?._id || "";
    const components = [
        {
            type: 9,
            accessory: {
                type: 11,
                media: {
                    url: "https://i.pinimg.com/1200x/9b/7c/f5/9b7cf574cf3654894d4a8ab06f2e43ae.jpg",
                    proxy_url: "https://i.pinimg.com/1200x/9b/7c/f5/9b7cf574cf3654894d4a8ab06f2e43ae.jpg"
                },
                description: null,
                spoiler: false
            },
            components: [
                {
                    type: 10,
                    content: `# Se necesitan correcciones en tu ficha\nHola <@!${userId}>, tu ficha ha sido revisada por el equipo de administración y se han detectado algunos detalles que deben ser corregidos antes de poder ser aceptada. Por favor, revisa los puntos señalados a continuación y actualiza tu ficha.`
                }
            ]
        }
    ];

    correcciones.forEach(c => {
        components.push({
            type: 14,
            divider: true,
            spacing: 1
        });
        components.push({
            type: 10,
            content: `### ${c.etiqueta || c.campo || "Campo"}\n-# Motivo: ${c.motivo || "Sin motivo especificado"}`
        });
    });

    components.push({
        type: 10,
        content: "-# Para corregir estos errores, usa el comando `/rol configuración` y selecciona **Editar personaje**, posterior a esto vuelve a mandar tu ficha para revisión. Si tienes alguna duda, puedes consultar con un miembro del equipo o abrir un ticket de soporte en <#1319812744035438642>."
    });

    return [
        {
            type: 17,
            accent_color: 16759611,
            spoiler: false,
            components
        }
    ];
}

/**
 * Construye el ComponenteV2 para visualizar el detalle de una ficha seleccionada.
 *
 * @param {Object} pj - Documento del personaje de CachePJ
 * @param {string} userId - ID de Discord del staff que está revisando
 * @returns {Array<Object>} ComponenteV2
 */
function construirDetalleFicha(pj, userId) {
    const estadoRaw = pj?.status?.estado || "Pendiente";
    const estadoNormalizado = String(estadoRaw).toLowerCase().replace(/\s+/g, "_");
    const botonVerificarDisabled = estadoNormalizado === "solicita_cambio" || estadoNormalizado === "solicitacambio";

    const correcciones = Array.isArray(pj?.correcciones) ? pj.correcciones : [];
    const tieneCorregir = (id) => {
        const idLower = String(id || '').toLowerCase();
        return correcciones.some(c => {
            const cLower = String(c.campo || '').toLowerCase();
            return cLower === idLower || (MAPA_CAMPOS[cLower] && MAPA_CAMPOS[cLower].id.toLowerCase() === idLower);
        });
    };
    const tagCorregir = (id) => tieneCorregir(id) ? " `[Corregir]`" : "";

    const tagNombre = tagCorregir("nombre");
    const tagApodo = tagCorregir("apodo");
    const nombreApodo = `${pj?.nombre || "Desconocido"}${tagNombre}${pj?.apodo ? ` [${pj.apodo}]` : ""}${tagApodo}`;
    const hilo = pj?.hiloId ? `<#${pj.hiloId}>` : "No disponible";

    const tagFoto = (tieneCorregir("avatarURL") || tieneCorregir("foto")) ? "\n-# ⚠️ **Foto de perfil:** `[Corregir]`" : "";

    let resumenCorrecciones = "";
    if (correcciones.length > 0) {
        resumenCorrecciones = `\n\n-# **⚠️ Correcciones pendientes (${correcciones.length}):**\n` +
            correcciones.map(c => `-# • **${c.etiqueta || c.campo}:** ${c.motivo}`).join("\n");
    }

    const cabeceraTexto = (
        `-# **Ficha Seleccionada:** ${nombreApodo}\n` +
        `-# **Usuario:** <@!${pj?._id}>\n` +
        `-# **Estado:** \`${estadoRaw}\`\n` +
        `-# **Hilo de revisión:** ${hilo}` +
        `\n\n-# **Motivo:** ${pj?.status?.motivo || "No disponible"}` +
        tagFoto +
        resumenCorrecciones
    );

    const sexoPronombres = `${pj?.sexo || "** **"} ${pj?.pronombres ? `(${pj.pronombres})` : ""}`.trim() || "** **";
    const cumple = pj?.cumpleaños || (pj?.cumpleDia && pj?.cumpleMes ? `${String(pj.cumpleDia).padStart(2, '0')}/${String(pj.cumpleMes).padStart(2, '0')}` : "** **");
    const estatura = pj?.estatura ? `${pj.estatura}cm` : "** **";
    const peso = pj?.peso ? `${pj.peso}kg` : "** **";

    let infoTexto = (
        "## Información:\n\n" +
        `-# \`🎎\` **Sexo Biológico:** ${sexoPronombres}${tagCorregir("sexo")}\n` +
        `-# \`🍭\` **Edad:** ${pj?.edad || "** **"}${tagCorregir("edad")}\n` +
        `-# \`🎂\` **Cumple:** ${cumple}${tagCorregir("cumpleaños")}\n` +
        `-# \`🛫\` **C/Org:** ${pj?.ciudadOrg || "** **"}${tagCorregir("ciudadOrg")}\n` +
        `-# \`👑\` **Linaje Familiar:** ${pj?.familia || "** **"}${tagCorregir("familia")}\n` +
        `-# \`🎭\` **Personalidad:** ${pj?.personalidad || "** **"}${tagCorregir("personalidad")}\n` +
        `-# \`🏈\` **Especialidades:** ${pj?.especialidad || "** **"}${tagCorregir("especialidad")}\n\n` +
        `-# \`📏\` **Estatura:** ${estatura}${tagCorregir("estatura")}\n` +
        `-# \`🪨\` **Peso:** ${peso}${tagCorregir("peso")}`
    );

    if (tieneCorregir("historia")) {
        infoTexto += `\n-# \`📜\` **Historia:** \`[Corregir]\``;
    }

    const avatarUrl = pj?.avatarURL || "https://i.pinimg.com/736x/98/73/cd/9873cda69599c3949f70a1e66977856c.jpg";

    return [
        {
            type: 17,
            accent_color: 13075967,
            spoiler: false,
            components: [
                {
                    type: 9,
                    accessory: {
                        type: 11,
                        media: {
                            url: avatarUrl,
                        },
                        description: null,
                        spoiler: false
                    },
                    components: [
                        {
                            type: 10,
                            content: "# Visualizando Ficha"
                        },
                        {
                            type: 10,
                            content: cabeceraTexto
                        }
                    ]
                },
                {
                    type: 14,
                    divider: true,
                    spacing: 1
                },
                {
                    type: 9,
                    accessory: {
                        type: 2,
                        style: 2,
                        label: "Corregir Info.",
                        emoji: null,
                        disabled: false,
                        custom_id: crearCustomId({
                            action: "verificar_ficha",
                            userId: userId,
                            characterId: pj?._id,
                            extras: ["corregir_info", String(pj?._id)]
                        })
                    },
                    components: [
                        {
                            type: 10,
                            content: infoTexto
                        }
                    ]
                },
                {
                    type: 14,
                    divider: true,
                    spacing: 1
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 3,
                            label: "Verificar",
                            emoji: null,
                            disabled: botonVerificarDisabled,
                            custom_id: crearCustomId({
                                action: "verificar_ficha",
                                userId: userId,
                                characterId: pj?._id,
                                extras: ["verificar", String(pj?._id)]
                            })
                        },
                        {
                            type: 2,
                            style: 4,
                            label: "Rechazar/Eliminar",
                            emoji: null,
                            disabled: false,
                            custom_id: crearCustomId({
                                action: "verificar_ficha",
                                userId: userId,
                                characterId: pj?._id,
                                extras: ["rechazar", String(pj?._id)]
                            })
                        },
                        {
                            type: 2,
                            style: 2,
                            label: "Regresar al menu",
                            emoji: null,
                            disabled: false,
                            custom_id: crearCustomId({
                                action: "verificar_ficha",
                                userId: userId,
                                characterId: pj?._id,
                                extras: ["regresar_menu", "1"]
                            })
                        }
                    ]
                }
            ]
        }
    ];
}

module.exports = crearStringSelectMenu({
    customId: "verificar_ficha",
    soloAutor: true,

    ejecutar: async ({ client, interaction }) => {
        const userIdSeleccionado = interaction.values?.[0];
        if (!userIdSeleccionado || userIdSeleccionado === "ninguna") {
            return interaction.deferUpdate().catch(() => {});
        }

        const pj = await Cachedb.findOne({ _id: userIdSeleccionado });
        if (!pj) {
            return interaction.reply({
                content: "No se encontró la ficha seleccionada en la base de datos.",
                flags: ["Ephemeral"]
            });
        }

        const components = construirDetalleFicha(pj, interaction.user.id);
        return await interaction.update({ components });
    },

    construirDetalleFicha,
    construirMensajeCorreccionesHilo,
    MAPA_CAMPOS
});
