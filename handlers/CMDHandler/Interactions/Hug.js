const incInteractions = require("../../../functions/incInteractions")
const clientdb = require("../../../Server")
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType} = require(`discord.js`)
const db = clientdb.db("Interaccion")
const db2 = clientdb.db("Rol_db")
const newGetXP = require("../../../functions/newGetXP")


     /**
     * 
     * 
     * @param {ChatInputCommandInteraction} interaction 
     */
module.exports = async(client, interaction) => {

            const interactionRolType = 3
            const SubCommand = interaction.options.getSubcommand()
            const user = interaction.member
            const pjId = interaction.options.getInteger("personaje")
            const usuario2 = interaction.options.getUser("usuario") 
            const usuario = usuario2 ? interaction.guild.members.cache.get(usuario2.id) : null
            const dbpj = db2.collection("Personajes")
            const rel = db2.collection("Relaciones_pj")
            const contadorS = db.collection("ContadorS")
            const contadorC = db.collection("ContadorC")
            const interactdb = clientdb.db("Interaccion_gifs")
            const interactgifs = interactdb.collection("Hug")
            const pjfind = await dbpj.findOne({ID: pjId})
            const pjuser = await dbpj.findOne({_id: user.id})
            
           let gifsinteraction = await interactgifs.findOne({_id: interaction.guild.id})
    
           let gifslonely = ['https://acegif.com/wp-content/gif/anime-hug-18.gif', 'https://acegif.com/wp-content/gif/anime-hug-39.gif'
           ]



    
           
           let randomlonly = gifslonely[Math.floor(Math.random() * gifslonely.length)]
           let randomgif = gifsinteraction.gifs[Math.floor(Math.random() * gifsinteraction.gifs.length)] 
            let randomtext = [' Le dio un abrazo a ', ' Le dio un pequeño abrazo a ', ' Le dio un abrazo fuerte a ', ' abrazo tiernamente a ']
           let randomtexte = randomtext[Math.floor(Math.random() * randomtext.length)]
           let carita = [' (つ≧▽≦)つ ', ' (*/▽＼*)', ' (⊃｡•́‿•̀｡)⊃ ', ' (⌒_⌒;) ']
           let randomcarita = carita[Math.floor(Math.random() * carita.length)]
    
    
        if(pjId) {
            if(!pjfind) {
                return interaction.reply({ content: `El personaje con el ID **${pjId}** no parece estar inscrito (・・ ) ?\nVerifica la ID`, ephemeral: true})
    
            }else if(!pjuser) {
                return interaction.reply({ content: "Esta opcion solo esta disponible con un **personaje registrado** (｡• ᵕ • ｡)\nSi quieres crear tu personaje usa **`/rol crear-personaje`**", ephemeral: true})
            }else if(pjfind.ID === pjuser.ID) {
                const embed = new EmbedBuilder()
                .setDescription("**" + `Tranquilo ${pjuser.Nombre}, yo te doy un abrazo **` +  randomcarita + `\n-# Has recibido un abrazo de ${client.user.username}`)
                .setColor("Random")
                .setImage(randomgif)

                return interaction.reply({embeds: [embed]})
            }
    
            personajes()
        }else if(!usuario2) {
            const embed = new EmbedBuilder()
            .setDescription('**' + `${user}` +'** Necesita un abrazo (｡•́︿•̀｡)')
            .setColor("Random")
            .setImage(randomlonly)
            return interaction.reply({embeds: [embed]})
        }else if(usuario2) {
             
        if(usuario.id === user.id) {
            const embed = new EmbedBuilder()
            .setDescription("**" + `Tranquilo ${user}, yo te doy un abrazo **` +  randomcarita + `\n-# Has recibido un abrazo de ${client.user.username}`)
            .setColor("Random")
            .setImage(randomgif)

            return interaction.reply({embeds: [embed]})
           }
            member()
        }else {
            return interaction.reply({content: "Ha Ocurrido un error", ephemeral: true})
        }
    
    
        async function member() {
            
        const incInteractions = require("../../../functions/incInteractions")

        const interactCont =  await incInteractions(interaction, usuario.id, SubCommand, true)
   

            if(usuario.id === client.user.id) {
                const interactxt = interactCont.couple === 1 ? "Es el primer abrazo que me das": `Me has abrazado ${interactCont.couple} veces ♡`
                const shuciika = new EmbedBuilder()
                .setDescription(`Gracias ${user} por el abrazo („• ֊ •„ ) ♡` + `\n-# ${interactxt}`)
                .setColor("Random")
                .setImage(randomgif)
                return interaction.reply({embeds: [shuciika]})
            }

            const interactext2 = interactCont.couple === 1 ? "Es el primer abrazo que se dan (≧◡≦) ♡": `${user.displayName} y ${usuario.displayName} Se han abrazado un total de ${interactCont.couple} veces 🫂`
            const interactionEmbed = new EmbedBuilder()
            .setDescription("**" + user.displayName + "**" + randomtexte + "**" + usuario.displayName + "**" + randomcarita + `\n-# ${interactext2}`)
            .setColor("Random")
            .setImage(randomgif)
             return interaction.reply({embeds: [interactionEmbed]})
        }
    
        async function personajes() {
            const characterInEmbed = new EmbedBuilder()
            .setDescription("**" + pjuser.Nombre + "**" + `${randomtexte}` + "**" + pjfind.Nombre + "**" + `${randomcarita}`)
            .setImage(randomgif)
            .setColor("Random")

            const result = await newGetXP(client, interaction, interaction.user, pjuser.ID, pjfind.ID, interactionRolType)

            console.log("resultado", result)
    
            
            if(result.xp) {
                characterInEmbed.setDescription("**" + pjuser.Nombre + "**" + `${randomtexte}` + "**" + pjfind.Nombre + "**" + `${randomcarita}` + `\n-# Puntos de Amistad ganados: + ${result.xp}`) 
            }
            if(result.levelUp) {
                characterInEmbed.setFooter({ text:`Han subido al nivel de amistad:  ${result.lv}`})
            }

            await interaction.reply({embeds: [characterInEmbed]})
            
        }
}
