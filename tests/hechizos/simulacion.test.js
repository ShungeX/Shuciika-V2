// Simulación de combates completos con el motor real (compás, IA de NPC, watchdog) usando los
// hechizos tal como están HOY en la base de datos (formato antiguo, pasan por el adaptador).
const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("path")
const fs = require("fs")
const Module = require("module")

const LEGADO = JSON.parse(fs.readFileSync(path.join(__dirname, "../fixtures/hechizosLegacy.json"), "utf8"))
const { CATALOGO } = require("../../functions/Duelo/hechizos/catalogo")
const TODOS = [...LEGADO, ...CATALOGO.filter(c => !LEGADO.some(h => h._id === c._id))]
// Mezcla: los 9 antiguos en su formato original + los nuevos del catálogo
const coleccion = (nombre) => ({
    find: () => ({ toArray: async () => (nombre === "Hechizos_globales" ? JSON.parse(JSON.stringify(TODOS)) : []) }),
    findOne: async (q) => nombre === "Hechizos_globales" ? (TODOS.find(h => h._id === q?._id) ?? null)
        : nombre === "Soul" ? { sendero: { StelarFragmentsTotal: 500, resplandor: "VII" } } : { _id: q?._id },
    createIndex: async () => null, updateOne: async () => ({}), countDocuments: async () => 1,
})
const cargar = Module._load
Module._load = function (req) {
    if (/(^|[\\/])Server(\.js)?$/.test(req)) return { db: () => ({ collection: coleccion }) }
    if (/(^|[\\/])bot(\.js)?$/.test(req)) return {}
    return cargar.apply(this, arguments)
}
console.log = () => {}
// Sin esperas de 2–3 s entre turnos de NPC ni watchdog de 40 s
const setTimeoutReal = global.setTimeout
global.setTimeout = (fn, ms, ...a) => setTimeoutReal(fn, ms > 1000 ? 0 : ms, ...a)

const { Personaje, NPC } = require("../../functions/Duelo/combatientes")
const sesionesCombate = require("../../functions/Duelo/sesionesCombate")
const TurnProcessor = require("../../functions/Duelo/turnProcessor")
const cache = require("../../functions/Duelo/hechizos/cache")
const { asciiText } = require("../../utils/utilidadesTexto")

function pj(id, elemento, hechizos) {
    return new Personaje(id, {
        ownerId: `u${id}`, perfil: { Nombre: `PJ${id}` },
        nucleo: { HP: 150, Mana: 80, Elemento: elemento },
        stats: { hpMax: 150, manaMax: 80, inteligencia: 10, agilidad: 8, fuerza: 6 },
        sendero: { resonancia: 1, resplandor: "II" },
        dominio: { hechizos: hechizos.map(ID => ({ ID, InCombat: true })) },
    })
}

async function combate(teams, type, turnosMax = 120) {
    const s = new sesionesCombate({ sessionId: `SIM${Math.random()}`, type, teams })
    s.removeAllListeners()
    let fin = null
    s.on("combateFinalizado", d => { fin = d })
    await cache.asegurar()
    if (s.getCurrentActor()?.isNPC) await TurnProcessor.advanceCompas(s, null)
    for (let i = 0; i < turnosMax && !fin && s.state !== "FINALIZADO"; i++) {
        const actor = s.getCurrentActor()
        if (!actor) break
        const salto = TurnProcessor.motivoSaltoTurno(actor)
        if (salto) { await TurnProcessor.saltarTurnoSistema(s, actor, salto); continue }
        const ids = actor.hechizos.map(h => h.ID)
        const id = ids[i % (ids.length + 1)]
        let r = id ? await TurnProcessor.resolverHechizo(s, actor, id, null) : null
        if (process.env.DBG_SIM && id) process.stderr.write(`[sim] ${actor.Nombre} ${id} → ${r?.success} ${r?.message || ""}
`)
        if (r?.requiresInteraction) {
            const c = [...(r.candidatosDamage || []), ...(r.candidatosHealing || [])]
            r = await TurnProcessor.resolverHechizo(s, actor, id, { damage: r.candidatosDamage.slice(0, 1).map(x => x.ID), healing: r.candidatosHealing.slice(0, 1).map(x => x.ID) })
        }
        if (!r || !r.success) {
            const rivales = (s.teams[0].includes(actor) ? s.teams[1] : s.teams[0]).filter(c => !c.defeated)
            r = await TurnProcessor.resolveAction(s, actor.ID, { tipo: "attack", targetId: rivales[0]?.ID })
            if (!r.success) r = await TurnProcessor.resolveAction(s, actor.ID, { tipo: "defend" })
        }
        await TurnProcessor.advanceCompas(s, actor)
    }
    s.limpiarWatchdog()
    return { s, fin }
}

test("Simulación PvP con los hechizos actuales (formato antiguo): sin errores y el log se puede pintar", async () => {
    const { s } = await combate([[pj(1, "Electro", ["Electro-001"])], [pj(2, "Kryo", ["Kryo-001"])]], "pvp")
    assert.ok(s.log.length > 5)
    for (const l of s.log) assert.notEqual(asciiText(l), "Acción desconocida.", JSON.stringify(l).slice(0, 200))
    assert.ok(s.log.some(l => l.data?.item?.tipo === "hechizo"), "se lanzaron hechizos")
})

test("Simulación 2v2 contra NPC con IA y hechizos nuevos (área, cadena, escudo, canalización)", async () => {
    const bestia = new NPC("NPC-SIM1", {
        Nombre: "Dragón", HP: 400, Mana: 100, Elemento: "Pyró", stats: { hpMax: 400, inteligencia: 8, fuerza: 9, agilidad: 6 },
        ataques: [
            { id: "zarpazo", name: "Zarpazo", type: 2, damage: { base: 12 }, probabilidad: 60 },
            { id: "aliento", name: "Aliento", type: 2, damage: { base: 30 }, cast: { tiempo: 2, probabilidad: 1, interruptible: true }, probabilidad: 40 },
        ],
    })
    const { s } = await combate([[pj(3, "Electro", ["Electro-002", "Electro-001", "Electro-003"]), pj(4, "Lapis", ["Lapis-002", "Lapis-001", "Lapis-003"])], [bestia]], "pve", 200)
    for (const l of s.log) assert.notEqual(asciiText(l), "Acción desconocida.", JSON.stringify(l).slice(0, 200))
    assert.ok(s.ronda >= 2, "avanzaron las rondas")
})
