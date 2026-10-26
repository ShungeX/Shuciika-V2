const dialogueSystem = require('../../../functions/dialogoManager');
const {
    ACCIONES_VALIDAS,
    obtenerPasoActual,
    componentesDePaso,
    esSelect,
    accionDeComponente,
    marcarPasoResuelto,
    construirModalDeBoton,
    ejecutarAccionDialogo
} = require('../../dialogoAcciones');

module.exports = {
    customId: "dialogue_act",
    soloAutor: true,

    /**
     * Handler para botones interactivos de diálogos.
     * Soporta custom_id estructurado: dialogue_act-{user_id}-{character_id}-{action}-{param}
     * Acciones: jump, next, prev, inventory, perfil, item
     *
     * Si el botón tiene un modal configurado en el dashboard, se abre el modal
     * y la acción se ejecuta al enviarlo (ver interaction/modals/Rol/dialogue_modal.js).
     */
    ejecutar: async function(params, ...rest) {
        let client, interaction, componentData, characterId;
        if (params && params.interaction) {
            client = params.client;
            interaction = params.interaction;
            componentData = params.componentData;
            characterId = componentData?.characterId;
        } else {
            client = params;
            interaction = rest[0];
            const { splitCustomId } = require('../../../utils/constructores/customId');
            const [action, uId, cId, ...ex] = splitCustomId(interaction.customId);
            componentData = { userId: uId, characterId: cId, extras: ex };
            characterId = cId;
        }

        const userId = interaction.user.id;
        const userData = dialogueSystem.activeDialogues.get(userId);
        if (!userData) {
            return interaction.reply({ content: "Este diálogo ya no está activo o ha expirado 〒▽〒", flags: ["Ephemeral"] });
        }

        // Protección atómica contra race conditions (ej. si el timeout acaba de expirar)
        if (userData.stepResolved) {
            return interaction.reply({ content: "El tiempo para responder ya ha expirado o ya se procesó una acción.", flags: ["Ephemeral"] });
        }

        const extras = componentData?.extras || [];
        const action = extras[0] || 'next';
        const param = extras.slice(1).join('-');

        const { currentDialogue } = obtenerPasoActual(userData);

        // ¿Qué botón del paso se ha pulsado? El customId solo lleva la acción,
        // así que se busca el que coincide en acción y parámetro.
        const botones = componentesDePaso(currentDialogue).filter(c => !esSelect(c));
        let indiceBoton = botones.findIndex(b => {
            const a = accionDeComponente(b);
            return a.actionType === action && String(a.actionParam || '') === String(param || '');
        });
        if (indiceBoton === -1) {
            indiceBoton = botones.findIndex(b => accionDeComponente(b).actionType === action);
        }
        const boton = indiceBoton >= 0 ? botones[indiceBoton] : null;

        // Un modal debe ser la PRIMERA respuesta a la interacción: no se puede
        // hacer deferUpdate antes. El paso se cierra al enviarlo, no aquí, para
        // que cancelar el modal no deje el diálogo bloqueado.
        if (boton?.modal) {
            try {
                const modal = await construirModalDeBoton(boton.modal, {
                    indiceBoton,
                    userId,
                    characterId,
                    interaction,
                    user: interaction.user,
                    userData
                });
                if (modal) {
                    return await interaction.showModal(modal);
                }
                console.warn(`[dialogue_act] El botón ${indiceBoton} de '${userData.dialogueId}' tiene un modal sin campos válidos.`);
            } catch (err) {
                console.error('[dialogue_act] Error mostrando el modal:', err);
                if (!interaction.replied && !interaction.deferred) {
                    return interaction.reply({ content: "Ocurrió un error al abrir el formulario.", flags: ["Ephemeral"] });
                }
                return;
            }
        }

        // Marcar atómicamente como resuelto para bloquear cualquier click concurrente o timeout tardío
        if (!marcarPasoResuelto(userId, userData)) {
            return interaction.reply({ content: "Esta acción ya se procesó.", flags: ["Ephemeral"] });
        }

        if (!ACCIONES_VALIDAS.includes(action)) {
            console.warn(`[dialogue_act] Acción no reconocida: '${action}'`);
            return interaction.deferUpdate().catch(() => {});
        }

        await ejecutarAccionDialogo({ interaction, userData, accion: action, param, characterId });
    }
};
