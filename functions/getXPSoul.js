const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, StringSelectMenuBuilder, } = require(`discord.js`)
const clientdb = require("../Server")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const util = require(`util`);
const sleep = util.promisify(setTimeout)

            /**
             * 
             * @param {Client} client
             * @param {ChatInputCommandInteraction} interaction
             * 
             * 
             */

module.exports = async(interaction, characterId, cantidad, bonus) => {
    const xpGet = (bonus || 1) * (cantidad)

    await souls.updateOne({_id: interaction.user.id}, 
        {
            $inc: {"XP": xpGet}
        }
    )

    const soul = await souls.findOne({_id: interaction.user.id})

    if(soul.XP >= (soul?.xpRequired || 1)) {
        const nextLevel = 30 + (soul.nivelMagico*(17*soul.nivelMagico))
        const LevelR = soul.nivelMagico + 1
        const newHP = Math.floor(100 + (LevelR^1.5) * 7)

        await souls.updateOne({_id: interaction.user.id}, {
            $set: {
                "xpRequired": nextLevel,
                "stats.hpMax": newHP,
                "HP": newHP
            },
            $inc: {
                "nivelMagico": 1, 
                "StelarFragments": 1,
            }
        }, {
            upsert: true
        })

        const messagesTitle = [
            "Una estrella nace en tu interior.",
            "Un ascenso hacia las estrellas",
            "El Cielo Teje tu Destino",
            "Las estrellas te observan con atención",
            "Anillos de Luz Te Rodean",
            "Tu energía gravitacional atrae constelaciones enteras",
            "Nubes cósmicas tejen armadura en tu espíritu.",
            "Las constelaciones se alinean con tu ascenso a nivel",
            "Fragmentos de asteroides potencian tu fuerza",
            "La oscuridad fortalece tu instinto de supervivencia.",
        ]

        const messageDescriptions = [
            "«El universo susurra: 'Eres luz hecha forma'»",
            "«Las galaxias giran en torno a tu voluntad.»",
            "«Dejas rastros de polvo estelar en cada paso.»",
            "«Polvo de estrellas se adhiere a tus pasos.»",
            "«Los cielos premian a los audaces.»",
            "«Cuando te conviertas en una gran estrella, ¿llevara tu nombre?»",
        ]

        const messageSecrets = [
            "«La oscuridad no es vacío... está viva.»",
            "«Ella observa desde el plenilunio, silenciosa.»",
            "«¿Fue un susurro... o su risa lo que escuchaste?»",
            "«Los gritos de las lunas extintas son tu melodía.»",
            "«Su silueta sin ojos es solo el principio...»",
        ]

        const gifsNormal = [
            "https://c.tenor.com/lwazM6r0VtIAAAAd/tenor.gif",
            "https://c.tenor.com/H3dQ4D3SiKoAAAAC/tenor.gif",
            "https://c.tenor.com/4MBK5F7GgowAAAAd/tenor.gif",
            "https://c.tenor.com/bNrICnndHXsAAAAd/tenor.gif",
            "https://c.tenor.com/v3KxhM48PpIAAAAd/tenor.gif",
            "https://c.tenor.com/zgBJXZ13cpAAAAAd/tenor.gif",
            "https://c.tenor.com/TYNpGhXizs0AAAAd/tenor.gif",
        ]

        const gifsTetrics = [
            "https://c.tenor.com/3_F3UqbaXsoAAAAd/tenor.gif",
            "https://c.tenor.com/YDkPLFghGXQAAAAd/tenor.gif",
            "https://c.tenor.com/-vOy1q13l7oAAAAd/tenor.gif",
            "https://c.tenor.com/l5URyKeqmvAAAAAd/tenor.gif",
            "https://c.tenor.com/8G8ZZg5e-McAAAAd/tenor.gif",
            "https://c.tenor.com/s_qhCPncTNgAAAAd/tenor.gif",
            "https://c.tenor.com/r8tIml0Dv9QAAAAd/tenor.gif",
            "https://c.tenor.com/6eOFyYUIA5YAAAAd/tenor.gif",
            "https://c.tenor.com/TSp7BYGJitEAAAAd/tenor.gif",
        ]

        const TitleMessage = getRandomMessage(messagesTitle)
        const DescMessage = getRandomMessage(messageDescriptions)
        const secretMessage = getRandomMessage(messageSecrets, [true, 0.1])
        const gifSelect = getRandomMessage(gifsNormal)
        let gifsSelectSecret;
        
        if(secretMessage.isSecret) {
            gifsSelectSecret = getRandomMessage(gifsTetrics)
        }

        const messageFields = secretMessage.isSecret ? "<:IseeU:1351788227685646377> *̵̻̈r̶͈̂ā̸̘l̸̹̋ë̴̫ṭ̶̂s̴̘̈́ē̷̥ ̶͉͛o̴͕͌t̵̳͊ṅ̴̗ẹ̷͠m̷̥͂g̸̱̓a̷̮̕r̸̢̋F̷̟͛*̵̧̊ ̵̣̆*̴̪̃*̵̭̆1̷̭̇*̵͇̿*̷̟̀" : "<a:KrisJojos:1350664814414004395> **1** *Fragmento estelar*"


        const embed = new EmbedBuilder()
        .setTitle(secretMessage.isSecret ? "s̴͎̚a̸̦̚ĺ̴̞l̷͙̿e̵̓͜r̵͍̽t̴͔̀s̴̟̓e̸̗͗ ̵͚̔s̴̞͆a̷̙͋l̸̘̄ ̸̢̍a̷͔̿i̵͍̎c̴͖͝ã̵̪h̷͓͛ ̶̪̄ò̴̜s̸͎̚n̸̯̊e̶̿͜c̶͖̀s̵̠͛Â̷̳" : TitleMessage.message )
        .setDescription("**¡Felicidades! Has subido al nivel `"  +  `${soul.nivelMagico + 1}` + 
            "`\n*Tus estadisticas han aumentado*" + 
            "**\n\n-# " + `${secretMessage.isSecret ? secretMessage.message : DescMessage.message}`)
        .addFields(
            {name: "Has obtenido", value: `${messageFields}`}
        )
        .setTimestamp()
        .setColor("Random")
        .setImage(secretMessage.isSecret ? gifsSelectSecret.message : gifSelect.message)

        return embed
    }

    return false

    function getRandomMessage(array, isProbability = [false, 0]) {
        let message; 
        if(isProbability[0] && Math.random() < isProbability[1]) {
           return {message: array[Math.floor(Math.random() * array.length)], isSecret: true}    
        }

        message = array[Math.floor(Math.random() * array.length)]

        return {message: message, isSecret: false};
    }

}