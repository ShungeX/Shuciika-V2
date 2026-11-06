// Modales del menú de /rol regalar.
// customId: regalarModal-{userId}--{token}-{elegir|lumens|destino|salto}
const { crearModal } = require("../../../../utils/constructores/crearComponente")
const M = require("../../../../functions/Regalos/menuRegalar")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearModal({
    customId: "regalarModal",
    soloAutor: true,
    camposDinamicos: true,
    requirements: { character: { obtener: true, required: true } },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [token, modo] = extras
        const userId = interaction.user.id
        const s = M.sesionMenu(userId, character, token)
        if (!s) return P.responder(interaction, M.menuCerrado())

        try {
            let aviso = null
            if (modo === "elegir") {
                aviso = await M.elegir({
                    token, character,
                    valor: interaction.fields.getStringSelectValues("objeto")?.[0],
                    cantidadTxt: interaction.fields.getTextInputValue("cantidad"),
                })
            } else if (modo === "lumens") {
                aviso = M.ponerLumens({ token, lumensTxt: interaction.fields.getTextInputValue("lumens") })
            } else if (modo === "destino") {
                aviso = await M.ponerDestino({ token, character, idTxt: interaction.fields.getTextInputValue("id") })
            } else if (modo === "salto") {
                const pagina = parseInt(String(interaction.fields.getTextInputValue("pagina") || "").trim(), 10)
                if (!Number.isInteger(pagina) || pagina < 1) aviso = "PAGINA_INVALIDA"
                else s.pagina = pagina   // pantallaMenu la recorta a la última si se pasa
            }
            return P.responder(interaction, await M.pantallaMenu({ userId, token, character, aviso }))
        } catch (e) {
            console.error("[Regalar] Modal:", e)
            return P.responder(interaction, await M.pantallaMenu({ userId, token, character, aviso: "ERROR" }))
        }
    }
})
