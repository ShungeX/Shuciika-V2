const dialogueSystem = require('../../../functions/dialogoManager');

module.exports = {
    customId: "dialogue_act",
    soloAutor: true,

    /**
     * Handler para botones interactivos de diálogos.
     * Soporta custom_id estructurado: dialogue_act-{user_id}-{character_id}-{action}-{param}
     * Acciones: jump, next, prev, inventory, perfil, item
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

        const userData = dialogueSystem.activeDialogues.get(interaction.user.id);
        if (!userData) {
            return interaction.reply({ content: "Este diálogo ya no está activo o ha expirado 〒▽〒", flags: ["Ephemeral"] });
        }

        // Protección atómica contra race conditions (ej. si el timeout acaba de expirar)
        if (userData.stepResolved) {
            return interaction.reply({ content: "El tiempo para responder ya ha expirado o ya se procesó una acción.", flags: ["Ephemeral"] });
        }

        // Marcar atómicamente como resuelto para bloquear cualquier click concurrente o timeout tardío
        userData.stepResolved = true;
        if (userData.skipTimeout) {
            clearTimeout(userData.skipTimeout);
            delete userData.skipTimeout;
        }
        dialogueSystem.activeDialogues.set(interaction.user.id, userData);

        const extras = componentData?.extras || [];
        const action = extras[0] || 'next';
        const param = extras.slice(1).join('-');

        const dialogue = dialogueSystem.obtenerDialogoPorId(userData.type, userData.dialogueId);
        const stepsList = dialogue?.dialogos || dialogue?.steps || [];
        const currentDialogue = stepsList[userData.currentStep];

        switch (action) {
            case 'jump': {
                const targetStep = Number(param);
                await interaction.deferUpdate().catch(() => {});
                if (!isNaN(targetStep) && targetStep >= 0 && targetStep < stepsList.length) {
                    await dialogueSystem.jumpToStep(interaction.user.id, targetStep, interaction);
                } else {
                    console.warn(`[dialogue_act] Paso destino inválido: ${param} en diálogo '${userData.dialogueId}'`);
                }
                break;
            }

            case 'next': {
                await interaction.deferUpdate().catch(() => {});
                userData.currentStep++;
                if (currentDialogue?.nextStep !== undefined) {
                    userData.currentStep = currentDialogue.nextStep;
                }
                dialogueSystem.activeDialogues.set(interaction.user.id, userData);
                await dialogueSystem.processNextStep(interaction, interaction.user);
                break;
            }

            case 'prev': {
                await interaction.deferUpdate().catch(() => {});
                userData.currentStep = Math.max(0, userData.currentStep - 1);
                dialogueSystem.activeDialogues.set(interaction.user.id, userData);
                await dialogueSystem.processNextStep(interaction, interaction.user);
                break;
            }

            case 'inventory': {
                await interaction.deferUpdate().catch(() => {});
                await dialogueSystem.handleShowInventory(null, { interaction, user: interaction.user, userData });
                break;
            }

            case 'perfil': {
                try {
                    const { construirPerfilV2 } = require('../../../handlers/CMDHandler/Rol/Personajes/Perfil');
                    let charDoc = userData?.charDoc;
                    if (!charDoc && interaction.user) {
                        const targetCharId = characterId || userData?.context?.characterId || userData?.charId;
                        charDoc = await dialogueSystem.obtenerPersonajeActivo(interaction.user.id, targetCharId);
                        if (charDoc && userData) userData.charDoc = charDoc;
                    }
                    if (charDoc) {
                        const perfilV2 = construirPerfilV2(charDoc, interaction.user.id);
                        await interaction.reply({ components: perfilV2, flags: ["IsComponentsV2", "SuppressNotifications", "Ephemeral"] });
                    } else {
                        await interaction.reply({ content: "No se encontró el perfil de tu personaje.", flags: ["Ephemeral"] });
                    }
                } catch (err) {
                    console.error('[dialogue_act] Error mostrando perfil:', err);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: "Ocurrió un error al cargar el perfil.", flags: ["Ephemeral"] });
                    }
                }
                break;
            }

            case 'item': {
                try {
                    await dialogueSystem.handleDarItem(param, { interaction, user: interaction.user, userData });
                    await interaction.reply({ content: `🎁 ¡Has recibido el objeto: \`${param}\`!`, flags: ["Ephemeral"] });
                } catch (err) {
                    console.error('[dialogue_act] Error otorgando item:', err);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: "Ocurrió un error al otorgar el objeto.", flags: ["Ephemeral"] });
                    }
                }
                break;
            }

            default: {
                console.warn(`[dialogue_act] Acción no reconocida: '${action}'`);
                await interaction.deferUpdate().catch(() => {});
                break;
            }
        }
    }
};
