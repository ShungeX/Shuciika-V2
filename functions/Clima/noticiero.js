// ═══ CLIMA-HORARIO: noticiero ═══
// Un solo mensaje por región (noticiero.mensajeId). Se edita:
//   - al llegar "cambioHora", "cambioFase" o "cambioClima" → frase e imagen nuevas;
//   - y, mientras está publicado, cada CONFIG.noticieroRefrescoMin minutos reales → solo
//     hora y temperatura; la frase, la imagen y el aviso se mantienen durante esa hora.
// Si el mensaje se borró, se envía uno nuevo y se guarda su id; el sistema nunca se detiene por eso.

const { MessageFlags } = require("discord.js");
const estadoRegion = require("./estadoRegion");
const { configDe } = require("./config");
const { getTexto } = require("./textos");
const { obtenerImagen } = require("./imagenes");

const EVENTOS_QUE_EDITAN = ["cambioHora", "cambioFase", "cambioClima"];
// Unknown Message / mensaje de otro autor / el mensaje no admite el cambio (p. ej. embed antiguo → V2)
const CODIGOS_MENSAJE_PERDIDO = new Set([10008, 50005, 50035]);

let client = null;
let suscrito = false;
const pendientes = new Map();   // regionId → { previo }  (agrupa los eventos de un mismo tick)
const colas = new Map();        // regionId → Promise (serializa envíos por región)
const refrescos = new Map();    // regionId → timeout del refresco periódico
const ultimoContenido = new Map(); // regionId → { horaIndex, estado, fase, texto, imagen }

const ESTACION = {
    primavera: { emoji: "🌸", nombre: "Primavera" },
    verano: { emoji: "☀️", nombre: "Verano" },
    otoño: { emoji: "🍂", nombre: "Otoño" },
    invierno: { emoji: "❄️", nombre: "Invierno" }
};
const pad = (n) => String(n).padStart(2, "0");

function configurar(discordClient) {
    client = discordClient;
    if (suscrito) return;
    suscrito = true;
    for (const evento of EVENTOS_QUE_EDITAN) {
        estadoRegion.eventos.on(evento, (p) => programar(p.regionId, evento === "cambioClima" ? { previo: p.anterior } : {}));
    }
}

/** Junta todos los eventos emitidos en el mismo tick en UNA sola edición. */
function programar(regionId, { previo } = {}) {
    let p = pendientes.get(regionId);
    if (!p) {
        p = { previo: undefined };
        pendientes.set(regionId, p);
        setImmediate(() => {
            pendientes.delete(regionId);
            actualizarNoticiero(regionId, { previo: p.previo })
                .catch((err) => console.error(`[Clima] Error actualizando el noticiero de ${regionId}:`, err));
        });
    }
    if (previo !== undefined && p.previo === undefined) p.previo = previo;
}

function enCola(regionId, tarea) {
    const anterior = colas.get(regionId) || Promise.resolve();
    const siguiente = anterior.catch(() => {}).then(tarea);
    colas.set(regionId, siguiente.catch(() => {}));
    return siguiente;
}

// ─── Refresco periódico ─────────────────────────────────────────────────────

const msRefresco = (regionId) => Math.max(1, configDe(regionId).noticieroRefrescoMin || 5) * 60000;

function detenerRefresco(regionId) {
    clearTimeout(refrescos.get(regionId));
    refrescos.delete(regionId);
}

/** (Re)arma el refresco: se cuenta desde la última edición, así nunca se edita dos veces seguidas. */
function armarRefresco(regionId) {
    detenerRefresco(regionId);
    refrescos.set(regionId, setTimeout(() => {
        refrescos.delete(regionId);
        actualizarNoticiero(regionId, { renovar: false })
            .catch((err) => console.error(`[Clima] Error en el refresco del noticiero de ${regionId}:`, err));
    }, msRefresco(regionId)));
}

/** Mensaje del noticiero en Components V2 (contenedor con miniatura fija y la imagen del clima abajo). */
async function construirMensaje(regionId, { previo = null, renovar = true } = {}) {
    const CONFIG = configDe(regionId);
    const est = await estadoRegion.getEstado(regionId);

    // En el refresco periódico se reusa lo de esta hora; si cambió algo, contenido nuevo
    const anterior = ultimoContenido.get(regionId);
    const mismo = anterior && anterior.horaIndex === est.horaIndex && anterior.estado === est.estado && anterior.fase === est.fase;
    let texto, imagen;
    if (!renovar && mismo) {
        ({ texto, imagen } = anterior);
    } else {
        texto = getTexto(est.estado, est.fase, previo, { regionId });
        imagen = await obtenerImagen(est.carpeta, est.estado, est.fase, CONFIG);
        ultimoContenido.set(regionId, { horaIndex: est.horaIndex, estado: est.estado, fase: est.fase, texto, imagen });
    }
    const refrescoMin = Math.round(msRefresco(regionId) / 60000);
    const nombre = est.nombre || CONFIG.nombre;
    const estacion = ESTACION[est.estacion] || { emoji: "📅", nombre: est.estacion };

    let cuerpo = `${texto.titulo}\n\n-# ${texto.frase}`;
    if (texto.aviso) cuerpo += `\n> ⚠️ ${texto.aviso}`;

    const separador = { type: 14, divider: true, spacing: 1 };
    const contenedor = {
        type: 17,
        accent_color: parseInt(texto.color.slice(1), 16),
        spoiler: false,
        components: [
            {
                type: 9,
                accessory: { type: 11, media: { url: CONFIG.noticieroMiniatura }, description: null, spoiler: false },
                components: [
                    { type: 10, content: `### Clima actual en ${nombre}` },
                    { type: 10, content: cuerpo }
                ]
            },
            separador,
            {
                type: 10,
                content: `-# \`⌚\` Hora: ${pad(est.horaDelDia)}:${pad(est.minuto)}     \`🗓️\` Día: ${est.dia}      \`🌤️\` Tiempo: ${est.estado}\n\n`
                    + `-# \`${estacion.emoji}\` Estación: ${estacion.nombre}    \`🌡️\` Temperatura: ${est.temperatura}°C`
            },
            separador,
            { type: 12, items: [{ media: { url: imagen || CONFIG.imagenPorDefecto }, description: null, spoiler: false }] },
            {
                type: 10,
                content: `-# Puedes visualizar el horario en tiempo real desde el dashboard.\n-# El menú se actualiza cada ${refrescoMin} minutos`
            }
        ]
    };
    return { components: [contenedor], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

async function obtenerCanal(canalId) {
    if (!client) throw Object.assign(new Error("Bot no disponible aún"), { status: 503 });
    const canal = await client.channels.fetch(canalId).catch(() => null);
    if (!canal || !canal.isTextBased?.() || typeof canal.send !== "function") {
        throw Object.assign(new Error("No encuentro ese canal de texto o no tengo acceso."), { status: 404 });
    }
    return canal;
}

const urlMensaje = (canal, mensajeId) => (canal.guildId ? `https://discord.com/channels/${canal.guildId}/${canal.id}/${mensajeId}` : null);

/**
 * Edita el mensaje del noticiero (o envía uno nuevo si no existe / se borró) y re-arma el
 * refresco periódico mientras el noticiero siga activo (también si falló: así reintenta).
 * @param {object} [opciones] { previo, forzarNuevo, renovar } — renovar = false reusa frase e imagen de esta hora
 * @returns {Promise<null|{canalId, mensajeId, url, nuevo: boolean}>} null si el noticiero está detenido
 */
function actualizarNoticiero(regionId, opciones = {}) {
    return enCola(regionId, async () => {
        try {
            return await publicar(regionId, opciones);
        } finally {
            const info = await estadoRegion.getNoticiero(regionId).catch(() => ({}));
            if (info.canalId && client) armarRefresco(regionId);
            else detenerRefresco(regionId);
        }
    });
}

async function publicar(regionId, { previo = null, forzarNuevo = false, renovar = true } = {}) {
    const info = await estadoRegion.getNoticiero(regionId);
    if (!info.canalId || !client) return null;

    let canal;
    try {
        canal = await obtenerCanal(info.canalId);
    } catch (err) {
        console.warn(`[Clima] Noticiero de ${regionId}: ${err.message} (${info.canalId}). Se reintentará en ${Math.round(msRefresco(regionId) / 60000)} min.`);
        return null;
    }

    const payload = await construirMensaje(regionId, { previo, renovar });

    let reemplazar = null;   // mensaje viejo que no se pudo editar (p. ej. embed antiguo): se borra tras enviar el nuevo
    if (info.mensajeId && !forzarNuevo) {
        try {
            await canal.messages.edit(info.mensajeId, payload);
            return { canalId: canal.id, mensajeId: info.mensajeId, url: urlMensaje(canal, info.mensajeId), nuevo: false };
        } catch (err) {
            if (!CODIGOS_MENSAJE_PERDIDO.has(err?.code)) {
                console.error(`[Clima] No se pudo editar el noticiero de ${regionId}:`, err?.message || err);
                return null;   // p. ej. rate limit o caída: no se duplica el mensaje
            }
            if (err.code === 50035) reemplazar = info.mensajeId;
            console.warn(`[Clima] El mensaje del noticiero de ${regionId} no se puede editar (${err.code}); envío uno nuevo.`);
        }
    }

    const msg = await canal.send(payload);
    await estadoRegion.guardarNoticiero(regionId, { canalId: canal.id, mensajeId: msg.id });
    if (reemplazar) await canal.messages.delete(reemplazar).catch(() => {});
    return { canalId: canal.id, mensajeId: msg.id, url: urlMensaje(canal, msg.id), nuevo: true };
}

/** Activa el noticiero en un canal y publica el mensaje. */
async function iniciarNoticiero(regionId, canalId) {
    if (!/^\d{15,22}$/.test(String(canalId || ""))) throw Object.assign(new Error("ID de canal no válido."), { status: 400 });
    await obtenerCanal(String(canalId));   // valida antes de guardar
    const actual = await estadoRegion.getNoticiero(regionId);
    const mismoCanal = actual.canalId === String(canalId);
    await estadoRegion.guardarNoticiero(regionId, { canalId: String(canalId), mensajeId: mismoCanal ? actual.mensajeId : null });
    return actualizarNoticiero(regionId, { forzarNuevo: !mismoCanal || !actual.mensajeId });
}

/** Deja de editar el mensaje (el último queda publicado tal cual). */
async function detenerNoticiero(regionId) {
    detenerRefresco(regionId);
    await estadoRegion.guardarNoticiero(regionId, { canalId: null, mensajeId: null });
}

/** Publica un mensaje nuevo en el mismo canal y borra el anterior (si se puede). */
async function reenviarNoticiero(regionId) {
    const actual = await estadoRegion.getNoticiero(regionId);
    if (!actual.canalId) throw Object.assign(new Error("El noticiero está detenido."), { status: 409 });
    const r = await actualizarNoticiero(regionId, { forzarNuevo: true });
    if (r && actual.mensajeId && actual.mensajeId !== r.mensajeId) {
        const canal = await obtenerCanal(actual.canalId).catch(() => null);
        await canal?.messages.delete(actual.mensajeId).catch(() => {});
    }
    return r;
}

module.exports = {
    configurar, construirMensaje, actualizarNoticiero,
    iniciarNoticiero, detenerNoticiero, reenviarNoticiero,
    detenerRefresco
};
