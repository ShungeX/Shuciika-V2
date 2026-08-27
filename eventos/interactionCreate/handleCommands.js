const { devs, guild, } = require("../../config/configslash.json");
const clientdb = require("../../Server");
const getLocalButtons = require("../../utils/getLocalButtons");
const getLocalCommands = require("../../utils/getLocalCommands");
const getLocalModals = require("../../utils/getLocalModals");
const getLocalSelect = require("../../utils/getLocalSelectMenus");
const { manejarComponente} = require("../../interaction/manejarComponente")
const { ChatInputCommandInteraction, InteractionWebhook, Client, ChannelType, EmbedBuilder } = require("discord.js")
const db1 = clientdb.db("Rol_db")
const db2 = clientdb.db("Server_db")

const userdbs = db2.collection("usuarios_server")
const Cachedb = db1.collection("CachePJ")
const chars = db1.collection("Personajes")
const objetosdb = db1.collection("Objetos_globales")

/**
 * @param {Client} client 
 * @param {import('discord.js').ChatInputCommandInteraction | import('discord.js').AutocompleteInteraction} interaction
 */

//Los ejecutar ahora funcionan entre llaves, tienes que llamar al contenido tal y cómo esta
//Es posible renombrarlos una vez solicitados, algo asi cómo: ejecutar: async(options: {option1: data}) ahora la primera opción se llama data

module.exports = async (client, interaction) => {
    const userdb = await userdbs.findOne({_id: interaction.user.id})

    if (interaction.isAutocomplete()) {
        const focusedOptions = interaction.options.getFocused(true)
        const subcommand = interaction.options.getSubcommand()

        if (subcommand === "comprar") {
            if (focusedOptions.name === "objeto") {
                const objeto = await objetosdb.find({ "Objetos.inStore": true }, {
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

        if (focusedOptions.name === "personaje_cache") {
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

        if (focusedOptions.name === "personaje" || focusedOptions.name === "remitente") {
            const characters = await chars.find().toArray()

            const filtro = characters
                .filter(ch => ch.perfil.Nombre.toLowerCase().startsWith(focusedOptions.value.toLowerCase()) || ch._id === Number(focusedOptions.value))
                .slice(0, 25)

            await interaction.respond(
                filtro.map(personaje => ({
                    name: `ID: ${personaje._id} : ${personaje.perfil.Nombre}`,
                    value: personaje._id
                }))
            )

        }

        if (subcommand === "dar_objeto") {
            if (focusedOptions.name === "objeto") {
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

        if (focusedOptions.name === "item" || focusedOptions.name === "item_principal") {
            const personaje = await chars.findOne({ _id: interaction.user.id })

            if (!personaje) return;

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

        if (focusedOptions.name === "correo") {
            const personaje = await chars.findOne({ _id: interaction.user.id })
            if (!personaje) return;

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

    if (interaction.isModalSubmit()) {
        const modalHandlers = await getLocalModals()

        try {
            manejarComponente(client, interaction, modalHandlers, "modal")
        } catch (e) {
            console.log("Ocurrio un error al ejecutar el modal!", e)
        }
    }

    if (interaction.isStringSelectMenu()) {
        const selectHandlers = await getLocalSelect();

        try {
            manejarComponente(client, interaction, selectHandlers, "selectMenu")
        } catch (e) {
            console.log("Ocurrio un error al ejecutar el select!", e)
        }
    }

    if (interaction.isButton()) {
        const buttonHandlers = await getLocalButtons();
        const buttonID = interaction.customId;

        if (buttonID === "Noresponse" || buttonID === "Noresponser") {
            const messages = ["Algo te impide responder...", "No sale ni una palabra de tu boca", "Tus manos tiemblan", "Estas perdido/a en tu mente", "Estas congelado/a"]
            const random = messages[Math.floor(Math.random() * messages.length)]

            return interaction.reply({ content: random, flags: ["Ephemeral"] })
        }

        try {
            manejarComponente(client, interaction, buttonHandlers, "button")
        } catch (e) {
            console.log("Ocurrio un error al ejecutar el boton!", e)
        }

    } else if (!interaction.isChatInputCommand()) {
        return
    } else {
        const localCommands = getLocalCommands();


        try {
            if (!interaction.guild) {
                return interaction.reply({ content: "No puedes usar comandos en MD", flags: ["Ephemeral"] })
            }

            const commandsName = client.user.id === "857050098831065088" && interaction?.commandName?.startsWith("navi-") ?
                interaction?.commandName.replace("navi-", "") : interaction?.commandName

            const commandObject = localCommands.find((cmd) => cmd.data.name === commandsName)

            if (!commandObject) return;

            if (commandObject.devOnly) {
                if (!devs.includes(interaction.member.id)) {
                    return interaction.reply({ content: "No tienes permisos para usar este comando", flags: ["Ephemeral"] })
                }
            }

            if (commandObject.testOnly) {
                if (!(interaction.guild.id === guild)) {
                    return interaction.reply({ content: "No se puede usar este comando aqui", flags: ["Ephemeral"] })
                }
            }

            await commandObject.ejecutar(client, interaction);
        } catch (e) {
            console.error(`Ocurrio un error al ejecutar el comando`, e)
        }
    }


    function splitCustomId(customId) {
        const regex = /(?:\[.*?\]|[^-*])+/g;
        const rawParts = customId.match(regex);

        return rawParts.map(part => part.replace(/^\[|\]$/g, '')); // Elimina los corchetes si quieres solo el contenido
    }

};