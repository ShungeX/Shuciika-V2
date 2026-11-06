// Menú principal del editor de regalos.
// customId: regaloMenu-{userId}--{token}
const { crearStringSelectMenu } = require("../../../../utils/constructores/crearComponente")
const ui = require("../../../../data/UI_ComponentsV2/menuRegalo")
const cfg = require("../../../../config/regalos")
const bolsa = require("../../../../functions/Regalos/bolsa")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearStringSelectMenu({
    customId: "regaloMenu",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },
    optionNames: ["accion"],

    ejecutar: async ({ interaction, character, componentData: { extras }, options: { accion } }) => {
        const [token] = extras
        const userId = interaction.user.id
        const v = await P.validarEditor(userId, character, token)
        if (!v.ok) return P.responder(interaction, P.editorCerrado(v.codigo))
        const pjId = character._id
        const redibujar = async (aviso) => P.responder(interaction, await P.editor({ userId, token, pjId, aviso }))

        // Agregar / retirar: modal con select + cantidad (como "Agregar al pedido" de las tiendas)
        if (accion === "agregar") {
            const opciones = await P.opcionesAgregar({ userId, token, pjId })
            if (!opciones.length) return redibujar("SIN_OBJETOS_PAGINA")
            return interaction.showModal(ui.modalObjeto({ userId, token, modo: "agregar", opciones }))
        }
        if (accion === "retirar") {
            const opciones = await P.opcionesRetirar({ userId, token, pjId })
            if (!opciones.length) return redibujar("VACIO")
            return interaction.showModal(ui.modalObjeto({ userId, token, modo: "retirar", opciones }))
        }
        if (accion === "preview") {
            return P.responder(interaction, await P.vistaPreviaEditor({ userId, token, character }))
        }

        const entrada = await bolsa.obtenerBolsa(pjId, v.sesion.instanciaID)
        if (!entrada || bolsa.estadoDe(entrada) !== "armando") return redibujar()
        const datos = bolsa.datosRegalo(entrada)

        if (accion === "color") {
            if (!cfg.permiteColor(entrada)) return redibujar("COLOR_NO_PERMITIDO")
            return P.responder(interaction, ui.construirSelectorColor({ userId, token, actual: datos.color }))
        }
        if (accion === "nota") return interaction.showModal(ui.modalNota({ userId, token, titulo: datos.titulo, nota: datos.nota }))
        if (accion === "banner") {
            if (!cfg.permiteBanner(entrada)) return redibujar("BANNER_NO_PERMITIDO")
            return interaction.showModal(ui.modalBanner({ userId, token, actual: datos.banner || "" }))
        }
        if (accion === "lumens") return interaction.showModal(ui.modalLumens({ userId, token, actual: datos.lumens }))

        return redibujar()
    }
})
