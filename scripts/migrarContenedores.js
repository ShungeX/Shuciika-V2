// Prepara la base de datos para Contenedores y Durabilidad (Contenedores_y_Durabilidad.md, XII.B / XII.D).
//
//   node scripts/migrarContenedores.js            → EN SECO: muestra qué cambiaría, no escribe nada
//   node scripts/migrarContenedores.js --aplicar  → escribe (antes guarda un respaldo JSON en scripts/respaldos/)
//
// Qué hace:
//  1. Catálogo (Objetos_globales): el "Contenedor elemental" (ID 8) pasa a ser el contenedor
//     artesanal, crea el "Contenedor de Cortesía" y deja el Kit de reparación para uso fuera
//     de combate. La durabilidad máxima sale de functions/Contenedores/config.js.
//  2. Almas que ya eligieron ser desafinadas (nucleo.artefactoMagico): reciben un Contenedor de
//     Cortesía, su elemento pasa a ser el activo y su maná se muda a la carga del contenedor
//     (limitado a la capacidad nueva). No se toca el inventario, los hechizos ni el resto del equipo.
//
// Es idempotente: volver a correrlo no duplica nada. Hay que correrlo ANTES de encender
// BANDERAS.CONTENEDORES_ACTIVOS; después, reiniciar el bot para que recargue el catálogo.

const path = require("path")
const fs = require("fs")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })
const { MongoClient, Int32 } = require("mongodb")

const { TIPOS, REPARACION } = require("../functions/Contenedores/config")
const N = require("../functions/Contenedores/nucleo")

const APLICAR = process.argv.includes("--aplicar")
const REGION = "TOB-01"

const hoy = () => { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` }

/** Campos de equipo que comparten los dos contenedores. */
function camposContenedor(tipo) {
    return {
        Tipo: ["Artefacto", "Contenedor"],
        durabilidad: new Int32(TIPOS[tipo].durabilidad),
        resistencia: new Int32(0),
        intercambiable: false,      // PENDIENTE: comercio de contenedores
        vendible: false,
        inStore: false,
        "uso.contexto": "mapa",     // no es un consumible de combate: se equipa
        "uso.consumible": false,
    }
}

function definicionCortesia() {
    const { ID } = TIPOS.cortesia.objeto
    return {
        ID: new Int32(ID),
        ID_Autocomplete: `${REGION}${ID}`,
        Region: REGION,
        Nombre: TIPOS.cortesia.nombre,
        Descripcion: "El respaldo que el Instituto entrega a toda Alma Desafinada: cristal opaco, forma estándar y un maná más corto. Te mantiene en pie mientras consigues el tuyo. No se repara: si se rompe, el Instituto te da otro.",
        Rareza: "Común",
        Tipo: ["Artefacto", "Contenedor"],
        Cantidad: null,
        atributos: { peso: new Int32(1) },
        inStore: false,
        precio: new Int32(0),
        vendido: new Int32(0),
        fecha: hoy(),
        evento_origen: null,
        imagenURL: null,
        intercambiable: false,
        max_por_persona: null,
        max_inventario: null,
        vendible: false,
        valor_base: null,
        durabilidad: new Int32(TIPOS.cortesia.durabilidad),
        resistencia: new Int32(0),
        contaminable: false,
        purificable: false,
        tiempo_limite: null,
        creador: "sistema",
        restricciones: { fe_min: new Int32(0), fe_max: new Int32(0), resplandor_min: new Int32(0), resplandor_max: new Int32(0), clase: null, region: null, reputacion: null },
        uso: { contexto: "mapa", consumible: false, requiereSeleccion: false, objetivo: { tipo: "mismo", cantidad: new Int32(1) }, cooldown: null },
        efectos: [],
    }
}

/** $set sobre el elemento del array Objetos que tenga ese ID. */
const setObjeto = (campos) => Object.fromEntries(Object.entries(campos).map(([k, v]) => [`Objetos.$[o].${k}`, v]))

async function run() {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error("MONGODB_URI no está definido en .env")
    const client = new MongoClient(uri, { family: 4 })
    await client.connect()
    try {
        const db = client.db("Rol_db")
        const objetos = db.collection("Objetos_globales")
        const souls = db.collection("Soul")
        const region = await objetos.findOne({ _id: REGION })
        if (!region) throw new Error(`No existe la región ${REGION} en Objetos_globales`)
        const porId = (id) => (region.Objetos || []).find(o => Number(o.ID) === id)

        const operaciones = []   // { titulo, detalle, ejecutar }

        // ── 1. Catálogo ──────────────────────────────────────────────────────
        const artesanal = porId(TIPOS.artesanal.objeto.ID)
        if (!artesanal) throw new Error(`No existe el objeto ID ${TIPOS.artesanal.objeto.ID} (Contenedor elemental) en ${REGION}`)
        const camposArtesanal = camposContenedor("artesanal")
        operaciones.push({
            titulo: `Objeto ${artesanal.ID} "${artesanal.Nombre}" → contenedor artesanal`,
            detalle: `Tipo ${JSON.stringify(artesanal.Tipo)} → ${JSON.stringify(camposArtesanal.Tipo)} · durabilidad ${artesanal.durabilidad ?? "—"} → ${TIPOS.artesanal.durabilidad} · no vendible ni intercambiable`,
            ejecutar: () => objetos.updateOne({ _id: REGION }, { $set: setObjeto(camposArtesanal) }, { arrayFilters: [{ "o.ID": artesanal.ID }] }),
        })

        const cortesia = porId(TIPOS.cortesia.objeto.ID)
        if (cortesia && cortesia.Nombre !== TIPOS.cortesia.nombre) {
            throw new Error(`El ID ${TIPOS.cortesia.objeto.ID} ya lo usa "${cortesia.Nombre}": cambia TIPOS.cortesia.objeto.ID en functions/Contenedores/config.js`)
        }
        operaciones.push(cortesia
            ? {
                titulo: `Objeto ${cortesia.ID} "${cortesia.Nombre}" ya existe`,
                detalle: `se asegura durabilidad ${TIPOS.cortesia.durabilidad} y tipo de contenedor`,
                ejecutar: () => objetos.updateOne({ _id: REGION }, { $set: setObjeto(camposContenedor("cortesia")) }, { arrayFilters: [{ "o.ID": cortesia.ID }] }),
            }
            : {
                titulo: `Objeto nuevo ${TIPOS.cortesia.objeto.ID} "${TIPOS.cortesia.nombre}"`,
                detalle: `durabilidad ${TIPOS.cortesia.durabilidad}, capacidad ×${TIPOS.cortesia.capacidadFactor}, no vendible ni intercambiable`,
                ejecutar: () => objetos.updateOne({ _id: REGION, "Objetos.ID": { $ne: TIPOS.cortesia.objeto.ID } }, { $push: { Objetos: definicionCortesia() } }),
            })

        const kit = porId(REPARACION.KIT.ID)
        if (!kit) throw new Error(`No existe el Kit de reparación (ID ${REPARACION.KIT.ID}) en ${REGION}`)
        const pista = `[+${REPARACION.KIT_PUNTOS} de durabilidad a tu contenedor, fuera de combate]`
        const descripcionKit = String(kit.Descripcion || "").includes(pista) ? kit.Descripcion : `${String(kit.Descripcion || "").trim()} ${pista}`.trim()
        operaciones.push({
            titulo: `Objeto ${kit.ID} "${kit.Nombre}" → se usa fuera de combate`,
            detalle: `uso.contexto "${kit.uso?.contexto}" → "mapa" · descripción con la pista ${pista}`,
            ejecutar: () => objetos.updateOne({ _id: REGION }, { $set: setObjeto({ "uso.contexto": "mapa", Descripcion: descripcionKit }) }, { arrayFilters: [{ "o.ID": kit.ID }] }),
        })

        // ── 2. Almas desafinadas ─────────────────────────────────────────────
        const desafinadas = await souls.find({ "nucleo.artefactoMagico": true }).toArray()
        const migradas = []
        for (const soul of desafinadas) {
            const plan = N.planMigracion(soul)
            if (!plan) {
                console.log(`  · Alma ${soul._id}: ya tiene contenedor, no se toca`)
                continue
            }
            migradas.push(soul)
            operaciones.push({
                titulo: `Alma ${soul._id} (${soul.nucleo?.Elemento}) → Contenedor de Cortesía`,
                detalle: `elemento activo ${plan.set["nucleo.elementoActivo"]} · maná ${soul.nucleo?.Mana ?? 0}/${soul.stats?.manaMax ?? 0} → carga ${plan.entrada.carga}/${N.capacidad(plan.entrada, soul.stats?.manaMax)} · ` +
                    `equipo ${JSON.stringify((soul.dominio?.equipo || []).map(e => e.ID))} + [${plan.entrada.ID}] · hechizos sin cambios (${(soul.dominio?.hechizos || []).length})`,
                // La condición evita entregar dos si el script corre dos veces a la vez
                ejecutar: () => souls.updateOne({ _id: soul._id, "dominio.equipo.Type": { $ne: "contenedor" } }, { $set: plan.set }),
            })
        }

        console.log(`\nAlmas desafinadas: ${desafinadas.length} · por migrar: ${migradas.length}`)
        console.log(`\n${APLICAR ? "APLICANDO" : "EN SECO (nada se escribe)"} — ${operaciones.length} operación(es):\n`)
        for (const op of operaciones) console.log(`  • ${op.titulo}\n      ${op.detalle}`)

        if (!APLICAR) {
            console.log("\nPara escribir estos cambios: node scripts/migrarContenedores.js --aplicar")
            return
        }

        // Respaldo de todo lo que se va a tocar
        const dir = path.resolve(__dirname, "respaldos")
        fs.mkdirSync(dir, { recursive: true })
        const archivo = path.join(dir, `Contenedores_${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
        fs.writeFileSync(archivo, JSON.stringify({
            objetos: [artesanal, cortesia, kit].filter(Boolean),
            souls: migradas,
        }, null, 2))
        console.log(`\nRespaldo: ${archivo}`)

        for (const op of operaciones) {
            const r = await op.ejecutar()
            console.log(`  ✔ ${op.titulo} (modificados: ${r.modifiedCount})`)
        }
        console.log("\nListo. Reinicia el bot para que recargue el catálogo de objetos.")
    } finally {
        await client.close()
    }
}

run().catch(e => { console.error("Error:", e.message); process.exit(1) })
