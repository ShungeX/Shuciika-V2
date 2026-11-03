const { crearBoton } = require("../../../../utils/constructores/crearComponente");
const pedidos = require("../../../../functions/Tiendas/pedidos");
const menus = require("../../../../data/UI_ComponentsV2/menusTienda");

// Botones del pedido efímero de una tienda.
// customId: tienda_pedido-{userId}-{characterId}-{shopId}-{agregar|quitar|pagar|vaciar|seguir}[-{totalMostrado}]
module.exports = crearBoton({
    customId: "tienda_pedido",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true }
    },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [shopId, op, totalRaw] = extras;
        const userId = interaction.user.id;
        const ctx = { userId, shopId, character };
        const redibujar = async (avisos = []) => interaction.update({ components: await pedidos.construirPedido({ ...ctx, avisos }) });

        try {
            if (op === "agregar") {
                const modal = await pedidos.modalAgregar(ctx);
                // Estantería vacía: el propio pedido ya lo dice y desactiva el botón
                if (!modal) return redibujar();
                return interaction.showModal(modal);
            }

            if (op === "quitar") {
                const modal = await pedidos.modalQuitar(ctx);
                if (modal) return interaction.showModal(modal);
                // Sin pedido en memoria (caducó o se reinició el bot)
                if (!pedidos.obtenerPedido(userId, shopId, character._id)) {
                    const tienda = await pedidos.tiendaAbierta(shopId);
                    return interaction.update({ components: menus.pedidoDesvanecido({ tienda, ids: { userId, characterId: character._id } }) });
                }
                return redibujar();
            }

            if (op === "vaciar") {
                pedidos.vaciarPedido(ctx);
                return redibujar();
            }

            if (op === "pagar") {
                return pedidos.procesarPago(interaction, { ...ctx, totalMostrado: Number(totalRaw) });
            }

            // "seguir" (tras el recibo) y "abrir de nuevo" (pedido desvanecido): un pedido limpio en el mismo mensaje
            return redibujar();
        } catch (err) {
            if (!(err instanceof pedidos.ErrorTienda)) throw err;
            const components = menus.mensajeLugar(null, err.message);
            return interaction.replied || interaction.deferred ? interaction.editReply({ components }) : interaction.update({ components });
        }
    }
});
