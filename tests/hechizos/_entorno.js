// Entorno de pruebas del combate sin Discord ni Mongo: reemplaza Server.js y bot.js por dobles
// en memoria (la caché de hechizos se llena con el catálogo semilla).
const Module = require("module")
const { CATALOGO } = require("../../functions/Duelo/hechizos/catalogo")

const coleccionFalsa = (nombre) => ({
    find: () => ({ toArray: async () => (nombre === "Hechizos_globales" ? CATALOGO.map(h => JSON.parse(JSON.stringify(h))) : []) }),
    findOne: async (q) => {
        if (nombre === "Hechizos_globales") return CATALOGO.find(h => h._id === q?._id) ?? null
        if (nombre === "Personajes") return { _id: q?._id }
        if (nombre === "Soul") return { _id: q?._id, sendero: { StelarFragmentsTotal: 500, resplandor: "VII" } }
        return {}
    },
    createIndex: async () => null,
    updateOne: async () => ({ modifiedCount: 0 }),
    countDocuments: async () => 1,
})
const ServerFalso = { db: () => ({ collection: coleccionFalsa }) }

const cargarOriginal = Module._load
Module._load = function (req, parent, isMain) {
    if (/(^|[\\/])Server(\.js)?$/.test(req)) return ServerFalso
    if (/(^|[\\/])bot(\.js)?$/.test(req)) return {}
    return cargarOriginal.apply(this, arguments)
}

const { Personaje, NPC } = require("../../functions/Duelo/combatientes")
const sesionesCombate = require("../../functions/Duelo/sesionesCombate")
const TurnProcessor = require("../../functions/Duelo/turnProcessor")
const cache = require("../../functions/Duelo/hechizos/cache")

// Silenciar los console.log ruidosos del motor durante las pruebas
console.log = () => {}

let siguienteId = 100
function jugador({ nombre = "Jugador", elemento = "Aqua", hechizos = [], maestrias = {}, resonancia = 1, disonancia = 0, equipo = [], stats = {} } = {}) {
    const id = siguienteId++
    return new Personaje(id, {
        ownerId: `u${id}`,
        perfil: { Nombre: nombre },
        nucleo: { HP: 200, Mana: 200, Elemento: elemento },
        stats: { hpMax: 200, manaMax: 200, inteligencia: 10, agilidad: 5, ...stats },
        sendero: { resonancia, disonancia, resplandor: "VII" },
        dominio: { hechizos: hechizos.map(h => ({ ID: h, InCombat: true, ...(maestrias[h] ? { maestria: maestrias[h] } : {}) })), equipo },
    })
}

function npc({ nombre = "Bestia", humano = false, ataques = [], jefe = false } = {}) {
    const id = `NPC-T${siguienteId++}`
    return new NPC(id, {
        Nombre: nombre, HP: 300, Mana: 300, Elemento: "Neutro", tipo: humano ? "humano" : undefined,
        stats: { hpMax: 300, manaMax: 300, inteligencia: 10, agilidad: 5 }, ataques, ...(jefe ? { boss: { fases: [] } } : {}),
    })
}

function sesion(equipo1, equipo2, opciones = {}) {
    const s = new sesionesCombate({ sessionId: `T${siguienteId++}`, type: opciones.type ?? "pvp", teams: [equipo1, equipo2], apuestas: opciones.apuestas ?? null })
    s.removeAllListeners()
    return s
}

/** Ejecuta fn con Math.random fijo. */
function conAzar(valor, fn) {
    const original = Math.random
    Math.random = () => valor
    try { return fn() } finally { Math.random = original }
}

async function conAzarAsync(valor, fn) {
    const original = Math.random
    Math.random = () => valor
    try { return await fn() } finally { Math.random = original }
}

module.exports = { jugador, npc, sesion, conAzar, conAzarAsync, TurnProcessor, cache, CATALOGO }
