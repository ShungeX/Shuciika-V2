const path = require("path");
const getAllFiles = require('./getAllFiles');

module.exports = (exceptions = []) => {
    let modals = [];
    const modalsDir = path.join(__dirname, "..", "interaction", "modals");
    const modalsFiles = getAllFiles(modalsDir, false);

    for (const modalFile of modalsFiles) {
        if (!modalFile.endsWith('.js')) continue;
        try {
            const modalObject = require(modalFile);
            if (exceptions.includes(modalObject.name) || exceptions.includes(modalObject.customId)) {
                continue;
            }
            modals.push(modalObject);
        } catch (err) {
            console.error(`⚠️ Error al cargar modal desde '${modalFile}':`, err.message);
        }
    }
    return modals;
};