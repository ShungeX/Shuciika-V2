// ─────────────────────────────────────────────────────────────────────────────
// Menú de /rol regalar (plantilla regalarMenuSuelto de menuRegalo.js).
//
// Lo elegido (regalo, Lumens sueltos, destinatario, página del inventario) vive
// en MEMORIA con un token por mensaje: no se descuenta nada hasta pulsar
// "Enviar", y ahí todo se vuelve a validar y se cobra en una transacción
// (regalos.enviarRegalo). Un menú por usuario: abrir otro cierra el anterior.
// ─────────────────────────────────────────────────────────────────────────────
const crypto = require("crypto")
const clientdb = require("../../Server")
const ui = require("../../data/UI_ComponentsV2/menuRegalo")
const { texto } = require("../../config/mensajesRegalos")
const cfg = require("../../config/regalos")
const { definicionDe } = require("./leerItem")
const bolsa = require("./bolsa")
const regalos = require("./regalos")
const c = require("./comun")
const P = require("./pantallas")

const amistades = clientdb.db("Rol_db").collection("amistades")
const RELACIONES_POR_PAGINA = 10

// ─── Sesiones ────────────────────────────────────────────────────────────────
const sesiones = new Map()     // token → sesión
const porUsuario = new Map()   // userId → token

function abrirMenu(userId, pjId, destino = null) {
    const previo = porUsuario.get(String(userId))
    if (previo) sesiones.delete(previo)
    const token = crypto.randomBytes(5).toString("hex")
    sesiones.set(token, {
        userId: String(userId), pjId: c.normalizarId(pjId),
        destino: destino !== null ? c.normalizarId(destino) : null,
        seleccion: null,          // { tipo: "bolsa", instanciaID } | { tipo: "item", ID, Region, cantidad }
        lumens: 0,                // solo sin bolsa
        pagina: 1, filtros: ["fullbag"],
        vence: Date.now() + cfg.EDITOR_TTL_MS,
    })
    porUsuario.set(String(userId), token)
    return token
}

/** Sesión vigente del token para este usuario y su personaje activo (renueva el plazo). */
function sesionMenu(userId, character, token) {
    const s = sesiones.get(token)
    if (!s || s.userId !== String(userId) || Date.now() > s.vence || String(s.pjId) !== String(character?._id)) return null
    s.vence = Date.now() + cfg.EDITOR_TTL_MS
    return s
}

function cerrarMenu(userId, token) {
    sesiones.delete(token)
    if (porUsuario.get(String(userId)) === token) porUsuario.delete(String(userId))
}

setInterval(() => {
    const ahora = Date.now()
    for (const [t, s] of sesiones) if (ahora > s.vence) cerrarMenu(s.userId, t)
}, 5 * 60 * 1000).unref?.()

const menuCerrado = (codigo = "MENU_EXPIRADO") => ui.construirAviso({ titulo: "Regalo", lineas: [`-# ${texto(codigo)}`] })
const avisoDe = (aviso) => (aviso ? (/^[A-Z_]+$/.test(aviso) ? texto(aviso) : aviso) : null)

// ─── Inventario del menú ─────────────────────────────────────────────────────
const nombreItem = (e) => e?.Nombre || definicionDe(e)?.Nombre || `Objeto ${e?.ID}`
const esBolsaCerrada = (e) => e?.instanciaID && bolsa.datosRegalo(e) && bolsa.estadoDe(e) === "cerrado"
const nombreBolsa = (e) => bolsa.datosRegalo(e)?.titulo || definicionDe(e)?.Nombre || e?.Nombre || "Bolsa de regalo"

/** Lo que se puede enviar: bolsas cerradas + objetos regalables. */
const entradasMenu = (pj) => [
    ...(pj?.economia?.Inventario || []).filter(esBolsaCerrada),
    ...P.regalablesDe(pj).map(o => o.entrada),
]

const inventarioDe = (userId, token, pj, s) =>
    P.inventarioUI({ userId, token, entradas: entradasMenu(pj), pagina: s.pagina, filtros: s.filtros, action: "regalarInv" })

/**
 * Busca lo elegido en el inventario fresco. Si ya no está (lo usó, lo vendió,
 * lo envió desde otro lado...), devuelve null.
 */
function resolverSeleccion(pj, sel) {
    if (!sel) return null
    const inv = pj?.economia?.Inventario || []
    if (sel.tipo === "bolsa") {
        const e = inv.find(x => x.instanciaID === sel.instanciaID)
        return esBolsaCerrada(e) ? { entrada: e } : null
    }
    const e = P.regalablesDe(pj).find(o => o.entrada.Region === sel.Region && Number(o.entrada.ID) === Number(sel.ID))
    if (!e || e.cantidad < sel.cantidad) return null
    return { entrada: e.entrada }
}

// ─── Destinatario ────────────────────────────────────────────────────────────
async function textoDestino(pjId, destino) {
    if (destino === null || destino === undefined) return null
    const dest = await c.leerPersonaje(destino, { "perfil.Nombre": 1, Nombre: 1 })
    if (!dest) return null
    const { obtenerAmistad } = require("../Amistad/amistades")
    const { estado } = await obtenerAmistad(pjId, destino).catch(() => ({ estado: null }))
    const extra = estado?.existe ? ` · ${estado.rango?.nombre || ""} · ♡ ${estado.puntos}` : " · aún no se conocen"
    return `**${c.nombreDe(dest)}** (ID ${dest._id})${extra}`
}

// ─── Pantallas ───────────────────────────────────────────────────────────────
/** El menú principal con datos frescos. */
async function pantallaMenu({ userId, token, character, aviso }) {
    const s = sesiones.get(token)
    const pj = await c.leerPersonaje(character._id, { [c.INV]: 1 })

    // Si lo elegido ya no está, se suelta y se avisa
    let res = resolverSeleccion(pj, s.seleccion)
    if (s.seleccion && !res) {
        s.seleccion = null
        aviso = aviso || "SELECCION_PERDIDA"
    }

    const inv = inventarioDe(userId, token, pj, s)
    s.pagina = inv.pagina
    s.filtros = inv.filtros

    let seleccion = null
    if (res && s.seleccion.tipo === "bolsa") {
        seleccion = `🎀 **${nombreBolsa(res.entrada)}**`
    } else {
        const partes = []
        if (res) partes.push(`**${nombreItem(res.entrada)}** x${s.seleccion.cantidad}`)
        if (s.lumens > 0) partes.push(`**${s.lumens}** Lumens ${ui.EMOJI_LUMENS}`)
        seleccion = partes.join(" + ") || null
    }

    return ui.construirMenuRegalar({
        userId, token,
        seleccion,
        destino: await textoDestino(character._id, s.destino),
        inventarioUI: inv,
        hayBolsa: s.seleccion?.tipo === "bolsa",
        haySeleccion: Boolean(s.seleccion || s.lumens > 0),
        aviso: avisoDe(aviso),
    })
}

/** Opciones del modal "Elegir regalo": lo de la página que se está viendo. */
async function opcionesElegir({ userId, token, character }) {
    const s = sesiones.get(token)
    const pj = await c.leerPersonaje(character._id, { [c.INV]: 1 })
    return inventarioDe(userId, token, pj, s).itemsPagina.map(e => esBolsaCerrada(e)
        ? { valor: `b|${e.instanciaID}`, nombre: nombreBolsa(e), descripcion: `Bolsa cerrada · ${bolsa.itemsDe(e).length} ${bolsa.itemsDe(e).length === 1 ? "objeto" : "objetos"} dentro`, emoji: "🎀" }
        : { valor: `i|${e.Region}|${Number(e.ID)}`, nombre: nombreItem(e), descripcion: `Tienes ${Number(e.Cantidad || 0)} · se envía suelto` })
}

/**
 * Aplica lo elegido en el modal.
 * @returns {Promise<string|null>} Código de aviso (null si todo bien)
 */
async function elegir({ token, character, valor, cantidadTxt }) {
    const s = sesiones.get(token)
    const pj = await c.leerPersonaje(character._id, { [c.INV]: 1 })
    const [tipo, a, b] = String(valor || "").split("|")
    if (tipo === "b") {
        if (!resolverSeleccion(pj, { tipo: "bolsa", instanciaID: a })) return "BOLSA_NO_CERRADA"
        s.seleccion = { tipo: "bolsa", instanciaID: a }
        // Con bolsa no van Lumens sueltos: viajan dentro de ella
        if (s.lumens > 0) { s.lumens = 0; return "LUMENS_CON_BOLSA" }
        return null
    }
    if (tipo === "i") {
        const cantidad = Number(String(cantidadTxt || "").trim())
        if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > cfg.CANTIDAD_MAX_PILA) return "CANTIDAD_INVALIDA"
        const sel = { tipo: "item", Region: a, ID: Number(b), cantidad }
        if (!resolverSeleccion(pj, sel)) return "FONDOS"
        s.seleccion = sel
        return null
    }
    return "ESTRUCTURA"
}

function ponerLumens({ token, lumensTxt }) {
    const s = sesiones.get(token)
    if (s.seleccion?.tipo === "bolsa") return "LUMENS_CON_BOLSA"
    const n = Number(String(lumensTxt || "").trim())
    if (!Number.isInteger(n) || n < 0) return "CANTIDAD_INVALIDA"
    if (n > cfg.LUMENS_MAX_POR_REGALO) return "LUMENS_MAX"
    s.lumens = n
    return null
}

/** Pone el destinatario por ID de personaje. */
async function ponerDestino({ token, character, idTxt }) {
    const s = sesiones.get(token)
    const id = String(idTxt || "").trim()
    if (!/^\d{1,18}$/.test(id)) return "ID_INVALIDA"
    if (String(id) === String(character._id)) return "MISMO_PERSONAJE"
    const dest = await c.leerPersonaje(id, { _id: 1, ownerID: 1 })
    if (!dest) return "DESTINO_NO_EXISTE"
    if (String(dest.ownerID) === String(character.ownerID)) return "DESTINO_INVALIDO"
    s.destino = c.normalizarId(id)
    return null
}

/** Relaciones del personaje, de más puntos a menos. */
async function pantallaRelaciones({ userId, token, character, pagina = 0, aviso }) {
    const reglas = require("../Amistad/reglasAmistad")
    const yo = String(character._id)
    const docs = await amistades.find({ miembros: yo }).toArray()
    const ahora = Date.now()
    const otros = docs.map(d => {
        const est = reglas.estadoAmistad(d, ahora)
        return { id: (d.miembros || []).find(m => String(m) !== yo), puntos: est.puntos, rango: est.rango?.nombre || "" }
    }).filter(r => r.id !== undefined)

    // Nombres (y de paso se descartan personajes que ya no existen)
    const pjs = otros.length
        ? await c.personajes.find({ _id: { $in: otros.map(r => c.normalizarId(r.id)) } }, { projection: { "perfil.Nombre": 1, Nombre: 1 } }).toArray()
        : []
    const nombres = new Map(pjs.map(p => [String(p._id), c.nombreDe(p)]))
    const filas = otros.filter(r => nombres.has(String(r.id)))
        .map(r => ({ ...r, nombre: nombres.get(String(r.id)) }))
        .sort((x, y) => y.puntos - x.puntos)

    const paginas = Math.max(1, Math.ceil(filas.length / RELACIONES_POR_PAGINA))
    pagina = Math.max(0, Math.min(Number(pagina) || 0, paginas - 1))
    return ui.construirRelaciones({
        userId, token,
        filas: filas.slice(pagina * RELACIONES_POR_PAGINA, (pagina + 1) * RELACIONES_POR_PAGINA),
        pagina, paginas, total: filas.length,
        aviso: avisoDe(aviso || (filas.length ? null : "SIN_RELACIONES")),
    })
}

/**
 * Vista previa con lo que se va a enviar y el botón Enviar.
 * @returns {Promise<{ ok: true, componentes } | { ok: false, codigo }>}
 */
async function pantallaPreview({ userId, token, character, pagina = 0 }) {
    const s = sesiones.get(token)
    if (!s.seleccion && !(s.lumens > 0)) return c.fallo("SIN_SELECCION")
    if (s.destino === null) return c.fallo("SIN_DESTINO")
    const pj = await c.leerPersonaje(character._id, { [c.INV]: 1 })
    const res = resolverSeleccion(pj, s.seleccion)
    if (s.seleccion && !res) { s.seleccion = null; return c.fallo("SELECCION_PERDIDA") }
    const dest = await c.leerPersonaje(s.destino, { "perfil.Nombre": 1, Nombre: 1 })
    if (!dest) return c.fallo("DESTINO_NO_EXISTE")

    let vista
    if (s.seleccion?.tipo === "bolsa") {
        const d = bolsa.datosRegalo(res.entrada)
        vista = { titulo: d.titulo, nota: d.nota, banner: d.banner, color: d.color, lumens: d.lumens, items: bolsa.itemsDe(res.entrada).map(i => ({ nombre: i.Nombre, cantidad: i.Cantidad })) }
    } else {
        vista = { items: res ? [{ nombre: nombreItem(res.entrada), cantidad: s.seleccion.cantidad }] : [], lumens: s.lumens }
    }
    const id = (...extras) => ui.idEditor("regalarBtn", userId, token, ...extras)
    return c.ok({
        componentes: ui.construirVistaPrevia({
            de: c.nombreDe(character),
            para: c.nombreDe(dest),
            avatarDe: c.avatarDe(character),
            ...vista,
            pagina,
            idPagina: (p) => id("prevpag", p),
            lineasExtra: ["-# Revisa que todo esté bien antes de enviarlo ♡"],
            botones: [ui.boton(id("enviar"), "Enviar", 3, false, "🎁"), ui.boton(id("volver"), "Volver", 2, false, "↩️")],
        }),
    })
}

/** Envía lo elegido. Todo se valida y se cobra en regalos.enviarRegalo. */
async function enviar({ userId, token, character, soul }) {
    const s = sesiones.get(token)
    const pre = regalos.prepararBorrador({
        bolsaId: s.seleccion?.tipo === "bolsa" ? s.seleccion.instanciaID : null,
        item: s.seleccion?.tipo === "item" ? { ID: s.seleccion.ID, Region: s.seleccion.Region, cantidad: s.seleccion.cantidad } : null,
        lumens: s.seleccion?.tipo === "bolsa" ? 0 : s.lumens,
    })
    if (!pre.ok) return pre
    if (s.destino === null) return c.fallo("SIN_DESTINO")
    const r = await regalos.enviarRegalo({ remitente: character, alma: soul, destino: { pjId: s.destino }, borrador: pre.borrador })
    if (r.ok) cerrarMenu(userId, token)
    return r
}

module.exports = {
    abrirMenu,
    sesionMenu,
    cerrarMenu,
    menuCerrado,
    pantallaMenu,
    opcionesElegir,
    elegir,
    ponerLumens,
    ponerDestino,
    pantallaRelaciones,
    pantallaPreview,
    enviar,
}
