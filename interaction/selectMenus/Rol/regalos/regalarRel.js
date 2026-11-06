// Elegir destinatario desde las relaciones (menú de /rol regalar).
// customId: regalarRel-{userId}--{token}-{pagina}   value: _id del personaje
const { crearStringSelectMenu } = require("../../../../utils/constructores/crearComponente")
const M = require("../../../../functions/Regalos/menuRegalar")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearStringSelectMenu({
    customId: "regalarRel",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },
    optionNames: ["pjId"],

    ejecutar: async ({ interaction, character, componentData: { extras }, options: { pjId } }) => {
        const [token, pagina] = extras
        const userId = interaction.user.id
        if (!M.sesionMenu(userId, character, token)) return P.responder(interaction, M.menuCerrado())

        const codigo = await M.ponerDestino({ token, character, idTxt: pjId })
        if (codigo) return P.responder(interaction, await M.pantallaRelaciones({ userId, token, character, pagina: Number(pagina) || 0, aviso: codigo }))
        return P.responder(interaction, await M.pantallaMenu({ userId, token, character }))
    }
})
