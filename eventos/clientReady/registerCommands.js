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

        // ── Limpieza de huérfanos ──────────────────────────────────────────
        // El bucle de arriba solo recorre comandos LOCALES, así que un comando
        // cuyo archivo se borró (p. ej. /musica) seguía registrado en Discord
        // para siempre. Aquí se borra todo comando global que ya no tenga
        // archivo local (o que esté marcado como deleted).
        // Se aceptan ambos nombres (con y sin prefijo) porque create() registra
        // sin prefijo aunque la búsqueda use `${nameApp}${name}`.
        const nombresVigentes = new Set()
        for (const localCommand of localCommands) {
            if (localCommand.deleted) continue
            const n = localCommand.data.name
            nombresVigentes.add(n)
            nombresVigentes.add(`${nameApp}${n}`)
        }

        for (const cmd of applicationCommands.cache.values()) {
            if (!nombresVigentes.has(cmd.name)) {
                await applicationCommands.delete(cmd.id)
                console.log(`🧹 Comando huérfano eliminado "${cmd.name}" (ya no existe en slashcmd/)`)
            }
        }

        // Comandos de servidor (guild) heredados: este archivo solo registra
        // comandos globales, así que cualquier comando de guild es de una
        // versión antigua y aparece duplicado/fantasma en el menú.
        for (const g of client.guilds.cache.values()) {
            try {
                const guildCmds = await g.commands.fetch()
                for (const cmd of guildCmds.values()) {
                    await g.commands.delete(cmd.id)
                    console.log(`🧹 Comando de servidor heredado eliminado "${cmd.name}" en ${g.name}`)
                }
            } catch (e) {
                console.log(`No se pudieron revisar los comandos de servidor en ${g.name}: ${e.message}`)
            }
        }
    } catch (error) {
        console.log(error)
        console.log(`Ocurrio un error al registrar los comandos locales: ${error}`)
    }
}