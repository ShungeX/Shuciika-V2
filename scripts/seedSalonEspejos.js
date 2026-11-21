// Objetos del Salón de los Espejos (Anfitrion_Jefe_Sosias.md, VIII y III).
//
//   node scripts/seedSalonEspejos.js            → EN SECO: reporta lo que haría
//   node scripts/seedSalonEspejos.js --aplicar  → escribe (antes guarda un respaldo en scripts/respaldos/)
//
// Crea o actualiza en Objetos_globales (TOB-01), con las convenciones del catálogo:
//   1029 Invitación          → la recibe quien pierde contra El Anfitrión. Única, ligada, no se acumula.
//   1030 Espejo de Mano      → primera victoria: muestra cómo te lee el Salón. Única y ligada.
//   1031 Esquirla de espejo  → repeticiones (con cooldown por cuenta). Material.
// Idempotente (upsert por ID); no toca nada más.

const path = require("path")
const fs = require("fs")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })
const { MongoClient, Int32 } = require("mongodb")
const { ANFITRION } = require("../functions/Duelo/habilidadesNPC/anfitrion/config")

const APLICAR = process.argv.includes("--aplicar")
const REGION = "TOB-01"
const hoy = () => { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` }
const plano = (v) => JSON.parse(JSON.stringify(v ?? null, (_, x) => (x && x._bsontype === "Int32" ? Number(x.value) : x)))
const igual = (a, b) => JSON.stringify(plano(a)) === JSON.stringify(plano(b))

function objeto({ ID, Nombre, Descripcion, Rareza, Tipo, unico, intercambiable }, previo) {
    return {
        ID: new Int32(ID), ID_Autocomplete: `${REGION}${ID}`, Region: REGION,
        Nombre, Descripcion, Rareza, Tipo,
        Cantidad: null,
        atributos: { peso: new Int32(0) },
        inStore: false, precio: new Int32(0), en_tienda: [],
        vendido: previo?.vendido ?? new Int32(0),
        fecha: previo?.fecha ?? hoy(),
        evento_origen: "salon_espejos", imagenURL: previo?.imagenURL ?? null,
        intercambiable, max_por_persona: null, max_inventario: unico ? new Int32(1) : null,
        vendible: false, valor_base: null, durabilidad: null, resistencia: null,
        contaminable: false, purificable: false, tiempo_limite: null,
        creador: previo?.creador ?? "sistema",
        restricciones: { fe_min: new Int32(0), fe_max: new Int32(0), resplandor_min: new Int32(0), resplandor_max: new Int32(0), clase: null, region: null, reputacion: null },
        uso: { contexto: "mapa", consumible: false, requiereSeleccion: false, objetivo: { tipo: "mismo", cantidad: new Int32(1) }, cooldown: null },
        efectos: [],
    }
}

const OBJETOS = [
    {
        ID: ANFITRION.OBJETOS.INVITACION.ID, Nombre: "Invitación",
        Descripcion: "Una tarjeta de cristal con tu nombre escrito al revés. Nadie del Instituto recuerda haberla enviado. Úsala para aceptarla: la próxima vez que te encuentres un Sosias, el anfitrión te estará esperando. Ahí ya no se puede huir.",
        Rareza: "Arcano", Tipo: ["Consumible", "Lore"], unico: true, intercambiable: false,
    },
    {
        ID: ANFITRION.OBJETOS.ESPEJO_DE_MANO.ID, Nombre: "Espejo de Mano",
        Descripcion: "No da poder: da información. Al mirarlo ves cómo te leyó el Salón en tu último encuentro con un reflejo: lo que repites y lo que evitas.",
        Rareza: "Divino", Tipo: ["Herramienta", "Lore"], unico: true, intercambiable: false,
    },
    {
        ID: ANFITRION.OBJETOS.ESQUIRLA.ID, Nombre: "Esquirla de espejo",
        Descripcion: "Un fragmento del cristal del Salón. Todavía refleja con medio segundo de retraso.",
        Rareza: "Luminoso", Tipo: ["Material"], unico: false, intercambiable: true,
    },
]

async function main() {
    const client = new MongoClient(require("../config/entorno").variable("MONGODB_URI"))
    await client.connect()
    const col = client.db("Rol_db").collection("Objetos_globales")
    console.log(APLICAR ? "== MODO APLICAR ==" : "== EN SECO (sin escribir; usa --aplicar) ==")
    const region = await col.findOne({ _id: REGION })
    if (APLICAR) {
        const dir = path.resolve(__dirname, "respaldos")
        fs.mkdirSync(dir, { recursive: true })
        const archivo = path.join(dir, `SalonEspejos_${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
        fs.writeFileSync(archivo, JSON.stringify(region, null, 1))
        console.log(`Respaldo: ${archivo}`)
    }
    const cuenta = { creados: 0, actualizados: 0, sinCambios: 0 }
    for (const def of OBJETOS) {
        const previo = (region.Objetos || []).find(o => Number(o.ID) === def.ID)
        if (previo && previo.evento_origen !== "salon_espejos") throw new Error(`El ID ${def.ID} ya lo usa "${previo.Nombre}".`)
        const item = objeto(def, previo)
        if (previo && igual(previo, item)) { cuenta.sinCambios++; continue }
        if (previo) {
            cuenta.actualizados++
            console.log(`  ~ ${def.ID} ${def.Nombre}`)
            if (APLICAR) await col.updateOne({ _id: REGION }, { $set: { "Objetos.$[o]": item } }, { arrayFilters: [{ "o.ID": def.ID }] })
        } else {
            cuenta.creados++
            console.log(`  + ${def.ID} ${def.Nombre} (${def.Rareza})`)
            if (APLICAR) await col.updateOne({ _id: REGION, "Objetos.ID": { $ne: def.ID } }, { $push: { Objetos: item } })
        }
    }
    console.log("Resultado:", JSON.stringify(cuenta))
    await client.close()
}

main().catch(e => { console.error(e); process.exit(1) })
