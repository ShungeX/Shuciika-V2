// Botones del buzón.
// customId: buzonBtn-{userId}--lista-{vista}-{tipo}-{pagina} | buzonBtn-{userId}--borrar-{id}
const { crearBoton } = require("../../../../utils/constructores/crearComponente")
const datosBuzon = require("../../../../functions/Buzon/buzon")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = crearBoton({
    customId: "buzonBtn",
    soloAutor: true,
    requirements: { character: { obtener: true, required: true } },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [accion, a, b, c] = extras
        const userId = interaction.user.id

        if (accion === "borrar") {
            const ok = await datosBuzon.borrar({ personaje: character, id: a })
            return P.responder(interaction, await P.buzon({
                userId, personaje: character,
                aviso: ok ? "Listo, lo borré de tu buzón ♡" : "No pude borrarlo; quizá ya no estaba (・・ ) ?",
            }))
        }
        return P.responder(interaction, await P.buzon({ userId, personaje: character, vista: a, tipo: b || "todos", pagina: Number(c) || 0 }))
    }
})
