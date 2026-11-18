// ─── Contenedores elementales: reglas puras (sin Discord ni base de datos) ───
// El contenedor es el traductor del Alma Desafinada: guarda su maná (carga), se desgasta con el
// daño que recibe su portador y, si se rompe, deja al portador con Golpe, Guardia e ítems. Los hechizos viven en el
// alma: nunca se pierden.
//
// Dónde vive cada dato:
//   · Soul.nucleo.artefactoMagico === true → el alma es desafinada (elección del Despertar).
//   · Soul.nucleo.elementoActivo           → elemento que traduce ahora mismo.
//   · Soul.dominio.equipo[]                → instancia del contenedor (Type "contenedor"):
//       { ID, Region, Type, tipoContenedor, instanciaID, equipado, grado, forma, diseno,
//         durabilidad (puntos actuales), carga (maná almacenado), reparaciones: [ms] }
//   La durabilidad es la misma propiedad genérica de functions/Objetos/durabilidad.js:
//   el máximo está en la definición del objeto y los puntos actuales en la instancia.

const crypto = require("crypto")
const {
    BANDERAS, TIPOS, ETAPAS, DURABILIDAD, TRADUCCION, REPARACION, ARTESANO, UI,
} = require("./config")
const { ELEMENTOS } = require("../Duelo/hechizos/config")
const { normalizarElemento, esUniversal } = require("../Duelo/hechizos/elementos")
const { efectosActivos } = require("../Duelo/hechizos/estados")

const ELEMENTOS_JUGABLES = Object.freeze(Object.values(ELEMENTOS).filter(e => e !== ELEMENTOS.NEUTRO))
const DIA_MS = 24 * 60 * 60 * 1000

const contenedoresActivos = () => BANDERAS.CONTENEDORES_ACTIVOS === true

// ─── Instancias ──────────────────────────────────────────────────────────────

/** Tipo de contenedor ('cortesia' | 'artesanal') de una entrada de equipo, o null si no lo es. */
function tipoDeEntrada(entrada) {
    if (!entrada) return null
    if (entrada.tipoContenedor && TIPOS[entrada.tipoContenedor]) return entrada.tipoContenedor
    const t = String(entrada.Type ?? entrada.tipo ?? "").toLowerCase()
    for (const [clave, def] of Object.entries(TIPOS)) {
        if (Number(entrada.ID) === def.objeto.ID && (!entrada.Region || entrada.Region === def.objeto.Region)) return clave
    }
    return t === "contenedor" ? "cortesia" : null
}

const esContenedor = (entrada) => tipoDeEntrada(entrada) !== null

function durabilidadMax(entrada) {
    return TIPOS[tipoDeEntrada(entrada)]?.durabilidad ?? 0
}

/** Puntos actuales (sin dato = nuevo), siempre entre 0 y el máximo. */
function durabilidadActual(entrada) {
    const max = durabilidadMax(entrada)
    const actual = Number(entrada?.durabilidad)
    return Number.isFinite(actual) ? Math.max(0, Math.min(actual, max)) : max
}

const estaRoto = (entrada) => durabilidadActual(entrada) <= 0

/** Capacidad de maná: la curva del personaje × el factor del cristal. */
function capacidad(entrada, manaMaxBase) {
    const factor = TIPOS[tipoDeEntrada(entrada)]?.capacidadFactor ?? 0
    return Math.floor((Number(manaMaxBase) || 0) * factor)
}

/** Etapa visible a partir de { actual, max }. Se guarda el número; se muestra la etapa. */
function etapaDe({ actual, max }) {
    if (!(actual > 0) || !(max > 0)) return ETAPAS.ROTO
    const r = actual / max
    if (r > DURABILIDAD.UMBRAL_INTACTO) return ETAPAS.INTACTO
    return r > DURABILIDAD.UMBRAL_FISURADO ? ETAPAS.FISURADO : ETAPAS.CRITICO
}

const etapaEntrada = (entrada) => etapaDe({ actual: durabilidadActual(entrada), max: durabilidadMax(entrada) })
const etapaContenedor = (c) => etapaDe(c?.durabilidad ?? { actual: 0, max: 0 })

/**
 * Contenedor en uso entre el equipo del alma: el marcado como equipado; si ninguno lo está,
 * el primero que funcione.
 */
function entradaEquipada(equipo = []) {
    const todos = (equipo || []).filter(esContenedor)
    return todos.find(e => e.equipado === true) ?? todos.find(e => e.equipado !== false && !estaRoto(e)) ?? todos.find(e => e.equipado !== false) ?? null
}

/** Instancia nueva, lista para guardarse en Soul.dominio.equipo. Sale con la carga llena. */
function crearInstancia(tipo, { manaMaxBase = 0, forma = null, diseno = null, ahora = Date.now() } = {}) {
    const def = TIPOS[tipo]
    if (!def) throw new Error(`[Contenedores] Tipo desconocido: ${tipo}`)
    const entrada = {
        ID: def.objeto.ID,
        Region: def.objeto.Region,
        Type: "contenedor",
        tipoContenedor: tipo,
        instanciaID: `cont_${crypto.randomBytes(8).toString("hex")}`,
        equipado: true,
        grado: def.grado,                     // reservado (post-lanzamiento)
        forma: def.personalizable ? (forma || ARTESANO.FORMAS[0]) : def.forma,
        diseno: def.personalizable ? { nombre: diseno?.nombre || "", descripcion: diseno?.descripcion || "" } : { nombre: "", descripcion: "" },
        durabilidad: def.durabilidad,
        carga: 0,
        reparaciones: [],
        creado: ahora,
    }
    entrada.carga = capacidad(entrada, manaMaxBase)
    return entrada
}

function nombreVisible(entrada) {
    return entrada?.diseno?.nombre || TIPOS[tipoDeEntrada(entrada)]?.nombre || "Contenedor"
}

/**
 * Vista de combate de una instancia (la forma que usa el documento: durabilidad.actual,
 * esencia.carga). Guarda el estado inicial para los duelos, que no desgastan de verdad (VI.F).
 */
function aCombate(entrada, manaMaxBase) {
    if (!entrada) return null
    const tipo = tipoDeEntrada(entrada)
    const max = durabilidadMax(entrada)
    const actual = durabilidadActual(entrada)
    const cap = capacidad(entrada, manaMaxBase)
    const carga = actual > 0 ? Math.max(0, Math.min(Number(entrada.carga) || 0, cap)) : 0
    return {
        instanciaID: entrada.instanciaID ?? null,
        ID: entrada.ID, Region: entrada.Region,
        tipo, nombre: nombreVisible(entrada), forma: entrada.forma ?? null,
        esRespaldo: TIPOS[tipo].esRespaldo, grado: entrada.grado ?? 1,
        capacidadFactor: TIPOS[tipo].capacidadFactor, capacidad: cap,
        durabilidad: { actual, max },
        esencia: { carga },
        inicial: { durabilidad: actual, carga },
    }
}

// ─── Entrega y migración ─────────────────────────────────────────────────────

/** Equipo con una instancia nueva equipada: los respaldos anteriores se van y el resto se guarda. */
function equipoCon(equipo, nueva) {
    return [
        ...(equipo || [])
            .filter(e => tipoDeEntrada(e) !== "cortesia")
            .map(e => (esContenedor(e) ? { ...e, equipado: false } : e)),
        nueva,
    ]
}

/** Entrega del primer contenedor (Despertar y migración). No cuenta para el límite diario. */
function entregaInicial(soul, elemento) {
    const nueva = crearInstancia("cortesia", { manaMaxBase: soul?.stats?.manaMax })
    return {
        entrada: nueva,
        set: {
            "dominio.equipo": equipoCon(soul?.dominio?.equipo, nueva),
            "nucleo.elementoActivo": elementoActivoDeAlma({ nucleo: { Elemento: elemento ?? soul?.nucleo?.Elemento, elementoActivo: soul?.nucleo?.elementoActivo } }),
        },
    }
}

/**
 * Migración de un alma que ya había elegido ser desafinada antes de que existieran los
 * contenedores: recibe un Contenedor de Cortesía, su elemento pasa a ser el activo y su maná se
 * muda a la carga (limitado a la capacidad nueva). No toca hechizos ni el resto del equipo.
 * @returns {null | { entrada: Object, set: Object }} null si no hay nada que migrar
 */
function planMigracion(soul) {
    if (!esAlmaDesafinada(soul)) return null
    if ((soul?.dominio?.equipo || []).some(esContenedor)) return null
    const plan = entregaInicial(soul)
    plan.entrada.carga = Math.max(0, Math.min(Number(soul?.nucleo?.Mana) || 0, capacidad(plan.entrada, soul?.stats?.manaMax)))
    return plan
}

// ─── Alma (fuera de combate) ─────────────────────────────────────────────────

/** ¿El alma eligió ser desafinada? (independiente de la bandera) */
const esAlmaDesafinada = (soul) => soul?.nucleo?.artefactoMagico === true

/** Maná de un alma tal como debe mostrarse y gastarse: en desafinados vive en el contenedor. */
function manaDeAlma(soul) {
    const base = Number(soul?.stats?.manaMax) || 0
    if (!contenedoresActivos() || !esAlmaDesafinada(soul)) {
        return { desafinado: false, actual: Number(soul?.nucleo?.Mana) || 0, max: base, entrada: null }
    }
    const entrada = entradaEquipada(soul?.dominio?.equipo)
    const c = aCombate(entrada, base)
    return { desafinado: true, actual: c?.esencia.carga ?? 0, max: c?.capacidad ?? 0, entrada }
}

function elementoActivoDeAlma(soul) {
    return normalizarElemento(soul?.nucleo?.elementoActivo ?? soul?.nucleo?.Elemento)
}

// ─── Combate ─────────────────────────────────────────────────────────────────

/** ¿El combatiente depende de un contenedor? (alma desafinada y sistema encendido) */
const esDesafinado = (pj) => Boolean(pj && !pj.isNPC && pj.desafinado === true && contenedoresActivos())

const contenedorFunciona = (pj) => Boolean(pj?.contenedor && pj.contenedor.durabilidad.actual > 0)

function fallo(razon, motivo) {
    return { ok: false, razon: [razon], motivo }
}

/**
 * Validación del contenedor para un casteo. La llama `evaluarCasteo` antes de mirar las vías.
 * Golpe, Guardia y cualquier cosa sin elemento ni maná no necesitan contenedor.
 * @param {Object} pj
 * @param {Object} hechizo - normalizado
 * @param {{ costoMana?: number, ignorarKit?: boolean }} [opciones]
 */
function evaluarContenedor(pj, hechizo, { costoMana = 0, ignorarKit = false } = {}) {
    if (!esDesafinado(pj) || hechizo?._accion) return { ok: true }

    const universal = esUniversal(hechizo)
    if (universal && !(costoMana > 0)) return { ok: true }

    const c = pj.contenedor
    if (!c) return fallo("contenedor_roto", "no llevas un contenedor")
    if (c.durabilidad.actual <= 0) return fallo("contenedor_roto", "tu contenedor está roto")
    if (!universal && !ignorarKit && normalizarElemento(hechizo.Elemento) !== normalizarElemento(pj.elementoActivo)) {
        return fallo("elemento_incorrecto", `no es de tu elemento activo (${normalizarElemento(pj.elementoActivo)})`)
    }

    const etapa = etapaContenedor(c)
    return {
        ok: true, etapa,
        modProbabilidad: DURABILIDAD.MOD_PROBABILIDAD[etapa] ?? 0,
        tiempoExtra: TRADUCCION.LATENCIA[hechizo.Escalon ?? 1] ?? 0,
        factorVida: TRADUCCION.FACTOR_COSTO_VIDA,
    }
}

/**
 * Cambio de elemento activo. No es un hechizo: es una acción. En combate consume el turno y a
 * los demás solo les llega un mensaje de ambiente; nunca toca la carga.
 */
function cambiarElementoActivo(pj, nuevo, { enCombate = false } = {}) {
    if (!esDesafinado(pj)) return fallo("no_desafinado", "solo un Alma Desafinada cambia de elemento")
    const elemento = normalizarElemento(nuevo)
    if (!ELEMENTOS_JUGABLES.includes(elemento)) return fallo("elemento_invalido", "ese elemento no existe")
    if (elemento === normalizarElemento(pj.elementoActivo)) return fallo("mismo_elemento", `ya traduces ${elemento}`)
    if (!contenedorFunciona(pj)) return fallo("contenedor_roto", "necesitas un contenedor que funcione")
    if (enCombate && efectosActivos(pj).some(a => a.familia === "total")) return fallo("estasis", "en Estasis")

    pj.elementoActivo = elemento
    const consumeTurno = enCombate && TRADUCCION.CAMBIO_CONSUME_TURNO
    return {
        ok: true, elemento, consumeTurno,
        mensajePublico: enCombate ? TRADUCCION.MENSAJE_CAMBIO(pj.Nombre) : null,
    }
}

/** ¿Tiene un estado que hace vacilar la traducción? (Miedo, Confusión o Lentitud) */
function traduccionSensible(pj) {
    return esDesafinado(pj) && efectosActivos(pj).some(a => a.degrada || a.lentitud)
}

/** La durabilidad llegó a 0: el maná se escapa. El contenedor no desaparece ni se pierde su diseño. */
function romperContenedor(pj, c = pj?.contenedor) {
    if (!c) return
    c.durabilidad.actual = 0
    c.esencia.carga = 0
}

/** Vida máxima del portador (el accesor que usa el combate). */
const vidaMaxima = (pj) => Number(pj?.stats?.hpMax) || 0

/**
 * Puntos de durabilidad que cuesta un daño efectivo, proporcional a la vida máxima para que escale
 * con el personaje. Decimal: solo se redondea al mostrarlo.
 */
function calcularDesgastePorDano(c, danoEfectivo, vidaMax, tipo = "fisico") {
    if (!c || !(danoEfectivo > 0) || !(vidaMax > 0)) return 0
    const fraccion = danoEfectivo / vidaMax
    return c.durabilidad.max * fraccion * DURABILIDAD.FACTOR_DANO * (DURABILIDAD.MULT_TIPO_DANO[tipo] ?? 1)
}

/**
 * El contenedor es un objeto que el portador lleva encima: lo que lo golpea a él, golpea al cristal.
 * Se llama desde el punto central de daño (Combatiente.aplicarDaño) con el daño EFECTIVO: ya
 * descontados escudos, Estasis y el piso de Tregua. Curar no repara. La ruptura ocurre una sola
 * vez: con la durabilidad en 0 ya no entra aquí.
 * @param {Object} pj
 * @param {number} danoEfectivo - vida que realmente perdió
 * @param {"fisico"|"magico"|"disonancia"} [tipo]
 * @returns {{ aplica: boolean, desgaste?: number, roto?: boolean, etapaAntes?: string, etapa?: string }}
 */
function desgastarPorDano(pj, danoEfectivo, tipo = "fisico") {
    const c = pj?.contenedor
    if (!esDesafinado(pj) || !c || !(danoEfectivo > 0) || !(c.durabilidad.actual > 0)) return { aplica: false }

    const desgaste = calcularDesgastePorDano(c, danoEfectivo, vidaMaxima(pj), tipo)
    if (!(desgaste > 0)) return { aplica: false }
    const etapaAntes = etapaContenedor(c)
    c.durabilidad.actual = Math.max(0, c.durabilidad.actual - desgaste)
    if (c.durabilidad.actual < DURABILIDAD.RESIDUO_ROTO) c.durabilidad.actual = 0   // sin restos de coma flotante
    const roto = c.durabilidad.actual === 0
    if (roto) romperContenedor(pj, c)
    return { aplica: true, desgaste, roto, etapaAntes, etapa: etapaContenedor(c) }
}

/** Duelos (VI.F): al terminar, el contenedor vuelve a la durabilidad y la carga del inicio. */
function restaurarInicial(pj) {
    const c = pj?.contenedor
    if (!c?.inicial) return
    c.durabilidad.actual = c.inicial.durabilidad
    c.esencia.carga = c.inicial.carga
}

// ─── Reparación ──────────────────────────────────────────────────────────────

function reparacionesRecientes(entrada, ahora = Date.now()) {
    const desde = ahora - REPARACION.VENTANA_DIAS * DIA_MS
    return (entrada?.reparaciones || []).filter(t => Number(t) > desde).length
}

/** Costo en Lumens de reparar por completo en el Taller (un Roto paga el reemplazo del cristal). */
function costoTaller(entrada, ahora = Date.now()) {
    const max = durabilidadMax(entrada)
    const actual = durabilidadActual(entrada)
    if (!(max > 0)) return 0
    let costo = REPARACION.BASE_TALLER
        * (1 + REPARACION.FACTOR_DANIO * (1 - actual / max))
        * (1 + REPARACION.RECARGO_FRECUENCIA * reparacionesRecientes(entrada, ahora))
    if (actual <= 0) costo *= REPARACION.RECARGO_ROTO
    return Math.ceil(costo)
}

// ─── Texto libre del diseño ──────────────────────────────────────────────────

/** Texto de jugador seguro para Discord: sin menciones, sin markdown activo, en una línea y acotado. */
function sanitizarTexto(texto, max) {
    const limpio = String(texto ?? "")
        .replace(/<(?:@[!&]?|#)\d+>/g, "")                 // menciones de usuario, rol y canal
        .replace(/<a?:\w+:\d+>/g, "")                      // emojis personalizados
        .replace(/@(everyone|here)/gi, "$1")
        .replace(/@/g, "")
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/[​-‏‪-‮⁠-⁤﻿]/g, "")   // invisibles y control de dirección
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
        .trim()
    return limpio.replace(/([\\*_~`|>#\[\]()<>-])/g, "\\$1")
}

/** Valida forma y diseño del contenedor artesanal. */
function sanitizarDiseno({ forma, nombre, descripcion } = {}) {
    const f = sanitizarTexto(forma, ARTESANO.FORMA_MAX).toLowerCase()
    const n = sanitizarTexto(nombre, ARTESANO.NOMBRE_MAX)
    const d = sanitizarTexto(descripcion, ARTESANO.DESCRIPCION_MAX)
    if (!f) return { ok: false, motivo: "forma_vacia" }
    if (!n) return { ok: false, motivo: "nombre_vacio" }
    return { ok: true, forma: f, diseno: { nombre: n, descripcion: d } }
}

// ─── Presentación ────────────────────────────────────────────────────────────

/** Barra de durabilidad + etapa. Solo para el portador: nunca en vistas públicas. */
function barraDurabilidad({ actual, max }, largo = UI.BARRA_LARGO) {
    const etapa = etapaDe({ actual, max })
    const llenos = max > 0 ? Math.max(actual > 0 ? 1 : 0, Math.round((actual / max) * largo)) : 0
    return `${UI.BARRA.lleno.repeat(llenos)}${UI.BARRA.vacio.repeat(Math.max(0, largo - llenos))} ${UI.ICONO_ETAPA[etapa] ?? ""} ${etapa}`
}

module.exports = {
    ELEMENTOS_JUGABLES,
    contenedoresActivos,
    tipoDeEntrada, esContenedor, durabilidadMax, durabilidadActual, estaRoto, capacidad,
    etapaDe, etapaEntrada, etapaContenedor, entradaEquipada, crearInstancia, nombreVisible, aCombate,
    equipoCon, entregaInicial, planMigracion,
    esAlmaDesafinada, manaDeAlma, elementoActivoDeAlma,
    esDesafinado, contenedorFunciona, evaluarContenedor, cambiarElementoActivo,
    traduccionSensible, calcularDesgastePorDano, desgastarPorDano, romperContenedor, restaurarInicial,
    reparacionesRecientes, costoTaller,
    sanitizarTexto, sanitizarDiseno, barraDurabilidad,
}
