module.exports = async (client, interaction) => {
    if (!client.listo && interaction.isRepliable()) {
        await interaction.reply({
            content: "Todavía me estoy despertando, dame unos segunditos (￣▽￣)✿",
            flags: ["Ephemeral"]
        }).catch(() => {});
        return false; // corta la cadena: ningún otro archivo de interactionCreate corre
    }
};