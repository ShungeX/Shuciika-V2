const { crearBoton } = require("../../../../utils/constructores/crearComponente");
const flujo = require("../../../../functions/Aprendizaje/flujo");
const { VIAS_PRACTICABLES } = require("../../../../functions/Aprendizaje/nucleo");

// Botones de la pantalla de una página (aprendizaje de hechizos).
// customId: pagina-{userId}--practicar-[{hechizoId}]-{via}
//   (characterId vacío: el router resuelve el personaje activo; los corchetes protegen el guion del ID)
module.exports = crearBoton({
    customId: "pagina",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true }
    },

    ejecutar: async ({ interaction, character, soul, componentData: { extras } }) => {
        const [accion, hechizoId, via] = extras;
        if (interaction.user.id !== character.ownerID) {
            return interaction.reply({ content: "Esta página no es tuya ＞﹏＜", flags: ["Ephemeral"] });
        }
        if (accion === "practicar" && hechizoId && VIAS_PRACTICABLES.includes(via)) {
            return flujo.practicar(interaction, { character, soul, hechizoId, via });
        }
        return interaction.reply({ content: "Acción de la página desconocida.", flags: ["Ephemeral"] });
    }
});
