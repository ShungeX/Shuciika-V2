const { crearBoton } = require("../../../utils/constructores/crearComponente")
const { ACCION_AGRADECER, agradecer } = require("../../../functions/Premium/boost")

// Botón público "Agradecer · N" del anuncio de boost (functions/Premium/boost.js)
module.exports = crearBoton({
    customId: ACCION_AGRADECER,
    soloAutor: false,

    ejecutar: async ({ interaction }) => {
        await agradecer(interaction)
    }
})
