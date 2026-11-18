// ─── Minijuegos de práctica ─────────────────────────────────────────────────
// Una sola función que cada minijuego implementa:
//
//     iniciarPractica(interaction, pj, hechizo, via) → Promise<{ puntaje: 0..1 }>
//
// Diseñados para Discord, sin reflejos: memoria, orden o atención, con tiempos generosos.
// La promesa se resuelve cuando el intento termina (completado, abandonado o caducado). Quien
// la llama NO debe esperarla dentro del handler: el router bloquea al usuario mientras un handler
// corre, y el minijuego necesita sus siguientes clics.
const { MINIJUEGOS, STUB } = require("../config")
const sesiones = require("../sesiones")
const stub = require("./stub")

const JUEGOS = {
    hablado: require("./hablado"),
    movimiento: require("./movimiento"),
    mental: require("./mental"),
    escritura: require("./escritura"),
}

/** Minijuego que corresponde a una vía (el stub si su bandera está apagada o le faltan datos). */
function juegoPara(hechizo, via) {
    if (STUB.FORZAR) return stub
    const juego = JUEGOS[via]
    if (!juego || MINIJUEGOS[via] !== true) return stub
    if (juego.disponible && !juego.disponible(hechizo)) {
        console.warn(`[Aprendizaje] ${hechizo?._id} no tiene datos para el minijuego "${via}": se usa el stub.`)
        return stub
    }
    return juego
}

/**
 * Arranca el minijuego de la sesión activa del personaje (ya creada por servicio.iniciarIntento)
 * y responde a la interacción dentro de sus 3 s.
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {Object} pj - alma del personaje (Soul)
 * @param {Object} hechizo - normalizado
 * @param {string} via
 * @returns {Promise<{ puntaje: number, caducada?: boolean, abandonada?: boolean, stub?: boolean }>}
 */
async function iniciarPractica(interaction, pj, hechizo, via) {
    const sesion = sesiones.deAlma(pj._id)
    if (!sesion) throw new Error("[Aprendizaje] iniciarPractica sin sesión activa")
    const juego = juegoPara(hechizo, via)
    sesion.juego = juego
    sesion.interaccion = interaction
    try {
        await juego.iniciar(interaction, sesion)
    } catch (e) {
        // Si el minijuego no pudo ni mostrarse, no es culpa del jugador: puntaje 0 pero se marca
        console.error(`[Aprendizaje] El minijuego ${juego.nombre} falló al iniciar:`, e)
        sesion.terminar(0, { error: true })
    }
    return sesion.promesa
}

/** Clic en un botón del minijuego (customId practica-…-{sesionId}-{accion}-{arg}). */
async function accion(interaction, sesion, nombre, arg) {
    if (nombre === "abandonar") {
        await interaction.deferUpdate().catch(() => { })
        sesion.interaccion = interaction
        return sesion.terminar(0, { abandonada: true })
    }
    return sesion.juego.accion(interaction, sesion, nombre, arg)
}

module.exports = { iniciarPractica, accion, juegoPara, JUEGOS }
