// ═══ CLIMA-HORARIO: configuración por región ═══
// Los valores marcados con ⚙ se ajustan aquí (nunca en el código del motor).
// Para medir el efecto de un cambio: `npm run simular-clima -- TOB-001 120`.

/** Los 9 estados. Coinciden con las carpetas de Cloudinary (Rol/Clima/{Día|Noche}/{Estado}/{Fase}). */
const ESTADOS = ["Soleado", "Caluroso", "Ventoso", "Nublado", "Lluvioso", "Granizada", "Tormenta", "Nevada", "Niebla"];
const FASES = ["Madrugada", "Amanecer", "Día", "Tarde", "Atardecer", "Noche"];
const ESTACIONES = ["primavera", "verano", "otoño", "invierno"];
const REGIMENES = ["seco", "variable", "lluvioso", "tormentoso"];

const CONFIG_TOBEYA = {
    nombre: "Tobeya",
    reloj: { cicloMin: 600, horaBase: 0 },   // ⚙ 600 min reales = 1 día interno (25 min por hora)
    estadoInicial: "Nublado",

    // Grafo de transiciones. Pesos base = matriz ORIGINAL de Hora_rol.js sin la diagonal,
    // normalizada a 100 (la "probabilidad de quedarse" la reemplaza la duración).
    // Las flechas NUEVO no existían en el original: declaradas en tests/clima/legado.test.js.
    transiciones: {
        Soleado:   { Caluroso: 50, Ventoso: 25, Nublado: 25 },
        Caluroso:  { Soleado: 62, Ventoso: 25, Nublado: 13 },
        Ventoso:   { Soleado: 50, Nublado: 50 },
        Nublado:   { Soleado: 25, Ventoso: 37, Lluvioso: 25, Granizada: 6, Tormenta: 6,
                     Nevada: 15 /*NUEVO*/, Niebla: 40 /*NUEVO ⚙ (con 5 casi nunca aparecía)*/ },
        Lluvioso:  { Ventoso: 17, Nublado: 50, Granizada: 17, Tormenta: 16 },
        Granizada: { Ventoso: 17, Nublado: 17, Lluvioso: 33, Tormenta: 33, Nevada: 10 /*NUEVO*/ },
        Tormenta:  { Nublado: 29, Lluvioso: 43, Granizada: 28 },
        Nevada:    { Nublado: 50, Lluvioso: 17, Granizada: 33 },
        Niebla:    { Soleado: 50, Nublado: 50 }   // NUEVO
    },

    // ⚙ Duración en horas internas [min, max] al entrar a cada estado
    duracion: {
        Soleado: [4, 10], Caluroso: [3, 8], Ventoso: [2, 5], Nublado: [3, 7], Lluvioso: [3, 6],
        Granizada: [1, 3], Tormenta: [1, 3], Nevada: [4, 8], Niebla: [2, 4]
    },
    duracionLluviaEnRegimenLluvioso: 1.5,   // ⚙

    // ⚙ Multiplicador por estación sobre el DESTINO (no listado = 1)
    porEstacion: {
        primavera: { Soleado: 1.2, Caluroso: 1.2, Ventoso: 1.3, Nublado: 1.0, Lluvioso: 0.6, Granizada: 0.8, Tormenta: 0.4, Nevada: 0, Niebla: 0.8 },
        verano:    { Soleado: 0.7, Caluroso: 1.8, Ventoso: 0.7, Nublado: 1.0, Lluvioso: 1.5, Granizada: 1.3, Tormenta: 1.5, Nevada: 0, Niebla: 0.3 },
        otoño:     { Soleado: 1.0, Caluroso: 0.5, Ventoso: 1.2, Nublado: 1.1, Lluvioso: 0.9, Granizada: 0.5, Tormenta: 0.5, Nevada: 0, Niebla: 1.0 },
        invierno:  { Soleado: 1.1, Caluroso: 0,   Ventoso: 1.2, Nublado: 1.0, Lluvioso: 0.3, Granizada: 0.4, Tormenta: 0,   Nevada: 1.0, Niebla: 1.2 }
    },

    // ⚙ Pesos para sortear el régimen del día, por estación
    regimenPorEstacion: {
        primavera: { seco: 40, variable: 40, lluvioso: 15, tormentoso: 5 },
        verano:    { seco: 10, variable: 30, lluvioso: 40, tormentoso: 20 },
        otoño:     { seco: 25, variable: 40, lluvioso: 25, tormentoso: 10 },
        invierno:  { seco: 45, variable: 35, lluvioso: 15, tormentoso: 5 }
    },
    inerciaRegimen: 0.45,   // ⚙ prob. de heredar el régimen del día anterior

    // ⚙ Multiplicador por régimen sobre el DESTINO
    porRegimen: {
        seco:       { Soleado: 1.6, Caluroso: 1.4, Ventoso: 1.2, Lluvioso: 0.3, Granizada: 0.2, Tormenta: 0.1 },
        variable:   {},
        lluvioso:   { Soleado: 0.4, Caluroso: 0.3, Lluvioso: 1.8, Granizada: 1.3, Nevada: 2.0 },
        tormentoso: { Soleado: 0.5, Caluroso: 0.5, Lluvioso: 1.5, Granizada: 1.8, Tormenta: 2.5 }
    },

    // ⚙ Multiplicador por fase sobre el DESTINO
    porFase: {
        Madrugada: { Niebla: 1.5, Caluroso: 0.2 },
        Amanecer:  { Niebla: 1.5, Caluroso: 0.4 },
        Día:       { Caluroso: 1.2, Tormenta: 0.7, Lluvioso: 0.8 },
        Tarde:     { Caluroso: 1.5, Tormenta: 1.4, Lluvioso: 1.3, Granizada: 1.4 },
        Atardecer: { Tormenta: 1.2, Lluvioso: 1.1, Caluroso: 0.8 },
        Noche:     { Caluroso: 0.2 }
    },

    multiplicadorMax: 4,    // ⚙ tope del PRODUCTO estación × régimen × fase (red de seguridad)
    nieblaInicioEn:    ["Madrugada", "Amanecer"],          // fases donde puede EMPEZAR niebla
    nieblaPermitidaEn: ["Madrugada", "Amanecer", "Día"],   // fases donde puede CONTINUAR
    histeresisRetorno: 0.6, // ⚙ multiplicador si el destino == previo (evita ping-pong)
    maxCambiosPorDia: 7,    // ⚙ red de seguridad

    // ⚙ Temperatura (°C): objetivo = base[estación] + modEstado[estado] + modFase[fase],
    // suavizada hora a hora (T += 0.5 × (objetivo − T)). Límites -5..40.
    temperatura: {
        base:      { primavera: 22, verano: 26, otoño: 20, invierno: 12 },
        modEstado: { Soleado: 2, Caluroso: 7, Ventoso: -2, Nublado: -2, Lluvioso: -4, Granizada: -7, Tormenta: -4, Nevada: -12, Niebla: -3 },
        modFase:   { Madrugada: -4, Amanecer: -3, Día: 0, Tarde: 3, Atardecer: 0, Noche: -3 },
        suavizado: 0.5,
        min: -5,
        max: 40
    },

    brechaMaxRecuperacion: 72,   // horas internas; más que esto = reiniciar desde el estado inicial

    // Noticiero
    noticieroRefrescoMin: 5,  // ⚙ minutos reales entre ediciones mientras el mensaje está publicado
    noticieroMiniatura: "https://i.pinimg.com/1200x/8e/ef/df/8eefdf059e8f8c4e5b85d6c464e969c0.jpg", // ⚙ fija
    imagenPorDefecto: "https://i.pinimg.com/736x/ab/e8/d3/abe8d308eb1d2ca3297f171888aa2f45.jpg", // ⚙
    imagenesCacheMin: 60    // ⚙ minutos que se guarda el resultado de cloudinary.search por carpeta
};

const REGIONES = {
    "TOB-001": CONFIG_TOBEYA
};

function configDe(regionId) {
    const cfg = REGIONES[regionId];
    if (!cfg) throw new Error(`[Clima] Región desconocida: ${regionId}`);
    return cfg;
}

module.exports = { REGIONES, ESTADOS, FASES, ESTACIONES, REGIMENES, configDe };
