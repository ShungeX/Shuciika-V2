// Casos de prueba mínimos de Contenedores y Durabilidad (XII.C) y reglas asociadas.
const test = require("node:test")
const assert = require("node:assert/strict")
const { jugador, npc, sesion, conAzar, conAzarAsync, TurnProcessor, cache, CATALOGO, escrituras, documentos } = require("../hechizos/_entorno")

const { evaluarCasteo, ACCIONES } = require("../../functions/Duelo/hechizos/casteo")
const { aplicarEfecto } = require("../../functions/Duelo/hechizos/efectos")
const { ESTADOS } = require("../../functions/Duelo/hechizos/estados")
const mana = require("../../functions/Duelo/hechizos/mana")
const CombatUI = require("../../functions/Duelo/combateUI")
const N = require("../../functions/Contenedores/nucleo")
const servicio = require("../../functions/Contenedores/servicio")
const { BANDERAS, TIPOS, REPARACION, ARTESANO } = require("../../functions/Contenedores/config")
const { duelSystem } = require("../../functions/Duelo/duelManager")

const H = (id) => CATALOGO.find(h => h._id === id)
const degradacion = (estado, duracion = 3) => ({ tipo: "degradacion", nombre: ESTADOS[estado].nombre, degrada: ESTADOS[estado].degrada, duracion })
const poner = (s, target, efecto) => aplicarEfecto({ sesion: s, caster: target, target, efecto })
const desafinado = (o = {}) => jugador({ elemento: "Aqua", desafinado: true, hechizos: ["Aqua-001", "Aqua-002", "Aqua-003", "Pyro-001"], ...o })
/** Deja el contenedor en una fracción de su durabilidad. */
const dañar = (pj, fraccion) => { pj.contenedor.durabilidad.actual = Math.round(pj.contenedor.durabilidad.max * fraccion); return pj }

/** Alma mínima de un desafinado para las operaciones fuera de combate. */
function alma({ id = 9000 + Math.floor(Math.random() * 900), tipo = "artesanal", durabilidad, carga, manaMax = 50, respaldo, extra = [] } = {}) {
    const equipo = [{ ID: 748, Region: "TOB-01", Type: 1 }, ...extra]
    if (tipo) {
        const c = N.crearInstancia(tipo, { manaMaxBase: manaMax })
        if (durabilidad !== undefined) c.durabilidad = durabilidad
        if (carga !== undefined) c.carga = carga
        equipo.push(c)
    }
    return {
        _id: id,
        nucleo: { HP: 100, Mana: 50, Elemento: "Aqua", elementoActivo: "Aqua", artefactoMagico: true, ...(respaldo ? { respaldo } : {}) },
        stats: { hpMax: 100, manaMax },
        dominio: { hechizos: [{ ID: "Aqua-001", InCombat: true }], equipo },
    }
}

test.before(async () => { await cache.asegurar() })
test.beforeEach(() => { escrituras.length = 0; BANDERAS.CONTENEDORES_ACTIVOS = true })

// ─── XII.C ───────────────────────────────────────────────────────────────────

test("1 · Desafinado lanza un hechizo de un elemento distinto al activo → elemento_incorrecto", () => {
    const pj = desafinado()
    const r = evaluarCasteo(pj, H("Pyro-001"))
    assert.equal(r.ok, false)
    assert.deepEqual(r.razon, ["elemento_incorrecto"])
    assert.equal(evaluarCasteo(pj, H("Aqua-001")).ok, true)
})

test("1b · Cambiar de elemento en combate → consume el turno, sin maná y sin tocar la carga", async () => {
    const pj = desafinado()
    const s = sesion([pj], [jugador()])
    const carga = pj.contenedor.esencia.carga
    const durabilidad = pj.contenedor.durabilidad.actual
    const r = await TurnProcessor.resolveAction(s, pj.ID, { tipo: "element", elemento: "Pyrós" })
    assert.equal(r.success, true)
    assert.equal(r.consumeTurno, true)
    assert.equal(pj.elementoActivo, "Pyrós")
    assert.equal(pj.contenedor.esencia.carga, carga)
    assert.equal(pj.contenedor.durabilidad.actual, durabilidad)
    assert.equal(evaluarCasteo(pj, H("Pyro-001")).ok, true)
    assert.equal(evaluarCasteo(pj, H("Aqua-001")).ok, false)
    // Al mismo elemento no se puede "cambiar"
    assert.equal((await TurnProcessor.resolveAction(s, pj.ID, { tipo: "element", elemento: "Pyrós" })).success, false)
    s.limpiarWatchdog()
})

test("1c · Cambiar de elemento fuera de combate → inmediato y gratis", async () => {
    const soul = alma()
    const r = await servicio.cambiarElemento(soul, "Kryo")
    assert.deepEqual(r, { ok: true, elemento: "Kryo" })
    assert.deepEqual(escrituras.at(-1).update, { $set: { "nucleo.elementoActivo": "Kryo" } })
    assert.equal((await servicio.cambiarElemento(soul, "Plasma")).motivo, "elemento_invalido")
    assert.equal((await servicio.cambiarElemento(alma({ durabilidad: 0 }), "Kryo")).motivo, "contenedor_roto")
})

test("1d · Cambiar de elemento bajo Estasis → rechazado", async () => {
    const pj = desafinado()
    const s = sesion([pj], [jugador()])
    poner(s, pj, { tipo: "estasis" })
    const r = await TurnProcessor.resolveAction(s, pj.ID, { tipo: "element", elemento: "Pyrós" })
    assert.equal(r.success, false)
    assert.equal(pj.elementoActivo, "Aqua")
    s.limpiarWatchdog()
})

test("1e · El cambio es silencioso: solo el mensaje de ambiente; nada del contenedor en vistas de terceros", async () => {
    const pj = desafinado({ nombre: "Noa" })
    const rival = jugador({ nombre: "Rival" })
    const s = sesion([pj], [rival])
    await TurnProcessor.resolveAction(s, pj.ID, { tipo: "element", elemento: "Electro" })
    const ultimo = s.log.at(-1).data.textoLog
    assert.equal(ultimo, "Noa te mira fijamente.")

    const publico = JSON.stringify([CombatUI.buildEspectador(s, rival), CombatUI.buildActorMessages(s, null, true, rival, [pj]), s.log])
    for (const secreto of ["Electro", "Elemento activo", "Contenedor", "Intacto", "▰"]) {
        assert.ok(!publico.includes(secreto), `se filtra "${secreto}"`)
    }
    // El portador sí ve su barra y su elemento
    const propio = JSON.stringify(CombatUI.buildActorMessages(s, null, true, pj, [rival]))
    assert.ok(propio.includes("Elemento activo: **Electro**") && propio.includes("▰") && propio.includes("Intacto"))
    assert.ok(propio.includes("-elemento-"), "botón Cambiar elemento")
    s.limpiarWatchdog()
})

test("2 · Desafinado no regenera maná en combate", () => {
    const pj = desafinado()
    const s = sesion([pj], [jugador()])
    mana.gastarMana(pj, 20)
    const antes = pj.Mana
    poner(s, pj, { tipo: "regen_mana", nombre: "Brisa", valor: 8, duracion: 3 })   // los bonus tampoco le aplican
    TurnProcessor.tickRegeneracion(s)
    assert.equal(pj.Mana, antes)
    s.limpiarWatchdog()
})

test("3 · Afinado completa un turno → +2 base más los bonus temporales (se suman)", () => {
    const pj = jugador()
    const s = sesion([pj], [jugador()])
    pj.Mana = 100
    TurnProcessor.tickRegeneracion(s)
    assert.equal(pj.Mana, 102)
    poner(s, pj, { tipo: "regen_mana", nombre: "Brisa", valor: 4, duracion: 3 })
    poner(s, pj, { tipo: "regen_mana", nombre: "Marea", valor: 8, duracion: 3 })
    TurnProcessor.tickRegeneracion(s)
    assert.equal(pj.Mana, 102 + 2 + 4 + 8)
    pj.Mana = 199
    TurnProcessor.tickRegeneracion(s)
    assert.equal(pj.Mana, 200, "nunca pasa del máximo")
    s.limpiarWatchdog()
})

test("4 · Latencia: Nota +0, Acorde +1, Cántico +1 de tiempo de cast", () => {
    const pj = desafinado(), afinado = jugador({ elemento: "Aqua" })
    assert.equal(evaluarCasteo(pj, H("Aqua-001")).tiempo, evaluarCasteo(afinado, H("Aqua-001")).tiempo)
    assert.equal(evaluarCasteo(pj, H("Aqua-002")).tiempo, evaluarCasteo(afinado, H("Aqua-002")).tiempo + 1)
    assert.equal(evaluarCasteo(pj, H("Aqua-003")).tiempo, evaluarCasteo(afinado, H("Aqua-003")).tiempo + 1)
})

test("5 · Contenedor Fisurado → −5 puntos de probabilidad", () => {
    const base = evaluarCasteo(desafinado(), H("Aqua-001")).pFinal
    const pj = dañar(desafinado(), 0.5)
    assert.equal(N.etapaContenedor(pj.contenedor), "Fisurado")
    const r = evaluarCasteo(pj, H("Aqua-001"))
    assert.ok(Math.abs(r.pFinal - (base - 0.05)) < 1e-9, `${r.pFinal} vs ${base}`)
    assert.equal(r.probSobrecarga, undefined, "ya no existe la sobrecarga")
})

test("6 · Contenedor Crítico → −15 puntos de probabilidad, sin sobrecarga", async () => {
    const base = evaluarCasteo(desafinado(), H("Aqua-001")).pFinal
    const pj = dañar(desafinado(), 0.25)   // 15 / 60
    assert.equal(N.etapaContenedor(pj.contenedor), "Crítico")
    const r = evaluarCasteo(pj, H("Aqua-001"))
    assert.ok(Math.abs(r.pFinal - (base - 0.15)) < 1e-9)
    assert.equal(r.probSobrecarga, undefined)
    // Lanzar en Crítico no desgasta (ni con sobrecarga ni sin ella)
    const s = sesion([pj], [npc()], { type: "pve" })
    for (const azar of [0.01, 0.05]) {
        pj.cooldowns = {}
        await conAzarAsync(azar, () => TurnProcessor.resolverHechizo(s, pj, "Aqua-001", [pj.ID]))
    }
    assert.equal(pj.contenedor.durabilidad.actual, 15)
    s.limpiarWatchdog()
})

test("7 · La durabilidad llega a 0 por daño → romperContenedor una vez, carga 0 y evento contenedor_roto", async () => {
    const pj = desafinado()
    const s = sesion([pj], [npc()], { type: "pve" })
    const eventos = []
    s.on("contenedor_roto", (d) => eventos.push(d))
    pj.contenedor.durabilidad.actual = 1
    assert.ok(pj.Mana > 0)
    pj.aplicarDaño(40, { sesion: s })            // 60 × 0.2 × 0.5 = 6 > 1
    assert.equal(pj.contenedor.durabilidad.actual, 0)
    assert.equal(pj.contenedor.esencia.carga, 0)
    assert.equal(pj.Mana, 0)
    pj.aplicarDaño(40, { sesion: s })            // ya roto: no se rompe dos veces
    assert.deepEqual(eventos, [{ pjId: pj.ID, contenedorId: pj.contenedor.instanciaID }])
    // Solo Golpe, Guardia e ítems
    assert.deepEqual(evaluarCasteo(pj, H("Aqua-001")).razon, ["contenedor_roto"])
    assert.equal(evaluarCasteo(pj, ACCIONES.GOLPE).ok, true)
    s.limpiarWatchdog()
})

test("8 · Contenedor Roto → solo Golpe, Guardia e ítems", async () => {
    const pj = dañar(desafinado(), 0)
    const s = sesion([pj], [jugador()])
    assert.equal(evaluarCasteo(pj, ACCIONES.GOLPE).ok, true)
    assert.equal(evaluarCasteo(pj, ACCIONES.GUARDIA).ok, true)
    assert.equal(evaluarCasteo(pj, ACCIONES.OBJETO).ok, true)
    for (const id of ["Aqua-001", "Aqua-002", "Aqua-003", "univ-003"]) {
        const r = evaluarCasteo(pj, H(id))
        assert.equal(r.ok, false, id)
        assert.deepEqual(r.razon, ["contenedor_roto"], id)
    }
    assert.equal((await TurnProcessor.resolveAction(s, pj.ID, { tipo: "element", elemento: "Pyrós" })).success, false)
    assert.equal((await TurnProcessor.resolveAction(s, pj.ID, { tipo: "defend" })).success, true)
    assert.equal(TurnProcessor.motivoSaltoTurno(pj), null, "sigue teniendo acciones")
    // Sin traductor el maná no entra: nada de recargar un cristal roto
    assert.equal(mana.ganarMana(pj, 50), 0)
    // Y sin ningún contenedor, igual
    assert.deepEqual(evaluarCasteo(desafinado({ contenedor: null }), H("Aqua-001")).razon, ["contenedor_roto"])
    s.limpiarWatchdog()
})

test("9 · Contenedor Roto → los hechizos aprendidos se conservan", async () => {
    const pj = desafinado()
    const conocidos = pj.hechizos.map(h => h.ID)
    const s = sesion([pj], [npc()], { type: "pve" })
    pj.contenedor.durabilidad.actual = 1
    pj.aplicarDaño(40, { sesion: s })
    assert.equal(N.etapaContenedor(pj.contenedor), "Roto")
    assert.deepEqual(pj.hechizos.map(h => h.ID), conocidos)
    await servicio.persistirSesion(s)
    assert.ok(escrituras.every(e => !JSON.stringify(e.update).includes("hechizos")), "el guardado no toca los hechizos")
    s.limpiarWatchdog()
})

test("10 · Kit de reparación sobre un Roto → rechazado", async () => {
    const soul = alma({ durabilidad: 0, carga: 0 })
    const r = await servicio.repararConKit({ _id: soul._id, economia: { Inventario: [{ ID: REPARACION.KIT.ID, Cantidad: 2 }] } }, soul)
    assert.deepEqual(r, { ok: false, motivo: "roto" })
    assert.equal(escrituras.length, 0)
})

test("11 · Kit de reparación en combate → rechazado", async () => {
    const soul = alma({ durabilidad: 20 })
    duelSystem.enCombate.add(soul._id)
    try {
        const r = await servicio.repararConKit({ _id: soul._id, economia: { Inventario: [{ ID: REPARACION.KIT.ID, Cantidad: 2 }] } }, soul)
        assert.deepEqual(r, { ok: false, motivo: "en_combate" })
        assert.equal((await servicio.pedirRespaldo(soul)).motivo, "en_combate")
        assert.equal((await servicio.cambiarElemento(soul, "Kryo")).motivo, "en_combate")
    } finally { duelSystem.enCombate.delete(soul._id) }
})

test("Kit de reparación fuera de combate → +25 sin pasar del máximo, y consume el kit", async () => {
    const soul = alma({ durabilidad: 20 })
    const character = { _id: soul._id, economia: { Inventario: [{ ID: REPARACION.KIT.ID, Region: "TOB-01", Nombre: "Kit de reparación", Cantidad: 2 }] } }
    documentos.Personajes.set(soul._id, character)
    const r = await servicio.repararConKit(character, soul)
    assert.equal(r.ok, true)
    assert.equal(r.puntos, 25)
    assert.deepEqual(r.durabilidad, { actual: 45, max: 60 })
    const reparacion = escrituras.find(e => e.coleccion === "Soul")
    assert.deepEqual(reparacion.update, { $inc: { "dominio.equipo.$[c].durabilidad": 25 } })
    assert.ok(escrituras.some(e => e.coleccion === "Personajes"), "consumió el kit")
    // Cerca del máximo solo repara lo que falta
    escrituras.length = 0
    assert.equal((await servicio.repararConKit(character, alma({ id: soul._id, durabilidad: 50 }))).puntos, 10)
    // Sin kit, intacto o de Cortesía: rechazado
    assert.equal((await servicio.repararConKit({ _id: 1, economia: { Inventario: [] } }, alma({ durabilidad: 20 }))).motivo, "sin_kit")
    assert.equal((await servicio.repararConKit(character, alma())).motivo, "intacto")
    assert.equal((await servicio.repararConKit(character, alma({ tipo: "cortesia", durabilidad: 10 }))).motivo, "no_reparable")
    documentos.Personajes.delete(soul._id)
})

test("12 · Duelo: el contenedor se rompe → al terminar vuelve al estado previo (contra NPCs es real)", async () => {
    // Duelo entre jugadores
    const pj = desafinado()
    const duelo = sesion([pj], [jugador()])
    const inicial = { ...pj.contenedor.inicial }
    pj.contenedor.durabilidad.actual = 1
    mana.gastarMana(pj, 30)
    pj.aplicarDaño(40, { sesion: duelo })
    assert.equal(N.etapaContenedor(pj.contenedor), "Roto")
    await servicio.persistirSesion(duelo)
    assert.equal(pj.contenedor.durabilidad.actual, inicial.durabilidad)
    assert.equal(pj.contenedor.esencia.carga, inicial.carga)
    assert.equal(escrituras.filter(e => JSON.stringify(e.update).includes("dominio.equipo")).length, 0, "el duelo no escribe desgaste")

    // Contra un NPC: desgaste (por daño) y gasto reales, guardados como incremento atómico
    const otro = desafinado()
    const pve = sesion([otro], [npc()], { type: "pve" })
    await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(pve, otro, "Aqua-001", [otro.ID]))
    otro.aplicarDaño(40, { sesion: pve })
    await servicio.persistirSesion(pve)
    const guardado = escrituras.find(e => e.update.$inc)
    assert.deepEqual(guardado.update.$inc, { "dominio.equipo.$[c].durabilidad": -6, "dominio.equipo.$[c].carga": -5 })
    assert.deepEqual(guardado.opciones.arrayFilters, [{ "c.instanciaID": otro.contenedor.instanciaID, "c.durabilidad": { $gt: 0 } }])
    duelo.limpiarWatchdog(); pve.limpiarWatchdog()
})

test("13 · Respaldo con contenedor funcional → no se entrega otro", async () => {
    assert.deepEqual(await servicio.pedirRespaldo(alma()), { ok: false, motivo: "ya_funciona" })
    assert.deepEqual(await servicio.pedirRespaldo(alma({ tipo: "cortesia" })), { ok: false, motivo: "ya_funciona" })
    assert.equal(escrituras.length, 0)
})

test("14 · Respaldo tras romperse → se entrega; la segunda petición del mismo día se rechaza", async () => {
    const ahora = Date.UTC(2026, 10, 9, 18)
    const soul = alma({ tipo: "cortesia", durabilidad: 0, carga: 0 })
    const r = await servicio.pedirRespaldo(soul, { ahora })
    assert.equal(r.ok, true)
    const { $set } = escrituras.at(-1).update
    const contenedores = $set["dominio.equipo"].filter(N.esContenedor)
    assert.equal(contenedores.length, 1, "el respaldo roto se reemplaza")
    assert.equal(contenedores[0].durabilidad, TIPOS.cortesia.durabilidad)
    assert.equal(contenedores[0].carga, Math.floor(50 * TIPOS.cortesia.capacidadFactor), "llega con la carga llena")
    assert.ok($set["dominio.equipo"].some(e => e.ID === 748), "conserva el resto del equipo")
    assert.deepEqual($set["nucleo.respaldo"], { dia: "2026-11-09", n: 1 })

    const otraVez = alma({ tipo: "cortesia", durabilidad: 0, carga: 0, respaldo: $set["nucleo.respaldo"] })
    assert.deepEqual(await servicio.pedirRespaldo(otraVez, { ahora: ahora + 3600_000 }), { ok: false, motivo: "limite_diario" })
    assert.equal((await servicio.pedirRespaldo(otraVez, { ahora: ahora + 24 * 3600_000 })).ok, true, "al día siguiente sí")

    // Con el artesanal roto, este se guarda (no se pierde el diseño) y el respaldo queda equipado
    const conArtesanal = alma({ durabilidad: 0, carga: 0 })
    await servicio.pedirRespaldo(conArtesanal, { ahora })
    const equipo = escrituras.at(-1).update.$set["dominio.equipo"]
    assert.equal(N.tipoDeEntrada(N.entradaEquipada(equipo)), "cortesia")
    assert.ok(equipo.some(e => N.tipoDeEntrada(e) === "artesanal" && e.equipado === false))
})

test("15 · Dos golpes simultáneos → ambos se aplican, sin pisarse", async () => {
    const pj = desafinado()
    const s = sesion([pj], [npc()], { type: "pve" })
    const antes = pj.contenedor.durabilidad.actual
    await Promise.all([
        Promise.resolve().then(() => pj.aplicarDaño(40, { sesion: s })),
        Promise.resolve().then(() => pj.aplicarDaño(20, { sesion: s })),
    ])
    assert.ok(Math.abs(pj.contenedor.durabilidad.actual - (antes - 6 - 3)) < 1e-9)
    // En la base de datos: un solo $inc relativo, con el filtro durabilidad > 0
    await servicio.persistirSesion(s)
    const inc = escrituras.find(e => e.update.$inc)
    assert.ok(Math.abs(inc.update.$inc["dominio.equipo.$[c].durabilidad"] + 9) < 1e-9)
    assert.deepEqual(inc.opciones.arrayFilters[0]["c.durabilidad"], { $gt: 0 })
    s.limpiarWatchdog()
})

test("16 · Migración de un desafinado existente → recibe Respaldo, conserva equipo y hechizos", () => {
    const soul = alma({ tipo: null, manaMax: 50 })
    soul.nucleo.Mana = 50
    delete soul.nucleo.elementoActivo
    const plan = servicio.planMigracion(soul)
    assert.deepEqual(Object.keys(plan.set).sort(), ["dominio.equipo", "nucleo.elementoActivo"], "solo toca el equipo y el elemento activo")
    assert.equal(plan.set["nucleo.elementoActivo"], "Aqua")
    const equipo = plan.set["dominio.equipo"]
    assert.deepEqual(equipo[0], { ID: 748, Region: "TOB-01", Type: 1 })
    assert.equal(N.tipoDeEntrada(equipo[1]), "cortesia")
    assert.equal(equipo[1].carga, 30, "el maná se muda a la carga, limitado a la capacidad nueva (50 × 0.6)")
    soul.nucleo.Mana = 12
    assert.equal(servicio.planMigracion(soul).entrada.carga, 12)
    // Idempotente, y no toca almas afinadas
    assert.equal(servicio.planMigracion({ ...soul, dominio: { equipo } }), null)
    assert.equal(servicio.planMigracion({ nucleo: { artefactoMagico: false }, dominio: { equipo: [] } }), null)
})

// ─── Reglas complementarias ──────────────────────────────────────────────────

test("Maná: vive en el contenedor y su tope es curva × factor (sube con el nivel)", () => {
    assert.equal(desafinado().stats.manaMax, Math.floor(200 * 1.3))
    assert.equal(desafinado({ contenedor: "cortesia" }).stats.manaMax, Math.floor(200 * 0.6))
    assert.equal(desafinado({ contenedor: "cortesia", stats: { manaMax: 400 } }).stats.manaMax, 240)
    const pj = desafinado({ contenedor: "cortesia" })
    assert.equal(pj.Mana, 120)
    assert.equal(mana.gastarMana(pj, 20), true)
    assert.equal(pj.contenedor.esencia.carga, 100)
    assert.equal(mana.gastarMana(pj, 999), false)
    assert.equal(mana.ganarMana(pj, 999), 20, "las fuentes externas sí recargan, hasta la capacidad")
    const { entrada, ...resumen } = N.manaDeAlma(alma({ tipo: "cortesia", carga: 12 }))
    assert.deepEqual(resumen, { desafinado: true, actual: 12, max: 30 })
    assert.equal(N.tipoDeEntrada(entrada), "cortesia")
})

test("Desgaste por daño recibido: proporcional a la vida perdida; lanzar, fallar o ser interrumpido no desgasta", async () => {
    // Ejemplo del documento: durabilidad 60, vida 200
    const pj = desafinado()
    const s = sesion([pj], [npc()], { type: "pve" })
    pj.aplicarDaño(40, { sesion: s })
    assert.ok(Math.abs(pj.contenedor.durabilidad.actual - 54) < 1e-9, "40 de daño → 6")
    assert.ok(Math.abs(N.calcularDesgastePorDano(pj.contenedor, 200, 200) - 30) < 1e-9, "100% de la vida → 30")
    const cortesia = desafinado({ contenedor: "cortesia" })
    assert.ok(Math.abs(N.calcularDesgastePorDano(cortesia.contenedor, 200, 200) - 12.5) < 1e-9, "Cortesía → 12.5")
    assert.ok(Math.abs(N.calcularDesgastePorDano(pj.contenedor, 40, 200, "disonancia") - 9) < 1e-9, "disonancia ×1.5")

    // Varios hechizos sin recibir daño: no cambia
    const limpio = desafinado()
    const s2 = sesion([limpio], [npc()], { type: "pve" })
    const antes = limpio.contenedor.durabilidad.actual
    for (const id of ["Aqua-001", "Aqua-002"]) {
        limpio.cooldowns = {}
        await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s2, limpio, id, [limpio.ID]))
    }
    // Casteo fallido
    limpio.cooldowns = {}
    const fallo = await conAzarAsync(0.99, () => TurnProcessor.resolverHechizo(s2, limpio, "Aqua-001", [limpio.ID]))
    assert.equal(fallo.spellFailed, true)
    assert.equal(limpio.contenedor.durabilidad.actual, antes)

    // Curar no repara
    pj.aplicarCuracion(40)
    assert.ok(Math.abs(pj.contenedor.durabilidad.actual - 54) < 1e-9)
    // Un afinado no tiene contenedor ni desgaste
    const afinado = jugador()
    assert.equal(afinado.contenedor, null)
    assert.equal(afinado.aplicarDaño(40), 40)
    assert.equal(N.desgastarPorDano(afinado, 40).aplica, false)
    s.limpiarWatchdog(); s2.limpiarWatchdog()
})

test("Desgaste por daño: escudo, Estasis, Tregua y DoT", () => {
    // Escudo: lo absorbido no cuenta
    const a = desafinado()
    a.statusEffect.push({ id: "escudo_x", tipo: "escudo", puntos: 30, duracion: 2 })
    a.aplicarDaño(40)
    assert.ok(Math.abs(a.contenedor.durabilidad.actual - (60 - 60 * (10 / 200) * 0.5)) < 1e-9, "solo los 10 que pasaron")
    const b = desafinado()
    b.statusEffect.push({ id: "escudo_y", tipo: "escudo", puntos: 50, duracion: 2 })
    b.aplicarDaño(40)
    assert.equal(b.contenedor.durabilidad.actual, 60, "todo absorbido → nada")

    // Estasis: no hay daño ni desgaste
    const c = desafinado()
    c.statusEffect.push({ id: "estasis", tipo: "estasis", inmune: true, pausa: true, duracion: 1 })
    assert.equal(c.aplicarDaño(100), 0)
    assert.equal(c.contenedor.durabilidad.actual, 60)

    // Tregua: solo el daño efectivo tras el piso de 1 HP
    const d = desafinado()
    d.HP = 21
    d.statusEffect.push({ id: "inmunidad_muerte", tipo: "inmunidad", contra: "muerte", duracion: 1 })
    assert.equal(d.aplicarDaño(150), 20)
    assert.ok(Math.abs(d.contenedor.durabilidad.actual - (60 - 60 * (20 / 200) * 0.5)) < 1e-9)

    // DoT: cada tic desgasta
    const e = desafinado()
    const s = sesion([e], [npc()], { type: "pve" })
    e.statusEffect.push({ id: "dot_quemadura", tipo: "dot", Nombre: "Quemadura", base: 10, duracion: 2 })
    TurnProcessor._procesarFinDeAccion(s, e)
    TurnProcessor._procesarFinDeAccion(s, e)
    assert.ok(Math.abs(e.contenedor.durabilidad.actual - (60 - 2 * 60 * (10 / 200) * 0.5)) < 1e-9)
    s.limpiarWatchdog()
})

test("Sensibilidad: con Miedo, Confusión o Lentitud el cast en curso se corta con 25% por turno", async () => {
    const lanzar = async (azarTick, estado) => {
        const pj = desafinado()
        const s = sesion([pj], [jugador()])
        await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, pj, "Aqua-002", [pj.ID]))   // Acorde: 1 + 1 de latencia
        assert.ok(pj.activeCast, "queda canalizando por la latencia")
        if (estado) poner(s, pj, degradacion(estado))
        const durabilidad = pj.contenedor.durabilidad.actual
        conAzar(azarTick, () => TurnProcessor._processActiveCastTick(s, pj))
        s.limpiarWatchdog()
        return { cortado: s.log.some(l => String(l.data.textoLog).includes("pierde la canalización")), desgaste: durabilidad - pj.contenedor.durabilidad.actual }
    }
    assert.deepEqual(await lanzar(0.10, "confusion"), { cortado: true, desgaste: 0 })   // interrumpido: ya no desgasta (solo el daño recibido)
    assert.equal((await lanzar(0.30, "confusion")).cortado, false)
    assert.equal((await lanzar(0.10, null)).cortado, false, "sin estado no hay sensibilidad")
})

test("Menor fatiga física: los costos en Vida valen la mitad para el desafinado", () => {
    const afinado = jugador({ elemento: "Pyrós" })
    const pj = desafinado({ elemento: "Pyrós" })
    assert.equal(evaluarCasteo(afinado, H("Pyro-002")).costoVida, 12)
    assert.equal(evaluarCasteo(pj, H("Pyro-002")).costoVida, 6)
})

test("Taller: costo según daño y frecuencia; un Roto paga el reemplazo del cristal", () => {
    const ahora = Date.now()
    const c = (durabilidad, reparaciones = []) => ({ ...N.crearInstancia("artesanal"), durabilidad, reparaciones })
    assert.equal(N.costoTaller(c(60), ahora), 50)
    assert.equal(N.costoTaller(c(30), ahora), 100)                    // 50 × (1 + 2 × 0.5)
    assert.equal(N.costoTaller(c(30, [ahora - 1000, ahora - 2000]), ahora), 150)   // × (1 + 0.25 × 2)
    assert.equal(N.costoTaller(c(30, [ahora - 8 * 24 * 3600_000]), ahora), 100, "fuera de la ventana de 7 días no cuenta")
    assert.equal(N.costoTaller(c(0), ahora), 225)                     // 50 × 3 × 1.5
})

test("Taller y artesano: cobran por el libro de Lumens y dejan el contenedor listo", async () => {
    const lumens = require("../../functions/Economia/lumens")
    const original = lumens.moverLumens
    const cobros = []
    lumens.moverLumens = async (m) => { cobros.push(m); return m.delta < -5000 ? { ok: false, motivo: "saldo_insuficiente" } : { ok: true, saldo: 0 } }
    try {
        // Taller: un artesanal roto con respaldo puesto
        const soul = alma({ durabilidad: 0, carga: 0 })
        soul.dominio.equipo.at(-1).equipado = false
        soul.dominio.equipo.push(N.crearInstancia("cortesia", { manaMaxBase: 50 }))
        const r = await servicio.repararEnTaller({ _id: soul._id }, soul, { userId: "u1" })
        assert.equal(r.ok, true)
        assert.equal(r.costo, 225)
        assert.deepEqual([cobros[0].delta, cobros[0].motivo], [-225, "contenedor"])
        const [reparacion, devolucion] = escrituras.filter(e => e.coleccion === "Soul")
        assert.equal(reparacion.update.$set["dominio.equipo.$[c].durabilidad"], 60)
        assert.equal(reparacion.update.$set["dominio.equipo.$[c].carga"], 65, "vuelve con la carga llena (50 × 1.3)")
        assert.equal(reparacion.update.$set["dominio.equipo.$[c].equipado"], true)
        assert.deepEqual(devolucion.update, { $pull: { "dominio.equipo": { tipoContenedor: "cortesia" } } })
        assert.equal((await servicio.repararEnTaller({ _id: 1 }, alma(), {})).motivo, "intacto")
        assert.equal((await servicio.repararEnTaller({ _id: 1 }, alma({ tipo: "cortesia", durabilidad: 5 }), {})).motivo, "no_reparable")

        // Artesano
        escrituras.length = 0; cobros.length = 0
        const nuevo = alma({ tipo: "cortesia" })
        const a = await servicio.encargarArtesanal({ _id: nuevo._id }, nuevo, { forma: "Anillo", nombre: "Lágrima de Noa", descripcion: "Un aro de plata", userId: "u1" })
        assert.equal(a.ok, true)
        assert.equal(cobros[0].delta, -ARTESANO.PRECIO)
        const equipo = escrituras.at(-1).update.$set["dominio.equipo"]
        const forjado = N.entradaEquipada(equipo)
        assert.equal(N.tipoDeEntrada(forjado), "artesanal")
        assert.deepEqual([forjado.forma, forjado.diseno.nombre, forjado.durabilidad, forjado.carga], ["anillo", "Lágrima de Noa", 60, 65])
        assert.ok(!equipo.some(e => N.tipoDeEntrada(e) === "cortesia"), "el respaldo vuelve al Instituto")
        assert.equal((await servicio.encargarArtesanal({ _id: 1 }, alma(), { forma: "anillo", nombre: "Otro" })).motivo, "ya_tiene_artesanal")
        assert.equal((await servicio.encargarArtesanal({ _id: 1 }, alma({ tipo: "cortesia" }), { forma: "anillo", nombre: "  " })).motivo, "nombre_vacio")
    } finally { lumens.moverLumens = original }
})

test("Diseño: texto libre saneado (longitud, markdown, menciones, enlaces)", () => {
    const d = N.sanitizarDiseno({
        forma: "  Collar  ",
        nombre: "@everyone **Lágrima** <@&123456> `x`\n# hola https://malo.example/x",
        descripcion: "a".repeat(500),
    })
    assert.equal(d.ok, true)
    assert.equal(d.forma, "collar")
    assert.ok(!/@|<|https?:|\n/.test(d.diseno.nombre.replace(/\\</g, "")), d.diseno.nombre)
    assert.ok(!/(^|[^\\])[*`#]/.test(d.diseno.nombre), d.diseno.nombre)
    assert.ok(d.diseno.nombre.replace(/\\/g, "").length <= ARTESANO.NOMBRE_MAX)
    assert.equal(d.diseno.descripcion.length, ARTESANO.DESCRIPCION_MAX)
    assert.equal(N.sanitizarDiseno({ forma: "", nombre: "x" }).motivo, "forma_vacia")
})

test("Etapas y barra: Intacto > 60%, Fisurado 31–60%, Crítico 1–30%, Roto 0", () => {
    const e = (actual) => N.etapaDe({ actual, max: 60 })
    assert.deepEqual([e(60), e(37), e(36), e(19), e(18), e(1), e(0)], ["Intacto", "Intacto", "Fisurado", "Fisurado", "Crítico", "Crítico", "Roto"])
    assert.ok(N.barraDurabilidad({ actual: 1, max: 60 }).startsWith("▰▱"), "con 1 punto aún se ve un segmento")
    assert.ok(N.barraDurabilidad({ actual: 0, max: 60 }).startsWith("▱▱"))
})

test("Bandera apagada → el desafinado se comporta como un jugador normal", () => {
    BANDERAS.CONTENEDORES_ACTIVOS = false
    const pj = jugador({ elemento: "Aqua", desafinado: true, contenedor: null, hechizos: ["Aqua-001"] })
    assert.equal(pj.Mana, 200)
    assert.equal(pj.stats.manaMax, 200)
    assert.equal(pj.elementoActivo, "Aqua")
    const r = evaluarCasteo(pj, H("Aqua-002"))
    assert.equal(r.ok, true)
    assert.equal(r.tiempo, 1, "sin latencia")
    const s = sesion([pj], [jugador()])
    pj.Mana = 100
    TurnProcessor.tickRegeneracion(s)
    assert.equal(pj.Mana, 102)
    assert.equal(servicio.estadoContenedor(alma()), null)
    assert.equal(CombatUI.lineaContenedor(pj), "")
    s.limpiarWatchdog()
})
