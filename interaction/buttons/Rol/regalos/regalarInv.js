// Botones del inventario dentro del menú de /rol regalar.
// customId: regalarInv-{userId}--{token}-{prev|next|jump}-{pagina}-{filtros}
const { crearBoton } = require("../../../../utils/constructores/crearComponente")
const ui = require("../../../../data/UI_ComponentsV2/menuRegalo")
const M = require("../../../../functions/Regalos/menuRegalar")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearBoton({
    customId: "regalarInv",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [token, accion, paginaRaw] = extras
        const userId = interaction.user.id
        const s = M.sesionMenu(userId, character, token)
        if (!s) return P.responder(interaction, M.menuCerrado())

        if (accion === "jump") return interaction.showModal(ui.modalSalto({ userId, token, action: "regalarModal", extras: ["salto"] }))
        const pagina = Number(paginaRaw) || s.pagina || 1
        s.pagina = accion === "prev" ? Math.max(1, pagina - 1) : pagina + 1   // pantallaMenu la recorta
        return P.responder(interaction, await M.pantallaMenu({ userId, token, character }))
    }
})
