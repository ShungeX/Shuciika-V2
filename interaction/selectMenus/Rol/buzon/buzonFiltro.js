// Filtro por tipo del buzón.
// customId: buzonFiltro-{userId}--{vista}   value: todos | regalo | carta | paquete | sistema
const { crearStringSelectMenu } = require("../../../../utils/constructores/crearComponente")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearStringSelectMenu({
    customId: "buzonFiltro",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },
    optionNames: ["tipo"],

    ejecutar: async ({ interaction, character, componentData: { extras }, options: { tipo } }) => {
        const [vista] = extras
        return P.responder(interaction, await P.buzon({ userId: interaction.user.id, personaje: character, vista, tipo }))
    }
})
