const { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require("discord.js");
const clientdb = require("../../../../Server");
const db2 = clientdb.db("Rol_db");
const Cachedb = db2.collection("CachePJ");
const { crearCustomId } = require("../../../../utils/constructores/customId");

const ITEMS_POR_PAGINA = 10;

function obtenerPrioridad(doc) {
    const estado = (doc.status?.estado || "pendiente").toLowerCase().trim();
    if (estado === "corregida") return 1;
    if (estado === "pendiente") return 2;
    return 3;
}

function obtenerFecha(doc) {
    if (doc.status?.fecha && Number(doc.status.fecha) > 0) {
        return Number(doc.status.fecha);
    }
    if (doc.created && Number(doc.created) > 0) {
        return Number(doc.created);
    }
    return 0;
}

function formatearFechaCorta(ms) {
    if (!ms || Number(ms) === 0) return "Sin fecha";
    const d = new Date(Number(ms));
    if (isNaN(d.getTime())) return "Sin fecha";
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const anio = d.getFullYear();
    const horas = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${anio} ${horas}:${min}`;
}

/**
 * Construye los componentes V2 de la lista de fichas pendientes para una página dada.
 *
 * @param {string} userId - ID del usuario de Discord que ejecuta la acción
 * @param {number} [pagina=1] - Página a mostrar (1-indexed)
 * @returns {Promise<Array<Object>>} Componentes V2
 */
async function construirListaPendientes(userId, pagina = 1) {
    const docs = await Cachedb.find({
        waiting: true,
        "status.estado": { $not: { $regex: /^(aceptada|aprobada|rechazada)$/i } }
    }).toArray();

    // Orden de prioridad: 1. 'Corregida', 2. 'Pendiente', y por fecha más reciente
    docs.sort((a, b) => {
        const pA = obtenerPrioridad(a);
        const pB = obtenerPrioridad(b);
        if (pA !== pB) return pA - pB;
        return obtenerFecha(b) - obtenerFecha(a);
    });

    const totalFichas = docs.length;
    const totalPaginas = Math.ceil(totalFichas / ITEMS_POR_PAGINA) || 1;
    const paginaActual = Math.max(1, Math.min(pagina, totalPaginas));

    const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA;
    const fin = inicio + ITEMS_POR_PAGINA;
    const fichasPagina = docs.slice(inicio, fin);

    // Contenido de la lista en texto
    let contenidoLista;
    if (fichasPagina.length === 0) {
        contenidoLista = "**Lista de personajes pendientes:**\n\n-# *No hay fichas pendientes por revisar.*";
    } else {
        const lineas = fichasPagina.map((doc, idx) => {
            const num = inicio + idx + 1;
            const apodo = doc.apodo ? ` - [${doc.apodo}]` : "";
            const estado = doc.status?.estado ? `\`${doc.status.estado}\`` : "`Pendiente`";
            const fecha = obtenerFecha(doc);
            const fechaStr = fecha > 0 ? `<t:${Math.floor(fecha / 1000)}:d> (<t:${Math.floor(fecha / 1000)}:R>)` : "Sin fecha";
            return `-# ${num}. **${doc.nombre}**${apodo} • ${estado}: ${fechaStr}`;
        });
        contenidoLista = "**Lista de personajes pendientes:**\n\n" + lineas.join("\n");
    }

    // Texto de paginación
    let textoPaginacion;
    if (totalFichas === 0) {
        textoPaginacion = "-# Mostrando 0 de 0 fichas pendientes";
    } else {
        const desde = inicio + 1;
        const hasta = Math.min(fin, totalFichas);
        textoPaginacion = `-# Mostrando ${desde}-${hasta} de ${totalFichas} fichas pendientes • Página ${paginaActual}/${totalPaginas}`;
    }

    // Opciones del StringSelectMenu
    const options = fichasPagina.map(doc => {
        const apodoLabel = doc.apodo ? ` [${doc.apodo}]` : "";
        const label = `${doc.nombre}${apodoLabel}`.slice(0, 100);
        const estado = doc.status?.estado || "Pendiente";
        const fechaMod = formatearFechaCorta(obtenerFecha(doc));
        const description = `[${estado}] - ${fechaMod}`.slice(0, 100);

        return {
            label: label,
            value: String(doc._id),
            description: description,
            emoji: null,
            default: false
        };
    });

    const menuOptions = options.length > 0 ? options : [
        {
            label: "No hay fichas pendientes",
            value: "ninguna",
            description: "No se encontraron fichas por revisar",
            emoji: null,
            default: false
        }
    ];

    return [
        {
            type: 17,
            accent_color: 11436543,
            spoiler: false,
            components: [
                {
                    type: 9,
                    accessory: {
                        type: 11,
                        media: {
                            url: "https://i.pinimg.com/736x/c6/f9/3e/c6f93e71d498e530ee4258121c0b0b52.jpg",
                            proxy_url: "https://i.pinimg.com/736x/c6/f9/3e/c6f93e71d498e530ee4258121c0b0b52.jpg"
                        },
                        description: null,
                        spoiler: false
                    },
                    components: [
                        {
                            type: 10,
                            content: "# Selecciona una ficha para más información"
                        },
                        {
                            type: 10,
                            content: "-# Recuerda revisar el canal <#772554333068722177> antes de realizar modificaciones sobre las fichas de los usuarios. ⚠️"
                        }
                    ]
                },
                {
                    type: 14,
                    divider: true,
                    spacing: 1
                },
                {
                    type: 10,
                    content: contenidoLista
                },
                {
                    type: 10,
                    content: textoPaginacion
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 2,
                            label: "<",
                            emoji: null,
                            disabled: paginaActual <= 1,
                            custom_id: crearCustomId({
                                action: "verificar_ficha",
                                userId: userId,
                                extras: ["pagina", String(paginaActual - 1)]
                            })
                        },
                        {
                            type: 2,
                            style: 2,
                            label: ">",
                            emoji: null,
                            disabled: paginaActual >= totalPaginas,
                            custom_id: crearCustomId({
                                action: "verificar_ficha",
                                userId: userId,
                                extras: ["pagina", String(paginaActual + 1)]
                            })
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
                            type: 3,
                            custom_id: crearCustomId({
                                action: "verificar_ficha",
                                userId: userId,
                                extras: ["select", String(paginaActual)]
                            }),
                            options: menuOptions,
                            placeholder: "Selecciona una opción ",
                            min_values: 1,
                            max_values: 1,
                            disabled: options.length === 0
                        }
                    ]
                }
            ]
        }
    ];
}

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("verificar_ficha")
        .setDescription("Verifica la ficha de un usuario / [Staff - Verificadores]."),

    requireCharacter: false,
    requireSoul: false,
    requireCharacterCache: false,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: false,
        Character: false,
        Cachepj: false
    },

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    ejecutar: async (client, interaction) => {
        const roles = ["810198633705766962", "745503889297637478", "716851609509953560", "734142447256469584", "922698145404698664"];
        const verifRoles = roles.some(role => interaction.member?.roles?.cache?.has(role));

        if (!verifRoles) {
            return interaction.reply({
                content: "Lo siento, solo el **staff** y **verificadores de ficha** puede usar este comando (╥﹏╥)",
                flags: ["Ephemeral"]
            });
        }

        const listaPendientes = await construirListaPendientes(interaction.user.id, 1);

        await interaction.reply({
            components: listaPendientes,
            flags: ["IsComponentsV2", "SuppressNotifications"]
        });
    },

    construirListaPendientes,
    obtenerPrioridad,
    obtenerFecha
};