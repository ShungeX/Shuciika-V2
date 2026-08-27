const path = require("path");
const getAllFiles = require('./getAllFiles');

module.exports = (exceptions = []) => {
    let selectMenus = [];
    const selectDir = path.join(__dirname, "..", "interaction", "selectMenus");
    const selectFiles = getAllFiles(selectDir, false);

    for (const selectFile of selectFiles) {
        if (!selectFile.endsWith('.js')) continue;
        try {
            const selectObject = require(selectFile);
            if (exceptions.includes(selectObject.name) || exceptions.includes(selectObject.customId)) {
                continue;
            }
            selectMenus.push(selectObject);
        } catch (err) {
            console.error(`⚠️ Error al cargar selectMenu desde '${selectFile}':`, err.message);
        }
    }
    return selectMenus;
};