const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType} = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders")
const subcommands = {
    dance: require("../../handlers/CMDHandler/Interactions/DanceInteract")
}

module.exports = {
    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

ejecutar: async(client, interaction) => {
    const subcommand = interaction.options.getSubcommand()
    console.log("subcommand:", subcommand)


    switch(subcommand) {

        case "hug":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true})
            break;
        case "slap":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true}) 
            break;
        case "kiss":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true}) 
            break;
        case "pat":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true}) 
            break;
        case "bang":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true}) 
            break;
        case "bite":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true}) 
            break;
        case "cheeks":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true}) 
            break;
        case "lick":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true}) 
            break;
        case "cuddle":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true}) 
            break;
        case "highfive":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true}) 
            break;
        case "poke":
            interaction.reply({content: `¡En desarollo! - [${subcommand}]`, ephemeral: true}) 
            break;
            
        
    }
 },


 data: new SlashCommandBuilder()
 .setName("navi-interact")
 .setDescription("Interactua con algun miembro.")
 .setContexts([0])
 .addSubcommand((sub) => 
     sub
     .setName("slap")
     .setDescription("[🫲] Cachetea a un usuario o personaje. ¿Pero que te hizo? (´･ω･`)?")
     .addUserOption(user => 
         user.setName("usuario")
         .setDescription("Selecciona a tu acompañante (Usuario)")
         .setRequired(false)
     )
     .addIntegerOption(character => 
         character
         .setName("personaje")
         .setDescription("ingresa la ID del Alumno [Personaje]")
         .setMinValue(1)
         .setMaxValue(1000)
     )
 )
 .addSubcommand((sub) => 
     sub
     .setName("kiss")
     .setDescription("[💖] Besa a un usuario o alumno")
     .addUserOption(user => 
        user.setName("usuario")
        .setDescription("Selecciona a la persona (Usuario)")
        .setRequired(false)
    )
    .addIntegerOption(character => 
        character
        .setName("personaje")
        .setDescription("ingresa la ID del Alumno [Personaje]")
        .setMinValue(1)
        .setMaxValue(1000)
    )
 )
 .addSubcommand((sub) => 
    sub
    .setName("hug")
    .setDescription("[🫂] Abraza a un usuario o personaje")
    .addUserOption(user => 
       user.setName("usuario")
       .setDescription("Selecciona a la persona (Usuario)")
       .setRequired(false)
   )
   .addIntegerOption(character => 
       character
       .setName("personaje")
       .setDescription("ingresa la ID del Alumno [Personaje]")
       .setMinValue(1)
       .setMaxValue(1000)
   )
)
.addSubcommand((sub) => 
    sub
    .setName("pat")
    .setDescription("[🐾] Acaricia la cabeza de alguien")
    .addUserOption(user => 
       user.setName("usuario")
       .setDescription("Selecciona a la persona (Usuario)")
       .setRequired(false)
   )
   .addIntegerOption(character => 
       character
       .setName("personaje")
       .setDescription("ingresa la ID del Alumno [Personaje]")
       .setMinValue(1)
       .setMaxValue(1000)
   )
)
.addSubcommand((sub) => 
    sub
    .setName("bang")
    .setDescription(`[🔫] "Dispara" a un usuario o personaje`)
    .addUserOption(user => 
       user.setName("usuario")
       .setDescription("Selecciona a la persona (Usuario)")
       .setRequired(false)
   )
   .addIntegerOption(character => 
       character
       .setName("personaje")
       .setDescription("ingresa la ID del Alumno [Personaje]")
       .setMinValue(1)
       .setMaxValue(1000)
   )
)
.addSubcommand((sub) => 
    sub
    .setName("bite")
    .setDescription("[🐕] Muerde a un usario o personaje")
    .addUserOption(user => 
       user.setName("usuario")
       .setDescription("Selecciona a la persona (Usuario)")
       .setRequired(false)
   )
   .addIntegerOption(character => 
       character
       .setName("personaje")
       .setDescription("ingresa la ID del Alumno [Personaje]")
       .setMinValue(1)
       .setMaxValue(1000)
   )
)
.addSubcommand((sub) => 
    sub
    .setName("cheeks")
    .setDescription("[🤏] Pellizca los cachetes de un usuario o personaje")
    .addUserOption(user => 
       user.setName("usuario")
       .setDescription("Selecciona a la persona (Usuario)")
       .setRequired(false)
   )
   .addIntegerOption(character => 
       character
       .setName("personaje")
       .setDescription("ingresa la ID del Alumno [Personaje]")
       .setMinValue(1)
       .setMaxValue(1000)
   )
)
.addSubcommand((sub) => 
    sub
    .setName("lick")
    .setDescription("[😝] Lame a un miembro o personaje. ¿En serio quieres hacer eso? (。_。✿)")
    .addUserOption(user => 
       user.setName("usuario")
       .setDescription("Selecciona a la persona (Usuario)")
       .setRequired(false)
   )
   .addIntegerOption(character => 
       character
       .setName("personaje")
       .setDescription("ingresa la ID del Alumno [Personaje]")
       .setMinValue(1)
       .setMaxValue(1000)
   )
)
.addSubcommand((sub) => 
    sub
    .setName("cuddle")
    .setDescription("[🦐] Acúrrucate con un miembro o personaje. No me mires a mi... (´･ω･`)?")
    .addUserOption(user => 
       user.setName("usuario")
       .setDescription("Selecciona a tu acompañante (Usuario)")
       .setRequired(false)
   )
   .addIntegerOption(character => 
       character
       .setName("personaje")
       .setDescription("ingresa la ID del Alumno [Personaje]")
       .setMinValue(1)
       .setMaxValue(1000)
   )
)
.addSubcommand((sub) => 
    sub
    .setName("highfive")
    .setDescription("[🙌] Choca esos cinco con alguien o un Alumno. ¿Que celebramos? ( •̀ ω •́ )✧")
    .addUserOption(user => 
       user.setName("usuario")
       .setDescription("Selecciona a la persona (Usuario)")
       .setRequired(false)
   )
   .addIntegerOption(character => 
       character
       .setName("personaje")
       .setDescription("ingresa la ID del Alumno [Personaje]")
       .setMinValue(1)
       .setMaxValue(1000)
   )
)
.addSubcommand((sub) => 
    sub
    .setName("poke")
    .setDescription("[🫵] Fastidia a un usuario o personaje")
    .addUserOption(user => 
       user.setName("usuario")
       .setDescription("Selecciona a tu acompañante (Usuario)")
       .setRequired(false)
   )
   .addIntegerOption(character => 
       character
       .setName("personaje")
       .setDescription("ingresa la ID del Alumno [Personaje]")
       .setMinValue(1)
       .setMaxValue(1000)
   )
),
 deleted: false,
}