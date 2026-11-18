// Stub de práctica (Fase 1): devuelve el puntaje configurado sin jugar nada.
// Sigue en uso para las vías cuyo minijuego está apagado en MINIJUEGOS (config.js).
const { STUB } = require("../config")

module.exports = {
    nombre: "stub",
    async iniciar(interaction, sesion) {
        await interaction.deferUpdate().catch(() => { })
        sesion.interaccion = interaction
        sesion.terminar(STUB.PUNTAJE, { stub: true })
    },
    async accion(interaction) {
        return interaction.deferUpdate().catch(() => { })
    },
}
