// Color del contenedor del regalo (solo bolsas en BOLSAS_CON_COLOR).
// customId: regaloColor-{userId}--{token}   value: hex decimal | "ninguno"
const { crearStringSelectMenu } = require("../../../../utils/constructores/crearComponente")
const bolsa = require("../../../../functions/Regalos/bolsa")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearStringSelectMenu({
    customId: "regaloColor",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },
    optionNames: ["color"],

    ejecutar: async ({ interaction, character, componentData: { extras }, options: { color } }) => {
        const [token] = extras
        const userId = interaction.user.id
        const v = await P.validarEditor(userId, character, token)
        if (!v.ok) return P.responder(interaction, P.editorCerrado(v.codigo))
        const r = await bolsa.ponerColor({
            pjId: character._id,
            instanciaID: v.sesion.instanciaID,
            color: color === "ninguno" ? null : Number(color),
        })
        return P.responder(interaction, await P.editor({ userId, token, pjId: character._id, aviso: r.ok ? "🎨 Color actualizado" : r.codigo }))
    }
})
