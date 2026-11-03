const { crearBoton } = require("../../../utils/constructores/crearComponente")
const juegos = require("../../../functions/Economia/minijuegosTrabajo")

// Botones del sistema de trabajos. El personaje es siempre el activo (characterId vacío en el customId).
// customId: trabajar-{userId}--lista-{pagina}-{principal|boost}
//           trabajar-{userId}--gafete
//           trabajar-{userId}--renuncia-{firmar|retirar}-{principal|boost}
//           trabajar-{userId}--biblio-{start|color}
//           trabajar-{userId}--envio-start
//           trabajar-{userId}--limpia-{start|fin}-{turnoId}
module.exports = crearBoton({
    customId: "trabajar",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true },
    },

    ejecutar: async ({ interaction, character, soul, componentData: { extras } }) => {
        const [op, valor, extra] = extras

        switch (op) {
            case "lista": return juegos.mostrarLista(interaction, character, extra, Number(valor) || 1)
            case "gafete": return juegos.abrirMenu(interaction, character, soul, { actualizar: true })
            case "renuncia": return juegos.tramitarRenuncia(interaction, character, soul, valor, extra)
            case "biblio": return juegos.pulsarBiblioteca(interaction, character, valor)
            case "envio": return juegos.comenzarMensajero(interaction, character)
            case "limpia": return juegos.accionLimpieza(interaction, character, valor, extra)
            default: return interaction.deferUpdate()
        }
    }
})
