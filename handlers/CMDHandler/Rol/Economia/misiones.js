const { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const userdb = db.collection("usuarios_server")
const versionEcon = require("../../../../config")
const config = require("../../../../config")
const { asignarMisionesDiarias } = require("../../../../functions/dataCharacters")


module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("misiones")
        .setDescription("revisa las misiones disponibles en tu perfil, incluyendo las diarias"),

    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true },
        cachepj: { obtener: false },
    },


    ejecutar: async function (client, interaction, { character, soul }) {

        const misiones = await asignarMisionesDiarias(character._id)
        console.log(misiones)
        if (misiones.length === 0 || !misiones) {
            return interaction.reply({ content: "No se ha podido asignar correctamente tus misiones", flags: ["Ephemeral"] })
        }

        const message = await this.createMisionMessage(interaction, character, misiones)

        return interaction.reply({ components: message, flags: ["IsComponentsV2"] })


    },

    createMisionMessage: async function (interaction, character, misiones) {
        const misionesJson = []
        const messageJson = [
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
                                "url": "https://i.pinimg.com/1200x/7a/80/72/7a807239116b82330c17133f6cc67100.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `# Misiones de ${character.Nombre}`
                            },
                            {
                                "type": 10,
                                "content": "-# Es posible que algunas misiones aun no estén disponibles o contengan ciertos errores"
                            }
                        ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },

                ]
            }
        ]


        if (misiones.length > 0) {
            misiones.map(m => {
                const estado = m.status === 'activa' ? 'Activa' : (m.status === 'completada' ? '`✅` Completada' : '`❌` Fallida');
                const verificarEstado = verificarProgresoMision(character, m.requisitos)
                misionesJson.push({
                    "type": 9,
                    "accessory": {
                        "type": 11,
                        "media": {
                            "url": ""
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `${m.nombre}`
                        },
                        {
                            "type": 10,
                            "content": `"${m.descripcion}\nRecompensa:${formatRecompensas(m.recompensa)}"`
                        }
                    ]
                },
                    {
                        "type": 9,
                        "accessory": {
                            "type": 2,
                            "style": 2,
                            "label": "reclamar",
                            "emoji": null,
                            "disabled": verificarEstado.reclamable,
                            "custom_id": `misiones-${interaction.user.id}-reclamar-${m.missionId}`
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `-# Estado: ${estado}\n-# Progreso: ${verificarEstado.progreso}`
                            }
                        ]
                    },)
            })
        } else {
            misionesJson.push({
                "type": 10,
                "content": "Sin misiones disponibles..."
            })
        }

        messageJson[0].components.push({
            "type": 1,
            "components": [
                {
                    "type": 3,
                    "custom_id": `misiones-${interaction.user.id}-filter`,
                    "options": [
                        {
                            "label": "Misiones diarias",
                            "value": "diarias",
                            "description": null,
                            "emoji": null,
                            "default": true
                        },
                        {
                            "label": "Misiones principales",
                            "value": "principales",
                            "description": null,
                            "emoji": null,
                            "default": false
                        },
                        {
                            "label": "Misiones secundarias",
                            "value": "secundarias",
                            "description": null,
                            "emoji": null,
                            "default": false
                        },
                        {
                            "label": "Misiones de evento",
                            "value": "evento",
                            "description": null,
                            "emoji": null,
                            "default": false
                        }
                    ],
                    "placeholder": "Selecciona el grupo de misiones",
                    "min_values": 1,
                    "max_values": 1,
                    "disabled": true
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
                "content": `Mostrando **misiones diarias** | Sistema de economia: ${config.versionEc} `
            })



        return messageJson

        function formatRecompensas(recompensa) {
            let texto = '';
            if (recompensa.xp) texto += `-# ✨ ${recompensa.xp} EXP\n`;
            if (recompensa.dinero) texto += `-# 🪙 ${recompensa.dinero} Lúmenes\n`;
            if (recompensa.objetos) {
                recompensa.objetos.forEach(obj => {
                    texto += `-# 📦 ${obj.nombre || obj.IDAutocomplete} (x${obj.cantidad})\n`;
                });
            }
            return texto.trim() || 'Ninguna recompensa específica.';
        }

        /**
 * Verifica el estado y progreso de una misión específica para un jugador.
 * @param {string} discordId - El ID de Discord del jugador.
 * @param {string} missionId - El ID de la misión a verificar.
 * @returns {object|null} - Un objeto con el estado o null si no se encuentra.
 */
        async function verificarProgresoMision(missionId) {
            const mision = character.misionesDiarias.find(m => m.missionId === missionId);

            if (!mision) {
                return { error: "Misión no encontrada para este jugador." };
            }

            return {
                esCompletada: mision.status === 'completada',
                status: mision.status,
                progreso: `${mision.progresoActual} / ${mision.objetivoMeta}`
            };
        }

        async function sincronizarProgreso(personaje) {
            let misionesActualizadas = false;
            for (const mision of personaje.misionesDiarias) {
                if (mision.status !== 'activa') continue;

                let ganancia = 0;
                if (mision.metodo === 'estadistica') {
                    const valorActual = mision.campoRastreado.split('.').reduce((o, k) => o?.[k], personaje) || 0;
                    ganancia = valorActual - mision.progresoInicial;
                } else if (mision.metodo === 'snapshotInventario') {
                    const itemActual = personaje.Inventario?.find(i => i.itemId === mision.itemIdRastreado);
                    const cantidadActual = itemActual?.cantidad || 0;
                    ganancia = cantidadActual - mision.progresoInicial;
                }

                if (ganancia > mision.progresoActual) {
                    mision.progresoActual = Math.min(mision.objetivoMeta, ganancia);
                    misionesActualizadas = true;
                }

                if (mision.progresoActual >= mision.objetivoMeta) {
                    mision.status = 'completada';
                    // La entrega de recompensas y notificación se puede centralizar aquí
                }
            }

            if (misionesActualizadas) {
                // Aquí podrías agrupar notificaciones de misiones completadas
                await db.collection('personajes').updateOne({ _id: personaje._id }, { $set: { misionesDiarias: personaje.misionesDiarias } });
            }
        }

    }
}