const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente")
const juegos = require("../../../functions/Economia/minijuegosTrabajo")

// Selects del sistema de trabajos. El personaje es siempre el activo (characterId vacío en el customId).
// customId: trabajar-{userId}--accion                     (menú del gafete)
//           trabajar-{userId}--postular-{principal|boost}  (lista de empleos)
//           trabajar-{userId}--envio | --seguir            (mensajero)
//           trabajar-{userId}--limpia-{mancha|agente}-{turnoId}  (limpieza)
module.exports = crearStringSelectMenu({
    customId: "trabajar",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true },
    },
    optionNames: ["valor"],

    ejecutar: async ({ interaction, character, soul, componentData: { extras }, options: { valor } }) => {
        const [op, sub, turnoId] = extras

        switch (op) {
            case "accion": return juegos.accionMenu(interaction, character, soul, valor)
            case "postular": return juegos.postular(interaction, character, soul, sub, valor)
            case "limpia": return juegos.accionLimpieza(interaction, character, sub, turnoId, valor)
            case "envio": return juegos.entregarPaquete(interaction, character, valor)
            case "seguir": return juegos.seguirMensajero(interaction, character, valor)
            default: return interaction.deferUpdate()
        }
    }
})
