// Modals del editor de regalos (se envían desde el mensaje del editor, así que
// responden actualizándolo).
// customId: regaloModal-{userId}--{token}-{tipo}
//   tipo: agregar | retirar (select "objeto" + "cantidad") | nota | banner (enlace o archivo) | lumens
const { crearModal } = require("../../../../utils/constructores/crearComponente")
const bolsa = require("../../../../functions/Regalos/bolsa")
const P = require("../../../../functions/Regalos/pantallas")
const c = require("../../../../functions/Regalos/comun")
const temporales = require("../../../../functions/imagenesTemporales")

const entero = (v) => (/^\s*\d+\s*$/.test(String(v ?? "")) ? parseInt(v, 10) : NaN)

module.exports = crearModal({
    customId: "regaloModal",
    soloAutor: true,
    // Llevan selects y campos variables: se leen de interaction.fields
    camposDinamicos: true,
    requirements: { character: { obtener: true, required: true } },

    ejecutar: async ({ interaction, character, componentData: { extras } }) => {
        const [token, tipo] = extras
        const userId = interaction.user.id
        const v = await P.validarEditor(userId, character, token)
        if (!v.ok) return P.responder(interaction, P.editorCerrado(v.codigo))
        const pjId = character._id
        const instanciaID = v.sesion.instanciaID
        let r, aviso

        try {
            if (tipo === "agregar" || tipo === "retirar") {
                const clave = interaction.fields.getStringSelectValues("objeto")?.[0]
                const cantidad = entero(interaction.fields.getTextInputValue("cantidad"))
                const [Region, ID] = String(clave || "").split(":")
                if (tipo === "agregar") {
                    r = await bolsa.agregarObjeto({ pjId, instanciaID, entrada: { ID: Number(ID), Region: Region || undefined }, cantidad })
                } else {
                    // Si saca más de las que hay, se saca todo (igual que quitar del pedido)
                    r = await bolsa.retirarObjeto({ pjId, instanciaID, ID: Number(ID), Region: Region || undefined, cantidad })
                }
                if (r.ok) aviso = `${tipo === "agregar" ? "➕ Agregaste" : "➖ Sacaste"} **${r.nombre} x${r.cantidad}**`
            } else if (tipo === "nota") {
                r = await bolsa.ponerNota({
                    pjId, instanciaID,
                    titulo: interaction.fields.getTextInputValue("titulo"),
                    nota: interaction.fields.getTextInputValue("nota"),
                })
                if (r.ok) aviso = "📝 Nota guardada"
            } else if (tipo === "banner") {
                // Prioridad: 1) enlace, 2) archivo subido. El enlace viene prellenado con el
                // banner actual: si no lo tocó y subió un archivo, cuenta el archivo.
                let url = String(interaction.fields.getTextInputValue("banner") ?? "").trim()
                const adjunto = temporales.archivoDelModal(interaction, "bannerArchivo")
                const actual = bolsa.datosRegalo(await bolsa.obtenerBolsa(pjId, instanciaID))?.banner || ""
                if (adjunto && url === actual) url = ""

                if (!url && adjunto) {
                    // Subir tarda más de 3 s: se difiere y responder() edita el editor
                    await interaction.deferUpdate()
                    const subida = await temporales.subirTemporal({ adjunto, uso: "regalo", userId })
                    if (!subida.ok) {
                        r = { ok: false, codigo: temporales.MENSAJES[subida.codigo] || "BANNER_INVALIDO" }
                    } else {
                        r = await bolsa.ponerBanner({ pjId, instanciaID, url: subida.url })
                        if (!r.ok) await temporales.liberar(subida.url)
                    }
                } else {
                    r = await bolsa.ponerBanner({ pjId, instanciaID, url })
                }
                if (r.ok) aviso = "🖼️ Banner actualizado"
            } else if (tipo === "lumens") {
                r = await bolsa.ponerLumens({ pjId, instanciaID, total: entero(interaction.fields.getTextInputValue("lumens")) })
                if (r.ok) aviso = "✨ Lumens actualizados"
            } else {
                r = c.fallo("ESTRUCTURA")
            }
        } catch (e) {
            // Que un fallo nunca deje el modal "sin respuesta": se ve en el editor y en consola
            console.error(`[Regalos] Modal ${tipo}:`, e)
            r = c.fallo("ERROR")
        }

        return P.responder(interaction, await P.editor({ userId, token, pjId, aviso: r.ok ? aviso : r.codigo }))
    }
})
