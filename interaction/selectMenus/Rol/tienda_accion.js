const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente");
const clientdb = require("../../../Server");
const { obtenerTienda } = require("../../../functions/mensajesServidor");
const pedidos = require("../../../functions/Tiendas/pedidos");
const menus = require("../../../data/UI_ComponentsV2/menusTienda");

// Menú público del panel de cada tienda (customId: tienda_accion---{shopId}). Todo lo que responde es efímero.
module.exports = crearStringSelectMenu({
    customId: "tienda_accion",
    soloAutor: false,
    requirements: {
        character: { obtener: true, required: false }
    },
    optionNames: ["accion"],

    ejecutar: async ({ interaction, character, componentData: { extras }, options: { accion } }) => {
        // Se reenvían los mismos componentes para que el menú del panel vuelva a "Selecciona una acción...";
        // si no, quien elige la misma opción dos veces no dispara nada
        await interaction.update({ components: interaction.message.components.map(c => c.toJSON()) });
        const efimero = (components) => interaction.followUp({ components, flags: ["Ephemeral", "IsComponentsV2"] });

        const shopId = extras[0];
        const tienda = await obtenerTienda(clientdb.db("Server_db"), shopId);
        if (!tienda) return efimero(menus.mensajeLugar(null, "Este lugar ya no atiende a nadie."));
        if (!tienda.tienda.acciones.includes(accion)) return efimero(menus.mensajeLugar(tienda, "Eso ya no se puede hacer aquí."));

        if (accion === "observar") {
            // Una frase distinta de la que se ve en el panel, si hay más de una
            const frases = tienda.tienda.frases || [];
            const enPanel = tienda.ultimaPublicacion?.eleccion?.frase;
            const opciones = frases.length > 1 ? frases.filter((_, i) => i !== enPanel) : frases;
            const frase = opciones[Math.floor(Math.random() * opciones.length)];
            return efimero(menus.mensajeLugar(tienda, frase ? `*${frase}*` : "*Miras alrededor con calma. Nada parece fuera de lugar… por ahora.*"));
        }

        if (accion === "enfermera") {
            // TODO: avisar al staff o abrir el flujo de atención cuando exista
            return efimero(menus.mensajeLugar(tienda, "*Tocas la campanita del mostrador.*\n-# Una enfermera vendrá a atenderte en cuanto pueda ♡( ◡‿◡ )"));
        }

        if (accion === "comprar") {
            if (!character) return efimero(menus.mensajeLugar(tienda, "Necesitas un personaje activo para comprar 〒▽〒"));
            return efimero(await pedidos.construirPedido({ userId: interaction.user.id, shopId, character }));
        }

        return efimero(menus.mensajeLugar(tienda, "Esta acción todavía no tiene nada preparado."));
    }
});
