// Abrir algo del buzón (regalo → su detalle; carta/aviso → se marca como leído).
// customId: buzonVer-{userId}--{vista}-{tipo}-{pagina}   value: _id de la notificación
const { crearStringSelectMenu } = require("../../../../utils/constructores/crearComponente")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearStringSelectMenu({
    customId: "buzonVer",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },
    optionNames: ["id"],

    ejecutar: async ({ interaction, character, options: { id } }) => {
        return P.responder(interaction, await P.verNotificacion({ userId: interaction.user.id, personaje: character, id }))
    }
})
