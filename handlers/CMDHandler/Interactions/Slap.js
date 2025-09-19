const incInteractions = require("../../../functions/incInteractions")
const clientdb = require("../../../Server")
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const db = clientdb.db("Interaccion")
const db2 = clientdb.db("Rol_db")
const getXp = require("../../../functions/getXP")
const getGifs = require("../../../functions/getGifs")
const newGetXP = require("../../../functions/newGetXP")


     /**
     * 
     * @param {Client} client
     * @param {ChatInputCommandInteraction} interaction 
     */
module.exports = async(client, interaction) => {

            const interactionRolType = 5
            const SubCommand = interaction.options.getSubcommand()
            const user = interaction.member
            const pjId = interaction.options.getInteger("personaje")
            const usuario2 = interaction.options.getUser("usuario") 
            const usuario = usuario2 ? interaction.guild.members.cache.get(usuario2.id) : null
            const dbpj = db2.collection("Personajes")
            const rel = db2.collection("Relaciones_pj")
            const contadorS = db.collection("ContadorS")
            const contadorC = db.collection("ContadorC")
            const pjfind = await dbpj.findOne({ID: pjId})
            const pjuser = await dbpj.findOne({_id: user.id})
    
           let gifslonely = ['https://acegif.com/wp-content/gif/anime-hug-18.gif', 'https://acegif.com/wp-content/gif/anime-hug-39.gif'
           ]



    
           
           let randomlonly = gifslonely[Math.floor(Math.random() * gifslonely.length)]
           let randomgif = await getGifs(`${SubCommand}`) 
            let randomtext = [' Le dio una cachetada a ', ' Le dio una bofetada épica a ', ' Le lanzó un guantazo a ', ' Abofeteó con drama a ']
           let randomtexte = randomtext[Math.floor(Math.random() * randomtext.length)]
           let carita = [' (＃｀д´)ﾉ', ' ╰（‵□′）╯', ' (¬_¬")', ' .·´¯`(>▂<)´¯`·. ']
           let randomcarita = carita[Math.floor(Math.random() * carita.length)]
    
    
        if(pjId) {
            if(!pjfind) {
                return interaction.reply({ content: `El personaje con el ID **${pjId}** no parece estar inscrito (・・ ) ?\nVerifica la ID`, ephemeral: true})
    
            }else if(!pjuser) {
                return interaction.reply({ content: "Esta opcion solo esta disponible con un **personaje registrado** (｡• ᵕ • ｡)\nSi quieres crear tu personaje usa **`/rol crear-personaje`**", ephemeral: true})
            }else if(pjfind.ID === pjuser.ID) {
                const embed = new EmbedBuilder()
                .setDescription("**" + `${pjfind.Nombre}` + "** Tiene ganas de golpear a alguien (๑•̀ㅂ•́)و✧")
                .setImage("https://media1.tenor.com/m/Ktd3wl6JEEMAAAAC/punch-anime-girl-punch.gif")
                .setColor("Random")

                return interaction.reply({embeds: [embed]})
            }else {
                personajes()
            }
    

        }else if(!usuario2) {
            const embed = new EmbedBuilder()
            .setDescription("**" + `${user}` + "** Tiene ganas de golpear a alguien (๑•̀ㅂ•́)و✧")
            .setImage("https://media1.tenor.com/m/Ktd3wl6JEEMAAAAC/punch-anime-girl-punch.gif")
            .setColor("Random")
            return interaction.reply({embeds: [embed]})
        }else if(usuario2) {
             
        if(usuario.id === user.id) {
            const embed = new EmbedBuilder()
            .setDescription("**" + `${user}` + "** Tiene ganas de golpear a alguien (๑•̀ㅂ•́)و✧")
            .setImage("https://media1.tenor.com/m/Ktd3wl6JEEMAAAAC/punch-anime-girl-punch.gif")
            .setColor("Random")

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

                if(interactCont.couple < 3) {
                    const shuciika = new EmbedBuilder()
                    .setDescription(`¡¿Que estas intentando hacer?! ＞﹏＜`)
                    .setImage("https://media1.tenor.com/m/MVzw9v4ORpEAAAAC/bocchi-the-rock-bocchi.gif")
                    .setColor("Random")
                    return interaction.reply({embeds: [shuciika]})

                }else {
                    const shuciika = new EmbedBuilder()
                    .setDescription(`BASTA ${user} ╰（‵□′）╯\n-# ${client.user.username} te ha dado una cachetada`)
                    .setColor("Random")
                    .setImage(randomgif.url)
                    .setFooter({text: `Anime: ${randomgif.anime_name}`})
                    return interaction.reply({embeds: [shuciika]})
                }

            }

            const interactext2 = interactCont.couple === 1 ? "¿Porque has hecho eso?": `${user.displayName} a bofeteado a ${usuario.displayName} un total de ${interactCont.couple} veces`
            const interactionEmbed = new EmbedBuilder()
            .setDescription("**" + user.displayName + "**" + randomtexte + "**" + usuario.displayName + "**" + randomcarita + `\n-# ${interactext2}`)
            .setColor("Random")
            .setImage(randomgif.url)
            .setFooter({text: `Anime: ${randomgif.anime_name}`})
             return interaction.reply({embeds: [interactionEmbed]})
        }
    
        async function personajes() {
            const characterInEmbed = new EmbedBuilder()
            .setDescription("**" + pjuser.Nombre + "**" + `${randomtexte}` + "**" + pjfind.Nombre + "**" + `${randomcarita}`)
            .setImage(randomgif.url)
            .setColor("Random")
            .setFooter({text: `Anime: ${randomgif.anime_name}`})



            const result = await newGetXP(client, interaction, interaction.user, pjuser.ID, pjfind.ID, interactionRolType)
    
            
            if(result.xp) {
                characterInEmbed.setDescription("**" + pjuser.Nombre + "**" + `${randomtexte}` + "**" + pjfind.Nombre + "**" + `${randomcarita}` + `\n-# Puntos de Enemistad ganados: - ${result.xp}`)
               
            }
            if(result.levelUp) {
                characterInEmbed.setFooter({ text:`Han subido al nivel:  +${result.lv}`})
            }

            await interaction.reply({embeds: [characterInEmbed]})
            
        }
}
