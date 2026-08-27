const path = require("path");
const getAllFiles = require('./getAllFiles');

module.exports = (exceptions = []) => {
    let buttons = [];
    const buttonsDir = path.join(__dirname, "..", "interaction", "buttons");
    const buttonsFiles = getAllFiles(buttonsDir, false);

    for (const buttonsFile of buttonsFiles) {
        if (!buttonsFile.endsWith('.js')) continue;
        try {
            const buttonsObject = require(buttonsFile);
            if (exceptions.includes(buttonsObject.name) || exceptions.includes(buttonsObject.customId)) {
                continue;
            }
            buttons.push(buttonsObject);
        } catch (err) {
            console.error(`⚠️ Error al cargar botón desde '${buttonsFile}':`, err.message);
        }
    }
    return buttons;
};