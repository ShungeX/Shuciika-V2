module.exports = async (client, interaction) => {
    // Marca de llegada: /ping la usa para saber cuánto tarda el propio bot antes de responder
    interaction.recibidaEn = performance.now();
    if (!client.listo && interaction.isRepliable()) {
        await interaction.reply({
            content: "Todavía me estoy despertando, dame unos segunditos (￣▽￣)✿",
            flags: ["Ephemeral"]
        }).catch(() => {});
        return false; // corta la cadena: ningún otro archivo de interactionCreate corre
    }
};