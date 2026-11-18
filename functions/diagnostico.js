// Diagnóstico del bot: una sola medición que usan el comando /ping y el panel de administración.
// Cada servicio se mide varias veces (no una) para distinguir "lento" de "inestable", con un tope de
// tiempo para que un servicio caído no deje colgado el diagnóstico.

const { monitorEventLoopDelay, performance } = require('perf_hooks');
const { Status, version: versionDiscordJs } = require('discord.js');
const cloudinary = require('cloudinary').v2;

const MUESTRAS = 3;
const TOPE_MS = 5000;
const ENFRIAMIENTO_MS = 4000; // el resultado se reutiliza unos segundos: evita martillar los servicios

// Umbrales en ms: hasta `bien` es normal, hasta `lento` es aceptable, más allá es crítico.
const UMBRALES = {
    gateway: { bien: 200, lento: 500 },
    api: { bien: 350, lento: 900 },
    mongo: { bien: 150, lento: 500 },
    cloudinary: { bien: 800, lento: 2000 },
    bucle: { bien: 30, lento: 120 },
};

const ESTADOS_GATEWAY = {
    [Status.Ready]: 'Conectado',
    [Status.Connecting]: 'Conectando',
    [Status.Reconnecting]: 'Reconectando',
    [Status.Idle]: 'En espera',
    [Status.Nearly]: 'Casi listo',
    [Status.Disconnected]: 'Desconectado',
    [Status.WaitingForGuilds]: 'Esperando servidores',
    [Status.Identifying]: 'Identificándose',
    [Status.Resuming]: 'Reanudando',
};

const PESO = { ok: 0, lento: 1, critico: 2, fallo: 3 };
const mb = (bytes) => Math.round(bytes / 1048576);

function clasificar(ms, umbral) {
    if (ms == null || Number.isNaN(ms)) return 'fallo';
    if (ms <= umbral.bien) return 'ok';
    if (ms <= umbral.lento) return 'lento';
    return 'critico';
}

function conTope(promesa, ms = TOPE_MS) {
    let temporizador;
    const tope = new Promise((_, rechazar) => {
        temporizador = setTimeout(() => rechazar(new Error(`sin respuesta en ${ms / 1000} s`)), ms);
    });
    return Promise.race([promesa, tope]).finally(() => clearTimeout(temporizador));
}

/**
 * Mide `fn` varias veces seguidas. La mediana descarta un pico aislado; la variación
 * (máximo − mínimo) indica si la conexión es inestable aunque la mediana sea buena.
 */
async function medir(fn, umbral, muestras = MUESTRAS) {
    const tiempos = [];
    let error = null;
    for (let i = 0; i < muestras; i++) {
        const inicio = performance.now();
        try {
            await conTope(fn());
            tiempos.push(performance.now() - inicio);
        } catch (err) {
            error = err?.message || String(err);
            break; // si falla una vez no tiene sentido insistir
        }
    }
    if (!tiempos.length) return { estado: 'fallo', ms: null, min: null, max: null, variacion: null, muestras: 0, error };

    const orden = [...tiempos].sort((a, b) => a - b);
    const mediana = orden[Math.floor(orden.length / 2)];
    return {
        estado: error ? 'critico' : clasificar(mediana, umbral),
        ms: Math.round(mediana),
        min: Math.round(orden[0]),
        max: Math.round(orden[orden.length - 1]),
        variacion: Math.round(orden[orden.length - 1] - orden[0]),
        muestras: tiempos.length,
        error,
    };
}

function medirGateway(client) {
    const codigo = client.ws.status;
    const ms = Math.round(client.ws.ping);
    const conectado = codigo === Status.Ready;
    // ws.ping vale -1 hasta que llega el primer latido (unos 40 s tras conectar)
    const sinLatido = !(ms >= 0);
    let estado;
    if (!conectado) estado = 'fallo';
    else if (sinLatido) estado = 'ok';
    else estado = clasificar(ms, UMBRALES.gateway);

    return {
        estado,
        ms: sinLatido ? null : ms,
        conexion: ESTADOS_GATEWAY[codigo] || `Estado ${codigo}`,
        sinLatido,
        conectadoDesde: client.readyTimestamp || null,
        error: conectado ? null : 'El bot no está conectado al gateway de Discord',
    };
}

function medirProceso(client) {
    const memoria = process.memoryUsage();
    const guilds = client.guilds.cache;
    let miembros = 0, miembrosEnCache = 0, mensajesEnCache = 0;
    for (const g of guilds.values()) {
        miembros += g.memberCount || 0;
        miembrosEnCache += g.members.cache.size;
    }
    for (const canal of client.channels.cache.values()) mensajesEnCache += canal.messages?.cache.size || 0;

    return {
        version: client.config?.version || null,
        node: process.version,
        discordjs: versionDiscordJs,
        plataforma: `${process.platform} ${process.arch}`,
        iniciadoEn: Date.now() - Math.round(process.uptime() * 1000),
        actividadSeg: Math.round(process.uptime()),
        memoria: { rssMB: mb(memoria.rss), heapMB: mb(memoria.heapUsed), heapTotalMB: mb(memoria.heapTotal), externaMB: mb(memoria.external) },
        servidores: guilds.size,
        miembros,
        cache: { miembros: miembrosEnCache, usuarios: client.users.cache.size, canales: client.channels.cache.size, mensajes: mensajesEnCache },
    };
}

let enCurso = null;
let ultimo = null;

async function ejecutar(client) {
    const clientdb = require('../Server'); // perezoso: Server.js también importa este módulo
    const inicio = performance.now();

    // El retraso del bucle de eventos se observa mientras corren las demás pruebas
    const bucle = monitorEventLoopDelay({ resolution: 10 });
    bucle.enable();

    const [api, mongo, nube] = await Promise.all([
        // /users/@me llega hasta los servidores de Discord (EE. UU.). /gateway no sirve para medir:
        // lo contesta la red de distribución desde el nodo más cercano y siempre da ~15 ms.
        medir(() => client.rest.get('/users/@me'), UMBRALES.api),
        medir(() => clientdb.db('admin').command({ ping: 1 }), UMBRALES.mongo),
        // Cloudinary cuenta sus llamadas de administración contra un límite por hora: una sola muestra
        medir(() => cloudinary.api.ping(), UMBRALES.cloudinary, 1),
    ]);

    bucle.disable();
    const retrasoMedio = Number.isFinite(bucle.mean) ? Math.max(0, bucle.mean / 1e6 - 10) : 0;
    const retrasoMax = Number.isFinite(bucle.max) ? Math.max(0, bucle.max / 1e6 - 10) : 0;

    const servicios = {
        gateway: { nombre: 'Gateway de Discord', ...medirGateway(client) },
        api: { nombre: 'API de Discord', ...api },
        mongo: { nombre: 'MongoDB', ...mongo },
        cloudinary: { nombre: 'Cloudinary', opcional: true, ...nube },
        bucle: {
            nombre: 'Bucle de eventos',
            estado: clasificar(retrasoMax, UMBRALES.bucle),
            ms: Math.round(retrasoMedio),
            max: Math.round(retrasoMax),
            error: null,
        },
    };

    // Veredicto: manda el peor servicio. Uno opcional caído (imágenes) degrada, pero no tumba al bot.
    let peor = 'ok';
    const avisos = [];
    for (const [clave, s] of Object.entries(servicios)) {
        const valor = clave === 'bucle' ? s.max : s.ms; // el mismo número con el que se clasificó
        let estado = s.estado;
        if (s.opcional && PESO[estado] > PESO.lento) estado = 'lento';
        if (PESO[estado] > PESO[peor]) peor = estado;
        if (s.estado === 'fallo') avisos.push(`${s.nombre}: ${s.error || 'sin respuesta'}`);
        else if (s.estado === 'critico') avisos.push(`${s.nombre}: muy lento (${valor} ms)`);
        else if (s.estado === 'lento') avisos.push(`${s.nombre}: lento (${valor} ms)`);
        if (s.variacion != null && s.variacion > Math.max(150, s.ms * 2)) avisos.push(`${s.nombre}: respuesta inestable (${s.min}–${s.max} ms)`);
    }
    if (!client.listo) {
        avisos.unshift('El bot todavía está arrancando');
        if (PESO[peor] < PESO.lento) peor = 'lento';
    }

    const estado = peor === 'ok' ? 'operativo' : peor === 'lento' ? 'degradado' : 'critico';
    return {
        estado,
        resumen: estado === 'operativo' ? 'Todo funciona con normalidad' : estado === 'degradado' ? 'Funciona, con avisos' : 'Hay servicios con problemas',
        avisos,
        listo: Boolean(client.listo),
        servicios,
        proceso: medirProceso(client),
        umbrales: UMBRALES,
        medidoEn: Date.now(),
        duracionMs: Math.round(performance.now() - inicio),
    };
}

/**
 * Devuelve el diagnóstico completo. Si ya hay una medición en curso se espera esa misma, y un
 * resultado de hace menos de ENFRIAMIENTO_MS se reutiliza (salvo `forzar`).
 * @param {import('discord.js').Client} client
 * @param {{ forzar?: boolean }} [opciones]
 */
function obtenerDiagnostico(client, { forzar = false } = {}) {
    if (enCurso) return enCurso;
    if (!forzar && ultimo && Date.now() - ultimo.medidoEn < ENFRIAMIENTO_MS) return Promise.resolve({ ...ultimo, reutilizado: true });

    enCurso = ejecutar(client)
        .then((resultado) => { ultimo = resultado; return resultado; })
        .finally(() => { enCurso = null; });
    return enCurso;
}

module.exports = { obtenerDiagnostico, clasificar, UMBRALES };
