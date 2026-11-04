const { crearModal } = require("../../../../utils/constructores/crearComponente");
const { mejorarStat, STATS_MOSTRAR, COSTO_FE_POR_PUNTO } = require("../../../../functions/Economia/progresionEstelar");
const { construirAlmaStats, filaNavegacionPerfil } = require("../../../../data/UI_ComponentsV2/menuAlma");
const clientdb = require("../../../../Server");
const souls = clientdb.db("Rol_db").collection("Soul");

// Modal del botón "Mejorar stats": stat + puntos. Cada punto cuesta COSTO_FE_POR_PUNTO FE.
// customId: almaMejorar-{userId}-{characterId}
module.exports = crearModal({
    customId: "almaMejorar",
    soloAutor: true,
    camposDinamicos: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true }
    },

    ejecutar: async ({ interaction, character }) => {
        if (interaction.user.id !== character.ownerID) {
            return interaction.reply({ content: "No puedes modificar el alma de este personaje ＞﹏＜", flags: ["Ephemeral"] });
        }

        const clave = interaction.fields.getStringSelectValues("stat")[0];
        const puntos = Number(interaction.fields.getTextInputValue("puntos")?.trim());
        if (!Number.isInteger(puntos) || puntos < 1) {
            return interaction.reply({ content: "Escribe un número entero de puntos (1 o más).", flags: ["Ephemeral"] });
        }

        const r = await mejorarStat(character._id, clave, puntos);
        const nombre = STATS_MOSTRAR.find(s => s.clave === clave)?.nombre || clave;

        if (!r.exito) {
            const motivos = {
                fe_insuficiente: `Subir **${puntos}** punto(s) de ${nombre} cuesta **${r.costo} FE** y tienes **${r.disponibles}**.`,
                techo: `${nombre} admite **${r.techo}** mejoras con tu Resplandor actual y ya llevas **${r.compradas}** (puedes subir ${Math.max(0, r.techo - r.compradas)} más).`,
                conflicto: "Tu alma cambió mientras asignabas los puntos. Vuelve a intentarlo.",
                stat_invalido: "Ese stat no se puede mejorar con fragmentos estelares.",
                sin_alma: "Este personaje aún no despierta su poder (´･ω･`)?",
            };
            return interaction.reply({ content: motivos[r.motivo] || "No se pudo mejorar el stat.", flags: ["Ephemeral"] });
        }

        const soulFresca = await souls.findOne({ _id: Number(character._id) });
        await interaction.update({
            components: construirAlmaStats({
                character,
                soul: soulFresca,
                userId: interaction.user.id,
                filaNavegacion: filaNavegacionPerfil(interaction.user.id, character._id)
            })
        });

        return interaction.followUp({
            content:
                `\`[📊]\` **${nombre}** subió **+${r.puntos}** → ${r.valorNuevo} (costo: ${r.costo} FE, ${COSTO_FE_POR_PUNTO} por punto).\n` +
                `-# FE disponibles: ${r.disponibles} · Mejoras en ${nombre}: ${r.compradas}/${r.techo}`,
            flags: ["Ephemeral"]
        });
    }
});
