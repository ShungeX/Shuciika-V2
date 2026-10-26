// interaction/dialogoAcciones.js
// Lógica compartida por los componentes de diálogo creados desde el dashboard:
// botones (dialogue_act), StringSelectMenus (dialogue_select) y modals (dialogue_modal).
//
// Aquí vive lo que los tres necesitan por igual: escribir las variables del
// evento en el contexto del usuario y ejecutar la acción de navegación.

const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const dialogueSystem = require('../functions/dialogoManager');

const ACCIONES_VALIDAS = ['next', 'jump', 'prev', 'inventory', 'perfil', 'item'];

/** Devuelve el diálogo en curso y el paso en el que está el usuario. */
function obtenerPasoActual(userData) {
    const dialogue = dialogueSystem.obtenerDialogoPorId(userData.type, userData.dialogueId);
    const stepsList = dialogue?.dialogos || dialogue?.steps || [];
    return { dialogue, stepsList, currentDialogue: stepsList[userData.currentStep] };
}

/** Los componentes de un paso, admitiendo el nombre antiguo `buttons`. */
function componentesDePaso(paso) {
    if (!paso) return [];
    if (Array.isArray(paso.components)) return paso.components;
    if (Array.isArray(paso.buttons)) return paso.buttons;
    return [];
}

function esSelect(comp) {
    if (!comp || typeof comp !== 'object') return false;
    const tipo = String(comp.type || '').toUpperCase().replace(/[\s_-]/g, '');
    if (tipo === 'STRINGSELECT' || tipo === 'STRINGSELECTMENU' || tipo === 'SELECTMENU' || tipo === 'SELECT') return true;
    if (tipo === 'BUTTON') return false;
    return Array.isArray(comp.options);
}

/**
 * Deduce la acción de un componente guardado con el formato antiguo, donde
 * iba codificada dentro del customId en vez de en `actionType`.
 */
function accionDeComponente(comp) {
    if (!comp) return { actionType: 'next', actionParam: '' };
    if (ACCIONES_VALIDAS.includes(comp.actionType)) {
        return { actionType: comp.actionType, actionParam: comp.actionParam != null ? String(comp.actionParam) : '' };
    }

    const cId = comp.customId || comp.custom_id || comp.value || '';
    if (cId.includes('-jump-')) return { actionType: 'jump', actionParam: cId.split('-jump-')[1] || '' };
    if (cId.includes('-item-')) return { actionType: 'item', actionParam: cId.split('-item-')[1] || '' };
    if (cId.includes('-prev')) return { actionType: 'prev', actionParam: '' };
    if (cId.includes('-inventory')) return { actionType: 'inventory', actionParam: '' };
    if (cId.includes('-perfil')) return { actionType: 'perfil', actionParam: '' };
    return { actionType: 'next', actionParam: '' };
}

/**
 * Cierra el paso de forma atómica para que un clic concurrente o un timeout
 * tardío no puedan procesarse también. Devuelve false si ya estaba cerrado.
 */
function marcarPasoResuelto(userId, userData) {
    if (userData.stepResolved) return false;
    userData.stepResolved = true;
    if (userData.skipTimeout) {
        clearTimeout(userData.skipTimeout);
        delete userData.skipTimeout;
    }
    dialogueSystem.activeDialogues.set(userId, userData);
    return true;
}

/** Convierte un valor al tipo declarado de la variable. */
function castearValor(valor, tipo) {
    if (tipo === 'number') {
        const n = Number(valor);
        return Number.isFinite(n) ? n : 0;
    }
    if (tipo === 'boolean') return valor === true || valor === 'true';
    return valor === null || valor === undefined ? '' : String(valor);
}

/**
 * Escribe una variable del evento en el contexto del usuario, de forma que
 * pase a estar disponible como {nombre} en los textos y embeds posteriores.
 *
 * `setVar` viene del dashboard: { name, type, mode: 'set'|'add'|'sub', value }.
 * Sumar y restar solo se aplican a variables numéricas.
 */
function aplicarSetVar(userData, dialogue, setVar) {
    if (!setVar || !setVar.name) return null;

    const declaradas = Array.isArray(dialogue?.variables) ? dialogue.variables : [];
    const declarada = declaradas.find(v => v && v.name === setVar.name);
    if (!declarada) {
        console.warn(`[dialogoAcciones] La variable '${setVar.name}' no está declarada en el evento '${dialogue?._id}'; se ignora.`);
        return null;
    }

    const tipo = declarada.type || 'string';
    if (!userData.context || typeof userData.context !== 'object') userData.context = {};

    const operando = castearValor(setVar.value, tipo);
    let modo = setVar.mode === 'add' || setVar.mode === 'sub' ? setVar.mode : 'set';
    if (tipo !== 'number') modo = 'set';

    let resultado;
    if (modo === 'set') {
        resultado = operando;
    } else {
        const actual = Number(userData.context[setVar.name]);
        const base = Number.isFinite(actual) ? actual : 0;
        resultado = modo === 'add' ? base + operando : base - operando;
    }

    userData.context[setVar.name] = resultado;
    return { name: setVar.name, mode: modo, value: resultado };
}

/**
 * Construye el modal de un botón tal y como lo definió el dashboard.
 *
 * El customId se genera aquí (dialogue_modal-{userId}-{charId}-{indice}) en vez
 * de usar el guardado: así el despachador siempre encuentra el handler y
 * `soloAutor` funciona aunque el admin haya reescrito la plantilla.
 */
async function construirModalDeBoton(modalCfg, { indiceBoton, userId, characterId, interaction, user, userData }) {
    if (!modalCfg || !Array.isArray(modalCfg.inputs) || modalCfg.inputs.length === 0) return null;

    const contextData = { interaction, user, userData };
    const resolver = async (txt) => {
        if (!txt) return '';
        try {
            return await dialogueSystem.parseTextAsync(String(txt), contextData);
        } catch {
            return String(txt);
        }
    };

    const titulo = (await resolver(modalCfg.title)) || 'Formulario';
    const modal = new ModalBuilder()
        .setCustomId(`dialogue_modal-${userId}-${characterId ?? ''}-${indiceBoton}`)
        .setTitle(titulo.slice(0, 45));

    // Discord admite como máximo 5 campos, cada uno en su propia fila
    const filas = [];
    for (const [i, inp] of modalCfg.inputs.slice(0, 5).entries()) {
        const etiqueta = (await resolver(inp.label)) || `Campo ${i + 1}`;
        const campo = new TextInputBuilder()
            .setCustomId(String(inp.customId || `campo_${i + 1}`).slice(0, 100))
            .setLabel(etiqueta.slice(0, 45))
            .setStyle(inp.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(inp.required !== false);

        if (inp.placeholder) {
            const ph = await resolver(inp.placeholder);
            if (ph) campo.setPlaceholder(ph.slice(0, 100));
        }
        const min = Number(inp.minLength) || 0;
        const max = Number(inp.maxLength) || 0;
        if (min > 0) campo.setMinLength(Math.min(min, 4000));
        if (max > 0) campo.setMaxLength(Math.min(Math.max(max, min || 1), 4000));

        filas.push(new ActionRowBuilder().addComponents(campo));
    }

    if (filas.length === 0) return null;
    modal.addComponents(...filas);
    return modal;
}

/**
 * Ejecuta una acción de diálogo. Es la misma lógica que ya usaban los botones,
 * extraída aquí para que los selects y los modals se comporten igual.
 *
 * Quien llama debe haber cerrado el paso con marcarPasoResuelto().
 */
async function ejecutarAccionDialogo({ interaction, userData, accion, param, characterId }) {
    const userId = interaction.user.id;
    const { stepsList, currentDialogue } = obtenerPasoActual(userData);
    const accionFinal = ACCIONES_VALIDAS.includes(accion) ? accion : 'next';

    switch (accionFinal) {
        case 'jump': {
            const targetStep = Number(param);
            await interaction.deferUpdate().catch(() => {});
            if (!isNaN(targetStep) && targetStep >= 0 && targetStep < stepsList.length) {
                await dialogueSystem.jumpToStep(userId, targetStep, interaction);
            } else {
                console.warn(`[dialogoAcciones] Paso destino inválido: ${param} en diálogo '${userData.dialogueId}'`);
            }
            break;
        }

        case 'next': {
            await interaction.deferUpdate().catch(() => {});
            userData.currentStep++;
            if (currentDialogue?.nextStep !== undefined) {
                userData.currentStep = currentDialogue.nextStep;
            }
            dialogueSystem.activeDialogues.set(userId, userData);
            await dialogueSystem.processNextStep(interaction, interaction.user);
            break;
        }

        case 'prev': {
            await interaction.deferUpdate().catch(() => {});
            userData.currentStep = Math.max(0, userData.currentStep - 1);
            dialogueSystem.activeDialogues.set(userId, userData);
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
                const { construirPerfilV2 } = require('../handlers/CMDHandler/Rol/Personajes/Perfil');
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
                console.error('[dialogoAcciones] Error mostrando perfil:', err);
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
                console.error('[dialogoAcciones] Error otorgando item:', err);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: "Ocurrió un error al otorgar el objeto.", flags: ["Ephemeral"] });
                }
            }
            break;
        }
    }
}

module.exports = {
    ACCIONES_VALIDAS,
    obtenerPasoActual,
    componentesDePaso,
    esSelect,
    accionDeComponente,
    marcarPasoResuelto,
    aplicarSetVar,
    construirModalDeBoton,
    ejecutarAccionDialogo
};
