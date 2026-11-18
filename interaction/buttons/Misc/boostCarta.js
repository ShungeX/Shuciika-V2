const { crearBoton } = require("../../../utils/constructores/crearComponente")
const { ACCION_CARTA, construirCarta, nombreDestinatario } = require("../../../functions/Premium/boost")

// Botón "Abrir carta" del sobre que llega por MD al boostear: reemplaza el sobre por la carta de Kaelion
module.exports = crearBoton({
    customId: ACCION_CARTA,
    soloAutor: true,

    ejecutar: async ({ interaction, componentData: { extras } }) => {
        const unix = Number(extras?.[0]) || Math.floor(Date.now() / 1000)
        const nombre = await nombreDestinatario(interaction.user)

        await interaction.update({
            components: construirCarta(nombre, unix),
            flags: ["IsComponentsV2"],
        })
    }
})
