// functions/Objetos/limiteInventario.js
// «Máximo x en inventario» (max_inventario) para todo lo que NO es una compra: regalos del buzón, botín
// rescatado del talismán, premios de duelo, recompensas y objetos que da un diálogo.
// Las compras usan functions/Tiendas/limitesCompra.js, que además cuenta compras por persona.
//
// Se cuenta lo que el personaje tiene ahora entre Inventario y Mochila (no el talismán, que es temporal).
// Lo que no cabe no entra: según el caso, quien llama lo deja donde estaba (buzón) o lo descarta y avisa.

const clientdb = require("../../Server")
const objetosGlobales = clientdb.db("Rol_db").collection("Objetos_globales")
const { limitesDe, unidadesPoseidas } = require("../Tiendas/limitesCompra")

const cantidadDe = (e) => Number(e?.Cantidad ?? e?.cantidad ?? 1)
const idDe = (e) => Number(e?.ID ?? e?.id)
// "Global" y vacío significan "región desconocida": se busca solo por ID
const regionDe = (e) => {
    const r = e?.Region ?? e?.region
    return r && r !== "Global" ? String(r) : null
}

/** Definiciones actuales (no la caché en memoria, para que un cambio del dashboard aplique al momento). */
async function definicionesDe(entradas) {
    const ids = [...new Set(entradas.map(idDe).filter(n => !Number.isNaN(n)))]
    const defs = { porClave: new Map(), porId: new Map() }
    if (!ids.length) return defs
    const filas = await objetosGlobales.aggregate([{ $unwind: "$Objetos" }, { $match: { "Objetos.ID": { $in: ids } } }]).toArray()
    for (const { _id: region, Objetos: o } of filas) {
        const def = { ...o, Region: region }
        defs.porClave.set(`${region}::${Number(o.ID)}`, def)
        if (!defs.porId.has(Number(o.ID))) defs.porId.set(Number(o.ID), def)
    }
    return defs
}

function definicionDe(defs, entrada) {
    const region = regionDe(entrada)
    return (region && defs.porClave.get(`${region}::${idDe(entrada)}`)) || defs.porId.get(idDe(entrada)) || null
}

/**
 * Recorta una lista de objetos entrantes a lo que cabe según max_inventario.
 * Lleva la cuenta entre entradas del mismo objeto (dos pilas de lo mismo en el botín).
 * @param {Object} personaje - Documento con economia.Inventario y economia.Mochila actuales
 * @param {Array<Object>} entradas - { ID|id, Region?, Cantidad|cantidad, Nombre|nombre? }
 * @returns {Promise<{ admitidos: Object[], sobrantes: Object[], recortes: Array<{ nombre, pedido, admitido, max }>, aviso: string|null }>}
 */
async function limitarEntradas(personaje, entradas) {
    const defs = await definicionesDe(entradas)
    const yaEntrando = new Map()   // clave → unidades admitidas en esta misma llamada
    const admitidos = []
    const sobrantes = []   // lo que no cupo, con la cantidad que sobró (por si quien llama lo quiere conservar)
    const recortes = []
    const conCantidad = (e, n) => {
        const copia = { ...e }
        if (e.Cantidad !== undefined || e.cantidad === undefined) copia.Cantidad = n
        if (e.cantidad !== undefined) copia.cantidad = n
        return copia
    }

    for (const e of entradas) {
        const pedido = cantidadDe(e)
        const def = definicionDe(defs, e)
        const max = def ? limitesDe(def).porInventario : null
        if (!max || pedido <= 0) { admitidos.push(e); continue }

        const obj = { ID: idDe(e), region: def.Region }
        const clave = `${obj.region}::${obj.ID}`
        const tiene = unidadesPoseidas(personaje, obj) + (yaEntrando.get(clave) || 0)
        const admitido = Math.max(0, Math.min(pedido, max - tiene))
        yaEntrando.set(clave, (yaEntrando.get(clave) || 0) + admitido)

        if (admitido < pedido) {
            recortes.push({ nombre: def.Nombre || e.Nombre || e.nombre || `Objeto ${obj.ID}`, pedido, admitido, max })
            sobrantes.push(conCantidad(e, pedido - admitido))
        }
        if (admitido > 0) admitidos.push(conCantidad(e, admitido))
    }
    return { admitidos, sobrantes, recortes, aviso: textoRecortes(recortes) }
}

/** "No cabían 2 de Gema (máx. 2 en inventario)", o null si todo entró. */
function textoRecortes(recortes) {
    if (!recortes.length) return null
    return recortes
        .map(r => {
            const n = r.pedido - r.admitido
            return `No ${n === 1 ? "cabía" : "cabían"} ${n} de **${r.nombre}** (máx. ${r.max} en inventario)`
        })
        .join("\n")
}

/**
 * Para lo que debe entrar entero o no entrar (un regalo del buzón): el motivo si no cabe completo.
 * @returns {Promise<string|null>}
 */
async function motivoNoCabe(personaje, entrada) {
    const { recortes } = await limitarEntradas(personaje, [entrada])
    if (!recortes.length) return null
    const r = recortes[0]
    const tiene = r.max - r.admitido
    return tiene >= r.max
        ? `Ya tienes **${r.nombre}**; solo se puede tener ${r.max}.`
        : `Solo puedes tener ${r.max} de **${r.nombre}** (ya tienes ${tiene}).`
}

module.exports = {
    limitarEntradas,
    motivoNoCabe,
    textoRecortes
}
