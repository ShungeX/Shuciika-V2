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
    
           let gifslonely = ['https://media1.tenor.com/m/1PnZNio67cQAAAAd/magia-sulfur-gushing-over-magical-girls.gif', 'https://media1.tenor.com/m/J4G_MGTaF_YAAAAd/kiriha-tsugumomo.gif', "https://tenor.com/es-MX/view/shield-gif-19995579"
           ]



    
           
           let randomlonly = gifslonely[Math.floor(Math.random() * gifslonely.length)]
           let randomgif = await getGifs(`shoot`) 
            let randomtext = [' Le disparó con sus dedos a ', ' Hizo *bang-bang* teatral a ', ' fingió dispararle a ', ' le disparó a ']
           let randomtexte = randomtext[Math.floor(Math.random() * randomtext.length)]
           let carita = [' (　-ω-)づ▄︻┻┳═一', '  ヾ(≧へ≦)〃', ' (¬_¬")', ' ( •̀ ω •́ )✧']
           let randomcarita = carita[Math.floor(Math.random() * carita.length)]
    
    
        if(pjId) {
            if(!pjfind) {
                return interaction.reply({ content: `El personaje con el ID **${pjId}** no parece estar inscrito (・・ ) ?\nVerifica la ID`, ephemeral: true})
    
            }else if(!pjuser) {
                return interaction.reply({ content: "Esta opcion solo esta disponible con un **personaje registrado** (｡• ᵕ • ｡)\nSi quieres crear tu personaje usa **`/rol crear-personaje`**", ephemeral: true})
            }else if(pjfind.ID === pjuser.ID) {
                const embed = new EmbedBuilder()
                .setDescription("**" + `${pjfind.Nombre}` + "**  Se auto-disparo X﹏X")
                .setImage("https://media1.tenor.com/m/0Uf0-C5vSHMAAAAd/died-of-cringe-anime.gif")
                .setColor("Random")

                return interaction.reply({embeds: [embed]})
            }else {
                personajes()
            }
    

        }else if(!usuario2) {
            const embed = new EmbedBuilder()
            .setDescription("**" + `${user}` + "** Esta preparandose para disparar... =.=")
            .setImage("https://media1.tenor.com/m/J4nDubmJcJwAAAAd/gun-heart.gif")
            .setColor("Random")
            return interaction.reply({embeds: [embed]})
        }else if(usuario2) {
             
        if(usuario.id === user.id) {
            const embed = new EmbedBuilder()
            .setDescription("**" + `${user}` + "** Se auto-disparo X﹏X")
            .setImage("https://media1.tenor.com/m/0Uf0-C5vSHMAAAAd/died-of-cringe-anime.gif")
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
                    const shuciika = new EmbedBuilder()
                    .setDescription(`**${client.user.username}** bloquea el disparo de **${user.displayName}**`)
                    .setImage(randomlonly)
                    .setColor("Random")
                    return interaction.reply({embeds: [shuciika]})       
            }

            const interactext2 = interactCont.couple === 1 ? "¿Porque has hecho eso?": `${user.displayName} le ha disparado a ${usuario.displayName} un total de ${interactCont.couple} veces`
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
