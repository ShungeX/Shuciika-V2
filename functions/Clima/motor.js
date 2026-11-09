// ═══ CLIMA-HORARIO: motor (funciones puras) ═══
// Nada aquí toca la BD ni usa Math.random: el azar sale de azar.js, sembrado por
// (región, hora, propósito). Mismo estado de entrada = mismo resultado.

const { azar, enteroEntre, sorteoPonderado } = require("./azar");
const { infoHora, fechaDeHora } = require("./reloj");

const mult = (tabla, clave) => (tabla && tabla[clave] !== undefined ? tabla[clave] : 1);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const redondear2 = (v) => Math.round(v * 100) / 100;

/** ¿El override sigue vigente en el instante `ms`? */
function overrideVigente(override, ms) {
    return Boolean(override && override.estado && override.hasta && new Date(override.hasta).getTime() > ms);
}

/** Estado que ve el jugador: el del override vigente o el natural. */
function estadoVisible(clima, ms) {
    return overrideVigente(clima.override, ms) ? clima.override.estado : clima.estado;
}

// ─── Régimen ────────────────────────────────────────────────────────────────

function sortearRegimen(regionId, horaIndex, estacion, CONFIG) {
    const pesos = Object.entries(CONFIG.regimenPorEstacion[estacion]);
    return sorteoPonderado(pesos, azar(regionId, horaIndex, "regimen-sorteo")) || "variable";
}

function regimenDelDia(clima, horaIndex, dia, estacion, regionId, CONFIG) {
    const anterior = clima.regimen?.tipo;
    if (anterior && azar(regionId, horaIndex, "regimen-inercia") < CONFIG.inerciaRegimen) {
        return { dia, tipo: anterior };
    }
    return { dia, tipo: sortearRegimen(regionId, horaIndex, estacion, CONFIG) };
}

// ─── Duración ───────────────────────────────────────────────────────────────

function sortearDuracion(estado, regimenTipo, regionId, horaIndex, CONFIG) {
    const [min, max] = CONFIG.duracion[estado];
    let d = enteroEntre(azar(regionId, horaIndex, "dur"), min, max);
    if (estado === "Lluvioso" && regimenTipo === "lluvioso") {
        d = Math.round(d * CONFIG.duracionLluviaEnRegimenLluvioso);
    }
    return d;
}

// ─── Temperatura ────────────────────────────────────────────────────────────

function temperaturaObjetivo(estacion, estado, fase, CONFIG) {
    const t = CONFIG.temperatura;
    return t.base[estacion] + (t.modEstado[estado] || 0) + (t.modFase[fase] || 0);
}

/** Valor guardado (decimal, sin jitter). */
function avanzarTemperatura(Tprev, objetivo, CONFIG) {
    const t = CONFIG.temperatura;
    const base = typeof Tprev === "number" && Number.isFinite(Tprev) ? Tprev : objetivo;
    return redondear2(clamp(base + t.suavizado * (objetivo - base), t.min, t.max));
}

/** Valor mostrado: entero, con jitter determinista ∈ {-1, 0, +1} que NUNCA se guarda. */
function temperaturaMostrada(T, regionId, horaIndex, CONFIG) {
    const jitter = Math.floor(azar(regionId, horaIndex, "temp") * 3) - 1;
    return clamp(Math.round(T + jitter), CONFIG.temperatura.min, CONFIG.temperatura.max);
}

// ─── Transiciones ───────────────────────────────────────────────────────────

/** Pesos de cada destino posible desde `clima.estado` en esa hora (expuesto para tests/diagnóstico). */
function pesosDestino(clima, info, regimenTipo, CONFIG) {
    const desde = CONFIG.transiciones[clima.estado];
    if (!desde) throw new Error(`[Clima] Estado sin transiciones: ${clima.estado}`);
    return Object.entries(desde).map(([destino, base]) => {
        const producto = mult(CONFIG.porEstacion[info.estacion], destino)
            * mult(CONFIG.porRegimen[regimenTipo], destino)
            * mult(CONFIG.porFase[info.fase], destino);
        let peso = base * clamp(producto, 0, CONFIG.multiplicadorMax)
            * (destino === clima.previo ? CONFIG.histeresisRetorno : 1);
        if (destino === "Niebla" && !CONFIG.nieblaInicioEn.includes(info.fase)) peso = 0;
        return [destino, peso];
    });
}

function finForzado(estado, info, CONFIG) {
    if (estado === "Nevada" && info.estacion !== "invierno") return true;
    if (estado === "Niebla" && !CONFIG.nieblaPermitidaEn.includes(info.fase)) return true;
    return false;
}

/**
 * Avanza el clima UNA hora interna (a `horaIndex`, que debe ser clima.horaIndex + 1).
 * @param {object} clima estado guardado (no se modifica)
 * @param {number} horaIndex hora que se calcula
 * @param {string} regionId
 * @param {object} CONFIG configuración de la región
 * @param {object} reloj { epoch, cicloMin, horaBase } (necesario para la estación)
 * @param {object} [opciones] { ignorarOverride: false } — la recuperación de horas pasadas lo pone en true
 * @returns {object} clima nuevo
 */
function siguienteHora(clima, horaIndex, regionId, CONFIG, reloj, opciones = {}) {
    const info = infoHora(reloj, horaIndex);
    const nuevo = {
        ...clima,
        regimen: { ...clima.regimen },
        cambiosDia: { ...clima.cambiosDia },
        horaIndex
    };

    // 1. Régimen del día
    if (clima.regimen?.dia !== info.dia) {
        nuevo.regimen = regimenDelDia(clima, horaIndex, info.dia, info.estacion, regionId, CONFIG);
        nuevo.cambiosDia = { dia: info.dia, n: 0 };
    } else if (nuevo.cambiosDia?.dia !== info.dia) {
        nuevo.cambiosDia = { dia: info.dia, n: 0 };
    }

    // 2. Fin forzado
    const forzado = finForzado(clima.estado, info, CONFIG);
    const cumplida = horaIndex - clima.desdeHora >= clima.duracionObjetivo;

    let cambia = true;
    if (!forzado) {
        // 4. Duración mínima
        if (!cumplida) cambia = false;
        // 5. Tope de cambios por día: mantener y extender un poco
        else if (nuevo.cambiosDia.n >= CONFIG.maxCambiosPorDia) {
            cambia = false;
            nuevo.duracionObjetivo = horaIndex - clima.desdeHora + 1;
        }
    }
    // 3. Con fin forzado se sortea ignorando duración y tope

    if (cambia) {
        // 6. Sorteo y cambio
        const pesos = pesosDestino(clima, info, nuevo.regimen.tipo, CONFIG);
        let destino = sorteoPonderado(pesos, azar(regionId, horaIndex, "trans"));
        if (!destino) destino = pesos[0][0];
        if (!CONFIG.transiciones[clima.estado]?.[destino]) {
            throw new Error(`[Clima] Transición inexistente ${clima.estado}>${destino}`);
        }
        nuevo.previo = clima.estado;
        nuevo.estado = destino;
        nuevo.desdeHora = horaIndex;
        nuevo.duracionObjetivo = sortearDuracion(destino, nuevo.regimen.tipo, regionId, horaIndex, CONFIG);
        nuevo.cambiosDia = { dia: info.dia, n: nuevo.cambiosDia.n + 1 };
    }

    // Temperatura suavizada con el estado visible de esa hora
    const ms = info.fecha.getTime();
    const visible = !opciones.ignorarOverride && overrideVigente(clima.override, ms) ? clima.override.estado : nuevo.estado;
    nuevo.temperatura = avanzarTemperatura(clima.temperatura, temperaturaObjetivo(info.estacion, visible, info.fase, CONFIG), CONFIG);

    return nuevo;
}

/** Clima recién creado (o reiniciado tras una brecha > 72 h) en la hora `horaIndex`. */
function climaInicial(horaIndex, regionId, CONFIG, reloj, estado = CONFIG.estadoInicial || "Nublado") {
    const info = infoHora(reloj, horaIndex);
    const regimenTipo = sortearRegimen(regionId, horaIndex, info.estacion, CONFIG);
    return {
        horaIndex,
        estado,
        previo: null,
        desdeHora: horaIndex,
        duracionObjetivo: sortearDuracion(estado, regimenTipo, regionId, horaIndex, CONFIG),
        regimen: { dia: info.dia, tipo: regimenTipo },
        cambiosDia: { dia: info.dia, n: 0 },
        temperatura: temperaturaObjetivo(info.estacion, estado, info.fase, CONFIG),
        override: null
    };
}

/**
 * Simula desde clima.horaIndex + 1 hasta `hasta` (inclusive).
 * @returns {{ clima: object, cambios: Array<{estado, desdeHora}>, reiniciado: boolean }}
 */
function simularHasta(clima, hasta, regionId, CONFIG, reloj, opciones = {}) {
    const brecha = hasta - clima.horaIndex;
    if (brecha <= 0) return { clima, cambios: [], reiniciado: false };

    if (brecha > (CONFIG.brechaMaxRecuperacion ?? 72)) {
        const nuevo = { ...climaInicial(hasta, regionId, CONFIG, reloj), override: clima.override ?? null };
        const cambios = nuevo.estado !== clima.estado ? [{ estado: nuevo.estado, desdeHora: hasta }] : [];
        return { clima: nuevo, cambios, reiniciado: true };
    }

    let actual = clima;
    const cambios = [];
    for (let h = clima.horaIndex + 1; h <= hasta; h++) {
        const ignorar = opciones.ignorarOverrideAntesDe !== undefined && h < opciones.ignorarOverrideAntesDe;
        const sig = siguienteHora(actual, h, regionId, CONFIG, reloj, { ignorarOverride: ignorar });
        if (sig.estado !== actual.estado) cambios.push({ estado: sig.estado, desdeHora: h });
        actual = sig;
    }
    return { clima: actual, cambios, reiniciado: false };
}

module.exports = {
    siguienteHora, climaInicial, simularHasta, pesosDestino, finForzado,
    temperaturaObjetivo, avanzarTemperatura, temperaturaMostrada,
    overrideVigente, estadoVisible, fechaDeHora
};
