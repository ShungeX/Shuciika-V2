// Movimiento — repetir una secuencia de gestos.
// 1. La secuencia se muestra como emojis durante el tiempo de lectura.
// 2. Se oculta y aparece una fila de botones con los gestos.
// 3. Cada pulsación actualiza el progreso. No termina al primer error: se completan todos los pasos.
// 4. Puntaje = pasos correctos en su posición / total.
const { JUEGOS } = require("../config")
const N = require("../nucleo")
const ui = require("./ui")

const GESTOS = JUEGOS.MOVIMIENTO.GESTOS
const emoji = (i) => GESTOS[i]?.emoji ?? "❔"

function vistaLectura(sesion) {
    const { secuencia, revelaHasta } = sesion.estado
    return ui.pantalla(sesion, [
        ui.texto("-# Observa la secuencia de gestos. Cuando se retire, repítela en el mismo orden."),
        ui.texto(`## ${secuencia.map(emoji).join(" ")}`),
        ui.texto(`-# La secuencia se ocultará ${ui.relativo(revelaHasta)}.`),
    ], [ui.fila([ui.botonAbandonar(sesion)])])
}

function vistaRespuesta(sesion) {
    const { secuencia, respuesta } = sesion.estado
    const hechos = respuesta.map(emoji).join(" ")
    const faltan = "▫️ ".repeat(secuencia.length - respuesta.length).trim()
    return ui.pantalla(sesion, [
        ui.texto(`-# Repite la secuencia. Paso **${respuesta.length}/${secuencia.length}**.`),
        ui.texto(`## ${[hechos, faltan].filter(Boolean).join(" ")}`),
    ], [
        ui.fila(GESTOS.map((g, i) => ui.boton(sesion, null, "gesto", i, { emoji: g.emoji }))),
        ui.fila([ui.botonAbandonar(sesion)]),
    ])
}

module.exports = {
    nombre: "movimiento",
    disponible: () => true,

    async iniciar(interaction, sesion) {
        const { pasos, segundos } = N.dificultad(sesion.hechizo, "movimiento")
        sesion.estado = {
            secuencia: N.secuenciaGestos(sesion.hechizo, pasos, GESTOS.length),
            respuesta: [], fase: "lectura", revelaHasta: Date.now() + segundos * 1000,
        }
        await interaction.update(vistaLectura(sesion))
        sesion.interaccion = interaction
        sesion.temporizador(segundos * 1000, async () => {
            sesion.estado.fase = "respuesta"
            await ui.editar(sesion, vistaRespuesta(sesion))
        })
    },

    async accion(interaction, sesion, accion, arg) {
        const e = sesion.estado
        const i = Number(arg)
        if (accion !== "gesto" || e.fase !== "respuesta" || !Number.isInteger(i) || !GESTOS[i]) {
            return interaction.deferUpdate().catch(() => { })
        }
        e.respuesta.push(i)
        sesion.interaccion = interaction
        if (e.respuesta.length < e.secuencia.length) return interaction.update(vistaRespuesta(sesion))
        e.fase = "fin"
        await interaction.deferUpdate().catch(() => { })
        sesion.terminar(N.puntajePosicional(e.secuencia, e.respuesta))
    },
}
