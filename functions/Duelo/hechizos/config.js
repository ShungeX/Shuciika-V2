// ─── Sistema de hechizos: constantes y balance ──────────────────────────────
// Referencia: Sistema_de_Hechizos.md (vías, escalones, control, Estasis, Tregua,
// interrupción, maestría, calibración). Todo lo marcado ⚙ en el documento vive aquí:
// ningún número de balance debe escribirse dentro de las funciones del combate.

const VIAS = Object.freeze({
    HABLADO: "hablado",
    MOVIMIENTO: "movimiento",
    ESCRITURA: "escritura",
    MENTAL: "mental",
    INSTINTO: "instinto",       // solo NPCs no humanos
})
const VIAS_CORPORALES = Object.freeze([VIAS.HABLADO, VIAS.MOVIMIENTO, VIAS.ESCRITURA])
const VIAS_VALIDAS = Object.freeze(Object.values(VIAS))
// Vías que sufren el +1 de tiempo de Lentitud (instinto: el NPC entero se ralentiza)
const VIAS_LENTAS = Object.freeze([VIAS.MOVIMIENTO, VIAS.ESCRITURA, VIAS.INSTINTO])

/** Nombre canónico de cada elemento (igual que el lore). Migrar aquí, en un solo lugar. */
const ELEMENTOS = Object.freeze({
    PYROS: "Pyrós", AQUA: "Aqua", LUX: "Lux", RAKAU: "Rakau",
    LAPIS: "Lapis", ELECTRO: "Electro", WIND: "Wind", KRYO: "Kryo",
    NEUTRO: "Neutro",
})

/** Prefijo de _id por elemento ("Pyro-001"); los IDs no llevan tilde. */
const PREFIJO_ID = Object.freeze({
    "Pyrós": "Pyro", Aqua: "Aqua", Lux: "Lux", Rakau: "Rakau",
    Lapis: "Lapis", Electro: "Electro", Wind: "Wind", Kryo: "Kryo",
})

/** Vía nativa de cada elemento (III.A). Las Notas exigen solo esta. */
const VIA_NATIVA = Object.freeze({
    "Pyrós": VIAS.ESCRITURA,
    Aqua: VIAS.HABLADO,          // PENDIENTE: mover a movimiento si Mutismo duele demasiado en pruebas
    Lux: VIAS.HABLADO,
    Rakau: VIAS.MOVIMIENTO,
    Lapis: VIAS.MOVIMIENTO,
    Electro: VIAS.MOVIMIENTO,
    Wind: VIAS.HABLADO,
    Kryo: VIAS.ESCRITURA,
})

/** Escalones (III.B). En datos: Escalon 1 | 2 | 3. */
const ESCALONES = Object.freeze({
    1: { nombre: "Nota", vias: 1, resplandor: null },
    2: { nombre: "Acorde", vias: 2, resplandor: 3 },
    3: { nombre: "Cántico", vias: 4, resplandor: 5 },
})

const ROLES = Object.freeze(["daño", "curación", "soporte", "control", "defensa", "híbrido"])
const ALCANCES = Object.freeze(["single", "todos", "cadena"])
const OBJETIVOS = Object.freeze(["enemigos", "aliados", "mismo", "global"])
const VIAS_ADQUISICION = Object.freeze(["inicio", "tratado", "evento", "luna"])   // 'luna' reservado, no implementar

const CASTEO = Object.freeze({
    FACTOR_MENTAL: 0.5,               // ⚙ la vía del experto sufre la mitad de las degradaciones
    LENTITUD_TIEMPO_EXTRA: 1,         // ⚙ +1 de tiempo de cast con Lentitud
    MENTAL: Object.freeze({           // ⚙ casteo solo mental (IV)
        maestria_min: 4,
        manaX: 1.5,
        tiempoExtra: 1,
        escalonMax: 2,                // los Cánticos nunca admiten casteo solo mental
    }),
    // Un hechizo con tiempo total ≥ 2 se canaliza: empieza este turno y resuelve en el turno (tiempo − 1) propio siguiente
    TIEMPO_CANALIZACION_MIN: 2,
})

const CADENA = Object.freeze({ FACTORES: [1, 0.7, 0.5] })   // ⚙ Electro-002

const INTERRUPCION = Object.freeze({
    FRACCION_COOLDOWN: 0.5,           // ⚙ el hechizo cortado entra a la mitad de su cooldown
    INMUNIDAD_TURNOS: 1,              // ⚙ anti stun-lock tras ser interrumpido
})

const CONTROL = Object.freeze({
    INMUNIDAD_TRAS_CONTROL: 1,        // ⚙ turnos inmune a controles nuevos al salir de uno
})

const ESTASIS = Object.freeze({
    DURACION: 1,                      // fija, no se puede extender
    ANTI_CADENA: 2,                   // ⚙ turnos de inmunidad a Estasis al salir
    JEFES: "inmune",                  // ⚙ 'inmune' | 'reducida' (PENDIENTE por jefe)
})

const TREGUA = Object.freeze({
    DURACION: 1,
    SOLO_PVE: true,                   // nunca en PvP ni con apuestas
})

const GUARDIA = Object.freeze({        // univ-001 / botón "Defenderse"
    REDUCCION: 0.5,                   // ⚙ ~50% del daño recibido
    DURACION: 1,
})

const BUFFS = Object.freeze({          // ⚙ valor por defecto cuando el dato no trae uno
    velocidad: 0.25,                  // +25% de tempo
    daño: 0.15,
    defensa: 0.15,
    esquive: 0.25,
    precision: -0.25,
})

const ESTADOS_VALORES = Object.freeze({
    MIEDO: 0.15,                      // ⚙ por vía
    CONFUSION: 0.20,                  // ⚙ por vía
    CEGADO_PRECISION: -30,            // ⚙ % de precisión
})

const REVIVE = Object.freeze({ VECES_POR_COMBATE: 1, PORCENTAJE: 0.4 })

const OFRENDA = Object.freeze({       // costo en Lumens (Lux-003)
    SOLO_PVE: false,                  // PENDIENTE: pasar a true si genera problemas en PvP
    MOTIVO_LEDGER: "hechizo",
})

const PROVOCAR = Object.freeze({ DURACION: 2 })
const CONCENTRAR = Object.freeze({ MANA_PCT: 0.2, MANA_MIN: 8 })   // ⚙ univ-002

const MAESTRIA = Object.freeze({
    NIVELES: Object.freeze([
        { nivel: 1, nombre: "Novato", usos: 0, bonus: 0 },
        { nivel: 2, nombre: "Practicante", usos: 25, bonus: 0.10 },
        { nivel: 3, nombre: "Diestro", usos: 100, bonus: 0.20 },
        { nivel: 4, nombre: "Maestro", usos: 300, bonus: 0.25 },
    ]),
    TOPE_PROBABILIDAD: 0.95,
    DESCUENTO_MANA_MAESTRO: 1,        // si el hechizo ya está al 100%
    MANA_MINIMO: 1,
    USOS_POR_COMBATE: 5,              // ⚙ anti-farmeo por hechizo
    TOPE_DIARIO_AMISTOSO: 15,         // ⚙ usos contables por día contra el mismo rival en duelos amistosos
    CONTAR_EN_PRUEBA: false,          // las salas de prueba no suben maestría
})

const MENU = Object.freeze({
    MAX_OPCIONES: 25,                 // límite de Discord para un select menu
    POR_PAGINA: 5,
    SEPARADOR: "*",
})

/** Hechizos que todo personaje conoce desde el inicio (III.D). */
const UNIVERSALES_INICIALES = Object.freeze(["default_001", "univ-001"])

const ADQUISICION = Object.freeze({
    PRECIO_TRATADO: 500,              // ⚙ Lumens (Acordes, Provocar)
    PRECIO_TRATADO_BARATO: 200,       // ⚙ Lumens (Concentrar, Primeros auxilios)
})

const MANA = Object.freeze({
    INICIAL: 50,
    OBJETIVO_POR_RESPLANDOR: Object.freeze({ 1: 50, 3: 100, 5: 150, 7: 200 }),   // ⚙ guía (VII)
    COSTO_PCT: Object.freeze([0.05, 0.25]),   // un escalón al desbloquearse debe costar entre 5% y 25% del maná máximo
})

const KIT = Object.freeze({
    FILTRAR_POR_ELEMENTO: true,       // afinados: su elemento; desafinados: el del contenedor equipado
})

const CACHE = Object.freeze({
    TTL_MS: 10 * 60 * 1000,           // red de seguridad si alguien edita la colección por fuera del dashboard
})

// ─── Calibración (VIII) — solo herramienta, nunca en el casteo ───────────────
const CALIBRACION = Object.freeze({
    CFG: Object.freeze({ INT: 10, T: 15, aliados: 3, enemigos: 3 }),
    COBERTURA: Object.freeze({
        "Parálisis": 1.0, "Estasis": 1.0, "Congelado": 0.8, "Inmovilizado": 0.6,
        "Mutismo": 0.5, "Aturdimiento": 0.5, "Confusión": 0.35, "Miedo": 0.3, "Cegado": 0.3,
        // No figura en la tabla de cobertura: se valora como "buff/debuff leve" (0.4 T), que es
        // lo que da el I≈6.9 de Kryo-001 en III.C.
        "Lentitud": 0.4,
    }),
    BANDAS: Object.freeze({ 1: [4.7, 6.3], 2: [5.7, 6.9], 3: [6.5, 7.9] }),
    PESOS: Object.freeze({
        TODOS_POR_OBJETIVO: 0.6, CADENA: 2.25, DOT: 0.8, HOT: 0.9,
        BUFF: 0.4, ESQUIVE: 0.6, DEBUFF_DANIO: 0.5, CLEANSE: 0.8, REVIVE: 300,
        CONTROL_DEFECTO: 0.4, DEGRADACION_DEFECTO: 0.3,
    }),
})

module.exports = {
    VIAS, VIAS_CORPORALES, VIAS_VALIDAS, VIAS_LENTAS,
    ELEMENTOS, PREFIJO_ID, VIA_NATIVA, ESCALONES, ROLES, ALCANCES, OBJETIVOS, VIAS_ADQUISICION,
    CASTEO, CADENA, INTERRUPCION, CONTROL, ESTASIS, TREGUA, GUARDIA, BUFFS, ESTADOS_VALORES,
    REVIVE, OFRENDA, PROVOCAR, CONCENTRAR, MAESTRIA, MENU, UNIVERSALES_INICIALES,
    ADQUISICION, MANA, KIT, CACHE, CALIBRACION,
}
