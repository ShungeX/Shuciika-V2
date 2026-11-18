// ─── Aprendizaje de hechizos con páginas y minijuegos: constantes y balance ──
// Referencia: Prompt_Agente_Durabilidad_y_Aprendizaje.md (Cambio 2). Todo lo marcado ⚙ vive aquí:
// ningún número de balance debe escribirse dentro de las funciones.
//
// Flujo: página en inventario → Usar → pantalla de la página → practicar cada vía (minijuego)
//        → todas las vías al 100%: hechizo aprendido en el alma y página consumida.
// El aprendizaje no depende del contenedor: un desafinado practica sin contenedor funcional.

const { ESCALONES } = require("../Duelo/hechizos/config")

/** Progreso por intento (2.2). */
const PRACTICA = Object.freeze({
    UMBRAL_APROBADO: 0.80,            // ⚙ puntaje que completa una vía
    GANANCIA_MAX_FALLO: 0.30,         // ⚙ progreso máximo de un intento fallido
    PRACTICAS_POR_DIA: 2,             // ⚙ por personaje (cada intento de una vía cuenta)
    COOLDOWN_FALLO_MIN: 30,           // ⚙ minutos tras un intento fallido
    ZONA_HORARIA: "America/Mexico_City",   // ⚙ reinicio diario por fecha, no por ventana de 24 h
    CADUCIDAD_MIN: 15,                // ⚙ una sesión abierta caduca (puntaje 0)
})

/** Resplandor mínimo por escalón (Acordes III, Cánticos V). Se usa el mayor entre esto y Req.resplandor_min. */
const RESPLANDOR_MIN = Object.freeze({ 1: 1, 2: ESCALONES[2].resplandor, 3: ESCALONES[3].resplandor })   // ⚙

/** Dificultad de cada minijuego según el escalón del hechizo que se aprende (2.2). Universales = Nota. */
const DIFICULTAD = Object.freeze({
    1: Object.freeze({ hablado: { palabras: [6, 8], segundos: 8 }, movimiento: { pasos: 4, segundos: 5 }, escritura: { nodos: 4, segundos: 5 }, mental: { rondas: 3 } }),
    2: Object.freeze({ hablado: { palabras: [10, 14], segundos: 12 }, movimiento: { pasos: 6, segundos: 7 }, escritura: { nodos: 6, segundos: 7 }, mental: { rondas: 5 } }),
    3: Object.freeze({ hablado: { palabras: [18, 24], segundos: 16 }, movimiento: { pasos: 8, segundos: 9 }, escritura: { nodos: 9, segundos: 9 }, mental: { rondas: 7 } }),
})

/**
 * Minijuegos (Fase 2). Una vía con su bandera apagada se practica con el stub.
 * Escritura es la última: mientras no exista, las Notas de Pyrós y Kryo siguen con el stub.
 */
const MINIJUEGOS = {
    hablado: true,
    movimiento: true,
    mental: true,
    escritura: true,
}

/**
 * Stub de desarrollo (Fase 1): devuelve el puntaje configurado sin jugar nada.
 * Se puede forzar para todas las vías con APRENDIZAJE_STUB=1 (y APRENDIZAJE_STUB_PUNTAJE=0..1).
 */
const STUB = Object.freeze({
    FORZAR: process.env.APRENDIZAJE_STUB === "1",
    PUNTAJE: Number.isFinite(Number(process.env.APRENDIZAJE_STUB_PUNTAJE)) && process.env.APRENDIZAJE_STUB_PUNTAJE !== undefined
        ? Math.max(0, Math.min(1, Number(process.env.APRENDIZAJE_STUB_PUNTAJE)))
        : 1.0,
})

/** Parámetros de los minijuegos que no dependen del escalón. */
const JUEGOS = Object.freeze({
    MOVIMIENTO: Object.freeze({
        GESTOS: Object.freeze([
            { id: "arriba", emoji: "⬆️" }, { id: "derecha", emoji: "➡️" }, { id: "abajo", emoji: "⬇️" },
            { id: "izquierda", emoji: "⬅️" }, { id: "palma", emoji: "✋" },
        ]),
    }),
    MENTAL: Object.freeze({
        SEGUNDOS_RONDA: 15,           // ⚙ tiempo generoso por ronda
        // Pares (normal, distinto): parecidos pero distinguibles en móvil y modo oscuro
        PARES: Object.freeze([["◇", "◈"], ["○", "◌"], ["□", "▣"], ["△", "▲"], ["☆", "★"], ["◯", "◎"], ["▽", "▼"], ["♢", "♦"]]),
        // Tamaño de la cuadrícula por ronda (filas × columnas): crece con la ronda, máx. 4×4
        CUADRICULAS: Object.freeze([[3, 3], [3, 4], [4, 4]]),
    }),
    ESCRITURA: Object.freeze({
        FILAS: 4, COLUMNAS: 5,        // 20 nodos + 1 fila de control (Discord: máx. 5×5 botones)
        NUMEROS: Object.freeze(["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"]),
        NODO: "⚬",
    }),
})

/** Precio de las páginas de la tienda de magia (2.8): base × multiplicador por aprecio. */
const PRECIO = Object.freeze({
    BASE: 500,                        // ⚙ Lumens
    MULT_APRECIO: Object.freeze({ 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.5, 5: 2.5 }),   // ⚙
})

/** Precio de una página: el campo `precio` del hechizo anula el cálculo (null si no se vende). */
function precioPagina({ fuente, aprecio, precio } = {}) {
    if (fuente !== "tienda") return null
    if (Number.isFinite(Number(precio)) && precio !== null) return Number(precio)
    return Math.round(PRECIO.BASE * (PRECIO.MULT_APRECIO[aprecio] ?? 1))
}

/** Ítems página en Objetos_globales (respeta las convenciones del catálogo: ID numérico por región). */
const PAGINAS = Object.freeze({
    REGION: "TOB-01",
    TIPO: "Página",                   // Tipo: ["Consumible", "Página"]
    PESO: 0,                          // mínimo (los pesos del catálogo son enteros)
    LIGADA: true,                     // ⚙ comercio de páginas entre jugadores: PENDIENTE de decidir
    RAREZA_POR_ESCALON: Object.freeze({ 1: "Común", 2: "Resonante", 3: "Luminoso" }),   // Nota · Acorde · Cántico
    PREFIJO_NOMBRE: "Página: ",
})

/**
 * Dónde se consiguen las páginas (Fase 3). Usa el sistema de tiendas existente: un objeto se vende
 * en un panel si tiene `inStore` y el lugar del panel en `en_tienda`.
 *  · tienda    → Tienda Mágica (Distrito mercantil), al precio por aprecio.
 *  · instituto → panel del Instituto (lugar "Instituto"), gratis, una por personaje y con
 *                existencias semanales: "debería tener los materiales; casualmente, no hay".
 *  · evento    → fuera de las tiendas.
 */
const TIENDA = Object.freeze({
    LUGAR_TIENDA: "Magica",
    LUGAR_INSTITUTO: "Instituto",
    MAX_INVENTARIO: 1,                // ⚙ una página basta: se consume al aprender
    INSTITUTO_POR_PERSONA: 1,         // ⚙ el Instituto regala cada página una sola vez por personaje
    EXISTENCIAS_SEMANALES: 5,         // ⚙ por página del Instituto (null = sin límite)
    REPOSICION_CRON: "0 0 * * 1",     // ⚙ lunes 00:00 (zona de PRACTICA.ZONA_HORARIA)
    AGOTADO_INSTITUTO: (nombre) => `El Instituto debería tener los materiales para **${nombre}**... casualmente, no hay. Vuelve la próxima semana.`,
})

/**
 * Propuesta de fuente y aprecio por hechizo (2.9). `fuente`: instituto (gratis) | tienda | evento.
 * `id` es el ID numérico del ítem página en la región PAGINAS.REGION. Editable aquí.
 * Golpe y Guardia no llevan página.
 */
const FUENTES = Object.freeze({
    "Pyro-001": { id: 1001, fuente: "instituto", aprecio: 1 },
    "Pyro-002": { id: 1002, fuente: "tienda", aprecio: 4 },
    "Pyro-003": { id: 1003, fuente: "evento", aprecio: 5 },
    "Aqua-001": { id: 1004, fuente: "instituto", aprecio: 1 },
    "Aqua-002": { id: 1005, fuente: "instituto", aprecio: 2 },
    "Aqua-003": { id: 1006, fuente: "evento", aprecio: 5 },
    "Lux-001": { id: 1007, fuente: "instituto", aprecio: 1 },
    "Lux-002": { id: 1008, fuente: "instituto", aprecio: 2 },
    "Lux-003": { id: 1009, fuente: "evento", aprecio: 5 },
    "Rakau-001": { id: 1010, fuente: "instituto", aprecio: 1 },
    "Rakau-002": { id: 1011, fuente: "tienda", aprecio: 3 },
    "Rakau-003": { id: 1012, fuente: "evento", aprecio: 5 },
    "Lapis-001": { id: 1013, fuente: "instituto", aprecio: 1 },
    "Lapis-002": { id: 1014, fuente: "instituto", aprecio: 2 },
    "Lapis-003": { id: 1015, fuente: "evento", aprecio: 5 },
    "Electro-001": { id: 1016, fuente: "instituto", aprecio: 1 },
    "Electro-002": { id: 1017, fuente: "tienda", aprecio: 3 },
    "Electro-003": { id: 1018, fuente: "evento", aprecio: 5 },
    "Wind-001": { id: 1019, fuente: "instituto", aprecio: 1 },
    "Wind-002": { id: 1020, fuente: "tienda", aprecio: 3 },
    "Wind-003": { id: 1021, fuente: "evento", aprecio: 5 },
    "Kryo-001": { id: 1022, fuente: "instituto", aprecio: 1 },
    "Kryo-002": { id: 1023, fuente: "tienda", aprecio: 3 },
    "Kryo-003": { id: 1024, fuente: "evento", aprecio: 5 },
    "univ-002": { id: 1025, fuente: "tienda", aprecio: 2 },
    "univ-003": { id: 1026, fuente: "tienda", aprecio: 2 },
    "univ-004": { id: 1027, fuente: "tienda", aprecio: 1 },
    "univ-005": { id: 1028, fuente: "evento", aprecio: 5 },
    // Notas de Resplandor I (Notas_Nuevas_Resplandor_I.md): se abren por Fragmentos ganados (FE 3 / FE 10)
    "Pyro-101": { id: 1032, fuente: "tienda", aprecio: 1 },
    "Pyro-102": { id: 1033, fuente: "tienda", aprecio: 2 },
    "Aqua-101": { id: 1034, fuente: "tienda", aprecio: 1 },
    "Aqua-102": { id: 1035, fuente: "tienda", aprecio: 2 },
    "Lux-101": { id: 1036, fuente: "tienda", aprecio: 1 },
    "Lux-102": { id: 1037, fuente: "tienda", aprecio: 2 },
    "Rakau-101": { id: 1038, fuente: "tienda", aprecio: 1 },
    "Rakau-102": { id: 1039, fuente: "tienda", aprecio: 3 },
    "Lapis-101": { id: 1040, fuente: "tienda", aprecio: 1 },
    "Lapis-102": { id: 1041, fuente: "tienda", aprecio: 2 },
    "Electro-101": { id: 1042, fuente: "tienda", aprecio: 1 },
    "Electro-102": { id: 1043, fuente: "tienda", aprecio: 2 },
    "Wind-101": { id: 1044, fuente: "tienda", aprecio: 1 },
    "Wind-102": { id: 1045, fuente: "tienda", aprecio: 2 },
    "Kryo-101": { id: 1046, fuente: "tienda", aprecio: 1 },
    "Kryo-102": { id: 1047, fuente: "tienda", aprecio: 2 },
})

/** Interfaz (2.7). Sin "hilo" ni términos reservados en los textos. */
const UI = Object.freeze({
    BARRA_LARGO: 10,
    BARRA: Object.freeze({ lleno: "▰", vacio: "▱" }),
    NOMBRE_VIA: Object.freeze({ hablado: "Hablado", movimiento: "Movimiento", escritura: "Escritura", mental: "Mental" }),
    EMOJI_VIA: Object.freeze({ hablado: "🗣️", movimiento: "🤲", escritura: "✍️", mental: "🧠" }),
})

module.exports = {
    PRACTICA, RESPLANDOR_MIN, DIFICULTAD, MINIJUEGOS, STUB, JUEGOS, PRECIO, precioPagina, PAGINAS, TIENDA, FUENTES, UI,
}
