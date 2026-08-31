// interactions/manejarComponente.js
const { EmbedBuilder } = require("discord.js")
const { splitCustomId } = require("../utils/constructores/customId")
const { construirOptions } = require("../utils/constructores/construirOptions")
const { getCharacterData } = require("../utils/getDataCharacters")

const usuariosEnProceso = new Set();

/** @typedef {import('../utils/types').TipoComponente} TipoComponente */
/** @typedef {import('../utils/types').ComponentConfig} ComponentConfig */

/**
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Interaction} interaction
 * @param {ComponentConfig[]} handlers
 * @param {TipoComponente} tipo
 * @returns {Promise<void>}
 */

async function manejarComponente(client, interaction, handlers, tipo) {
    const [action, userId, characterIdRaw, ...extras] = splitCustomId(interaction.customId)
    let characterId = characterIdRaw ? Number(characterIdRaw) : null
    if (characterId !== null && isNaN(characterId)) characterId = null

    const handler = handlers.find(h => h.customId === action)
    if (!handler) {
        return interaction.reply({ content: "Esta interacción no tiene ninguna función!", flags: ["Ephemeral"] })
    }

    if (handler.soloAutor && userId !== interaction.user.id) {
        const embed = new EmbedBuilder()
            .setDescription(`<@!${userId}> Solo puede responder a esta interacción /(ㄒoㄒ)/~~`)
            .setColor("Red")
        return interaction.reply({ embeds: [embed], flags: ["Ephemeral"] })
    }

    // Prevenir doble clic rápido / race condition mientras se procesa otra acción del usuario
    if (usuariosEnProceso.has(interaction.user.id)) {
        if (!interaction.replied && !interaction.deferred) {
            return interaction.deferUpdate().catch(() => { });
        }
        return;
    }

    usuariosEnProceso.add(interaction.user.id);

    try {
        const requirements = handler.requirements || {}
        const { character, soul, cachepj } = await getCharacterData(interaction.user.id, requirements, characterId)

        if (requirements.character?.required && !character) {
            return interaction.reply({ content: "No se encontró ese personaje 〒▽〒", flags: ["Ephemeral"] })
        }
        if (requirements.soul?.required && !soul) {
            return interaction.reply({ content: "Este personaje necesita despertar su poder para esto 〒▽〒", flags: ["Ephemeral"] })
        }
        if (requirements.cachepj?.required && !cachepj) {
            return interaction.reply({ content: "Necesitas tener un personaje en proceso de registro 〒▽〒", flags: ["Ephemeral"] })
        }

        await handler.ejecutar({
            client,
            interaction,
            character, soul, cachepj,
            componentData: { userId, characterId, extras },
            options: construirOptions(interaction, tipo, handler),
        })

    } catch (e) {
        console.log(`Ocurrio un error al ejecutar el componente (${tipo})!`, e)
    } finally {
        usuariosEnProceso.delete(interaction.user.id);
    }
}

module.exports = { manejarComponente }