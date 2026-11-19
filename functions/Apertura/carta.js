// functions/Apertura/carta.js
// Las dos versiones de la «Ficha académica verificada» que recibe un personaje
// nuevo por MD:
//   - cartaFinal: la de siempre, cuando el instituto ya está abierto.
//   - cartaPreApertura: la de antes de la apertura (fichas creadas con T0). Habla
//     en futuro y la edita el trabajo de la Campana (ver cartas.js) con cartaFinal.

const { crearCustomId } = require('../../utils/constructores/customId');

const GUILD_ID = '716342375303217285';
const URL_NORMAS = `https://discord.com/channels/${GUILD_ID}/716865470648680448`;
const IMAGEN = 'https://i.pinimg.com/736x/9e/e7/d3/9ee7d3a8aba958ea3cee267f469bc9df.jpg';
const PIE = '-# Ficha revisada y verificada por la Administración del Instituto | Instituto mágico Shuciika';

function cabecera(texto) {
    return {
        type: 9,
        accessory: { type: 11, media: { url: IMAGEN }, description: null, spoiler: false },
        components: [
            { type: 10, content: '# Ficha académica verificada' },
            { type: 10, content: texto }
        ]
    };
}

const separador = (spacing) => ({ type: 14, divider: true, spacing });
const texto = (content) => ({ type: 10, content });
const botonNormas = () => ({ type: 2, style: 5, label: 'Normas del rol', emoji: null, disabled: false, url: URL_NORMAS });

/**
 * @param {{ nombre: string, charId: string|number, userId: string }} datos
 */
function cartaFinal({ nombre, charId, userId }) {
    const id = charId ?? '';
    return [{
        type: 17,
        accent_color: null,
        spoiler: false,
        components: [
            cabecera(`*Estimado/a ${nombre}*\n\nTras una cuidadosa revisión de tu solicitud de admisión, nos complace informarte que tu registro ha sido **validado y aceptado** por el instituto.\n\nUn gran viaje de conocimiento y poder te espera entre nuestros muros. A partir de este momento, eres oficialmente aprendiz de las artes arcanas. Que tus estudios sean fructíferos y tu lealtad a los principios que nos rigen sea tan brillante como tu propia magia. \n\n**¡Bienvenido/a a tu nuevo hogar!**`),
            separador(2),
            texto('**✧ Tus Herramientas Mágicas ** \n- -# Tu conexión con el instituto ha sido activada. Ahora puedes usar los comandos de rol `(/rol + comando)` para interactuar con el mundo. Comienza por consultar tu perfil con `/rol perfil` en el canal de comandos.'),
            texto('**✧ Tu Identidad Institucional ** \n- -# Se te han asignado roles que reflejan tu información. Estas credenciales te otorgan acceso formal a las dependencias, aulas y zonas comunes del instituto.'),
            texto('**✧ Siguientes Pasos ** \n- -# Para asegurar una transición fluida y honorable a tu nueva vida en el instituto, te instamos a familiarizarte con los siguientes recursos:'),
            {
                type: 1,
                components: [
                    botonNormas(),
                    {
                        type: 2, style: 2, label: 'Canales principales', emoji: null, disabled: false,
                        custom_id: crearCustomId({ action: 'informacionRol', characterId: id, userId, extras: ['null', 'chprincipales'] })
                    },
                    {
                        type: 2, style: 2, label: 'Primeros pasos', emoji: null, disabled: false,
                        custom_id: crearCustomId({ action: 'informacionRol', characterId: id, userId, extras: ['null', 'inicioRol'] })
                    }
                ]
            },
            separador(1),
            texto(PIE)
        ]
    }];
}

/**
 * @param {{ nombre: string, charId: string|number, userId: string, timestamp?: number|null, eventoId?: string|null }} datos
 *   timestamp: segundos UNIX de la apertura. eventoId: evento programado de Discord.
 */
function cartaPreApertura({ nombre, charId, userId, timestamp, eventoId }) {
    const id = charId ?? '';
    const T0 = Number(timestamp) > 0 ? Math.floor(Number(timestamp)) : null;

    const pasos = T0
        ? `**✧ Siguientes Pasos ** \n- -# La ceremonia de apertura será el <t:${T0}:F> (<t:${T0}:R>) en el Auditorio del Instituto. Mientras tanto, repasa las normas y, si quieres, invita a quien quiera cruzar contigo.`
        : '**✧ Siguientes Pasos ** \n- -# La fecha de la ceremonia de apertura se anunciará muy pronto en el Auditorio del Instituto. Mientras tanto, repasa las normas y, si quieres, invita a quien quiera cruzar contigo.';

    const botones = [
        botonNormas(),
        {
            type: 2, style: 2, label: '🔔 Avísame cuando abra', emoji: null, disabled: false,
            custom_id: crearCustomId({ action: 'recordatorioApertura', characterId: id, userId, extras: ['null', 'recordatorio'] })
        }
    ];
    if (eventoId) {
        botones.push({ type: 2, style: 5, label: '📅 Ver el evento', emoji: null, disabled: false, url: `https://discord.com/events/${GUILD_ID}/${eventoId}` });
    }

    return [{
        type: 17,
        accent_color: null,
        spoiler: false,
        components: [
            cabecera(`*Estimado/a ${nombre}*\n\nTras una cuidadosa revisión de tu carta de ingreso, nos complace informarte que tu registro ha sido **validado y aceptado** por el instituto.\n\nUn gran viaje de conocimiento y poder te espera entre nuestros muros. A partir de la apertura, serás oficialmente aprendiz de las artes arcanas. Que tus estudios sean fructíferos y tu lealtad a los principios que nos rigen sea tan brillante como tu propia magia. \n\n**¡Bienvenido/a a tu nuevo hogar!**`),
            separador(2),
            texto('**✧ Tus Herramientas Mágicas ** \n- -# Tu conexión con el instituto se activará con la apertura. Desde ese día podrás usar los comandos de rol `(/rol + comando)` y consultar tu perfil con `/rol perfil` en el canal de comandos.'),
            texto('**✧ Tu Identidad Institucional ** \n- -# Tu nombre ya figura en el registro de la Primera Promoción y llevas contigo su insignia. Tus credenciales de acceso a las dependencias, aulas y zonas comunes se activarán al abrir las puertas.'),
            texto(pasos),
            { type: 1, components: botones },
            separador(1),
            texto(`-# Esta carta se completará cuando las puertas se abran.\n${PIE}`)
        ]
    }];
}

module.exports = { cartaFinal, cartaPreApertura, GUILD_ID };
