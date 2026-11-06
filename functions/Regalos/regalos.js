// ─────────────────────────────────────────────────────────────────────────────
// Sistema de Regalos — envío, buzón, apertura, reportes y vencimientos.
// Capa de lógica: devuelve { ok, codigo?, ... } y nunca renderiza.
//
// Colección Rol_db.buzon: UN documento por regalo (nada crece sin tope).
// El buzón es por PERSONAJE: un buzón por cuenta sería una vía para pasar ítems
// entre los dos personajes de una misma cuenta.
//
//   { _id, tipo: "regalo",                // reservado: "malicioso" (fase 2), "intercambio" (fase 3)
//     de, para, deUserId, paraUserId, deNombre, paraNombre,
//     contenido: { items: [{ itemId, region, nombre, cantidad }], lumens },
//     envoltura: { bolsa, bolsaItem, titulo, nota, banner, color },
//     estado: "pendiente" | "abierto" | "devuelto" | "reportado" | "descartado",
//     creadoEn, venceEn, abiertoEn, devueltoEn,
//     valor: { S, etiqueta, factores, mejor, excluidas } | null,   // auditoría / dashboard
//     puntosOtorgados, amistad, reporte,
//     pendienteLumens, pendienteAmistad }                         // pasos posteriores a la transacción
//
// Por qué Lumens y amistad van DESPUÉS de la transacción: el libro de Lumens y
// resolverInteraccion no aceptan sesión de Mongo. La transacción cubre el estado
// del regalo y los ítems; luego se "reclaman" los pasos pendientes con banderas
// (pendienteLumens / pendienteAmistad) y opIds estables, así un fallo a medias
// se completa en el siguiente barrido sin duplicar nada.
// ─────────────────────────────────────────────────────────────────────────────
const { ObjectId } = require("mongodb")
const clientdb = require("../../Server")
const cfg = require("../../config/regalos")
const valor = require("../../config/valorRegalo")
const { LINEA_AMISTAD } = require("../../config/mensajesRegalos")
const { congelarLumens, descongelarLumens, transferirLumens, moverLumens, fechaMx, OFFSET_MEXICO_MS } = require("../Economia/lumens")
const { evaluarPermisoPrivacidad } = require("../privacidad")
const { limitarEntradas } = require("../Objetos/limiteInventario")
const { getActiveCharacter } = require("../../utils/getDataCharacters")
const { definicionDe, entradaRegalable } = require("./leerItem")
const bolsa = require("./bolsa")
const c = require("./comun")

const dbRol = clientdb.db("Rol_db")
const buzon = dbRol.collection("buzon")
const reportes = dbRol.collection("reportes_regalo")

// ─── Índices ─────────────────────────────────────────────────────────────────
let indicesListos = null
function asegurarIndices() {
    if (!indicesListos) {
        indicesListos = Promise.all([
            buzon.createIndex({ para: 1, estado: 1, creadoEn: -1 }),
            buzon.createIndex({ de: 1, creadoEn: -1 }),
            buzon.createIndex({ estado: 1, venceEn: 1 }),
            buzon.createIndex({ pendienteLumens: 1 }, { partialFilterExpression: { pendienteLumens: true } }),
            buzon.createIndex({ pendienteAmistad: 1 }, { partialFilterExpression: { pendienteAmistad: true } }),
            reportes.createIndex({ reportanteUserId: 1, creadoEn: -1 }),
            reportes.createIndex({ regaloId: 1 }),
        ]).catch(e => {
            indicesListos = null
            console.error("[Regalos] No se pudieron crear los índices:", e.message)
        })
    }
    return indicesListos
}
asegurarIndices()

const inicioDiaMx = (ms = Date.now()) => new Date(Date.parse(`${fechaMx(ms)}T00:00:00Z`) + OFFSET_MEXICO_MS)
const aObjectId = (id) => { try { return new ObjectId(String(id)) } catch { return null } }

/** Avisa al personaje en su campana de notificaciones, si no lo desactivó. */
async function notificar(pjId, titulo, mensaje) {
    const notif = { _id: new ObjectId().toString(), tipo: "regalo", titulo, mensaje, leida: false, fecha: new Date(), accion: null }
    await c.personajes.updateOne(
        { _id: c.normalizarId(pjId), [`social.notificaciones.${cfg.CAMPO_NOTIF_REGALOS}`]: { $ne: false } },
        { $push: { notificaciones: { $each: [notif], $position: 0, $slice: 50 } } }
    ).catch(e => console.error("[Regalos] No se pudo notificar:", e.message))
}

// ─── Destinatario ────────────────────────────────────────────────────────────
/** Resuelve el personaje destino por ID de personaje o por usuario (su personaje activo). */
async function resolverDestino({ pjId, userId }) {
    if (pjId !== undefined && pjId !== null) return c.leerPersonaje(pjId)
    if (userId) return (await getActiveCharacter(String(userId), { character: true }))?.character || null
    return null
}

// ─── Envío ───────────────────────────────────────────────────────────────────
/**
 * Prepara el "borrador" de un envío (lo que se mostrará al confirmar). No
 * descuenta nada: todo se verifica y se cobra en enviarRegalo.
 * @returns {{ ok: true, borrador } | { ok: false, codigo }}
 */
function prepararBorrador({ bolsaId = null, item = null, lumens = 0 }) {
    lumens = Number(lumens || 0)
    if (!Number.isInteger(lumens) || lumens < 0) return c.fallo("ESTRUCTURA")
    if (bolsaId) {
        // Con bolsa, todo va dentro de la bolsa: no se suman pilas sueltas
        if (item || lumens) return c.fallo("ESTRUCTURA")
        return c.ok({ borrador: { bolsaId, item: null, lumens: 0 } })
    }
    const pilas = item ? 1 : 0
    if (pilas > cfg.PILAS_SIN_BOLSA) return c.fallo("ESTRUCTURA")
    if (item && !(Number.isInteger(Number(item.cantidad)) && Number(item.cantidad) >= 1 && Number(item.cantidad) <= cfg.CANTIDAD_MAX_PILA)) return c.fallo("CANTIDAD_INVALIDA")
    if (!pilas && !lumens) return c.fallo("VACIO")
    if (lumens > cfg.LUMENS_MAX_POR_REGALO) return c.fallo("LUMENS_MAX")
    return c.ok({ borrador: { bolsaId: null, item: item ? { ID: Number(item.ID), Region: item.Region, cantidad: Number(item.cantidad) } : null, lumens } })
}

/**
 * Valida (en el orden del diseño) y envía. Al primer fallo devuelve su código.
 * @param {Object} p
 * @param {Object} p.remitente   Personaje activo (documento completo)
 * @param {Object|null} p.alma   Soul del remitente
 * @param {{ pjId?: number, userId?: string }} p.destino
 * @param {Object} p.borrador    Salida de prepararBorrador
 */
async function enviarRegalo({ remitente, alma, destino, borrador }) {
    // 1. Estructura
    const est = prepararBorrador({ bolsaId: borrador?.bolsaId, item: borrador?.item, lumens: borrador?.lumens })
    if (!est.ok) return est
    const b = est.borrador

    // 2. HP del remitente (solo si ya despertó su alma)
    if (alma && c.hpDe(alma) <= 0) return c.fallo("HP_CERO_ENVIAR")

    // 3. Ocupado (combate / exploración / evento)
    if (await c.estaOcupado(remitente)) return c.fallo("OCUPADO")

    // 4. El destinatario existe, tiene alma
    const dest = await resolverDestino(destino || {})
    if (!dest) return c.fallo("DESTINO_NO_EXISTE")
    if (String(dest._id) === String(remitente._id)) return c.fallo("MISMO_PERSONAJE")

    // 5. Nunca entre personajes de la misma cuenta
    if (!remitente.ownerID || !dest.ownerID || String(dest.ownerID) === String(remitente.ownerID)) return c.fallo("DESTINO_INVALIDO")

    const almaDest = await c.leerAlma(dest._id)
    if (!almaDest) return c.fallo("SIN_ALMA")

    // 6. Privacidad "Regalos" (+ bloqueados, que siempre ganan). Mismo código
    //    para ambos casos: no se revela que hay un bloqueo.
    if (!await evaluarPermisoPrivacidad(dest, remitente, "regalos", dbRol, "todos")) return c.fallo("NO_RECIBE_REGALOS")

    // 7. Posesión: bolsa / ítems / Lumens
    const fresco = await c.leerPersonaje(remitente._id, { [c.INV]: 1, "economia.Lumens": 1 })
    let contenido, envoltura, bolsaEntrada = null, lumensACongelar = 0
    if (b.bolsaId) {
        bolsaEntrada = (fresco?.economia?.Inventario || []).find(e => e.instanciaID === b.bolsaId)
        if (!bolsaEntrada || !bolsa.datosRegalo(bolsaEntrada)) return c.fallo("SIN_BOLSA")
        if (bolsa.estadoDe(bolsaEntrada) !== "cerrado") return c.fallo("BOLSA_NO_CERRADA")
        const datos = bolsa.datosRegalo(bolsaEntrada)
        contenido = {
            items: bolsa.itemsDe(bolsaEntrada).map(i => ({ itemId: Number(i.ID), region: i.Region, nombre: i.Nombre, cantidad: Number(i.Cantidad) })),
            lumens: Number(datos.lumens || 0),   // ya congelados al meterlos a la bolsa
        }
        envoltura = {
            bolsa: true,
            bolsaItem: { ID: bolsaEntrada.ID, Region: bolsaEntrada.Region, Nombre: definicionDe(bolsaEntrada)?.Nombre || "Bolsa de regalo" },
            titulo: datos.titulo || "", nota: datos.nota || "", banner: datos.banner || null, color: datos.color ?? null,
        }
    } else {
        const items = []
        if (b.item) {
            const pila = (fresco?.economia?.Inventario || []).find(e =>
                !e.instanciaID && Number(e.ID) === b.item.ID && (!b.item.Region || e.Region === b.item.Region))
            if (!pila) return c.fallo("FONDOS")
            if (!entradaRegalable(pila) || cfg.esBolsaRegalo(pila)) return c.fallo("ITEM_NO_REGALABLE")
            if (Number(pila.Cantidad) < b.item.cantidad) return c.fallo("FONDOS")
            items.push({ itemId: Number(pila.ID), region: pila.Region, nombre: pila.Nombre, cantidad: b.item.cantidad })
        }
        if (b.lumens > Number(fresco?.economia?.Lumens || 0)) return c.fallo("FONDOS")
        lumensACongelar = b.lumens
        contenido = { items, lumens: b.lumens }
        envoltura = { bolsa: false, bolsaItem: null, titulo: "", nota: "", banner: null, color: null }
    }

    // 8. Límites
    const de = c.normalizarId(remitente._id), para = c.normalizarId(dest._id)
    const hoy = inicioDiaMx()
    const [pendPareja, enviadosHoy, buzonDest, lumensHoy] = await Promise.all([
        buzon.countDocuments({ de, para, estado: { $in: ["pendiente", "reportado"] } }),
        buzon.countDocuments({ de, creadoEn: { $gte: hoy } }),
        buzon.countDocuments({ para, estado: { $in: ["pendiente", "reportado"] } }),
        contenido.lumens > 0
            ? buzon.aggregate([{ $match: { de, para, creadoEn: { $gte: hoy } } }, { $group: { _id: null, t: { $sum: "$contenido.lumens" } } }]).toArray()
            : [],
    ])
    if (pendPareja >= cfg.LIMITE_PENDIENTES_PAREJA) return c.fallo("LIMITE_PENDIENTES")
    if (enviadosHoy >= cfg.LIMITE_ENVIADOS_DIA) return c.fallo("LIMITE_DIARIO")
    if (buzonDest >= cfg.BUZON_MAX) return c.fallo("BUZON_LLENO")
    if (contenido.lumens > 0 && (lumensHoy[0]?.t || 0) + contenido.lumens > cfg.LUMENS_TOPE_DIARIO_PAREJA) return c.fallo("LUMENS_TOPE")

    // ── Envío atómico ───────────────────────────────────────────────────────
    const ahora = new Date()
    const doc = {
        _id: new ObjectId(),
        tipo: "regalo",
        de, para,
        deUserId: String(remitente.ownerID), paraUserId: String(dest.ownerID),
        deNombre: c.nombreDe(remitente), paraNombre: c.nombreDe(dest),
        contenido, envoltura,
        estado: "pendiente",
        creadoEn: ahora,
        venceEn: new Date(ahora.getTime() + cfg.DIAS_VENCE * cfg.DIA),
        abiertoEn: null, devueltoEn: null,
        valor: null, puntosOtorgados: null, amistad: null, reporte: null,
        pendienteLumens: false, pendienteAmistad: false,
    }

    // Sin bolsa, los Lumens se congelan aquí (con bolsa ya lo estaban)
    if (lumensACongelar > 0 && !await congelarLumens(de, lumensACongelar)) return c.fallo("FONDOS")

    const r = await c.enTransaccion(async (session) => {
        if (bolsaEntrada) {
            await c.quitarInstancia(de, bolsaEntrada.instanciaID, session, { "Metadata.regalo.estado": "cerrado" })
        } else if (contenido.items.length) {
            const i = contenido.items[0]
            await c.quitarPila(de, { ID: i.itemId, Region: i.region }, i.cantidad, session)
        }
        await buzon.insertOne(doc, { session })
    })
    if (!r.ok) {
        if (lumensACongelar > 0) await descongelarLumens(de, lumensACongelar)
        return r
    }

    notificar(para, "🎁 ¡Te llegó un regalo!", `${doc.deNombre} te dejó algo en el buzón. Ábrelo con /rol buzon ♡`)
    return c.ok({ regaloId: String(doc._id), destinatario: { _id: dest._id, nombre: doc.paraNombre } })
}

// ─── Buzón (la lista vive en functions/Buzon/buzon.js) ───────────────────────
/** Un regalo, solo si es para este personaje. */
async function obtenerRegalo({ personaje, regaloId }) {
    const _id = aObjectId(regaloId)
    if (!_id) return c.fallo("NO_EXISTE")
    // El buzón también guarda otras notificaciones (cartas, sistema): solo regalos
    const doc = await buzon.findOne({ _id, tipo: { $in: [null, "regalo"] } })
    if (!doc) return c.fallo("NO_EXISTE")
    if (String(doc.para) !== String(personaje._id)) return c.fallo("NO_ES_TUYO")
    return c.ok({ regalo: doc })
}

// ─── Valor y antiabuso ───────────────────────────────────────────────────────
/**
 * Puntúa el regalo marcando las pilas que no deben sumar:
 *  • Reciclado: el REMITENTE recibió ese mismo itemId (de cualquiera) en la
 *    ventana → esa pila no suma. Corta el ciclo A→B→A con el mismo objeto.
 *  • Lumens: el destinatario le mandó al remitente una cantidad parecida en la
 *    ventana → la pila de Lumens no suma. Corta el ping-pong de dinero.
 * El tope diario por pareja lo sigue aplicando el sistema de amistad.
 */
async function valorarRegalo(doc, ahora = Date.now()) {
    const items = doc.contenido?.items || []
    const lumens = Number(doc.contenido?.lumens || 0)

    const [recibidos, enviadosInverso] = await Promise.all([
        items.length
            ? buzon.find(
                { para: doc.de, estado: "abierto", abiertoEn: { $gte: new Date(ahora - cfg.RECICLADO_VENTANA_MS) } },
                { projection: { "contenido.items": 1 } }
            ).toArray()
            : [],
        lumens > 0
            ? buzon.find(
                { de: doc.para, para: doc.de, creadoEn: { $gte: new Date(ahora - cfg.LUMENS_SIMILAR_VENTANA_MS) }, "contenido.lumens": { $gt: 0 } },
                { projection: { "contenido.lumens": 1 } }
            ).toArray()
            : [],
    ])
    const reciclados = new Set(recibidos.flatMap(r => (r.contenido?.items || []).map(i => `${i.region}:${i.itemId}`)))
    const pingPong = enviadosInverso.some(r => Math.abs(r.contenido.lumens - lumens) <= cfg.LUMENS_SIMILAR_TOLERANCIA * lumens)

    const pilas = items.map(i => ({
        def: definicionDe({ ID: i.itemId, Region: i.region }),
        cantidad: i.cantidad,
        excluir: reciclados.has(`${i.region}:${i.itemId}`),
    }))
    if (lumens > 0) pilas.push({ lumens, excluir: pingPong })

    const v = valor.puntuarRegalo(pilas)
    const excluidas = v.pilas.filter(p => p.excluida).map(p => p.nombre)
    return { S: v.S, etiqueta: v.etiqueta, factores: v.factores, mejor: v.mejor, excluidas }
}

// ─── Abrir ───────────────────────────────────────────────────────────────────
/**
 * Abre un regalo del buzón. Solo el personaje `para`, solo si está pendiente.
 * @returns {Promise<{ ok: true, items, lumens, etiqueta, amistad: { delta, topeAlcanzado, rango, etiqueta, linea } } | { ok: false, codigo }>}
 */
async function abrirRegalo({ personaje, alma, regaloId }) {
    const r0 = await obtenerRegalo({ personaje, regaloId })
    if (!r0.ok) return r0
    const doc = r0.regalo
    if (doc.estado === "abierto") return c.fallo("YA_ABIERTO")
    if (doc.estado === "devuelto" || doc.estado === "descartado") return c.fallo("DEVUELTO")
    if (doc.estado === "reportado") return c.fallo("REPORTADO")

    // 1. HP = 0: se puede recibir y guardar, pero no abrir
    if (!alma) return c.fallo("SIN_ALMA")
    if (c.hpDe(alma) <= 0) return c.fallo("HP_CERO_ABRIR")

    // 2. Ocupado: los consumibles saltarían el tope de la mochila
    if (await c.estaOcupado(personaje)) return c.fallo("OCUPADO")

    // Entra entero o se queda en el buzón (max_inventario)
    const items = doc.contenido?.items || []
    const fresco = await c.leerPersonaje(personaje._id, { [c.INV]: 1, "economia.Mochila": 1 })
    const { sobrantes, aviso } = await limitarEntradas(fresco, items.map(i => ({ ID: i.itemId, Region: i.region, Cantidad: i.cantidad, Nombre: i.nombre })))
    if (sobrantes.length) return c.fallo("INVENTARIO_LLENO", { aviso })

    const val = await valorarRegalo(doc)
    const lumens = Number(doc.contenido?.lumens || 0)

    // ── Apertura atómica: estado + ítems ────────────────────────────────────
    const r = await c.enTransaccion(async (session) => {
        const u = await buzon.updateOne(
            { _id: doc._id, estado: "pendiente" },
            { $set: { estado: "abierto", abiertoEn: new Date(), valor: val, pendienteLumens: lumens > 0, pendienteAmistad: true } },
            { session }
        )
        if (u.modifiedCount !== 1) throw new c.ErrorRegalo("YA_ABIERTO")
        await c.agregarPilas(personaje._id, items.map(i => ({ ID: i.itemId, Region: i.region, Nombre: i.nombre, Cantidad: i.cantidad })), session)
    })
    if (!r.ok) return r

    await completarLumens({ ...doc, estado: "abierto" })
    const amistad = await completarAmistad({ ...doc, estado: "abierto", valor: val })

    return c.ok({ items, lumens, etiqueta: val.etiqueta, amistad })
}

/** Paso posterior: mueve los Lumens del sobre. Idempotente (bandera + opId). */
async function completarLumens(doc) {
    const lumens = Number(doc.contenido?.lumens || 0)
    if (!(lumens > 0)) return
    // Reclamar: solo un proceso pasa de aquí
    const claim = await buzon.updateOne({ _id: doc._id, pendienteLumens: true }, { $set: { pendienteLumens: false } })
    if (claim.modifiedCount !== 1) return

    if (doc.estado === "abierto") {
        const t = await transferirLumens(
            { personajeId: doc.de, userId: doc.deUserId },
            { personajeId: doc.para, userId: doc.paraUserId },
            lumens,
            { motivo: "regalo", ref: { regaloId: String(doc._id) }, opId: `regalo:${doc._id}`, desdeCongelado: true }
        )
        if (!t.ok) {
            // El remitente ya no existe (su congelado salió del sistema con registrarBaja):
            // se acredita como fuente para que el destinatario no pierda su regalo y el
            // libro siga cuadrando.
            const remitente = await c.leerPersonaje(doc.de, { _id: 1 })
            if (!remitente) {
                await moverLumens({ personajeId: doc.para, userId: doc.paraUserId, delta: lumens, tipo: "fuente", motivo: "regalo", ref: { regaloId: String(doc._id), huerfano: true }, opId: `regalo:${doc._id}:huerfano` })
            } else {
                console.error(`[Regalos] No se pudieron transferir ${lumens} Lumens del regalo ${doc._id}:`, t.motivo)
                await buzon.updateOne({ _id: doc._id }, { $set: { pendienteLumens: true } })   // se reintenta en el barrido
            }
        }
    } else if (doc.estado === "devuelto") {
        const devueltos = await descongelarLumens(doc.de, lumens)
        if (devueltos !== lumens) console.error(`[Regalos] Devolución de ${doc._id}: solo se descongelaron ${devueltos}/${lumens} Lumens`)
    }
}

/**
 * Paso posterior: amistad. Los puntos se aplican al ABRIR (no al enviar: si no,
 * regalar a alguien inactivo sería farmeo). Nunca negativos.
 */
async function completarAmistad(doc) {
    const claim = await buzon.updateOne({ _id: doc._id, pendienteAmistad: true }, { $set: { pendienteAmistad: false } })
    if (claim.modifiedCount !== 1) return null

    const S = doc.valor?.S ?? 0
    const propuestos = valor.puntosAmistad(S, Boolean(doc.envoltura?.bolsa))
    const [emisor, receptor] = await Promise.all([
        c.leerPersonaje(doc.de, { ownerID: 1 }),
        c.leerPersonaje(doc.para, { ownerID: 1 }),
    ])
    const etiqueta = doc.valor?.etiqueta || valor.etiquetaDe(S)
    if (!emisor || !receptor) return { delta: 0, topeAlcanzado: false, rango: null, etiqueta, linea: LINEA_AMISTAD.sinAmistad }

    const { resolverInteraccion } = require("../Amistad/amistades")
    const res = await resolverInteraccion({ tipo: "regalo", respuesta: "abrir", emisor, receptor, puntosBase: propuestos })
    if (!res.ok) {
        console.error(`[Regalos] Amistad del regalo ${doc._id}:`, res.motivo)
        return { delta: 0, topeAlcanzado: false, rango: null, etiqueta, linea: LINEA_AMISTAD.sinAmistad }
    }
    const rr = res.resultado
    const topeAlcanzado = rr.motivoSinPuntos === "tope_ganancia" || rr.motivoSinPuntos === "menguante" || rr.recortado
    await buzon.updateOne({ _id: doc._id }, { $set: { puntosOtorgados: rr.puntos, amistad: { propuestos, motivoSinPuntos: rr.motivoSinPuntos || null, recortado: !!rr.recortado } } })

    let linea = LINEA_AMISTAD.sinValor
    if (rr.puntos > 0) linea = rr.recortado ? LINEA_AMISTAD.tope : LINEA_AMISTAD.suma
    else if (topeAlcanzado) linea = LINEA_AMISTAD.tope
    return { delta: rr.puntos, topeAlcanzado, rango: rr.rango?.nombre ?? null, etiqueta, linea }
}

// ─── Reportes ────────────────────────────────────────────────────────────────
/**
 * Reporta un regalo (pendiente o abierto). Guarda una instantánea, oculta la
 * nota al reportante y congela el regalo si estaba pendiente. Nunca se resuelve
 * solo, y no toca la Reputación Social.
 */
async function reportarRegalo({ personaje, userId, regaloId, motivo, texto = "" }) {
    const r0 = await obtenerRegalo({ personaje, regaloId })
    if (!r0.ok) return r0
    const doc = r0.regalo
    if (!cfg.MOTIVOS_REPORTE.some(m => m.id === motivo)) return c.fallo("REPORTE_MOTIVO")
    if (doc.reporte) return c.fallo("REPORTE_YA")
    if (!["pendiente", "abierto"].includes(doc.estado)) return c.fallo("NO_EXISTE")

    const hoy = inicioDiaMx()
    const usados = await reportes.countDocuments({ reportanteUserId: String(userId), creadoEn: { $gte: hoy } })
    if (usados >= cfg.REPORTES_POR_DIA) return c.fallo("REPORTE_LIMITE")

    const ahora = new Date()
    const reporte = {
        _id: new ObjectId(),
        regaloId: doc._id,
        reportantePj: c.normalizarId(personaje._id),
        reportanteUserId: String(userId),
        motivo,
        texto: String(texto || "").trim().slice(0, cfg.REPORTE_TEXTO_MAX),
        estado: "abierto",            // abierto | resuelto (solo a mano, desde el dashboard)
        creadoEn: ahora,
        conservarHasta: new Date(ahora.getTime() + cfg.RETENCION_REPORTES_DIAS * cfg.DIA),
        // Instantánea: sobrevive aunque el regalo se purgue
        instantanea: {
            de: doc.de, para: doc.para, deUserId: doc.deUserId, paraUserId: doc.paraUserId,
            deNombre: doc.deNombre, paraNombre: doc.paraNombre,
            envoltura: doc.envoltura, contenido: doc.contenido,
            creadoEn: doc.creadoEn, abiertoEn: doc.abiertoEn, estadoAlReportar: doc.estado,
        },
    }

    // TODO(decisión): destino de los reportes. Hoy van a reportes_regalo (gancho
    // para el dashboard); si se conecta el sistema de tickets, enviarlo aquí.
    // TODO(decisión): confirmar que un regalo PENDIENTE reportado queda congelado
    // (no se abre ni vence) hasta que el staff lo resuelva.
    const r = await c.enTransaccion(async (session) => {
        await reportes.insertOne(reporte, { session })
        const set = { reporte: { id: reporte._id, motivo, en: ahora, notaOculta: true } }
        if (doc.estado === "pendiente") set.estado = "reportado"
        const u = await buzon.updateOne({ _id: doc._id, reporte: null, estado: doc.estado }, { $set: set }, { session })
        if (u.modifiedCount !== 1) throw new c.ErrorRegalo("REPORTE_YA")
    })
    if (!r.ok) return r
    return c.ok({ reporteId: String(reporte._id), congelado: doc.estado === "pendiente" })
}

/**
 * Para el staff (dashboard): resuelve un reporte A MANO.
 *   accion "liberar"  → el regalo reportado vuelve a "pendiente" (con su plazo renovado)
 *   accion "devolver" → vuelve al remitente como un vencido
 *   accion "cerrar"   → solo cierra el reporte (para regalos ya abiertos)
 * TODO(decisión): ¿qué acciones quiere el staff y quién puede usarlas?
 */
async function resolverReporte({ reporteId, accion, staffId }) {
    const rep = await reportes.findOne({ _id: aObjectId(reporteId) })
    if (!rep || rep.estado !== "abierto") return c.fallo("NO_EXISTE")
    const doc = await buzon.findOne({ _id: rep.regaloId })
    if (doc?.estado === "reportado") {
        if (accion === "liberar") {
            await buzon.updateOne({ _id: doc._id, estado: "reportado" }, { $set: { estado: "pendiente", venceEn: new Date(Date.now() + cfg.DIAS_VENCE * cfg.DIA) } })
        } else if (accion === "devolver") {
            await buzon.updateOne({ _id: doc._id, estado: "reportado" }, { $set: { estado: "pendiente", venceEn: new Date(0) } })
            await devolver({ ...doc, estado: "pendiente" }, "reporte")
        }
    }
    await reportes.updateOne({ _id: rep._id }, { $set: { estado: "resuelto", resueltoEn: new Date(), accion, staffId: staffId ? String(staffId) : null } })
    return c.ok()
}

// ─── Devolución y barrido ────────────────────────────────────────────────────
/**
 * Devuelve un regalo pendiente a su remitente (ítems y Lumens; la bolsa NO).
 * Idempotente: solo actúa si el regalo sigue "pendiente".
 */
async function devolver(doc, motivo) {
    const remitente = await c.leerPersonaje(doc.de, { _id: 1 })
    if (!remitente) {
        // El remitente ya no existe: se descarta con registro (el propio documento).
        const u = await buzon.updateOne({ _id: doc._id, estado: "pendiente" }, { $set: { estado: "descartado", devueltoEn: new Date(), motivoDevolucion: `${motivo}:remitente_inexistente` } })
        if (u.modifiedCount === 1) console.log(`[Regalos] Regalo ${doc._id} descartado: el remitente ${doc.de} ya no existe`)
        return
    }

    const items = doc.contenido?.items || []
    const lumens = Number(doc.contenido?.lumens || 0)
    const r = await c.enTransaccion(async (session) => {
        const u = await buzon.updateOne(
            { _id: doc._id, estado: "pendiente" },
            { $set: { estado: "devuelto", devueltoEn: new Date(), motivoDevolucion: motivo, pendienteLumens: lumens > 0 } },
            { session }
        )
        if (u.modifiedCount !== 1) throw new c.ErrorRegalo("YA_ABIERTO")   // otro proceso ya lo resolvió
        // Directo a SU inventario y sin tope: ya eran suyos
        await c.agregarPilas(doc.de, items.map(i => ({ ID: i.itemId, Region: i.region, Nombre: i.nombre, Cantidad: i.cantidad })), session)
    })
    if (!r.ok) return

    await completarLumens({ ...doc, estado: "devuelto" })
    const porque = motivo === "vencido" ? "pasaron muchos días sin que lo abrieran" : "no pudo entregarse"
    notificar(doc.de, "🎁 Tu regalo volvió a casa", `El regalo para ${doc.paraNombre} regresó porque ${porque}. Todo está otra vez en tu inventario ♡`)
}

let barridoEnCurso = false
/**
 * Barrido idempotente: devuelve vencidos, devuelve lo de destinatarios que ya
 * no existen, completa pasos pendientes (Lumens / amistad) y purga lo viejo.
 * Se llama al arrancar, cada N horas y de forma perezosa al abrir un buzón
 * (con `para`, solo los de ese personaje).
 */
async function procesarVencidos({ para = null } = {}) {
    const global = para === null
    if (global) {
        if (barridoEnCurso) return c.ok({ omitido: true })
        barridoEnCurso = true
    }
    const resumen = { devueltos: 0, huerfanos: 0, reintentos: 0, purgados: 0 }
    try {
        const ahora = new Date()
        const base = para !== null ? { para: c.normalizarId(para) } : {}

        // 1. Vencidos (los reportados no vencen: están congelados)
        const vencidos = await buzon.find({ ...base, estado: "pendiente", venceEn: { $lte: ahora } }).limit(200).toArray()
        for (const doc of vencidos) { await devolver(doc, "vencido"); resumen.devueltos++ }

        if (global) {
            // 2. Destinatarios que ya no existen → devolver al remitente
            const paras = await buzon.distinct("para", { estado: "pendiente" })
            if (paras.length) {
                const existen = new Set((await c.personajes.find({ _id: { $in: paras } }, { projection: { _id: 1 } }).toArray()).map(p => String(p._id)))
                const faltan = paras.filter(p => !existen.has(String(p)))
                if (faltan.length) {
                    const huerfanos = await buzon.find({ estado: "pendiente", para: { $in: faltan } }).limit(200).toArray()
                    for (const doc of huerfanos) { await devolver(doc, "destinatario_inexistente"); resumen.huerfanos++ }
                }
            }

            // 3. Pasos posteriores que quedaron a medias
            const aMedias = await buzon.find({ $or: [{ pendienteLumens: true }, { pendienteAmistad: true }] }).limit(200).toArray()
            for (const doc of aMedias) {
                if (doc.pendienteLumens) await completarLumens(doc)
                if (doc.pendienteAmistad && doc.estado === "abierto") await completarAmistad(doc)
                resumen.reintentos++
            }

            // 4. Retención (regla 13): nada resuelto se borra antes de RETENCION_DIAS.
            //    Los reportados no se purgan aquí (su instantánea vive en reportes_regalo).
            const limite = new Date(ahora.getTime() - cfg.RETENCION_DIAS * cfg.DIA)
            const p = await buzon.deleteMany({ estado: { $in: ["abierto", "devuelto", "descartado"] }, creadoEn: { $lt: limite }, reporte: null })
            resumen.purgados = p.deletedCount || 0

            // 5. Notificaciones genéricas del buzón (cartas, sistema) ya leídas
            const cfgBuzon = require("../../config/buzon")
            const limiteLeidas = new Date(ahora.getTime() - cfgBuzon.RETENCION_LEIDAS_DIAS * cfg.DIA)
            const q = await buzon.deleteMany({ tipo: { $nin: [null, "regalo"] }, estado: "leida", creadoEn: { $lt: limiteLeidas } })
            resumen.purgados += q.deletedCount || 0
        }
        return c.ok(resumen)
    } finally {
        if (global) barridoEnCurso = false
    }
}

/** Llamar ANTES de borrar un personaje: sus regalos pendientes vuelven a los remitentes. */
async function alBorrarPersonaje(personaje) {
    if (!personaje?._id && personaje?._id !== 0) return
    const para = c.normalizarId(personaje._id)
    const pendientes = await buzon.find({ para, estado: "pendiente" }).toArray()
    for (const doc of pendientes) await devolver(doc, "destinatario_borrado")
}

let intervalo = null
/** Barrido al arrancar y cada BARRIDO_CADA_MS. */
function iniciarBarrido() {
    if (intervalo) return
    const correr = () => procesarVencidos()
        .then(r => { if (r?.ok && !r.omitido && (r.devueltos || r.huerfanos || r.reintentos || r.purgados)) console.log("[Regalos] Barrido:", r) })
        .catch(e => console.error("[Regalos] Error en el barrido:", e))
    correr()
    intervalo = setInterval(correr, cfg.BARRIDO_CADA_MS)
    intervalo.unref?.()
}

module.exports = {
    buzon,
    reportes,
    asegurarIndices,
    resolverDestino,
    prepararBorrador,
    enviarRegalo,
    obtenerRegalo,
    valorarRegalo,
    abrirRegalo,
    reportarRegalo,
    resolverReporte,
    procesarVencidos,
    alBorrarPersonaje,
    iniciarBarrido,
}
