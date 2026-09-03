// utils/constructores/construirPersonalidad.js
const { crearCustomId } = require("./customId");

const ARQUETIPOS_PERSONALIDAD = [
    {
        key: "analistas",
        titulo: "### 𖹭.ᐟ ANALISTAS:",
        opciones: [
            {
                label: "⤿ Arquitecto Arcano (INTJ) ࣪",
                value: "personalidad*INTJ",
                key: "INTJ",
                description: "Estrategas meticulosos que dominan la teoría mágica"
            },
            {
                label: "⤿ Lógico Místico (INTP) ࣪",
                value: "personalidad*INTP",
                key: "INTP",
                description: "Inventores de nuevos hechizos y teorías mágicas"
            },
            {
                label: "⤿ Comandante de Hechiceros (ENTJ)",
                value: "personalidad*ENTJ",
                key: "ENTJ",
                description: "Líderes naturales de grupos mágicos"
            },
            {
                label: "⤿ Innovador Arcano (ENTP)",
                value: "personalidad*ENTP",
                key: "ENTP",
                description: "Debatientes que desafían las normas mágicas"
            }
        ]
    },
    {
        key: "diplomaticos",
        titulo: "### ָ☾. DIPLOMÁTICOS:",
        opciones: [
            {
                label: "⤿ Consejero Visionario (INFJ)",
                value: "personalidad*INFJ",
                key: "INFJ",
                description: "Guardianes de antiguas profecías"
            },
            {
                label: "⤿ Sanador Empático (INFP)",
                value: "personalidad*INFP",
                key: "INFP",
                description: "Curadores que conectan con las emociones"
            },
            {
                label: "⤿ Líder Inspirador (ENFJ)",
                value: "personalidad*ENFJ",
                key: "ENFJ",
                description: "Mentores carismáticos de jóvenes magos"
            },
            {
                label: "⤿ Activista Mágico (ENFP)",
                value: "personalidad*ENFP",
                key: "ENFP",
                description: "Revolucionarios que luchan por la igualdad"
            }
        ]
    },
    {
        key: "centinelas",
        titulo: "### ⋆˙⟡ CENTINELAS: ",
        opciones: [
            {
                label: "⤿ Guardián del Orden (ISTJ)",
                value: "personalidad*ISTJ",
                key: "ISTJ",
                description: "Defensores de las tradiciones mágicas"
            },
            {
                label: "⤿ Protector Devoto (ISFJ)",
                value: "personalidad*ISFJ",
                key: "ISFJ",
                description: "Guardaespaldas mágicos y cuidadores"
            },
            {
                label: "⤿ Ejecutor de Leyes (ESTJ)",
                value: "personalidad*ESTJ",
                key: "ESTJ",
                description: "Administradores de instituciones mágicas"
            },
            {
                label: "⤿ Embajador Mágico (ESFJ)",
                value: "personalidad*ESFJ",
                key: "ESFJ",
                description: "Mediadores entre comunidades"
            }
        ]
    },
    {
        key: "exploradores",
        titulo: "### ⋆☀︎. EXPLORADORES: ",
        opciones: [
            {
                label: "⤿ Artesano Místico (ISTP)",
                value: "personalidad*ISTP",
                key: "ISTP",
                description: "Maestros en la creación de objetos mágicos"
            },
            {
                label: "⤿ Artista Elemental (ISFP)",
                value: "personalidad*ISFP",
                key: "ISFP",
                description: "Creadores que expresan magia a través del arte"
            },
            {
                label: "⤿ Aventurero Mágico (ESTP)",
                value: "personalidad*ESTP",
                key: "ESTP",
                description: "Exploradores de lugares peligrosos"
            },
            {
                label: "⤿ Animador Ilusionista (ESFP)",
                value: "personalidad*ESFP",
                key: "ESFP",
                description: "Entretenedores con magia espectacular"
            }
        ]
    }
];

/**
 * Construye la estructura de componentes V2 para la selección de personalidad
 * con 4 stringSelectMenu independientes por cada arquetipo.
 *
 * @param {string} userId - ID de Discord del usuario
 * @param {string|null} [personalidadActual=null] - Código MBTI actual (ej: "INTJ")
 * @param {string} [action="crear_ficha"] - Nombre de la acción para el customId
 * @returns {Array<Object>} Componentes en formato Discord Components V2
 */
function construirJsonV2Personalidad(userId, personalidadActual = null, action = "crear_ficha") {
    const components = [
        {
            type: 9,
            accessory: {
                type: 11,
                media: {
                    url: "https://i.pinimg.com/originals/f2/45/82/f2458233efb881add184d4c450db99bd.gif",
                    proxy_url: "https://i.pinimg.com/originals/f2/45/82/f2458233efb881add184d4c450db99bd.gif"
                },
                description: null,
                spoiler: false
            },
            components: [
                {
                    type: 10,
                    content: "# Selecciona el arquetipo de tu personaje"
                }
            ]
        }
    ];

    for (const arquetipo of ARQUETIPOS_PERSONALIDAD) {
        components.push({
            type: 14,
            divider: true,
            spacing: 1
        });

        components.push({
            type: 10,
            content: arquetipo.titulo
        });

        const opciones = arquetipo.opciones.map(opt => ({
            label: opt.label,
            value: opt.value,
            description: opt.description,
            emoji: null,
            default: Boolean(personalidadActual && (opt.key === personalidadActual || opt.label.includes(`(${personalidadActual})`)))
        }));

        components.push({
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: crearCustomId({
                        action: action,
                        userId: userId,
                        extras: ["personalidad", arquetipo.key]
                    }),
                    options: opciones,
                    placeholder: "",
                    min_values: 1,
                    max_values: 1,
                    disabled: false
                }
            ]
        });
    }

    components.push({
        type: 14,
        divider: true,
        spacing: 1
    });

    components.push({
        type: 10,
        content: "Si tienes dudas, recuerda revisar los [Arquetipos de personalidad](https://canary.discord.com/channels/716342375303217285/1362988047578435605) ( •̀ ω •́ )✧\n-# Nota:  Manifiesten para que Discord agregue la posibilidad de deshabilitar opciones de los Select Menus >:"
    });

    return [
        {
            type: 17,
            accent_color: null,
            spoiler: false,
            components: components
        }
    ];
}

module.exports = {
    ARQUETIPOS_PERSONALIDAD,
    construirJsonV2Personalidad
};
