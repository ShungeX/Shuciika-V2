// Escritura — trazar un sello.
// Cuadrícula de 4 filas × 5 columnas (20 nodos) + una fila de control (Reiniciar, Confirmar).
// El sello se muestra como un camino numerado durante el tiempo de lectura; luego se oculta y el
// jugador pulsa los nodos en orden y confirma. Puntaje = nodos correctos en su posición / total.
// La forma es única por hechizo (semilla).
const { JUEGOS } = require("../config")
const N = require("../nucleo")
const ui = require("./ui")

const CFG = JUEGOS.ESCRITURA

/** Cuadrícula de botones. `marcas`: nodo → número que se muestra; `activa`: se puede pulsar. */
function cuadricula(sesion, marcas, activa) {
    const filas = []
    for (let f = 0; f < CFG.FILAS; f++) {
        filas.push(ui.fila(Array.from({ length: CFG.COLUMNAS }, (_, c) => {
            const i = f * CFG.COLUMNAS + c
            const n = marcas.get(i)
            return n !== undefined
                ? ui.boton(sesion, null, "nodo", i, { emoji: CFG.NUMEROS[n], disabled: !activa, style: activa ? 1 : 2 })
                : ui.boton(sesion, CFG.NODO, "nodo", i, { disabled: !activa })
        })))
    }
    return filas
}

function vistaLectura(sesion) {
    const { sello, revelaHasta } = sesion.estado
    return ui.pantalla(sesion, [
        ui.texto("-# Memoriza el sello: sus nodos y el orden en que se trazan."),
        ui.texto(`-# El sello se ocultará ${ui.relativo(revelaHasta)}.`),
    ], [...cuadricula(sesion, new Map(sello.map((n, k) => [n, k])), false), ui.fila([ui.botonAbandonar(sesion)])])
}

function vistaTrazo(sesion) {
    const { sello, trazo } = sesion.estado
    return ui.pantalla(sesion, [
        ui.texto(`-# Traza el sello en el orden correcto y confirma. Nodos: **${trazo.length}/${sello.length}**.`),
    ], [
        ...cuadricula(sesion, new Map(trazo.map((n, k) => [n, k])), true),
        ui.fila([
            ui.boton(sesion, "Reiniciar", "reiniciar", "", { emoji: "↩️" }),
            ui.boton(sesion, "Confirmar", "confirmar", "", { style: 3, emoji: "✅", disabled: trazo.length === 0 }),
            ui.botonAbandonar(sesion),
        ]),
    ])
}

module.exports = {
    nombre: "escritura",
    disponible: () => true,

    async iniciar(interaction, sesion) {
        const { nodos, segundos } = N.dificultad(sesion.hechizo, "escritura")
        sesion.estado = {
            sello: N.selloEscritura(sesion.hechizo, Math.min(nodos, CFG.NUMEROS.length), { filas: CFG.FILAS, columnas: CFG.COLUMNAS }),
            trazo: [], fase: "lectura", revelaHasta: Date.now() + segundos * 1000,
        }
        await interaction.update(vistaLectura(sesion))
        sesion.interaccion = interaction
        sesion.temporizador(segundos * 1000, async () => {
            sesion.estado.fase = "trazo"
            await ui.editar(sesion, vistaTrazo(sesion))
        })
    },

    async accion(interaction, sesion, accion, arg) {
        const e = sesion.estado
        if (e.fase !== "trazo") return interaction.deferUpdate().catch(() => { })
        sesion.interaccion = interaction
        if (accion === "nodo") {
            const i = Number(arg)
            const valido = Number.isInteger(i) && i >= 0 && i < CFG.FILAS * CFG.COLUMNAS
            if (valido && !e.trazo.includes(i) && e.trazo.length < e.sello.length) e.trazo.push(i)
            return interaction.update(vistaTrazo(sesion))
        }
        if (accion === "reiniciar") {
            e.trazo = []
            return interaction.update(vistaTrazo(sesion))
        }
        if (accion === "confirmar" && e.trazo.length) {
            e.fase = "fin"
            await interaction.deferUpdate().catch(() => { })
            return sesion.terminar(N.puntajePosicional(e.sello, e.trazo))
        }
        return interaction.deferUpdate().catch(() => { })
    },
}
