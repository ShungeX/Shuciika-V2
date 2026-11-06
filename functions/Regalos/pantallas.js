// ─────────────────────────────────────────────────────────────────────────────
// Puente entre la lógica de regalos y la UI (data/UI_ComponentsV2/menuRegalo.js):
// lee los datos frescos y devuelve los componentes listos para responder.
// Los manejadores de interaction/** solo llaman a esto y responden.
// ─────────────────────────────────────────────────────────────────────────────
const ui = require("../../data/UI_ComponentsV2/menuRegalo")
const { texto } = require("../../config/mensajesRegalos")
const cfg = require("../../config/regalos")
const { definicionDe, entradaRegalable } = require("./leerItem")
const bolsa = require("./bolsa")
const regalos = require("./regalos")
const c = require("./comun")

const FLAGS_V2 = ["Ephemeral", "IsComponentsV2"]

/** Responde/actualiza un mensaje efímero V2 sin permitir menciones. */
async function responder(interaction, components, { nuevo = false } = {}) {
    const payload = { components, allowedMentions: ui.SIN_MENCIONES }
    if (nuevo) {
        payload.flags = FLAGS_V2
        if (interaction.deferred || interaction.replied) return interaction.followUp(payload)
        return interaction.reply(payload)
    }
    if (interaction.deferred || interaction.replied) return interaction.editReply(payload)
    return interaction.update(payload)
}

/** Aviso corto (texto plano efímero) para fallos fuera de un mensaje V2. */
function avisoEfimero(interaction, codigoOTexto, extra = "") {
    const base = /^[A-Z_]+$/.test(codigoOTexto) ? texto(codigoOTexto) : String(codigoOTexto)
    const contenido = base + (extra ? `\n-# ${extra}` : "")
    const payload = { content: contenido.slice(0, 2000), flags: ["Ephemeral"], allowedMentions: ui.SIN_MENCIONES }
    if (interaction.deferred || interaction.replied) return interaction.followUp(payload)
    return interaction.reply(payload)
}

// ─── Editor ──────────────────────────────────────────────────────────────────
const avisoDe = (aviso) => (aviso ? (/^[A-Z_]+$/.test(aviso) ? texto(aviso) : aviso) : null)

/**
 * Comprueba que el token es el editor vigente del usuario y del personaje activo.
 * Si el bot se reinició (el candado vive en memoria) y el personaje tiene una
 * bolsa armándose, el mensaje viejo la "adopta" con su mismo token: así un
 * reinicio no deja el editor inservible.
 * @returns {Promise<{ ok: true, sesion } | { ok: false, codigo }>}
 */
async function validarEditor(userId, character, token) {
    if (!character || !token) return { ok: false, codigo: "EDITOR_EXPIRADO" }
    let sesion = c.sesionEditor(userId, token)
    if (!sesion) {
        if (c.otroEditorActivo(userId, token)) return { ok: false, codigo: "EDITOR_OTRO" }
        const pj = await c.leerPersonaje(character._id, { [c.INV]: 1 })
        const enCurso = bolsa.bolsasDe(pj, "armando")[0]
        if (!enCurso) return { ok: false, codigo: "EDITOR_EXPIRADO" }
        c.abrirEditor(userId, character._id, enCurso.instanciaID, token)
        sesion = c.sesionEditor(userId, token)
    }
    if (String(sesion.pjId) !== String(character._id)) return { ok: false, codigo: "EDITOR_EXPIRADO" }
    return { ok: true, sesion }
}

/** Pantalla de "editor cerrado" con el motivo. */
const editorCerrado = (codigo = "EDITOR_EXPIRADO") => ui.construirAviso({ titulo: "Regalo", lineas: [`-# ${texto(codigo)}`] })

const regalablesDe = (personaje) => (personaje?.economia?.Inventario || [])
    .filter(e => !cfg.esBolsaRegalo(e) && entradaRegalable(e) && Number(e.Cantidad || 0) > 0)
    .map(e => ({ clave: `${e.Region || ""}:${Number(e.ID)}`, nombre: e.Nombre || definicionDe(e)?.Nombre || `Objeto ${e.ID}`, cantidad: Number(e.Cantidad || 0), entrada: e }))

/**
 * El MISMO selector de /rol inventario (lista, resumen, botones < Saltar pag. >
 * y filtro) alimentado con las entradas que se le pasen. Sus custom_ids usan
 * `action` con el token como primer extra.
 */
function inventarioUI({ userId, token, entradas, pagina = 1, filtros = ["fullbag"], action }) {
    const interfazCreate = require("../interfazCreate")   // diferido: arrastra media aplicación
    const activos = !filtros?.length || filtros.includes("fullbag") ? ["fullbag"] : filtros

    // Misma paginación que inventarioMensaje (10 por página, ordenado por ID)
    const filtradas = interfazCreate.filtrarInventario([...entradas], activos).sort((a, b) => Number(a.ID) - Number(b.ID))
    const paginas = Math.max(1, Math.ceil(filtradas.length / 10))
    const actual = Math.max(1, Math.min(Number(pagina) || 1, paginas))
    const itemsPagina = filtradas.slice((actual - 1) * 10, actual * 10)

    // characterId vacío en los custom_ids: manejarComponente resuelve el personaje activo
    const base = interfazCreate.inventarioMensaje(
        { user: { id: userId } },
        { _id: "", Nombre: "", economia: { Inventario: [...entradas] } },
        actual, activos,
        { action, baseExtras: [token] }
    )[0].components
    // [0] cabecera · [1] separador · [2] lista · [3] resumen · [4] separador · [5] navegación · [6] filtro
    return {
        lista: base[2].content,
        resumen: base[3],
        navegacion: base[5],
        filtro: base[6],
        pagina: actual,
        filtros: activos,
        itemsPagina,
    }
}

/** Inventario del editor de bolsas: solo lo que se puede meter (sin bolsas). */
function inventarioEditor({ userId, token, personaje, pagina = 1, filtros = ["fullbag"] }) {
    const entradas = regalablesDe(personaje).map(o => o.entrada)
    return inventarioUI({ userId, token, entradas, pagina, filtros, action: "regaloInv" })
}

/** Editor completo con datos frescos, o un aviso si la bolsa ya no está armándose. */
async function editor({ userId, token, pjId, aviso }) {
    const sesion = c.sesionEditor(userId, token)
    const pj = await c.leerPersonaje(pjId, { [c.INV]: 1 })
    const entrada = (pj?.economia?.Inventario || []).find(e => e.instanciaID === sesion?.instanciaID)
    if (!entrada || bolsa.estadoDe(entrada) !== "armando") {
        c.cerrarEditor(userId)
        return editorCerrado()
    }
    const inv = inventarioEditor({ userId, token, personaje: pj, pagina: sesion.pagina, filtros: sesion.filtros })
    sesion.pagina = inv.pagina
    sesion.filtros = inv.filtros

    const datos = bolsa.datosRegalo(entrada)
    return ui.construirEditor({
        userId, token,
        bolsa: entrada,
        nombreBolsa: definicionDe(entrada)?.Nombre || "Bolsa de regalo",
        contenido: bolsa.itemsDe(entrada).map(i => ({ nombre: i.Nombre, cantidad: i.Cantidad })),
        inventarioUI: inv,
        peso: bolsa.pesoDe(bolsa.itemsDe(entrada)),
        capacidad: datos.capacidad ?? bolsa.capacidadDe(entrada),
        aviso: avisoDe(aviso),
    })
}

/**
 * Opciones del modal "Agregar objetos": lo regalable de la página que el usuario
 * está viendo (como "Usar item" en el inventario y "Agregar" en las tiendas).
 */
async function opcionesAgregar({ userId, token, pjId }) {
    const sesion = c.sesionEditor(userId, token)
    const pj = await c.leerPersonaje(pjId, { [c.INV]: 1 })
    const inv = inventarioEditor({ userId, token, personaje: pj, pagina: sesion?.pagina, filtros: sesion?.filtros })
    return inv.itemsPagina.map(e => ({
        clave: `${e.Region || ""}:${Number(e.ID)}`,
        nombre: e.Nombre || definicionDe(e)?.Nombre || `Objeto ${e.ID}`,
        cantidad: Number(e.Cantidad || 0),
        peso: Number(definicionDe(e)?.atributos?.peso ?? e.atributos?.peso ?? 0),
    }))
}

/** Opciones del modal "Retirar objetos": lo que lleva la bolsa. */
async function opcionesRetirar({ userId, token, pjId }) {
    const entrada = await bolsa.obtenerBolsa(pjId, c.sesionEditor(userId, token)?.instanciaID)
    return bolsa.itemsDe(entrada).map(i => ({ clave: `${i.Region || ""}:${Number(i.ID)}`, nombre: i.Nombre, cantidad: Number(i.Cantidad) }))
}

async function vistaPreviaEditor({ userId, token, character, pagina = 0 }) {
    const entrada = await bolsa.obtenerBolsa(character._id, c.sesionEditor(userId, token)?.instanciaID)
    if (!entrada) return editor({ userId, token, pjId: character._id })
    const datos = bolsa.datosRegalo(entrada)
    return ui.construirVistaPrevia({
        de: c.nombreDe(character),
        para: null,
        avatarDe: c.avatarDe(character),
        titulo: datos.titulo,
        nota: datos.nota,
        items: bolsa.itemsDe(entrada).map(i => ({ nombre: i.Nombre, cantidad: i.Cantidad })),
        lumens: datos.lumens,
        banner: datos.banner,
        color: datos.color,
        pagina,
        idPagina: (p) => ui.idEditor("regaloBtn", userId, token, "prevpag", p),
        botones: [ui.boton(ui.idEditor("regaloBtn", userId, token, "volver"), "Volver al regalo", 2, false, "↩️")],
    })
}

// ─── Buzón (/rol buzon: regalos + cartas + avisos) ───────────────────────────
/**
 * Lista del buzón unificado. Acepta las vistas viejas de los regalos
 * ("pendientes" → nuevos, "abiertos" → todo) por los mensajes que sigan abiertos.
 */
async function buzon({ userId, personaje, vista = "nuevos", tipo = "todos", pagina = 0, aviso }) {
    const datosBuzon = require("../Buzon/buzon")
    const uiBuzon = require("../../data/UI_ComponentsV2/menuBuzon")
    if (vista === "pendientes") vista = "nuevos"
    if (vista === "abiertos") vista = "todo"
    if (!["nuevos", "todo"].includes(vista)) vista = "nuevos"
    const r = await datosBuzon.listar({ personaje, vista, tipo, pagina })
    return uiBuzon.construirBuzon({ userId, nombre: c.nombreDe(personaje), ...r, aviso: avisoDe(aviso) })
}

/** Abre cualquier cosa del buzón: un regalo va a su detalle; lo demás se marca como leído. */
async function verNotificacion({ userId, personaje, id }) {
    const datosBuzon = require("../Buzon/buzon")
    const uiBuzon = require("../../data/UI_ComponentsV2/menuBuzon")
    const doc = await datosBuzon.obtener({ personaje, id })
    if (!doc) return buzon({ userId, personaje, aviso: "NO_EXISTE" })
    if (datosBuzon.esRegalo(doc)) return detalle({ userId, personaje, regaloId: id })
    await datosBuzon.marcarLeida(doc)
    const remitente = doc.de !== null ? await c.leerPersonaje(doc.de, { "perfil.avatarURL": 1, avatarURL: 1 }) : null
    return uiBuzon.construirNotificacion({ userId, doc, avatar: c.avatarDe(remitente) })
}

async function detalle({ userId, personaje, regaloId, pagina = 0, lineasExtra = [] }) {
    const r = await regalos.obtenerRegalo({ personaje, regaloId })
    if (!r.ok) return buzon({ userId, personaje, aviso: r.codigo })
    const remitente = await c.leerPersonaje(r.regalo.de, { "perfil.avatarURL": 1, avatarURL: 1 })
    return ui.construirDetalleBuzon({ userId, regalo: r.regalo, avatarDe: c.avatarDe(remitente), pagina, lineasExtra })
}

/** Resultado de abrir un regalo del buzón. */
function resultadoApertura(personaje, res, regalo) {
    const lineas = []
    if (res.etiqueta) lineas.push(`-# *${res.etiqueta}*`, "")
    lineas.push("**Encontraste:**")
    for (const i of res.items) lineas.push(`- -# ${i.nombre} x${i.cantidad} `)
    if (res.lumens > 0) lineas.push(`- -# ${res.lumens} Lumens ${ui.EMOJI_LUMENS} `)
    if (res.amistad?.linea) lineas.push("", res.amistad.linea)
    return ui.construirAviso({ titulo: `${texto("ABIERTO")}`, lineas: [`-# De **${regalo.deNombre}**`, "", ...lineas], color: regalo.envoltura?.color ?? null })
}

module.exports = {
    FLAGS_V2,
    responder,
    avisoEfimero,
    validarEditor,
    editorCerrado,
    regalablesDe,
    inventarioUI,
    inventarioEditor,
    editor,
    opcionesAgregar,
    opcionesRetirar,
    vistaPreviaEditor,
    buzon,
    verNotificacion,
    detalle,
    resultadoApertura,
}
