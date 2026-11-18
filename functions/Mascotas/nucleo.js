// functions/Mascotas/nucleo.js
// Reglas de mascotas y huevos. Sin base de datos ni Discord: todo son funciones puras sobre los
// documentos de la colección Mascotas, así que se prueban solas (tests/mascotas).
//
// Una mascota y un huevo son el mismo documento: el huevo (etapa "Huevo", datos en `huevo`) se
// convierte en mascota al eclosionar. Todo pertenece a un PERSONAJE (`characterID` = Personajes._id).
//
// El tiempo no corre con temporizadores: cada documento guarda cuándo se miró por última vez y al
// leerlo se calcula lo que pasó desde entonces (desgaste, rotura, eclosión).

const crypto = require("crypto")
const { DateTime } = require("luxon")
const C = require("../../config/configPets")

const MINUTO = 60_000
const HORA = 3_600_000
const DIA = 86_400_000
const ETAPA_HUEVO = "Huevo"

const limitar = (n, min, max) => Math.max(min, Math.min(max, n))
const redondear = (n) => Math.round(n * 100) / 100
const copiar = (o) => JSON.parse(JSON.stringify(o))

/** ID corto sin guiones (los customId se separan con "-"). */
const nuevoId = () => crypto.randomBytes(6).toString("hex")

/** Fecha local (YYYY-MM-DD): los límites diarios se reinician por fecha, no por ventana de 24 h. */
const fechaLocal = (ahora = Date.now()) => DateTime.fromMillis(ahora).setZone(C.HUEVO.ZONA_HORARIA).toISODate()

const esHuevo = (doc) => doc?.etapa === ETAPA_HUEVO
const tiposDe = (def) => (Array.isArray(def?.Tipo) ? def.Tipo : [def?.Tipo]).filter(Boolean)
/** Un huevo es cualquier objeto cuyo Tipo incluya "Huevo". */
const esObjetoHuevo = (def) => tiposDe(def).includes(C.HUEVO.TIPO_OBJETO)
const esIncubadora = (obj) => Number(obj?.ID) === C.HUEVO.INCUBADORA.ID && (!obj?.Region || obj.Region === C.HUEVO.INCUBADORA.Region)

// ─── Mascotas: necesidades ───────────────────────────────────────────────────

const STATS = Object.keys(C.petDesgaste)
const maximoDe = (stat) => C.petConfig[`${stat}std`]
const valorDe = (pet, stat) => limitar(Number(pet?.[stat] ?? maximoDe(stat)) || 0, 0, maximoDe(stat))
const porcentajeDe = (pet, stat) => (100 * valorDe(pet, stat)) / maximoDe(stat)
const estaDormida = (pet) => Boolean(pet?.penalizaciones?.dormido)

/** Bonificaciones activas ahora mismo (no se guardan: salen de las necesidades). */
function bonificaciones(pet) {
    const activas = []
    for (const [clave, e] of Object.entries(C.ESTADOS_MASCOTA)) {
        if (e.tipo !== "bonificacion") continue
        if ((e.bloqueadoPor || []).some(p => pet.penalizaciones?.[p])) continue
        if (porcentajeDe(pet, e.stat) >= e.umbral) activas.push(clave)
    }
    return activas
}

/** Puntos por minuto que pierde una necesidad, con etapa, penalizaciones y bonificaciones. */
function ritmoDesgaste(pet, stat) {
    const { intervalo, desgasteIntervalo } = C.petDesgaste[stat]
    let ritmo = (desgasteIntervalo + (C.desgasteEtapa[pet.etapa] ?? 0)) / intervalo
    for (const [clave, e] of Object.entries(C.ESTADOS_MASCOTA)) {
        if (e.tipo === "penalizacion" && e.acelera === stat && pet.penalizaciones?.[clave]) ritmo *= C.ACELERACION_PENALIZACION
    }
    if (stat === "energia" && bonificaciones(pet).includes("llenito")) ritmo *= C.DESGASTE_ENERGIA_LLENITO
    return ritmo
}

/**
 * Pone la mascota al día: desgaste desde la última vez, sueño y penalizaciones.
 * @returns {{ pet: Object, cambio: boolean, desperto: boolean }} copia actualizada (no toca el original)
 */
function avanzarMascota(original, ahora = Date.now()) {
    const pet = copiar(original)
    pet.penalizaciones = pet.penalizaciones && !Array.isArray(pet.penalizaciones) ? pet.penalizaciones : {}
    pet.critico = pet.critico || {}
    const desde = Number(pet.lastSeen) || ahora
    const minutos = Math.max(0, (ahora - desde) / MINUTO)
    let desperto = false

    const antes = Object.fromEntries(STATS.map(s => [s, valorDe(pet, s)]))
    const ritmos = Object.fromEntries(STATS.map(s => [s, ritmoDesgaste(pet, s)]))

    for (const stat of STATS) {
        let valor = antes[stat]
        let minutosDesgaste = minutos
        if (stat === "energia" && estaDormida(pet)) {
            // Dormida recupera energía; al llenarse despierta sola y vuelve a gastar
            const hastaLlena = (maximoDe(stat) - valor) / C.SUENO.RECUPERA_POR_MINUTO
            const dormida = Math.min(minutos, hastaLlena)
            valor += dormida * C.SUENO.RECUPERA_POR_MINUTO
            minutosDesgaste = minutos - dormida
            if (valor >= maximoDe(stat) - 0.001) {
                delete pet.penalizaciones.dormido
                desperto = true
            }
        }
        valor = limitar(valor - ritmos[stat] * minutosDesgaste, 0, maximoDe(stat))
        pet[stat] = redondear(valor)

        // Desde cuándo está en zona crítica (para las penalizaciones que tardan en aplicarse)
        const umbrales = Object.values(C.ESTADOS_MASCOTA).filter(e => e.tipo === "penalizacion" && e.stat === stat)
        for (const e of umbrales) {
            const limite = (e.umbral / 100) * maximoDe(stat)
            if (valor > limite) { delete pet.critico[stat]; continue }
            if (pet.critico[stat]) continue
            const cruce = antes[stat] > limite && ritmos[stat] > 0
                ? desde + ((antes[stat] - limite) / ritmos[stat]) * MINUTO
                : desde
            pet.critico[stat] = Math.round(Math.min(cruce, ahora))
        }
    }

    for (const [clave, e] of Object.entries(C.ESTADOS_MASCOTA)) {
        if (e.tipo !== "penalizacion") continue
        const activa = pet.penalizaciones[clave]
        if (!activa) {
            const critico = pet.critico[e.stat]
            if (critico && ahora - critico >= e.minutosParaAplicar * MINUTO) {
                pet.penalizaciones[clave] = {
                    desde: Math.floor((critico + e.minutosParaAplicar * MINUTO) / 1000),
                    causadoPor: e.stat,
                    tipo: e.tipo,
                }
            }
        } else if (porcentajeDe(pet, e.stat) >= e.recuperacion && ahora / 1000 - Number(activa.desde || 0) >= e.minutosMinimos * 60) {
            delete pet.penalizaciones[clave]
        }
    }

    pet.lastSeen = ahora
    const cambio = minutos >= 1 || !original.lastSeen
        || JSON.stringify(pet.penalizaciones) !== JSON.stringify(original.penalizaciones || {})
    return { pet, cambio, desperto }
}

/** Estados para mostrar, del más importante al menos: penalizaciones guardadas + bonificaciones. */
function estadosActivos(pet) {
    const lista = []
    for (const [clave, info] of Object.entries(pet.penalizaciones || {})) {
        const e = C.ESTADOS_MASCOTA[clave]
        if (!e) continue
        lista.push({ clave, nombre: e.nombre, descripcion: e.descripcion, tipo: e.tipo, peso: e.peso, desde: Number(info?.desde) || null })
    }
    for (const clave of bonificaciones(pet)) {
        const e = C.ESTADOS_MASCOTA[clave]
        lista.push({ clave, nombre: e.nombre, descripcion: e.descripcion, tipo: e.tipo, peso: e.peso, desde: null })
    }
    return lista.sort((a, b) => b.peso - a.peso)
}

// ─── Mascotas: cuidado y progresión ──────────────────────────────────────────

const modificadorDe = (pet) => C.modificadoresLv[pet.rareza] || C.modificadoresLv.Sencilla

/** Cuenta un día de cuidado la primera vez que se la cuida en la fecha. */
function registrarDiaCuidado(pet, ahora = Date.now()) {
    const hoy = fechaLocal(ahora)
    if (pet.diaCuidado === hoy) return false
    pet.diaCuidado = hoy
    pet.diasCuidado = (Number(pet.diasCuidado) || 0) + 1
    pet.lastDay = ahora
    return true
}

/**
 * Suma XP y resuelve nivel, etapa y personalidad. Modifica `pet`.
 * @returns {{ subioNivel: boolean, subioEtapa: boolean }}
 */
function ganarXP(pet, xp, azar = Math.random) {
    const mod = modificadorDe(pet)
    pet.xp = (Number(pet.xp) || 0) + Math.max(0, Math.round(xp))
    pet.lv = Number(pet.lv) || 1
    pet.xpRq = Number(pet.xpRq) || C.PROGRESION.XP_BASE_NIVEL

    let subioNivel = false
    for (let i = 0; i < 50 && pet.xp >= pet.xpRq; i++) {
        pet.xpRq = Math.floor(pet.lv * (C.PROGRESION.XP_BASE_NIVEL * mod.xp) + pet.xpRq * 0.3)
        pet.lv += 1
        subioNivel = true
    }

    let subioEtapa = false
    const xpEtapa = C.modifEtapa[pet.etapa]
    const diasNecesarios = Math.ceil((Number(pet.crecimiento) || C.PROGRESION.DIAS_BASE_ETAPA) * mod.tiempo)
    if (xpEtapa && (Number(pet.diasCuidado) || 0) >= diasNecesarios && pet.xp >= xpEtapa * mod.xp) {
        pet.etapa = C.ETAPAS[C.ETAPAS.indexOf(pet.etapa) + 1] || pet.etapa
        pet.crecimiento = diasNecesarios
        subioEtapa = true
    }

    if (pet.etapa !== "Bebé" && !pet.personalidad) {
        const lista = C.PROGRESION.PERSONALIDADES
        pet.personalidad = lista[Math.floor(azar() * lista.length)]
    }
    return { subioNivel, subioEtapa }
}

/** Puntos que devuelve una acción: lo que diga el objeto (atributos.<stat>) o la config. */
function puntosDeAccion(accion, def) {
    const cfg = C.ACCIONES_MASCOTA[accion]
    const delObjeto = Number(def?.atributos?.[cfg.stat])
    return Number.isFinite(delObjeto) && delObjeto > 0 ? delObjeto : cfg.recupera
}

/**
 * Aplica una acción de cuidado a una mascota ya puesta al día. No valida el inventario.
 * @returns {{ ok: boolean, motivo?: string, pet?: Object, subioNivel?: boolean, subioEtapa?: boolean, desperto?: boolean }}
 */
function cuidarMascota(original, accion, { def = null, ahora = Date.now(), azar = Math.random } = {}) {
    const cfg = C.ACCIONES_MASCOTA[accion]
    if (!cfg) return { ok: false, motivo: "accion_invalida" }
    const pet = copiar(original)
    pet.penalizaciones = pet.penalizaciones || {}

    if (accion === "dormir") {
        if (estaDormida(pet)) {
            delete pet.penalizaciones.dormido
            return { ok: true, pet, desperto: true, subioNivel: false, subioEtapa: false }
        }
        if (porcentajeDe(pet, cfg.stat) >= 99.5) return { ok: false, motivo: "lleno" }
        pet.penalizaciones.dormido = { desde: Math.floor(ahora / 1000), tipo: "especial", manual: true }
    } else {
        if (estaDormida(pet)) return { ok: false, motivo: "dormida" }
        if (porcentajeDe(pet, cfg.stat) >= 99.5) return { ok: false, motivo: "lleno" }
        pet[cfg.stat] = redondear(limitar(valorDe(pet, cfg.stat) + puntosDeAccion(accion, def), 0, maximoDe(cfg.stat)))
    }

    registrarDiaCuidado(pet, ahora)
    const [min, max] = cfg.xp
    let xp = min + Math.floor(azar() * (max - min + 1))
    if (bonificaciones(original).includes("entusiasmado")) xp *= C.PROGRESION.BONUS_XP_ENTUSIASMADO
    return { ok: true, pet, desperto: false, ...ganarXP(pet, xp, azar) }
}

// ─── Huevos ──────────────────────────────────────────────────────────────────

const CLAVES_CUIDADO = Object.keys(C.HUEVO.CUIDADOS)
/** "limpiar" | "acariciar" | "calentar" → clave de la barra. */
const claveDeAccion = (accion) => CLAVES_CUIDADO.find(k => C.HUEVO.CUIDADOS[k].accion === accion || k === accion) || null

/** Horas de eclosión: propiedad del objeto huevo (`eclosion_horas`); si no la trae, la base (3 días). */
function horasEclosion(def) {
    const h = Number(def?.eclosion_horas ?? def?.atributos?.eclosion_horas)
    if (!Number.isFinite(h) || h <= 0) return C.HUEVO.HORAS_ECLOSION_BASE
    return limitar(h, C.HUEVO.HORAS_ECLOSION_MIN, C.HUEVO.HORAS_ECLOSION_MAX)
}

/** Documento nuevo de un huevo en crianza. */
function crearHuevo({ characterId, def, incubadora = false, ahora = Date.now(), id = nuevoId() }) {
    const duracionMs = horasEclosion(def) * HORA
    const total = incubadora ? duracionMs * C.HUEVO.INCUBADORA_MULTIPLICADOR : duracionMs
    return {
        _id: id,
        characterID: Number(characterId),
        etapa: ETAPA_HUEVO,
        Nombre: def.Nombre || "Huevo",
        tipo: ETAPA_HUEVO,
        activePet: false,
        adoptada: Math.floor(ahora / 1000),
        huevo: {
            objeto: { ID: Number(def.ID), Region: def.Region, Nombre: def.Nombre, Rareza: def.Rareza || null, imagenURL: def.imagenURL || null },
            creadoEn: ahora,
            duracionMs,
            eclosionEn: Math.round(ahora + total),
            incubadora: Boolean(incubadora),
            cuidado: Object.fromEntries(CLAVES_CUIDADO.map(k => [k, C.HUEVO.ESTADO_INICIAL])),
            cuidadoEn: ahora,
            dia: fechaLocal(ahora),
            interaccionesHoy: 0,
            totalCuidados: 0,
            sobrecuidados: 0,
            reducidoMs: 0,
        },
    }
}

/** Barras del huevo en el instante `t`. En incubadora no bajan. */
function barrasEn(h, t = Date.now()) {
    const dias = h.incubadora ? 0 : Math.max(0, t - h.cuidadoEn) / DIA
    return Object.fromEntries(CLAVES_CUIDADO.map(k => [
        k, limitar((Number(h.cuidado?.[k]) || 0) - C.HUEVO.CUIDADOS[k].perdidaPorDia * dias, 0, 100),
    ]))
}

const promedio = (barras) => CLAVES_CUIDADO.reduce((s, k) => s + barras[k], 0) / CLAVES_CUIDADO.length
/** Estado total del huevo (0-100): promedio de sus barras. */
const estadoTotal = (h, t = Date.now()) => promedio(barrasEn(h, t))

/** Instante en que el estado total llega al % de rotura si nadie lo cuida (Infinity en incubadora). */
function momentoRotura(h) {
    if (h.incubadora) return Infinity
    const objetivo = C.HUEVO.ESTADO_ROTURA * CLAVES_CUIDADO.length
    const barras = CLAVES_CUIDADO.map(k => ({ v: Number(h.cuidado?.[k]) || 0, r: C.HUEVO.CUIDADOS[k].perdidaPorDia / DIA }))
    const suma = (t) => barras.reduce((s, b) => s + Math.max(0, b.v - b.r * t), 0)
    if (suma(0) <= objetivo) return h.cuidadoEn

    // La suma baja en tramos rectos que cambian cuando una barra toca 0
    const cortes = [...new Set(barras.filter(b => b.r > 0).map(b => b.v / b.r))].sort((a, b) => a - b)
    let previo = 0
    for (const corte of cortes) {
        if (suma(corte) <= objetivo) {
            const pendiente = (suma(previo) - suma(corte)) / (corte - previo)
            return Math.round(h.cuidadoEn + previo + (suma(previo) - objetivo) / pendiente)
        }
        previo = corte
    }
    return Infinity
}

/**
 * Qué le pasó al huevo hasta `ahora`.
 * @returns {{ estado: "incubando"|"roto"|"eclosionado", en?: number }}
 */
function resolverHuevo(h, ahora = Date.now()) {
    const rotura = momentoRotura(h)
    if (rotura <= Math.min(ahora, h.eclosionEn)) return { estado: "roto", en: rotura }
    if (ahora >= h.eclosionEn) return { estado: "eclosionado", en: h.eclosionEn }
    return { estado: "incubando" }
}

/** Interacciones que le quedan hoy al huevo. */
function interaccionesRestantes(h, ahora = Date.now()) {
    const usadas = h.dia === fechaLocal(ahora) ? Number(h.interaccionesHoy) || 0 : 0
    return Math.max(0, C.HUEVO.MAX_INTERACCIONES_DIA - usadas)
}

/** Tiempo de eclosión que el sobrecuidado todavía puede quitar. */
const reduccionDisponible = (h) => Math.max(0, h.duracionMs * C.HUEVO.SOBRECUIDADO_TOPE - (Number(h.reducidoMs) || 0))

/**
 * Una interacción de cuidado (limpiar, acariciar o calentar). No cobra energía: eso lo hace el servicio.
 * Con la barra ya llena es sobrecuidado: no sube nada y acorta un poco la eclosión.
 * @returns {{ ok: boolean, motivo?: string, huevo?: Object, sobrecuidado?: boolean, reduccionMs?: number, antes?: number, despues?: number }}
 */
function cuidarHuevo(original, clave, ahora = Date.now()) {
    if (!C.HUEVO.CUIDADOS[clave]) return { ok: false, motivo: "accion_invalida" }
    if (original.incubadora) return { ok: false, motivo: "en_incubadora" }
    const restantes = interaccionesRestantes(original, ahora)
    if (restantes <= 0) return { ok: false, motivo: "limite_diario" }

    const h = copiar(original)
    const barras = barrasEn(h, ahora)
    const antes = barras[clave]
    const sobrecuidado = antes >= C.HUEVO.BARRA_LLENA_DESDE
    let reduccionMs = 0

    if (sobrecuidado) {
        const restanteEclosion = Math.max(0, h.eclosionEn - ahora)
        reduccionMs = Math.round(Math.min(h.duracionMs * C.HUEVO.SOBRECUIDADO_FRACCION, reduccionDisponible(h), restanteEclosion))
        // Sin nada que acortar la interacción no haría nada: no se gasta
        if (reduccionMs <= 0) return { ok: false, motivo: "sobrecuidado_tope" }
        h.eclosionEn -= reduccionMs
        h.reducidoMs = (Number(h.reducidoMs) || 0) + reduccionMs
        h.sobrecuidados = (Number(h.sobrecuidados) || 0) + 1
        barras[clave] = 100
    } else {
        barras[clave] = limitar(antes + C.HUEVO.RECUPERA_POR_CUIDADO, 0, 100)
    }

    h.cuidado = Object.fromEntries(CLAVES_CUIDADO.map(k => [k, redondear(barras[k])]))
    h.cuidadoEn = ahora
    h.dia = fechaLocal(ahora)
    h.interaccionesHoy = C.HUEVO.MAX_INTERACCIONES_DIA - restantes + 1
    h.totalCuidados = (Number(h.totalCuidados) || 0) + 1
    return { ok: true, huevo: h, sobrecuidado, reduccionMs, antes, despues: barras[clave] }
}

/** Mete o saca el huevo de la incubadora: el tiempo que falta se estira o se encoge ×1.25. */
function cambiarIncubadora(original, meter, ahora = Date.now()) {
    if (Boolean(original.incubadora) === Boolean(meter)) return { ok: false, motivo: meter ? "ya_en_incubadora" : "no_en_incubadora" }
    const h = copiar(original)
    const barras = barrasEn(h, ahora)
    const restante = Math.max(0, h.eclosionEn - ahora)
    const factor = meter ? C.HUEVO.INCUBADORA_MULTIPLICADOR : 1 / C.HUEVO.INCUBADORA_MULTIPLICADOR
    h.eclosionEn = Math.round(ahora + restante * factor)
    h.incubadora = Boolean(meter)
    h.cuidado = Object.fromEntries(CLAVES_CUIDADO.map(k => [k, redondear(barras[k])]))
    h.cuidadoEn = ahora
    return { ok: true, huevo: h }
}

/** Sortea la especie que nace de un huevo según su tabla (o la tabla por defecto). */
function sortearEspecie(objeto, azar = Math.random) {
    const tabla = C.TABLAS_HUEVO[`${objeto?.Region}:${Number(objeto?.ID)}`] || C.TABLAS_HUEVO.default
    const validas = tabla.filter(e => C.ESPECIES[e.especie] && e.peso > 0)
    const total = validas.reduce((s, e) => s + e.peso, 0)
    let n = azar() * total
    for (const e of validas) {
        n -= e.peso
        if (n < 0) return C.ESPECIES[e.especie]
    }
    return C.ESPECIES[validas[validas.length - 1].especie]
}

/**
 * Convierte el documento de un huevo en una mascota recién nacida.
 * @param {Object} doc - documento del huevo
 * @param {Object} o
 * @param {boolean} o.activa - si queda como mascota activa (no hay otra)
 * @returns {{ set: Object, unset: Object, especie: Object }}
 */
function eclosionar(doc, { ahora = Date.now(), activa = false, azar = Math.random } = {}) {
    const h = doc.huevo
    const especie = sortearEspecie(h.objeto, azar)
    const calidad = h.incubadora ? C.HUEVO.CALIDAD_INCUBADORA : Math.round(estadoTotal(h, Math.min(ahora, h.eclosionEn)))
    const set = {
        etapa: "Bebé",
        Nombre: especie.tipo,
        tipo: especie.tipo,
        especieId: especie.id,
        rareza: especie.rareza,
        emoji: especie.emoji || null,
        avatarURL: especie.imagen || null,
        personalidad: null,
        adoptada: Math.floor(ahora / 1000),
        lv: 1,
        xp: 0,
        xpRq: C.PROGRESION.XP_BASE_NIVEL,
        ...Object.fromEntries(STATS.map(s => [s, maximoDe(s)])),
        penalizaciones: {},
        critico: {},
        lastSeen: ahora,
        diasCuidado: 0,
        crecimiento: 0,
        activePet: Boolean(activa),
        nacimiento: {
            en: h.eclosionEn,
            huevo: { ID: h.objeto.ID, Region: h.objeto.Region, Nombre: h.objeto.Nombre },
            incubadora: Boolean(h.incubadora),
            calidad,
            cuidados: Number(h.totalCuidados) || 0,
            visto: false,
        },
    }
    return { set, unset: { huevo: "" }, especie }
}

/** "2 d 4 h", "3 h 20 min", "5 min". */
function formatoDuracion(ms) {
    const min = Math.max(0, Math.round(ms / MINUTO))
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60
    if (d) return `${d} d${h ? ` ${h} h` : ""}`
    if (h) return `${h} h${m ? ` ${m} min` : ""}`
    return `${Math.max(1, m)} min`
}

module.exports = {
    MINUTO, HORA, DIA, ETAPA_HUEVO, STATS, CLAVES_CUIDADO,
    nuevoId, fechaLocal, esHuevo, esObjetoHuevo, esIncubadora, tiposDe,
    maximoDe, valorDe, porcentajeDe, estaDormida, bonificaciones, ritmoDesgaste,
    avanzarMascota, estadosActivos, registrarDiaCuidado, ganarXP, puntosDeAccion, cuidarMascota,
    claveDeAccion, horasEclosion, crearHuevo, barrasEn, estadoTotal, momentoRotura, resolverHuevo,
    interaccionesRestantes, reduccionDisponible, cuidarHuevo, cambiarIncubadora, sortearEspecie, eclosionar,
    formatoDuracion,
}
