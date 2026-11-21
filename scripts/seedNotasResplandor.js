// Seed de las Notas de Resplandor I (Notas_Nuevas_Resplandor_I.md).
//
//   node scripts/seedNotasResplandor.js            → EN SECO: reporta lo que haría, no escribe nada
//   node scripts/seedNotasResplandor.js --aplicar  → escribe (antes guarda un respaldo JSON en scripts/respaldos/)
//
// Qué hace:
//  1. Hechizos_globales: inserta o actualiza las 16 Notas (Pyro-101 … Kryo-102) desde
//     functions/Duelo/hechizos/notasResplandor.js (formato final, Req.fe_min 3 / 10).
//  2. Objetos_globales (TOB-01): un ítem página por Nota (IDs 1032–1047, FUENTES en
//     functions/Aprendizaje/config.js), a la venta en la Tienda Mágica (lugar "Magica").
//  3. fe_min: 1 → null en los hechizos que lo traían como "sin requisito" (un jugador nuevo parte
//     con 0 Fragmentos ganados y el combate compara contra los GANADOS). No toca otros valores.
//
// Idempotente: upsert por `_id` / ítem `ID`; conserva vendido, fecha y creador de las páginas.

const path = require("path")
const fs = require("fs")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })
const { MongoClient } = require("mongodb")

const { NOTAS_RESPLANDOR_I } = require("../functions/Duelo/hechizos/notasResplandor")
const { FUENTES, PAGINAS, TIENDA } = require("../functions/Aprendizaje/config")
const { contarPalabras } = require("../functions/Aprendizaje/nucleo")
const { validarHechizo } = require("../functions/Duelo/hechizos/esquema")
const { normalizarHechizo } = require("../functions/Duelo/hechizos/adaptador")
const { auditar } = require("../functions/Duelo/hechizos/calibracion")
const { itemPagina, plano, igual } = require("./seedPaginas")

const APLICAR = process.argv.includes("--aplicar")
const PALABRAS_NOTA = [6, 8]

async function main() {
    const uri = require("../config/entorno").variable("MONGODB_URI")
    if (!uri) throw new Error("Falta MONGODB_URI en .env")

    // Validación previa (sin BD): esquema, invocaciones y banda de eficiencia
    const problemas = []
    for (const h of NOTAS_RESPLANDOR_I) {
        for (const e of validarHechizo(normalizarHechizo(h))) problemas.push(`${h._id}: ${e}`)
        const n = contarPalabras(h.Invocacion)
        if (n < PALABRAS_NOTA[0] || n > PALABRAS_NOTA[1]) problemas.push(`${h._id}: la invocación tiene ${n} palabras (Nota: 6–8)`)
        if (!FUENTES[h._id]) problemas.push(`${h._id}: falta en FUENTES`)
    }
    for (const r of auditar(NOTAS_RESPLANDOR_I)) if (r.fuera) problemas.push(`${r.id}: I=${r.I} fuera de la banda ${r.banda.join("–")}`)
    if (problemas.length) throw new Error(`Datos inválidos:\n - ${problemas.join("\n - ")}`)

    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db("Rol_db")
    const hechizosCol = db.collection("Hechizos_globales")
    const objetosCol = db.collection("Objetos_globales")

    console.log(APLICAR ? "== MODO APLICAR ==" : "== EN SECO (sin escribir; usa --aplicar) ==")
    const ids = NOTAS_RESPLANDOR_I.map(h => h._id)
    const existentes = new Map((await hechizosCol.find({ _id: { $in: ids } }).toArray()).map(h => [h._id, h]))
    const conFeUno = await hechizosCol.find({ "Req.fe_min": 1 }).project({ _id: 1, Nombre: 1 }).toArray()
    const region = await objetosCol.findOne({ _id: PAGINAS.REGION })
    if (!region) throw new Error(`No existe la región ${PAGINAS.REGION}`)
    const objetos = region.Objetos || []

    for (const h of NOTAS_RESPLANDOR_I) {
        const ocupado = objetos.find(o => Number(o.ID) === FUENTES[h._id].id && o.hechizo !== h._id)
        if (ocupado) throw new Error(`El ID ${FUENTES[h._id].id} ya lo usa "${ocupado.Nombre}". Cambia FUENTES en config.js.`)
    }

    if (APLICAR) {
        const dir = path.resolve(__dirname, "respaldos")
        fs.mkdirSync(dir, { recursive: true })
        const archivo = path.join(dir, `NotasResplandor_${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
        const feUnoDocs = await hechizosCol.find({ _id: { $in: conFeUno.map(h => h._id) } }).toArray()
        fs.writeFileSync(archivo, JSON.stringify({ Hechizos_globales: [...existentes.values(), ...feUnoDocs], Objetos_globales: [region] }, null, 1))
        console.log(`Respaldo: ${archivo}`)
    }

    const cuenta = { hechizos: { creados: 0, actualizados: 0, sinCambios: 0 }, paginas: { creados: 0, actualizados: 0, sinCambios: 0 }, feMin: 0 }

    // 1. Hechizos (se conserva `Creado` si ya existía)
    for (const h of NOTAS_RESPLANDOR_I) {
        const previo = existentes.get(h._id)
        const doc = { ...h, Creado: previo?.Creado ?? h.Creado }
        if (previo && igual(previo, doc)) { cuenta.hechizos.sinCambios++; continue }
        if (previo) {
            cuenta.hechizos.actualizados++
            console.log(`  ~ ${h._id} ${h.Nombre}`)
            if (APLICAR) await hechizosCol.replaceOne({ _id: h._id }, doc)
        } else {
            cuenta.hechizos.creados++
            console.log(`  + ${h._id} ${h.Nombre} · ${h.Elemento} · ${h.Mecanicas.cast.vias[0]} · FE ${h.Req.fe_min}`)
            if (APLICAR) await hechizosCol.insertOne(doc)
        }
    }

    // 2. Ítems página en la Tienda Mágica
    for (const h of NOTAS_RESPLANDOR_I) {
        const f = FUENTES[h._id]
        const previo = objetos.find(o => Number(o.ID) === f.id)
        const item = itemPagina({ hechizo: h._id, nombre: h.Nombre, escalon: 1, precio: h.Adquisicion.precio }, h, previo)
        if (previo && igual(previo, item)) { cuenta.paginas.sinCambios++; continue }
        if (previo) {
            cuenta.paginas.actualizados++
            console.log(`  ~ página ${f.id} (${item.Nombre})`)
            if (APLICAR) await objetosCol.updateOne({ _id: PAGINAS.REGION }, { $set: { "Objetos.$[o]": item } }, { arrayFilters: [{ "o.ID": f.id }] })
        } else {
            cuenta.paginas.creados++
            console.log(`  + página ${f.id} (${item.Nombre}) · ${item.Rareza} · ${plano(item.precio)} Lumens · ${item.en_tienda.join(", ")}`)
            if (APLICAR) await objetosCol.updateOne({ _id: PAGINAS.REGION, "Objetos.ID": { $ne: f.id } }, { $push: { Objetos: item } })
        }
    }

    // 3. fe_min: 1 → null ("sin requisito" real)
    for (const h of conFeUno) {
        cuenta.feMin++
        console.log(`  ~ ${h._id} ${h.Nombre}: Req.fe_min 1 → null`)
    }
    if (APLICAR && conFeUno.length) await hechizosCol.updateMany({ "Req.fe_min": 1 }, { $set: { "Req.fe_min": null } })

    console.log("\nResultado:", JSON.stringify(cuenta))

    // Verificación final
    if (APLICAR) {
        const enBd = await hechizosCol.countDocuments({ _id: { $in: ids } })
        const paginas = ((await objetosCol.findOne({ _id: PAGINAS.REGION })).Objetos || [])
            .filter(o => ids.includes(o.hechizo) && o.inStore && (o.en_tienda || []).includes(TIENDA.LUGAR_TIENDA))
        console.log(`Verificación: ${enBd}/16 hechizos, ${paginas.length}/16 páginas en la Tienda Mágica`)
    }
    await client.close()
}

main().catch(e => { console.error(e); process.exit(1) })
