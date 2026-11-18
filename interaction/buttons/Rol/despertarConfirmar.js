const { crearBoton } = require("../../../utils/constructores/crearComponente")
const despertar = require("../../selectMenus/Rol/Despertar options")

// Confirmación explícita de la advertencia del Alma Desafinada (Despertar → Sintonía inicial).
// customId: despertarConfirmar-{userId}-{characterId}-{si|no}
module.exports = crearBoton({
    customId: "despertarConfirmar",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true },
    },

    ejecutar: async ({ interaction, character, soul, componentData: { extras } }) => {
        if (soul?.isFinish === true) {
            return interaction.reply({ content: "Una estrella guarda aquello que resuena en tu alma.", flags: ["Ephemeral"] })
        }

        // "Volver a elegir": de regreso a la Sintonía inicial, sin fijar nada
        if (extras[0] !== "si") {
            return interaction.update({ components: despertar.uiSintonia({ userId: interaction.user.id, characterId: character._id }) })
        }

        return despertar.elegirSintonia({ interaction, character, soul, respuesta: "disonancia", confirmado: true })
    },
})
