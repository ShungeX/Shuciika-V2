// Botones del editor de regalos.
// customId: regaloBtn-{userId}--{token}-{accion}[-{arg}]
//   cerrar | borrar        → confirmación
//   cerrarOk | borrarOk    → ejecutar
//   volver                 → editor
//   prevpag                → página de la vista previa (arg = página)
const { crearBoton } = require("../../../../utils/constructores/crearComponente")
const ui = require("../../../../data/UI_ComponentsV2/menuRegalo")
const { texto } = require("../../../../config/mensajesRegalos")
const bolsa = require("../../../../functions/Regalos/bolsa")
const P = require("../../../../functions/Regalos/pantallas")
const c = require("../../../../functions/Regalos/comun")

module.exports = crearBoton({
    customId: "regaloBtn",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [token, accion, arg] = extras
        const userId = interaction.user.id
        const v = await P.validarEditor(userId, character, token)
        if (!v.ok) return P.responder(interaction, P.editorCerrado(v.codigo))
        const pjId = character._id
        const instanciaID = v.sesion.instanciaID

        switch (accion) {
            case "cerrar":
            case "borrar":
                return P.responder(interaction, ui.construirConfirmacion({ userId, token, accion }))

            case "cerrarOk": {
                const r = await bolsa.cerrar({ pjId, instanciaID })
                if (!r.ok) return P.responder(interaction, await P.editor({ userId, token, pjId, aviso: r.codigo }))
                c.cerrarEditor(userId)
                return P.responder(interaction, ui.construirAviso({ titulo: "Regalo cerrado 🎀", lineas: [`-# ${texto("CERRADO")}`] }))
            }

            case "borrarOk": {
                const r = await bolsa.borrar({ pjId, instanciaID })
                if (!r.ok) return P.responder(interaction, await P.editor({ userId, token, pjId, aviso: r.codigo }))
                c.cerrarEditor(userId)
                return P.responder(interaction, ui.construirAviso({ titulo: "Regalo deshecho", lineas: [`-# ${texto("BORRADO")}`] }))
            }

            case "prevpag":
                return P.responder(interaction, await P.vistaPreviaEditor({ userId, token, character, pagina: Number(arg) || 0 }))

            default:
                return P.responder(interaction, await P.editor({ userId, token, pjId }))
        }
    }
})
