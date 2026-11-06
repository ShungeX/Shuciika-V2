// Modo calibración del valor de los regalos (solo lectura).
//   node scripts/calibrarRegalos.js [cantidad]
// Lee Objetos_globales, puntúa cada ítem regalable con config/valorRegalo.js e
// imprime la tabla ordenada por S. No escribe nada en la base.
const { MongoClient } = require("mongodb")
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") })
const { reporteCalibracion, tablaCalibracion } = require("../functions/Regalos/calibracion")

async function run() {
    const uri = process.env.MONGODB_URI
    if (!uri) {
        console.error("Error: MONGODB_URI no está definido en el archivo .env")
        process.exit(1)
    }
    const cantidad = Math.max(1, Number(process.argv[2]) || 1)
    const client = new MongoClient(uri, { family: 4 })
    try {
        await client.connect()
        const regiones = await client.db("Rol_db").collection("Objetos_globales").find({}, { projection: { _id: 1, Objetos: 1 } }).toArray()
        const catalogo = regiones.flatMap(r => (r.Objetos || []).map(o => ({ ...o, Region: o.Region || r._id })))
        const filas = reporteCalibracion(catalogo, { cantidad })
        console.log(`Ítems regalables: ${filas.length} de ${catalogo.length} (cantidad por pila: ${cantidad})\n`)
        console.log(tablaCalibracion(filas))
    } finally {
        await client.close()
    }
}

run().catch(e => {
    console.error(e)
    process.exit(1)
})
