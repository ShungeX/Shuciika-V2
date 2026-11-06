// functions/Objetos/usarObjeto.js
// Uso de objetos del inventario fuera de combate (botón "Usar item" de /rol inventario).
// Reemplaza al antiguo subcomando /rol usar.

const catalogoObjetos = require("../catalogoObjetos")
const updateInventario = require("../updateInventario")
const { moverLumens } = require("../Economia/lumens")
const { limitarEntradas } = require("./limiteInventario")

const MAX_USOS_POR_MODAL = 3
const SEP = "|"

// Cofre legado (ID 320): botín al azar + Lumens
const COFRE_ID = 320
const COFRE_BOTIN = [
    { id: 2, probabilidad: 80 },
    { id: 741, probabilidad: 10 },
    { id: 946, probabilidad: 8 },
    { id: 336, probabilidad: 1.5 },
    { id: 203, probabilidad: 0.5 },
]

const definicionDe = (item) => catalogoObjetos.getObjetoPorId(item.Region, item.ID)
const tiposDe = (def) => (Array.isArray(def?.Tipo) ? def.Tipo : [def?.Tipo]).filter(Boolean)

/**
 * Cómo se usa un objeto del inventario fuera de combate, o null si no se puede usar.
 * @returns {"regalo"|"bolsa"|"cofre"|"efecto"|null}
 */
function tipoDeUso(item) {
    const def = definicionDe(item)
    if (!def) return null

    // Bolsas de regalo (config/regalos.js): abren el editor, o la abre su dueño si ya está cerrada
    if (require("../../config/regalos").esBolsaRegalo(item)) return "regalo"

    if (def.isBag) {
        // Solo bolsas con contenido y que no estén a medio craftear
        if (!item.instanciaID || !item.Metadata?.items?.length) return null
        if (item.Metadata?.cache?.isFinish === false) return null
        return "bolsa"
    }
    if (Number(def.ID) === COFRE_ID) return "cofre"

    // Alimento de mascotas, incubadoras y huevos van por el sistema de mascotas
    if (def.atributos?.alimento || def.atributos?.incubadora) return null
    if (tiposDe(def).includes("Huevo")) return null

    if ((def.efectos || []).length && (def.uso?.contexto || "ambos") !== "combate") return "efecto"
    return null
}

const claveDe = (item) => [item.Region || "", item.ID, item.instanciaID || ""].join(SEP)

/** Opciones del select del modal: solo los objetos usables de la lista que se está viendo (máx. 25). */
function opcionesUsables(items) {
    return items
        .filter(item => tipoDeUso(item))
        .slice(0, 25)
        .map(item => ({
            label: `[${item.ID}] ${item.Nombre || `Objeto ${item.ID}`}`.slice(0, 100),
            value: claveDe(item),
            description: descripcionUso(item),
        }))
}

function descripcionUso(item) {
    const tipo = tipoDeUso(item)
    if (tipo === "bolsa") return "Abre la bolsa (1 por uso)"
    if (tipo === "regalo") {
        const estado = item.Metadata?.regalo?.estado
        if (estado === "cerrado") return "Regalo cerrado: ábrelo para recuperar su contenido"
        if (estado === "armando") return "Sigue armando este regalo"
        return `Arma un regalo · tienes x${item.Cantidad ?? 1}`
    }
    return `Tienes x${item.Cantidad ?? 1}`
}

function sortear(tabla) {
    let n = Math.random() * 100
    for (const entrada of tabla) {
        n -= entrada.probabilidad
        if (n < 0) return entrada.id
    }
    return tabla[0].id
}

/**
 * Usa un objeto del inventario del personaje activo.
 * @param {Object} p
 * @param {import('discord.js').Interaction} p.interaction
 * @param {Object} p.character - Personaje activo (inyectado por el router)
 * @param {Object|null} p.soul
 * @param {string} p.clave - Valor elegido en el select (Region|ID|instanciaID)
 * @param {string|number} p.cantidadTexto
 * @returns {Promise<{ ok: boolean, publico: boolean, titulo?: string, lineas: string[] }>}
 */
async function usarObjeto({ interaction, character, soul, clave, cantidadTexto }) {
    const fallo = (msg) => ({ ok: false, publico: false, lineas: [msg] })

    const cantidad = parseInt(String(cantidadTexto ?? "").trim(), 10)
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_USOS_POR_MODAL) {
        return fallo(`La cantidad debe ser un número del 1 al ${MAX_USOS_POR_MODAL} (╥﹏╥)`)
    }

    const [region, idRaw, instanciaID] = String(clave || "").split(SEP)
    const inventario = character.economia?.Inventario || []
    const item = instanciaID
        ? inventario.find(i => String(i.instanciaID) === instanciaID)
        : inventario.find(i => String(i.ID) === idRaw && (!region || !i.Region || i.Region === region) && !i.instanciaID)

    if (!item) return fallo("Ya no tienes ese objeto en tu inventario (╥﹏╥)")

    const tipo = tipoDeUso(item)
    if (!tipo) return fallo(`**${item.Nombre}** no se puede usar fuera de combate (╥﹏╥)`)

    if (tipo === "regalo") return usarBolsaRegalo({ interaction, character, soul, item })

    const def = definicionDe(item)
    const tiene = Number(item.Cantidad ?? 1)
    if (tipo !== "bolsa" && cantidad > tiene) {
        return fallo(`Solo tienes **${tiene}** de **${item.Nombre}** (╥﹏╥)`)
    }

    if (tipo === "bolsa") return abrirBolsa({ character, item })
    if (tipo === "cofre") return abrirCofres({ interaction, character, def, cantidad })
    return aplicarEfectos({ soul, def, cantidad })
}

async function aplicarEfectos({ soul, def, cantidad }) {
    if (!soul) {
        return {
            ok: false, publico: false, lineas: [
                "Este objeto requiere de Stats especificos que solamente se pueden obtener al despertar tu alma.\n" +
                "-# Debes esperar a que el Director realice la ceremonia de iniciación"
            ]
        }
    }

    // Import diferido: duelManager arrastra todo el sistema de combate
    const { duelSystem } = require("../Duelo/duelManager")
    const { Personaje } = require("../Duelo/combatientes")
    // Un solo combatiente para todos los usos: así el 2º y 3º parten del HP/maná que dejó el anterior
    const caster = new Personaje(Number(soul._id), soul)
    const lineas = []
    let usados = 0

    for (let i = 0; i < cantidad; i++) {
        const res = await duelSystem.useItem(false, caster, null, def)
        if (!res?.success) {
            // Si ya se usó alguno, el "no ha sucedido nada" del siguiente explica por qué se detuvo
            lineas.push(res?.message || "No se pudo usar el objeto.")
            break
        }
        usados++
        if (res.message) lineas.push(`${cantidad > 1 ? `\`${i + 1}.\` ` : ""}${res.message}`)
    }

    if (usados > 1) lineas.unshift(`Usaste **${def.Nombre}** x${usados}.`)
    return { ok: usados > 0, publico: false, lineas }
}

async function abrirCofres({ interaction, character, def, cantidad }) {
    const obtenidos = new Map()   // nombre → cantidad
    let lumensTotal = 0
    let abiertos = 0
    let aviso = null

    for (let i = 0; i < cantidad; i++) {
        const premio = catalogoObjetos.getObjetoPorId(def.Region, sortear(COFRE_BOTIN))
        if (!premio) { aviso = "El cofre contenía un objeto que ya no existe."; break }

        const entrada = await updateInventario(null, interaction, character._id, {
            isItem: true, ID: premio.ID, Region: premio.Region, Nombre: premio.Nombre, cantidad: 1
        })
        if (!entrada?.success) { aviso = entrada?.messages || "No se pudo guardar el premio."; break }

        const consumo = await updateInventario(null, interaction, character._id, {
            isItem: true, ID: def.ID, Region: def.Region, consumir: true, cantidad: 1
        })
        if (!consumo?.success) { aviso = consumo?.messages; break }

        const lumens = Math.floor(Math.random() * (60 - 40 + 1) + 40)
        await moverLumens({
            personajeId: character._id, delta: lumens, motivo: "cofre",
            opId: `cofre:${interaction.id}:${i}`, ref: { itemId: def.ID },
        })

        lumensTotal += lumens
        obtenidos.set(premio.Nombre, (obtenidos.get(premio.Nombre) || 0) + 1)
        abiertos++
    }

    if (!abiertos) return { ok: false, publico: false, lineas: [aviso || "No se pudo abrir el cofre (╥﹏╥)"] }

    const lineas = [
        `Abriste **${def.Nombre}** x${abiertos} y obtuviste:`,
        ...[...obtenidos].map(([nombre, n]) => `- **${nombre}** x ${n}`),
        `- **Lumens: ${lumensTotal}** <a:Lumens:1335709991130103910>`,
    ]
    if (aviso) lineas.push(`-# ${aviso}`)
    return { ok: true, publico: true, titulo: "¡Felicidades! ( •̀ ω •́ )✧", lineas }
}

async function abrirBolsa({ character, item }) {
    const contenido = item.Metadata.items

    // Todo o nada: si algo del contenido no cabe, la bolsa se queda cerrada
    const { sobrantes, aviso } = await limitarEntradas(character, contenido.map(c => ({
        ID: c.ID, Region: c.Region, cantidad: Number(c.Cantidad || 1), Nombre: c.Nombre
    })))
    if (sobrantes.length) {
        return { ok: false, publico: false, lineas: ["No puedes abrir la bolsa: no cabe todo su contenido.", aviso].filter(Boolean) }
    }

    const lineas = []
    for (const c of contenido) {
        const def = catalogoObjetos.getObjetoPorId(c.Region, c.ID)
        if (!def) {
            lineas.push(`- \`[❌]\` Objeto desconocido (${c.Nombre} - ${c.ID})`)
            continue
        }
        const res = await updateInventario(null, null, character._id, {
            isItem: true, ID: def.ID, Region: def.Region, Nombre: def.Nombre, cantidad: Number(c.Cantidad || 1)
        })
        lineas.push(res?.success
            ? `- \`[🎁]\` ${def.Nombre} x${c.Cantidad || 1}`
            : `- \`[❌]\` ${def.Nombre}: ${res?.messages || "no se pudo guardar"}`)
    }

    await updateInventario(null, null, character._id, {
        isItem: true, ID: item.ID, Region: item.Region, instanciaID: item.instanciaID, consumir: true, cantidad: 1
    })

    return { ok: true, publico: true, titulo: "Contenido de la bolsa", lineas: ["**Has obtenido:**", ...lineas] }
}

/**
 * Bolsa de regalo: abre el editor (nuevo o a medio armar) o, si está cerrada, la
 * abre su dueño. Devuelve `componentesV2` para que el modal responda con la UI.
 */
async function usarBolsaRegalo({ interaction, character, soul, item }) {
    // Imports diferidos: el sistema de regalos arrastra amistad, economía y UI
    const bolsa = require("../Regalos/bolsa")
    const P = require("../Regalos/pantallas")
    const ui = require("../../data/UI_ComponentsV2/menuRegalo")
    const { texto } = require("../../config/mensajesRegalos")
    const userId = interaction.user.id

    const r = await bolsa.usarBolsa({ character, soul, userId, entrada: item })
    if (!r.ok) return { ok: false, publico: false, lineas: [texto(r.codigo)] }

    if (r.modo === "editor") {
        const componentesV2 = await P.editor({ userId, token: r.token, pjId: character._id, aviso: r.aviso })
        return { ok: true, publico: false, lineas: [], componentesV2 }
    }

    const lineas = r.items.map(i => `- -# ${i.Nombre} x${i.Cantidad} `)
    if (r.lumens > 0) lineas.push(`- -# ${r.lumens} Lumens ${ui.EMOJI_LUMENS} `)
    return {
        ok: true, publico: false, lineas: [],
        componentesV2: ui.construirAviso({ titulo: "Abriste tu propia bolsa", lineas: [`-# ${texto("ABIERTO_PROPIO")}`, "", ...lineas] }),
    }
}

module.exports = { MAX_USOS_POR_MODAL, tipoDeUso, opcionesUsables, usarObjeto }
