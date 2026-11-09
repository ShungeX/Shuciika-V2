// Adaptador de compatibilidad, esquema y calibración.
const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("path")
const fs = require("fs")

const { normalizarHechizo } = require("../../functions/Duelo/hechizos/adaptador")
const { validarHechizo, completarHechizoParaGuardar } = require("../../functions/Duelo/hechizos/esquema")
const { auditar, auditarMana, indiceEficiencia } = require("../../functions/Duelo/hechizos/calibracion")
const { CATALOGO } = require("../../functions/Duelo/hechizos/catalogo")
const { normalizarElemento, siguienteIdHechizo } = require("../../functions/Duelo/hechizos/elementos")
const { nivelPorUsos, recortarACupo, mapaMaestrias } = require("../../functions/Duelo/hechizos/maestria")
const { probabilidadConMaestria, evaluarCasteo } = require("../../functions/Duelo/hechizos/casteo")

const LEGADO = JSON.parse(fs.readFileSync(path.join(__dirname, "../fixtures/hechizosLegacy.json"), "utf8"))
const porId = (id) => normalizarHechizo(LEGADO.find(h => h._id === id))

test("Adaptador: los 9 hechizos actuales pasan al formato nuevo y validan", () => {
    for (const doc of LEGADO) {
        const h = normalizarHechizo(doc)
        assert.equal(h.Tipo, undefined, `${doc._id} conserva Tipo`)
        assert.ok(Array.isArray(h.Mecanicas.Efectos), `${doc._id} Efectos no es array`)
        assert.deepEqual(validarHechizo(h), [], doc._id)
    }
})

test("Adaptador: migración de la tabla XI.C", () => {
    const electro = porId("Electro-001").Mecanicas.Efectos[0]
    assert.equal(electro.tipo, "control")
    assert.equal(electro.nombre, "Parálisis")
    assert.equal(electro.duracion, 2)
    assert.equal(electro.probabilidad, 0.7)
    assert.ok(electro.bloquea.includes("instinto") && !electro.bloquea.includes("mental"))
    const lapis = porId("Lapis-001").Mecanicas.Efectos[0]
    assert.equal(lapis.nombre, "Aturdimiento")
    assert.deepEqual([...lapis.bloquea].sort(), ["escritura", "instinto", "mental"])
    assert.equal(porId("Wind-001").Mecanicas.Efectos[0].tipo, "buff")
    assert.equal(porId("Kryo-001").Mecanicas.Efectos[0].tipo, "degradacion")
    assert.equal(porId("Pyro-001").Mecanicas.Efectos[0].tipo, "dot")
})

test("Adaptador: vías nativas, elemento canónico y nombre limpio (XII.A)", () => {
    assert.deepEqual(porId("Aqua-001").Mecanicas.cast.vias, ["hablado"])
    assert.deepEqual(porId("Kryo-001").Mecanicas.cast.vias, ["escritura"])
    assert.deepEqual(porId("Electro-001").Mecanicas.cast.vias, ["movimiento"])
    const pyro = porId("Pyro-001")
    assert.equal(pyro.Elemento, "Pyrós")
    assert.equal(pyro.Nombre, "Chispa Ignea")
    assert.equal(pyro.Escalon, 1)
    assert.equal(normalizarElemento("Pyró"), "Pyrós")
    assert.equal(normalizarElemento("Krýo"), "Kryo")
    const n = normalizarHechizo(LEGADO[0])
    assert.equal(normalizarHechizo(n), n, "idempotente")
})

test("Adaptador: `objetivo` se separa en quién + cuántos", () => {
    assert.deepEqual(porId("Rakau-001").Mecanicas.healing.objetivo, "global")   // dato antiguo; la migración lo corrige a 'mismo'
    assert.equal(porId("Lux-001").Mecanicas.healing.alcance, "single")
    const lux = normalizarHechizo(CATALOGO.find(h => h._id === "Lux-001"))
    assert.equal(lux.Mecanicas.healing.alcance, "todos")
    assert.equal(normalizarHechizo(CATALOGO.find(h => h._id === "Rakau-001")).Mecanicas.healing.objetivo, "mismo")
})

test("Catálogo: 24 elementales (8 × 3) + 5 universales, todos válidos y sin _id duplicados", () => {
    const ids = CATALOGO.map(h => h._id)
    assert.equal(new Set(ids).size, ids.length)
    const elementales = CATALOGO.filter(h => h.Escalon)
    assert.equal(elementales.length, 24)
    for (const e of [1, 2, 3]) assert.equal(elementales.filter(h => h.Escalon === e).length, 8)
    for (const h of CATALOGO) assert.deepEqual(validarHechizo(normalizarHechizo(h)), [], h._id)
})

test("Calibración: reproduce los I≈ del documento (±0.1)", () => {
    const esperado = {
        "Pyro-001": 6.1, "Pyro-002": 6.3, "Pyro-003": 6.8, "Aqua-001": 5.0, "Aqua-002": 6.2, "Aqua-003": 7.2,
        "Lux-001": 5.2, "Lux-002": 6.3, "Lux-003": 7.0, "Rakau-001": 4.7, "Rakau-002": 6.4, "Lapis-001": 5.2,
        "Lapis-002": 6.6, "Lapis-003": 6.6, "Electro-001": 5.5, "Electro-002": 6.2, "Electro-003": 6.5,
        "Wind-001": 5.1, "Wind-002": 6.6, "Wind-003": 7.1, "Kryo-001": 6.9, "Kryo-002": 6.1, "Kryo-003": 6.8,
    }
    for (const [id, I] of Object.entries(esperado)) {
        const real = indiceEficiencia(CATALOGO.find(h => h._id === id))
        assert.ok(Math.abs(real - I) <= 0.1, `${id}: ${real.toFixed(2)} vs ${I}`)
    }
    // Banda: el propio documento deja Kryo-001 (6.9) y Electro-003 (6.46) fuera; el script lo marca
    const fuera = auditar(CATALOGO).filter(r => r.fuera).map(r => r.id).sort()
    assert.deepEqual(fuera, ["Electro-003", "Kryo-001"])
    assert.equal(auditarMana(CATALOGO).filter(r => r.fuera).length, 0)
})

test("Esquema: rechaza un Acorde con una sola vía y un control sin vías", () => {
    const malo = normalizarHechizo({ ...CATALOGO.find(h => h._id === "Aqua-002") })
    malo.Mecanicas = { ...malo.Mecanicas, cast: { ...malo.Mecanicas.cast, vias: ["hablado"] }, Efectos: [{ tipo: "control", nombre: "Raro", duracion: 2, objetivo: "enemigos", alcance: "single", bloquea: [] }] }
    const err = validarHechizo(malo)
    assert.ok(err.some(e => /Acorde exige 2/.test(e)))
    assert.ok(err.some(e => /declarar las vías/.test(e)))
})

test("Esquema: guardar desde el dashboard actual no borra vías ni el tipo de los Efectos", () => {
    const previo = JSON.parse(JSON.stringify(CATALOGO.find(h => h._id === "Kryo-002")))
    // Lo que manda hoy el dashboard: Tipo + Efectos como objeto { Nombre, base, duracion, objetivo, probabilidad }
    const entrada = { Nombre: "Escarcha Inmóvil", Tipo: "movimiento", Mecanicas: { Efectos: { 0: { Nombre: "Congelado", base: 0, duracion: 3, objetivo: "enemigos", probabilidad: 0.7 } } } }
    const armado = { _id: "Kryo-002", Nombre: "Escarcha Inmóvil", Tipo: "movimiento", Elemento: "Kryo", isActive: true, Req: previo.Req,
        Mecanicas: { cast: { tiempo: 1, probabilidad: 0.8, interruptible: true }, damage: { base: 45, scaling: { stats: "inteligencia", multi: 4.5 }, objetivo: "enemigos" } },
        Costos: previo.Costos, Creado: "", uso: "combate" }
    const r = completarHechizoParaGuardar(armado, entrada, previo)
    assert.deepEqual(r.errores, [])
    assert.deepEqual(r.doc.Mecanicas.cast.vias, ["escritura", "movimiento"])
    assert.equal(r.doc.Escalon, 2)
    assert.equal(r.doc.Mecanicas.Efectos[0].tipo, "control")
    assert.equal(r.doc.Mecanicas.Efectos[0].duracion, 3, "el cambio de duración sí se aplica")
    assert.equal(r.doc.Tipo, undefined)
})

test("IDs: el siguiente ID no lleva tilde aunque el elemento sí", () => {
    assert.equal(siguienteIdHechizo("Pyró", ["Pyro-001", "Pyro-003", "Aqua-001"]), "Pyro-004")
    assert.equal(siguienteIdHechizo("Pyrós", []), "Pyro-001")
})

test("Maestría: umbrales, tope 95% y −1 de maná para Maestro en hechizos al 100%", () => {
    assert.deepEqual([0, 24, 25, 99, 100, 299, 300].map(nivelPorUsos), [1, 1, 2, 2, 3, 3, 4])
    assert.equal(probabilidadConMaestria(0.6, 2), 0.7)
    assert.equal(probabilidadConMaestria(0.8, 4), 0.95)
    assert.equal(probabilidadConMaestria(1, 4), 1)
    const pj = { maestrias: mapaMaestrias([{ ID: "Pyro-001", usos: 300 }]), Mana: 100, HP: 100, isNPC: true, esHumano: true }
    assert.equal(evaluarCasteo(pj, CATALOGO.find(h => h._id === "Pyro-001")).costoMana, 4)
    assert.deepEqual(recortarACupo({ a: 5, b: 5 }, 7), { a: 5, b: 2 })
})
