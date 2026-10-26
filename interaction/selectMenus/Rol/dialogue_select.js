const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente");
const dialogueSystem = require("../../../functions/dialogoManager");
const {
    obtenerPasoActual,
    componentesDePaso,
    esSelect,
    accionDeComponente,
    marcarPasoResuelto,
    aplicarSetVar,
    ejecutarAccionDialogo
} = require("../../dialogoAcciones");

/**
 * StringSelectMenus de los diálogos creados desde el dashboard.
 * customId: dialogue_select-{user_id}-{character_id}-{indice}
 *
 * Cada opción puede guardar un valor en una variable del evento y además
 * ejecutar una acción de navegación, igual que los botones.
 */
module.exports = crearStringSelectMenu({
    customId: "dialogue_select",
    soloAutor: true,

    ejecutar: async function ({ interaction, componentData }) {
        const userId = interaction.user.id;
        const userData = dialogueSystem.activeDialogues.get(userId);

        if (!userData) {
            return interaction.reply({ content: "Este diálogo ya no está activo o ha expirado 〒▽〒", flags: ["Ephemeral"] });
        }
        if (userData.stepResolved) {
            return interaction.reply({ content: "El tiempo para responder ya ha expirado o ya se procesó una acción.", flags: ["Ephemeral"] });
        }

        // Se leen de la interacción para soportar también los selects múltiples
        const elegidos = Array.isArray(interaction.values) ? interaction.values : [];
        if (elegidos.length === 0) {
            return interaction.deferUpdate().catch(() => {});
        }

        const { dialogue, currentDialogue } = obtenerPasoActual(userData);
        const componentes = componentesDePaso(currentDialogue);
        const selects = componentes.filter(esSelect);

        // Se localiza el select por las opciones elegidas, no por el índice del
        // customId: así sigue funcionando aunque el admin lo haya reescrito.
        let select = selects.find(s =>
            Array.isArray(s.options) && elegidos.every(v => s.options.some(o => o.value === v))
        );

        if (!select) {
            const idx = Number(componentData?.extras?.[0]);
            if (Number.isInteger(idx) && selects[idx]) select = selects[idx];
        }

        if (!select) {
            console.warn(`[dialogue_select] No se encontró el select del paso ${userData.currentStep} en '${userData.dialogueId}'`);
            await interaction.deferUpdate().catch(() => {});
            return;
        }

        const opciones = Array.isArray(select.options) ? select.options : [];
        const elegidas = elegidos
            .map(v => opciones.find(o => o.value === v))
            .filter(Boolean);

        if (elegidas.length === 0) {
            console.warn(`[dialogue_select] Valores no reconocidos (${elegidos.join(', ')}) en '${userData.dialogueId}'`);
            await interaction.deferUpdate().catch(() => {});
            return;
        }

        if (!marcarPasoResuelto(userId, userData)) {
            return interaction.reply({ content: "Esta acción ya se procesó.", flags: ["Ephemeral"] });
        }

        // Primero se escriben todas las variables, para que ya estén disponibles
        // como {nombre} cuando se renderice el paso siguiente.
        for (const opt of elegidas) {
            aplicarSetVar(userData, dialogue, opt.setVar);
        }
        dialogueSystem.activeDialogues.set(userId, userData);

        // En un select múltiple manda la acción de la primera opción elegida
        const { actionType, actionParam } = accionDeComponente(elegidas[0]);

        await ejecutarAccionDialogo({
            interaction,
            userData,
            accion: actionType,
            param: actionParam,
            characterId: componentData?.characterId
        });
    }
});
