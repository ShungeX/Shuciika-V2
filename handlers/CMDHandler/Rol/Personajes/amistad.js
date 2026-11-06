// /rol amistad (antes /rol relacion). Tarjeta de amistad entre el personaje
// activo de quien usa el comando y el personaje activo del otro jugador.
const { SlashCommandSubcommandBuilder } = require("discord.js")
const { getActiveCharacter } = require("../../../../utils/getDataCharacters")
const { validarPareja, obtenerAmistad } = require("../../../../functions/Amistad/amistades")
const { FIRMA } = require("../../../../functions/Amistad/reglasAmistad")
const { construirMenuAmistad } = require("../../../../data/UI_ComponentsV2/menuInteraccion")

const efimero = (interaction, content) => interaction.reply({ content, flags: ["Ephemeral"] })

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("amistad")
        .setDescription("Mira cómo va la amistad de tu personaje con otro")
        .addUserOption(o =>
            o
                .setName("usuario")
                .setDescription("El otro jugador (se usa su personaje activo)")
        )
        .addIntegerOption(o =>
            o
                .setName("personaje")
                .setDescription("O ingresa la ID de un personaje")
                .setAutocomplete(true)
        ),
    requirements: {
        character: { obtener: true, required: true },
    },
    isDevOnly: false,
    enMantenimiento: false,

    /**
     * @param {import("discord.js").Client} client
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    ejecutar: async (client, interaction, { character }) => {
        const usuario = interaction.options.getUser("usuario")
        const pjId = interaction.options.getInteger("personaje")

        if (!pjId && !usuario) {
            return efimero(interaction, `¿Con quién quieres que revise tu amistad? Elige a un **usuario** o un **personaje** ${FIRMA}`)
        }

        let otro = null
        if (pjId) {
            ;({ character: otro } = await getActiveCharacter(null, { character: true, characterID: pjId }))
            if (!otro) return efimero(interaction, `No encuentro a ningún alumno con el ID **${pjId}** (・・ ) ?\n-# ¿Lo revisamos otra vez?`)
        } else {
            if (usuario.bot) return efimero(interaction, `Los bots no van a clases conmigo, así que no cuentan como amistad ${FIRMA}`)
            ;({ character: otro } = await getActiveCharacter(usuario.id, { character: true }))
            if (!otro) return efimero(interaction, `**${usuario.displayName ?? usuario.username}** todavía no tiene un personaje activo ${FIRMA}`)
        }

        const valida = validarPareja(character, otro)
        if (!valida.ok) return efimero(interaction, valida.texto)

        // Sin documento → tarjeta vacía (Desconocidos, 0 puntos).
        const { doc } = await obtenerAmistad(character._id, otro._id)

        return interaction.reply({
            components: construirMenuAmistad(doc, otro),
            flags: ["IsComponentsV2"],
            allowedMentions: { parse: [] },
        })
    },
}
