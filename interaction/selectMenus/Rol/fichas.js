const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, StringSelectMenuBuilder } = require(`discord.js`);
const { updateMessage } = require("../../modals/Rol/Modal crearFicha");
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db");
const userdb = db.collection("usuarios_server");
const db2 = clientdb.db("Rol_db");
const Cachedb = db2.collection("CachePJ");
const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente");
const { crearCustomId } = require("../../../utils/constructores/customId");
const { construirJsonV2Personalidad } = require("../../../utils/constructores/construirPersonalidad");

// ==========================================
// CONFIGURACIÓN DECLARATIVA DE MODALES
// ==========================================

const CONFIG_CAMPOS_MODAL = {
    nombre: {
        customId: "nombrepj",
        label: "Nombra a tu personaje",
        placeholder: "Ej: Shuciika",
        style: TextInputStyle.Short,
        minLength: 4,
        maxLength: 18,
        required: true,
    },
    apodo: {
        customId: "apodopj",
        label: "Apodo",
        placeholder: "(Deja este campo vacio si no tiene apodo)",
        style: TextInputStyle.Short,
        minLength: 3,
        maxLength: 18,
        required: false,
    },
    edad: {
        customId: "edadpj",
        label: "¿Cuantos años tendra? (Edad)",
        placeholder: "Responde con un numero (Edad Min: 13, Edad max: 22)",
        style: TextInputStyle.Short,
        minLength: 2,
        maxLength: 2,
        required: true,
    },
    ciudadorg: {
        customId: "ciudadpj",
        label: "¿Tu personaje vivía en...? (Ciudad de origen)",
        placeholder: "Puede ser una ciudad inventada o real",
        style: TextInputStyle.Short,
        maxLength: 12,
        required: true,
    },
    apellido: {
        customId: "familiapj",
        label: "¿Tu personaje tiene apellido (Familia)?",
        placeholder: "Dejar en blanco si no tiene ningun apellido o linaje familiar",
        style: TextInputStyle.Short,
        maxLength: 10,
        required: false,
    },
    especialidades: {
        customId: "especialidadpj",
        label: "¿En que es bueno tu personaje?",
        placeholder: "Respuesta libre [Maximo 4 cosas] - [Deportes, cocina, etc. separalo con una coma (,)]",
        style: TextInputStyle.Paragraph,
        maxLength: 50,
        required: false,
    },
    historia: {
        customId: "historiapj",
        label: "Cuentame más de tu personaje... (Prologo)",
        placeholder: "[Opcional] Respuesta libre. ",
        style: TextInputStyle.Paragraph,
        maxLength: 2000,
        minLength: 20,
        required: false,
    },
    aspiracion: {
        customId: "aspiracion",
        label: "Aspiración",
        placeholder: "¿Cuál es el objetivo principal de tu personaje al entrar al Instituto?",
        style: TextInputStyle.Paragraph,
        maxLength: 2000,
        minLength: 20,
        required: true,
    },
    peso: {
        customId: "peso",
        label: "Peso",
        placeholder: "Se mide en kilogramos (kg) sin decimales. Min: 20kg - Max: 120kg",
        style: TextInputStyle.Short,
        maxLength: 3,
        minLength: 2,
        required: true,
    },
    estatura: {
        customId: "estatura",
        label: "Estatura",
        placeholder: "Se mide en centimetros (cm), min: 120 - max: 210",
        style: TextInputStyle.Short,
        maxLength: 3,
        minLength: 3,
        required: true,
    },
};

function mostrarModalCampo(interaction, campoKey, config) {
    const modal = new ModalBuilder()
        .setTitle("Creacion de ficha")
        .setCustomId(crearCustomId({
            action: "actualizarPerfil",
            userId: interaction.user.id,
            extras: [campoKey]
        }));

    const input = new TextInputBuilder()
        .setCustomId(config.customId)
        .setLabel(config.label)
        .setStyle(config.style)
        .setRequired(Boolean(config.required));

    if (config.placeholder) input.setPlaceholder(config.placeholder);
    if (config.minLength) input.setMinLength(config.minLength);
    if (config.maxLength) input.setMaxLength(config.maxLength);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    return interaction.showModal(modal);
}

function mostrarModalCumpleaños(interaction) {
    const modal = new ModalBuilder()
        .setTitle("Cumpleaños de tu personaje")
        .setCustomId(crearCustomId({
            action: "actualizarPerfil",
            userId: interaction.user.id,
            extras: ["cumpleaños"]
        }));

    const mesLabel = new LabelBuilder()
        .setLabel("Mes de nacimiento")
        .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
                .setCustomId("cumple_mes")
                .setPlaceholder("Selecciona un mes")
                .addOptions(
                    { label: "Enero", value: "1" },
                    { label: "Febrero", value: "2" },
                    { label: "Marzo", value: "3" },
                    { label: "Abril", value: "4" },
                    { label: "Mayo", value: "5" },
                    { label: "Junio", value: "6" },
                    { label: "Julio", value: "7" },
                    { label: "Agosto", value: "8" },
                    { label: "Septiembre", value: "9" },
                    { label: "Octubre", value: "10" },
                    { label: "Noviembre", value: "11" },
                    { label: "Diciembre", value: "12" },
                )
        );

    const diaLabel = new LabelBuilder()
        .setLabel("Día de nacimiento (1-31)")
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId("cumple_dia")
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(2)
                .setPlaceholder("Ej: 14")
                .setRequired(true)
        );

    modal.addLabelComponents(mesLabel, diaLabel);

    return interaction.showModal(modal);
}

// ==========================================
// CONFIGURACIÓN DE PRONOMBRES Y SEXO
// ==========================================

const OPCIONES_PRONOMBRES = [
    { label: "He/Him", value: "pronombres*HeHim", key: "HeHim", description: null },
    { label: "She/Her", value: "pronombres*SheHer", key: "SheHer", description: null },
    { label: "They/Them", value: "pronombres*TheyThem", key: "TheyThem", description: null },
    { label: "Any/all", value: "pronombres*AnyAll", key: "AnyAll", description: null },
    { label: "Ask me", value: "pronombres*askme", key: "askme", description: null },
];

const MAPA_PRONOMBRES = {
    HeHim: "He/Him",
    SheHer: "She/Her",
    TheyThem: "They/Them",
    AnyAll: "Any/all",
    askme: "Ask me",
    "pronombres*HeHim": "He/Him",
    "pronombres*SheHer": "She/Her",
    "pronombres*TheyThem": "They/Them",
    "pronombres*AnyAll": "Any/all",
    "pronombres*askme": "Ask me",
    "He/Him": "He/Him",
    "She/Her": "She/Her",
    "They/Them": "They/Them",
    "Any/all": "Any/all",
    "Ask me": "Ask me",
};

const MAPA_SEXO_A_PRONOMBRE = {
    "Masculino": "He/Him",
    "Femenino": "She/Her",
    "Sin especificar": "They/Them",
};

function obtenerPronombrePorSexo(sexo) {
    return MAPA_SEXO_A_PRONOMBRE[sexo] || "They/Them";
}

function construirJsonV2Sex(userId, sexoActual = null, pronombreActual = null) {
    const pronombreFormateado = pronombreActual ? (MAPA_PRONOMBRES[pronombreActual] || pronombreActual) : null;

    const opcionesSexo = [
        {
            label: "Masculino",
            value: "sexo*Masculino",
            description: null,
            emoji: { id: "1368440396614602853", name: "boy", animated: false },
            default: sexoActual === "Masculino"
        },
        {
            label: "Femenino",
            value: "sexo*Femenino",
            description: null,
            emoji: { id: "1368440420824256672", name: "girl", animated: false },
            default: sexoActual === "Femenino"
        },
        {
            label: "Prefiero no especificar",
            value: "sexo*Sin especificar",
            description: null,
            emoji: { id: "1368440451853582386", name: "question", animated: false },
            default: sexoActual === "Sin especificar"
        }
    ];

    const opcionesPronombres = OPCIONES_PRONOMBRES.map(opt => ({
        label: opt.label,
        value: opt.value,
        description: opt.description,
        default: Boolean(
            pronombreFormateado && (
                opt.label.toLowerCase() === pronombreFormateado.toLowerCase() ||
                opt.key.toLowerCase() === pronombreFormateado.toLowerCase()
            )
        )
    }));

    return [
        {
            type: 17,
            accent_color: null,
            spoiler: false,
            components: [
                {
                    type: 9,
                    accessory: {
                        type: 11,
                        media: { url: "https://i.pinimg.com/736x/54/f5/34/54f5342560444a7bedce8d9854b8a401.jpg" },
                        description: null,
                        spoiler: false
                    },
                    components: [
                        {
                            type: 10,
                            content: "# Elige el sexo biológico de tu personaje\n-# Tambien puedes elegir tus pronombres (Opcional). Se seleccionan de forma automática según el sexo biológico que elijas. ( •̀ ω •́ )✧"
                        }
                    ]
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 3,
                            custom_id: crearCustomId({
                                action: "crear_ficha",
                                userId: userId,
                                extras: ["sexo"]
                            }),
                            options: opcionesSexo,
                            placeholder: "Selecciona una opción...",
                            min_values: 1,
                            max_values: 1,
                            disabled: false
                        }
                    ]
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 3,
                            custom_id: crearCustomId({
                                action: "crear_ficha",
                                userId: userId,
                                extras: ["pronombres"]
                            }),
                            options: opcionesPronombres,
                            placeholder: "Selecciona una opción...",
                            min_values: 1,
                            max_values: 1,
                            disabled: false
                        }
                    ]
                }
            ]
        }
    ];
}

// ==========================================
// HANDLERS ESPECÍFICOS DE INTERACCIÓN
// ==========================================

async function manejarSexo(interaction, msg, extra, extras) {
    if (extra || extras?.length > 0) {
        const sexoSeleccionado = extra;
        const pronombreAuto = obtenerPronombrePorSexo(sexoSeleccionado);

        try {
            await Cachedb.updateOne({ _id: interaction.user.id }, {
                $setOnInsert: { created: Date.now() },
                $set: {
                    sexo: sexoSeleccionado,
                    pronombres: pronombreAuto,
                }
            }, { upsert: true });

            const info = {
                userId: interaction.user.id,
                action: "sexo",
                option: sexoSeleccionado,
                pronombres: pronombreAuto
            };

            const jsonV2Actualizado = construirJsonV2Sex(interaction.user.id, sexoSeleccionado, pronombreAuto);

            if (!interaction.deferred && !interaction.replied) {
                await interaction.update({ components: jsonV2Actualizado });
            } else {
                await interaction.editReply({ components: jsonV2Actualizado });
            }

            if (msg) {
                await updateMessage(interaction, msg, null, true, info);
            }
        } catch (error) {
            console.log("Error al actualizar el sexo", error);
        }
        return;
    }

    const userCacheSexo = await Cachedb.findOne({ _id: interaction.user.id });
    const jsonV2Sex = construirJsonV2Sex(interaction.user.id, userCacheSexo?.sexo, userCacheSexo?.pronombres);
    return await interaction.reply({ components: jsonV2Sex, flags: ["Ephemeral", "IsComponentsV2"] });
}

async function manejarPronombres(interaction, msg, extra, extras) {
    if (extra || extras?.length > 0) {
        const pronombreFormateado = MAPA_PRONOMBRES[extra] || extra;

        try {
            await Cachedb.updateOne({ _id: interaction.user.id }, {
                $setOnInsert: { created: Date.now() },
                $set: {
                    pronombres: pronombreFormateado,
                }
            }, { upsert: true });

            const userCachePj = await Cachedb.findOne({ _id: interaction.user.id });
            const sexoActual = userCachePj?.sexo || null;

            const info = {
                userId: interaction.user.id,
                action: "pronombres",
                option: pronombreFormateado,
                pronombres: pronombreFormateado
            };

            const jsonV2Actualizado = construirJsonV2Sex(interaction.user.id, sexoActual, pronombreFormateado);

            if (!interaction.deferred && !interaction.replied) {
                await interaction.update({ components: jsonV2Actualizado });
            } else {
                await interaction.editReply({ components: jsonV2Actualizado });
            }

            if (msg) {
                await updateMessage(interaction, msg, null, true, info);
            }
        } catch (error) {
            console.log("Error al actualizar los pronombres", error);
        }
        return;
    }

    const userCachePron = await Cachedb.findOne({ _id: interaction.user.id });
    const jsonV2Pron = construirJsonV2Sex(interaction.user.id, userCachePron?.sexo, userCachePron?.pronombres);
    return await interaction.reply({ components: jsonV2Pron, flags: ["Ephemeral", "IsComponentsV2"] });
}

async function manejarPersonalidad(interaction, msg, extra) {
    if (extra) {
        try {
            await Cachedb.updateOne({ _id: interaction.user.id }, {
                $setOnInsert: { created: Date.now() },
                $set: { personalidad: extra }
            }, { upsert: true });

            const info = {
                userId: interaction.user.id,
                action: "personalidad",
                option: extra
            };

            const personalidadV2 = construirJsonV2Personalidad(interaction.user.id, extra, "crear_ficha");

            if (!interaction.deferred && !interaction.replied) {
                await interaction.update({ components: personalidadV2 });
            } else {
                await interaction.editReply({ components: personalidadV2 });
            }

            if (msg) {
                await updateMessage(interaction, msg, null, true, info);
            }
        } catch (error) {
            console.log("Error al actualizar la personalidad", error);
        }
        return;
    }

    const userCachePj = await Cachedb.findOne({ _id: interaction.user.id });
    const personalidadV2 = construirJsonV2Personalidad(interaction.user.id, userCachePj?.personalidad);
    return await interaction.reply({ components: personalidadV2, flags: ["Ephemeral", "IsComponentsV2"] });
}

// ==========================================
// EXPORTACIÓN DEL COMPONENTE
// ==========================================

module.exports = crearStringSelectMenu({
    customId: "crear_ficha",
    soloAutor: true,
    optionNames: ["action"],

    ejecutar: async ({ client, interaction, componentData: { extras }, options: { action } }) => {
        let extra;
        if (action?.includes("*")) {
            const [actionPrincipal, ext] = action.split("*");
            action = actionPrincipal;
            extra = ext;
        }

        const selectedAction = action || interaction.values?.[0];

        // 1. Si la acción corresponde a cumpleaños o a un campo de modal, abrirlo de inmediato (sin esperar fetchs de red)
        if (selectedAction === "cumpleaños") {
            return await mostrarModalCumpleaños(interaction);
        }

        const configModal = CONFIG_CAMPOS_MODAL[selectedAction];
        if (configModal) {
            return await mostrarModalCampo(interaction, selectedAction, configModal);
        }

        // 2. Acciones interactivas que requieren el mensaje de previsualización temporal
        let msg = null;
        try {
            const userfind = await userdb.findOne({ _id: interaction.user.id });
            const messageId = userfind?.fichaStatus?.messageTemp;
            const channelId = userfind?.fichaStatus?.channelTemp;
            if (channelId && messageId) {
                const channel = await client.channels.fetch(channelId);
                msg = await channel.messages.fetch(messageId);
            }
        } catch (err) {
            console.log("No se pudo obtener el mensaje preview temporal", err);
        }

        // 3. Manejo de componentes interactivos y decorativos
        switch (selectedAction) {
            case "sexo":
                return await manejarSexo(interaction, msg, extra, extras);
            case "pronombres":
                return await manejarPronombres(interaction, msg, extra, extras);
            case "personalidad":
                return await manejarPersonalidad(interaction, msg, extra);
            case "notOpcion":
                return await interaction.reply({ content: "Hey, eso es solo una opción de decoración ＞﹏＜", flags: ["Ephemeral"] });
            default:
                console.log("fichas.js - Acción no reconocida:", selectedAction);
                return await interaction.reply({ content: "Acción no reconocida. Por favor, intenta de nuevo.", flags: ["Ephemeral"] });
        }
    }
});