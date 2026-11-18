const { crearBoton } = require("../../../../utils/constructores/crearComponente");
const sesiones = require("../../../../functions/Aprendizaje/sesiones");
const minijuegos = require("../../../../functions/Aprendizaje/minijuegos");

// Botones de los minijuegos de práctica. El estado (y la respuesta correcta) vive en el servidor.
// customId: practica-{userId}--{sesionId}-{accion}-{arg}
module.exports = crearBoton({
    customId: "practica",
    soloAutor: true,

    ejecutar: async ({ interaction, componentData: { extras } }) => {
        const [sesionId, accion, arg] = extras;
        const sesion = sesiones.porId(sesionId);
        if (!sesion || sesion.cerrada) {
            return interaction.reply({ content: "Esta práctica ya terminó.", flags: ["Ephemeral"] });
        }
        if (sesion.userId !== interaction.user.id) {
            return interaction.reply({ content: "Esta práctica no es tuya ＞﹏＜", flags: ["Ephemeral"] });
        }
        return minijuegos.accion(interaction, sesion, accion, arg);
    }
});
