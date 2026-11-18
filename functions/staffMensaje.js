// ═══ MENSAJE DE ADMINISTRADORES ═══
// Publica en un canal la lista del staff guardada en Server_db.config (_id: "staff").
// Se lanza desde el dashboard (Panel Admin → Configuración del servidor).
// El mensaje publicado se recuerda en el mismo documento (campo `mensaje`), así que
// volver a enviarlo al mismo canal edita ese mensaje en lugar de crear otro.
//
// Plantillas:
//   'imagenes' → "Miembros del staff": banner fijo + una sección con miniatura por puesto.
//                Las miniaturas se pueden cambiar desde el dashboard (campo `mensajeImagenes`).
//   'simple'   → lista de texto con emoji y frase de cada persona.

const crypto = require('crypto');
const wh = require('./mensajesWebhooks');

const CATEGORIAS = [
    { clave: 'Director', titulo: 'Director', icono: '👑' },
    { clave: 'Subdirector', titulo: 'Subdirector', icono: '🎓' },
    { clave: 'Administradores', titulo: 'Administradores', icono: '🛡️' },
    { clave: 'Vigilantes', titulo: 'Vigilantes', icono: '👁️' },
    { clave: 'Ayudantes', titulo: 'Ayudantes', icono: '🤝' },
];

const PLANTILLAS = ['imagenes', 'simple'];

// Banner de la plantilla con imágenes: no se puede cambiar desde el dashboard
const BANNER_STAFF = 'https://res.cloudinary.com/dn1cubayf/image/upload/v1794940946/staffSHCSS_yajue5.png';

// Miniaturas por sección (la de "director" acompaña a Director y Subdirector)
const IMAGENES_DEFECTO = {
    director: 'https://i.pinimg.com/1200x/2b/22/24/2b2224777cd894b6a501393445e64895.jpg',
    administradores: 'https://i.pinimg.com/736x/31/c3/56/31c3565ce8c55b3404dca98f9a266e16.jpg',
    vigilantes: 'https://i.pinimg.com/736x/b8/b7/ae/b8b7ae547e8440927a0cf8c5deb1c2b0.jpg',
    ayudantes: 'https://i.pinimg.com/736x/45/38/4e/45384e1b516867c4baf3f25e9e914add.jpg',
};

// Discord limita el texto visible de un mensaje con componentes V2
const LIMITE_TEXTO = 4000;

function errorConEstado(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function miembrosDe(staff, clave) {
    return (Array.isArray(staff?.[clave]) ? staff[clave] : [])
        .filter(u => u && /^\d{15,25}$/.test(String(u.id)));
}

// El principal de cada puesto va primero
function ordenarPorPrincipal(miembros) {
    return [...miembros].sort((a, b) => Number(Boolean(b.principal)) - Number(Boolean(a.principal)));
}

function comprobarLongitud(textos) {
    const total = textos.join('\n').length;
    if (total > LIMITE_TEXTO) {
        throw errorConEstado(400, `El mensaje es demasiado largo para Discord (${total}/${LIMITE_TEXTO} caracteres). Acorta los textos del staff.`);
    }
}

function comprobarStaffNoVacio(staff) {
    if (!CATEGORIAS.some(c => miembrosDe(staff, c.clave).length)) {
        throw errorConEstado(400, 'El staff está vacío: añade al menos a una persona antes de enviar el mensaje.');
    }
}

/** Devuelve solo enlaces http(s) válidos; lo que falte se completa con las imágenes por defecto. */
function normalizarImagenes(imagenes) {
    const out = { ...IMAGENES_DEFECTO };
    for (const clave of Object.keys(IMAGENES_DEFECTO)) {
        const valor = String(imagenes?.[clave] || '').trim();
        if (!valor) continue;
        let url;
        try { url = new URL(valor); } catch { url = null; }
        if (!url || !['http:', 'https:'].includes(url.protocol) || valor.length > 1500) {
            throw errorConEstado(400, `El enlace de la imagen de "${clave}" no es válido (debe empezar por https://).`);
        }
        out[clave] = valor;
    }
    return out;
}

// ─── Plantilla simple ───────────────────────────────────────────────────────

function lineaSimple(u) {
    const partes = [];
    if (u.emoji) partes.push(String(u.emoji).trim());
    partes.push(`<@${u.id}>`);
    if (u.principal) partes.push('⭐');
    let linea = partes.join(' ');
    const texto = String(u.text || '').trim();
    if (texto) linea += ` — *${texto}*`;
    return linea;
}

function componentesSimple(staff) {
    const bloques = [];
    for (const cat of CATEGORIAS) {
        const miembros = miembrosDe(staff, cat.clave);
        if (!miembros.length) continue;
        bloques.push(`### ${cat.icono} ${cat.titulo}\n${ordenarPorPrincipal(miembros).map(lineaSimple).join('\n')}`);
    }

    const cabecera = '## Equipo de administración\n-# Si necesitas ayuda, escribe a cualquiera de estas personas.';
    const pie = `-# Actualizado <t:${Math.floor(Date.now() / 1000)}:R>`;
    comprobarLongitud([cabecera, ...bloques, pie]);

    const hijos = [{ type: 10, content: cabecera }];
    for (const bloque of bloques) {
        hijos.push({ type: 14, divider: true, spacing: 1 });
        hijos.push({ type: 10, content: bloque });
    }
    hijos.push({ type: 14, divider: true, spacing: 1 });
    hijos.push({ type: 10, content: pie });

    return [{ type: 17, accent_color: 0xF4D286, components: hijos }];
}

// ─── Plantilla "Miembros del staff" (con imágenes) ─────────────────────────
// Formato de cada puesto:
//   con gente  → "ʚ Título" + menciones. Con varias personas va en lista:
//                "- <@id>" para el principal y "- -# <@id>" para el resto.
//                Con una sola persona va sin viñeta ("-# " delante si no es principal).
//   sin nadie  → "-# ʚ Título\n-# Cargo sin asignar"

function lineasMiembros(miembros) {
    const ordenados = ordenarPorPrincipal(miembros);
    if (ordenados.length === 1) {
        const u = ordenados[0];
        return `${u.principal ? '' : '-# '}<@${u.id}>`;
    }
    return ordenados.map(u => `${u.principal ? '- ' : '- -# '}<@${u.id}>`).join('\n');
}

function bloquePuesto(titulo, miembros) {
    if (!miembros.length) return { titulo: `-# ʚ ${titulo}`, cuerpo: '-# Cargo sin asignar', vacio: true };
    return { titulo: `ʚ ${titulo}`, cuerpo: lineasMiembros(miembros), vacio: false };
}

function seccion(textos, urlMiniatura) {
    return {
        type: 9,
        components: textos.map(content => ({ type: 10, content })),
        accessory: { type: 11, media: { url: urlMiniatura } },
    };
}

function componentesImagenes(staff, imagenesGuardadas) {
    const imagenes = normalizarImagenes(imagenesGuardadas);

    const cabecera = '# 𐔌 . ⋮ Miembros del staff .ᐟ ֹ ₊ ꒱\n꒱ Personitas que se encargan de mantener el orden y ayudar en el servidor. (≧◡≦) ♡';

    // Director y Subdirector comparten sección (y miniatura)
    const director = bloquePuesto('Director / Owner', miembrosDe(staff, 'Director'));
    const subdirector = bloquePuesto('Subdirector/a', miembrosDe(staff, 'Subdirector'));
    const textosDirector = [director.titulo, `${director.cuerpo} \n\n${subdirector.titulo}\n${subdirector.cuerpo}`];

    // El resto: con gente → título y lista en dos textos; vacío → un solo texto atenuado
    const textosDe = (titulo, clave) => {
        const b = bloquePuesto(titulo, miembrosDe(staff, clave));
        return b.vacio ? [`${b.titulo}\n${b.cuerpo}`] : [b.titulo, b.cuerpo];
    };
    const textosAdmins = textosDe('Administradores', 'Administradores');
    const textosVigilantes = textosDe('Vigilantes', 'Vigilantes');
    const textosAyudantes = textosDe('Ayudantes', 'Ayudantes');

    comprobarLongitud([cabecera, ...textosDirector, ...textosAdmins, ...textosVigilantes, ...textosAyudantes]);

    const separador = () => ({ type: 14, divider: true, spacing: 1 });
    return [{
        type: 17,
        components: [
            { type: 12, items: [{ media: { url: BANNER_STAFF } }] },
            { type: 10, content: cabecera },
            separador(),
            seccion(textosDirector, imagenes.director),
            separador(),
            seccion(textosAdmins, imagenes.administradores),
            separador(),
            seccion(textosVigilantes, imagenes.vigilantes),
            separador(),
            seccion(textosAyudantes, imagenes.ayudantes),
        ],
    }];
}

/**
 * Arma los componentes V2 del mensaje. Lanza 400 si no hay nadie en el staff
 * o si algún enlace de imagen no es válido.
 */
function construirComponentes(staff, { plantilla = 'imagenes', imagenes = null } = {}) {
    comprobarStaffNoVacio(staff);
    return plantilla === 'simple' ? componentesSimple(staff) : componentesImagenes(staff, imagenes);
}

// ─── Canal y remitente ──────────────────────────────────────────────────────
// Quién publica, igual que en «Mensajes del servidor» (functions/mensajesServidor.js):
//   'bot'       → el bot.
//   'propio'    → el webhook interno del bot en el canal, con el nombre y la foto elegidos
//                 (los perfiles guardados de Mensajes del servidor rellenan esos dos campos).
//   'existente' → un webhook que ya hay en el servidor o que se añadió por URL; nombre y
//                 foto opcionales (vacíos = los del webhook).
// Discord fija el nombre y la foto al enviar: si el remitente cambia, el mensaje anterior
// del mismo canal se borra y se envía uno nuevo.

async function resolverCanal(client, guildId, canalId) {
    if (!client) throw errorConEstado(503, 'Bot no disponible aún.');
    canalId = String(canalId || '').trim();
    if (!/^\d{17,20}$/.test(canalId)) throw errorConEstado(400, 'El ID del canal no es válido.');

    const canal = await client.channels.fetch(canalId).catch(() => null);
    if (!canal || canal.guildId !== guildId) {
        throw errorConEstado(404, 'No encontré ese canal en el servidor (o el bot no puede verlo).');
    }
    if (!canal.isTextBased() || typeof canal.send !== 'function') {
        throw errorConEstado(400, 'Ese canal no admite mensajes de texto (¿es un foro o una categoría?).');
    }
    const esHilo = typeof canal.isThread === 'function' && canal.isThread();
    return { canal, canalId, threadId: esHilo ? canal.id : undefined, canalBaseId: esHilo ? canal.parentId : canal.id };
}

function normalizarRemitente(valor) {
    const r = valor && typeof valor === 'object' ? valor : {};
    const modo = ['propio', 'existente'].includes(r.modo) ? r.modo : 'bot';
    if (modo === 'bot') return { modo, webhookId: null, nombre: '', avatar: null };

    const webhookId = String(r.webhookId || '').trim();
    const nombre = String(r.nombre || '').trim().slice(0, 80);
    const avatar = String(r.avatar || '').trim().slice(0, 500);
    if (modo === 'existente' && !/^\d{17,20}$/.test(webhookId)) throw errorConEstado(400, 'Elige qué webhook del servidor publica el mensaje.');
    if (modo === 'propio' && !nombre) throw errorConEstado(400, 'El webhook del bot necesita un nombre (o elige un perfil guardado).');
    if (/discord|clyde/i.test(nombre)) throw errorConEstado(400, 'Discord no permite «discord» ni «clyde» en el nombre de un webhook.');
    if (avatar && !/^https?:\/\/\S+$/i.test(avatar)) throw errorConEstado(400, 'La foto del webhook debe ser una URL que empiece por http(s)://.');
    return { modo, webhookId: modo === 'existente' ? webhookId : null, nombre, avatar: avatar || null };
}

/** Firma de quién publica: si cambia, el mensaje no se puede editar y hay que reenviarlo. */
function firmaRemitente(r) {
    if (r.modo === 'bot') return 'bot';
    const clave = `${r.modo}\n${r.webhookId || ''}\n${r.nombre}\n${r.avatar || ''}`;
    return 'webhook:' + crypto.createHash('sha1').update(clave).digest('hex').slice(0, 16);
}

/** Credenciales del webhook que publica, comprobando que escriba en ese canal. */
async function credencialesRemitente(client, guildId, dbServer, r, destino) {
    if (r.modo === 'propio') return wh.webhookDelBot(client, destino.canal);
    const cred = await wh.credencialesWebhook(client, guildId, dbServer, r.webhookId);
    if (cred.canalId !== destino.canalBaseId) {
        const suCanal = await client.channels.fetch(cred.canalId).catch(() => null);
        throw errorConEstado(400, `Ese webhook solo publica en #${suCanal?.name || cred.canalId} (o en sus hilos). Cambia el canal.`);
    }
    return cred;
}

/** Borra el mensaje anterior (con su webhook si lo mandó uno; si no, como mensaje del bot). */
async function borrarMensajeAnterior({ client, guildId, dbServer, destino, previo }) {
    try {
        if (previo.webhookId) {
            const propio = await wh.webhookDelBot(client, destino.canal).catch(() => null);
            const cred = propio?.id === previo.webhookId ? propio : await wh.credencialesWebhook(client, guildId, dbServer, previo.webhookId);
            await wh.borrarMensajeWebhook(cred, previo.messageId, destino.threadId);
            return;
        }
        const m = await destino.canal.messages.fetch(previo.messageId).catch(() => null);
        if (m && m.author?.id === client.user.id) await m.delete();
    } catch (err) {
        console.warn('[StaffMensaje] No se pudo borrar el mensaje anterior:', err.message);
    }
}

/**
 * Envía o actualiza el mensaje de administradores en `canalId`.
 * `imagenes` (opcional) reemplaza las miniaturas guardadas; se guarda junto con la plantilla usada.
 * `remitente`: { modo: 'bot' | 'propio' | 'existente', webhookId?, nombre?, avatar? }.
 * @returns {{ editado: boolean, reenviado: boolean, mensaje: object, imagenes: object }}
 */
async function publicarMensajeStaff({ client, dbClient, guildId, canalId, plantilla, imagenes, remitente }) {
    plantilla = PLANTILLAS.includes(plantilla) ? plantilla : 'imagenes';
    const r = normalizarRemitente(remitente);
    const firma = firmaRemitente(r);

    const dbServer = dbClient.db('Server_db');
    const configColl = dbServer.collection('config');
    const staffDoc = await configColl.findOne({ _id: 'staff' });
    const imagenesFinales = normalizarImagenes(imagenes || staffDoc?.mensajeImagenes);
    const components = construirComponentes(staffDoc || {}, { plantilla, imagenes: imagenesFinales });

    const destino = await resolverCanal(client, guildId, canalId);
    canalId = destino.canalId;
    const cred = r.modo === 'bot' ? null : await credencialesRemitente(client, guildId, dbServer, r, destino);

    const rechazado = (err) => {
        if (err?.status) throw err;
        console.error('[StaffMensaje] Discord rechazó el mensaje:', err);
        throw errorConEstado(502, 'Discord rechazó el mensaje (revisa que el bot pueda escribir en ese canal y que los enlaces de las imágenes funcionen).');
    };
    const sinMenciones = { parse: [] };

    // Firmas de registros anteriores a los remitentes: los del bot no traían firma
    const previo = staffDoc?.mensaje;
    const firmaPrevia = previo?.firma || (previo && previo.modo !== 'webhook' ? 'bot' : null);
    const mismoCanal = Boolean(previo?.messageId && previo.channelId === canalId);
    const editable = mismoCanal && firmaPrevia === firma && (r.modo === 'bot' || previo.webhookId === cred.id);

    let mensaje = null;
    let editado = false;
    if (editable) {
        if (r.modo === 'bot') {
            const existente = await destino.canal.messages.fetch(previo.messageId).catch(() => null);
            if (existente && existente.author?.id === client.user.id && !existente.webhookId) {
                mensaje = await existente.edit({ components, flags: ['IsComponentsV2'], allowedMentions: sinMenciones }).catch(rechazado);
                editado = true;
            }
        } else {
            try {
                mensaje = await wh.editarMensajeWebhook(cred, previo.messageId, {
                    payload: { components, allowed_mentions: sinMenciones },
                    threadId: destino.threadId,
                });
                editado = true;
            } catch (err) {
                // 404 = el mensaje ya no existe → se envía uno nuevo
                if (err?.status !== 404) rechazado(err);
            }
        }
    }

    let reenviado = false;
    if (!mensaje) {
        mensaje = r.modo === 'bot'
            ? await destino.canal.send({ components, flags: ['IsComponentsV2'], allowedMentions: sinMenciones }).catch(rechazado)
            : await wh.ejecutarWebhook(cred, {
                payload: {
                    components,
                    flags: 1 << 15,
                    allowed_mentions: sinMenciones,
                    ...(r.nombre ? { username: r.nombre } : {}),
                    ...(r.avatar ? { avatar_url: r.avatar } : {}),
                },
                threadId: destino.threadId,
            }).catch(rechazado);
        // Otro remitente en el mismo canal: el anterior sobra
        if (mismoCanal && !editable) {
            await borrarMensajeAnterior({ client, guildId, dbServer, destino, previo });
            reenviado = true;
        }
    }

    const registro = {
        channelId: canalId,
        messageId: mensaje.id,
        actualizado: new Date(),
        plantilla,
        remitente: r,
        firma,
        webhookId: cred?.id || null,
    };
    await configColl.updateOne(
        { _id: 'staff' },
        { $set: { mensaje: registro, mensajeImagenes: imagenesFinales } },
        { upsert: true }
    );
    return { editado, reenviado, mensaje: registro, imagenes: imagenesFinales };
}

module.exports = {
    publicarMensajeStaff,
    construirComponentes,
    IMAGENES_DEFECTO,
    BANNER_STAFF,
};
