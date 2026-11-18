// ─── Contenedores elementales: operaciones con base de datos ─────────────────
// Guardado al terminar un combate, reparación (kit y Taller), Contenedor de Cortesía, artesano
// y cambio de elemento fuera de combate. Las reglas están en ./nucleo.js y los números en ./config.js.
//
// Toda escritura sobre una instancia comprueba que siga como se leyó (durabilidad y carga):
// si algo la cambió entre medias, la operación se rechaza con "conflicto" en lugar de pisarla.

const clientdb = require("../../Server")
const db = clientdb.db("Rol_db")
const souls = db.collection("Soul")

const { TIPOS, REPARACION, RESPALDO, ARTESANO } = require("./config")
const N = require("./nucleo")

const OFFSET_MEXICO_MS = 6 * 60 * 60 * 1000
const diaMx = (ms = Date.now()) => new Date(ms - OFFSET_MEXICO_MS).toISOString().slice(0, 10)

const fallo = (motivo, extra = {}) => ({ ok: false, motivo, ...extra })

function enCombate(personajeId) {
    // Import diferido: duelManager arrastra todo el sistema de combate
    const { duelSystem } = require("../Duelo/duelManager")
    return duelSystem.estaEnCombate(personajeId)
}

/** Filtro que exige que la instancia siga exactamente como se leyó. */
function filtroInstancia(soulId, entrada) {
    return {
        _id: soulId,
        "dominio.equipo": { $elemMatch: { instanciaID: entrada.instanciaID, durabilidad: entrada.durabilidad, carga: entrada.carga } },
    }
}

const porInstancia = (entrada) => ({ arrayFilters: [{ "c.instanciaID": entrada.instanciaID }] })

// ─── Estado para la interfaz ─────────────────────────────────────────────────

/**
 * Resumen del contenedor de un alma para la vista de Equipamiento.
 * @returns {null | Object} null si el alma no es desafinada (o el sistema está apagado)
 */
function estadoContenedor(soul, ahora = Date.now()) {
    if (!N.contenedoresActivos() || !N.esAlmaDesafinada(soul)) return null
    const equipo = soul?.dominio?.equipo || []
    const entrada = N.entradaEquipada(equipo)
    const artesanal = equipo.find(e => N.tipoDeEntrada(e) === "artesanal") ?? null
    const funciona = Boolean(entrada) && !N.estaRoto(entrada)
    const mana = N.manaDeAlma(soul)
    const respaldo = soul?.nucleo?.respaldo
    const respaldosHoy = respaldo?.dia === diaMx(ahora) ? Number(respaldo.n) || 0 : 0
    const reparable = artesanal && N.durabilidadActual(artesanal) < N.durabilidadMax(artesanal) ? artesanal : null

    return {
        entrada, artesanal, funciona,
        tipo: entrada ? N.tipoDeEntrada(entrada) : null,
        nombre: entrada ? N.nombreVisible(entrada) : null,
        etapa: entrada ? N.etapaEntrada(entrada) : null,
        durabilidad: entrada ? { actual: N.durabilidadActual(entrada), max: N.durabilidadMax(entrada) } : null,
        carga: mana.actual,
        capacidad: mana.max,
        elementoActivo: N.elementoActivoDeAlma(soul),
        puedeKit: funciona && TIPOS[N.tipoDeEntrada(entrada)].reparable && N.durabilidadActual(entrada) < N.durabilidadMax(entrada),
        tallerObjetivo: reparable,
        costoTaller: reparable ? N.costoTaller(reparable, ahora) : 0,
        puedeRespaldo: !funciona && respaldosHoy < RESPALDO.MAX_POR_DIA,
        respaldoAgotado: !funciona && respaldosHoy >= RESPALDO.MAX_POR_DIA,
        puedeArtesano: !artesanal,
    }
}

// ─── Guardado ────────────────────────────────────────────────────────────────

/**
 * Guarda, de forma atómica, el desgaste y el gasto de carga de un contenedor de combate:
 *  - $inc (decimal) sobre la instancia, solo si su durabilidad en BD sigue > 0: dos golpes casi
 *    simultáneos se suman en lugar de pisarse (nunca se lee–modifica–escribe).
 *  - Si quedó en 0 o menos: se fija en 0 y se vacía la carga. Repetirlo no cambia nada, así que la
 *    ruptura se registra una sola vez aunque lleguen varios guardados.
 * @param {number} soulId
 * @param {Object} c - contenedor de combate (nucleo.aCombate)
 * @param {Object} [extra] - { set } campos del alma que se guardan en la misma operación
 */
async function guardarDesgaste(soulId, c, { set = {} } = {}) {
    const update = {}
    const inc = {}
    if (c?.instanciaID) {
        const dDur = c.durabilidad.actual - c.inicial.durabilidad
        const dCarga = c.esencia.carga - c.inicial.carga
        if (dDur) inc["dominio.equipo.$[c].durabilidad"] = dDur
        if (dCarga) inc["dominio.equipo.$[c].carga"] = dCarga
    }
    if (Object.keys(set).length) update.$set = set
    if (Object.keys(inc).length) update.$inc = inc
    if (!Object.keys(update).length) return
    const opciones = update.$inc
        ? { arrayFilters: [{ "c.instanciaID": c.instanciaID, "c.durabilidad": { $gt: 0 } }] }
        : undefined
    await souls.updateOne({ _id: soulId }, update, opciones)

    if (c?.instanciaID && (c.durabilidad.actual <= 0 || inc["dominio.equipo.$[c].durabilidad"] < 0)) {
        // Cierre de la ruptura: idempotente
        await souls.updateOne(
            { _id: soulId, "dominio.equipo": { $elemMatch: { instanciaID: c.instanciaID, durabilidad: { $lte: 0 } } } },
            { $set: { "dominio.equipo.$[c].durabilidad": 0, "dominio.equipo.$[c].carga": 0 } },
            porInstancia(c)
        )
    }
}

/** Fuera de combate: guarda HP y maná de un combatiente temporal (uso de objetos). */
async function guardarVitales(pj) {
    const id = Number(pj.ID)
    if (!N.esDesafinado(pj)) {
        return souls.updateOne({ _id: id }, { $set: { "nucleo.HP": pj.HP, "nucleo.Mana": pj.Mana } })
    }
    return guardarDesgaste(id, pj.contenedor, { set: { "nucleo.HP": pj.HP } })
}

/**
 * Fin de combate. Contra NPCs, exploración y eventos el desgaste (por daño recibido) y el gasto
 * son reales. En un duelo entre jugadores (o en una sala de prueba) el contenedor vuelve a como
 * empezó: el Área de entrenamiento tiene sellos de práctica. El desgaste se guarda como
 * incremento atómico (ver guardarDesgaste), no como valor absoluto.
 */
async function persistirSesion(sesion) {
    if (!N.contenedoresActivos()) return
    const todos = sesion.getAllCombatientes()
    const esDuelo = sesion.modeTest === true || !todos.some(c => c.isNPC)

    await Promise.all(todos.filter(c => N.esDesafinado(c)).map(async (pj) => {
        if (esDuelo) N.restaurarInicial(pj)
        const set = {}
        if (!sesion.modeTest && pj.elementoActivo !== pj._elementoInicial) set["nucleo.elementoActivo"] = pj.elementoActivo
        await guardarDesgaste(Number(pj.ID), esDuelo ? null : pj.contenedor, { set })
    }))
}

// ─── Elemento activo (fuera de combate: inmediato y gratis) ──────────────────

async function cambiarElemento(soul, nuevo) {
    if (enCombate(soul._id)) return fallo("en_combate")
    const pj = {
        Nombre: "", desafinado: N.esAlmaDesafinada(soul), statusEffect: [],
        elementoActivo: N.elementoActivoDeAlma(soul),
        contenedor: N.aCombate(N.entradaEquipada(soul?.dominio?.equipo), soul?.stats?.manaMax),
    }
    const r = N.cambiarElementoActivo(pj, nuevo, { enCombate: false })
    if (!r.ok) return fallo(r.razon[0])
    await souls.updateOne({ _id: soul._id }, { $set: { "nucleo.elementoActivo": r.elemento } })
    return { ok: true, elemento: r.elemento }
}

// ─── Reparación ──────────────────────────────────────────────────────────────

/** Kit de reparación: +25, solo fuera de combate, nunca sobre un contenedor Roto ni de Cortesía. */
async function repararConKit(character, soul) {
    if (enCombate(soul._id)) return fallo("en_combate")
    if (!N.contenedoresActivos() || !N.esAlmaDesafinada(soul)) return fallo("no_desafinado")
    const entrada = N.entradaEquipada(soul?.dominio?.equipo)
    if (!entrada) return fallo("sin_contenedor")
    if (N.estaRoto(entrada)) return fallo("roto")
    if (!TIPOS[N.tipoDeEntrada(entrada)].reparable) return fallo("no_reparable")
    const max = N.durabilidadMax(entrada)
    const actual = N.durabilidadActual(entrada)
    if (actual >= max) return fallo("intacto")

    const kit = (character?.economia?.Inventario || []).find(i => Number(i.ID) === REPARACION.KIT.ID && Number(i.Cantidad ?? 1) > 0)
    if (!kit) return fallo("sin_kit")

    const updateInventario = require("../updateInventario")
    const datosKit = { isItem: true, ID: REPARACION.KIT.ID, Region: REPARACION.KIT.Region, cantidad: 1 }
    const consumo = await updateInventario(null, null, character._id, { ...datosKit, consumir: true })
    if (!consumo?.success) return fallo("sin_kit")

    const puntos = Math.min(REPARACION.KIT_PUNTOS, max - actual)
    const r = await souls.updateOne(
        filtroInstancia(soul._id, entrada),
        { $inc: { "dominio.equipo.$[c].durabilidad": puntos } },
        porInstancia(entrada)
    )
    if (r.modifiedCount !== 1) {
        await updateInventario(null, null, character._id, { ...datosKit, esMovimiento: true })   // se devuelve el kit
        return fallo("conflicto")
    }
    const nueva = { ...entrada, durabilidad: actual + puntos }
    return { ok: true, puntos, durabilidad: { actual: actual + puntos, max }, etapa: N.etapaEntrada(nueva) }
}

/**
 * Taller de contenedores: repara por completo el contenedor artesanal (un Roto paga el reemplazo
 * del cristal) y lo devuelve con la carga llena. El Contenedor de Cortesía que se llevara
 * mientras tanto vuelve al Instituto.
 */
async function repararEnTaller(character, soul, { userId, ahora = Date.now() } = {}) {
    if (enCombate(soul._id)) return fallo("en_combate")
    if (!N.contenedoresActivos() || !N.esAlmaDesafinada(soul)) return fallo("no_desafinado")
    const equipo = soul?.dominio?.equipo || []
    const entrada = equipo.find(e => N.tipoDeEntrada(e) === "artesanal")
    if (!entrada) return fallo(equipo.some(N.esContenedor) ? "no_reparable" : "sin_contenedor")
    const max = N.durabilidadMax(entrada)
    if (N.durabilidadActual(entrada) >= max) return fallo("intacto")

    const estabaRoto = N.estaRoto(entrada)
    const costo = N.costoTaller(entrada, ahora)
    const { moverLumens } = require("../Economia/lumens")
    const ref = { accion: "taller", instanciaID: entrada.instanciaID, roto: estabaRoto }
    const pago = await moverLumens({ personajeId: character._id, userId, delta: -costo, motivo: REPARACION.MOTIVO_LEDGER, ref })
    if (!pago.ok) return fallo(pago.motivo === "saldo_insuficiente" ? "sin_lumens" : "pago", { costo })

    const set = { "dominio.equipo.$[c].durabilidad": max, "dominio.equipo.$[c].equipado": true }
    if (REPARACION.RECARGA_AL_REPARAR) set["dominio.equipo.$[c].carga"] = N.capacidad(entrada, soul?.stats?.manaMax)
    const r = await souls.updateOne(
        filtroInstancia(soul._id, entrada),
        { $set: set, $push: { "dominio.equipo.$[c].reparaciones": { $each: [ahora], $slice: -20 } } },
        porInstancia(entrada)
    )
    if (r.modifiedCount !== 1) {
        await moverLumens({ personajeId: character._id, userId, delta: costo, motivo: "reembolso", ref })
        return fallo("conflicto")
    }
    // El respaldo era temporal: vuelve al Instituto
    await souls.updateOne({ _id: soul._id }, { $pull: { "dominio.equipo": { tipoContenedor: "cortesia" } } })
    return { ok: true, costo, estabaRoto, saldo: pago.saldo, durabilidad: { actual: max, max } }
}

// ─── Contenedor de Cortesía ──────────────────────────────────────────────────

/** Reposición gratuita: solo sin un contenedor que funcione, fuera de combate y máx. 1 por día. */
async function pedirRespaldo(soul, { ahora = Date.now() } = {}) {
    if (enCombate(soul._id)) return fallo("en_combate")
    if (!N.contenedoresActivos() || !N.esAlmaDesafinada(soul)) return fallo("no_desafinado")
    const equipo = soul?.dominio?.equipo || []
    const actual = N.entradaEquipada(equipo)
    if (actual && !N.estaRoto(actual)) return fallo("ya_funciona")

    const hoy = diaMx(ahora)
    const previo = soul?.nucleo?.respaldo
    const usadosHoy = previo?.dia === hoy ? Number(previo.n) || 0 : 0
    if (usadosHoy >= RESPALDO.MAX_POR_DIA) return fallo("limite_diario")

    const nueva = N.crearInstancia("cortesia", { manaMaxBase: soul?.stats?.manaMax, ahora })
    // La condición sobre nucleo.respaldo evita que dos peticiones simultáneas entreguen dos
    const guardia = usadosHoy
        ? { "nucleo.respaldo.dia": hoy, "nucleo.respaldo.n": usadosHoy }
        : { "nucleo.respaldo.dia": { $ne: hoy } }
    const r = await souls.updateOne(
        { _id: soul._id, ...guardia },
        { $set: { "dominio.equipo": N.equipoCon(equipo, nueva), "nucleo.respaldo": { dia: hoy, n: usadosHoy + 1 } } }
    )
    if (r.modifiedCount !== 1) return fallo("conflicto")
    return { ok: true, entrada: nueva }
}

// ─── Artesano ────────────────────────────────────────────────────────────────

/** El artesano forja el contenedor definitivo: forma y diseño del jugador, cristal y esencia neutra. */
async function encargarArtesanal(character, soul, { forma, nombre, descripcion, userId, ahora = Date.now() } = {}) {
    if (enCombate(soul._id)) return fallo("en_combate")
    if (!N.contenedoresActivos() || !N.esAlmaDesafinada(soul)) return fallo("no_desafinado")
    const equipo = soul?.dominio?.equipo || []
    if (equipo.some(e => N.tipoDeEntrada(e) === "artesanal")) return fallo("ya_tiene_artesanal")

    const d = N.sanitizarDiseno({ forma, nombre, descripcion })
    if (!d.ok) return fallo(d.motivo)

    const nueva = N.crearInstancia("artesanal", { manaMaxBase: soul?.stats?.manaMax, forma: d.forma, diseno: d.diseno, ahora })
    const { moverLumens } = require("../Economia/lumens")
    const ref = { accion: "artesano", instanciaID: nueva.instanciaID }
    const pago = await moverLumens({ personajeId: character._id, userId, delta: -ARTESANO.PRECIO, motivo: ARTESANO.MOTIVO_LEDGER, ref })
    if (!pago.ok) return fallo(pago.motivo === "saldo_insuficiente" ? "sin_lumens" : "pago", { costo: ARTESANO.PRECIO })

    const r = await souls.updateOne(
        { _id: soul._id, "dominio.equipo.tipoContenedor": { $ne: "artesanal" } },
        { $set: { "dominio.equipo": N.equipoCon(equipo, nueva) } }
    )
    if (r.modifiedCount !== 1) {
        await moverLumens({ personajeId: character._id, userId, delta: ARTESANO.PRECIO, motivo: "reembolso", ref })
        return fallo("conflicto")
    }
    return { ok: true, entrada: nueva, costo: ARTESANO.PRECIO, saldo: pago.saldo }
}

module.exports = {
    diaMx, estadoContenedor, guardarDesgaste, guardarVitales, persistirSesion, cambiarElemento,
    repararConKit, repararEnTaller, pedirRespaldo, encargarArtesanal,
    // Reglas puras de entrega y migración (viven en nucleo.js)
    entregaInicial: N.entregaInicial, equipoCon: N.equipoCon, planMigracion: N.planMigracion,
}
