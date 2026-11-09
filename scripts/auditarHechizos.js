// Calibración del Sistema de hechizos (VIII.E). Herramienta de balance: NO corre durante el casteo.
//
//   node scripts/auditarHechizos.js             → audita la colección Hechizos_globales (solo lectura)
//   node scripts/auditarHechizos.js --catalogo  → audita el catálogo semilla sin tocar la BD
//
// Marca todo hechizo con índice de eficiencia fuera de su banda (Nota 4.7–6.3, Acorde 5.7–6.9,
// Cántico 6.5–7.9) y todo costo de maná fuera del 5–25% del maná máximo al desbloquearse.

const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })
const { auditar, auditarMana } = require("../functions/Duelo/hechizos/calibracion")
const { CATALOGO } = require("../functions/Duelo/hechizos/catalogo")

async function cargar() {
    if (process.argv.includes("--catalogo")) return CATALOGO
    const { MongoClient } = require("mongodb")
    const client = new MongoClient(process.env.MONGODB_URI, { family: 4 })
    await client.connect()
    try {
        return await client.db("Rol_db").collection("Hechizos_globales").find({}).toArray()
    } finally {
        await client.close()
    }
}

cargar().then(hechizos => {
    const indice = auditar(hechizos)
    console.log("Índice de eficiencia (I):")
    console.table(indice.map(r => ({ ...r, banda: r.banda.join("–"), fuera: r.fuera ? "⚠️" : "" })))
    const mana = auditarMana(hechizos).filter(r => r.fuera)
    if (mana.length) { console.log("Costos de maná fuera del 5–25% al desbloquearse:"); console.table(mana) }
    const fuera = indice.filter(r => r.fuera)
    console.log(fuera.length ? `${fuera.length} hechizo(s) fuera de banda.` : "Todo dentro de banda.")
}).catch(e => { console.error(e); process.exit(1) })
