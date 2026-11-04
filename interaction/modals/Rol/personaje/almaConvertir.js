const { crearModal } = require("../../../../utils/constructores/crearComponente");
const { convertirPolvo } = require("../../../../functions/Economia/progresionEstelar");
const { construirAlmaMain, filaNavegacionPerfil } = require("../../../../data/UI_ComponentsV2/menuAlma");
const clientdb = require("../../../../Server");
const souls = clientdb.db("Rol_db").collection("Soul");

// Modal del botón "Convertir polvo" del menú del alma.
// customId: almaConvertir-{userId}-{characterId}
module.exports = crearModal({
    customId: "almaConvertir",
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

        const texto = interaction.fields.getTextInputValue("cantidad")?.trim() ?? "";
        let maxFragmentos = Infinity;
        if (texto) {
            const n = Number(texto);
            if (!Number.isInteger(n) || n < 1) {
                return interaction.reply({ content: "Escribe un número entero de fragmentos (1 o más), o déjalo vacío para condensar todo.", flags: ["Ephemeral"] });
            }
            maxFragmentos = n;
        }

        const r = await convertirPolvo(character._id, { maxFragmentos });

        if (!r.exito) {
            const motivos = {
                polvo_insuficiente: `No tienes polvo suficiente: el siguiente FE cuesta **${r.costoSiguiente}** y te faltan **${r.faltante}**.`,
                conflicto: "Tu alma cambió mientras condensabas. Vuelve a intentarlo.",
                sin_alma: "Este personaje aún no despierta su poder (´･ω･`)?",
            };
            return interaction.reply({ content: motivos[r.motivo] || "No se pudo condensar el polvo.", flags: ["Ephemeral"] });
        }

        // Refrescar el menú del alma con los valores nuevos
        const soulFresca = await souls.findOne({ _id: Number(character._id) });
        await interaction.update({
            components: construirAlmaMain({
                character,
                soul: soulFresca,
                userId: interaction.user.id,
                filaNavegacion: filaNavegacionPerfil(interaction.user.id, character._id)
            })
        });

        const pedidos = Number.isFinite(maxFragmentos) && r.fragmentos < maxFragmentos
            ? `\n-# Pediste ${maxFragmentos}, pero tu polvo solo alcanzó para ${r.fragmentos}.`
            : "";
        const resplandor = r.subioResplandor
            ? `\n\n🌟 **¡Tu alma brilla con más fuerza! Resplandor ${r.resplandorAnterior} → ${r.resplandorNuevo}**`
            : "";

        return interaction.followUp({
            content:
                `\`[✨]\` Condensaste **${r.fragmentos} FE** usando **${r.gasto}** de polvo estelar.\n` +
                `-# FE disponibles: ${r.disponibles} · Total acumulado: ${r.nuevoTotal} · Polvo restante: ${r.polvoRestante}\n` +
                `-# Siguiente FE: ${r.costoSiguiente} de polvo` +
                pedidos + resplandor,
            flags: ["Ephemeral"]
        });
    }
});
