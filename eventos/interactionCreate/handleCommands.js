const {devs, guild, } = require("../../configslash.json");
const clientdb = require("../../Server");
const getLocalButtons = require("../../utils/getLocalButtons");
const getLocalCommands = require("../../utils/getLocalCommands");
const getLocalModals = require("../../utils/getLocalModals");
const getLocalSelect = require("../../utils/getLocalSelectMenus")
const {ChatInputCommandInteraction, InteractionWebhook, Client, ChannelType, EmbedBuilder} = require("discord.js")
const db1 = clientdb.db("Rol_db")
const Cachedb = db1.collection("CachePJ")
const chars = db1.collection("Personajes")
const objetosdb = db1.collection("Objetos_globales")

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */


module.exports = async (client, interaction) => {  
    if(interaction.isAutocomplete()) {
        const focusedOptions = interaction.options.getFocused(true)
        const subcommand = interaction.options.getSubcommand()

        if(subcommand === "comprar") {
            if(focusedOptions.name === "objeto") {
                const objeto = await objetosdb.find({"Objetos.inStore": true}, {
                    projection: {
                        _id: 1,
                        Objetos: {
                            $filter: {
                                input: "$Objetos",
                                as: "objeto",
                                cond: {
                                    $eq: ["$$objeto.inStore", true]
                                }
                            }
                        }
                    }
                }).toArray()

                const objfiltrados = objeto.flatMap(doc => 
                    doc.Objetos.filter(
                        obj => obj.ID === Number(focusedOptions.value) ||
                        obj.Nombre?.toLowerCase().startsWith(focusedOptions.value.toLowerCase()) ||
                        obj.Region?.toLowerCase().startsWith(focusedOptions.value.toLowerCase())
                    )
                ).slice(0, 25)
    
                await interaction.respond(
                    objfiltrados.map(objeto => ({
                        name: `${objeto.Region}: ${objeto.Nombre} [${objeto.ID}]`,
                        value: `${objeto.Region}_${objeto.ID}`
                    }))
                )
            }
        }

        if(focusedOptions.name === "personaje_cache") {
        const regex = new RegExp(focusedOptions.value, 'i')
        const characters = await Cachedb.find().toArray()

        const filtro = characters
        .filter(ch => ch.nombre.toLowerCase().startsWith(focusedOptions.value.toLowerCase()))
        .slice(0, 25)
        
        await interaction.respond(
            filtro.map(personaje => ({
                name: personaje.nombre,
                value: personaje._id
            }))
        )
        }

        if(focusedOptions.name === "personaje" || focusedOptions.name === "remitente") {
            const characters = await chars.find().toArray()

            const filtro = characters
            .filter(ch => ch.Nombre.toLowerCase().startsWith(focusedOptions.value.toLowerCase()) || ch.ID === Number(focusedOptions.value))
            .slice(0, 25)
            
            await interaction.respond(
                filtro.map(personaje => ({
                    name: `ID: ${personaje.ID} : ${personaje.Nombre}`,
                    value: personaje.ID
                }))
            )
            
        }

        if(subcommand === "dar_objeto") {
            if(focusedOptions.name === "objeto") {
                const objeto = await objetosdb.find().toArray()
    
                const objfiltrados = objeto.flatMap(doc => 
                    doc.Objetos.filter(
                        obj => obj.ID === Number(focusedOptions) ||
                        obj.Nombre?.toLowerCase().startsWith(focusedOptions.value.toLowerCase()) ||
                        obj.Region?.toLowerCase().startsWith(focusedOptions.value.toLowerCase())
                    )
                ).slice(0, 25)
    
                await interaction.respond(
                    objfiltrados.map(objeto => ({
                        name: `${objeto.Region}: ${objeto.Nombre} [${objeto.ID}]`,
                        value: objeto.ID
                    }))
                )
            }
        }

        if(focusedOptions.name === "item" || focusedOptions.name === "item_principal") {
                const personaje = await chars.findOne({_id: interaction.user.id})

                if(!personaje) return;
    
                const objinventario = await personaje.Inventario
    
                const objfiltrados = objinventario.filter(item => {
                    return item.ID === Number(focusedOptions.value) ||
                    item.Nombre.toLowerCase().includes(focusedOptions.value.toLowerCase())
                })

    
                await interaction.respond(
                    objfiltrados.map(objeto => ({
                        name: `[${objeto.ID}] ${objeto.Nombre} (x${objeto.Cantidad})`,
                        value: `${objeto.Region}_${objeto.instanciaID ? objeto.instanciaID : objeto.ID}`
                    }))
                )

        }

        if(focusedOptions.name === "correo") {
            const personaje = await chars.findOne({_id: interaction.user.id})
            if(!personaje) return;
    
            const objinventario = await personaje.buzon || []
 
            const objfiltrados = objinventario.filter(correo => {
                return correo.ID.toLowerCase().includes(focusedOptions.value.toLowerCase()) ||
                correo.Nombre.toLowerCase().includes(focusedOptions.value.toLowerCase()) ||
                correo.remitente.Nombre.toLowerCase().includes(focusedOptions.value.toLowerCase())
            })

            await interaction.respond(
                objfiltrados.map(objeto => ({
                    name: `[${objeto.remitente.Nombre}] ${objeto.Nombre} - ${objeto.tipo} `,
                    value: `${objeto.ID}`
                }))
            )
        }

        


    }

    if(interaction.isModalSubmit()) {
        const modalHandlers = await getLocalModals()
        const modalId = interaction.customId
        const [action, options, options2, options3] = interaction.customId.split("-")
        const modalfind = await modalHandlers.find((modal) => modal.customId === action);

        if(!modalfind) {
            return interaction.reply({ content: "Este modal no tiene ninguna funcion!"})
        } 

        const character = await chars.findOne({_id: interaction.user.id}) || await Cachedb.findOne({_id: interaction.user.id})

        try {
            await modalfind.ejecutar(client, interaction, options, options2, options3, { character })
        }catch(e) {
            console.log("Ocurrio un error al ejecutar el modal!", e)
        }
    }

    if(interaction.isStringSelectMenu()) {
        const selectHandlers = await getLocalSelect();
        const [CustomId, userAuthor, options1, options2, options3] = interaction.customId.split("-")
        const selectID = interaction.values[0]
        const extractSelect = selectID.replace(/-.*/, '')
        const [action, userId, extras] = interaction.values[0].split("-")
        const selectfind = await selectHandlers.find((select) => select.customId === `${CustomId}`);

   

        if(!selectfind) {
            return interaction.reply({ content: "Este selectMenu no tiene ninguna funcion!", ephemeral: true})
        }

        const character = await chars.findOne({_id: interaction.user.id}) || await Cachedb.findOne({_id: interaction.user.id})

        try {
            if(selectfind.selectAutor) {
                if(userAuthor !== `${interaction.user.id}`) {
                    const embed = new EmbedBuilder()
                    .setDescription(`<@!${userAuthor}> Solo puede responder a esta interacción /(ㄒoㄒ)/~~`)
                    .setColor("Red")
                    return interaction.reply({ embeds: [embed], ephemeral: true})
                }else {
                    await selectfind.ejecutar(client, interaction, character, options1, options2, options3, selectID)
                }
            }else {

                await selectfind.ejecutar(client, interaction, character, options1, options2, options3, selectID)
            }
        } catch (e) {
            console.log("Ocurrio un error al ejecutar el select!", e)
        }
    }

    if(interaction.isButton()) {
        const buttonHandlers = await getLocalButtons();
        const buttonID = interaction.customId
        const [action, userId, option1, extras1, extras2, extras3, extras4] = interaction.customId.split(/[-*]/)
        
        let characterId = Number(option1)

        if(isNaN(characterId)) {
            characterId = option1
        }

        const buttonfind = await buttonHandlers.find((btn) => btn.customId === action);

        if(buttonID === "Noresponse" || buttonID === "Noresponser") {
            const messages = ["Algo te impide responder...", "No sale ni una palabra de tu boca", "Tus manos tiemblan", "Estas perdido/a en tu mente", "Estas congelado/a"]
            const random = messages[Math.floor(Math.random() * messages.length)]

            console.log(random)

            return interaction.reply({content: random, ephemeral: true})
        }
        

        if(!buttonfind) {
            return interaction.reply({ content: "Este boton no tiene ninguna funcion!"})
        }


        try {

            if(buttonfind.buttonAuthor) {
    
                if(`${action}-${userId}` !== `${action}-${interaction.user.id}`) {
                    const embed = new EmbedBuilder()
                    .setDescription(`<@!${userId}> Solo puede responder a esta interacción /(ㄒoㄒ)/~~`)
                    .setColor("Red")
                    return interaction.reply({embeds: [embed] , ephemeral: true})
                }else {
                        await buttonfind.ejecutar(client, interaction, characterId, extras1, extras2, extras3, extras4)            
                }

                
            }else {
                await buttonfind.ejecutar(client, interaction, characterId, extras1, extras2, extras3, extras4)
            }


        } catch (e) {
            console.log("Ocurrio un error al ejecutar el boton!", e)
        } 

    }else if(!interaction.isChatInputCommand()) {
        return
    }else {
        const localCommands = getLocalCommands();


        try {
    
            if(!interaction.guild) {
                return interaction.reply({content: "No puedes usar comandos en MD", ephemeral: true})
            }
        
    
            const commandsName = client.user.id === "857050098831065088" && interaction?.commandName?.startsWith("navi-") ? 
            interaction?.commandName.replace("navi-", "") : interaction?.commandName
            
            const commandObject = localCommands.find((cmd) => cmd.data.name === commandsName)
    
            if(!commandObject) return;
    
            if(commandObject.devOnly) {
                if(!devs.includes(interaction.member.id)) {
                    return interaction.reply({content: "No tienes permisos para usar este comando", ephemeral: true})
                }
            }
    
            if(commandObject.testOnly) {
                if(!(interaction.guild.id === guild)) {
                   return interaction.reply({content: "No se puede usar este comando aqui", ephemeral: true})
                }
            }
    
            await commandObject.ejecutar(client, interaction);
        }catch(e) {
            console.error(`Ocurrio un error al ejecutar el comando`, e)
        }
    }




};