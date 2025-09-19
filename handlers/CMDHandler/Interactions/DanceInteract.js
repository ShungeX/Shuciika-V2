const incInteractions = require("../../../functions/incInteractions")
const clientdb = require("../../../Server")
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType} = require(`discord.js`)
const db = clientdb.db("Interaccion")
const db2 = clientdb.db("Rol_db")
const getXp = require("../../../functions/getXP")
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
            const dancedb = clientdb.db("Interaccion_gifs")
            const dancegifs = dancedb.collection("Dance")
            const pjfind = await dbpj.findOne({ID: pjId})
            const pjuser = await dbpj.findOne({_id: user.id})
            
           let gifsinteraction = await dancegifs.findOne({_id: interaction.guild.id})
    
           let gifslonely = [
            "https://i.imgur.com/Qs9ty28.gif",
            "https://i.imgur.com/28zzdho.gif",
            "https://i.imgur.com/5ULGhAn.gif",
            "https://i.imgur.com/VV8f9TC.gif",
            "https://media1.tenor.com/m/KFHKlSp0xx4AAAAd/dancing-girl.gif",
            "https://media1.tenor.com/m/Dbxra7BsIdAAAAAd/beomgyuphile-beomgyuphiie.gif"
           ]
    
           
           let randomlonly = gifslonely[Math.floor(Math.random() * gifslonely.length)]
           let randomgif = gifsinteraction.gifs[Math.floor(Math.random() * gifsinteraction.gifs.length)] 
            let randomtext = [' Baila junto ', ' Baila al lado de  ', ' Baila con ', ' Baila tranquilamente con ']
            let textsolo = ['Baila bajo la luz de la luna', 'Baila tranquilamente', "Baila mientras disfruta la musica"]
            let randomsolo = textsolo[Math.floor(Math.random() * textsolo.length)]
           let randomtexte = randomtext[Math.floor(Math.random() * randomtext.length)]
           let carita = [' (´｡• ᵕ •｡`)', ' (´･ᴗ･ ` )', '  	(„• ֊ •„)', '  ♪ヽ(^^ヽ)♪', " ♪(/_ _ )/♪"]
           let randomcarita = carita[Math.floor(Math.random() * carita.length)]
    
    
        if(pjId) {
            if(!pjfind) {
                return interaction.reply({ content: `El personaje con el ID **${pjId}** no parece estar inscrito (・・ ) ?\nVerifica la ID`, ephemeral: true})
    
            }else if(!pjuser) {
                return interaction.reply({ content: "Esta opcion solo esta disponible con un **personaje registrado** (｡• ᵕ • ｡)\nSi quieres crear tu personaje usa **`/rol crear-personaje`**", ephemeral: true})
            }else if(pjfind.ID === pjuser.ID) {
                return interaction.reply({ content: "Tu y tu pareja no pueden ser los mismos (｡•́︿•̀｡)", ephemeral: true})
            }
    
            personajes()
        }else if(!usuario2) {
            const embed = new EmbedBuilder()
            .setDescription(`${user.displayName} ${randomsolo} ${randomcarita}`)
            .setColor("Random")
            .setImage(randomlonly)
             interaction.reply({embeds: [embed]})
           return await incInteractions(interaction, user.id, SubCommand, false)
        }else if(usuario2) {
             
        if(usuario.id === user.id) {
            const embed = new EmbedBuilder()
            .setDescription("**" + user.displayName + "** Baila con alguien imaginario... (｡•́︿•̀｡)")
            .setImage(randomlonly)
            .setColor("Random")
            return interaction.reply({embeds: [embed]})
           }
            member()
        }else {
            return interaction.reply({content: "Ha Ocurrido un error", ephemeral: true})
        }
    
    
        async function member() {
            
        const incInteractions = require("../../../functions/incInteractions")

        const danceCont =  await incInteractions(interaction, usuario.id, SubCommand, true)
   

            if(usuario.id === client.user.id) {
                const dancetxt = danceCont.couple === 1 ? "Es la primera vez que bailamos": `Hemos bailado ${danceCont.couple} veces ♡`
                const shuciika = new EmbedBuilder()
                .setDescription(`Gracias ${user} por bailar conmigo („• ֊ •„ ) ♡` + `\n-# ${dancetxt}`)
                .setColor("Random")
                .setImage(randomgif)
                return interaction.reply({embeds: [shuciika]})
            }

            const dancetxt2 = danceCont.couple === 1 ? "Es la primera vez que bailan (≧◡≦) ♡": `${user.displayName} y ${usuario.displayName} han bailado juntos un total de ${danceCont.couple} 🎵`
            const interactionEmbed = new EmbedBuilder()
            .setDescription("**" + user.displayName + "**" + randomtexte + "**" + usuario.displayName + "**" + randomcarita + `\n-# ${dancetxt2}`)
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
    
            
            if(result.xp) {
                characterInEmbed.setDescription("**" + pjuser.Nombre + "**" + `${randomtexte}` + "**" + pjfind.Nombre + "**" + `${randomcarita}` + `\n-# Puntos de Amistad ganados: + ${result.xp}`)
               
            }
            if(result.levelUp) {
                characterInEmbed.setFooter({ text:`Han subido al nivel:  +${result.lv}`})
            }

            await interaction.reply({embeds: [characterInEmbed]})
            
        }
}
