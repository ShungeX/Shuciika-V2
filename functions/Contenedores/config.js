// ─── Contenedores elementales y durabilidad: constantes y balance ────────────
// Referencia: Contenedores_y_Durabilidad.md. Todo lo marcado ⚙ en el documento vive aquí:
// ningún número de balance debe escribirse dentro de las funciones.

/**
 * Interruptor general (XII.D). Apagado: los desafinados juegan como un jugador normal.
 * No encender sin haber corrido antes `node scripts/migrarContenedores.js --aplicar`:
 * un desafinado sin contenedor no puede lanzar nada.
 */
const BANDERAS = { CONTENEDORES_ACTIVOS: true }

/** Tipos de contenedor (III.B). `objeto` es su definición en Objetos_globales. */
const TIPOS = Object.freeze({
    cortesia: Object.freeze({
        nombre: "Contenedor de Cortesía", objeto: Object.freeze({ ID: 992, Region: "TOB-01" }),
        calidad: 1, durabilidad: 25, capacidadFactor: 0.6, grado: 1,
        reparable: false, esRespaldo: true, personalizable: false,
        forma: "colgante", aspecto: "Cristal opaco, de forma estándar",
    }),
    artesanal: Object.freeze({
        nombre: "Contenedor elemental", objeto: Object.freeze({ ID: 8, Region: "TOB-01" }),
        calidad: 2, durabilidad: 60, capacidadFactor: 1.3, grado: 1,
        reparable: true, esRespaldo: false, personalizable: true,
    }),
    // Post-lanzamiento (mejora en el Taller): refinado ×1.4 / 100 · mayor ×1.5 / 150
})

const ETAPAS = Object.freeze({ INTACTO: "Intacto", FISURADO: "Fisurado", CRITICO: "Crítico", ROTO: "Roto" })

const DURABILIDAD = Object.freeze({
    UMBRAL_INTACTO: 0.60,             // ⚙ > 60% Intacto
    UMBRAL_FISURADO: 0.30,            // ⚙ > 30% Fisurado; el resto, Crítico
    // El contenedor se desgasta con el DAÑO EFECTIVO que recibe su portador (no al lanzar):
    // desgaste = durabilidad máx. × (daño / vida máx.) × FACTOR_DANO × MULT_TIPO_DANO[tipo]
    FACTOR_DANO: 0.5,                 // ⚙ perder el 100% de la vida gasta la mitad de la durabilidad
    MULT_TIPO_DANO: Object.freeze({ fisico: 1, magico: 1, disonancia: 1.5 }),   // ⚙
    RESIDUO_ROTO: 0.01,               // por debajo de esto la durabilidad cuenta como 0
    MOD_PROBABILIDAD: Object.freeze({ Intacto: 0, Fisurado: -0.05, "Crítico": -0.15 }),   // ⚙ puntos de probabilidad
})

const TRADUCCION = Object.freeze({
    LATENCIA: Object.freeze({ 1: 0, 2: 1, 3: 1 }),   // ⚙ +tiempo de cast por escalón
    SENSIBILIDAD_CORTE: 0.25,         // ⚙ por turno, con Miedo / Confusión / Lentitud y un cast en curso
    FACTOR_COSTO_VIDA: 0.5,           // ⚙ "menor fatiga física": los costos en Vida valen la mitad
    CAMBIO_CONSUME_TURNO: true,       // ⚙ cambiar de elemento activo en combate
    MENSAJE_CAMBIO: (nombre) => `${nombre} te mira fijamente.`,   // silencioso: nunca dice a qué elemento
})

const MANA = Object.freeze({
    REGEN_BASE: 2,                    // ⚙ por turno completo (afinados). Los bonus `regen_mana` se suman, sin techo
})

const REPARACION = Object.freeze({
    KIT: Object.freeze({ ID: 990, Region: "TOB-01" }),
    KIT_PUNTOS: 25,                   // ⚙ solo fuera de combate; no repara un Roto
    BASE_TALLER: 50,                  // ⚙ Lumens
    FACTOR_DANIO: 2,                  // ⚙ costo × (1 + 2 × daño)
    RECARGO_FRECUENCIA: 0.25,         // ⚙ por cada reparación en la ventana
    VENTANA_DIAS: 7,
    RECARGO_ROTO: 1.5,                // ⚙ reemplazo del cristal
    RECARGA_AL_REPARAR: true,         // el Taller devuelve el contenedor con la carga llena
    MOTIVO_LEDGER: "contenedor",
})

const RESPALDO = Object.freeze({
    MAX_POR_DIA: 1,                   // ⚙ reposiciones gratuitas
    TEXTO_ENTREGA: "*\"\"*",
})

const ARTESANO = Object.freeze({
    PRECIO: 1200,                     // ⚙ Lumens
    FORMAS: Object.freeze(["anillo", "arete", "pulsera", "collar", "colgante", "broche", "diadema"]),
    FORMA_MAX: 20,
    NOMBRE_MAX: 40,                   // ⚙
    DESCRIPCION_MAX: 200,             // ⚙
    MOTIVO_LEDGER: "contenedor",
})

const ADVERTENCIA = Object.freeze({
    TEXTO: "*El Instituto no juzga el alma que no resuena. Te ofrece un Contenedor, regalo de la compasión del Eón, para que tu maná encuentre cauce. Pero escucha con atención: tu poder habitará fuera de ti. Si el cristal se fisura, tu voz vacilará; si se rompe, no tendrás más que tus manos y lo que cargues contigo. Cuídalo como cuidas tu vista. Muchos lo han perdido por confiar demasiado.*",
    RESUMEN: Object.freeze([
        "Lanzas hechizos de **un elemento a la vez**. Cambiar de elemento en combate consume un turno.",
        "No regeneras maná en combate.",
        "Tus hechizos tardan un poco más (latencia).",
        "Tu contenedor se desgasta con el daño que recibes.",
        "Si tu contenedor se rompe, solo te quedan Golpe, Guardia e ítems.",
        "Puedes aprender hechizos de cualquier elemento.",
    ]),
})

const UI = Object.freeze({
    BARRA_LARGO: 10,
    BARRA: Object.freeze({ lleno: "▰", vacio: "▱" }),
    ICONO_ETAPA: Object.freeze({ Intacto: "💠", Fisurado: "🔹", "Crítico": "⚠️", Roto: "💔" }),
})

module.exports = {
    BANDERAS, TIPOS, ETAPAS, DURABILIDAD, TRADUCCION, MANA, REPARACION, RESPALDO, ARTESANO, ADVERTENCIA, UI,
}
