const { clientId, guild, devs} = require("../../configslash.json");
const getApplicationCommands = require("../../utils/getApplicationCommands");
const getLocalCommands = require("../../utils/getLocalCommands")
const areCommandsDifferent = require("../../utils/areCommandsDifferent");

module.exports = async (client) => {
    const localcmd = []
    
    try {
        const localCommands = await getLocalCommands();
        const applicationCommands = await getApplicationCommands(client);
        const aplicacion = await client.application.commands
        


    

        for (const localCommand of localCommands) {

            const localCommandJSON = localCommand.data.toJSON()

            const { name, description, options, contexts, dm_permissions} = localCommandJSON

            const existingCommand = await applicationCommands.cache.find((cmd) => cmd.name === name);
            
            if(existingCommand) {
                if (localCommand.deleted) {
                    await applicationCommands.delete(existingCommand.id);
                    console.log(`[🪨] Comando Eliminado "${name}" `)
                    continue;
                }

                if(areCommandsDifferent(existingCommand, localCommandJSON)) {

                    await applicationCommands.edit(existingCommand, {
                        contexts,
                        dm_permissions,
                        description,
                        options,
                    })
                    
                    console.log(`[🪄] Comando Actualizado "${name}".`)
               
                }


            }else {
                if(localCommand.deleted) {
                    console.log(`[🛡️] Omitiendo el registro del comando "${name}" / establecido cómo borrado`)
                    continue;
                }

                await applicationCommands.create({
                    name,
                    description,
                    options,
                })

                console.log(`[🌱] Comando registrado "${name}".`)
            }

            
        }
    } catch (error) {
        console.log(error)
        console.log(`Ocurrio un error al registrar los comandos locales: ${error}`)
    }
}