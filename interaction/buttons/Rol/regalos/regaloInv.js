// Botones del inventario dentro del editor de regalos (el mismo selector de /rol inventario).
// customId: regaloInv-{userId}--{token}-{prev|next|jump}-{pagina}-{filtros}
const { crearBoton } = require("../../../../utils/constructores/crearComponente")
const ui = require("../../../../data/UI_ComponentsV2/menuRegalo")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearBoton({
    customId: "regaloInv",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [token, accion, paginaRaw] = extras
        const userId = interaction.user.id
        const v = await P.validarEditor(userId, character, token)
        if (!v.ok) return P.responder(interaction, P.editorCerrado(v.codigo))

        if (accion === "jump") return interaction.showModal(ui.modalSalto({ userId, token }))

        // La página que se ve en el mensaje manda (por si la sesión se re-adoptó tras un reinicio);
        // editor() la recorta al rango válido.
        const pagina = Number(paginaRaw) || v.sesion.pagina || 1
        v.sesion.pagina = accion === "prev" ? Math.max(1, pagina - 1) : pagina + 1
        return P.responder(interaction, await P.editor({ userId, token, pjId: character._id }))
    }
})
