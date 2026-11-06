// ─────────────────────────────────────────────────────────────────────────────
// Rangos de amistad entre personajes.
//
// Una sola línea ordenada por `desde` (sin huecos ni prioridades): el rango es
// el último cuyo `desde` ≤ puntos. Los umbrales son los números ORIGINALES del
// sistema anterior (/rol relacion) multiplicados por ESCALA y redondeados.
//
// ESCALA depende del tope diario de ganancia:
//     ESCALA = (DIAS_OBJETIVO × TOPE_DIARIO.ganancia) / 6000
// 6000 era el umbral original de Almas Gemelas. Con 90 días y tope 30 → 0.45:
// Almas Gemelas pide 2700 puntos, es decir, 90 días mínimos jugando al tope.
// Se calcula sola: si cambia el tope en config/amistad.js, los rangos se mueven.
//
// TODO(decisión): revisar nombres y descripciones. Los positivos y la variante
// "enemigo" de los negativos son los del sistema viejo; se renombraron dos que
// usaban "Compañeros" (palabra reservada para el pacto) y las variantes "rival"
// son nuevas.
// ─────────────────────────────────────────────────────────────────────────────
const { TOPE_DIARIO } = require("./amistad")

const UMBRAL_ORIGINAL_MAXIMO = 6000                 // Almas Gemelas en el sistema viejo
const DIAS_OBJETIVO = 90                            // días mínimos al tope para el rango máximo // ⚙
const ESCALA = (DIAS_OBJETIVO * TOPE_DIARIO.ganancia) / UMBRAL_ORIGINAL_MAXIMO   // 0.45 con tope 30

// Con puntos < 0: rivalidad ≥ RIVALIDAD_ALTA → variante rival (juguetona);
// si no → enemigo. Se decide al leer, no se guarda.
const RIVALIDAD_ALTA = 10                                                           // ⚙ PROVISIONAL

// Histéresis: un rango POSITIVO no se pierde hasta caer este porcentaje por
// debajo de su umbral. Así un mal día no te baja de "Mejores Amigos".
const HISTERESIS = 0.10                                                             // ⚙

// ─── Rangos netos: cuánta historia hay detrás de un saldo bajo ───────────────
// El neto solo no distingue "nunca pasó nada" de "pasó de todo y quedó a mano".
// Con los contadores BRUTOS de por vida (ganadosTotal / perdidosTotal) hay tres
// niveles para un neto bajo:
//   Ninguna o casi ninguna historia     → Desconocidos / Extraños / Neutro
//   Moderada en AMBOS lados (≥40 y ≥40) → Equilibrio Frágil
//   Mucha en AMBOS lados (≥200 y ≥200)  → Recuerdos Confusos
// Por qué se exigen ambos lados: alguien con 35 ganados y 5 perdidos tampoco es
// "desconocido", pero llamarlo "Equilibrio Frágil" sería falso: la balanza no
// estuvo en el medio, solo se inclinó. Hace falta cariño Y roce para que el
// nombre sea verdad (la misma lógica de "Recuerdos confusos" en la lista vieja).

// "Recuerdos Confusos": mucha historia en ambos lados con saldo neto bajo.
// Sobreescribe a cualquier rango base mientras se cumpla.
const RECUERDOS_CONFUSOS = {
    ganadosMin: 200,                                                                // ⚙
    perdidosMin: 200,                                                               // ⚙
    netoMaxAbs: 225,        // |puntos| por debajo de "Amistad" (500 × ESCALA)      // ⚙
}

// "Equilibrio Frágil": versión chica de lo anterior, SOLO sobre los rangos "sin
// vínculo" (Desconocidos / Extraños / Neutro). Un roce suelto (−6) es ruido, no
// historia: por eso pide un mínimo en cada lado.
const EQUILIBRIO_FRAGIL = {
    ganadosMin: 40,                                                                 // ⚙
    perdidosMin: 40,                                                                // ⚙
}

// tier: alimenta la privacidad ("Solo amigos" / "Solo mejores amigos").
//   conocido    → por debajo de "Amistad"
//   amigo       → desde "Amistad"
//   mejor_amigo → desde "Mejores Amigos"
// Los negativos siempre son tier "conocido" para la privacidad.
const LISTA = [
    // ── Negativos (desde = límite inferior original) ─────────────────────────
    { id: "eterno_odio", original: -Infinity,
      rival:   { nombre: "Rivales de Leyenda", descripcion: "Nadie recuerda cómo empezó, pero todos esperan el próximo duelo" },
      enemigo: { nombre: "Eterno Odio", descripcion: "Su nivel de odio es indescriptible" } },
    { id: "vendetta", original: -9999,
      rival:   { nombre: "Rivalidad Legendaria", descripcion: "Generaciones enteras de alumnos han apostado por uno u otro" },
      enemigo: { nombre: "Vendetta Ancestral", descripcion: "Su odio se transmite a través de las generaciones" } },
    { id: "nemesis", original: -5999,
      rival:   { nombre: "Eternos Contrincantes", descripcion: "Cada uno es la meta del otro" },
      enemigo: { nombre: "Némesis", descripcion: "Has encontrado a tu alma opuesta" } },
    { id: "sombras_opuestas", original: -4999,
      rival:   { nombre: "Fuerzas Opuestas", descripcion: "Chocan siempre, y el instituto entero se detiene a mirar" },
      enemigo: { nombre: "Sombras Opuestas", descripcion: "Su odio es grande" } },
    { id: "enemigos_instituto", original: -2999,
      rival:   { nombre: "Rivales del Instituto", descripcion: "Todo el instituto conoce su competencia" },
      enemigo: { nombre: "Enemigos del Instituto", descripcion: "Han pasado suficientes cosas negativas como para tener este título" } },
    { id: "rivales_academicos", original: -1499,
      rival:   { nombre: "Rivales Académicos", descripcion: "Seguramente su ego los consume en el combate" },
      enemigo: { nombre: "Choque de Egos", descripcion: "Ninguno piensa ceder ni un poquito" } },
    { id: "antipatia", original: -499,
      rival:   { nombre: "Pique Constante", descripcion: "Se buscan solo para fastidiarse un poquito" },
      enemigo: { nombre: "Antipatía", descripcion: "Lo contrario a la empatía" } },
    { id: "tension_leve", original: -99,
      rival:   { nombre: "Pique Amistoso", descripcion: "Un empujoncito aquí, una broma allá" },
      enemigo: { nombre: "Tensión Leve", descripcion: "De las cosas pequeñas a lo grande" } },

    // ── Neutros y positivos ─────────────────────────────────────────────────
    { id: "desconocidos", sinVinculo: true, original: -9, tier: "conocido", nombre: "Desconocidos", descripcion: "Sin ningún vínculo específico. Un paso antes de una posible amistad o enemistad" },
    { id: "extranos", sinVinculo: true, original: 10, tier: "conocido", nombre: "Extraños", descripcion: "Posiblemente se conozcan por terceras personas" },
    { id: "neutro", sinVinculo: true, original: 50, tier: "conocido", nombre: "Neutro", descripcion: "No se conocen lo suficiente para definir una relación" },
    { id: "conocidos_instituto", original: 100, tier: "conocido", nombre: "Conocidos del Instituto", descripcion: "Alguna vez se toparon en el instituto" },
    // Antes "Compañeros de clase": "Compañero" queda reservado para el pacto.
    { id: "mismo_salon", original: 250, tier: "conocido", nombre: "Del Mismo Salón", descripcion: "Posiblemente se conocieron porque van en el mismo salón" },
    { id: "amistad", original: 500, tier: "amigo", nombre: "Amistad", descripcion: "Ya cuentan el uno con el otro" },
    { id: "amistad_cercana", original: 1000, tier: "amigo", nombre: "Amistad Cercana", descripcion: "Alguien en quien puedes confiar" },
    { id: "amistad_sincera", original: 1500, tier: "amigo", nombre: "Amistad Sincera", descripcion: "En las buenas y en las malas" },
    { id: "mejores_amigos", original: 2000, tier: "mejor_amigo", nombre: "Mejores Amigos", descripcion: "Un vínculo mágico inquebrantable" },
    { id: "aliados_magicos", original: 3000, tier: "mejor_amigo", nombre: "Aliados Mágicos", descripcion: "No solo te acompaña en la vida, también te apoya" },
    // Antes "Compañeros de aventura".
    { id: "inseparables", original: 4000, tier: "mejor_amigo", nombre: "Inseparables de Aventura", descripcion: "Para quienes se acompañan mutuamente a donde sea" },
    { id: "hermandad_eterna", original: 5000, tier: "mejor_amigo", nombre: "Hermandad Eterna", descripcion: "Un vínculo forjado en mil batallas" },
    { id: "almas_gemelas", original: 6000, tier: "mejor_amigo", nombre: "Almas Gemelas", descripcion: "Se han encontrado, luego de tanto tiempo..." },
]

const RANGOS = LISTA.map(r => ({
    ...r,
    desde: Number.isFinite(r.original) ? Math.round(r.original * ESCALA) : -Infinity,
    negativo: !!r.rival,
}))
const POR_ID = Object.fromEntries(RANGOS.map((r, i) => [r.id, { ...r, i }]))

const ESPECIAL_RECUERDOS = {
    id: "recuerdos_confusos",
    nombre: "Recuerdos Confusos",
    descripcion: "A veces los conflictos nublan la vista y no dejan ver lo que alguna vez significó esa amistad",
}

const ESPECIAL_EQUILIBRIO = {
    id: "equilibrio_fragil",
    nombre: "Equilibrio Frágil",
    descripcion: "Hubo de todo entre ellos, y la balanza terminó justo en el medio",
}

const IDS_MEJOR_AMIGO = RANGOS.filter(r => r.tier === "mejor_amigo").map(r => r.id)
// Rango más alto al que se puede llegar sin ser "mejor_amigo" (límite de Mejores amigos).
const TECHO_SIN_MEJOR_AMIGO = [...RANGOS].reverse().find(r => r.tier === "amigo").id

/** Índice del rango base que corresponde a `puntos`, sin histéresis. */
const indicePorPuntos = (puntos) => RANGOS.findLastIndex(r => puntos >= r.desde)

/**
 * Rango base (id) con histéresis respecto al último guardado.
 * Solo protege rangos positivos: los negativos se recalculan siempre.
 * @param {number} puntos
 * @param {string} [anteriorId]  rangoBaseId guardado
 * @param {string} [techoId]     tope impuesto (límite de Mejores amigos)
 */
function baseIdDe(puntos, anteriorId, techoId) {
    let i = indicePorPuntos(puntos)
    const prev = POR_ID[anteriorId]
    if (prev && prev.i > i && prev.desde > 0 && puntos >= prev.desde * (1 - HISTERESIS)) i = prev.i
    const techo = POR_ID[techoId]
    if (techo && i > techo.i) i = techo.i
    return RANGOS[i].id
}

/**
 * @param {object} pareja  documento de `amistades` (o null). Usa puntos (ya
 *   enfriados si corresponde), rivalidad, rangoBaseId, rangoTope, ganadosTotal, perdidosTotal.
 * @returns {{ nombre, descripcion, tier, estado, frac, siguiente, baseId }}
 *   estado: "conocido" | "amigo" | "mejor_amigo" | "rival" | "enemigo" | "especial"
 *   frac:   avance 0–1 hacia el siguiente rango, o null (máximo, negativos, especial)
 */
function rangoDe(pareja) {
    const puntos = pareja?.puntos || 0
    const rivalidad = pareja?.rivalidad || 0
    const baseId = baseIdDe(puntos, pareja?.rangoBaseId, pareja?.rangoTope)
    const base = POR_ID[baseId]

    const rc = RECUERDOS_CONFUSOS
    if ((pareja?.ganadosTotal || 0) >= rc.ganadosMin && (pareja?.perdidosTotal || 0) >= rc.perdidosMin && Math.abs(puntos) < rc.netoMaxAbs) {
        return { ...ESPECIAL_RECUERDOS, tier: "conocido", estado: "especial", frac: null, siguiente: null, baseId }
    }

    if (base.negativo) {
        const variante = rivalidad >= RIVALIDAD_ALTA ? "rival" : "enemigo"
        // TODO(decisión): ¿barra en negativos? Hoy no: no se "progresa" hacia el odio.
        return { ...base[variante], tier: "conocido", estado: variante, frac: null, siguiente: null, baseId }
    }

    // Rango "sin vínculo" pero con historia moderada en ambos lados: ya no son
    // desconocidos. Se cambia el nombre (y el color, vía estado "especial"); el
    // tier y el avance hacia el siguiente rango se conservan.
    const eq = EQUILIBRIO_FRAGIL
    const equilibrio = base.sinVinculo && (pareja?.ganadosTotal || 0) >= eq.ganadosMin && (pareja?.perdidosTotal || 0) >= eq.perdidosMin

    const sig = RANGOS[base.i + 1] || null
    // "Desconocidos" empieza un poquito bajo cero: su barra se mide desde 0, para
    // que una pareja nueva no aparezca ya a medio camino.
    const desde = Math.max(0, base.desde)
    const frac = sig ? Math.min(1, Math.max(0, (puntos - desde) / (sig.desde - desde))) : null
    return {
        nombre: equilibrio ? ESPECIAL_EQUILIBRIO.nombre : base.nombre,
        descripcion: equilibrio ? ESPECIAL_EQUILIBRIO.descripcion : base.descripcion,
        tier: base.tier,
        estado: equilibrio ? "especial" : base.tier,
        frac,
        siguiente: sig ? sig.nombre : null,
        baseId,
    }
}

module.exports = {
    ESCALA,
    DIAS_OBJETIVO,
    RIVALIDAD_ALTA,
    HISTERESIS,
    RECUERDOS_CONFUSOS,
    EQUILIBRIO_FRAGIL,
    RANGOS,
    IDS_MEJOR_AMIGO,
    TECHO_SIN_MEJOR_AMIGO,
    baseIdDe,
    rangoDe,
}
