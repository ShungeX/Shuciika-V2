// reenumerate_steps.js

const fs = require('fs');
const path = require('path');

/**
 * Script para reenumerar la propiedad 'step' en un array de objetos JSON.
 * Se basa en el orden de los elementos en el array.
 *
 * Uso: node enumerarSteps.js <ruta_al_archivo_json>
 *
 * Ejemplo: node enumerarSteps.js ./data/dialogos.json
 */

// Obtener la ruta del archivo JSON desde los argumentos de la línea de comandos
const jsonFilePath = process.argv[2];

if (!jsonFilePath) {
    console.error('Error: Debes proporcionar la ruta al archivo JSON.');
    console.error('Uso: node reenumerate_steps.js <ruta_al_archivo_json>');
    process.exit(1); // Salir con un código de error
}

async function reenumerateSteps(filePath) {
    try {
        // 1. Verificar si el archivo existe
        if (!fs.existsSync(filePath)) {
            console.error(`Error: El archivo no existe en la ruta: ${filePath}`);
            return;
        }

        // 2. Leer el contenido del archivo JSON
        console.log(`Leyendo el archivo: ${filePath}`);
        const rawData = await fs.promises.readFile(filePath, 'utf8');

        // 3. Parsear el contenido JSON
        let sections; // Cambiado a 'sections' para reflejar la estructura de alto nivel
        try {
            sections = JSON.parse(rawData);
        } catch (parseError) {
            console.error(`Error: No se pudo parsear el archivo JSON. Asegúrate de que el formato sea válido.`);
            console.error(parseError.message);
            return;
        }

        // Asegurarse de que el JSON sea un array de secciones
        if (!Array.isArray(sections)) {
            console.error('Error: El contenido del archivo JSON debe ser un array de secciones (ej. introduccion, etc.).');
            return;
        }

        // 4. Crear una copia de seguridad del archivo original
        const backupFilePath = `${filePath}.bak`;
        await fs.promises.copyFile(filePath, backupFilePath);
        console.log(`Copia de seguridad creada en: ${backupFilePath}`);

        // 5. Reenumerar la propiedad 'step' dentro de cada array 'dialogos'
        console.log('Reenumerando los steps dentro de cada sección...');
        let changesMade = false;

        sections.forEach(section => {
            // Verificar si la sección tiene un array 'dialogos'
            if (section.dialogos && Array.isArray(section.dialogos)) {
                section.dialogos.forEach((dialogue, index) => {
                    const newStep = index; // Los steps comienzan desde 0 dentro de cada array 'dialogos'
                    if (dialogue.step !== newStep) {
                        dialogue.step = newStep;
                        changesMade = true;
                    }
                });
            } else {
                console.warn(`Advertencia: La sección con ID '${section.id || 'desconocido'}' no contiene un array 'dialogos' o no es un array.`);
            }
        });

        if (!changesMade) {
            console.log('No se encontraron cambios en la numeración de los steps. El archivo ya estaba ordenado.');
            return;
        }

        // 6. Escribir el JSON actualizado de nuevo al archivo
        // Usamos JSON.stringify con indentación para que el archivo sea legible
        const updatedJson = JSON.stringify(sections, null, 2);
        await fs.promises.writeFile(filePath, updatedJson, 'utf8');

        console.log('¡Steps reenumerados exitosamente!');
        console.log(`El archivo ${filePath} ha sido actualizado.`);

    } catch (error) {
        console.error('Ocurrió un error inesperado:', error.message);
        // console.error(error.stack); // Descomenta para ver el stack trace completo
    }
}

// Ejecutar la función principal
reenumerateSteps(jsonFilePath);