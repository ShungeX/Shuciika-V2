const {ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    ChatInputCommandInteraction,
    ComponentType,
    SeparatorSpacingSize,
    ThumbnailBuilder,} = require("discord.js") 

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const container = new ContainerBuilder()
    // header
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent("Bienvenidos a Shuciika")
    )
    // separator
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true)
    )
    // section with at least one TextDisplay
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("Texto de ejemplo")
        )
        // if you want a thumbnail, you must use ThumbnailBuilder:
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL("https://cdn.discordapp.com/embed/avatars/3.png")
        )
    )
    // action row of buttons
    .addActionRowComponents(
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId("hola")
            .setLabel("Holaa")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("disabled")
            .setLabel("Estoy deshabilitado")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
    );
  


    await interaction.reply({ components: [container], flags: "IsComponentsV2"})



}