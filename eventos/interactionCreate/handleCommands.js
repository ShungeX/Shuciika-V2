const {devs, guild, } = require("../../configslash.json");
const clientdb = require("../../Server");
const getLocalButtons = require("../../utils/getLocalButtons");
const getLocalCommands = require("../../utils/getLocalCommands");
const getLocalModals = require("../../utils/getLocalModals");
const getLocalSelect = require("../../utils/getLocalSelectMenus")
const {ChatInputCommandInteraction} = require("discord.js")
const db1 = clientdb.db("Rol_db")
const Cachedb = db1.collection("CachePJ")
const chars = db1.collection("Personajes")
const objetosdb = db1.collection("Objetos_globales")

    /**
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction
     */


module.exports = async (client, interaction) => {

    if(interaction.isAutocomplete()) {
        const focusedOptions = interaction.options.getFocused(true)

        if(focusedOptions.name === "personaje_cache") {
        const regex = new RegExp(focusedOptions.value, 'i')
        const characters = await Cachedb.find().toArray()

        const filtro = characters
        .filter(ch => ch.name.toLowerCase().startsWith(focusedOptions.value.toLowerCase()))
        .slice(0, 25)
        
        await interaction.respond(
            filtro.map(personaje => ({
                name: personaje.name,
                value: personaje.name
            }))
        )
        }

        if(focusedOptions.name === "personaje") {
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


    if(interaction.isModalSubmit()) {
        const modalHandlers = await getLocalModals()
        const modalId = interaction.customId
        const modalfind = await modalHandlers.find((modal) => modal.customId === modalId);

        if(!modalfind) {
            return interaction.reply({ content: "Este modal no tiene ninguna funcion!"})
        } 

        try {
            await modalfind.ejecutar(client, interaction)
        }catch(e) {
            console.log("Ocurrio un error al ejecutar el modal!", e)
        }
    }

    if(interaction.isStringSelectMenu()) {
        const selectHandlers = await getLocalSelect();
        const selectID = interaction.values[0]
        const extractSelect = selectID.replace(/-.*/, '')
        const selectfind = await selectHandlers.find((select) => select.customId === extractSelect);

        if(!selectfind) {
            return interaction.reply({ content: "Este selectMenu no tiene ninguna funcion!"})
        }

        try {

            if(selectfind.selectAuthor) {
                if(selectID !== `${extractSelect}-${interaction.user.id}`) {
                    return interaction.reply({ content: "¡este menu no es para ti!", ephemeral: true})
            }
        }

            const character = await chars.findOne({_id: interaction.user.id}) || await Cachedb.findOne({_id: interaction.user.id})
            await selectfind.ejecutar(client, interaction, character)
        }catch(e) {
            console.log("Ocurrio un error al ejecutar el select!", e)
        }
    }

    if(interaction.isButton()) {
        const buttonHandlers = await getLocalButtons();
        const buttonID = interaction.customId
        const [action, userId, ID, extras] = interaction.customId.split("-")
        const characterId = Number(ID)

        const buttonfind = await buttonHandlers.find((btn) => btn.customId === action);
        

        if(!buttonfind) {
            return interaction.reply({ content: "Este boton no tiene ninguna funcion!"})
        }


        try {

            if(buttonfind.buttonAuthor) {
    
                if(`${action}-${userId}` !== `${action}-${interaction.user.id}`) {
                    return interaction.reply({ content: "¡este boton no es para ti!", ephemeral: true})
                }else {
                    await buttonfind.ejecutar(client, interaction, characterId, extras)
                }

                
            }else {
                await buttonfind.ejecutar(client, interaction, characterId, extras)
            }


        } catch (e) {
            console.log("Ocurrio un error al ejecutar el boton!", e)
        } 

    }else if(!interaction.isChatInputCommand()) return;

    const localCommands = getLocalCommands();

    try {

        const commandObject = localCommands.find((cmd) => cmd.data.name === interaction.commandName)


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
        console.log(`Ocurrio un error al ejecutar el comando ${e}`)
    }


};