// utils/personajeInactivo.js
// Un personaje queda con `Inactivo: true` cuando su dueño sale del servidor (functions/Miembros/salidas.js)
// y vuelve a estar activo si regresa. Mientras tanto nadie debería poder elegirlo como objetivo.

/** true si el personaje está marcado como inactivo. */
const esInactivo = (pj) => pj?.Inactivo === true

const TEXTO_INACTIVO = "Ese alumno no está en el Instituto ahora mismo, así que no puedo llevarle eso (｡•́︿•̀｡)"

module.exports = { esInactivo, TEXTO_INACTIVO }
