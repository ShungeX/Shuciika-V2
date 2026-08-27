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

async function aplicarCalor(characterId, actividad) {
    const db2 = clientdb.db("Rol_db")
    const characters = db2.collection("Personajes")
    const souls = db2.collection("Soul")
    const resultado = procesarActividad(actividad?.calor?.puntos ?? 0,
        actividad?.calor?.ultimaActividad ?? null
    );

    if (resultado.yaActivo) return resultado;

    characters.updateOne({_id: characterId}, {
        $set: {
            "actividad.calor.puntos": resultado.nuevoCalor,
            "actividad.calor.ultimaActividad": new Date(),
        }
    })

    return resultado
}


module.exports = {
    // Core
    procesarActividad,
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
