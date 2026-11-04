const { crearModal } = require("../../../utils/constructores/crearComponente");
const ventas = require("../../../functions/Tiendas/ventas");
const { ErrorTienda } = require("../../../functions/Tiendas/pedidos");

// Modals de agregar/quitar de la venta (mismo esquema que tienda_pedido_modal).
// customId: tienda_venta_modal-{userId}-{characterId}-{shopId}-{agregar|quitar}
module.exports = crearModal({
    customId: "tienda_venta_modal",
    soloAutor: true,
    camposDinamicos: true,
    requirements: {
        character: { obtener: true, required: true }
    },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [shopId, op] = extras;
        const ctx = { userId: interaction.user.id, shopId, character };
        const clave = interaction.fields.getStringSelectValues("objeto")[0];
        const cantidadTexto = interaction.fields.getTextInputValue("cantidad");

        const avisos = [];
        try {
            if (op === "agregar") await ventas.agregarAVenta({ ...ctx, clave, cantidadTexto });
            else if (op === "quitar" && !ventas.quitarDeVenta({ ...ctx, clave, cantidadTexto })) avisos.push("Eso ya no estaba en tu venta.");
        } catch (err) {
            if (!(err instanceof ErrorTienda)) throw err;
            avisos.push(err.message);
        }

        const components = await ventas.construirVenta({ ...ctx, avisos });
        if (interaction.isFromMessage()) return interaction.update({ components });
        return interaction.reply({ components, flags: ["Ephemeral", "IsComponentsV2"] });
    }
});
