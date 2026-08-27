const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed, StringSelectMenuBuilder } = require("discord.js")
const clientdb = require("../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const souls = db2.collection("Soul")
const contadorUID = db.collection("contadores")
const character = db2.collection("Personajes")
const version = require("../../config");

const regionStatus = db2.collection("RegionStatus")
/**
* 
* @param { Client } client 
* @param {ChatInputCommandInteraction} interaction 
*/

module.exports = async (client) => {
    return;
    const statuss = await regionStatus.findOne({ _id: "TOB-001" })

    let channel;
    let message;


    try {
        channel = await client.channels.fetch("1368013029165240390")
        message = await channel.messages.fetch(statuss.messageId)

    } catch (error) {
        console.error("No se pudo obtener el mensaje del status: " + `${error}`)

        const jsonTemporal = createMessage(statuss)

        const newMessage = await channel.send({ components: jsonTemporal, flags: ["IsComponentsV2"] })
        message = newMessage

        await regionStatus.updateOne({ _id: "TOB-001" }, {
            $set: { messageId: newMessage.id }
        })

        console.warn("💚 Se ha creado un nuevo mensaje para el status")
    }




    const intervalServer = setInterval(async () => {
        const tobeya = await regionStatus.findOne({ _id: "TOB-001" })
        const jsonTemporal = createMessage(tobeya)

        message.edit({components: jsonTemporal})
    }, 5000)

    console.warn("✨ Status de tobeya activo [Sistema]")

    function createMessage(tobeya) {
        const jsonTemporal = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 10,
                        "content": "#   ⋅✧⋅ `🏰 Estado actual del Instituto Tobeya` ⋅✧⋅"
                    },
                    {
                        "type": 12,
                        "items": [
                            {
                                "media": {
                                    "url": "https://i.pinimg.com/736x/ab/e8/d3/abe8d308eb1d2ca3297f171888aa2f45.jpg"
                                },
                                "description": null,
                                "spoiler": false
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
                        "content": "**`Status:`**\n\n- -# Núcleo central:" + `${statusBarra(tobeya.nucleoCentral.points, tobeya.nucleoCentral.maxPoints)}` +
                            "\n- -# Velo mágico:" + `${statusBarra(tobeya.veloMagico.points, tobeya.veloMagico.maxPoints)}` +
                            "\n- -# Archivo arcano:" + `${statusBarra(tobeya.archivoArcano.points, tobeya.archivoArcano.maxPoints)}` +
                            "\n\n- -# **Resonancia Magica:**  `" + `${tobeya.status}` + "`"
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": "**`Ultimas contribuciones:`**\n-# En proceso de recopilación..."
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
                                "type": 2,
                                "style": 2,
                                "label": "¿Qué es esto?",
                                "emoji": null,
                                "disabled": true,
                                "custom_id": "6b745f4f20d14e7aac533ec9e913142c"
                            }
                        ]
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": "51002fe04fa148d18c13360bf0b87161",
                                "options": [
                                    {
                                        "label": "Curious Pigeon",
                                        "value": "ecef01cacad34fad84d5b435ace6dcff",
                                        "description": null,
                                        "emoji": null,
                                        "default": false,
                                        "disabled": true
                                    }
                                ],
                                "placeholder": "En desarrollo",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": true
                            }
                        ]
                    }
                ]
            }
        ]

        return jsonTemporal
    }

    function statusBarra(current, max, mini) {

        if (mini) {
            const porcentaje = (current / max) * 100

            const totalBars = 5;
            let filledBars = Math.round((current / max) * totalBars);
            const emptyBars = totalBars - filledBars;

            if (current > 0 && filledBars === 0) {
                filledBars = 1
            }

            let heartsCompletos = '❤︎'.repeat(filledBars)
            const heartsVacios = '𖹭'.repeat(emptyBars)


            if (porcentaje < 10 && filledBars > 0) {
                heartsCompletos = heartsCompletos.slice(0, -2) + '<a:AttencionHeart:1345256576167968828>'
            }
            return `**(${current}/${max})** [${heartsCompletos}${heartsVacios}]`;

        } else {
            const porcentaje = (current / max) * 100

            const totalBars = 10;
            let filledBars = Math.round((current / max) * totalBars);
            const emptyBars = totalBars - filledBars;

            if (current > 0 && filledBars === 0) {
                filledBars = 1
            }

            let heartsCompletos = '▰'.repeat(filledBars)
            const heartsVacios = '▱'.repeat(emptyBars)
            return ` ${heartsCompletos}${heartsVacios} **(${Math.ceil(porcentaje)}%)**`;
        }


    }
}