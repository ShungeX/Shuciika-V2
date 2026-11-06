// Filtro del inventario dentro del menú de /rol regalar (misma lógica que /rol inventario).
// customId: regalarInv-{userId}--{token}-filter-{pagina}-{filtros}
const { crearStringSelectMenu } = require("../../../../utils/constructores/crearComponente")
const M = require("../../../../functions/Regalos/menuRegalar")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearStringSelectMenu({
    customId: "regalarInv",
    soloAutor: true,
    multiSelect: true,
    requirements: { character: { obtener: true, required: true } },
    optionNames: ["filtros"],

    ejecutar: async ({ interaction, character, componentData: { extras }, options: { filtros } }) => {
        const [token, , , filtrosJoined] = extras
        const userId = interaction.user.id
        const s = M.sesionMenu(userId, character, token)
        if (!s) return P.responder(interaction, M.menuCerrado())

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
        s.filtros = finales
        s.pagina = 1
        return P.responder(interaction, await M.pantallaMenu({ userId, token, character }))
    }
})
