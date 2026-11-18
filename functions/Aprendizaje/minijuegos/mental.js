// Mental — encontrar el glifo distinto.
// Cuadrícula de glifos casi iguales (3×3 hasta 4×4) con uno distinto; un tiempo generoso por ronda.
// Rondas según el escalón; el par y la posición salen de la semilla (_id + vía + ronda).
// Puntaje = rondas acertadas / total.
const { JUEGOS } = require("../config")
const N = require("../nucleo")
const ui = require("./ui")

const CFG = JUEGOS.MENTAL

function vistaRonda(sesion) {
    const e = sesion.estado
    const r = e.rondas[e.actual]
    const filas = []
    for (let f = 0; f < r.filas; f++) {
        filas.push(ui.fila(Array.from({ length: r.columnas }, (_, c) => {
            const i = f * r.columnas + c
            return ui.boton(sesion, i === r.distinto ? r.par[1] : r.par[0], "glifo", `${e.actual}.${i}`)
        })))
    }
    return ui.pantalla(sesion, [
        ui.texto(`-# Uno de estos glifos no es como los demás. Encuéntralo. Ronda **${e.actual + 1}/${e.rondas.length}**.`),
        ui.texto(`-# Tiempo de la ronda: termina ${ui.relativo(e.limiteRonda)}.`),
    ], [...filas, ui.fila([ui.botonAbandonar(sesion)])])
}

/** Pasa a la siguiente ronda o cierra el intento. */
async function avanzar(sesion, acierto, interaction = null) {
    const e = sesion.estado
    if (acierto) e.aciertos++
    e.actual++
    if (e.temporizadorRonda) { clearTimeout(e.temporizadorRonda); sesion.timers.delete(e.temporizadorRonda) }
    if (e.actual >= e.rondas.length) {
        e.fase = "fin"
        if (interaction) { await interaction.deferUpdate().catch(() => { }); sesion.interaccion = interaction }
        return sesion.terminar(e.aciertos / e.rondas.length)
    }
    programarRonda(sesion)
    if (interaction) { await interaction.update(vistaRonda(sesion)); sesion.interaccion = interaction }
    else await ui.editar(sesion, vistaRonda(sesion))
}

function programarRonda(sesion) {
    const e = sesion.estado
    e.limiteRonda = Date.now() + CFG.SEGUNDOS_RONDA * 1000
    const ronda = e.actual
    e.temporizadorRonda = sesion.temporizador(CFG.SEGUNDOS_RONDA * 1000, () => {
        if (sesion.estado.actual === ronda && sesion.estado.fase === "juego") avanzar(sesion, false)
    })
}

module.exports = {
    nombre: "mental",
    disponible: () => true,

    async iniciar(interaction, sesion) {
        const { rondas } = N.dificultad(sesion.hechizo, "mental")
        sesion.estado = {
            rondas: N.rondasMental(sesion.hechizo, rondas, { pares: CFG.PARES, cuadriculas: CFG.CUADRICULAS }),
            actual: 0, aciertos: 0, fase: "juego",
        }
        programarRonda(sesion)
        await interaction.update(vistaRonda(sesion))
        sesion.interaccion = interaction
    },

    async accion(interaction, sesion, accion, arg) {
        const e = sesion.estado
        const [ronda, i] = String(arg).split(".").map(Number)
        // Clics de una ronda ya pasada (o fuera de juego) no cuentan
        if (accion !== "glifo" || e.fase !== "juego" || ronda !== e.actual) return interaction.deferUpdate().catch(() => { })
        return avanzar(sesion, i === e.rondas[e.actual].distinto, interaction)
    },
}
