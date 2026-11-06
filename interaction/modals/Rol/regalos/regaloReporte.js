// Reporte de un regalo del buzón (motivo de lista cerrada + texto opcional).
// customId: regaloReporte-{userId}--{regaloId}
const { crearModal } = require("../../../../utils/constructores/crearComponente")
const { texto } = require("../../../../config/mensajesRegalos")
const regalos = require("../../../../functions/Regalos/regalos")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearModal({
    customId: "regaloReporte",
    soloAutor: true,
    camposDinamicos: true,
    requirements: { character: { obtener: true, required: true } },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [regaloId] = extras
        const userId = interaction.user.id
        const motivo = interaction.fields.getStringSelectValues("motivo")?.[0]
        const textoLibre = interaction.fields.getTextInputValue("texto")

        const r = await regalos.reportarRegalo({ personaje: character, userId, regaloId, motivo, texto: textoLibre })
        return P.responder(interaction, await P.detalle({
            userId, personaje: character, regaloId,
            lineasExtra: [`> ${texto(r.ok ? "REPORTE_OK" : r.codigo)}`],
        }))
    }
})
