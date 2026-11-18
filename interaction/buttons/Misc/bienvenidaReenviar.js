const { crearBoton } = require("../../../utils/constructores/crearComponente")
const { ACCION_REENVIAR, enviarCartaMD, cartaYaEnviada } = require("../../../functions/Miembros/bienvenida")

// Botón "Reenviar mi bienvenida" del mensaje del canal: cualquiera puede pedir su propia carta, una sola vez
module.exports = crearBoton({
    customId: ACCION_REENVIAR,

    ejecutar: async ({ interaction }) => {
        await interaction.deferReply({ flags: ["Ephemeral"] })

        if (await cartaYaEnviada(interaction.user.id)) {
            return interaction.editReply("✖ Ya te la envié una vez, así que no puedo mandarla otra vez. Si sigue sin llegar, abre un ticket en <#1545624833704984596>.")
        }

        const enviada = await enviarCartaMD(interaction.user, interaction.guild?.name ?? "Instituto Mágico Shuciika", "boton")
        return interaction.editReply(enviada
            ? "✔ Listo, revisa tu bandeja de entrada ♡( ◡‿◡ )"
            : "✖ Sigo sin poder entrar a tu bandeja. Activa \"Mensajes directos\" en la privacidad del servidor y pulsa de nuevo.")
    }
})
