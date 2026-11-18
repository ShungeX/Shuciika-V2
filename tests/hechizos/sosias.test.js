// Habilidad única de Sosias (NPC-004): copia al jugador tras 3 turnos.
const test = require("node:test")
const assert = require("node:assert/strict")
const { jugador, npc, sesion, conAzarAsync, TurnProcessor, cache } = require("./_entorno")

const NpcAi = require("../../functions/Duelo/npcAi")
const { SOSIAS, ultimosAtaques } = require("../../functions/Duelo/habilidadesNPC/sosias")
const { HABILIDADES } = require("../../functions/Duelo/habilidadesNPC")

test.before(async () => { await cache.asegurar() })

function montar() {
    const pj = jugador({ nombre: "Ayame", elemento: "Aqua", hechizos: ["univ-001", "Aqua-001", "Aqua-002"], stats: { fuerza: 12, agilidad: 9, sabiduria: 4 } })
    const sosias = npc({ nombre: "Sosias" })
    sosias.habilidadUnica = "sosias"
    const s = sesion([pj], [sosias], { type: "pve" })
    return { pj, sosias, s }
}

test("Sosias: registrada como habilidad conocida", () => {
    assert.ok(HABILIDADES.includes("sosias"))
    assert.deepEqual([SOSIAS.TURNOS_ANTES, SOSIAS.BONUS_VIDA, SOSIAS.MIEDO_TURNOS, SOSIAS.COPIAS], [3, 0.3, 3, 3])
})

test("Sosias: 3 turnos normales; al 4.º copia stats y vida actual + 30% de la máxima, y aplica Miedo 3 turnos", async () => {
    const { pj, sosias, s } = montar()
    for (let i = 0; i < 3; i++) {
        await conAzarAsync(0.5, () => NpcAi.executeTurn(s, sosias))
        assert.equal(sosias.sosias.fase, "acecho", `turno ${i + 1}: todavía no copia`)
    }
    pj.HP = 50   // vida actual baja: la copia NO nace con 50, sino con 50 + 30% de 200
    await NpcAi.executeTurn(s, sosias)
    assert.equal(sosias.sosias.fase, "espejo")
    assert.equal(sosias.HP, 50 + 0.3 * 200)
    assert.equal(sosias.stats.fuerza, 12)
    assert.equal(sosias.stats.agilidad, 9)
    assert.equal(sosias.elemento, "Aqua")
    assert.equal(sosias.esHumano, true, "castea con las vías del jugador")
    const miedo = pj.statusEffect.find(e => String(e.Nombre).includes("Miedo"))
    assert.ok(miedo, "el jugador recibe Miedo")
    assert.equal(miedo.duracion, 3)
    assert.equal(sosias.sosias.cola.length, 3)
    s.limpiarWatchdog()
})

test("Sosias: el truco de bajarse a 1 HP no deja a la copia con 1 HP", async () => {
    const { pj, sosias, s } = montar()
    sosias.sosias = { turnos: 3, fase: "acecho", cola: [] }
    pj.HP = 1
    await NpcAi.executeTurn(s, sosias)
    assert.equal(sosias.HP, 1 + 60)
    s.limpiarWatchdog()
})

test("Sosias: copia los últimos 3 ataques, los repite 3 turnos, lanza uno al azar y vuelve a copiar", async () => {
    const { pj, sosias, s } = montar()
    // El jugador ataca: Golpe, Aqua-002, Golpe, Aqua-001 (y se cubre: Guardia no es un ataque)
    await conAzarAsync(0.5, () => TurnProcessor.resolveAction(s, pj.ID, { tipo: "attack", targetId: sosias.ID }))
    pj.cooldowns = {}; await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, pj, "Aqua-002", [pj.ID]))
    await conAzarAsync(0.5, () => TurnProcessor.resolveAction(s, pj.ID, { tipo: "attack", targetId: sosias.ID }))
    pj.cooldowns = {}; await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, pj, "Aqua-001", [pj.ID]))
    await TurnProcessor.resolveAction(s, pj.ID, { tipo: "defend" })
    assert.deepEqual(ultimosAtaques(pj), [{ tipo: "spell", id: "Aqua-002" }, { tipo: "attack" }, { tipo: "spell", id: "Aqua-001" }])

    sosias.sosias = { turnos: 3, fase: "acecho", cola: [] }
    await NpcAi.executeTurn(s, sosias)   // transformación
    assert.deepEqual(sosias.sosias.cola, [{ tipo: "spell", id: "Aqua-002" }, { tipo: "attack" }, { tipo: "spell", id: "Aqua-001" }])

    // Sus siguientes 3 turnos repiten esos ataques, en orden
    const usados = []
    const original = TurnProcessor.resolverHechizo.bind(TurnProcessor)
    const originalAccion = TurnProcessor.resolveAction.bind(TurnProcessor)
    TurnProcessor.resolverHechizo = async (ses, c, id, t) => { if (c === sosias) usados.push(typeof id === "string" ? id : id?._id); return original(ses, c, id, t) }
    TurnProcessor.resolveAction = async (ses, id, acc) => { if (id === sosias.ID) usados.push(acc.tipo); return originalAccion(ses, id, acc) }
    try {
        for (let i = 0; i < 3; i++) await conAzarAsync(0.01, () => NpcAi.executeTurn(s, sosias))
        assert.deepEqual(usados, ["Aqua-002", "attack", "Aqua-001"])
        assert.equal(sosias.sosias.cola.length, 0)

        // El jugador lanza algo nuevo antes del turno al azar
        await conAzarAsync(0.5, () => originalAccion(s, pj.ID, { tipo: "attack", targetId: sosias.ID }))
        usados.length = 0
        await conAzarAsync(0.01, () => NpcAi.executeTurn(s, sosias))   // ataque al azar del kit
        assert.equal(usados.length, 1)
        assert.ok(["attack", "Aqua-001", "Aqua-002"].includes(usados[0]), `del kit del jugador: ${usados[0]}`)
        assert.notEqual(usados[0], "univ-001", "Guardia no cuenta como ataque")
        // ...y vuelve a copiar los últimos 3 para sus siguientes 3 turnos
        assert.deepEqual(sosias.sosias.cola, [{ tipo: "attack" }, { tipo: "spell", id: "Aqua-001" }, { tipo: "attack" }])
    } finally {
        TurnProcessor.resolverHechizo = original
        TurnProcessor.resolveAction = originalAccion
    }
    s.limpiarWatchdog()
})

test("Sosias: con pocos ataques del jugador, completa la copia con su kit", async () => {
    const { sosias, s } = montar()
    sosias.sosias = { turnos: 3, fase: "acecho", cola: [] }
    await NpcAi.executeTurn(s, sosias)
    assert.equal(sosias.sosias.cola.length, 3)
    for (const a of sosias.sosias.cola) assert.ok(a.tipo === "attack" || ["Aqua-001", "Aqua-002"].includes(a.id))
    s.limpiarWatchdog()
})
