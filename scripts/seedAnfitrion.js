// El Anfitrión como NPC real de Rol_db.NPCs (Anfitrion_Jefe_Sosias.md).
//
//   node scripts/seedAnfitrion.js            → EN SECO: reporta lo que haría
//   node scripts/seedAnfitrion.js --aplicar  → escribe (antes guarda un respaldo en scripts/respaldos/)
//
// Crea o actualiza el documento NPC-ANFITRION copiando al Sosias original (NPC_BASE): sale a la
// pista disfrazado, con sus mismas estadísticas, ataques y aspecto, y solo se distingue por
// `habilidadUnica: "anfitrion"`. En combate vuelve a leer al Sosias de la BD (encuentros.js), así
// que si retocas a Sosias el disfraz se actualiza solo.
// Idempotente (no escribe si ya está igual); no toca al Sosias original.

const path = require("path")
const fs = require("fs")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })
const { MongoClient } = require("mongodb")
const { ANFITRION } = require("../functions/Duelo/habilidadesNPC/anfitrion/config")

const APLICAR = process.argv.includes("--aplicar")
const plano = (v) => JSON.parse(JSON.stringify(v ?? null, (_, x) => (x && x._bsontype ? Number(x.valueOf?.() ?? x.value) : x)))
/** Comparación estable: mismo contenido aunque cambie el orden de las claves. */
function ordenar(v) {
    if (Array.isArray(v)) return v.map(ordenar)
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k => [k, ordenar(v[k])]))
    return v
}
const igual = (a, b) => JSON.stringify(ordenar(plano(a))) === JSON.stringify(ordenar(plano(b)))

const DESCRIPCION = "Solo administradores. Sale disfrazado de Sosias y con sus estadísticas: rómpelo hasta el 1% para que empiece el jefe. No cuenta peleas ni da recompensas."

/** El jefe es el Sosias original con la habilidad puesta: mismo aspecto, mismas stats. */
function documento(base, previo) {
    const { _id, metadata, ...resto } = base
    return {
        ...resto,
        habilidadUnica: "anfitrion",
        anfitrionDatos: { prueba: true },
        // Lo que ve el administrador en el dashboard; en combate manda el nombre de Sosias
        notaAdmin: DESCRIPCION,
        metadata: {
            ...(previo?.metadata || metadata || {}),
            createdBy: previo?.metadata?.createdBy ?? "Admin",
            origen: "salon_espejos",
        },
    }
}

async function main() {
    const client = new MongoClient(process.env.MONGODB_URI)
    await client.connect()
    const col = client.db("Rol_db").collection("NPCs")
    console.log(APLICAR ? "== MODO APLICAR ==" : "== EN SECO (sin escribir; usa --aplicar) ==")

    const base = await col.findOne({ _id: ANFITRION.NPC_BASE })
    if (!base) throw new Error(`No existe el NPC base ${ANFITRION.NPC_BASE} (Sosias).`)
    if (base.habilidadUnica !== "sosias") console.warn(`Aviso: ${ANFITRION.NPC_BASE} no tiene habilidadUnica "sosias" (${base.habilidadUnica}).`)

    const previo = await col.findOne({ _id: ANFITRION.PRUEBA.ID })
    if (previo && previo.habilidadUnica !== "anfitrion" && previo.metadata?.origen !== "salon_espejos") {
        throw new Error(`El ID ${ANFITRION.PRUEBA.ID} ya lo usa "${previo.Nombre}".`)
    }
    const doc = documento(base, previo)

    if (APLICAR) {
        const dir = path.resolve(__dirname, "respaldos")
        fs.mkdirSync(dir, { recursive: true })
        const archivo = path.join(dir, `Anfitrion_${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
        fs.writeFileSync(archivo, JSON.stringify({ base, previo }, null, 1))
        console.log(`Respaldo: ${archivo}`)
    }

    if (previo && igual({ ...previo, _id: undefined }, { ...doc, _id: undefined })) {
        console.log(`  = ${ANFITRION.PRUEBA.ID} ya está al día (${doc.Nombre}, ${plano(doc.HP)} HP)`)
    } else {
        console.log(`  ${previo ? "~" : "+"} ${ANFITRION.PRUEBA.ID} ← copia de ${ANFITRION.NPC_BASE} (${doc.Nombre}, ${plano(doc.HP)} HP, ${(doc.ataques || []).length} ataques)`)
        if (APLICAR) await col.updateOne({ _id: ANFITRION.PRUEBA.ID }, { $set: doc }, { upsert: true })
    }
    await client.close()
}

main().catch(e => { console.error(e.message); process.exit(1) })
