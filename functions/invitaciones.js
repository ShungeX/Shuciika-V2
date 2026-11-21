// functions/invitaciones.js
// Tracking de invitaciones (pre-lanzamiento, T0).
//
// Mientras /rol crear_ficha está en T0, «Enviar ficha» abre un modal:
//   ¿Alguien te invitó?  Sí / Nadie, llegué solo   (obligatorio)
//   ¿Quién te invitó?    selector de usuario       (solo si respondió Sí)
//   ¿Cómo nos conociste? Amigo, TikTok, YouTube...  (obligatorio)
// La respuesta se guarda en CachePJ.invitacion y, al verificar, pasa al
// personaje: Personajes.invitadoPor (ID de Discord o null) e .invitacion.
//
// No hay contadores guardados: el conteo sale de una consulta (contarInvitaciones)
// sobre las fichas verificadas, así nada se duplica y se corrige solo si se anula
// una ficha. Una persona cuenta una sola vez aunque tenga varios personajes: vale
// la invitación de su primer personaje verificado que respondió la pregunta.

const { ModalBuilder, LabelBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require('discord.js');
const { crearCustomId } = require('../utils/constructores/customId');

const FUENTES = [
    { value: 'amigo', label: 'Amigo' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'web', label: 'Página web' },
    { value: 'alianza', label: 'Otro servidor (alianzas)' },
    { value: 'otro', label: 'Otro' },
];
const etiquetaFuente = (v) => FUENTES.find(f => f.value === v)?.label || 'Desconocido';

function construirModalInvitacion(userId) {
    return new ModalBuilder()
        .setCustomId(crearCustomId({ action: 'invitacion_ficha', userId, extras: ['enviar'] }))
        .setTitle('Antes de enviar tu ficha')
        .addComponents(
            new LabelBuilder()
                .setLabel('¿Alguien te invitó?')
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId('invito_alguien')
                        .setPlaceholder('Elige una opción')
                        .setRequired(true)
                        .addOptions(
                            { label: 'Sí, me invitó alguien del servidor', value: 'si', emoji: '💌' },
                            { label: 'Nadie / llegué solo', value: 'nadie', emoji: '🧭' }
                        )
                ),
            new LabelBuilder()
                .setLabel('¿Quién te invitó?')
                .setDescription('Solo si respondiste que sí. No puedes elegirte a ti ni a un bot.')
                .setUserSelectMenuComponent(
                    new UserSelectMenuBuilder()
                        .setCustomId('invitador')
                        .setPlaceholder('Busca a quien te invitó')
                        .setRequired(false)
                        .setMinValues(0)
                        .setMaxValues(1)
                ),
            new LabelBuilder()
                .setLabel('¿Cómo nos conociste?')
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId('como_conociste')
                        .setPlaceholder('Elige una opción')
                        .setRequired(true)
                        .addOptions(FUENTES.map(f => ({ label: f.label, value: f.value })))
                )
        );
}

/**
 * Lee y valida el modal.
 * @returns {{ ok: true, invitacion: { invitadoPor: string|null, comoNosConociste: string, fecha: number } } | { ok: false, error: string }}
 */
function leerRespuesta(interaction) {
    let respuesta, fuente, usuarios;
    try {
        respuesta = interaction.fields.getStringSelectValues('invito_alguien')?.[0];
        fuente = interaction.fields.getStringSelectValues('como_conociste')?.[0];
        usuarios = interaction.fields.getSelectedUsers('invitador');
    } catch (err) {
        return { ok: false, error: 'No pude leer tus respuestas, inténtalo otra vez.' };
    }

    if (!['si', 'nadie'].includes(respuesta)) return { ok: false, error: 'Dinos si alguien te invitó.' };
    if (!FUENTES.some(f => f.value === fuente)) return { ok: false, error: 'Dinos cómo nos conociste.' };

    let invitadoPor = null;
    if (respuesta === 'si') {
        const invitador = usuarios?.first?.();
        if (!invitador) return { ok: false, error: 'Respondiste que alguien te invitó, pero no elegiste a nadie. Vuelve a pulsar **Enviar ficha** y elige a la persona.' };
        if (invitador.id === interaction.user.id) return { ok: false, error: 'No puedes elegirte a ti mismo/a como invitador (¬‿¬)' };
        if (invitador.bot) return { ok: false, error: 'Un bot no puede invitarte. Elige a la persona que te trajo.' };
        invitadoPor = invitador.id;
    }

    return { ok: true, invitacion: { invitadoPor, comoNosConociste: fuente, fecha: Date.now() } };
}

/** Confirmación de envío (la misma que sin T0): el botón «[✅] Enviar» manda la ficha. */
function construirConfirmacionEnvio(userId) {
    return [
        {
            type: 17,
            accent_color: 16711680,
            spoiler: false,
            components: [
                { type: 10, content: '## ¿Estás seguro de que deseas enviar tu ficha?' },
                { type: 10, content: 'Revisa los siguientes puntos antes de continuar:' },
                {
                    type: 9,
                    accessory: {
                        type: 2, style: 3, label: '[✅] Enviar', emoji: null, disabled: false,
                        custom_id: crearCustomId({ action: 'crear_ficha', userId, extras: ['enviar_true'] })
                    },
                    components: [{
                        type: 10,
                        content: '- **Campos vacíos:** la información no completada se mostrará como `Desconocido` o quedará oculta en tu perfil.\n- **Bloqueo de edición:** una vez enviada, la ficha quedará congelada y no podrás editarla hasta que el staff la apruebe.\n- **Edición posterior:** podrás ajustar ciertos datos una vez que esté verificada.\n\n-# Para cancelar o seguir editando, simplemente descarta este mensaje.  (✿◡‿◡)'
                    }]
                }
            ]
        }
    ];
}

/**
 * Conteo de invitaciones calculado desde las fichas verificadas (Rol_db.Personajes).
 *  - Una persona (ownerID) cuenta una vez: vale su primer personaje verificado
 *    que respondió la pregunta (los demás personajes no cambian nada).
 *  - No cuentan los personajes inactivos (la persona salió del servidor).
 *  - El invitador cuenta aunque su ficha no esté verificada; `invitadorVerificado`
 *    dice si ya puede recibir la medalla.
 * @param {import('mongodb').MongoClient} clientdb
 */
async function contarInvitaciones(clientdb) {
    const personajes = clientdb.db('Rol_db').collection('Personajes');

    const porInvitado = await personajes.aggregate([
        { $match: { invitacion: { $exists: true }, Inactivo: { $ne: true } } },
        { $sort: { 'metadata.fechaCreacion': 1, _id: 1 } },
        {
            $group: {
                _id: '$ownerID',
                invitadoPor: { $first: '$invitadoPor' },
                fuente: { $first: '$invitacion.comoNosConociste' },
                fecha: { $first: '$metadata.fechaCreacion' },
                personaje: { $first: '$perfil.Nombre' },
                charId: { $first: '$_id' }
            }
        }
    ]).toArray();

    // Por si acaso: nadie se cuenta a sí mismo
    const validos = porInvitado.filter(p => p.invitadoPor && String(p.invitadoPor) !== String(p._id));

    const mapa = new Map();
    for (const p of validos) {
        const id = String(p.invitadoPor);
        if (!mapa.has(id)) mapa.set(id, { id, invitados: [] });
        mapa.get(id).invitados.push({ id: String(p._id), personaje: p.personaje || null, charId: p.charId, fecha: p.fecha || null });
    }

    const ids = [...mapa.keys()];
    const verificados = new Set(
        (await personajes.distinct('ownerID', { ownerID: { $in: ids }, Inactivo: { $ne: true } })).map(String)
    );

    const invitadores = [...mapa.values()].map(inv => ({
        ...inv,
        conteo: inv.invitados.length,
        invitadorVerificado: verificados.has(inv.id),
        invitados: inv.invitados.sort((a, b) => (a.fecha || 0) - (b.fecha || 0))
    })).sort((a, b) => b.conteo - a.conteo || a.id.localeCompare(b.id));

    const fuentes = {};
    for (const f of FUENTES) fuentes[f.label] = 0;
    for (const p of porInvitado) {
        const etiqueta = etiquetaFuente(p.fuente);
        fuentes[etiqueta] = (fuentes[etiqueta] || 0) + 1;
    }

    return {
        invitadores,
        fuentes,
        respondieron: porInvitado.length,
        llegaronSolos: porInvitado.filter(p => !p.invitadoPor).length
    };
}

module.exports = { FUENTES, etiquetaFuente, construirModalInvitacion, leerRespuesta, construirConfirmacionEnvio, contarInvitaciones };
