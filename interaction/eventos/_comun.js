// interaction/eventos/_comun.js
// Utilidades compartidas por los eventos. El "_" del nombre hace que el registro de evento.js no lo cargue como evento.

const dialogoManager = require('../../functions/dialogoManager');

/** Responde efímero sin fallar si la interacción ya tenía respuesta. */
async function responderEfimero(interaction, content) {
    const payload = { content, flags: ["Ephemeral"] };
    if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(() => { });
    return interaction.reply(payload).catch(() => { });
}

/** true si el usuario ya está dentro de un evento de diálogo (exploración, despertar, bienvenida…). */
function tieneEventoEnCurso(userId) {
    return dialogoManager.activeDialogues.has(userId);
}

/**
 * Inicia un evento de diálogo para quien pulsó el botón, salvo que ya tenga uno en curso.
 * @returns {Promise<boolean>} false si no se pudo iniciar (ya se respondió al usuario)
 */
async function iniciarDialogoDeEvento({ interaction, character }, dialogoId, { tipo = "events", context = {} } = {}) {
    if (tieneEventoEnCurso(interaction.user.id)) {
        await responderEfimero(interaction, "Ya estás viviendo otro evento. Termínalo antes de empezar uno nuevo (⊙_⊙;)");
        return false;
    }

    const charId = character?._id;
    const resultado = await dialogoManager.startDialogue(tipo, dialogoId, interaction, interaction.user, {
        charId,
        context: { characterId: charId, ...context }
    });

    if (resultado === false) {
        await responderEfimero(interaction, "Este evento no está disponible ahora mismo 〒▽〒");
        return false;
    }
    return resultado === true || resultado?.success !== false;
}

/** Elemento aleatorio de una lista, evitando repetir el último que salió para ese usuario. */
function elegirAleatorio(lista, ultimos, userId) {
    if (lista.length <= 1) return lista[0];
    let indice;
    do {
        indice = Math.floor(Math.random() * lista.length);
    } while (indice === ultimos.get(userId));
    ultimos.set(userId, indice);
    return lista[indice];
}

module.exports = { responderEfimero, tieneEventoEnCurso, iniciarDialogoDeEvento, elegirAleatorio };
