const path = require('path');

const { enviarReflejo } = require(path.join(__dirname, '..', '..', '..', 'functions', 'reflejoKyu.js'));

module.exports = {
    id: "reflejo_kyu",
    nombre: "Reflejo — Mensaje cifrado",
    descripcion: "Envía al MD el paso del reflejo en blanco y, después, un embed negro con un enlace cifrado en runas. Continúa en otro mensaje si el diálogo dejó la variable 'kyu_continuacion'.",

    /**
     * @param {Object} params
     * @param {import('discord.js').Client} params.client
     * @param {import('discord.js').ChatInputCommandInteraction} params.interaction
     * @param {Object} params.context - Variables acumuladas durante los pasos del diálogo
     * @param {import('discord.js').User} params.user
     * @param {Object} params.charDoc
     * @param {Object} params.dialogueSystem
     */
    ejecutar: async function ({ interaction, context, user }) {
        const usuario = user || interaction?.user;
        if (!usuario) return;

        try {
            // Siempre al MD, aunque el diálogo venga de otro sitio.
            const canal = await usuario.createDM();
            await enviarReflejo(canal, usuario, context?.kyu_continuacion);
        } catch (err) {
            // 50007 = el usuario tiene los MD cerrados. No es un fallo del evento:
            // simplemente no lo recibe, y el diálogo sigue su curso.
            if (err?.code !== 50007) console.error('[Hook: reflejo_kyu]', err.message);
        }
    }
};
