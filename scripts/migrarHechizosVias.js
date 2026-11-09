// Migra Hechizos_globales al formato del Sistema de hechizos (vías, escalones, Efectos array).
//
//   node scripts/migrarHechizosVias.js            → EN SECO: muestra qué cambiaría, no escribe nada
//   node scripts/migrarHechizosVias.js --aplicar  → escribe (antes guarda un respaldo JSON en scripts/respaldos/)
//
// Qué hace:
//  1. Los 9 hechizos existentes: pasan por el adaptador (quita `Tipo`, Efectos → array, vías por
//     elemento, Elemento canónico "Pyrós", nombre sin espacios) y aplica las correcciones de XII.A
//     y los ajustes de balance de VIII.D (Quemadura 4, Aturdimiento 2, curaciones 16/26/12).
//  2. Inserta los hechizos del catálogo que falten (24 elementales + 5 universales).
//  3. Comprueba que no haya _id duplicados y crea índices (Elemento, Escalon, isActive).
//  4. Valida cada documento con el esquema y aborta si alguno no pasa.

const path = require("path")
const fs = require("fs")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })
const { MongoClient } = require("mongodb")

const { normalizarHechizo } = require("../functions/Duelo/hechizos/adaptador")
const { validarHechizo } = require("../functions/Duelo/hechizos/esquema")
const { CATALOGO } = require("../functions/Duelo/hechizos/catalogo")
const { auditar } = require("../functions/Duelo/hechizos/calibracion")

const APLICAR = process.argv.includes("--aplicar")

/** Documento listo para guardar (sin propiedades internas). */
const plano = (h) => JSON.parse(JSON.stringify(h))

async function run() {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error("MONGODB_URI no está definido en .env")
    const client = new MongoClient(uri, { family: 4 })
    await client.connect()
    try {
        const col = client.db("Rol_db").collection("Hechizos_globales")
        const actuales = await col.find({}).toArray()
        const porId = new Map(actuales.map(d => [String(d._id), d]))
        console.log(`Hechizos en la colección: ${actuales.length}`)

        const catalogo = new Map(CATALOGO.map(h => [h._id, h]))
        const operaciones = []
        const errores = []

        // 1. Existentes
        for (const doc of actuales) {
            const semilla = catalogo.get(String(doc._id))
            // Los que están en el catálogo toman su definición final (conservan Creado e imagen)
            const nuevo = semilla
                ? plano(normalizarHechizo({ ...semilla, Creado: doc.Creado ?? "", imagenURL: doc.imagenURL ?? doc.imagen ?? undefined }))
                : plano(normalizarHechizo(doc))
            const err = validarHechizo(normalizarHechizo(nuevo))
            if (err.length) errores.push({ id: doc._id, err })
            operaciones.push({ tipo: "reemplazar", id: doc._id, antes: doc, despues: nuevo })
        }

        // 2. Faltantes del catálogo
        for (const semilla of CATALOGO) {
            if (porId.has(semilla._id)) continue
            const nuevo = plano(normalizarHechizo(semilla))
            const err = validarHechizo(normalizarHechizo(nuevo))
            if (err.length) errores.push({ id: semilla._id, err })
            operaciones.push({ tipo: "insertar", id: semilla._id, despues: nuevo })
        }

        // 3. Duplicados
        const ids = actuales.map(d => String(d._id))
        const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
        console.log(dup.length ? `⚠️ _id duplicados: ${dup.join(", ")}` : "Sin _id duplicados.")

        for (const op of operaciones) {
            const resumen = op.tipo === "insertar"
                ? `+ ${op.id} (${op.despues.Nombre}) Escalón ${op.despues.Escalon ?? "—"} vías [${op.despues.Mecanicas.cast.vias.join(", ")}]`
                : `~ ${op.id}: Tipo "${op.antes.Tipo ?? "-"}" → vías [${op.despues.Mecanicas.cast.vias.join(", ")}], Elemento "${op.antes.Elemento}" → "${op.despues.Elemento}", Efectos ${Array.isArray(op.antes.Mecanicas?.Efectos) ? "array" : "objeto"} → array(${op.despues.Mecanicas.Efectos.length})`
            console.log(resumen)
        }

        console.log("\nÍndice de eficiencia tras migrar:")
        console.table(auditar(operaciones.map(o => o.despues)))

        if (errores.length) {
            console.error("\n❌ Hay documentos que no pasan la validación; no se escribe nada:")
            for (const e of errores) console.error(` - ${e.id}: ${e.err.join("; ")}`)
            process.exitCode = 1
            return
        }

        if (!APLICAR) {
            console.log(`\nEn seco: ${operaciones.length} operaciones. Ejecuta con --aplicar para escribir.`)
            return
        }

        const dir = path.join(__dirname, "respaldos")
        fs.mkdirSync(dir, { recursive: true })
        const archivo = path.join(dir, `Hechizos_globales_${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
        fs.writeFileSync(archivo, JSON.stringify(actuales, null, 2))
        console.log(`\nRespaldo: ${archivo}`)

        for (const op of operaciones) {
            if (op.tipo === "insertar") await col.insertOne(op.despues)
            else await col.replaceOne({ _id: op.id }, op.despues)
        }
        await Promise.all([
            col.createIndex({ Elemento: 1 }),
            col.createIndex({ Escalon: 1 }),
            col.createIndex({ isActive: 1 }),
        ])
        console.log(`✅ Migración aplicada: ${operaciones.length} operaciones. Reinicia el bot (o guarda un hechizo en el dashboard) para refrescar la caché.`)
    } finally {
        await client.close()
    }
}

run().catch(e => { console.error("Error en la migración:", e); process.exit(1) })
