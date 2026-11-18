const { crearModal } = require("../../../../utils/constructores/crearComponente");
const sesiones = require("../../../../functions/Aprendizaje/sesiones");
const hablado = require("../../../../functions/Aprendizaje/minijuegos/hablado");

// Modal "Recitar" del minijuego de hablado. El puntaje se calcula en el servidor.
// customId: practicaRecitar-{userId}--{sesionId}
module.exports = crearModal({
    customId: "practicaRecitar",
    soloAutor: true,
    camposDinamicos: true,

    ejecutar: async ({ interaction, componentData: { extras } }) => {
        const [sesionId] = extras;
        const sesion = sesiones.porId(sesionId);
        if (!sesion || sesion.cerrada || sesion.userId !== interaction.user.id) {
            return interaction.reply({ content: "Esta práctica ya terminó.", flags: ["Ephemeral"] });
        }
        return hablado.recitar(interaction, sesion);
    }
});
