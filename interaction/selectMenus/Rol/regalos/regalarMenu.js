// Acciones del menú de /rol regalar.
// customId: regalarMenu-{userId}--{token}
// values: elegir | lumens | destino | relaciones | quitar | preview
const { crearStringSelectMenu } = require("../../../../utils/constructores/crearComponente")
const ui = require("../../../../data/UI_ComponentsV2/menuRegalo")
const M = require("../../../../functions/Regalos/menuRegalar")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearStringSelectMenu({
    customId: "regalarMenu",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },
    optionNames: ["accion"],

    ejecutar: async ({ interaction, character, componentData: { extras }, options: { accion } }) => {
        const [token] = extras
        const userId = interaction.user.id
        const s = M.sesionMenu(userId, character, token)
        if (!s) return P.responder(interaction, M.menuCerrado())

        if (accion === "elegir") {
            const opciones = await M.opcionesElegir({ userId, token, character })
            if (!opciones.length) return P.responder(interaction, await M.pantallaMenu({ userId, token, character, aviso: "SIN_OBJETOS_PAGINA" }))
            return interaction.showModal(ui.modalElegirRegalo({ userId, token, opciones }))
        }
        if (accion === "lumens") {
            if (s.seleccion?.tipo === "bolsa") return P.responder(interaction, await M.pantallaMenu({ userId, token, character, aviso: "LUMENS_CON_BOLSA" }))
            return interaction.showModal(ui.modalLumensSuelto({ userId, token, actual: s.lumens }))
        }
        if (accion === "destino") return interaction.showModal(ui.modalDestino({ userId, token }))
        if (accion === "relaciones") return P.responder(interaction, await M.pantallaRelaciones({ userId, token, character }))
        if (accion === "quitar") {
            s.seleccion = null
            s.lumens = 0
            return P.responder(interaction, await M.pantallaMenu({ userId, token, character }))
        }
        if (accion === "preview") {
            const r = await M.pantallaPreview({ userId, token, character })
            if (!r.ok) return P.responder(interaction, await M.pantallaMenu({ userId, token, character, aviso: r.codigo }))
            return P.responder(interaction, r.componentes)
        }
        return P.responder(interaction, await M.pantallaMenu({ userId, token, character }))
    }
})
