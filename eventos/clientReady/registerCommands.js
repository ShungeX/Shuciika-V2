const { Client } = require("discord.js")

const { clientId, guild, devs } = require("../../config/configslash.json");
const getApplicationCommands = require("../../utils/getApplicationCommands");
const getLocalCommands = require("../../utils/getLocalCommands")
const areCommandsDifferent = require("../../utils/areCommandsDifferent");

/**
* 
* @param { Client } client 
* @param {ChatInputCommandInteraction} interaction 
*/
module.exports = async (client) => {


    const localcmd = []
    var nameApp = ""

    if (client.user.id === "857050098831065088") {
        nameApp = "navi-"
    } else {
        nameApp = ""
    }

    try {
        const localCommands = await getLocalCommands();
        const applicationCommands = await getApplicationCommands(client);

        for (const localCommand of localCommands) {

            if (localCommand.data.name === 'rol' && localCommand.cargarSubCommands) {
                console.log("🛠️ Construyendo el comando /rol con sus subcomandos dinámicos...");
                await localCommand.cargarSubCommands.call(localCommand);
            }

            const localCommandJSON = localCommand.data.toJSON()

            const { name, description, options, contexts, dm_permissions } = localCommandJSON

            const existingCommand = await applicationCommands.cache.find((cmd) => cmd.name === `${nameApp}${name}`);

            if (existingCommand) {
                if (localCommand.deleted) {
                    await applicationCommands.delete(existingCommand.id);
                    console.log(`🪨 Comando Eliminado "${name}" `)
                    continue;
                }

                if (areCommandsDifferent(existingCommand, localCommandJSON)) {

                    await applicationCommands.edit(existingCommand, {
                        contexts,
                        dm_permissions,
                        description,
                        options,
                    })

                    console.log(`🪄 Comando Actualizado "${nameApp}${name}".`)

                }


            } else {
                if (localCommand.deleted) {
                    console.error(`🧨 Omitiendo el registro del comando "${nameApp}${name}" / establecido cómo borrado`)
                    continue;
                }

                await applicationCommands.create({
                    name,
                    description,
                    options,
                })

                console.log(`[🌱] Comando registrado "${nameApp}${name}".`)
            }


        }
    } catch (error) {
        console.log(error)
        console.log(`Ocurrio un error al registrar los comandos locales: ${error}`)
    }
}