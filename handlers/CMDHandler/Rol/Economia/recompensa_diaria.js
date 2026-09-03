const { EmbedBuilder, ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const userdb = db.collection("usuarios_server")
const updateInventario = require("../../../../functions/updateInventario")
const utilidadesTexto = require("../../../../utils/utilidadesTexto")
const SEGUNDOS_DIA   = 86_400

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("recompensa_diaria")
        .setDescription("Reclama tu recompensa diaria"),

    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true },
        cachepj: { obtener: false },
    },
    isDevOnly: false,
    enMantenimiento: false,


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async (client, interaction, { character, soul}) => {
        const ahora = Math.floor(Date.now() / 1000)
        const proximaDisponible = character?.cooldowns?.recompensa_diaria?.nuevaReclamacion || 0
        const ultimaInteraccion = character?.cooldowns?.recompensa_diaria?.ultimaInteraccion || ahora
        const racha = character?.social.rachas?.recompensaDiaria || 0

        // ── Cooldown ──────────────────────────────────────────────────────────
        if (ahora < proximaDisponible) {
            return interaction.reply({
                content: `Ya has reclamado tu recompensa diaria. Vuelve <t:${proximaDisponible}:R>`,
                flags: ["Ephemeral"]
            })
        }

        // ── Evaluar racha ─────────────────────────────────────────────────────
        const deadlineRacha = utilidadesTexto.getDeadlineRacha(ultimaInteraccion)
        const rachaRota = racha > 1 && ahora > deadlineRacha
        const nuevaRacha = rachaRota ? 1 : racha + 1
        const bonus = (!rachaRota && racha > 1) ? Math.floor((racha / 7) * 16) : 0

        // ── Mensaje ───────────────────────────────────────────────────────────
        let descripcion, footer

        if (rachaRota) {
            descripcion = "Has recibido un `[320] Cofre del Aprendiz`\n-# Has perdido tu racha de recompensas diarias. ＞﹏＜"
            footer = "No te preocupes, puedes volver a iniciar otra racha"
        } else if (bonus > 0) {
            descripcion = `Has recibido un \`[320] Cofre del Aprendiz\`\nAdemas por tu perseverancia has obtenido un extra de \`${bonus}\` lumens`
            footer = "¡Sigue asi! (✿◡‿◡)"
        } else {
            descripcion = "Has recibido un `[320] Cofre del Aprendiz`"
            footer = "¡Sigue asi! (✿◡‿◡)"
        }

        // ── Embed ─────────────────────────────────────────────────────────────
        const nuevaDisponible = utilidadesTexto.reinicio24hrs(ahora)
        console.log(utilidadesTexto.reinicio24hrs(ahora))

        const embed = new EmbedBuilder()
            .setTitle("Recompensa diaria")
            .setDescription(descripcion)
            .addFields(
                { name: "Racha actual", value: `${nuevaRacha}`, inline: true },
                { name: "Próxima recompensa", value: `<t:${nuevaDisponible}:R>`, inline: true }
            )
            .setThumbnail("https://res.cloudinary.com/dn1cubayf/image/upload/v1738637289/Rol/Assets/snhze7wiigf85hsq1ikc.jpg")
            .setFooter({ text: footer })
            .setColor("DarkPurple")

        // ── Persistencia ──────────────────────────────────────────────────────
        try {
            await updateInventario(client, interaction, character._id, {
                ID: 320, Region: "TOB-01", cantidad: 1, isItem: true
            })

            let notifications = character.notificaciones || [];
            notifications = notifications.map(n => {
                if (n.tipo === 'recompensa_diaria') {
                    return { ...n, leida: true };
                }
                return n;
            });

            // Un solo updateOne en vez de dos roundtrips separados
            const updateOps = {
                $set: {
                    "cooldowns.recompensa_diaria.nuevaReclamacion": nuevaDisponible,
                    "cooldowns.recompensa_diaria.ultimaInteraccion": ahora,
                    "social.rachas.recompensaDiaria": nuevaRacha,   // $set directo, sin $inc
                    "notificaciones": notifications
                }
            }

            if (bonus > 0) updateOps.$inc = { "economia.lumens": bonus }

            await characters.updateOne({ _id: character._id }, updateOps, { upsert: true })

            await interaction.reply({ embeds: [embed] })

        } catch (error) {
            console.error("[recompensa_diaria]", error)
            await interaction.reply({
                content: "No se pudo reclamar la recompensa diaria. Contacta a un administrador.",
                flags: ["Ephemeral"]
            })
        }
    }
}