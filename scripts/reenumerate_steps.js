// reenumerate_steps.js
//
// Reenumera 'step' en cada 'dialogos[]' de un archivo con secciones tipo:
// [ { id, requisitos, dialogos: [ {step, type, content, nextStep, components: [{nextStep}], ...} ] } ]
//
// A diferencia de la versión original, este script SÍ reescribe todas las
// referencias cruzadas (dialogue.nextStep y component.nextStep) para que
// sigan apuntando al step correcto después de renumerar.
//
// Si un mismo 'step' original aparece repetido dentro de la misma sección
// (ej. varios objetos con step: 36), no hay forma automática de saber a
// cuál de esas copias apuntaba una referencia vieja. El script lo detecta
// y avisa en consola para que lo revises a mano antes de confiar en el
// remapeo de esa sección.
//
// Uso: node reenumerate_steps.js <ruta_al_archivo_json>

const fs = require('fs');

const jsonFilePath = process.argv[2];

if (!jsonFilePath) {
    console.error('Error: Debes proporcionar la ruta al archivo JSON.');
    console.error('Uso: node reenumerate_steps.js <ruta_al_archivo_json>');
    process.exit(1);
}

async function reenumerateSteps(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`Error: El archivo no existe en la ruta: ${filePath}`);
            return;
        }

        console.log(`Leyendo el archivo: ${filePath}`);
        const rawData = await fs.promises.readFile(filePath, 'utf8');

        let sections;
        try {
            sections = JSON.parse(rawData);
        } catch (parseError) {
            console.error('Error: No se pudo parsear el archivo JSON.');
            console.error(parseError.message);
            return;
        }

        if (!Array.isArray(sections)) {
            console.error('Error: El contenido del archivo JSON debe ser un array de secciones.');
            return;
        }

        const backupFilePath = `${filePath}.bak`;
        await fs.promises.copyFile(filePath, backupFilePath);
        console.log(`Copia de seguridad creada en: ${backupFilePath}`);

        let changesMade = false;
        let hadAmbiguousDuplicates = false;

        sections.forEach(section => {
            if (!section.dialogos || !Array.isArray(section.dialogos)) {
                console.warn(`Advertencia: la sección '${section.id || 'desconocido'}' no tiene un array 'dialogos' válido.`);
                return;
            }

            // 1) Detectar duplicados de 'step' ANTES de tocar nada
            const positionsByOldStep = new Map(); // oldStep -> [index, index, ...]
            section.dialogos.forEach((dlg, index) => {
                const list = positionsByOldStep.get(dlg.step) || [];
                list.push(index);
                positionsByOldStep.set(dlg.step, list);
            });

            const duplicated = [...positionsByOldStep.entries()].filter(([, idxs]) => idxs.length > 1);
            if (duplicated.length > 0) {
                hadAmbiguousDuplicates = true;
                console.warn(`\n⚠️  Sección '${section.id}': steps duplicados detectados:`);
                duplicated.forEach(([oldStep, idxs]) => {
                    console.warn(`   step ${oldStep} aparece ${idxs.length} veces en las posiciones [${idxs.join(', ')}]:`);
                    idxs.forEach(i => {
                        const dlg = section.dialogos[i];
                        const snippet = (dlg.content || dlg.embeds?.[0]?.description || '').slice(0, 60);
                        console.warn(`     - índice ${i}: "${snippet}"`);
                    });
                });
                console.warn(`   Si algo tenía 'nextStep: ${duplicated[0][0]}' apuntando a UNA de estas copias,`);
                console.warn(`   el remapeo automático usa la ÚLTIMA ocurrencia -- revísalo a mano.\n`);
            }

            // 2) Construir el mapa oldStep -> newStep (índice en el array)
            const oldToNew = new Map();
            section.dialogos.forEach((dlg, index) => {
                oldToNew.set(dlg.step, index); // en duplicados, gana la última ocurrencia
            });

            // 3) Reescribir 'step' y remapear TODAS las referencias cruzadas
            section.dialogos.forEach((dlg, index) => {
                if (dlg.step !== index) {
                    dlg.step = index;
                    changesMade = true;
                }

                if (dlg.nextStep !== undefined && oldToNew.has(dlg.nextStep)) {
                    const remapped = oldToNew.get(dlg.nextStep);
                    if (remapped !== dlg.nextStep) {
                        dlg.nextStep = remapped;
                        changesMade = true;
                    }
                }

                if (Array.isArray(dlg.components)) {
                    dlg.components.forEach(comp => {
                        if (comp.nextStep !== undefined && oldToNew.has(comp.nextStep)) {
                            const remapped = oldToNew.get(comp.nextStep);
                            if (remapped !== comp.nextStep) {
                                comp.nextStep = remapped;
                                changesMade = true;
                            }
                        }
                    });
                }
            });
        });

        if (!changesMade) {
            console.log('No se encontraron cambios. El archivo ya estaba ordenado.');
            return;
        }

        const updatedJson = JSON.stringify(sections, null, 2);
        await fs.promises.writeFile(filePath, updatedJson, 'utf8');

        console.log('¡Steps y referencias (nextStep) reenumerados exitosamente!');
        if (hadAmbiguousDuplicates) {
            console.log('⚠️  Revisa los avisos de duplicados de arriba antes de dar esto por bueno.');
        }
        console.log(`El archivo ${filePath} ha sido actualizado.`);

    } catch (error) {
        console.error('Ocurrió un error inesperado:', error.message);
    }
}

reenumerateSteps(jsonFilePath);
