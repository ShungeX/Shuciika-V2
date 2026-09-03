const incInteractions = require("../../../functions/incInteractions")
const clientdb = require("../../../Server")
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const db = clientdb.db("Interaccion")
const db2 = clientdb.db("Rol_db")
const getXp = require("../../../functions/getXP")
const axios = require("axios")
const getGifs = require("../../../functions/getGifs")
const { v4: uuidv4} = require('uuid')
const transaccionCache = require("../../../utils/cache")



     /**
     * 
     * @param {Client} client
     * @param {ChatInputCommandInteraction} interaction 
     */
module.exports = async(client, interaction) => {

            const interactionRolType = 2
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
           let randomgif = await getGifs("kiss");
            let randomtext = [' Ha besado a', ' Le dio un besó a', ' Besó dulcemente a', ' Besó tiernamente a ', ' Besó a']
           let randomtexte = randomtext[Math.floor(Math.random() * randomtext.length)]
           let carita = [' ( •̀ ω •́ )✧', ' (*/▽＼*)', ' (⁄ ⁄•⁄ω⁄•⁄ ⁄)', ' (//▽//)']
           let randomcarita = carita[Math.floor(Math.random() * carita.length)]
    
    
        if(pjId) {
            if(!pjfind) {
                return interaction.reply({ content: `El personaje con el ID **${pjId}** no parece estar inscrito (・・ ) ?\nVerifica la ID`, flags: ["Ephemeral"]})
    
            }else if(!pjuser) {
                return interaction.reply({ content: "Esta opcion solo esta disponible con un **personaje registrado** (｡• ᵕ • ｡)\nSi quieres crear tu personaje usa **`/rol crear-personaje`**", flags: ["Ephemeral"]})
            }else if(pjfind.ID === pjuser.ID) {
                return interaction.reply({content: "Eh... ¿quieres besarte a ti mismo? (・・ ) ? \n-# Creo que eso no es posible..."})
            }
    
            personajes()
        }else if(!usuario2) {
            return interaction.reply({content: "¿A quien intentas besar? (・・ ) ?\n-# Debes mencionar a un personaje o usuario que besar (Pero no te aproveches de eso)"})
        }else if(usuario2) {
             
        if(usuario.id === user.id) {
            return interaction.reply({content: "Eh... ¿quieres besarte a ti mismo? (・・ ) ?\n-# creo que eso no es posible..."})
        }
            member()
        }else {
            return interaction.reply({content: "Ha Ocurrido un error", flags: ["Ephemeral"]})
        }
    
    
async function member() {
            
        const incInteractions = require("../../../functions/incInteractions")

        const interactCont =  await incInteractions(interaction, usuario.id, SubCommand, true)
   

            if(usuario.id === client.user.id) {
                return interaction.reply({content: "*Ejem*, ¿Que estas intentando hacer " + `${interaction.member}` + "? (・_・;)"})
            }

            const interactext2 = interactCont.couple === 1 ? "Este beso es especial... (≧◡≦) ♡": `${user.displayName} y ${usuario.displayName} Se han besado un total de ${interactCont.couple} veces 💋`
            const interactionEmbed = new EmbedBuilder()
            .setDescription("**" + user.displayName + "**" + randomtexte + " **" + usuario.displayName + "**" + randomcarita + `\n-# ${interactext2}`)
            .setColor("Random")
            .setImage(randomgif.url)
            .setFooter({text: `Anime: ${randomgif.anime_name}`})
             return interaction.reply({embeds: [interactionEmbed]})
        }
    
        async function personajes() {
            const transacciónId = uuidv4().replace(/-/g, "")

            const button1 = new ButtonBuilder()
            .setCustomId(`interaction_button-${pjfind._id}-${pjuser.ID}*${transacciónId}*${1}`)
            .setEmoji(`✨`)
            .setLabel("Corresponder")
            .setStyle(ButtonStyle.Secondary);

            const button2 = new ButtonBuilder()
            .setCustomId(`interaction_button-${pjfind._id}-${pjuser.ID}*${transacciónId}*${0}`)
            .setEmoji(`💔`)
            .setLabel("Rechazar")
            .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder()
            .setComponents(button1, button2)

            const questionembed = new EmbedBuilder()
            .setDescription(`**${pjuser.Nombre}** esta intentando besar a **${pjfind.Nombre}** (≧◡≦) ♡`)
            .setImage("https://c.tenor.com/SJpTzHKSaWgAAAAd/tenor.gif")
            .setColor("Grey")





            const message = await interaction.reply({content: `<@!${pjfind._id}>`, embeds: [questionembed], components: [row], fetchReply: true})

            const cacheobj  = {
                ID: pjuser.ID,
                SubCommand: SubCommand,
                Message: message.id,
                text: randomtexte,
                carita: randomcarita,
                infogif: randomgif,
                RolType: interactionRolType
            }

        transaccionCache.set(transacciónId, cacheobj)


            
        }
}
