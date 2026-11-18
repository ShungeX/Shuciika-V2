const { crearBoton } = require("../../../../utils/constructores/crearComponente");
const updateInventario = require("../../../../functions/updateInventario");
const { aceptarInvitacion } = require("../../../../functions/Duelo/habilidadesNPC/anfitrion/encuentros");
const { ANFITRION } = require("../../../../functions/Duelo/habilidadesNPC/anfitrion/config");

// Confirmación de la Invitación del Anfitrión.
// customId: salonEspejos-{userId}--{aceptar|rechazar}
module.exports = crearBoton({
    customId: "salonEspejos",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [accion] = extras;
        const cerrar = (texto) => interaction.update({ components: [{ type: 17, components: [{ type: 10, content: texto }] }], allowedMentions: { parse: [] } });
        if (accion !== "aceptar") return cerrar("-# Guardas la Invitación. El espejo puede esperar.");

        const { ID, Region } = ANFITRION.OBJETOS.INVITACION;
        const tiene = (character.economia?.Inventario || []).some(i => Number(i.ID) === ID && (!i.Region || i.Region === Region) && Number(i.Cantidad ?? 1) > 0);
        if (!tiene) return cerrar("-# Ya no tienes la Invitación.");
        const consumo = await updateInventario(null, null, character._id, { isItem: true, ID, Region, consumir: true, cantidad: 1 });
        if (!consumo?.success) return cerrar("-# No se pudo usar la Invitación. Vuelve a intentarlo.");
        if (!(await aceptarInvitacion(interaction.user.id))) {
            await updateInventario(null, null, character._id, { isItem: true, ID, Region, cantidad: 1, esMovimiento: true });
            return cerrar("-# No se pudo registrar tu aceptación. Te devolví la Invitación.");
        }
        return cerrar("### 🪞 Invitación aceptada\n-# La próxima vez que te encuentres un Sosias, el anfitrión te estará esperando. Ahí ya no se puede huir.");
    }
});
