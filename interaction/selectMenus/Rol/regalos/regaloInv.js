// Filtro del inventario dentro del editor de regalos (misma lógica que /rol inventario).
// customId: regaloInv-{userId}--{token}-filter-{pagina}-{filtros}
const { crearStringSelectMenu } = require("../../../../utils/constructores/crearComponente")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearStringSelectMenu({
    customId: "regaloInv",
    soloAutor: true,
    multiSelect: true,
    requirements: { character: { obtener: true, required: true } },
    optionNames: ["filtros"],

    ejecutar: async ({ interaction, character, componentData: { extras }, options: { filtros } }) => {
        const [token, , , filtrosJoined] = extras
        const userId = interaction.user.id
        const v = await P.validarEditor(userId, character, token)
        if (!v.ok) return P.responder(interaction, P.editorCerrado(v.codigo))

        // "Mochila completa" junto a otros filtros: si ya estaba, se quita; si es nueva, gana ella
        const anteriores = filtrosJoined ? filtrosJoined.split("_") : ["fullbag"]
        const elegidos = Array.isArray(filtros) ? filtros : [filtros]
        let finales
        if (elegidos.includes("fullbag")) {
            if (elegidos.length === 1) finales = ["fullbag"]
            else if (anteriores.includes("fullbag")) finales = elegidos.filter(f => f !== "fullbag")
            else finales = ["fullbag"]
        } else {
            finales = elegidos.length ? elegidos : ["fullbag"]
        }

        v.sesion.filtros = finales
        v.sesion.pagina = 1
        return P.responder(interaction, await P.editor({ userId, token, pjId: character._id }))
    }
})
