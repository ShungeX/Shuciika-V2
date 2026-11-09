// Casos de prueba mínimos del Sistema de hechizos (XII.C) y reglas asociadas.
const test = require("node:test")
const assert = require("node:assert/strict")
const { jugador, npc, sesion, conAzar, conAzarAsync, TurnProcessor, cache, CATALOGO } = require("./_entorno")

const { evaluarCasteo, puedeActuar, enKit, ACCIONES } = require("../../functions/Duelo/hechizos/casteo")
const { aplicarEfecto, procesarFinDeTurno } = require("../../functions/Duelo/hechizos/efectos")
const { ESTADOS } = require("../../functions/Duelo/hechizos/estados")
const CombatUI = require("../../functions/Duelo/combateUI")

const H = (id) => CATALOGO.find(h => h._id === id)
const control = (estado, duracion = 2) => ({ tipo: "control", nombre: ESTADOS[estado].nombre, bloquea: [...ESTADOS[estado].bloquea], duracion, probabilidad: 1 })
const degradacion = (estado, duracion = 3) => ({ tipo: "degradacion", nombre: ESTADOS[estado].nombre, degrada: ESTADOS[estado].degrada, duracion })
const poner = (s, target, efecto, caster = target) => aplicarEfecto({ sesion: s, caster, target, efecto })

test.before(async () => { await cache.asegurar() })

test("1 · Parálisis sobre un Acorde (H + Mo) → bloqueado", () => {
    const pj = jugador({ elemento: "Aqua", hechizos: ["Aqua-002"] })
    poner(null, pj, control("paralisis"))
    const ev = evaluarCasteo(pj, H("Aqua-002"))
    assert.equal(ev.ok, false)
    assert.match(ev.motivo, /Parálisis/)
})

test("2 · Parálisis + Maestro en Nota con variante mental → permitido, ×1.5 maná, +1 tiempo", () => {
    const pj = jugador({ elemento: "Aqua", hechizos: ["Aqua-001"], maestrias: { "Aqua-001": 4 } })
    poner(null, pj, control("paralisis"))
    const ev = evaluarCasteo(pj, H("Aqua-001"))
    assert.equal(ev.ok, true)
    assert.equal(ev.modo, "mental")
    assert.deepEqual(ev.usadas, ["mental"])
    assert.equal(ev.costoMana, Math.ceil(5 * 1.5))
    assert.equal(ev.tiempo, 1 + 1)
    // Sin Maestría 4 no hay casteo mental
    const novato = jugador({ elemento: "Aqua", hechizos: ["Aqua-001"] })
    poner(null, novato, control("paralisis"))
    assert.equal(evaluarCasteo(novato, H("Aqua-001")).ok, false)
})

test("3 · Mutismo sobre una Nota de Movimiento → permitido", () => {
    const pj = jugador({ elemento: "Lapis", hechizos: ["Lapis-001"] })
    poner(null, pj, control("mutismo"))
    assert.equal(evaluarCasteo(pj, H("Lapis-001")).ok, true)
})

test("4 · Mutismo sobre un Cántico → bloqueado (y los Cánticos nunca van en modo mental)", () => {
    const pj = jugador({ elemento: "Lapis", hechizos: ["Lapis-003"], maestrias: { "Lapis-003": 4 } })
    poner(null, pj, control("mutismo"))
    const ev = evaluarCasteo(pj, H("Lapis-003"))
    assert.equal(ev.ok, false)
    assert.match(ev.motivo, /Mutismo/)
})

test("5 · Miedo sobre Nota / Acorde / Cántico → p efectiva ≈ 85% / 72% / 57%", () => {
    const pj = jugador({ elemento: "Kryo" })
    poner(null, pj, degradacion("miedo"))
    const p = (id) => evaluarCasteo(pj, H(id)).pCastX
    assert.ok(Math.abs(p("Kryo-001") - 0.85) < 0.005)
    assert.ok(Math.abs(p("Kryo-002") - 0.7225) < 0.005)
    assert.ok(Math.abs(p("Kryo-003") - 0.568) < 0.005)
})

test("5b · Confusión: desvío ≈ 20% / 36% / 54%", () => {
    const pj = jugador({ elemento: "Kryo" })
    poner(null, pj, degradacion("confusion"))
    const d = (id) => evaluarCasteo(pj, H(id)).pDesvio
    assert.ok(Math.abs(d("Kryo-001") - 0.20) < 0.005)
    assert.ok(Math.abs(d("Kryo-002") - 0.36) < 0.005)
    assert.ok(Math.abs(d("Kryo-003") - 0.539) < 0.005)
})

test("6 · Confusión sobre un hechizo de área → puede invertir el bando", () => {
    const a = jugador({ elemento: "Pyrós" }), aliado = jugador(), r1 = jugador(), r2 = jugador()
    const s = sesion([a, aliado], [r1, r2])
    const enemigos = TurnProcessor._objetivosArea(s, a, "enemigos")
    const pira = require("../../functions/Duelo/hechizos/adaptador").normalizarHechizo(H("Pyro-003"))
    const res = conAzar(0.0, () => TurnProcessor._aplicarDesvio(s, a, pira, 0.54, enemigos, []))
    assert.equal(res.invertido, true)
    assert.deepEqual(res.objetivosDamage.map(c => c.ID).sort(), [a.ID, aliado.ID].sort())
    s.limpiarWatchdog()
})

test("7 · Estasis: el turno pasa sin contar como turno saltado ni AFK", async () => {
    const a = jugador(), b = jugador()
    const s = sesion([a], [b])
    poner(s, a, { tipo: "estasis", duracion: 1 })
    const salto = TurnProcessor.motivoSaltoTurno(a)
    assert.ok(salto && salto.sistema, "la Estasis la salta el sistema")
    await TurnProcessor._turnoAutomatico(s, a)
    assert.equal(s.obtenerTurnosSaltados(a.ID), 0)
    assert.equal(s.esAFK(a.ID), false)
    assert.ok(!a.statusEffect.some(e => e.tipo === "estasis"), "la Estasis dura 1 turno")
    assert.ok(a.statusEffect.some(e => e.id === "anti_estasis" && e.duracion === 2), "anti-cadena de 2 turnos")
    assert.equal(poner(s, a, { tipo: "estasis", duracion: 1 }).aplicado, false)
    s.limpiarWatchdog()
})

test("8 · Estasis: las duraciones de los efectos activos se pausan", () => {
    const a = jugador()
    poner(null, a, { tipo: "dot", nombre: "Quemadura", base: 10, duracion: 3 })
    poner(null, a, { tipo: "estasis", duracion: 1 })
    const hp = a.HP
    procesarFinDeTurno(a, { danio: (pj, v) => pj.aplicarDaño(v) })
    const q = a.statusEffect.find(e => e.tipo === "dot")
    assert.equal(q.duracion, 3, "ni avanza ni expira")
    assert.equal(a.HP, hp, "sin ticks durante la Estasis")
    // Inmunidad total: ni daño, ni curas, ni efectos nuevos
    const b = jugador()
    poner(null, b, { tipo: "estasis", duracion: 1 })
    assert.equal(b.aplicarDaño(50), 0)
    assert.equal(poner(null, b, control("paralisis")).aplicado, false)
})

test("9 · Aturdimiento sobre un cast de 2 turnos (Electro-003) → se interrumpe, mitad de cooldown", async () => {
    const mago = npc({ nombre: "Aldric", humano: true }), rival = jugador()
    const s = sesion([mago], [rival], { type: "pve" })
    const r = await TurnProcessor.resolverHechizo(s, mago, "Electro-003", [rival.ID])
    assert.equal(r.success, true)
    assert.ok(mago.activeCast, "queda canalizando")
    assert.equal(mago.activeCast.remainingTurns, 1)
    assert.ok(s.log.some(l => /está canalizando Relámpago Tardío/.test(l.data.textoLog || "")), "telegrafía en el log")
    poner(s, mago, control("aturdimiento"), rival)
    assert.equal(mago.activeCast, undefined)
    assert.equal(mago.cooldowns["Electro-003"], Math.ceil(3 * 0.5))
    s.limpiarWatchdog()
})

test("10 · Segundo Aturdimiento inmediato tras interrumpir → sin efecto (inmunidad 1 turno)", async () => {
    const mago = npc({ humano: true }), rival = jugador()
    const s = sesion([mago], [rival], { type: "pve" })
    await TurnProcessor.resolverHechizo(s, mago, "Electro-003", [rival.ID])
    poner(s, mago, control("aturdimiento"), rival)
    const segundo = poner(s, mago, control("aturdimiento"), rival)
    assert.equal(segundo.aplicado, false)
    assert.equal(segundo.motivo, "inmune_control")
    s.limpiarWatchdog()
})

test("11 · Parálisis sobre un NPC `instinto` → interrumpe", async () => {
    const bestia = npc(), rival = jugador()
    const s = sesion([bestia], [rival], { type: "pve" })
    const rugido = { _id: "inline_rugido", Nombre: "Rugido", Elemento: "Neutro", isActive: true, Mecanicas: { damage: { base: 30, objetivo: "enemigos" }, cast: { tiempo: 2, probabilidad: 1, interruptible: true } }, Costos: {} }
    await TurnProcessor.resolverHechizo(s, bestia, rugido, [rival.ID])
    assert.deepEqual(bestia.activeCast.vias, ["instinto"])
    poner(s, bestia, control("paralisis"), rival)
    assert.equal(bestia.activeCast, undefined)
    s.limpiarWatchdog()
})

test("12 · Mutismo sobre un NPC `instinto` → sin efecto", async () => {
    const bestia = npc(), rival = jugador()
    const s = sesion([bestia], [rival], { type: "pve" })
    const rugido = { _id: "inline_rugido", Nombre: "Rugido", Elemento: "Neutro", isActive: true, Mecanicas: { damage: { base: 30, objetivo: "enemigos" }, cast: { tiempo: 2, probabilidad: 1, interruptible: true } }, Costos: {} }
    await TurnProcessor.resolverHechizo(s, bestia, rugido, [rival.ID])
    poner(s, bestia, control("mutismo"), rival)
    assert.ok(bestia.activeCast, "sigue canalizando")
    assert.equal(evaluarCasteo(bestia, rugido).ok, true)
    assert.equal(TurnProcessor.motivoSaltoTurno(bestia), null)
    s.limpiarWatchdog()
})

test("13 · Tregua en PvP → rechazada; en PvE → nadie baja de 1 HP", () => {
    const a = jugador(), b = jugador()
    const pvp = sesion([a], [b], { type: "pvp" })
    const tregua = { tipo: "inmunidad", contra: "muerte", nombre: "Tregua", duracion: 1 }
    assert.equal(poner(pvp, b, tregua, a).aplicado, false)
    const jefe = npc({ jefe: true }), c = jugador()
    const pve = sesion([c], [jefe], { type: "pve" })
    assert.equal(poner(pve, c, tregua, jefe).aplicado, true)
    c.aplicarDaño(99999)
    assert.equal(c.HP, 1)
    assert.equal(c.defeated, false)
    // Con apuestas tampoco
    const ap = sesion([jugador()], [npc()], { type: "pve", apuestas: { lumens: 100 } })
    assert.equal(poner(ap, ap.teams[0][0], tregua).aplicado, false)
    pvp.limpiarWatchdog(); pve.limpiarWatchdog(); ap.limpiarWatchdog()
})

test("14 · Desafinado con contenedor de Aqua → solo hechizos de Aqua + universales", () => {
    const pj = jugador({ elemento: "Pyrós", resonancia: 0, disonancia: 5, equipo: [{ Nombre: "Vasija", tipo: "contenedor", Elemento: "Aqua" }] })
    assert.equal(pj.elementoActivo, "Aqua")
    const lanzables = CATALOGO.filter(h => enKit(pj, h)).map(h => h._id)
    assert.ok(lanzables.every(id => id.startsWith("Aqua-") || id.startsWith("univ-")), lanzables.join(","))
    assert.ok(lanzables.includes("Aqua-001") && lanzables.includes("univ-002"))
    // Afinado: solo su elemento
    const afinado = jugador({ elemento: "Lapis" })
    assert.equal(enKit(afinado, H("Aqua-001")), false)
    assert.equal(evaluarCasteo(afinado, H("Aqua-001")).ok, false)
})

test("15 · Menú con un desafinado que conoce 30 hechizos → máximo 25 opciones y solo su kit", async () => {
    const todos = CATALOGO.map(h => h._id)
    const pj = jugador({ elemento: "Pyrós", resonancia: 0, disonancia: 5, hechizos: [...todos, "inexistente"], equipo: [{ tipo: "contenedor", Elemento: "Aqua" }] })
    assert.ok(pj.hechizos.length >= 30)
    const s = sesion([pj], [jugador()])
    for (let pagina = 1; pagina <= 3; pagina++) {
        const ui = await CombatUI.buildSpellList(s, pj, pagina)
        const select = ui[0].components.find(c => c.type === 1).components[0]
        assert.ok(select.options.length <= 25)
        for (const o of select.options) {
            const id = o.value.split("*")[1]
            assert.ok(id.startsWith("Aqua-") || id.startsWith("univ-"), id)
            assert.notEqual(id, "univ-001", "Guardia ya es el botón Defenderse")
        }
    }
    s.limpiarWatchdog()
})

// ─── Reglas complementarias ──────────────────────────────────────────────────

test("Golpe y objetos cuentan como movimiento: Parálisis / Inmovilizado dejan sin acción real", () => {
    const pj = jugador({ elemento: "Lapis", hechizos: ["Lapis-001"] })
    poner(null, pj, control("inmovilizado"))
    assert.equal(evaluarCasteo(pj, ACCIONES.GOLPE).ok, false)
    assert.equal(evaluarCasteo(pj, ACCIONES.OBJETO).ok, false)
    assert.equal(puedeActuar(pj, [H("Lapis-001")]).puede, false, "un Lapis inmovilizado no tiene acción")
    const aqua = jugador({ elemento: "Aqua" })
    poner(null, aqua, control("inmovilizado"))
    assert.equal(puedeActuar(aqua, [H("Aqua-001")]).puede, true, "pero puede hablar")
    const aturdido = jugador()
    poner(null, aturdido, control("aturdimiento"))
    assert.equal(puedeActuar(aturdido, []).puede, true, "el Aturdimiento no niega el Golpe")
})

test("Kryo-002: su propio daño no rompe el Congelado; el siguiente daño de otra fuente sí", async () => {
    const mago = npc({ humano: true }), rival = jugador()
    const s = sesion([mago], [rival], { type: "pve" })
    await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, mago, "Kryo-002", [rival.ID]))
    assert.ok(rival.statusEffect.some(e => e.nombre === "Congelado"), "queda congelado")
    rival.aplicarDaño(5, { castId: "otro" })
    assert.ok(!rival.statusEffect.some(e => e.nombre === "Congelado"), "el siguiente golpe lo rompe")
    s.limpiarWatchdog()
})

test("Anti stun-lock: al expirar un control queda 1 turno de inmunidad a controles", () => {
    const pj = jugador()
    poner(null, pj, control("aturdimiento", 1))
    procesarFinDeTurno(pj)
    assert.equal(poner(null, pj, control("aturdimiento", 2)).aplicado, false)
})

test("Provocar fuerza el objetivo del Golpe", async () => {
    const a = jugador(), t1 = jugador(), t2 = jugador()
    const s = sesion([a], [t1, t2])
    poner(s, t2, { tipo: "provocar", duracion: 2 })
    const r = await conAzarAsync(0.99, () => TurnProcessor.resolveAction(s, a.ID, { tipo: "attack", targetId: t1.ID }))
    assert.equal(r.resultados[0].target.ID, t2.ID)
    s.limpiarWatchdog()
})

test("Guardia (Defenderse) reduce a la mitad el daño hasta el siguiente turno", async () => {
    const a = jugador(), b = jugador()
    const s = sesion([a], [b])
    const sin = conAzar(0.99, () => TurnProcessor._aplicarDaño({ base: 100, esFisico: true }, a, b, { _id: "x", Elemento: "Neutro" }, s))
    b.HP = 200
    await TurnProcessor.resolveAction(s, b.ID, { tipo: "defend" })
    const con = conAzar(0.99, () => TurnProcessor._aplicarDaño({ base: 100, esFisico: true }, a, b, { _id: "x", Elemento: "Neutro" }, s))
    assert.ok(Math.abs(con.cantidad - sin.cantidad / 2) <= 1, `${con.cantidad} vs ${sin.cantidad}`)
    s.limpiarWatchdog()
})

test("Maestría: solo cuenta casteos resueltos, con tope por combate", async () => {
    const pj = jugador({ elemento: "Aqua", hechizos: ["Aqua-001"] })
    const s = sesion([pj], [jugador()])
    for (let i = 0; i < 8; i++) {
        pj.cooldowns = {}
        pj.Mana = 200
        await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, pj, "Aqua-001", [pj.ID]))
    }
    assert.equal(pj.maestriaSesion["Aqua-001"], 5)
    // Un casteo fallido no cuenta
    const otro = jugador({ elemento: "Aqua", hechizos: ["Aqua-001"] })
    const s2 = sesion([otro], [jugador()])
    const r = await conAzarAsync(0.99, () => TurnProcessor.resolverHechizo(s2, otro, "Aqua-001", [otro.ID]))
    assert.equal(r.spellFailed, true)
    assert.equal(otro.maestriaSesion?.["Aqua-001"] ?? 0, 0)
    s.limpiarWatchdog(); s2.limpiarWatchdog()
})

test("Revive (Lux-003) solo sobre aliados caídos y una vez por combate", async () => {
    const mago = npc({ humano: true }), caido = npc({ humano: true }), rival = jugador()
    const s = sesion([mago, caido], [rival], { type: "pve" })
    assert.equal((await TurnProcessor.resolverHechizo(s, mago, "Lux-003", null)).success, false, "sin caídos no se lanza")
    caido.aplicarDaño(9999)
    const r = await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, mago, "Lux-003", [caido.ID]))
    assert.equal(r.success, true)
    assert.equal(caido.defeated, false)
    assert.equal(caido.HP, Math.floor(300 * 0.4))
    s.limpiarWatchdog()
})
