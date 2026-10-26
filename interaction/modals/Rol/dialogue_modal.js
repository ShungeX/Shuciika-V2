const { crearModal } = require("../../../utils/constructores/crearComponente");
const dialogueSystem = require("../../../functions/dialogoManager");
const {
    obtenerPasoActual,
    componentesDePaso,
    esSelect,
    accionDeComponente,
    marcarPasoResuelto,
    ejecutarAccionDialogo
} = require("../../dialogoAcciones");

/**
 * Lee todos los campos del modal sin necesitar un mapeo fijo: los customId de
 * los campos los define el admin en el dashboard, así que no se conocen aquí.
 */
function leerCamposDelModal(interaction) {
    const valores = {};

    try {
        const coleccion = interaction.fields?.fields;
        if (coleccion && typeof coleccion.forEach === 'function') {
            coleccion.forEach((campo, clave) => {
                const id = campo?.customId || clave;
                if (id) valores[id] = campo?.value ?? '';
            });
            if (Object.keys(valores).length > 0) return valores;
        }
    } catch (err) {
        console.warn('[dialogue_modal] No se pudo leer interaction.fields.fields:', err.message);
    }

    // Respaldo: recorrer los componentes crudos del submit
    try {
        for (const fila of interaction.components || []) {
            for (const campo of fila.components || []) {
                const id = campo?.customId || campo?.custom_id;
                if (id) valores[id] = campo?.value ?? '';
            }
        }
    } catch (err) {
        console.warn('[dialogue_modal] No se pudieron leer los componentes del modal:', err.message);
    }

    return valores;
}

/**
 * Submit de los modals abiertos desde un botón de diálogo.
 * customId: dialogue_modal-{user_id}-{character_id}-{indice del botón}
 *
 * Lo que escriba el usuario queda en el contexto bajo el customId de cada
 * campo, así que es utilizable como {campo_1} en los pasos siguientes.
 */
module.exports = crearModal({
    customId: "dialogue_modal",
    soloAutor: true,
    // Los campos los define el admin en el dashboard, así que no hay mapeo fijo
    camposDinamicos: true,

    ejecutar: async function ({ interaction, componentData }) {
        const userId = interaction.user.id;
        const userData = dialogueSystem.activeDialogues.get(userId);

        if (!userData) {
            return interaction.reply({ content: "Este diálogo ya no está activo o ha expirado 〒▽〒", flags: ["Ephemeral"] });
        }

        const { currentDialogue } = obtenerPasoActual(userData);

        // El paso se cierra aquí, no al abrir el modal: si el usuario lo
        // cancela, el diálogo sigue esperando su respuesta.
        if (!marcarPasoResuelto(userId, userData)) {
            return interaction.reply({ content: "Esta acción ya se procesó.", flags: ["Ephemeral"] });
        }

        const valores = leerCamposDelModal(interaction);
        if (!userData.context || typeof userData.context !== 'object') userData.context = {};
        for (const [clave, valor] of Object.entries(valores)) {
            userData.context[clave] = valor;
        }
        dialogueSystem.activeDialogues.set(userId, userData);

        // El índice del botón que abrió el modal viaja en el customId
        const botones = componentesDePaso(currentDialogue).filter(c => !esSelect(c));
        const idx = Number(componentData?.extras?.[0]);
        let boton = Number.isInteger(idx) ? botones[idx] : null;
        if (!boton) boton = botones.find(b => b.modal);

        const { actionType, actionParam } = accionDeComponente(boton);

        await ejecutarAccionDialogo({
            interaction,
            userData,
            accion: actionType,
            param: actionParam,
            characterId: componentData?.characterId
        });
    }
});
