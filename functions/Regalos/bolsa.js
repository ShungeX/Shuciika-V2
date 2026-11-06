// ─────────────────────────────────────────────────────────────────────────────
// Armar un regalo dentro de una Bolsa de regalo (persistente en el inventario).
//
// Flujo: "Usar item" sobre una bolsa del inventario →
//   • bolsa normal (pila)       → se separa 1 unidad como instancia "armando"
//   • instancia "armando"       → se reanuda el editor (solo una a la vez)
//   • instancia "cerrado"       → la abre su dueño: recupera todo, pierde la bolsa
//
// Lo que se mete a la bolsa SALE del inventario en ese momento (y los Lumens se
// congelan). Así, si el mensaje se cierra, el regalo sigue guardado tal cual.
// Borrar devuelve todo, bolsa incluida.
//
// Forma de la instancia en economia.Inventario:
//   { instanciaID, ID, Region, Nombre, Cantidad: 1, Tipo, atributos, Fecha,
//     Metadata: {
//       items: [{ ID, Region, Nombre, Cantidad }],     // mismo campo que las bolsas viejas
//       restricciones: { intercambiable:false, crafteable:false, apilable:false, isRegalo:true },
//       regalo: { estado: "armando"|"cerrado", autorPj, autorUserId, lumens,
//                 titulo, nota, banner, color, pesoTotal, capacidad, rev,
//                 creadoEn, cerradoEn }
//     } }
// ─────────────────────────────────────────────────────────────────────────────
const crypto = require("crypto")
const cfg = require("../../config/regalos")
const { congelarLumens, descongelarLumens } = require("../Economia/lumens")
const { leerItem, definicionDe, entradaRegalable } = require("./leerItem")
const c = require("./comun")

const INV = c.INV

const datosRegalo = (bolsa) => bolsa?.Metadata?.regalo || null
const estadoDe = (bolsa) => datosRegalo(bolsa)?.estado || null
const itemsDe = (bolsa) => bolsa?.Metadata?.items || []

function capacidadDe(entradaBolsa) {
    const info = leerItem(definicionDe(entradaBolsa))
    return info?.capacidad ?? cfg.BOLSAS_REGALO[cfg.claveBolsa(entradaBolsa)]?.capacidad ?? cfg.CAPACIDAD_POR_DEFECTO
}

const pesoUnitario = (entrada) => leerItem(definicionDe(entrada))?.peso ?? 0

function pesoDe(items) {
    return items.reduce((t, i) => t + pesoUnitario(i) * Number(i.Cantidad || 0), 0)
}

/** Bolsas de regalo del inventario del personaje, por estado. */
function bolsasDe(personaje, estado) {
    return (personaje?.economia?.Inventario || [])
        .filter(e => e.instanciaID && datosRegalo(e) && (!estado || estadoDe(e) === estado))
}

/** Lee la bolsa fresca de la base. */
async function obtenerBolsa(pjId, instanciaID) {
    const pj = await c.personajes.findOne(
        { _id: c.normalizarId(pjId), [`${INV}.instanciaID`]: instanciaID },
        { projection: { [`${INV}.$`]: 1, ownerID: 1 } }
    )
    return pj?.economia?.Inventario?.[0] || null
}

/** Filtro de la bolsa "armando" con la versión leída (concurrencia optimista). */
const filtroArmando = (pjId, instanciaID, rev) => ({
    _id: c.normalizarId(pjId),
    [INV]: { $elemMatch: { instanciaID, "Metadata.regalo.estado": "armando", ...(rev !== undefined ? { "Metadata.regalo.rev": rev } : {}) } },
})

// ─── Entrar al editor ────────────────────────────────────────────────────────
/**
 * Punto de entrada desde "Usar item". Decide si empieza, reanuda o abre.
 * @returns {Promise<{ ok: true, modo: "editor", token, instanciaID, aviso? } |
 *                   { ok: true, modo: "abierto", items, lumens } | { ok: false, codigo }>}
 */
async function usarBolsa({ character, soul, userId, entrada }) {
    if (!entrada || !cfg.esBolsaRegalo(entrada)) return c.fallo("SIN_BOLSA")

    if (entrada.instanciaID) {
        const estado = estadoDe(entrada)
        if (estado === "cerrado") return abrirPropia({ character, soul, instanciaID: entrada.instanciaID })
        if (estado === "armando") {
            const token = c.abrirEditor(userId, character._id, entrada.instanciaID)
            return c.ok({ modo: "editor", token, instanciaID: entrada.instanciaID })
        }
        return c.fallo("SIN_BOLSA")
    }

    // Solo UN regalo a medio armar por personaje: si ya hay uno, se reanuda ese.
    const enCurso = bolsasDe(character, "armando")[0]
    if (enCurso) {
        const token = c.abrirEditor(userId, character._id, enCurso.instanciaID)
        return c.ok({ modo: "editor", token, instanciaID: enCurso.instanciaID, aviso: "YA_ARMANDO" })
    }

    const def = definicionDe(entrada)
    const instanciaID = crypto.randomUUID().replace(/-/g, "")
    const ahora = new Date()
    const instancia = {
        instanciaID,
        ID: Number(entrada.ID),
        Region: String(entrada.Region || def?.Region || ""),
        Nombre: `${def?.Nombre || entrada.Nombre || "Bolsa de regalo"} 🎀 (armando)`,
        Cantidad: 1,
        Tipo: def?.Tipo || entrada.Tipo || [],
        atributos: def?.atributos || entrada.atributos || { peso: 0 },
        Fecha: ahora.toISOString(),
        Metadata: {
            items: [],
            restricciones: { intercambiable: false, crafteable: false, apilable: false, isRegalo: true },
            regalo: {
                estado: "armando",
                autorPj: c.normalizarId(character._id),
                autorUserId: String(character.ownerID ?? userId),
                lumens: 0,
                titulo: "",
                nota: "",
                banner: null,
                color: null,
                pesoTotal: 0,
                capacidad: capacidadDe(entrada),
                rev: 0,
                creadoEn: ahora,
                cerradoEn: null,
            },
        },
    }

    const r = await c.enTransaccion(async (session) => {
        await c.quitarPila(character._id, entrada, 1, session)
        await c.personajes.updateOne({ _id: c.normalizarId(character._id) }, { $push: { [INV]: instancia } }, { session })
    })
    if (!r.ok) return r

    const token = c.abrirEditor(userId, character._id, instanciaID)
    return c.ok({ modo: "editor", token, instanciaID })
}

// ─── Contenido ───────────────────────────────────────────────────────────────
/**
 * Mete `cantidad` de una pila del inventario a la bolsa.
 * @param {{ pjId, instanciaID, entrada: { ID, Region }, cantidad }} p
 */
async function agregarObjeto({ pjId, instanciaID, entrada, cantidad }) {
    cantidad = Number(cantidad)
    if (!Number.isInteger(cantidad) || cantidad < 1) return c.fallo("CANTIDAD_INVALIDA")

    const pj = await c.leerPersonaje(pjId, { [INV]: 1 })
    const pila = (pj?.economia?.Inventario || []).find(e =>
        !e.instanciaID && Number(e.ID) === Number(entrada.ID) && (!entrada.Region || e.Region === entrada.Region))
    if (!pila) return c.fallo("FONDOS")
    if (!entradaRegalable(pila) || cfg.esBolsaRegalo(pila)) return c.fallo("ITEM_NO_REGALABLE")
    if (Number(pila.Cantidad) < cantidad) return c.fallo("FONDOS")

    const bolsa = (pj.economia.Inventario || []).find(e => e.instanciaID === instanciaID)
    if (!bolsa || estadoDe(bolsa) !== "armando") return c.fallo("EDITOR_EXPIRADO")

    const items = itemsDe(bolsa).map(i => ({ ...i }))
    const idx = items.findIndex(i => Number(i.ID) === Number(pila.ID) && (i.Region || "") === (pila.Region || ""))
    if (idx === -1 && cfg.PILAS_MAX_BOLSA !== null && items.length >= cfg.PILAS_MAX_BOLSA) return c.fallo("MAX_PILAS")
    const nuevaCantidad = (idx === -1 ? 0 : Number(items[idx].Cantidad)) + cantidad
    if (nuevaCantidad > cfg.CANTIDAD_MAX_PILA) return c.fallo("CANTIDAD_INVALIDA")

    if (idx === -1) items.push({ ID: Number(pila.ID), Region: pila.Region, Nombre: pila.Nombre, Cantidad: cantidad })
    else items[idx].Cantidad = nuevaCantidad

    const pesoTotal = pesoDe(items)
    const capacidad = datosRegalo(bolsa).capacidad ?? capacidadDe(bolsa)
    if (pesoTotal > capacidad) return c.fallo("SIN_CAPACIDAD")

    const rev = datosRegalo(bolsa).rev ?? 0
    return c.enTransaccion(async (session) => {
        await c.quitarPila(pjId, pila, cantidad, session)
        const r = await c.personajes.updateOne(filtroArmando(pjId, instanciaID, rev), {
            $set: { [`${INV}.$.Metadata.items`]: items, [`${INV}.$.Metadata.regalo.pesoTotal`]: pesoTotal },
            $inc: { [`${INV}.$.Metadata.regalo.rev`]: 1 },
        }, { session })
        if (r.modifiedCount !== 1) throw new c.ErrorRegalo("ERROR")   // alguien editó en medio: se reintenta desde la UI
        return c.ok({ nombre: pila.Nombre, cantidad })
    })
}

/** Saca `cantidad` de un objeto de la bolsa y lo devuelve al inventario. */
async function retirarObjeto({ pjId, instanciaID, ID, Region, cantidad }) {
    cantidad = Number(cantidad)
    if (!Number.isInteger(cantidad) || cantidad < 1) return c.fallo("CANTIDAD_INVALIDA")

    const bolsa = await obtenerBolsa(pjId, instanciaID)
    if (!bolsa || estadoDe(bolsa) !== "armando") return c.fallo("EDITOR_EXPIRADO")

    const items = itemsDe(bolsa).map(i => ({ ...i }))
    const idx = items.findIndex(i => Number(i.ID) === Number(ID) && (i.Region || "") === (Region || ""))
    if (idx === -1) return c.fallo("FONDOS")
    const sacar = Math.min(cantidad, Number(items[idx].Cantidad))
    const item = { ...items[idx] }
    items[idx].Cantidad -= sacar
    const restantes = items.filter(i => i.Cantidad > 0)

    const rev = datosRegalo(bolsa).rev ?? 0
    return c.enTransaccion(async (session) => {
        const r = await c.personajes.updateOne(filtroArmando(pjId, instanciaID, rev), {
            $set: { [`${INV}.$.Metadata.items`]: restantes, [`${INV}.$.Metadata.regalo.pesoTotal`]: pesoDe(restantes) },
            $inc: { [`${INV}.$.Metadata.regalo.rev`]: 1 },
        }, { session })
        if (r.modifiedCount !== 1) throw new c.ErrorRegalo("ERROR")
        // Vuelve a SU inventario: sin tope de max_inventario, porque ya era suyo
        await c.agregarPilas(pjId, [{ ...item, Cantidad: sacar }], session)
        return c.ok({ nombre: item.Nombre, cantidad: sacar })
    })
}

// ─── Envoltura ───────────────────────────────────────────────────────────────
async function setEnBolsa(pjId, instanciaID, campos) {
    const set = {}
    for (const [k, v] of Object.entries(campos)) set[`${INV}.$.Metadata.regalo.${k}`] = v
    const r = await c.personajes.updateOne(filtroArmando(pjId, instanciaID), { $set: set, $inc: { [`${INV}.$.Metadata.regalo.rev`]: 1 } })
    return r.modifiedCount === 1 ? c.ok() : c.fallo("EDITOR_EXPIRADO")
}

async function ponerNota({ pjId, instanciaID, titulo, nota }) {
    const t = c.sanearNota(titulo, cfg.TITULO_MAX)
    const n = c.sanearNota(nota, cfg.NOTA_MAX)
    if (!t.ok || !n.ok) return c.fallo("NOTA_INVALIDA")
    return setEnBolsa(pjId, instanciaID, { titulo: t.texto, nota: n.texto })
}

async function ponerBanner({ pjId, instanciaID, url }) {
    const bolsa = await obtenerBolsa(pjId, instanciaID)
    if (!bolsa) return c.fallo("EDITOR_EXPIRADO")
    if (!cfg.permiteBanner(bolsa)) return c.fallo("BANNER_NO_PERMITIDO")
    const limpio = String(url ?? "").trim()
    if (limpio && !c.bannerValido(limpio)) return c.fallo("BANNER_INVALIDO")
    return setEnBolsa(pjId, instanciaID, { banner: limpio || null })
}

async function ponerColor({ pjId, instanciaID, color }) {
    const bolsa = await obtenerBolsa(pjId, instanciaID)
    if (!bolsa) return c.fallo("EDITOR_EXPIRADO")
    if (!cfg.permiteColor(bolsa)) return c.fallo("COLOR_NO_PERMITIDO")
    const valido = color === null || cfg.COLORES.some(x => x.hex === Number(color))
    if (!valido) return c.fallo("ESTRUCTURA")
    return setEnBolsa(pjId, instanciaID, { color: color === null ? null : Number(color) })
}

/**
 * Fija cuántos Lumens lleva la bolsa (total, no incremento). La diferencia se
 * congela o se descongela con el libro de Lumens.
 */
async function ponerLumens({ pjId, instanciaID, total }) {
    total = Number(total)
    if (!Number.isInteger(total) || total < 0) return c.fallo("CANTIDAD_INVALIDA")
    if (total > cfg.LUMENS_MAX_POR_REGALO) return c.fallo("LUMENS_MAX")

    const bolsa = await obtenerBolsa(pjId, instanciaID)
    if (!bolsa || estadoDe(bolsa) !== "armando") return c.fallo("EDITOR_EXPIRADO")
    const actual = Number(datosRegalo(bolsa).lumens || 0)
    const delta = total - actual
    if (delta === 0) return c.ok()
    const rev = datosRegalo(bolsa).rev ?? 0
    const fijar = () => c.personajes.updateOne(filtroArmando(pjId, instanciaID, rev), {
        $set: { [`${INV}.$.Metadata.regalo.lumens`]: total },
        $inc: { [`${INV}.$.Metadata.regalo.rev`]: 1 },
    })

    if (delta > 0) {
        if (!await congelarLumens(pjId, delta)) return c.fallo("FONDOS")
        const r = await fijar()
        if (r.modifiedCount !== 1) {
            await descongelarLumens(pjId, delta)
            return c.fallo("ERROR")
        }
        return c.ok()
    }
    // Primero la bolsa y luego el dinero: si falla lo segundo, el remitente no
    // gana Lumens de la nada (quedarían congelados y se ven en el dashboard).
    const r = await fijar()
    if (r.modifiedCount !== 1) return c.fallo("ERROR")
    const devueltos = await descongelarLumens(pjId, -delta)
    if (devueltos !== -delta) console.error(`[Regalos] Solo se descongelaron ${devueltos}/${-delta} Lumens de ${pjId} (bolsa ${instanciaID})`)
    return c.ok()
}

// ─── Borrar / cerrar ─────────────────────────────────────────────────────────
/** Deshace el regalo: todo vuelve al inventario del autor, bolsa incluida. */
async function borrar({ pjId, instanciaID }) {
    const bolsa = await obtenerBolsa(pjId, instanciaID)
    if (!bolsa || estadoDe(bolsa) !== "armando") return c.fallo("EDITOR_EXPIRADO")
    const items = itemsDe(bolsa)
    const lumens = Number(datosRegalo(bolsa).lumens || 0)

    const r = await c.enTransaccion(async (session) => {
        await c.quitarInstancia(pjId, instanciaID, session, { "Metadata.regalo.estado": "armando" })
        await c.agregarPilas(pjId, [...items, { ID: bolsa.ID, Region: bolsa.Region, Nombre: bolsa.Nombre, Cantidad: 1 }], session)
    })
    if (!r.ok) return r
    if (lumens > 0) await descongelarLumens(pjId, lumens)
    return c.ok({ items, lumens })
}

/** Cierra el regalo: deja de poder editarse y queda listo para /rol regalar. */
async function cerrar({ pjId, instanciaID }) {
    const bolsa = await obtenerBolsa(pjId, instanciaID)
    if (!bolsa || estadoDe(bolsa) !== "armando") return c.fallo("EDITOR_EXPIRADO")
    if (!itemsDe(bolsa).length && !(datosRegalo(bolsa).lumens > 0)) return c.fallo("VACIO")

    const def = definicionDe(bolsa)
    const r = await c.personajes.updateOne(filtroArmando(pjId, instanciaID), {
        $set: {
            [`${INV}.$.Metadata.regalo.estado`]: "cerrado",
            [`${INV}.$.Metadata.regalo.cerradoEn`]: new Date(),
            [`${INV}.$.Nombre`]: `${def?.Nombre || "Bolsa de regalo"} 🎀 [${instanciaID.slice(0, 5)}]`,
        },
        $inc: { [`${INV}.$.Metadata.regalo.rev`]: 1 },
    })
    return r.modifiedCount === 1 ? c.ok() : c.fallo("EDITOR_EXPIRADO")
}

/**
 * El autor abre su propia bolsa cerrada: recupera ítems y Lumens, pierde la
 * bolsa. No da puntos de amistad ni ningún otro beneficio.
 */
async function abrirPropia({ character, soul, instanciaID }) {
    if (await c.estaOcupado(character)) return c.fallo("OCUPADO")
    if (soul && c.hpDe(soul) <= 0) return c.fallo("HP_CERO_ABRIR")

    const bolsa = await obtenerBolsa(character._id, instanciaID)
    if (!bolsa || estadoDe(bolsa) !== "cerrado") return c.fallo("SIN_BOLSA")
    const items = itemsDe(bolsa)
    const lumens = Number(datosRegalo(bolsa).lumens || 0)

    const r = await c.enTransaccion(async (session) => {
        await c.quitarInstancia(character._id, instanciaID, session, { "Metadata.regalo.estado": "cerrado" })
        await c.agregarPilas(character._id, items, session)
    })
    if (!r.ok) return r
    if (lumens > 0) await descongelarLumens(character._id, lumens)
    return c.ok({ modo: "abierto", items, lumens })
}

module.exports = {
    datosRegalo,
    estadoDe,
    itemsDe,
    capacidadDe,
    pesoDe,
    bolsasDe,
    obtenerBolsa,
    usarBolsa,
    agregarObjeto,
    retirarObjeto,
    ponerNota,
    ponerBanner,
    ponerColor,
    ponerLumens,
    borrar,
    cerrar,
    abrirPropia,
}
