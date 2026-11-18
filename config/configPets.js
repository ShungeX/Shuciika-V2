// config/configPets.js
// Configuración del sistema de mascotas y de la crianza de huevos (functions/Mascotas).
// Todo lo marcado con ⚙ es balance: se puede cambiar sin tocar código.

// ─── Mascotas ────────────────────────────────────────────────────────────────

/** Valor máximo de cada necesidad. */
const petConfig = {
    hambrestd: 300,
    higienestd: 300,
    felicidadstd: 230,
    energiastd: 100,
}

/** ⚙ Desgaste: cada `intervalo` minutos la necesidad pierde `desgasteIntervalo` puntos. */
const petDesgaste = {
    hambre: { intervalo: 10, desgasteIntervalo: 1 },
    higiene: { intervalo: 20, desgasteIntervalo: 4 },
    felicidad: { intervalo: 15, desgasteIntervalo: 1 },
    energia: { intervalo: 5, desgasteIntervalo: 2 },
}

/** ⚙ Puntos extra de desgaste por intervalo según la etapa (los más pequeños piden más atención). */
const desgasteEtapa = { "Bebé": 4, "Niñez": 3, "Juventud": 2, "Adultez": 0 }

const ETAPAS = ["Bebé", "Niñez", "Juventud", "Adultez"]

/** Multiplicadores por rareza de la mascota: tiempo entre etapas y XP necesaria. */
const modificadoresLv = {
    Sencilla: { tiempo: 1.0, xp: 1.0, lvUp: 2 },
    Brillante: { tiempo: 1.2, xp: 1.3, lvUp: 2 },
    Ancestral: { tiempo: 1.5, xp: 1.6, lvUp: 2 },
    Divina: { tiempo: 1.8, xp: 1.8, lvUp: 2 },
    Estelar: { tiempo: 1.9, xp: 2, lvUp: 3 },
}

/** XP acumulada para pasar a la etapa siguiente (× el multiplicador de rareza). */
const modifEtapa = {
    "Bebé": 230,
    "Niñez": 350,
    "Juventud": 540,
}

const pesosEstados = {
    Enfermo: 100,
}

/** ⚙ Progresión. */
const PROGRESION = {
    XP_BASE_NIVEL: 100,      // xpRq del nivel 1
    DIAS_BASE_ETAPA: 2,      // días de cuidado para la primera etapa (se multiplica por la rareza en cada etapa)
    BONUS_XP_ENTUSIASMADO: 1.25,
    PERSONALIDADES: [
        "Floja", "Juguetona", "Cariñosa", "Curiosa", "Glotona", "Leal", "Astuta",
        "Fuerte", "Valiente", "Sabia", "Temerosa", "Torpe", "Fria", "Debil",
    ],
}

/**
 * ⚙ Acciones de cuidado de una mascota.
 * `recupera` son los puntos que devuelve; si el objeto trae `atributos.<stat>` manda ese valor.
 * `consume: false` → el objeto es una herramienta (hace falta tenerlo, no se gasta).
 */
const ACCIONES_MASCOTA = {
    alimentar: {
        stat: "hambre", max: "hambrestd", objeto: { ID: 483, Region: "SKY-02" }, consume: true, recupera: 90,
        nombre: "alimento", etiqueta: "Alimentar", hecho: "come feliz", xp: [3, 7],
        emoji: { name: "cupcake", id: "1374267364702425119" },
    },
    limpiar: {
        stat: "higiene", max: "higienestd", objeto: { ID: 767, Region: "SKY-02" }, consume: true, recupera: 120,
        nombre: "limpiador", etiqueta: "Limpiar", hecho: "queda reluciente", xp: [3, 7],
        emoji: { name: "MimmySwim", id: "1374267620756422736" },
    },
    jugar: {
        stat: "felicidad", max: "felicidadstd", objeto: { ID: 728, Region: "SKY-02" }, consume: true, recupera: 70,
        nombre: "juguetes", etiqueta: "Jugar", hecho: "juega contigo", xp: [4, 8],
        emoji: { name: "butterflies", id: "1374267802361532436" },
    },
    // Dormir no da puntos al instante: la mascota se queda dormida y recupera energía con el tiempo
    dormir: {
        stat: "energia", max: "energiastd", objeto: { ID: 736, Region: "SKY-02" }, consume: false,
        nombre: "cama", etiqueta: "Dormir", hecho: "se acurruca y se duerme", xp: [1, 3],
        emoji: { name: "eepy_cat", id: "1374267940534358066" },
    },
}

/** ⚙ Sueño: energía que recupera por minuto dormida (100 puntos ≈ 2 h). Despierta sola al llenarse. */
const SUENO = { RECUPERA_POR_MINUTO: 100 / 120 }

/**
 * ⚙ Estados de la mascota. Los umbrales son porcentajes del máximo de la necesidad.
 *  - penalizacion: se aplica si la necesidad lleva `minutosParaAplicar` en o por debajo de `umbral`;
 *    se quita cuando vuelve a `recuperacion` y han pasado `minutosMinimos` desde que empezó.
 *    `acelera`: mientras dura, esa otra necesidad se desgasta ×ACELERACION_PENALIZACION.
 *  - bonificacion: activa mientras la necesidad esté en o por encima de `umbral` (no se guarda).
 */
const ACELERACION_PENALIZACION = 1.5
const ESTADOS_MASCOTA = {
    dormido: { tipo: "especial", peso: 1000, nombre: "Dormida", descripcion: "Está durmiendo..." },

    somnoliento: {
        tipo: "penalizacion", peso: 120, stat: "energia", umbral: 5, recuperacion: 60,
        minutosParaAplicar: 1, minutosMinimos: 240, acelera: "felicidad",
        nombre: "Somnolienta", descripcion: "Tiene sueño",
    },
    enfermo: {
        tipo: "penalizacion", peso: 100, stat: "higiene", umbral: 5, recuperacion: 30,
        minutosParaAplicar: 120, minutosMinimos: 240, acelera: "felicidad",
        nombre: "Enferma", descripcion: "Está enferma por falta de higiene",
    },
    deprimido: {
        tipo: "penalizacion", peso: 90, stat: "felicidad", umbral: 10, recuperacion: 35,
        minutosParaAplicar: 240, minutosMinimos: 240, acelera: "energia",
        nombre: "Deprimida", descripcion: "Está deprimida",
    },
    incomodo: {
        tipo: "penalizacion", peso: 80, stat: "hambre", umbral: 5, recuperacion: 30,
        minutosParaAplicar: 240, minutosMinimos: 240, acelera: "felicidad",
        nombre: "Hambrienta", descripcion: "Tiene hambre",
    },

    entusiasmado: {
        tipo: "bonificacion", peso: 10, stat: "felicidad", umbral: 90, bloqueadoPor: ["enfermo", "deprimido"],
        nombre: "Entusiasmada", descripcion: "Está muy feliz (+XP al cuidarla)",
    },
    llenito: {
        tipo: "bonificacion", peso: 10, stat: "hambre", umbral: 90, bloqueadoPor: ["incomodo"],
        nombre: "Satisfecha", descripcion: "Está satisfecha (gasta menos energía)",
    },
}
/** Con «Satisfecha» la energía se desgasta a este ritmo. */
const DESGASTE_ENERGIA_LLENITO = 0.75

/** ⚙ Límites. El selector de Discord admite 25 opciones: mascotas + huevos no pueden pasar de ahí. */
const LIMITES = {
    MAX_MASCOTAS: 20,            // mascotas + huevos por personaje
    NOMBRE_MAX: 24,
}

// ─── Huevos ──────────────────────────────────────────────────────────────────

/**
 * ⚙ Crianza de huevos. Un huevo es cualquier objeto cuyo Tipo incluya "Huevo".
 * El tiempo de eclosión sale del propio objeto (`eclosion_horas`, editable desde el dashboard);
 * si no lo trae se usa HORAS_ECLOSION_BASE.
 */
const HUEVO = {
    TIPO_OBJETO: "Huevo",
    HORAS_ECLOSION_BASE: 72,              // 3 días si el objeto no define eclosion_horas
    HORAS_ECLOSION_MIN: 1,
    HORAS_ECLOSION_MAX: 720,

    INCUBADORA: { ID: 52, Region: "TOB-01" },
    INCUBADORA_MULTIPLICADOR: 1.25,       // en incubadora tarda 25% más, a cambio de no cuidarlo
    MAX_SIN_INCUBADORA: 1,                // huevos que un personaje puede cuidar a mano a la vez

    // Cuidado manual: tres barras de 0 a 100 que bajan solas. El «estado total» es su promedio.
    CUIDADOS: {
        limpieza: { accion: "limpiar", etiqueta: "Limpiar", verbo: "Limpias", emoji: "🫧", perdidaPorDia: 48 },
        carino: { accion: "acariciar", etiqueta: "Acariciar", verbo: "Acaricias", emoji: "🤍", perdidaPorDia: 60 },
        calor: { accion: "calentar", etiqueta: "Calentar", verbo: "Calientas", emoji: "🔥", perdidaPorDia: 72 },
    },
    RECUPERA_POR_CUIDADO: 20,             // puntos que sube la barra con cada interacción
    BARRA_LLENA_DESDE: 95,                // desde aquí la barra cuenta como «al 100%» (baja sola cada minuto)
    ESTADO_ROTURA: 10,                    // si el estado total llega a este % el huevo se rompe
    ESTADO_INICIAL: 100,

    COSTO_ENERGIA: 1,                     // energía del personaje por interacción
    MAX_INTERACCIONES_DIA: 15,            // por huevo; se reinicia por fecha (no ventana de 24 h)
    ZONA_HORARIA: "America/Mexico_City",

    // Sobrecuidado: cuidar una barra que ya está llena acorta un poco la eclosión
    SOBRECUIDADO_FRACCION: 0.005,         // 0.5% del tiempo total del huevo por interacción
    SOBRECUIDADO_TOPE: 0.15,              // como mucho se le quita este % del tiempo total

    CALIDAD_INCUBADORA: 70,               // «calidad de crianza» que se anota a un huevo de incubadora
}

/** Rarezas de mascota (claves de modificadoresLv) y cómo se muestran. */
const RAREZAS = {
    Sencilla: { etiqueta: "Sencilla", estrellas: "✦" },
    Brillante: { etiqueta: "Brillante", estrellas: "✦✦" },
    Ancestral: { etiqueta: "Ancestral", estrellas: "✦✦✦" },
    Divina: { etiqueta: "Divina", estrellas: "✦✦✦✦" },
    Estelar: { etiqueta: "Estelar", estrellas: "✦✦✦✦✦" },
}

// Especies (data/petsData.json). Rareza del borrador → rareza de mascota:
// Terrenal → Sencilla · Singular → Brillante · Arcano → Ancestral · Etéreo → Divina · Legendario → Estelar
const E = (id, tipo, rareza, emoji, extra = {}) => ({ id, tipo, rareza, emoji: { name: emoji }, ...extra })
const ESPECIES = {
    SLIMC02: E("SLIMC02", "Slime Común", "Sencilla", "🫧"),
    GOLMC01: E("GOLMC01", "Golem Chatarrero", "Sencilla", "🪨"),
    KITSU01: E("KITSU01", "Kitsune Urbano", "Sencilla", "🦊"),
    GOLMP01: E("GOLMP01", "Golem Pixel", "Brillante", "🧱"),
    KITSB01: E("KITSB01", "Kitsune de Bayas", "Brillante", "🍓"),
    DRACB01: E("DRACB01", "Draco Bibliotecario", "Ancestral", "📚"),
    DRACG01: E("DRACG01", "Draco Gema", "Ancestral", "💎"),
    GRIFT01: E("GRIFT01", "Grifo Tormentoso", "Ancestral", "🌩️"),
    DRACN01: E("DRACN01", "Draco Neón", "Divina", "🐉"),
    KITSI01: E("KITSI01", "Kitsune Ilusorio", "Divina", "🌀"),
    ALEBJ02: E("ALEBJ02", "Alebrije Jaguar-Monarca", "Estelar", "🦋"),
}

/**
 * ⚙ Qué puede nacer de cada huevo: clave "Region:ID" del objeto → lista de { especie, peso }.
 * El sorteo es proporcional al peso. Un huevo sin tabla propia usa `default`.
 * (Tabla inicial de ejemplo: ajústala a tu gusto.)
 */
const TABLAS_HUEVO = {
    // Huevo fragmentado: «un huevo con piedras saliendo de él»
    "TOB-01:336": [
        { especie: "GOLMC01", peso: 45 },
        { especie: "SLIMC02", peso: 22 },
        { especie: "GOLMP01", peso: 20 },
        { especie: "DRACG01", peso: 10 },
        { especie: "DRACN01", peso: 2.5 },
        { especie: "ALEBJ02", peso: 0.5 },
    ],
    default: [
        { especie: "SLIMC02", peso: 30 },
        { especie: "KITSU01", peso: 25 },
        { especie: "GOLMC01", peso: 15 },
        { especie: "KITSB01", peso: 10 },
        { especie: "GOLMP01", peso: 8 },
        { especie: "DRACB01", peso: 4 },
        { especie: "GRIFT01", peso: 4 },
        { especie: "DRACG01", peso: 2 },
        { especie: "KITSI01", peso: 1 },
        { especie: "DRACN01", peso: 0.7 },
        { especie: "ALEBJ02", peso: 0.3 },
    ],
}

const IMAGENES = {
    MASCOTA: "https://i.pinimg.com/736x/88/84/49/8884495fca5c3040940759b4e9098727.jpg",
    HUEVO: "https://i.pinimg.com/736x/88/84/49/8884495fca5c3040940759b4e9098727.jpg",
    CAMBIO: "https://c.tenor.com/D-QwKDFNrLIAAAAC/tenor.gif",
}

module.exports = {
    petConfig, petDesgaste, desgasteEtapa, ETAPAS, modificadoresLv, modifEtapa, pesosEstados,
    PROGRESION, ACCIONES_MASCOTA, SUENO, ESTADOS_MASCOTA, ACELERACION_PENALIZACION, DESGASTE_ENERGIA_LLENITO,
    LIMITES, HUEVO, RAREZAS, ESPECIES, TABLAS_HUEVO, IMAGENES,
}
