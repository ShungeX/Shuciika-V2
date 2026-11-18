// Notas de Resplandor I (Notas_Nuevas_Resplandor_I.md): datos y mecánicas nuevas que piden.
const test = require("node:test")
const assert = require("node:assert/strict")
const { jugador, npc, sesion, conAzarAsync, TurnProcessor, cache } = require("./_entorno")

const { NOTAS_RESPLANDOR_I } = require("../../functions/Duelo/hechizos/notasResplandor")
const { auditar } = require("../../functions/Duelo/hechizos/calibracion")
const { validarHechizo, completarHechizoParaGuardar } = require("../../functions/Duelo/hechizos/esquema")
const { normalizarHechizo, convertirEfectos } = require("../../functions/Duelo/hechizos/adaptador")
const { siguienteIdHechizo } = require("../../functions/Duelo/hechizos/elementos")
const { regenerarManaTurno } = require("../../functions/Duelo/hechizos/mana")
const { aplicarEfectoObjeto } = require("../../functions/Duelo/efectosObjeto")
const { modificadores } = require("../../functions/Duelo/hechizos/efectos")

test.before(async () => { await cache.asegurar() })

test("Las 16 Notas validan, están en banda y cuadran con el I≈ del documento", () => {
    assert.equal(NOTAS_RESPLANDOR_I.length, 16)
    const doc = { "Pyro-101": 5.1, "Pyro-102": 5.4, "Aqua-101": 5.1, "Aqua-102": 5.4, "Lux-101": 5.1, "Lux-102": 5.4, "Rakau-101": 5.1, "Rakau-102": 5.9,
        "Lapis-101": 5.6, "Lapis-102": 5.7, "Electro-101": 5.8, "Electro-102": 5.3, "Wind-101": 5.5, "Wind-102": 4.9, "Kryo-101": 6.0, "Kryo-102": 5.5 }
    for (const r of auditar(NOTAS_RESPLANDOR_I)) {
        assert.equal(r.fuera, false, `${r.id} fuera de banda (${r.I})`)
        assert.ok(Math.abs(r.I - doc[r.id]) <= 0.06, `${r.id}: I=${r.I}, documento ${doc[r.id]}`)
    }
    for (const h of NOTAS_RESPLANDOR_I) assert.deepEqual(validarHechizo(normalizarHechizo(h)), [], h._id)
    // Cada elemento reparte sus dos Notas en vías distintas
    const porElemento = {}
    for (const h of NOTAS_RESPLANDOR_I) (porElemento[h.Elemento] ??= []).push(h.Mecanicas.cast.vias[0])
    for (const [el, vias] of Object.entries(porElemento)) assert.notEqual(vias[0], vias[1], el)
})

test("La serie -101/-102 no empuja el contador automático de IDs", () => {
    assert.equal(siguienteIdHechizo("Pyrós", ["Pyro-001", "Pyro-002", "Pyro-003", "Pyro-101", "Pyro-102"]), "Pyro-004")
})

test("Doble Descarga: cadena con tope de 2 objetivos (100% / 70%)", async () => {
    const mago = jugador({ elemento: "Electro", hechizos: ["Electro-102"] })
    const a = npc({ nombre: "A" }), b = npc({ nombre: "B" }), c = npc({ nombre: "C" })
    const s = sesion([mago], [a, b, c], { type: "pve" })
    const r = await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, mago, "Electro-102", [a.ID]))
    assert.ok(r.success, r.message)
    const golpeados = [a, b, c].filter(n => n.HP < 300)
    assert.equal(golpeados.length, 2, "solo dos objetivos")
    assert.ok(a.HP < 300, "el elegido recibe el golpe completo")
    const otro = golpeados.find(n => n !== a)
    assert.ok((300 - otro.HP) < (300 - a.HP), "el segundo recibe menos (70%)")
    s.limpiarWatchdog()
})

test("Savia Vital: solo a otro aliado; sin aliados no se lanza", async () => {
    const solo = jugador({ elemento: "Rakau", hechizos: ["Rakau-102"] })
    const s1 = sesion([solo], [npc()], { type: "pve" })
    const r1 = await TurnProcessor.resolverHechizo(s1, solo, "Rakau-102", null)
    assert.equal(r1.success, false)
    assert.match(r1.message, /otro aliado/)
    s1.limpiarWatchdog()

    const druida = jugador({ elemento: "Rakau", hechizos: ["Rakau-102"] }), amigo = jugador({ nombre: "Amigo" })
    const s2 = sesion([druida, amigo], [npc()], { type: "pve" })
    const r2 = await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s2, druida, "Rakau-102", null))
    assert.ok(r2.success, r2.message)
    assert.ok(amigo.statusEffect.some(e => e.tipo === "regen_mana" && e.valor === 4 && e.duracion === 3), "el aliado recibe +4/turno")
    assert.ok(!druida.statusEffect.some(e => e.tipo === "regen_mana"), "el lanzador nunca lo recibe")
    amigo.Mana = 100
    assert.equal(regenerarManaTurno(amigo), 2 + 4, "se suma al +2 base")
    s2.limpiarWatchdog()
})

test("Chispa Veloz: daña al enemigo y acelera al lanzador", async () => {
    const mago = jugador({ elemento: "Electro", hechizos: ["Electro-101"] }), rival = npc()
    const s = sesion([mago], [rival], { type: "pve" })
    await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, mago, "Electro-101", [rival.ID]))
    assert.ok(rival.HP < 300)
    assert.ok(modificadores(mago).velocidad > 0)
    assert.equal(modificadores(rival).velocidad, 0)
    s.limpiarWatchdog()
})

test("Calma Helada y Ráfaga Cortante: debuffs de daño y precisión en el enemigo", async () => {
    const k = jugador({ elemento: "Kryo", hechizos: ["Kryo-101"] }), w = jugador({ elemento: "Wind", hechizos: ["Wind-101"] }), rival = npc()
    const s = sesion([k, w], [rival], { type: "pve" })
    await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, k, "Kryo-101", [rival.ID]))
    await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, w, "Wind-101", [rival.ID]))
    const m = modificadores(rival)
    assert.equal(m.danio, -0.2)
    assert.equal(m.precision, -0.25)
    s.limpiarWatchdog()
})

test("Guardar desde el dashboard conserva objetivosMax y excluirLanzador", () => {
    const previo = NOTAS_RESPLANDOR_I.find(h => h._id === "Electro-102")
    const armado = { ...previo, Mecanicas: { cast: { tiempo: 1, probabilidad: 0.8 }, damage: { base: 11, scaling: { stats: "inteligencia", multi: 1.25 }, objetivo: "enemigos" } } }
    const r = completarHechizoParaGuardar(armado, { Mecanicas: { damage: { alcance: "cadena" }, cast: { vias: ["movimiento"] } } }, previo)
    assert.ok(r.ok, r.errores.join("; "))
    assert.equal(r.doc.Mecanicas.damage.objetivosMax, 2, "sin dato nuevo se conserva el previo")
    const malo = completarHechizoParaGuardar(armado, { Mecanicas: { damage: { alcance: "cadena", objetivosMax: 7 }, cast: { vias: ["movimiento"] } } }, previo)
    assert.equal(malo.ok, false)

    const savia = NOTAS_RESPLANDOR_I.find(h => h._id === "Rakau-102")
    const r2 = completarHechizoParaGuardar({ ...savia, Mecanicas: { cast: { tiempo: 1, probabilidad: 0.8 } } }, { Mecanicas: { Efectos: savia.Mecanicas.Efectos, cast: { vias: ["hablado"] } } }, savia)
    assert.ok(r2.ok, r2.errores.join("; "))
    assert.equal(r2.doc.Mecanicas.Efectos[0].tipo, "regen_mana", "regen_mana ya no cae a 'legacy'")
    assert.equal(r2.doc.Mecanicas.Efectos[0].excluirLanzador, true)
})

test("Claves cortas de NPC inline → efectos tipados", () => {
    const [esq, deb, regen, purif] = convertirEfectos({
        esquive: { base: 30, duracion: 2, objetivo: "mismo" },
        debilidad: { base: 20, duracion: 3, objetivo: "enemigos" },
        regen_mana: { base: 5, duracion: 2, objetivo: "aliados" },
        purificacion: { base: 1, objetivo: "aliados" },
    })
    assert.deepEqual([esq.tipo, esq.stat, esq.valor], ["buff", "esquive", 0.3])
    assert.deepEqual([deb.tipo, deb.stat, deb.valor], ["debuff", "daño", -0.2])
    assert.deepEqual([regen.tipo, regen.valor, regen.duracion], ["regen_mana", 5, 2])
    assert.deepEqual([purif.tipo, purif.cantidad], ["cleanse", 1])
})

test("Objetos con 'aplica': ánimo, escudo e imprecisión se aplican como efectos tipados y se limpian por clave", () => {
    const pj = jugador(), rival = npc()
    const s = sesion([pj], [rival], { type: "pve" })
    aplicarEfectoObjeto({ session: s, caster: pj, target: pj, efecto: { tipo: "aplica", efecto: "animo", valor: 20, duracion: 3 }, objeto: { ID: 1 } })
    aplicarEfectoObjeto({ session: s, caster: pj, target: pj, efecto: { tipo: "aplica", efecto: "escudo", valor: 40, duracion: 2 }, objeto: { ID: 1 } })
    aplicarEfectoObjeto({ session: s, caster: pj, target: rival, efecto: { tipo: "aplica", efecto: "imprecision", duracion: 2 }, objeto: { ID: 1 } })
    assert.equal(modificadores(pj).danio, 0.2)
    assert.ok(pj.statusEffect.some(e => e.tipo === "escudo" && e.puntos === 40))
    assert.equal(modificadores(rival).precision, -0.25)
    aplicarEfectoObjeto({ session: s, caster: pj, target: rival, efecto: { tipo: "limpia", efectos: ["imprecision"] }, objeto: { ID: 2 } })
    assert.equal(modificadores(rival).precision, 0)
    s.limpiarWatchdog()
})
