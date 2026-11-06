// Botones del menú de /rol regalar.
// customId: regalarBtn-{userId}--{token}-{accion}[-{arg}]
//   cancelar ("Destruir regalo": cierra el menú) | volver | rel-{pagina} | prevpag-{pagina} | enviar
const { crearBoton } = require("../../../../utils/constructores/crearComponente")
const ui = require("../../../../data/UI_ComponentsV2/menuRegalo")
const { texto } = require("../../../../config/mensajesRegalos")
const M = require("../../../../functions/Regalos/menuRegalar")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearBoton({
    customId: "regalarBtn",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: false },
    },

    ejecutar: async ({ interaction, character, soul, componentData: { extras } }) => {
        const [token, accion, arg] = extras
        const userId = interaction.user.id
        if (!M.sesionMenu(userId, character, token)) return P.responder(interaction, M.menuCerrado())

        if (accion === "cancelar") {
            M.cerrarMenu(userId, token)
            return P.responder(interaction, M.menuCerrado("MENU_CANCELADO"))
        }
        if (accion === "rel") return P.responder(interaction, await M.pantallaRelaciones({ userId, token, character, pagina: Number(arg) || 0 }))
        if (accion === "prevpag") {
            const r = await M.pantallaPreview({ userId, token, character, pagina: Number(arg) || 0 })
            return P.responder(interaction, r.ok ? r.componentes : await M.pantallaMenu({ userId, token, character, aviso: r.codigo }))
        }
        if (accion === "enviar") {
            await interaction.deferUpdate()
            const r = await M.enviar({ userId, token, character, soul })
            if (!r.ok) return P.responder(interaction, await M.pantallaMenu({ userId, token, character, aviso: r.codigo }))
            return P.responder(interaction, ui.construirAviso({
                titulo: "¡Regalo enviado! 🎁",
                lineas: [`-# ${texto("ENVIADO")}`, `-# Para: **${r.destinatario.nombre}**`],
                color: 0x9DE0C2,
            }))
        }
        return P.responder(interaction, await M.pantallaMenu({ userId, token, character }))
    }
})
