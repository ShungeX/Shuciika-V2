// functions/dialogoServidor.js
// Diálogos de servidor: guiones que se publican en canales del servidor, no en el
// MD de un jugador. Sirven para eventos como la ceremonia de apertura.
//
// Se diferencian de los de MD en `modo: 'servidor'` y en el bloque `servidor`:
//   servidor: {
//     canalId,                                  canal por defecto
//     remitente: { tipo, nombre, avatar, webhookId },
//     programado: { fecha (ms), lanzado }       arranque automático opcional
//   }
// Cada nodo Mensaje puede cambiar el canal y el remitente con `paso.destino`:
//   destino: { canalId?, remitente? }  (lo que no ponga lo hereda del evento)
//
// Remitentes:
//   bot            el bot envía el mensaje (texto, embeds) como siempre
//   webhook_bot    el webhook interno del bot en ese canal, con el nombre y la
//                  foto que quieras por mensaje (para hablar como un personaje)
//   webhook_canal  un webhook que ya existe en el servidor (o guardado por URL)
//
// Avanzan solos: cada mensaje espera su «Pause / Delay» antes del siguiente. No
// hay botones de jugador (solo enlaces); Condición, Variable y Fin funcionan igual
// que en MD, con las variables del sistema ($fecha, $apertura_abierta...). El
// hook del nodo Fin se ejecuta al terminar (p. ej. sonar_campana).

const { pasosDeDialogo, esPasoDeControl } = require('./dialogoGrafo');

const MAX_PASOS = 500;
const MAX_ESPERA_MS = 6 * 60 * 60 * 1000;     // una pausa no puede pasar de 6 h
const RETRASO_MAX_PROGRAMADO = 6 * 60 * 60 * 1000; // si el bot estuvo caído, hasta 6 h tarde aún arranca

/** dialogoId → { inicio, paso, total, enviados, cancelado, origen, error } */
const ejecuciones = new Map();

const dialogoManager = () => require('./dialogoManager');

function esServidor(doc) {
    return doc?.modo === 'servidor';
}

/* ── Envío ──
 * Los webhooks usan la misma maquinaria que los mensajes del servidor
 * (functions/mensajesWebhooks.js): el webhook interno del bot por canal, los
 * webhooks que ya existen en el servidor o los guardados por URL.
 */

const GUILD_ID = '716342375303217285';
const FLAG_COMPONENTS_V2 = 1 << 15;
const wh = () => require('./mensajesWebhooks');
const dbServer = () => require('../Server').db('Server_db');

function remitenteEfectivo(doc, paso) {
    const base = doc?.servidor?.remitente || { tipo: 'bot' };
    const propio = paso?.destino?.remitente;
    return propio && propio.tipo ? propio : base;
}

/** Quita lo que no puede ir en un canal: botones y selects que esperan a un jugador. */
function soloEnlaces(paso) {
    const lista = Array.isArray(paso.components) ? paso.components : (Array.isArray(paso.buttons) ? paso.buttons : []);
    const copia = { ...paso, components: lista.filter(c => c && c.url) };
    delete copia.buttons;
    return copia;
}

/** Opciones de discord.js → cuerpo JSON de la API de webhooks. */
function aPayload(opciones) {
    const json = (x) => (typeof x?.toJSON === 'function' ? x.toJSON() : x);
    const payload = {};
    if (typeof opciones.content === 'string') payload.content = opciones.content;
    if (Array.isArray(opciones.embeds)) payload.embeds = opciones.embeds.map(json);
    if (Array.isArray(opciones.components)) payload.components = opciones.components.map(json);
    if ((opciones.flags || []).includes('IsComponentsV2')) payload.flags = FLAG_COMPONENTS_V2;
    return payload;
}

async function credencialesDe(client, remitente, canal) {
    const threadId = canal.isThread?.() ? canal.id : undefined;
    if (remitente.tipo === 'webhook_bot') return { ...(await wh().webhookDelBot(client, canal)), threadId };
    const cred = await wh().credencialesWebhook(client, GUILD_ID, dbServer(), remitente.webhookId);
    const base = threadId ? canal.parentId : canal.id;
    if (cred.canalId !== base) throw new Error(`Ese webhook solo publica en otro canal (${cred.canalId}).`);
    return { ...cred, threadId };
}

/**
 * Envía (o edita/borra) un mensaje y devuelve la referencia para poder editarlo luego.
 * @returns {Promise<{ canalId, mensajeId, cred?, threadId? }>}
 */
async function publicar(client, doc, paso, opciones, guardado) {
    // Editar o borrar un mensaje guardado antes (acción edit/delete con «target»)
    if (guardado) {
        if (guardado.cred) {
            if (opciones.__borrar) await wh().borrarMensajeWebhook(guardado.cred, guardado.mensajeId, guardado.threadId);
            else await wh().editarMensajeWebhook(guardado.cred, guardado.mensajeId, { payload: aPayload(opciones), threadId: guardado.threadId });
        } else {
            const canal = await client.channels.fetch(guardado.canalId);
            if (opciones.__borrar) await canal.messages.delete(guardado.mensajeId);
            else await canal.messages.edit(guardado.mensajeId, opciones);
        }
        return guardado;
    }

    const canalId = paso?.destino?.canalId || doc?.servidor?.canalId;
    if (!canalId) throw new Error('El mensaje no tiene canal (ni el nodo ni el evento lo indican).');
    const canal = await client.channels.fetch(canalId);
    if (!canal) throw new Error(`No encuentro el canal ${canalId}.`);

    const remitente = remitenteEfectivo(doc, paso);
    if (remitente.tipo === 'webhook_bot' || remitente.tipo === 'webhook_canal') {
        const cred = await credencialesDe(client, remitente, canal);
        const payload = aPayload(opciones);
        if (remitente.nombre) payload.username = String(remitente.nombre).slice(0, 80);
        else if (remitente.tipo === 'webhook_bot') payload.username = client.user.username;
        if (remitente.avatar) payload.avatar_url = remitente.avatar;
        else if (remitente.tipo === 'webhook_bot') payload.avatar_url = client.user.displayAvatarURL();
        const msg = await wh().ejecutarWebhook(cred, { payload, threadId: cred.threadId });
        return { canalId: canal.id, mensajeId: msg.id, cred, threadId: cred.threadId };
    }

    const msg = await canal.send(opciones);
    return { canalId: canal.id, mensajeId: msg.id };
}

/* ── Ejecución ── */

function esperar(ms, estado) {
    const fin = Date.now() + Math.min(Math.max(0, ms), MAX_ESPERA_MS);
    return new Promise(resolve => {
        const tick = () => {
            if (estado.cancelado || Date.now() >= fin) return resolve();
            setTimeout(tick, Math.min(1000, fin - Date.now()));
        };
        tick();
    });
}

async function correr(client, doc, estado) {
    const dm = dialogoManager();
    const pasos = pasosDeDialogo(doc);
    estado.total = pasos.length;

    // Igual que un userData de MD, pero sin jugador
    const datos = { context: {}, savedMessages: {}, messageIds: [], charDoc: null };
    const contexto = () => ({ ...datos.context, ...dm.sistemaDe(null) });
    let i = 0;
    let finHook;

    for (let n = 0; n < MAX_PASOS && !estado.cancelado; n++) {
        let paso = pasos[i];
        if (!paso) break;
        estado.paso = i;

        if (esPasoDeControl(paso)) {
            if (paso.control === 'variable') {
                const { aplicarSetVar } = require('../interaction/dialogoAcciones');
                for (const sv of paso.setVars || []) aplicarSetVar(datos, doc, sv);
                i = Number(paso.nextStep);
            } else if (paso.control === 'condicion') {
                const { evaluarCondicion } = require('./dialogoCondiciones');
                i = Number(evaluarCondicion(paso.condicion, contexto(), doc.variables) ? paso.siStep : paso.noStep);
            } else {
                finHook = paso.onComplete || null;
                i = pasos.length;
            }
            continue;
        }

        const { resolverVariante, pasoConVariante } = require('./dialogoCondiciones');
        paso = pasoConVariante(paso, resolverVariante(paso.variantes, contexto(), doc.variables));

        try {
            const opciones = await dm.buildMessageOptions(soloEnlaces(paso), datos, null, null);
            if (opciones.flags) opciones.flags = opciones.flags.filter(f => f === 'IsComponentsV2');

            const accion = paso.action?.type || paso.type || 'send';
            const objetivo = paso.action?.target ? datos.savedMessages[paso.action.target] : null;

            if ((accion === 'edit' || accion === 'delete') && objetivo) {
                if (accion === 'delete') opciones.__borrar = true;
                await publicar(client, doc, paso, opciones, objetivo);
                if (accion === 'delete') delete datos.savedMessages[paso.action.target];
            } else if (accion !== 'delete') {
                const ref = await publicar(client, doc, paso, opciones, null);
                if (paso.action?.guardar) datos.savedMessages[paso.action.guardar] = ref;
                estado.enviados++;
            }
        } catch (err) {
            // Un mensaje que falla no para la ceremonia: se registra y se sigue
            estado.errores.push(`Paso ${i}: ${err.message}`.slice(0, 200));
            console.error(`[dialogoServidor] '${doc._id}' paso ${i}:`, err.message);
        }

        await esperar(Number(paso.delay) || 0, estado);
        i = paso.nextStep !== undefined && paso.nextStep !== null && paso.nextStep !== '' ? Number(paso.nextStep) : i + 1;
    }

    if (estado.cancelado) return;

    const hook = finHook !== undefined ? finHook : doc.onComplete;
    if (hook) await dm.executeActions(hook, null, datos.context, null, {});
}

/**
 * Lanza un diálogo de servidor. No espera a que termine.
 * @param {{ origen?: string }} [opciones]
 */
function lanzar(client, dialogoId, { origen = 'dashboard' } = {}) {
    const doc = dialogoManager().obtenerDialogoPorId(null, dialogoId);
    if (!doc) return { ok: false, error: 'Diálogo no encontrado.' };
    if (!esServidor(doc)) return { ok: false, error: 'Este diálogo es de MD: solo se lanzan los de servidor.' };
    if (!client?.user) return { ok: false, error: 'El bot no está conectado.' };
    if (ejecuciones.has(String(doc._id))) return { ok: false, error: 'Ya se está ejecutando.' };

    const estado = { inicio: Date.now(), paso: 0, total: 0, enviados: 0, cancelado: false, origen, errores: [] };
    ejecuciones.set(String(doc._id), estado);
    console.log(`📢 [dialogoServidor] Lanzando '${doc._id}' (${origen}).`);

    correr(client, doc, estado)
        .catch(err => {
            estado.errores.push(err.message);
            console.error(`[dialogoServidor] '${doc._id}' se detuvo:`, err);
        })
        .finally(() => {
            ejecuciones.delete(String(doc._id));
            console.log(`📢 [dialogoServidor] '${doc._id}' terminó: ${estado.enviados} mensaje(s)${estado.cancelado ? ', detenido' : ''}${estado.errores.length ? `, ${estado.errores.length} error(es)` : ''}.`);
            ultimos.set(String(doc._id), { ...estado, fin: Date.now() });
        });

    return { ok: true };
}

/** Último resultado de cada diálogo (para el dashboard) */
const ultimos = new Map();

function detener(dialogoId) {
    const estado = ejecuciones.get(String(dialogoId));
    if (!estado) return { ok: false, error: 'No se está ejecutando.' };
    estado.cancelado = true;
    return { ok: true };
}

function estadoDe(dialogoId) {
    const id = String(dialogoId);
    const vivo = ejecuciones.get(id);
    if (vivo) return { enCurso: true, ...vivo };
    const ultimo = ultimos.get(id);
    return ultimo ? { enCurso: false, ...ultimo } : { enCurso: false };
}

/** Lo llama el programador de la apertura cada minuto. */
async function revisarProgramados(client) {
    if (!client?.user) return;
    // En Navi ni se lanzan ni se marcan como lanzados: así no le "roba" el diálogo a Shuciika
    if (!require('../config/entorno').envioAutomatico('diálogos programados')) return;
    const dm = dialogoManager();
    const ahora = Date.now();

    for (const doc of dm.dbDialogues.values()) {
        const prog = doc?.servidor?.programado;
        if (!esServidor(doc) || doc.estado !== 'publicado' || !prog?.fecha || prog.lanzado) continue;
        if (Number(prog.fecha) > ahora) continue;

        const tarde = ahora - Number(prog.fecha) > RETRASO_MAX_PROGRAMADO;
        prog.lanzado = true;
        prog.lanzadoEn = ahora;
        if (tarde) prog.vencido = true;

        try {
            const clientdb = require('../Server');
            await clientdb.db('Rol_db').collection('Dialogos').updateOne(
                { _id: doc._id },
                { $set: { 'servidor.programado.lanzado': true, 'servidor.programado.lanzadoEn': ahora, ...(tarde ? { 'servidor.programado.vencido': true } : {}) } }
            );
        } catch (err) {
            console.error('[dialogoServidor] No se pudo marcar como lanzado:', err.message);
        }

        if (tarde) {
            console.warn(`[dialogoServidor] '${doc._id}' estaba programado hace más de 6 h (el bot no estaba): no se lanza.`);
            continue;
        }
        lanzar(client, doc._id, { origen: 'programado' });
    }
}

module.exports = { lanzar, detener, estadoDe, revisarProgramados, esServidor };
