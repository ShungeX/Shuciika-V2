const { crearBoton } = require("../../../../utils/constructores/crearComponente");
const ventas = require("../../../../functions/Tiendas/ventas");
const { ErrorTienda } = require("../../../../functions/Tiendas/pedidos");
const menus = require("../../../../data/UI_ComponentsV2/menusTienda");

// Botones de la venta efímera a una tienda (el pedido al revés).
// customId: tienda_venta-{userId}-{characterId}-{shopId}-{agregar|quitar|confirmar|vaciar|seguir}[-{totalMostrado}]
module.exports = crearBoton({
    customId: "tienda_venta",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true }
    },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [shopId, op, totalRaw] = extras;
        const userId = interaction.user.id;
        const ctx = { userId, shopId, character };
        const redibujar = async (avisos = []) => interaction.update({ components: await ventas.construirVenta({ ...ctx, avisos }) });

        try {
            if (op === "agregar") {
                const modal = await ventas.modalAgregar(ctx);
                if (!modal) return redibujar();
                return interaction.showModal(modal);
            }

            if (op === "quitar") {
                const modal = await ventas.modalQuitar(ctx);
                if (modal) return interaction.showModal(modal);
                if (!ventas.obtenerVenta(userId, shopId, character._id)) {
                    const tienda = await ventas.tiendaCompradora(shopId);
                    return interaction.update({ components: menus.ventaDesvanecida({ tienda, ids: { userId, characterId: character._id } }) });
                }
                return redibujar();
            }

            if (op === "vaciar") {
                ventas.vaciarVenta(ctx);
                return redibujar();
            }

            if (op === "confirmar") {
                return ventas.procesarVenta(interaction, { ...ctx, totalMostrado: Number(totalRaw) });
            }

            // "seguir" (tras el recibo) y "abrir de nuevo": una venta limpia en el mismo mensaje
            return redibujar();
        } catch (err) {
            if (!(err instanceof ErrorTienda)) throw err;
            const components = menus.mensajeLugar(null, err.message);
            return interaction.replied || interaction.deferred ? interaction.editReply({ components }) : interaction.update({ components });
        }
    }
});
