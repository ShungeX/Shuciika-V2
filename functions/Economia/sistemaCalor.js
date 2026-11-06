const utilidadesTexto = require("../../utils/utilidadesTexto.js")
const clientdb = require("../../Server.js")


const MAX_CALOR = 300
const GANANCIA_DIARIA = 10;

const DECAY_POR_DIA = [3, 7, 10]
const DECAY_PLATEAU = 12;


const ETAPAS = [
    {
        min: 0,
        max: 29,
        nombre: null,
        etiqueta: '— Sin calentar',
        multiplicador: 1.00,
    },
    {
        min: 30,
        max: 69,
        nombre: 'Latente',
        etiqueta: '✦ Latente',
        multiplicador: 1.05,
    },
    {
        min: 70,
        max: 139,
        nombre: 'Palpitante',
        etiqueta: '✦✦ Palpitante',
        multiplicador: 1.10,
    },
    {
        min: 140,
        max: 219,
        nombre: 'Ardiente',
        etiqueta: '✦✦✦ Ardiente',
        multiplicador: 1.15,
    },
    {
        min: 220,
        max: 299,
        nombre: 'Radiante',
        etiqueta: '✦✦✦✦ Radiante',
        multiplicador: 1.20,
    },
    {
        min: 300,
        max: 300,
        nombre: 'Incandescente',
        etiqueta: '✦✦✦✦✦ Incandescente',
        multiplicador: 1.25,
    },
];

function diasEntreFechas(fechaAntes, fechaDespues) {
    const a = utilidadesTexto.enHoraMexico(fechaAntes);
    const b = utilidadesTexto.enHoraMexico(fechaDespues);

    const msPerDay = 1000 * 60 * 60 * 24
    const aUTC = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
    const bUTC = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());

    return Math.max(0, Math.floor((bUTC - aUTC) / msPerDay));
}

function calcularDecay(diasInactivos) {
    let total = 0;
    for (let i = 0; i < diasInactivos; i++) {
        total += i < DECAY_POR_DIA.length ? DECAY_POR_DIA[i] : DECAY_PLATEAU;
    }
    return total;
}

function calcularEtapa(calor) {
    for (let i = ETAPAS.length - 1; i >= 0; i--) {
        if (calor >= ETAPAS[i].min) return ETAPAS[i];
    }
    return ETAPAS[0];
}

function multiplicadorCalor(calor) {
    return calcularEtapa(calor).multiplicador
}

/**
 * Función principal del sistema.
 * Llamar cada vez que el jugador haga CUALQUIER actividad en el bot.
 * No modifica la DB — solo calcula y devuelve el resultado.
 *
 * @param {number}    calorActual      — calor almacenado en DB (0-300)
 * @param {Date|null} ultimaActividad  — fecha de última actividad (null si es nuevo)
 * @returns {ResultadoCalor}
 */
function procesarActividad(calorActual, ultimaActividad) {
    const hoy = new Date();

    // ── Primera actividad del jugador ──────────────
    if (!ultimaActividad) {
        const nuevoCalor = Math.min(MAX_CALOR, GANANCIA_DIARIA);
        return {
            nuevoCalor,
            yaActivo: false,
            gano: true,
            decay: 0,
            diasInactivos: 0,
            etapaAnterior: calcularEtapa(0),
            etapaNueva: calcularEtapa(nuevoCalor),
            subioEtapa: false,
            bajóEtapa: false,
        };
    }

    const ultima = new Date(ultimaActividad);
    const diasDiff = diasEntreFechas(ultima, hoy);

    // ── Ya fue activo hoy — sin cambios ───────────
    if (diasDiff === 0) {
        const etapaActual = calcularEtapa(calorActual);
        return {
            nuevoCalor: calorActual,
            yaActivo: true,
            gano: false,
            decay: 0,
            diasInactivos: 0,
            etapaAnterior: etapaActual,
            etapaNueva: etapaActual,
            subioEtapa: false,
            bajóEtapa: false,
        };
    }

    // ── Calcular decay + ganancia ──────────────────
    // diasDiff - 1 porque hoy es día activo, no inactivo
    const diasInactivos = diasDiff - 1;
    const decay = calcularDecay(diasInactivos);
    const etapaAnterior = calcularEtapa(calorActual);

    const calorPostDecay = Math.max(0, calorActual - decay);
    const nuevoCalor = Math.min(MAX_CALOR, calorPostDecay + GANANCIA_DIARIA);
    const etapaNueva = calcularEtapa(nuevoCalor);

    return {
        nuevoCalor,
        yaActivo: false,
        gano: true,
        decay,
        diasInactivos,
        etapaAnterior,
        etapaNueva,
        subioEtapa: etapaNueva.min > etapaAnterior.min,
        bajóEtapa: etapaNueva.min < etapaAnterior.min,
    };
}

/**
 * Registra actividad de combate o exploración y sube el Calor UNA vez al día
 * (aplicando antes el enfriamiento por los días sin jugar).
 * La escritura es condicional a la última actividad leída: dos acciones
 * simultáneas el mismo día no pueden sumar el Calor dos veces.
 *
 * @param {number} characterId - _id del Personaje
 * @returns {Promise<ResultadoCalor & { puntos: number } | null>}
 */
async function aplicarCalor(characterId) {
    const characters = clientdb.db("Rol_db").collection("Personajes")
    const id = Number(characterId)
    const pj = await characters.findOne({ _id: id }, { projection: { "actividad.calor": 1 } })
    if (!pj) return null

    const puntos = Number(pj.actividad?.calor?.puntos) || 0
    const ultima = pj.actividad?.calor?.ultimaActividad ?? null
    const resultado = procesarActividad(puntos, ultima)
    if (resultado.yaActivo) return { ...resultado, puntos }

    const filtro = ultima
        ? { _id: id, "actividad.calor.ultimaActividad": ultima }
        : { _id: id, "actividad.calor.ultimaActividad": { $exists: false } }
    const r = await characters.updateOne(filtro, {
        $set: {
            "actividad.calor.puntos": resultado.nuevoCalor,
            "actividad.calor.ultimaActividad": new Date(),
        }
    })
    // Si otra acción ya lo registró hoy, el Calor vigente es el que dejó esa acción
    if (r.modifiedCount === 0) {
        const fresco = await characters.findOne({ _id: id }, { projection: { "actividad.calor": 1 } })
        return { ...resultado, gano: false, puntos: Number(fresco?.actividad?.calor?.puntos) || 0 }
    }
    return { ...resultado, puntos: resultado.nuevoCalor }
}


module.exports = {
    // Core
    procesarActividad,
    aplicarCalor,
    multiplicadorCalor,
    calcularEtapa,
    calcularDecay,
    // Constantes (para tests o UI externa)
    ETAPAS,
    MAX_CALOR,
    GANANCIA_DIARIA,
    DECAY_POR_DIA,
    DECAY_PLATEAU,
};
