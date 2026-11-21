// functions/Apertura/apertura.js
// Estado de la apertura del instituto: la fecha de la ceremonia (T0), el evento de
// Discord, y si la Campana ya sonó. Vive en Server_db.config, _id "apertura", y se
// edita desde el dashboard (Configuración del servidor → Apertura).
//
// La Campana marca el final de la ceremonia. Al sonar:
//   1. campanaSonada = true: a partir de aquí todas las cartas nuevas son la final.
//   2. Corre el trabajo de cartas (cartas.js): edita las cartas pre-apertura.
//   3. Avisa por MD a quien pidió «Avísame cuando abra».
// La suena un hook de diálogo (data/dialogos/funciones_evento/sonar_campana.js),
// pensado para el final del diálogo de la ceremonia, o el botón del dashboard.

const ID_DOC = 'apertura';
const TICK_MS = 60 * 1000;
const UNA_HORA = 60 * 60;
const RE_ID = /^\d{17,20}$/;

let dbClient = null;
let client = null;
let intervalo = null;

const estado = {
    timestamp: null,        // segundos UNIX de la ceremonia
    eventoId: null,         // evento programado de Discord
    campanaSonada: false,
    campanaEn: null,        // segundos UNIX en que sonó
    aviso1hEnviado: false,
    trabajo: null           // progreso del trabajo de cartas (cartas.js)
};

const ahora = () => Math.floor(Date.now() / 1000);
const coleccion = () => dbClient.db('Server_db').collection('config');
const recordatorios = () => dbClient.db('Server_db').collection('apertura_recordatorios');

function sanearConfig(entrada = {}) {
    const ts = Number(entrada.timestamp);
    const eventoId = String(entrada.eventoId ?? '').trim();
    return {
        timestamp: Number.isFinite(ts) && ts > 0 ? Math.floor(ts) : null,
        eventoId: RE_ID.test(eventoId) ? eventoId : null
    };
}

async function cargarDesdeDB(db) {
    dbClient = db || dbClient;
    if (!dbClient) return estado;
    try {
        const doc = await coleccion().findOne({ _id: ID_DOC });
        if (doc) {
            const { _id, ...resto } = doc;
            Object.assign(estado, resto);
        }
    } catch (err) {
        console.error('[Apertura] No se pudo cargar la configuración:', err.message);
    }
    return estado;
}

async function persistir(parcial) {
    Object.assign(estado, parcial);
    if (!dbClient) return;
    await coleccion().updateOne({ _id: ID_DOC }, { $set: parcial }, { upsert: true });
}

/** Fecha y evento desde el dashboard. Cambiar la fecha rearma el aviso de 1 hora. */
async function guardarConfig(entrada) {
    const limpio = sanearConfig(entrada);
    const parcial = { ...limpio };
    if (limpio.timestamp !== estado.timestamp) parcial.aviso1hEnviado = false;
    await persistir(parcial);
    return publico();
}

/** ¿Seguimos antes de la apertura? */
const preApertura = () => !estado.campanaSonada;

function publico() {
    return {
        timestamp: estado.timestamp,
        eventoId: estado.eventoId,
        campanaSonada: Boolean(estado.campanaSonada),
        campanaEn: estado.campanaEn || null,
        aviso1hEnviado: Boolean(estado.aviso1hEnviado),
        trabajo: estado.trabajo || null
    };
}

/**
 * Suena la Campana. Es idempotente: si ya sonó no hace nada (el trabajo de cartas
 * se reanuda solo al arrancar si quedó a medias).
 * @param {{ origen?: string }} [opciones]
 */
async function sonarCampana({ origen = 'desconocido' } = {}) {
    if (estado.campanaSonada) return { ok: false, yaSonada: true, estado: publico() };

    await persistir({ campanaSonada: true, campanaEn: ahora(), campanaOrigen: origen });
    console.log(`🔔 [Apertura] La Campana ha sonado (${origen}).`);

    // En segundo plano: el hook o el endpoint no esperan a cientos de MD.
    setImmediate(async () => {
        try {
            await require('./cartas').actualizarCartas(client);
        } catch (err) {
            console.error('[Apertura] Error en el trabajo de cartas:', err);
        }
        try {
            await avisarRecordatorios('apertura');
        } catch (err) {
            console.error('[Apertura] Error enviando avisos de apertura:', err);
        }
    });

    return { ok: true, estado: publico() };
}

/**
 * Vuelve a poner la Campana sin sonar. Solo para pruebas antes del lanzamiento:
 * no deshace las cartas ya editadas ni los avisos ya enviados.
 */
async function reiniciarCampana() {
    if (estado.trabajo?.estado === 'en_curso') return { ok: false, error: 'El trabajo de cartas sigue en curso.' };
    await persistir({ campanaSonada: false, campanaEn: null, trabajo: null, aviso1hEnviado: false });
    return { ok: true, estado: publico() };
}

/* ── Recordatorios «Avísame cuando abra» ── */

async function apuntarRecordatorio(userId, charId) {
    if (!dbClient || !userId) return { ok: false };
    const res = await recordatorios().updateOne(
        { _id: String(userId) },
        { $setOnInsert: { fecha: ahora(), aviso1h: false, avisoApertura: false }, $set: { charId: charId ?? null } },
        { upsert: true }
    );
    return { ok: true, nuevo: res.upsertedCount > 0 };
}

async function quitarRecordatorio(userId) {
    if (!dbClient || !userId) return;
    await recordatorios().deleteOne({ _id: String(userId) });
}

const tieneRecordatorio = async (userId) => Boolean(dbClient && await recordatorios().findOne({ _id: String(userId) }));

function mensajeRecordatorio(tipo) {
    const T0 = estado.timestamp;
    const enlace = estado.eventoId ? `\n-# [Ver el evento](https://discord.com/events/${require('./carta').GUILD_ID}/${estado.eventoId})` : '';
    if (tipo === '1h') {
        return `🔔 **Falta una hora para la ceremonia de apertura.**\nTe esperamos en el Auditorio del Instituto${T0 ? ` <t:${T0}:R>` : ''}.${enlace}`;
    }
    return '🔔 **¡Las puertas del instituto se han abierto!**\nTu carta de ingreso ya está completa. Empieza consultando tu perfil con `/rol perfil` en el canal de comandos.';
}

/** @param {'1h'|'apertura'} tipo */
async function avisarRecordatorios(tipo) {
    if (!dbClient || !client) return { enviados: 0 };
    const campo = tipo === '1h' ? 'aviso1h' : 'avisoApertura';
    const pendientes = await recordatorios().find({ [campo]: { $ne: true } }).toArray();
    const contenido = mensajeRecordatorio(tipo);
    const { enTandas } = require('./tandas');

    let enviados = 0;
    await enTandas(pendientes, async (r) => {
        try {
            const usuario = await client.users.fetch(r._id);
            await usuario.send({ content: contenido });
            enviados++;
        } catch (err) {
            if (err?.code !== 50007) console.warn(`[Apertura] Aviso ${tipo} a ${r._id} falló:`, err.message);
        }
        // Se marca aunque falle: un MD cerrado no se reintenta.
        await recordatorios().updateOne({ _id: r._id }, { $set: { [campo]: true } });
    });
    console.log(`🔔 [Apertura] Avisos «${tipo}» enviados: ${enviados}/${pendientes.length}.`);
    return { enviados, total: pendientes.length };
}

/* ── Programador ── */

async function tick() {
    try {
        const t = ahora();
        if (estado.timestamp && !estado.campanaSonada && !estado.aviso1hEnviado
            && t >= estado.timestamp - UNA_HORA && t < estado.timestamp
            && require('../../config/entorno').envioAutomatico('aviso de 1 hora de la apertura')) {
            await persistir({ aviso1hEnviado: true });
            await avisarRecordatorios('1h');
        }
    } catch (err) {
        console.error('[Apertura] Error en el aviso de 1 hora:', err);
    }

    try {
        await require('../dialogoServidor').revisarProgramados(client);
    } catch (err) {
        console.error('[Apertura] Error revisando diálogos programados:', err);
    }
}

/** Arranca el programador. Si el trabajo de cartas quedó a medias (reinicio), lo reanuda. */
function iniciar(clienteDiscord, db) {
    client = clienteDiscord;
    dbClient = db || dbClient;
    if (intervalo) clearInterval(intervalo);
    intervalo = setInterval(tick, TICK_MS);
    tick();

    if (estado.campanaSonada && estado.trabajo?.estado === 'en_curso'
        && require('../../config/entorno').envioAutomatico('reanudar las cartas de la apertura')) {
        console.log('🔔 [Apertura] Reanudando el trabajo de cartas que quedó a medias.');
        require('./cartas').actualizarCartas(client).catch(err => console.error('[Apertura] Error reanudando cartas:', err));
    }
}

module.exports = {
    get estado() { return estado; },
    cargarDesdeDB,
    guardarConfig,
    persistir,
    preApertura,
    publico,
    sonarCampana,
    reiniciarCampana,
    apuntarRecordatorio,
    quitarRecordatorio,
    tieneRecordatorio,
    avisarRecordatorios,
    iniciar,
    get client() { return client; },
    get dbClient() { return dbClient; }
};
