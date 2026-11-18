const path = require('path')
const getAllFiles = require('./getAllFiles')

// Los comandos se leen del disco una sola vez; antes se recorría slashcmd/ en cada comando ejecutado.
let comandosCargados = null

module.exports = (exceptions = []) => {
    if (comandosCargados === null) {
        const localCommands = []

        const commandsCategories = getAllFiles(
            path.join(__dirname, '..', 'slashcmd'),
            true
        )

        for (const commandsCategory of commandsCategories) {
            for (const commandFile of getAllFiles(commandsCategory)) {
                localCommands.push(require(commandFile))
            }
        }

        comandosCargados = localCommands
    }

    if (!exceptions.length) return comandosCargados
    return comandosCargados.filter((cmd) => !exceptions.includes(cmd.name))
}
