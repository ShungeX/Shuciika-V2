// Modal del botón "Establecer foto" de /rol crear_ficha (y del editor de corrección).
// customId: fotoFicha-{userId}--
// Prioridad si se llenan los dos campos: 1) enlace, 2) archivo subido.
// El archivo se guarda como imagen temporal (functions/imagenesTemporales): al
// verificar la ficha, procesarFoto la pasa a Rol/Avatars y la temporal se borra.
const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, FileUploadBuilder } = require("discord.js")
const clientdb = require("../../../Server")
const { crearModal } = require("../../../utils/constructores/crearComponente")
const { crearCustomId } = require("../../../utils/constructores/customId")
const temporales = require("../../../functions/imagenesTemporales")

const Cachedb = clientdb.db("Rol_db").collection("CachePJ")
const ENLACE_IMAGEN = /^https?:\/\/.+\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i
const GUIA = "Si tienes dudas revisa el foro <#1330769969428041822>"

function construirModalFoto(userId, actual = "") {
    const enlace = new TextInputBuilder().setCustomId("fotoEnlace").setStyle(TextInputStyle.Short)
        .setRequired(false).setMaxLength(1000).setPlaceholder("https://...png / jpg / gif / webp")
    if (actual && actual.length <= 1000) enlace.setValue(actual)
    const archivo = new FileUploadBuilder().setCustomId("fotoArchivo").setRequired(false).setMinValues(0).setMaxValues(1)

    return new ModalBuilder()
        .setCustomId(crearCustomId({ action: "fotoFicha", userId }))
        .setTitle("Foto de perfil")
        .addLabelComponents(
            new LabelBuilder().setLabel("Enlace de la imagen")
                .setDescription("Tiene prioridad sobre el archivo. Vacía ambos para quitar la foto.")
                .setTextInputComponent(enlace),
            new LabelBuilder().setLabel("O sube una imagen desde tu galería")
                .setDescription("png, jpg, gif o webp · máx. 8 MB")
                .setFileUploadComponent(archivo),
        )
}

module.exports = crearModal({
    customId: "fotoFicha",
    soloAutor: true,
    camposDinamicos: true,
    construirModalFoto,

    ejecutar: async ({ interaction }) => {
        const userId = interaction.user.id
        // Subir el archivo puede tardar más de 3 s
        await interaction.deferReply({ flags: ["Ephemeral"] })

        const ficha = await Cachedb.findOne({ _id: userId }, { projection: { avatarURL: 1 } })
        const actual = ficha?.avatarURL || ""

        let url = String(interaction.fields.getTextInputValue("fotoEnlace") ?? "").trim()
        const adjunto = temporales.archivoDelModal(interaction, "fotoArchivo")
        // El enlace viene prellenado con la foto actual: si no lo tocó y subió un archivo, cuenta el archivo
        if (adjunto && url === actual) url = ""

        let nueva = null
        if (url) {
            if (!ENLACE_IMAGEN.test(url)) {
                return interaction.editReply({ content: `Tu link parece no ser válido, verifica que sea una imagen (png, jpg, gif o webp).\n-# ${GUIA}` })
            }
            nueva = url
        } else if (adjunto) {
            const subida = await temporales.subirTemporal({ adjunto, uso: "ficha", userId })
            if (!subida.ok) return interaction.editReply({ content: `${temporales.MENSAJES[subida.codigo]}\n-# ${GUIA}` })
            nueva = subida.url
        }

        if (nueva === (actual || null)) {
            return interaction.editReply({ content: nueva ? "Tu ficha ya tiene esa foto (・・ ) ?" : "No escribiste un enlace ni subiste una imagen." })
        }

        await Cachedb.updateOne({ _id: userId }, {
            $setOnInsert: { created: Date.now() },
            ...(nueva ? { $set: { avatarURL: nueva } } : { $unset: { avatarURL: "" } }),
        }, { upsert: true })

        // Si la foto anterior era una imagen subida, se borra ya
        if (actual) await temporales.liberar(actual)

        const { updateMessage } = require("./Modal crearFicha")
        const { marcarCorreccionUsada } = require("../../selectMenus/Rol/verificar_ficha")
        await marcarCorreccionUsada(userId, "avatarURL")
        try {
            await updateMessage(interaction, null, null, true, { action: "avatarURL", option: nueva })
        } catch (e) {
            console.log("No se pudo actualizar el mensaje de la ficha (foto)", e)
        }

        return interaction.editReply({ content: nueva ? "✅ Tu foto de perfil ha sido actualizada." : "🗑️ Quitaste la foto de perfil de tu ficha." })
    }
})
