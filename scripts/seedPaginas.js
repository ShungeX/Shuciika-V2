// Seed del aprendizaje con páginas (Prompt_Agente_Durabilidad_y_Aprendizaje.md, 2.9).
//
//   node scripts/seedPaginas.js            → EN SECO: reporta lo que haría, no escribe nada
//   node scripts/seedPaginas.js --aplicar  → escribe (antes guarda un respaldo JSON en scripts/respaldos/)
//
// Qué hace (sin borrar nada ni tocar otros campos):
//  1. Hechizos_globales: agrega `Invocacion` (texto escrito a mano; solo lo usa el minijuego de
//     hablado) y `Adquisicion` { via, aprecio, precio } a los 28 hechizos con página.
//  2. Objetos_globales (región TOB-01): un ítem página por hechizo, con las convenciones del
//     catálogo (ID numérico Int32, Rareza, Tipo array, atributos.peso, precio...). Elemento y
//     Escalón NO se duplican: se leen del hechizo.
//  Fuente, aprecio e ID de cada página: functions/Aprendizaje/config.js (FUENTES), editable.
//  Fase 3 (config TIENDA): las de tienda se venden en la Tienda Mágica; las del Instituto salen en
//  el panel de lugar "Instituto" (gratis, 1 por personaje, existencias semanales); las de evento, en ninguna.
//
// Idempotente: upsert por hechizo `_id` / ítem `ID`. Informa creados, actualizados y sin cambios,
// y la validación de 2.9.

const path = require("path")
const fs = require("fs")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })
const { MongoClient, Int32 } = require("mongodb")

const { FUENTES, PAGINAS, TIENDA, precioPagina } = require("../functions/Aprendizaje/config")
const { contarPalabras } = require("../functions/Aprendizaje/nucleo")

const APLICAR = process.argv.includes("--aplicar")

// Datos de 2.9: invocación escrita a mano y precio decidido (se cruza con el cálculo por aprecio)
const DATOS = [
    ["Pyro-001", "Chispa Ígnea", 1, null, "Eón, presta una chispa a mi mano."],
    ["Pyro-002", "Brasa Penitente", 2, 750, "Eón, acepta mi ofrenda de dolor y concédeme tu brasa más viva."],
    ["Pyro-003", "Pira del Juicio", 3, null, "Eón justo, que el fuego sea juez de todo lo que me rodea; que arda lo falso y se purifique lo demás."],
    ["Aqua-001", "Ola Curativa", 1, null, "Que el agua mansa sane lo herido."],
    ["Aqua-002", "Aguas Mansas", 2, null, "Agua mansa, lleva lejos el mal que hiere y deja solo alivio."],
    ["Aqua-003", "Marea Serena", 3, null, "Agua de todos los mares, sube suave sobre nosotros y restaura lo que el combate ha roto, sin dejar a nadie atrás."],
    ["Lux-001", "Brillo de esperanza", 1, null, "Que tu luz, Eón, no abandone a nadie."],
    ["Lux-002", "Fulgor Bendito", 2, null, "Luz bendita del Eón, cúbrenos con tu fuerza y tu firmeza."],
    ["Lux-003", "Gracia del Firmamento", 3, null, "Eón de la creación, que tu luz descienda sobre este caído y le devuelva el aliento; acepta mi ofrenda como pago."],
    ["Rakau-001", "Bendición de la naturaleza", 1, null, "Árbol antiguo, presta tu savia y tu golpe."],
    ["Rakau-002", "Corteza Viva", 2, 500, "Árbol de raíces profundas, vísteme con tu corteza y tu paciencia."],
    ["Rakau-003", "Raíz del Mundo", 3, null, "Raíces del mundo, despierten bajo mis enemigos, sujétenlos con paciencia y háganlos recordar el peso de la tierra."],
    ["Lapis-001", "Golpe Terrestre", 1, null, "Tierra firme, concédeme el peso de tu puño."],
    ["Lapis-002", "Bastión de Piedra", 2, null, "Piedra primera, álzate ante mí y sé muro para quien me acompaña."],
    ["Lapis-003", "Derrumbe", 3, null, "Piedra primera, madre de todo cimiento, deja caer tu peso sobre quienes nos acechan y que tiemble el suelo bajo ellos."],
    ["Electro-001", "Descarga Eléctrica", 1, null, "Cielo, otórgame un relámpago pequeño y certero."],
    ["Electro-002", "Cadena Voltaica", 2, 500, "Chispa del cielo, salta de enemigo en enemigo sin descanso ni piedad."],
    ["Electro-003", "Relámpago Tardío", 3, null, "Cielo que guardas la tormenta, reúnela en mis manos, dame tiempo para llamarla y déjala caer sobre uno solo."],
    ["Wind-001", "Brisa revitalizante", 1, null, "Brisa gentil, levanta a quien ha caído."],
    ["Wind-002", "Paso del Viento", 2, 500, "Viento amigo, vuélvenos ligeros como hojas y guíanos lejos del daño."],
    ["Wind-003", "Torbellino", 3, null, "Viento de los cuatro rincones, gira a nuestro alrededor, confunde la mirada de nuestros enemigos y esparce su certeza."],
    ["Kryo-001", "Soplo Helado", 1, null, "Que el invierno exhale por mi aliento."],
    ["Kryo-002", "Escarcha Inmóvil", 2, 500, "Escarcha antigua, abraza a mi adversario con tu frío y detén su paso."],
    ["Kryo-003", "Invierno Profundo", 3, null, "Invierno antiguo, desciende sobre este campo, enfría la furia de quienes nos atacan y vuelve lento todo lo que se mueve."],
    ["univ-002", "Concentrar", 1, 400, null],
    ["univ-003", "Provocar", 1, 400, "Que sea yo quien reciba su atención."],
    ["univ-004", "Primeros auxilios", 1, 300, null],
    ["univ-005", "Reposo Estelar", 1, null, null],
].map(([hechizo, nombre, escalon, precio, invocacion]) => ({ hechizo, nombre, escalon, precio, invocacion }))

const PALABRAS = { 1: [6, 8], 2: [10, 14], 3: [18, 24] }
const hoy = () => { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` }
const i32 = (n) => (n === null || n === undefined ? null : new Int32(n))

/** Comparación estructural tolerante a Int32 / number. */
const plano = (v) => JSON.parse(JSON.stringify(v ?? null, (_, x) => (x && x._bsontype === "Int32" ? Number(x.value) : x)))
const igual = (a, b) => JSON.stringify(plano(a)) === JSON.stringify(plano(b))

function adquisicionDe(d) {
    const f = FUENTES[d.hechizo]
    return { via: f.fuente, aprecio: i32(f.aprecio), precio: i32(precioPagina({ fuente: f.fuente, aprecio: f.aprecio, precio: d.precio })) }
}

function descripcionPagina(nombreHechizo, fuente) {
    const base = `Página suelta del grimorio del Instituto. Guarda la forma de «${nombreHechizo}». Úsala para empezar a practicarla.`
    if (fuente === "evento") return `${base} No figura en los estantes del Instituto.`
    if (fuente === "instituto") return `${base} El Instituto la entrega sin costo, una por alumno.`
    return base
}

/** Ítem página con las convenciones del catálogo. `previo` conserva vendido, fecha y creador. */
function itemPagina(d, hechizo, previo) {
    const f = FUENTES[d.hechizo]
    const escalon = hechizo?.Escalon ?? d.escalon
    const precio = precioPagina({ fuente: f.fuente, aprecio: f.aprecio, precio: d.precio })
    return {
        ID: new Int32(f.id),
        ID_Autocomplete: `${PAGINAS.REGION}${f.id}`,
        Region: PAGINAS.REGION,
        Nombre: `${PAGINAS.PREFIJO_NOMBRE}${hechizo?.Nombre ?? d.nombre}`,
        Descripcion: descripcionPagina(hechizo?.Nombre ?? d.nombre, f.fuente),
        Rareza: PAGINAS.RAREZA_POR_ESCALON[escalon ?? 1] ?? "Común",
        Tipo: ["Consumible", PAGINAS.TIPO],
        // Instituto: existencias semanales (se conservan las que queden; las repone el cron de los lunes)
        Cantidad: f.fuente === "instituto" && TIENDA.EXISTENCIAS_SEMANALES !== null
            ? (previo && previo.Cantidad !== null && previo.Cantidad !== undefined && Number.isFinite(Number(plano(previo.Cantidad))) ? previo.Cantidad : new Int32(TIENDA.EXISTENCIAS_SEMANALES))
            : null,
        atributos: { peso: new Int32(PAGINAS.PESO) },
        // Fase 3: tienda → Tienda Mágica; instituto → panel del Instituto (gratis); evento → fuera de las tiendas
        inStore: f.fuente === "tienda" || f.fuente === "instituto",
        precio: i32(precio ?? 0),
        en_tienda: f.fuente === "tienda" ? [TIENDA.LUGAR_TIENDA] : f.fuente === "instituto" ? [TIENDA.LUGAR_INSTITUTO] : [],
        vendido: previo?.vendido ?? new Int32(0),
        fecha: previo?.fecha ?? hoy(),
        evento_origen: null,
        imagenURL: null,
        intercambiable: !PAGINAS.LIGADA, // comercio entre jugadores: pendiente de decidir
        max_por_persona: f.fuente === "instituto" ? new Int32(TIENDA.INSTITUTO_POR_PERSONA) : null,
        max_inventario: new Int32(TIENDA.MAX_INVENTARIO),
        vendible: false,
        valor_base: null,
        durabilidad: null,
        resistencia: null,
        contaminable: false,
        purificable: false,
        tiempo_limite: null,
        creador: previo?.creador ?? "sistema",
        restricciones: { fe_min: new Int32(0), fe_max: new Int32(0), resplandor_min: new Int32(0), resplandor_max: new Int32(0), clase: null, region: null, reputacion: null },
        uso: { contexto: "mapa", consumible: false, requiereSeleccion: false, objetivo: { tipo: "mismo", cantidad: new Int32(1) }, cooldown: null },
        efectos: [],
        // Aprendizaje
        hechizo: d.hechizo,
        ligada: PAGINAS.LIGADA,
        fuente: f.fuente,
    }
}

async function main() {
    const uri = require("../config/entorno").variable("MONGODB_URI")
    if (!uri) throw new Error("Falta MONGODB_URI en .env")
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db("Rol_db")
    const hechizosCol = db.collection("Hechizos_globales")
    const objetosCol = db.collection("Objetos_globales")

    console.log(APLICAR ? "== MODO APLICAR ==" : "== EN SECO (sin escribir; usa --aplicar) ==")
    const ids = DATOS.map(d => d.hechizo)
    const hechizos = new Map((await hechizosCol.find({ _id: { $in: ids } }).toArray()).map(h => [h._id, h]))
    const region = await objetosCol.findOne({ _id: PAGINAS.REGION })
    if (!region) throw new Error(`No existe la región ${PAGINAS.REGION}`)
    const objetos = region.Objetos || []

    // Avisos: precio del documento vs. calculado, IDs de página ocupados por otro objeto
    for (const d of DATOS) {
        const calc = precioPagina({ fuente: FUENTES[d.hechizo].fuente, aprecio: FUENTES[d.hechizo].aprecio })
        if (FUENTES[d.hechizo].fuente === "tienda" && d.precio !== null && d.precio !== calc) {
            console.log(`  ⚠ ${d.hechizo}: precio decidido ${d.precio} ≠ calculado ${calc} (se usa el decidido)`)
        }
        const ocupado = objetos.find(o => Number(o.ID) === FUENTES[d.hechizo].id && o.hechizo !== d.hechizo)
        if (ocupado) throw new Error(`El ID ${FUENTES[d.hechizo].id} ya lo usa "${ocupado.Nombre}". Cambia FUENTES en config.js.`)
    }

    // Respaldo antes de escribir
    if (APLICAR) {
        const dir = path.resolve(__dirname, "respaldos")
        fs.mkdirSync(dir, { recursive: true })
        const archivo = path.join(dir, `Paginas_${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
        fs.writeFileSync(archivo, JSON.stringify({ Hechizos_globales: [...hechizos.values()], Objetos_globales: [region] }, null, 1))
        console.log(`Respaldo: ${archivo}`)
    }

    const cuenta = { hechizos: { creados: 0, actualizados: 0, sinCambios: 0, faltan: 0 }, paginas: { creados: 0, actualizados: 0, sinCambios: 0 } }

    // 1. Hechizos: Invocacion + Adquisicion (solo esos dos campos)
    for (const d of DATOS) {
        const h = hechizos.get(d.hechizo)
        if (!h) { cuenta.hechizos.faltan++; console.log(`  ✖ ${d.hechizo}: no existe en Hechizos_globales`); continue }
        const set = { Adquisicion: adquisicionDe(d) }
        if (d.invocacion) set.Invocacion = d.invocacion
        const cambia = Object.entries(set).some(([k, v]) => !igual(h[k], v))
        if (!cambia) { cuenta.hechizos.sinCambios++; continue }
        cuenta.hechizos.actualizados++
        console.log(`  ~ ${d.hechizo}: ${Object.keys(set).filter(k => !igual(h[k], set[k])).join(", ")}`)
        if (APLICAR) await hechizosCol.updateOne({ _id: d.hechizo }, { $set: set })
    }

    // 2. Ítems página (upsert por ID dentro de la región)
    for (const d of DATOS) {
        const f = FUENTES[d.hechizo]
        const previo = objetos.find(o => Number(o.ID) === f.id)
        const item = itemPagina(d, hechizos.get(d.hechizo), previo)
        if (previo && igual(previo, item)) { cuenta.paginas.sinCambios++; continue }
        if (previo) {
            cuenta.paginas.actualizados++
            console.log(`  ~ página ${f.id} (${item.Nombre})`)
            if (APLICAR) await objetosCol.updateOne({ _id: PAGINAS.REGION }, { $set: { "Objetos.$[o]": item } }, { arrayFilters: [{ "o.ID": f.id }] })
        } else {
            cuenta.paginas.creados++
            console.log(`  + página ${f.id} (${item.Nombre}) · ${item.Rareza} · ${f.fuente}${Number(plano(item.precio)) ? ` · ${plano(item.precio)} Lumens` : ""}`)
            if (APLICAR) await objetosCol.updateOne({ _id: PAGINAS.REGION, "Objetos.ID": { $ne: f.id } }, { $push: { Objetos: item } })
        }
    }

    console.log("\nResultado:", JSON.stringify(cuenta))

    // Validación (2.9): sobre la BD tras aplicar, o sobre lo planeado en seco
    const hFinal = APLICAR ? new Map((await hechizosCol.find({ _id: { $in: ids } }).toArray()).map(h => [h._id, h])) : hechizos
    const oFinal = APLICAR ? ((await objetosCol.findOne({ _id: PAGINAS.REGION })).Objetos || []) : objetos
    const errores = []
    const paginas = DATOS.map(d => (APLICAR ? oFinal.find(o => Number(o.ID) === FUENTES[d.hechizo].id) : itemPagina(d, hechizos.get(d.hechizo))))
    if (paginas.filter(Boolean).length !== 28) errores.push(`Hay ${paginas.filter(Boolean).length} ítems página (se esperaban 28)`)
    for (const [i, p] of paginas.entries()) {
        if (!p) continue
        if (!hFinal.has(p.hechizo)) errores.push(`La página ${p.ID} apunta a ${p.hechizo}, que no existe`)
        if (p.fuente === "tienda" && !(Number(plano(p.precio)) > 0)) errores.push(`La página ${p.ID} es de tienda y no tiene precio`)
        const adq = APLICAR ? hFinal.get(DATOS[i].hechizo)?.Adquisicion : adquisicionDe(DATOS[i])
        if (adq?.via === "tienda" && adq.precio === null) errores.push(`${DATOS[i].hechizo}: Adquisicion.precio null siendo de tienda`)
    }
    for (const d of DATOS) {
        const h = hFinal.get(d.hechizo)
        const inv = APLICAR ? h?.Invocacion : (d.invocacion ?? h?.Invocacion)
        const vias = h?.Mecanicas?.cast?.vias || []
        if (vias.includes("hablado") && !String(inv ?? "").trim()) errores.push(`${d.hechizo} tiene vía hablado y no tiene Invocacion`)
        if (inv) {
            const esc = String(d.hechizo).startsWith("univ-") ? 1 : (h?.Escalon ?? d.escalon)
            const [min, max] = PALABRAS[esc]
            const n = contarPalabras(inv)
            if (n < min || n > max) errores.push(`${d.hechizo}: la invocación tiene ${n} palabras (escalón ${esc}: ${min}–${max})`)
        }
    }
    console.log(errores.length ? `\nValidación: ${errores.length} problema(s)\n - ${errores.join("\n - ")}` : "\nValidación: OK (28 páginas, invocaciones y precios en regla)")
    await client.close()
}

// Reutilizable por scripts/seedNotasResplandor.js (mismas convenciones de ítem página)
module.exports = { itemPagina, descripcionPagina, plano, igual, i32 }

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) })
