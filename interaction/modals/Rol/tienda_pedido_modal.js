const { crearModal } = require("../../../utils/constructores/crearComponente");
const pedidos = require("../../../functions/Tiendas/pedidos");
const { SELECTS_AGREGAR } = require("../../../data/UI_ComponentsV2/menusTienda");

/** Primer valor elegido entre los selects del modal (con estantería grande hay varios y todos son opcionales). */
function claveElegida(fields) {
    for (const id of SELECTS_AGREGAR) {
        let valores = [];
        try { valores = fields.getStringSelectValues(id) || []; } catch { continue; }   // ese select no existe en este modal
        if (valores.length) return valores[0];
    }
    return null;
}

// Modals de agregar/quitar del pedido. Llevan un select (los modals admiten StringSelect dentro de un Label)
// y la cantidad. Se abren desde un botón del mensaje efímero, así que se responde editando ese mismo mensaje.
// customId: tienda_pedido_modal-{userId}-{characterId}-{shopId}-{agregar|quitar}
module.exports = crearModal({
    customId: "tienda_pedido_modal",
    soloAutor: true,
    // El select no es un TextInput: el mapeo de construirOptions no sirve, se lee de interaction.fields
    camposDinamicos: true,
    requirements: {
        character: { obtener: true, required: true }
    },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [shopId, op] = extras;
        const ctx = { userId: interaction.user.id, shopId, character };
        const clave = claveElegida(interaction.fields);
        const cantidadTexto = interaction.fields.getTextInputValue("cantidad");

        const avisos = [];
        try {
            if (!clave) avisos.push("No elegiste ningún objeto.");
            else if (op === "agregar") await pedidos.agregarAlPedido({ ...ctx, clave, cantidadTexto });
            else if (op === "quitar" && !pedidos.quitarDelPedido({ ...ctx, clave, cantidadTexto })) avisos.push("Eso ya no estaba en tu pedido.");
        } catch (err) {
            if (!(err instanceof pedidos.ErrorTienda)) throw err;
            avisos.push(err.message);
        }

        const components = await pedidos.construirPedido({ ...ctx, avisos });
        // isFromMessage: el modal salió de un botón, así que update edita el mensaje efímero del pedido
        if (interaction.isFromMessage()) return interaction.update({ components });
        return interaction.reply({ components, flags: ["Ephemeral", "IsComponentsV2"] });
    }
});
