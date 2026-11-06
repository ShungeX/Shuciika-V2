// "Saltar pag." del inventario dentro del editor de regalos.
// customId: regaloInvSalto-{userId}--{token}
const { crearModal } = require("../../../../utils/constructores/crearComponente")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearModal({
    customId: "regaloInvSalto",
    soloAutor: true,
    camposDinamicos: true,
    requirements: { character: { obtener: true, required: true } },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [token] = extras
        const userId = interaction.user.id
        const v = await P.validarEditor(userId, character, token)
        if (!v.ok) return P.responder(interaction, P.editorCerrado(v.codigo))

        const pagina = parseInt(String(interaction.fields.getTextInputValue("pagina") || "").trim(), 10)
        if (!Number.isInteger(pagina) || pagina < 1) {
            return P.responder(interaction, await P.editor({ userId, token, pjId: character._id, aviso: "PAGINA_INVALIDA" }))
        }
        v.sesion.pagina = pagina   // editor() la recorta a la última si se pasa
        return P.responder(interaction, await P.editor({ userId, token, pjId: character._id }))
    }
})
