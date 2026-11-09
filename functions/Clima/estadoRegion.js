// ═══ CLIMA-HORARIO: persistencia, caché, override, ticks y eventos ═══
// Colección Rol_db.RegionStatus (un documento por región, _id = código). El documento
// TOB-001 ya existe con el status del instituto (nucleoCentral, veloMagico…): aquí solo
// se leen/escriben reloj, clima, noticiero, historial y nombre; lo demás no se toca.
//
// Caché en memoria: reloj y clima se cargan al arrancar y solo se refrescan al cambiar
// de hora interna (o al usar el dashboard). Los comandos no consultan Mongo.

const { EventEmitter } = require("events");
const { configDe, REGIONES, ESTADOS } = require("./config");
const { horaIndexEn, fechaDeHora, infoHora, minutoEn, msPorHora } = require("./reloj");
const {
    climaInicial, simularHasta, siguienteHora, overrideVigente, estadoVisible, temperaturaMostrada
} = require("./motor");

const eventos = new EventEmitter();
eventos.setMaxListeners(30);

const CAMPOS_CLIMA = ["horaIndex", "estado", "previo", "desdeHora", "duracionObjetivo", "regimen", "cambiosDia", "temperatura", "actualizadoEn"];
const EVENTOS = [
    ["cambioHora", "horaIndex"],
    ["cambioDia", "dia"],
    ["cambioFase", "fase"],
    ["cambioEstacion", "estacion"],
    ["cambioClima", "estado"]
];

let coleccion = null;
let ahora = () => Date.now();
const cache = new Map();      // regionId → entrada
const cargando = new Map();   // regionId → Promise
let ticksActivos = false;

// ─── Inyección (tests y scripts) ────────────────────────────────────────────

function col() {
    if (!coleccion) {
        const clientdb = require("../../Server");
        coleccion = clientdb.db("Rol_db").collection("RegionStatus");
    }
    return coleccion;
}
function usarColeccion(c) { coleccion = c; }
function usarAhora(fn) { ahora = fn || (() => Date.now()); }
function limpiarCache() {
    for (const e of cache.values()) clearTimeout(e.timer);
    cache.clear();
    cargando.clear();
}

// ─── Carga ──────────────────────────────────────────────────────────────────

function documentoNuevo(regionId, ms) {
    const CONFIG = configDe(regionId);
    const reloj = { epoch: new Date(ms), cicloMin: CONFIG.reloj.cicloMin, horaBase: CONFIG.reloj.horaBase || 0 };
    const h = horaIndexEn(reloj, ms);
    const clima = { ...climaInicial(h, regionId, CONFIG, reloj), actualizadoEn: new Date(ms) };
    return {
        nombre: CONFIG.nombre,
        reloj,
        clima,
        noticiero: { canalId: null, mensajeId: null },
        historial: [{ estado: clima.estado, desdeHora: h }]
    };
}

/** Crea el documento (upsert) o rellena solo los campos del módulo que falten. */
async function asegurarDocumento(regionId) {
    const ms = ahora();
    const base = documentoNuevo(regionId, ms);

    await col().updateOne({ _id: regionId }, { $setOnInsert: base }, { upsert: true });
    let doc = await col().findOne({ _id: regionId });

    // Documento previo sin estos campos (p. ej. TOB-001 con el status del instituto)
    let relleno = false;
    for (const campo of ["nombre", "reloj", "clima", "noticiero", "historial"]) {
        if (doc[campo] !== undefined && doc[campo] !== null) continue;
        let valor = base[campo];
        if (campo === "clima" && doc.reloj) {
            // Reloj ya existente: el clima inicial va en SU hora actual
            const h = horaIndexEn(doc.reloj, ms);
            valor = { ...climaInicial(h, regionId, configDe(regionId), doc.reloj), actualizadoEn: new Date(ms) };
        }
        await col().updateOne({ _id: regionId, [campo]: { $exists: false } }, { $set: { [campo]: valor } });
        relleno = true;
    }
    if (relleno) doc = await col().findOne({ _id: regionId });
    return doc;
}

function aplicarDoc(e, doc) {
    if (!doc) return;
    e.reloj = doc.reloj;
    e.clima = doc.clima;
    e.noticiero = doc.noticiero || { canalId: null, mensajeId: null };
    e.historial = doc.historial || [];
    e.nombre = doc.nombre || e.CONFIG.nombre;
}

async function cargar(regionId) {
    if (cache.has(regionId)) return cache.get(regionId);
    if (cargando.has(regionId)) return cargando.get(regionId);
    const p = (async () => {
        const CONFIG = configDe(regionId);
        const doc = await asegurarDocumento(regionId);
        const e = { regionId, CONFIG, timer: null, snapshot: null };
        aplicarDoc(e, doc);
        e.snapshot = snapshot(e, ahora());   // punto de partida para comparar eventos
        cache.set(regionId, e);
        return e;
    })();
    cargando.set(regionId, p);
    try { return await p; } finally { cargando.delete(regionId); }
}

// ─── Actualización con persistencia ─────────────────────────────────────────

/**
 * Lleva el clima hasta la hora actual (recupera horas perdidas), vence overrides y
 * guarda con un findOneAndUpdate optimista. Emite los eventos que correspondan.
 */
async function actualizar(regionId, { emitir = true } = {}) {
    const e = await cargar(regionId);
    const ms = ahora();
    const actual = horaIndexEn(e.reloj, ms);
    const leido = e.clima.horaIndex;
    const expira = Boolean(e.clima.override) && !overrideVigente(e.clima.override, ms);

    if (actual > leido || expira) {
        let nuevo = e.clima;
        let cambios = [];
        if (actual > leido) {
            // Horas pasadas sin override; la hora actual sí lo usa (temperatura)
            const r = simularHasta(e.clima, actual, regionId, e.CONFIG, e.reloj, { ignorarOverrideAntesDe: actual });
            nuevo = r.clima;
            cambios = r.cambios;
            if (r.reiniciado) console.warn(`[Clima] ${regionId}: brecha de ${actual - leido} h internas; clima reiniciado desde ${nuevo.estado}.`);
        }

        const $set = {};
        for (const k of CAMPOS_CLIMA) $set[`clima.${k}`] = k === "actualizadoEn" ? new Date(ms) : nuevo[k];
        const filtro = { _id: regionId, "clima.horaIndex": leido };
        if (expira) {
            $set["clima.override"] = null;
            filtro["clima.override.hasta"] = e.clima.override.hasta;  // no borrar un override recién puesto
        }
        const update = { $set };
        if (cambios.length) update.$push = { historial: { $each: cambios, $slice: -24 } };

        const doc = await col().findOneAndUpdate(filtro, update, { returnDocument: "after" });
        // null = otro proceso ya actualizó: releer y quedarse con eso
        aplicarDoc(e, doc || await col().findOne({ _id: regionId }));
    }

    if (emitir) emitirCambios(e, ms);
    return e;
}

// ─── Eventos ────────────────────────────────────────────────────────────────

function snapshot(e, ms) {
    const info = infoHora(e.reloj, e.clima.horaIndex);
    return {
        horaIndex: info.horaIndex,
        dia: info.dia,
        fase: info.fase,
        estacion: info.estacion,
        estado: estadoVisible(e.clima, ms),
        estadoNatural: e.clima.estado
    };
}

/** Compara contra lo último emitido y emite un solo evento por tipo (aunque se hayan recuperado varias horas). */
function emitirCambios(e, ms = ahora()) {
    const nuevo = snapshot(e, ms);
    const anterior = e.snapshot;
    e.snapshot = nuevo;
    if (!anterior) return [];
    const emitidos = [];
    for (const [evento, campo] of EVENTOS) {
        if (anterior[campo] === nuevo[campo]) continue;
        emitidos.push(evento);
        try {
            eventos.emit(evento, { regionId: e.regionId, anterior: anterior[campo], nuevo: nuevo[campo], estado: nuevo });
        } catch (err) {
            console.error(`[Clima] Error en un suscriptor de ${evento}:`, err);
        }
    }
    return emitidos;
}

// ─── Tick (setTimeout re-armado; sin intervalos fijos) ──────────────────────

function armarTimer(e) {
    clearTimeout(e.timer);
    if (!ticksActivos) return;
    const ms = ahora();
    const h = horaIndexEn(e.reloj, ms);
    // proximo = epoch + (horaIndex + 1 - horaBase) × msPorHora
    let proximo = fechaDeHora(e.reloj, h + 1).getTime();
    if (overrideVigente(e.clima.override, ms)) proximo = Math.min(proximo, new Date(e.clima.override.hasta).getTime());
    const delay = Math.max(1000, proximo - ms + 50);
    e.timer = setTimeout(async () => {
        try {
            await actualizar(e.regionId);
        } catch (err) {
            console.error(`[Clima] Error en el tick de ${e.regionId}:`, err);
        } finally {
            armarTimer(e);   // se recalcula desde el reloj: sin deriva y la cadena no muere
        }
    }, delay);
}

/** Recupera horas perdidas y arma los ticks de todas las regiones. */
async function iniciarTicks() {
    ticksActivos = true;
    for (const regionId of Object.keys(REGIONES)) {
        try {
            const e = await cargar(regionId);
            await actualizar(regionId);   // recuperación ANTES del primer timer
            armarTimer(e);
            const est = await getEstado(regionId);
            console.log(`[Clima] ${regionId} activo: día ${est.dia} ${pad(est.horaDelDia)}:${pad(est.minuto)} · ${est.estado} · ${est.temperatura}°C · ${est.estacion}`);
        } catch (err) {
            console.error(`[Clima] No se pudo iniciar ${regionId}:`, err);
        }
    }
}

function detenerTicks() {
    ticksActivos = false;
    for (const e of cache.values()) clearTimeout(e.timer);
}

// ─── API pública ────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");

function overridePublico(override, ms) {
    if (!overrideVigente(override, ms)) return null;
    return { estado: override.estado, hasta: new Date(override.hasta), motivo: override.motivo || null, autor: override.autor || null };
}

/**
 * Estado actual (desde caché). Si el timer llegó tarde, se pone al día primero.
 * @returns {Promise<{horaIndex, dia, horaDelDia, minuto, fase, estacion, estado, estadoNatural, regimen, temperatura, override?}>}
 */
async function getEstado(regionId) {
    let e = await cargar(regionId);
    const ms = ahora();
    if (horaIndexEn(e.reloj, ms) > e.clima.horaIndex) e = await actualizar(regionId);
    const info = infoHora(e.reloj, e.clima.horaIndex);
    const estado = {
        regionId,
        nombre: e.nombre,
        horaIndex: info.horaIndex,
        dia: info.dia,
        horaDelDia: info.horaDelDia,
        minuto: minutoEn(e.reloj, ms),
        fase: info.fase,
        carpeta: info.carpeta,
        estacion: info.estacion,
        estado: estadoVisible(e.clima, ms),
        estadoNatural: e.clima.estado,
        previo: e.clima.previo,
        desdeHora: e.clima.desdeHora,
        duracionObjetivo: e.clima.duracionObjetivo,
        regimen: e.clima.regimen?.tipo,
        temperatura: temperaturaMostrada(e.clima.temperatura, regionId, info.horaIndex, e.CONFIG)
    };
    const ov = overridePublico(e.clima.override, ms);
    if (ov) estado.override = ov;
    return estado;
}

/**
 * Pronóstico: simula hacia adelante desde el estado guardado (no escribe en BD).
 * Determinista: coincide con lo que ocurrirá. Usa el override antes de override.hasta.
 */
async function getPronostico(regionId, nHoras = 24) {
    const e = await cargar(regionId);
    const n = Math.max(0, Math.min(24 * 14, Math.floor(nHoras)));
    const lista = [];
    let c = e.clima;
    for (let i = 1; i <= n; i++) {
        const h = e.clima.horaIndex + i;
        c = siguienteHora(c, h, regionId, e.CONFIG, e.reloj);
        const info = infoHora(e.reloj, h);
        const ms = info.fecha.getTime();
        lista.push({
            horaIndex: h,
            dia: info.dia,
            horaDelDia: info.horaDelDia,
            fase: info.fase,
            estacion: info.estacion,
            estado: overrideVigente(c.override, ms) ? c.override.estado : c.estado,
            estadoNatural: c.estado,
            temperatura: temperaturaMostrada(c.temperatura, regionId, h, e.CONFIG),
            inicio: info.fecha
        });
    }
    return lista;
}

/**
 * Override del GM: el estado visible pasa a `estado` hasta `hasta` (o durante `horas` internas).
 * La simulación natural sigue por debajo sin alterarse.
 */
async function ponerOverride(regionId, { estado, horas, hasta, motivo, autor } = {}) {
    if (!ESTADOS.includes(estado)) throw Object.assign(new Error(`Estado no válido: ${estado}`), { status: 400 });
    const e = await actualizar(regionId, { emitir: false });
    const ms = ahora();
    let fin;
    if (horas !== undefined && horas !== null && horas !== "") {
        const n = Math.floor(Number(horas));
        if (!Number.isFinite(n) || n < 1 || n > 24 * 14) throw Object.assign(new Error("Las horas deben estar entre 1 y 336."), { status: 400 });
        fin = fechaDeHora(e.reloj, horaIndexEn(e.reloj, ms) + n);   // alineado al inicio de una hora interna
    } else {
        fin = new Date(hasta);
    }
    if (isNaN(fin) || fin.getTime() <= ms) throw Object.assign(new Error("El override debe terminar en el futuro."), { status: 400 });

    const override = { estado, hasta: fin, motivo: motivo ? String(motivo).slice(0, 200) : null, autor: autor || null, desde: new Date(ms) };
    await col().updateOne({ _id: regionId }, { $set: { "clima.override": override } });
    e.clima = { ...e.clima, override };
    emitirCambios(e, ms);
    armarTimer(e);
    return overridePublico(override, ms);
}

async function quitarOverride(regionId) {
    const e = await actualizar(regionId, { emitir: false });
    await col().updateOne({ _id: regionId }, { $set: { "clima.override": null } });
    e.clima = { ...e.clima, override: null };
    emitirCambios(e, ahora());
    armarTimer(e);
}

/** Corrección del GM: reinicia el clima natural en la hora actual (estado elegido o el inicial). */
async function reiniciarClima(regionId, estado) {
    if (estado && !ESTADOS.includes(estado)) throw Object.assign(new Error(`Estado no válido: ${estado}`), { status: 400 });
    const e = await actualizar(regionId, { emitir: false });
    const ms = ahora();
    const h = horaIndexEn(e.reloj, ms);
    const nuevo = { ...climaInicial(h, regionId, e.CONFIG, e.reloj, estado || undefined), override: e.clima.override ?? null };
    nuevo.previo = e.clima.estado !== nuevo.estado ? e.clima.estado : e.clima.previo;
    nuevo.temperatura = e.clima.temperatura ?? nuevo.temperatura;   // la temperatura sigue suavizándose
    const $set = {};
    for (const k of [...CAMPOS_CLIMA, "previo"]) $set[`clima.${k}`] = k === "actualizadoEn" ? new Date(ms) : nuevo[k];
    const doc = await col().findOneAndUpdate(
        { _id: regionId, "clima.horaIndex": e.clima.horaIndex },
        { $set, $push: { historial: { $each: [{ estado: nuevo.estado, desdeHora: h }], $slice: -24 } } },
        { returnDocument: "after" }
    );
    aplicarDoc(e, doc || await col().findOne({ _id: regionId }));
    emitirCambios(e, ms);
    return getEstado(regionId);
}

/** Adelanta el reloj hasta la próxima `horaDelDia` indicada (nunca hacia atrás: las horas saltadas se simulan). */
async function adelantarReloj(regionId, horaDelDiaObjetivo) {
    const objetivo = Math.floor(Number(horaDelDiaObjetivo));
    if (!Number.isInteger(objetivo) || objetivo < 0 || objetivo > 23) throw Object.assign(new Error("La hora debe estar entre 0 y 23."), { status: 400 });
    const e = await actualizar(regionId, { emitir: false });
    const actual = infoHora(e.reloj, horaIndexEn(e.reloj, ahora())).horaDelDia;
    const delta = (objetivo - actual + 24) % 24;
    if (delta === 0) return { delta: 0, estado: await getEstado(regionId) };
    await col().updateOne({ _id: regionId }, { $inc: { "reloj.horaBase": delta } });
    e.reloj = { ...e.reloj, horaBase: (e.reloj.horaBase || 0) + delta };
    await actualizar(regionId);
    armarTimer(e);
    return { delta, estado: await getEstado(regionId) };
}

// ─── Noticiero (datos guardados) ────────────────────────────────────────────

async function getNoticiero(regionId) {
    const e = await cargar(regionId);
    return { ...e.noticiero };
}

async function guardarNoticiero(regionId, { canalId, mensajeId }) {
    const e = await cargar(regionId);
    const noticiero = { canalId: canalId ?? null, mensajeId: mensajeId ?? null };
    await col().updateOne({ _id: regionId }, { $set: { noticiero } });
    e.noticiero = noticiero;
    return noticiero;
}

/** Todo lo que el dashboard necesita de una región. */
async function infoAdmin(regionId, nPronostico = 24) {
    const e = await cargar(regionId);
    const estado = await getEstado(regionId);
    const ms = ahora();
    return {
        estado,
        pronostico: await getPronostico(regionId, nPronostico),
        historial: [...(e.historial || [])].reverse(),
        noticiero: { ...e.noticiero },
        reloj: {
            epoch: e.reloj.epoch,
            cicloMin: e.reloj.cicloMin,
            horaBase: e.reloj.horaBase || 0,
            minutosRealesPorHora: msPorHora(e.reloj) / 60000,
            proximaHora: fechaDeHora(e.reloj, horaIndexEn(e.reloj, ms) + 1)
        },
        clima: { ...e.clima, override: overridePublico(e.clima.override, ms) },
        ticksActivos
    };
}

module.exports = {
    eventos, ESTADOS,
    cargar, actualizar, getEstado, getPronostico,
    ponerOverride, quitarOverride, reiniciarClima, adelantarReloj,
    getNoticiero, guardarNoticiero, infoAdmin,
    iniciarTicks, detenerTicks, emitirCambios,
    usarColeccion, usarAhora, limpiarCache
};
