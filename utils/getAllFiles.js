const fs = require('fs');
const path = require('path');

module.exports = (directory, foldersOnly = false) => {
    let fileNames = [];
    if (!fs.existsSync(directory)) return fileNames;

    const files = fs.readdirSync(directory, { withFileTypes: true });

    for (const file of files) {
        const filePath = path.join(directory, file.name);
        const nameLower = file.name.toLowerCase();

        // Omitir carpetas históricas o archivadas
        if (nameLower === 'old' || nameLower === 'olds') continue;

        if (foldersOnly) {
            if (file.isDirectory()) {
                fileNames.push(filePath);
            }
        } else {
            if (file.isDirectory()) {
                // Escaneo recursivo de subcarpetas
                fileNames = fileNames.concat(module.exports(filePath, false));
            } else if (file.isFile()) {
                fileNames.push(filePath);
            }
        }
    }
    return fileNames;
};