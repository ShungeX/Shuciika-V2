const path = require('path')
const getAllFiles = require("../utils/getAllFiles")

module.exports = (client) => {
    const eventFolders = getAllFiles(path.join(__dirname, '..', 'eventos'), true);

    for (const eventFolder of eventFolders) {
        const eventFiles = getAllFiles(eventFolder);

        const eventName = eventFolder.replace(/\\/g, '/').split('/').pop();
        eventFiles.sort((a, b) => a.localeCompare(b));

        client.on(eventName, async (...args) => {
            for (const eventFile of eventFiles) {
                const eventFunction = require(eventFile);

                const resultado = await eventFunction(client, ...args);

                if (resultado === false) break;
            }
        });
    }
};