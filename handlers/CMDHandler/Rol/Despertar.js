const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const souls = db2.collection("Soul")
const util = require(`util`);
const sleep = util.promisify(setTimeout)
const version = require("../../../config")
const { v4: uuidv4} = require('uuid')
const transaccionCache = require("../../../utils/cache")


module.exports = {
    requireCharacter: true,
    requireSoul: true,
    requireCharacterCache: false,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: false,
        Character: true,
        Cachepj: false
    },


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, { character, soul }) => {
    const options = interaction.options.getNumber("omitir_dialogo") || 0
    const md = await interaction.user.createDM()
    const cacheId = transaccionCache.get(`${interaction.user.id}-despertar`)


    console.log(cacheId)
    return; 

    if(soul) {
        if(soul?.isFinish) {
            return interaction.reply({content: "Una estrella guarda aquello que resuena en tu alma.", ephemeral: true})
        }



        const message = await md.messages.cache.get(soul.messageTemp)

        console.log(message)

        if(message) {
            return interaction.reply({content: "Ya tienes una sesión de despertar en curso. Aqui esta el mensaje: "+ `https://discord.com/channels/@me/${message.channelId}/${message.id}`, ephemeral: true})
        }else {
            await soul.deleteOne({_id: interaction.user.id})
        }

    }

    if(cacheId?.activity) {
        return interaction.reply({content: "Ya tienes una sesión de despertar en curso. Por favor revisa tus mensajes privados", ephemeral: true})
    }




    if(!md) {
        return interaction.reply({content: "Para usar este comando debes tener los mensajes directos (MD) activados", ephemeral: true})
    }







    if(options === 1) {
        interaction.reply({content: "Se ha omitido el dialogo de despertar [Staff Only]", ephemeral: true})
        skip()
    }else {
        dialogo()
    }

    async function dialogo() {
        const objinfo = {
            activity: true,
        }

        transaccionCache.set(`${interaction.user.id}-despertar`, objinfo)
        

        const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId("Noresponse")
            .setLabel("Aceptar")
            .setEmoji("🫱")
            .setStyle(ButtonStyle.Primary)
        )
        .addComponents(
            new ButtonBuilder()
            .setCustomId("Noresponser")
            .setLabel("Rechazar")
            .setEmoji("🔥")
            .setStyle(ButtonStyle.Danger)
        )


        const message = await interaction.user.send({content: "**Caes en un sueño profundo...**\n-# Esperando a que el usuario este en este MD... (Esto toma aproximadamente 5 segundos)",})

        interaction.reply({content: "Para continuar revisa tus mensajes privados o da click al siguiente mensaje: "+ `https://discord.com/channels/@me/${message.channelId}/${message.id}`  +". ( •̀ ω •́ )✧\n-# Solo lo puedes ver tú"})
        await sleep(9000)

        message.edit({content: "*la oscuridad te envuelve...*"})

        await sleep(7000)

        message.edit({content: "*Hasta que una voz calida rompe tu inquietud...*"})

        await sleep(7000)

        message.edit({content: "—No temas pequeño/a. El vacío solo refleja lo que tu corazón ya conoce—"})

        await sleep(8000)

        message.edit({content: "*Ante ti, aparece una figura etérea con un gran velo y ojos que brillan cómo estrellas... Es tan hermosa que te cuesta mirarla directamente*"})

        await sleep(8000)

        const embed1 = new EmbedBuilder()
        .setAuthor({name: "Guardiana de las estrellas", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription("He estado esperando a que llegara este momento, " + `** ${character.Nombre} **` + ".")
        .setColor("DarkPurple")
        message.edit({embeds: [embed1], content: ""})
        await sleep(8000)

        const embed2 = new EmbedBuilder()
        .setAuthor({name: "Astralea | Guardiana de las estrellas ", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription("Soy Astralea una `Guardiana de las estrellas` forjadora de caminos entre lo efimero y lo eterno. Protectora de las estrellas y de aquellos que buscan su luz.")
        .setColor("DarkPurple")
        message.edit({embeds: [embed2], content: ""})
        await sleep(9000)

        const embed3 = new EmbedBuilder()
        .setAuthor({name: "Astralea | Guardiana de las estrellas ", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription("Fui llamada por la `Tejedora` para guiarte en tu despertar.")
        .setColor("DarkPurple")
        message.edit({embeds: [embed3], content: ""})
        await sleep(8000)

        const embedIntermed = new EmbedBuilder()
        .setAuthor({name: "Astralea | Guardiana de las estrellas ", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription("Esa luz que aun no brilla con suficiente intensidad en tu interior, es tu alma")
        .setImage("https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/soul_kajwym")
        .setColor("DarkPurple")
        message.edit({embeds: [embedIntermed], content: ""})
        await sleep(8000)

        const embed4 = new EmbedBuilder()
        .setAuthor({name: "Astralea | Guardiana de las estrellas ", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription("El cielo nocturno que ves, todas las estrellas que estan ahi son el reflejo de almas que lograron transcender y quedan en el firmamento como guias para aquellos que buscan su luz.")
        .setColor("DarkPurple")
        message.edit({embeds: [embed4], content: ""})
        await sleep(10000)

        const embed5 = new EmbedBuilder()
        .setAuthor({name: "Astralea | Guardiana de las estrellas ", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription("Alguna vez esas estrellas fueron almas como la tuya. Sus almas brillaron con tal intensidad que se convirtieron en estrellas.")
        .setColor("DarkPurple")
        message.edit({embeds: [embed5], content: ""})
        await sleep(8000)

        const embed6 = new EmbedBuilder()
        .setAuthor({name: "Astralea | Guardiana de las estrellas ", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription("Sus caminos fueron largos y llenos de desafios. tejieron su destino con cada elección que tomaron. ")
        .setColor("DarkPurple")
        message.edit({embeds: [embed6], content: ""})
        await sleep(8000)

        const embedIntermed2 = new EmbedBuilder()
        .setAuthor({name: "Astralea | Guardiana de las estrellas ", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription("La tuya ha permanecido dormida por mucho tiempo. Pero ahora reclama su lugar entre las estrellas.")
        .setImage("https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_480,h_480,c_fill/yoursoul_dpr7gt")
        .setColor("DarkPurple")
        message.edit({embeds: [embedIntermed2], content: ""})
        await sleep(8000)

        const embed7 = new EmbedBuilder()
        .setAuthor({name: "Astralea | Guardiana de las estrellas ", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription("Cada paso que des en tu viaje te acerca a ese destino. Tu lucha, tus logros y tu esencia se entrelazan para forjar una historia digna de ser recordada en el firmamento.")
        .setColor("DarkPurple")
        message.edit({embeds: [embed7], content: ""})
        await sleep(10000)

        const embed8 = new EmbedBuilder()
        .setAuthor({name: "Astralea | Guardiana de las estrellas ", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription("El sendero hacia las estrellas es arduo, pero también es el camino hacia tu verdadera grandeza.")
        .setColor("DarkPurple")
        message.edit({embeds: [embed8], content: ""})
        await sleep(8000)

        const embed9 = new EmbedBuilder()
        .setAuthor({name: "Astralea | Guardiana de las estrellas ", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto,w_300,h_300,c_fill/light_xxwmdp"})
        .setDescription(`${character.Nombre}, ¿Estás preparado para comenzar a forjar tu destino y ganarte tu lugar en este firmamento eterno?"`)
        .setColor("DarkPurple")
        message.edit({embeds: [embed9], components: [row]})

        await sleep(15000)


        message.edit({content: "*El entorno se quiebra como un espejo, fragmentos de luz y oscuridad flotan en el vacio...", embeds: [], components: [], files: ["https://res.cloudinary.com/dn1cubayf/image/upload/v1737251238/CalicoDiary_On_Pinterest_ratcfa.jpg"]})
        await sleep(8000)



        const embedfirmamento1 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("¡Oh, Astralea! Siempre tan delicada con tus palabras...")
        .setColor("NotQuiteBlack")
        const firmamento = await interaction.user.send({embeds: [embedfirmamento1]})

        await sleep(8000)

        const embedfirmamento3 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Dejame mostarle un poco de la realidad de este mundo...")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento3]})

        await sleep(6000)
        const sistemdialog = await interaction.user.send({content: "-# *Sientes un dolor agudo en tu pecho... Una sensación de vacio y desesperación te invade...*"})
        await message.delete()
        await sleep(8000)


        const embedfirmamento4 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Aquellas palabras no son más que mentiras por parte de la guardiana de las estrellas")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento4]})
        await sleep(8000)

        const embedfirmamento5 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Ella solo vigila el rebaño... mientras yo devoro a los débiles")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento5]})
        await sleep(8000)

        const embedfirmamento6 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Pero tu no eres debil, tu alma tiene algo especial")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento6]})
        await sleep(8000)

        const embedfirmamento7 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Y almas asi merecen tener más que un lugar en el firmamento.")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento7]})
        await sleep(8000)

        const embedfirmamento8 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Dime…")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento8]})
        await sleep(5000)

        const embedfirmamento9 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("¿Hasta dónde arrastrarías tu orgullo por un fuego que ni siquiera es tuyo?")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento9]})
        await sleep(8000)

        const embedfirmamento10 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Las estrellas te darán migajas…")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento10]})
        await sleep(8000)

        const embedfirmamento11 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Pero yo…")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento11]})
        await sleep(4000)

        const embedfirmamento12 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Yo te enseñaré a devorar.")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento12]})
        await sleep(8000)

        const embedfirmamento13 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("¿No es eso más…")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento13]})
        await sleep(5000)

        const embedfirmamento14 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("generoso?")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento14]})
        await sleep(5000)
        
        const embedfirmamento15 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Hablo contigo...")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento15]})
        await sleep(3000)
        
        const embedfirmamento16 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription(`Hablo contigo... ${interaction.user.username}`)
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento16], content: `${interaction.user}`})
        await sleep(6000)

        const embedfirmamento17 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Me interesa saber cómo piensas. ¿Que tal si nos conocemos un poco más?")
        .setColor("NotQuiteBlack")
        firmamento.edit({embeds: [embedfirmamento17]})
        await sleep(8000)


        await firmamento.delete()
        skip()
    }

    async function skip() {
        const embedfirmamento18 = new EmbedBuilder()
        .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
        .setDescription("Un espejo maldito muestra versiones de tu futuro: una donde salvas a todos con Luz, otra donde gobiernas con Oscuridad, y una última donde desapareces. ¿Qué reflejo tocas?")
        .setColor("NotQuiteBlack")


        const row2 = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
            .setCustomId(`despertarOptions-${interaction.user.id}`)
            .setMaxValues(1)
            .setPlaceholder("Elige tu respuesta...")
            .addOptions([
                {
                    label: "A) El heroe que salva a todos con Luz",
                    value: `R1*A`,

                },
                {
                    label: "B) El gobernante que impone su voluntad con Oscuridad",
                    value: `R1*B`,
                    
                },
                {
                    label: "C) Rompo el espejo. Mi futuro lo escribo yo",
                    value: `R1*C`,
                    
                },


            ])
        )

        const preguntas = await interaction.user.send({embeds: [embedfirmamento18], components: [row2]})
        transaccionCache?.delete(`${interaction.user.id}-despertar`)

        const soulfind2 = await souls.findOne({_id: interaction.user.id})

        if(!soulfind2) {
            await souls.insertOne({
                _id: interaction.user.id,
                messageTemp: preguntas.id,
                ID: character.ID,
                HP: 100,
                Mana: 50,
                nivelMagico: 1,
                XP: 0,
                Elemento: "Ninguno",
                EnergiaAlmica: 0,
                Corrupcion: 0,
                Pecado: 0,
                Virtud: 0,
                debilidades: {},
                equipo: [],
                estadoActual: {},
                firmamento: {},
                hechizos: {},   
                stats: {
                  hpMax: 100,
                  manaMax: 50,
                  fuerza: 1,
                  resistenciaFisica: 1,
                  agilidad: 1,
                  sabiduria: 1,
                  inteligencia: 1,
                  resistenciaMagica: 1,
                  poderElemental: 1,
                  percepcion: 1,
                  voluntad: 1,
                  regeneracion: 1,
                  paradoja: 0,
                  destino: 0
                },
                transforaciones: {},
                isFinish: false,
            })
        }else {
            await souls.updateOne({_id: interaction.user.id}, {$set: {messageTemp: preguntas.id, Valor: 0, Corrupcion: 0, Pecado: 0, isFinish: false}})
        }
    }

    }

}