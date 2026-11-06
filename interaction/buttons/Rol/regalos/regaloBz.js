// Botones del detalle de un regalo dentro de /rol buzon.
// customId: regaloBz-{userId}--{accion}-{arg}[-{arg2}]
//   verpag-{id}-{pagina} | abrir-{id} | reportar-{id}
//   lista-{vista}-{pagina}: de mensajes viejos; ahora lleva al buzón unificado
const { crearBoton } = require("../../../../utils/constructores/crearComponente")
const ui = require("../../../../data/UI_ComponentsV2/menuRegalo")
const { texto } = require("../../../../config/mensajesRegalos")
const { crearCustomId } = require("../../../../utils/constructores/customId")
const regalos = require("../../../../functions/Regalos/regalos")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearBoton({
    customId: "regaloBz",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: false },
    },

    ejecutar: async ({ interaction, character, soul, componentData: { extras } }) => {
        const [accion, arg, arg2] = extras
        const userId = interaction.user.id

        if (accion === "lista") {
            return P.responder(interaction, await P.buzon({ userId, personaje: character, vista: arg, pagina: Number(arg2) || 0 }))
        }
        if (accion === "verpag") {
            return P.responder(interaction, await P.detalle({ userId, personaje: character, regaloId: arg, pagina: Number(arg2) || 0 }))
        }
        if (accion === "reportar") {
            return interaction.showModal(ui.modalReporte({ userId, regaloId: arg }))
        }
        if (accion === "abrir") {
            await interaction.deferUpdate()
            const r = await regalos.abrirRegalo({ personaje: character, alma: soul, regaloId: arg })
            if (!r.ok) {
                const lineas = [`> ${texto(r.codigo)}`]
                if (r.aviso) lineas.push(`-# ${r.aviso}`)
                return P.responder(interaction, await P.detalle({ userId, personaje: character, regaloId: arg, lineasExtra: lineas }))
            }
            const doc = (await regalos.obtenerRegalo({ personaje: character, regaloId: arg })).regalo
            const vista = P.resultadoApertura(character, r, doc)
            vista[0].components.push({
                type: 1,
                components: [
                    ui.boton(crearCustomId({ action: "regaloBz", userId, extras: ["verpag", arg, 0] }), "Ver regalo", 2, false, "🎀"),
                    ui.boton(crearCustomId({ action: "buzonBtn", userId, extras: ["lista", "nuevos", "todos", 0] }), "Volver al buzón", 2, false, "↩️"),
                ],
            })
            return P.responder(interaction, vista)
        }
        return P.responder(interaction, await P.buzon({ userId, personaje: character }))
    }
})
