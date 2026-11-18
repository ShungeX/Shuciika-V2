// Hablado — reescribir la invocación de memoria.
// 1. Mensaje con la invocación y un temporizador de lectura.
// 2. Al terminar, se edita el mensaje: el texto se oculta y aparece "Recitar".
// 3. "Recitar" abre un modal (se abre al pulsar, dentro de los 3 s de la interacción).
// 4. Puntaje = 1 − Levenshtein / longitud sobre texto normalizado (en el servidor).
const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle } = require("discord.js")
const { crearCustomId } = require("../../../utils/constructores/customId")
const N = require("../nucleo")
const ui = require("./ui")

const MODAL = "practicaRecitar"

function vistaLectura(sesion) {
    return ui.pantalla(sesion, [
        ui.texto("-# Lee con atención la invocación. Cuando el tiempo termine, el Instituto te pedirá recitarla de memoria."),
        ui.texto(`> *${sesion.estado.texto}*`),
        ui.texto(`-# El texto se ocultará ${ui.relativo(sesion.estado.revelaHasta)}.`),
    ], [ui.fila([ui.botonAbandonar(sesion)])])
}

function vistaRecitar(sesion) {
    return ui.pantalla(sesion, [
        ui.texto("-# La invocación se ha retirado de la vista. Recítala tal como la leíste: palabra por palabra."),
    ], [ui.fila([
        ui.boton(sesion, "Recitar", "recitar", "", { style: 1, emoji: "🗣️" }),
        ui.botonAbandonar(sesion),
    ])])
}

module.exports = {
    nombre: "hablado",
    /** Solo se juega si el hechizo tiene su invocación escrita. */
    disponible: (hechizo) => Boolean(String(hechizo?.Invocacion ?? "").trim()),

    async iniciar(interaction, sesion) {
        const { segundos } = N.dificultad(sesion.hechizo, "hablado")
        sesion.estado = { texto: String(sesion.hechizo.Invocacion).trim(), fase: "lectura", revelaHasta: Date.now() + segundos * 1000 }
        await interaction.update(vistaLectura(sesion))
        sesion.interaccion = interaction
        sesion.temporizador(segundos * 1000, async () => {
            sesion.estado.fase = "recitar"
            await ui.editar(sesion, vistaRecitar(sesion))
        })
    },

    async accion(interaction, sesion, accion) {
        if (accion !== "recitar" || sesion.estado.fase !== "recitar") return interaction.deferUpdate().catch(() => { })
        const modal = new ModalBuilder()
            .setCustomId(crearCustomId({ action: MODAL, userId: sesion.userId, characterId: "", extras: [sesion.id] }))
            .setTitle("Recitar la invocación")
            .addLabelComponents(new LabelBuilder()
                .setLabel("Invocación")
                .setDescription("Escríbela de memoria")
                .setTextInputComponent(new TextInputBuilder()
                    .setCustomId("invocacion").setStyle(TextInputStyle.Paragraph).setMaxLength(400).setRequired(true)))
        return interaction.showModal(modal)
    },

    /** Respuesta del modal: se mide en el servidor y se cierra el intento. */
    async recitar(interaction, sesion) {
        if (sesion.estado.fase !== "recitar") return interaction.deferUpdate().catch(() => { })
        sesion.estado.fase = "fin"
        const respuesta = interaction.fields.getTextInputValue("invocacion")
        const puntaje = N.puntajeHablado(sesion.estado.texto, respuesta)
        await interaction.deferUpdate().catch(() => { })
        sesion.interaccion = interaction
        sesion.terminar(puntaje)
    },

    MODAL,
}
