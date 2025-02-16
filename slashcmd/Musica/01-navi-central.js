const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, InteractionContextType, Client} = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders");
const subcommands = {
    musicaonline: require("../../handlers/CMDHandler/Musica/Radio online"),
    musicaupload: require("../../handlers/CMDHandler/Musica/upload_song"),
}

module.exports = {
    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
     


    ejecutar: async(client, interaction) => {
        const subcommand = interaction.options.getSubcommand()

        switch (subcommand) {
           case "radio":
                subcommands.musicaonline(client, interaction)
            break;

            case "subir_musica":
                subcommands.musicaupload(client, interaction)
                break;
        }

    },

    data: new SlashCommandBuilder()
    .setName("musica")
    .setDescription("Comandos de música")
    .setContexts(['Guild'])
    .addSubcommand(sub => 
        sub
        .setName("radio")
        .setDescription("Inicia la radio de Shuciika/Navi")
        .addStringOption(option => 
            option.setName("categoria")
            .setDescription("Elige una categoria de reproduccion")
            .setRequired(true)
            .addChoices(
                { name: "jp_songs", value: "A1"},
                { name: "anime_songs", value: "AN1"},
                { name: "ing_songs", value: "A2"}, 
                { name: "psk_songs", value: "PSK1"},
                { name: "random_songs", value: "RND"},
                { name: "kpop_songs", value: "KPOP1"}
            )
        )
        .addStringOption(select => 
            select.setName("options")
            .setDescription("Quita la pausa del AudioPlayer")
            .setRequired(false)
            .addChoices(
                { name: "unpause", value: "unpausepy"},
                { name: "pause", value: "pausepy"},
                { name: "destroy", value: "destroypy"}
            )
            )
)
    .addSubcommand(sub => 
        sub
        .setName("subir_musica")
        .setDescription("Agrega una nueva canción [¿permanente?] a la radio de Shuciika")
        .addStringOption(option => 
            option.setName("categoria")
            .setDescription("Elige la categoria del audio")
            .setRequired(true)
            .addChoices(
                { name: "jp_songs", value: "A1"},
                { name: "ing_songs", value: "A2"}, 
                { name: "psk_songs", value: "PSK1"},
                { name: "anime_songs", value: "AN1"},
                { name: "kpop_songs", value: "KPOP1"}
            )
        )
        .addAttachmentOption(file => 
            file.setName("audio")
            .setDescription("Envia el audio")
            .setRequired(true)
        )
        .addAttachmentOption(image => 
            image.setName("portada")
            .setDescription("Envia la portada")
            .setRequired(true)
        )
    ),

    deleted: false
}