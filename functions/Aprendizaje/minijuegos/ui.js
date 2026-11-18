// Piezas comunes de interfaz de los minijuegos (Components V2, mensajes efímeros).
const { crearCustomId } = require("../../../utils/constructores/customId")
const { UI } = require("../config")
const { nombreEscalon } = require("../nucleo")

const ACCION = "practica"
const texto = (content) => ({ type: 10, content })
const divisor = () => ({ type: 14, divider: true, spacing: 1 })
const fila = (components) => ({ type: 1, components })

/** custom_id de un botón del minijuego: practica-{userId}--{sesionId}-{accion}-{arg} */
const idBoton = (sesion, accion, arg = "") =>
    crearCustomId({ action: ACCION, userId: sesion.userId, characterId: "", extras: [sesion.id, accion, arg] })

function boton(sesion, label, accion, arg = "", { style = 2, emoji, disabled = false } = {}) {
    return {
        type: 2, style, disabled,
        ...(label ? { label } : {}),
        ...(emoji ? { emoji: { name: emoji } } : {}),
        custom_id: idBoton(sesion, accion, arg),
    }
}

const botonAbandonar = (sesion) => boton(sesion, "Abandonar", "abandonar", "", { style: 4 })

/** Marca de tiempo relativa de Discord (cuenta atrás que se actualiza sola). */
const relativo = (ms) => `<t:${Math.ceil(ms / 1000)}:R>`

/** Encabezado: qué hechizo y qué vía se practica. */
function encabezado(sesion) {
    const via = sesion.via
    return `### ${UI.EMOJI_VIA[via] || "📜"} Práctica de ${UI.NOMBRE_VIA[via] || via}\n` +
        `-# «${sesion.hechizo.Nombre}» · ${nombreEscalon(sesion.hechizo)}`
}

/** Mensaje del minijuego listo para interaction.update / editReply. */
function pantalla(sesion, cuerpo, filas = []) {
    return {
        components: [{ type: 17, components: [texto(encabezado(sesion)), divisor(), ...cuerpo, ...(filas.length ? [divisor(), ...filas] : [])] }],
        allowedMentions: { parse: [] },
    }
}

/** Edita el mensaje de la sesión con la última interacción del jugador (sin romper si caducó). */
async function editar(sesion, payload) {
    try { await sesion.interaccion?.editReply(payload) }
    catch (e) { console.error(`[Aprendizaje] No se pudo editar la práctica ${sesion.id}:`, e.message) }
}

module.exports = { ACCION, texto, divisor, fila, idBoton, boton, botonAbandonar, relativo, encabezado, pantalla, editar }
