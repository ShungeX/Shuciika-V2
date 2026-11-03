const path = require('path');

// Importamos la función de despertar existente para delegar la sintonía inicial
let despertarAlmaFn = null;
try {
    const despertarOpts = require(path.join(__dirname, '..', '..', '..', 'interaction', 'selectMenus', 'Rol', 'Despertar options.js'));
    despertarAlmaFn = despertarOpts.despertarAlma;
} catch (err) {
    console.error('⚠️ [Hook: despertar_alma] No se pudo cargar Despertar options.js:', err.message);
}

module.exports = {
    id: "despertar_alma",
    nombre: "Despertar de Alma — Sintonía Inicial (primer_despertar)",
    descripcion: "Crea o prepara el Soul, escribe en él las variables vinculadas del diálogo (resonancia, disonancia, hilos lunares) y despliega la selección de sintonía en Discord (ComponentsV2).",
    // El Soul puede no existir aún al terminar el diálogo: los vínculos se escriben después de crearlo
    gestionaVinculos: true,

    /**
     * @param {Object} params
     * @param {import('discord.js').Client} params.client
     * @param {import('discord.js').ChatInputCommandInteraction} params.interaction
     * @param {Object} params.context - Variables acumuladas durante los pasos del diálogo
     * @param {import('discord.js').User} params.user
     * @param {Object} params.charDoc
     * @param {{ aplicados: object[], pendientes: object[] }} params.vinculos - Variables vinculadas por aplicar
     * @param {Object} params.dialogueSystem
     */
    ejecutar: async function ({ client, interaction, context, user, charDoc, vinculos, dialogueSystem }) {
        console.log(`✨ [Hook: despertar_alma] Iniciando despertar de alma para usuario ${user?.id || interaction?.user?.id}`);

        if (typeof despertarAlmaFn === 'function') {
            await despertarAlmaFn({ interaction, context, user, charDoc, vinculos });
        } else {
            console.error('❌ [Hook: despertar_alma] La función despertarAlma no está disponible.');
        }
    }
};
