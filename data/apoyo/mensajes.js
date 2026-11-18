// data/apoyo/mensajes.js
// Mensajes de la etiqueta de apoyo en /rol perfil (voz de Shuciika). Se elige uno al azar en cada render
// y no se guarda. Edita libremente: un texto vacío se ignora (nunca se muestra una línea "-#" sin texto).
// Nunca menciones el tipo de apoyo, montos, boost, mensual ni donación.

const EMOJI_CORAZON = "<:KSH_RACoraamarillo:853434010281967657>"

/** Cuando el dueño se ve a sí mismo */
const MENSAJES_DUEÑO = [
    `Gracias por tu apoyo ${EMOJI_CORAZON}`,
    "Gracias por cuidar de este lugar. Lo noto, aunque no siempre lo diga. ♡( ◡‿◡ )",
    "Cada luz del instituto que sigue encendida lleva un poquito de ti.",
    "Guardo tu nombre entre las cosas que me hacen sentir en casa.",
    `Si el instituto sigue de pie, es en parte por personas como tú. ${EMOJI_CORAZON}`
]

/** Cuando otra persona mira el perfil */
const MENSAJES_VISITANTE = [
    "Una de las personas que mantienen encendidas las luces del instituto.",
    "Alguien que cuida de este lugar.",
    "Le guardo un cariño especial a esta persona.",
    "Dejó un poquito de sí en este lugar."
]

/** Textos de la línea de etiqueta */
const ETIQUETA = {
    clave: "Apoyo:",
    activo: { antes: "🌸 ", palabra: "Support", despues: " ˚｡⋆" },
    algunaVez: "Support"
}

module.exports = { MENSAJES_DUEÑO, MENSAJES_VISITANTE, ETIQUETA, EMOJI_CORAZON }
