// El Anfitrión: jefe oculto detrás de Sosias (Anfitrion_Jefe_Sosias.md).
const test = require("node:test")
const assert = require("node:assert/strict")
const { jugador, npc, sesion, conAzarAsync, TurnProcessor, cache, escrituras, documentos } = require("./_entorno")

const NpcAi = require("../../functions/Duelo/npcAi")
const A = require("../../functions/Duelo/habilidadesNPC/anfitrion")
const P = require("../../functions/Duelo/habilidadesNPC/anfitrion/perfil")
const R = require("../../functions/Duelo/habilidadesNPC/robos")
const { ANFITRION } = require("../../functions/Duelo/habilidadesNPC/anfitrion/config")
const encuentros = require("../../functions/Duelo/habilidadesNPC/anfitrion/encuentros")
const CombatUI = require("../../functions/Duelo/combateUI")

test.before(async () => { await cache.asegurar() })
test.beforeEach(() => { escrituras.length = 0 })

function montar(nJugadores = 1) {
    const pjs = Array.from({ length: nJugadores }, (_, i) => jugador({ nombre: `Alumno${i + 1}`, elemento: "Aqua", hechizos: ["univ-001", "Aqua-001", "Aqua-002"], stats: { fuerza: 10 } }))
    pjs.forEach((p, i) => { p.ownerId = `u${i + 1}` })
    const jefe = npc({ nombre: "Sosias" })
    jefe.habilidadUnica = "anfitrion"
    const s = sesion(pjs, [jefe], { type: "pve" })
    return { pjs, pj: pjs[0], jefe, s }
}
const textos = (s) => s.log.map(l => String(l.data?.textoLog ?? ""))
/** Diálogos de la sesión (van aparte, en embed efímero; nunca al log). */
const dialogos = (s) => (s.dialogos || []).map(d => String(d.texto))
/** Simula que el jugador golpeó n turnos seguidos (perfil monótono). */
const golpes = (pj, n) => { for (let i = 0; i < n; i++) TurnProcessor._registrarAccion(pj, { tipo: "attack", categoria: "golpe", clave: "attack" }) }

test("Perfil: predicción ponderada de los últimos 5 turnos (XI)", () => {
    assert.deepEqual(P.predecir([{ golpe: 1 }, { golpe: 1 }, { golpe: 1 }]), { prediccion: "golpe", confianza: 1 })
    const variado = P.predecir([{ golpe: 1 }, { guardia: 1 }, { hechizo_cura: 1 }, { objeto: 1 }, { hechizo_dano: 1 }])
    assert.equal(variado.prediccion, "hechizo_dano")
    assert.ok(variado.confianza < ANFITRION.UMBRAL_CONFIANZA, "con variedad, duda")
    assert.equal(A.bloquesDe(1), 0); assert.equal(A.bloquesDe(3), 1); assert.equal(A.bloquesDe(6), 2)
})

test("Fase I: no ataca, solo «Te observa» y sus variantes; al 1% no muere y se rompe el espejo", async () => {
    const { pj, jefe, s } = montar()
    const hpAntes = pj.HP
    for (let i = 0; i < 4; i++) await NpcAi.executeTurn(s, jefe)
    assert.equal(pj.HP, hpAntes, "el disfraz no ataca")
    const { OBSERVA } = require("../../functions/Duelo/habilidadesNPC/anfitrion/voz")
    assert.equal(textos(s).filter(t => OBSERVA.includes(t)).length, 4, "una acción de observar por turno, en el log")
    assert.equal((s.dialogos || []).length, 0, "sin narradora ni voz antes de la Ruptura")
    assert.equal(jefe.anfitrion.fase, 1, "en el turno 3 no se clona como un Sosias normal")

    golpes(pj, 5)
    jefe.aplicarDaño(10_000, { sesion: s })
    assert.equal(jefe.defeated, false, "no muere")
    assert.equal(jefe.anfitrion.fase, 2)
    assert.equal(jefe.Nombre, "El Anfitrión")
    assert.equal(jefe.HP, 200 * ANFITRION.ESCALADO, "vida = vida MÁXIMA del jugador × 2.5")
    assert.equal(jefe.stats.fuerza, 10, "toma los stats del jugador")
    assert.ok(pj.statusEffect.some(e => String(e.Nombre).includes("Miedo") && e.duracion === 3))
    assert.equal(s.sinRendicion, true)
    const r = await TurnProcessor.resolveAction(s, pj.ID, { tipo: "surrender" })
    assert.equal(r.success, false, "tras la Ruptura no se puede rendir")
    const fila = CombatUI.createActionButtons(s, pj)[1].components
    assert.equal(fila.find(b => b.label === "Rendirse").disabled, true)
    s.limpiarWatchdog()
})

test("Fase I: la vida del jefe no depende de la vida actual del jugador", () => {
    const { pj, jefe, s } = montar()
    pj.HP = 5
    jefe.aplicarDaño(10_000, { sesion: s })
    assert.equal(jefe.HP, 500)
    s.limpiarWatchdog()
})

test("Fase II: con alta confianza contraataca lo previsto; con variedad, duda", async () => {
    const { pj, jefe, s } = montar()
    golpes(pj, 5)
    A.ruptura(s, jefe)
    await conAzarAsync(0.1, () => NpcAi.executeTurn(s, jefe))
    assert.ok(jefe.statusEffect.some(e => e.tipo === "guardia"), "previó un golpe: a veces se cubre")
    assert.equal(jefe.anfitrion.expectativa?.categoria, "golpe", "apunta lo que espera de ti")

    const otro = montar()
    for (const categoria of ["golpe", "guardia", "hechizo_cura", "objeto", "hechizo_dano"]) TurnProcessor._registrarAccion(otro.pj, { categoria, clave: categoria === "golpe" ? "attack" : undefined })
    A.ruptura(otro.s, otro.jefe)
    const hp = otro.pj.HP
    await conAzarAsync(0.5, () => NpcAi.executeTurn(otro.s, otro.jefe))
    assert.ok(otro.pj.HP < hp, "duda pero ataca, a menos del máximo")
    assert.ok(!dialogos(otro.s).some(t => /«(Tú\.\.\. no|Espera|No\.\.\. te leo)/.test(t)), "la duda no se suelta al primer turno")
    assert.ok(!textos(otro.s).some(t => t.startsWith("«")), "las voces no van al log")
    s.limpiarWatchdog(); otro.s.limpiarWatchdog()
})

test("Fase II: inversión de pilar cada 3 turnos (elemento que contrarresta al tuyo)", () => {
    const e = A.elementoContra("Aqua")
    assert.ok(["Electro", "Rakau"].includes(e), e)
    assert.equal(A.elementoContra("Lux"), null)
})

test("Fase III: seis reflejos (1 real y 5 señuelos), el real sorteado; los señuelos se recomponen", async () => {
    const { pj, jefe, s } = montar()
    golpes(pj, 5)
    A.ruptura(s, jefe)
    jefe.aplicarDaño(Math.ceil(jefe.HP * 0.4), { sesion: s })
    assert.equal(jefe.anfitrion.fase, 3)
    const reflejos = s.teams[1]
    assert.equal(reflejos.length, 6)
    assert.equal(reflejos.filter(r => r.esSenuelo).length, 5)
    assert.deepEqual(reflejos.map(r => r.Nombre).sort(), [...ANFITRION.REFLEJOS].sort(), "ninguno es «El Anfitrión» a secas")
    // Un señuelo cae y se recompone tras 2 turnos del real
    const senuelo = reflejos.find(r => r.esSenuelo)
    senuelo.aplicarDaño(99_999, { sesion: s })
    assert.equal(senuelo.defeated, true)
    for (let i = 0; i < 3; i++) await conAzarAsync(0.5, () => NpcAi.executeTurn(s, jefe))
    assert.equal(senuelo.defeated, false, "se recompone")
    // Turno de un señuelo: eco de tu última acción (golpe), sin hablar
    const hp = pj.HP, dAntes = (s.dialogos || []).length
    await conAzarAsync(0.5, () => NpcAi.executeTurn(s, senuelo))
    assert.ok(pj.HP < hp, "el eco golpea")
    assert.equal((s.dialogos || []).length, dAntes, "los señuelos no hablan")
    // Los señuelos hacen eco de tu acción anterior y su daño es ~25%
    assert.ok(Math.abs(senuelo.multiplicadorDanio - jefe.multiplicadorDanio * ANFITRION.DANIO_SENUELO) < 1e-9)
    s.limpiarWatchdog()
})

test("Fase III: roba lo que más usas; desaparece de tu interfaz; lo usa y te lo devuelve", async () => {
    const { pj, jefe, s } = montar()
    golpes(pj, 5)
    A.ruptura(s, jefe)
    jefe.aplicarDaño(Math.ceil(jefe.HP * 0.4), { sesion: s })
    A.intentarRobo(s, jefe)
    assert.equal(R.estaRobado(pj, "attack"), true, "roba Atacar (lo más usado en 5 turnos)")
    const fila = CombatUI.createActionButtons(s, pj)[1].components
    assert.ok(!fila.some(b => b.label === "Atacar"), "el botón desaparece")
    assert.equal((await TurnProcessor.resolveAction(s, pj.ID, { tipo: "attack", targetId: jefe.ID })).success, false)
    assert.equal(await A.usarRobado(s, jefe), true)
    assert.equal(R.estaRobado(pj, "attack"), false, "una vez usado, se devuelve")
    // Tope de robos simultáneos
    TurnProcessor._registrarAccion(pj, { categoria: "hechizo_cura", clave: "spell:Aqua-001" })
    TurnProcessor._registrarAccion(pj, { categoria: "guardia", clave: "defend" })
    for (let i = 0; i < 5; i++) A.intentarRobo(s, jefe)
    assert.ok(jefe.anfitrion.robos.length <= ANFITRION.MAX_ROBOS)
    s.limpiarWatchdog()
})

test("Fase IV: los reflejos se recogen; usa hechizos que no son tuyos y cambia de pilar", async () => {
    const { pj, jefe, s } = montar()
    golpes(pj, 6)
    A.ruptura(s, jefe)
    jefe.aplicarDaño(Math.ceil(jefe.HP * 0.4), { sesion: s })
    jefe.aplicarDaño(Math.ceil(jefe.HP * 0.5), { sesion: s })
    assert.equal(jefe.anfitrion.fase, 4)
    assert.ok(s.teams[1].filter(r => r.esSenuelo).every(r => r.defeated), "los señuelos se retiran")

    const usados = []
    const original = TurnProcessor.resolverHechizo.bind(TurnProcessor)
    const originalAccion = TurnProcessor.resolveAction.bind(TurnProcessor)
    TurnProcessor.resolverHechizo = async (ses, c, id, t) => { if (c === jefe) usados.push(String(id)); return original(ses, c, id, t) }
    TurnProcessor.resolveAction = async (ses, id, acc) => { if (id === jefe.ID) usados.push(acc.tipo); return originalAccion(ses, id, acc) }
    const mios = (pj.hechizos || []).map(h => String(h.ID ?? h.id ?? h))
    try {
        // Por debajo de PROB_AJENO: saca un hechizo de la base que el jugador no tiene
        await conAzarAsync(0.1, () => A.accionEvitada(s, jefe))
        const prestado = usados.at(-1)
        assert.ok(prestado && !mios.includes(prestado), `usa lo que nunca fuiste: ${prestado}`)
        const hechizo = require("../../functions/Duelo/hechizos/cache").obtenerSync(prestado)
        assert.ok(hechizo, "es un hechizo de la base")
        assert.equal(jefe.elemento, hechizo.Elemento, "cambia de pilar para lanzarlo")
        assert.ok(textos(s).some(t => /cambia de pilar: ahora es/.test(t)), textos(s).join(" | "))

        // Por encima: vuelve a lo tuyo, y nunca a tus objetos
        usados.length = 0
        await conAzarAsync(0.9, () => A.accionEvitada(s, jefe))
        assert.ok(usados.length && usados.every(u => ["attack", "defend", ...mios].includes(u)), `lo tuyo que menos usas: ${usados}`)
    } finally {
        TurnProcessor.resolverHechizo = original
        TurnProcessor.resolveAction = originalAccion
    }
    assert.ok(!usados.some(u => String(u).startsWith("item:")), "ya no tira objetos porque sí")
    s.limpiarWatchdog()
})

test("Final: se desvanece sin ruido, los señuelos caen y todo lo robado vuelve", () => {
    const { pj, jefe, s } = montar()
    golpes(pj, 5)
    A.ruptura(s, jefe)
    jefe.aplicarDaño(Math.ceil(jefe.HP * 0.4), { sesion: s })
    A.intentarRobo(s, jefe)
    jefe.aplicarDaño(999_999, { sesion: s })
    assert.equal(jefe.defeated, true)
    assert.ok(s.teams[1].every(r => r.defeated))
    assert.equal(R.estaRobado(pj, "attack"), false)
    assert.ok(dialogos(s).some(t => t.includes("medio segundo de retraso")))
    assert.ok(s.dialogos.find(d => d.texto.includes("medio segundo")).cambio, "con pausa de suspenso")
    assert.equal(s.combateTerminado(), true)
    s.limpiarWatchdog()
})

test("Grupo: vida = suma × 2.0, +30% de daño por cada 2 adicionales, una acción por turno; nunca habla", async () => {
    const { pjs, jefe, s } = montar(3)
    pjs.forEach(p => golpes(p, 5))
    A.ruptura(s, jefe)
    assert.equal(jefe.HP, 600 * ANFITRION.ESCALADO_GRUPO)
    assert.equal(jefe.anfitrion.bloques, 1)
    assert.ok(Math.abs(jefe.multiplicadorDanio - (pjs[0].multiplicadorDanio * 1.3)) < 1e-9)
    const antes = (s.dialogos || []).length
    const hpAntes = pjs.map(p => p.HP)
    await conAzarAsync(0.1, () => NpcAi.executeTurn(s, jefe))
    assert.ok(!(s.dialogos || []).slice(antes).some(d => String(d.texto).startsWith("«")), "en grupo no habla")
    // Una sola acción en su turno: previó un golpe y se cubrió (ni ataques extra ni dos acciones)
    assert.ok(jefe.statusEffect.some(e => e.tipo === "guardia"))
    assert.deepEqual(pjs.map(p => p.HP), hpAntes, "no hubo una segunda acción en el mismo turno")
    s.limpiarWatchdog()
})

test("Encuentro: Sosias suma al contador; huir antes de la Ruptura lo reduce a la mitad", async () => {
    const pj = jugador({ nombre: "A" }); pj.ownerId = "u9"
    const sosias = npc({ nombre: "Sosias" }); sosias.habilidadUnica = "sosias"
    const s1 = sesion([pj], [sosias], { type: "pve" })
    await encuentros.cerrarEncuentro(s1)
    assert.ok(escrituras.some(e => e.coleccion === "usuarios_server" && e.update.$inc?.["salonEspejos.peleasSosias"] === 1))

    escrituras.length = 0
    const { pj: p2, s: s2 } = montar()
    p2.surrender = true
    await encuentros.cerrarEncuentro(s2)
    const w = escrituras.find(e => e.coleccion === "usuarios_server" && e.update.$set)
    assert.ok("salonEspejos.peleasSosias" in w.update.$set)
    assert.equal(w.update.$inc?.["salonEspejos.huidas"], 1, "cuenta la huida (para la voz)")
    s1.limpiarWatchdog(); s2.limpiarWatchdog()
})

test("Activación: un NPC que no es Sosias no se toca", async () => {
    const doc = { _id: "NPC-001", Nombre: "Otro" }
    assert.equal(await encuentros.prepararEnemigo(doc, [{ ownerId: "u1", characterId: 1 }]), doc)
    assert.equal(encuentros.polvoHeraldo("III") * ANFITRION.POLVO_X_HERALDO, 470 * 3)
})

test("Objetos: la Invitación pide confirmación; el Espejo de Mano muestra tu perfil", async () => {
    const catalogo = require("../../functions/catalogoObjetos")
    const original = catalogo.getObjetoPorId
    const defs = { 1029: { ID: 1029, Region: "TOB-01", Nombre: "Invitación", Tipo: ["Consumible", "Lore"] }, 1030: { ID: 1030, Region: "TOB-01", Nombre: "Espejo de Mano", Tipo: ["Herramienta"] } }
    catalogo.getObjetoPorId = (r, id) => defs[Number(id)] ?? original(r, id)
    try {
        const { usarObjeto, tipoDeUso } = require("../../functions/Objetos/usarObjeto")
        assert.equal(tipoDeUso({ ID: 1029, Region: "TOB-01" }), "invitacion")
        assert.equal(tipoDeUso({ ID: 1030, Region: "TOB-01" }), "espejo")
        const character = { _id: 5, economia: { Inventario: [{ ID: 1029, Region: "TOB-01", Cantidad: 1 }, { ID: 1030, Region: "TOB-01", Cantidad: 1 }] } }
        const inv = await usarObjeto({ interaction: { user: { id: "u1" } }, character, soul: {}, clave: "TOB-01|1029|", cantidadTexto: "1" })
        const ids = JSON.stringify(inv.componentesV2)
        assert.ok(ids.includes("salonEspejos-u1--aceptar") && ids.includes("¿Seguro?"))
        const soul = { salonEspejos: { perfil: { usos: { golpe: 8, guardia: 2 } } } }
        const esp = await usarObjeto({ interaction: { user: { id: "u1" } }, character, soul, clave: "TOB-01|1030|", cantidadTexto: "1" })
        assert.ok(esp.lineas.some(l => l.includes("80%") && l.includes("golpear")))
        assert.ok(esp.lineas.some(l => l.includes("Lo que evitas") && l.includes("curarte")))
    } finally { catalogo.getObjetoPorId = original }
})

test("Compás: en grupo gana 1 casilla por cada 2 adicionales (actúa más veces en la misma ronda)", () => {
    const niveles = P.nivelesCompas(0.57)
    assert.deepEqual(niveles.slice(0, 4), [1000, 570, 324, 184])
    assert.equal(P.casillas(300, niveles), 3)
    assert.equal(P.valorConExtra(300, 1, niveles), 184, "baja hasta caber en el siguiente escalón")
    assert.equal(P.valorConExtra(100, 0, niveles), 100)

    const { pjs, jefe, s } = montar(3)
    pjs.forEach(p => golpes(p, 5))
    A.ruptura(s, jefe)
    const valor = (c) => Math.floor(1000 / c.effectiveTempo)
    assert.equal(P.casillas(valor(jefe), niveles), P.casillas(valor(pjs[0]), niveles) + 1, "una casilla más que el jugador copiado")
    // Solo, sin casillas extra: misma cinta que el jugador
    const solo = montar(1)
    golpes(solo.pj, 5)
    A.ruptura(solo.s, solo.jefe)
    assert.equal(P.casillas(valor(solo.jefe), niveles), P.casillas(valor(solo.pj), niveles))
    s.limpiarWatchdog(); solo.s.limpiarWatchdog()
})

test("Entropía: cada acción del jugador queda en sesion.historialAcciones", async () => {
    const { pj, jefe, s } = montar()
    await conAzarAsync(0.5, () => TurnProcessor.resolveAction(s, pj.ID, { tipo: "attack", targetId: jefe.ID }))
    await TurnProcessor.resolveAction(s, pj.ID, { tipo: "defend" })
    pj.cooldowns = {}
    await conAzarAsync(0.01, () => TurnProcessor.resolverHechizo(s, pj, "Aqua-001", [pj.ID]))
    assert.deepEqual(s.historialAcciones, [
        { ID: pj.ID, accion: "attack" }, { ID: pj.ID, accion: "defend" }, { ID: pj.ID, accion: "spell:Aqua-001" },
    ])
    const calc = require("../../functions/Economia/calculadorPVEstelar")
    assert.ok(calc._calcularEntropia(s.historialAcciones.map(a => a.accion)) > 0.9, "tres acciones distintas: entropía alta")
    assert.ok(!s.historialAcciones.some(a => a.ID === jefe.ID), "los NPC no cuentan")
    s.limpiarWatchdog()
})

test("Prueba de administrador: no cuenta peleas ni da recompensas", async () => {
    const { pj, jefe, s } = montar()
    jefe.anfitrionDatos = { huidas: {}, prueba: true }
    golpes(pj, 5)
    A.ruptura(s, jefe)
    jefe.aplicarDaño(9_999_999, { sesion: s })
    const extras = await encuentros.cerrarEncuentro(s)
    assert.equal(extras.size, 0)
    assert.ok(!escrituras.some(e => e.coleccion === "usuarios_server"))
    assert.equal(ANFITRION.PRUEBA.ID.startsWith("NPC-"), true)
    assert.deepEqual(ANFITRION.PRUEBA.ADMINS, ["665421882694041630"])
    s.limpiarWatchdog()
})

test("Diálogos: van en cola, con pausa, en embed efímero sobre la interacción del MD de combate", async () => {
    const D = require("../../functions/Duelo/dialogoCombate")
    const { pj, s } = montar()
    pj.ownerId = "u-dialogos"   // dueño propio: otras pruebas dejan diálogos en cola para "u1"
    s.mensajes.jugadores.set(pj.ownerId, { channelId: "dm1", messageId: "m1" })
    const enviados = []
    const interaccion = { user: { id: pj.ownerId }, channelId: "dm1", deferred: true, followUp: async (m) => { enviados.push(m) } }
    D.registrarInteraccion(interaccion)
    const t0 = Date.now()
    D.decir(s, { autor: "El Anfitrión", texto: "«Uno»" })
    await D.decir(s, { autor: "El Anfitrión", texto: "«Dos»" })
    assert.deepEqual(enviados.map(m => m.embeds[0].data.description), ["«Uno»", "«Dos»"], "en orden")
    assert.ok(enviados.every(m => m.flags.includes("Ephemeral")), "efímeros")
    assert.ok(Date.now() - t0 >= 2 * D.DIALOGO.PAUSA_MS - 50, "con pausa antes de cada uno")
    // Una interacción de otro canal no se usa para el efímero
    const otra = { user: { id: pj.ownerId }, channelId: "tienda", deferred: true, followUp: async (m) => { enviados.push(["otro", m]) } }
    D.registrarInteraccion(otra)
    const antes = enviados.length
    await D.decir(s, { texto: "x" })
    assert.equal(enviados.length, antes, "no manda efímeros a otro canal")
    s.limpiarWatchdog()
})

test("Interfaz: las actualizaciones se serializan y la última usa el estado más reciente", async () => {
    const { pj, s } = montar()
    const vistas = []
    const original = CombatUI._actualizarAhora
    CombatUI._actualizarAhora = async (ses) => { vistas.push(ses.marca); await new Promise(r => setTimeout(r, 20)) }
    try {
        s.marca = "vieja"
        const a = CombatUI.update(s, null)
        s.marca = "intermedia"; CombatUI.update(s, null)
        s.marca = "nueva"; CombatUI.update(s, null)
        await a
        await s._uiEnCurso
        assert.deepEqual(vistas, ["vieja", "nueva"], "las llamadas cruzadas se agrupan; la última pinta el estado actual")
        // La pantalla final no la pisa nadie
        s._uiFinal = true
        await CombatUI.update(s, null)
        assert.equal(vistas.length, 2)
    } finally { CombatUI._actualizarAhora = original }
    s.limpiarWatchdog()
})

test("Fase III: todos los reflejos muestran la misma vida; los señuelos reciben daño exagerado", () => {
    const { pj, jefe, s } = montar()
    golpes(pj, 5)
    A.ruptura(s, jefe)
    jefe.aplicarDaño(Math.ceil(jefe.HP * 0.4), { sesion: s })
    const senuelos = s.teams[1].filter(r => r.esSenuelo)
    assert.ok(senuelos.every(r => r.HP === jefe.HP && r.stats.hpMax === jefe.stats.hpMax), "misma vida y máximo que el real")
    const antes = senuelos[0].HP
    const golpe = senuelos[0].aplicarDaño(10, { sesion: s })
    assert.equal(golpe, Math.min(antes, 10 * ANFITRION.DANIO_RECIBIDO_SENUELO))
    const real = jefe.HP
    assert.equal(jefe.aplicarDaño(10, { sesion: s }), 10, "el real recibe el daño normal")
    assert.equal(jefe.HP, real - 10)
    s.limpiarWatchdog()
})

test("Voz: nunca repite una frase ya dicha en el combate; la foto va como thumbnail", async () => {
    const V = require("../../functions/Duelo/habilidadesNPC/anfitrion/voz")
    const dichos = new Set()
    const pj = { usosCategoria: { golpe: 5 }, perfilTurnos: [{ golpe: 1 }, { golpe: 1 }] }
    const primera = V.frase("repite", pj, { dichos })
    assert.ok(primera)
    dichos.add(primera)
    assert.equal(V.frase("repite", pj, { dichos }), null, "su única frase de 'repite' ya se dijo")

    const { jefe, s } = montar()
    A.ruptura(s, jefe)
    const antes = (s.dialogos || []).length
    const pjCopiado = s.getCombatiente(jefe.anfitrion.copiadoId)
    for (let i = 0; i < 6; i++) await conAzarAsync(0.1, () => require("../../functions/Duelo/habilidadesNPC/anfitrion").contraatacar(s, jefe))
    const nuevos = (s.dialogos || []).slice(antes).map(d => d.texto)
    assert.equal(new Set(nuevos).size, nuevos.length, `sin repetidos: ${nuevos}`)
    assert.ok(pjCopiado)

    const D = require("../../functions/Duelo/dialogoCombate")
    const enviados = []
    const sesion2 = montar().s
    const p2 = sesion2.teams[0][0]; p2.ownerId = "u-thumb"
    sesion2.mensajes.jugadores.set("u-thumb", { channelId: "dmT" })
    D.registrarInteraccion({ user: { id: "u-thumb" }, channelId: "dmT", deferred: true, followUp: async (m) => enviados.push(m) })
    await D.decir(sesion2, { autor: "El Anfitrión", avatarURL: "https://ejemplo/a.png", texto: "«x»" })
    const e = enviados[0].embeds[0].data
    assert.equal(e.thumbnail?.url, "https://ejemplo/a.png")
    assert.equal(e.author?.icon_url, undefined, "no como icono de autor")
    s.limpiarWatchdog(); sesion2.limpiarWatchdog()
})

test("Combate en pausa: un NPC no actúa mientras hay diálogos en curso", async () => {
    const { pj, s } = montar()
    let liberar
    s._colaDialogos = new Promise(r => { liberar = r })
    const bestia = s.teams[1][0]
    bestia.habilidadUnica = null
    const original = setTimeout
    let actuo = false
    const NpcAiMod = require("../../functions/Duelo/npcAi")
    const exec = NpcAiMod.executeTurn
    NpcAiMod.executeTurn = async () => { actuo = true }
    global.setTimeout = (fn, ms, ...a) => original(fn, ms > 1000 ? 1 : ms, ...a)   // sin la espera de "pensando"
    try {
        const turno = TurnProcessor._turnoAutomatico(s, bestia)
        await new Promise(r => original(r, 30))
        assert.equal(actuo, false, "espera a que terminen los diálogos")
        liberar()
        await turno
        assert.equal(actuo, true)
    } finally {
        global.setTimeout = original
        NpcAiMod.executeTurn = exec
    }
    assert.ok(pj)
    s.limpiarWatchdog()
})

test("IA: no repite su acción anterior (si acaba de cubrirse, golpea)", async () => {
    const { pj, jefe, s } = montar()
    golpes(pj, 5)
    A.ruptura(s, jefe)
    jefe.anfitrion.ultimaAccion = "defend"
    const hp = pj.HP
    await conAzarAsync(0.1, () => A.contraatacar(s, jefe))   // 0.1 < PROB_DEFENDER: se cubriría si pudiera
    assert.ok(!jefe.statusEffect.some(e => e.tipo === "guardia"), "no se cubre dos veces seguidas")
    assert.ok(pj.HP < hp, "en su lugar, golpea")
    assert.equal(jefe.anfitrion.ultimaAccion, "attack")
    s.limpiarWatchdog()
})

test("Bloqueo: si tu acción era la esperada la para en seco y entonces lo dice", async () => {
    const { pj, jefe, s } = montar()
    golpes(pj, 5)
    A.ruptura(s, jefe)
    await conAzarAsync(0.9, () => A.contraatacar(s, jefe))   // apunta tu golpe sin cubrirse
    assert.equal(jefe.anfitrion.expectativa?.categoria, "golpe")

    const hpJefe = jefe.HP
    await TurnProcessor.resolveAction(s, pj.ID, { tipo: "attack", targetId: jefe.ID })
    assert.equal(jefe.HP, hpJefe, "el golpe esperado no le hace nada")
    assert.ok(textos(s).some(t => /ha bloqueado el ataque/.test(t)), textos(s).join(" | "))
    assert.ok(dialogos(s).some(t => /Otra vez golpear/.test(t)), "la frase sale después del bloqueo")
    assert.equal(jefe.anfitrion.fallos, 0)
    assert.equal(jefe._bloqueaProximo, undefined, "el bloqueo se gasta")
    s.limpiarWatchdog()
})

test("Duda: tras 3 acciones inesperadas seguidas habla; una que acierte reinicia la cuenta", async () => {
    const { pj, jefe, s } = montar()
    A.ruptura(s, jefe)
    const esperar = (cat) => { jefe.anfitrion.expectativa = { categoria: cat, pjId: pj.ID } }
    esperar("golpe"); A.alActuarJugador(s, pj, "guardia")
    esperar("golpe"); A.alActuarJugador(s, pj, "hechizo_cura")
    assert.equal(jefe.anfitrion.fallos, 2)
    assert.ok(!dialogos(s).some(t => /Espera|te leo|Eso no/.test(t)), "aún no habla")

    esperar("golpe"); A.alActuarJugador(s, pj, "golpe")
    assert.equal(jefe.anfitrion.fallos, 0, "acertó: la cuenta vuelve a cero")

    for (const cat of ["guardia", "objeto", "hechizo_cura"]) { esperar("golpe"); A.alActuarJugador(s, pj, cat) }
    assert.ok(dialogos(s).some(t => /Espera|te leo|Eso no/.test(t)), dialogos(s).join(" | "))
    assert.equal(jefe.anfitrion.fallos, 0, "tras hablar, vuelve a contar desde cero")
    s.limpiarWatchdog()
})

test("AFK: quedarse sin responder no cuenta como acción inesperada", async () => {
    const { pj, jefe, s } = montar()
    A.ruptura(s, jefe)
    jefe.anfitrion.expectativa = { categoria: "golpe", pjId: pj.ID }
    await s.procesarTimeoutTurno(pj, null)
    assert.equal(jefe.anfitrion.fallos, 0, "el turno perdido no cuenta como acción inesperada")
    assert.equal((pj.perfilTurnos || []).length, 0, "no se le apunta ninguna acción")
    s.limpiarWatchdog()
})

test("Aprendizaje: sigue leyéndote durante el combate (cambia de predicción si cambias)", () => {
    const pj = {}
    golpes(pj, 5)
    assert.equal(P.predecir(pj.perfilTurnos).prediccion, "golpe")
    for (let i = 0; i < 5; i++) TurnProcessor._registrarAccion(pj, { categoria: "guardia", clave: "defend" })
    const r = P.predecir(pj.perfilTurnos)
    assert.equal(r.prediccion, "guardia", "la ventana es rodante: aprende lo nuevo")
    assert.ok(r.confianza >= ANFITRION.UMBRAL_CONFIANZA)
})

test("NPC de la base de datos: el jefe sale con las estadísticas del Sosias original", async () => {
    documentos.NPCs.set(ANFITRION.NPC_BASE, {
        _id: ANFITRION.NPC_BASE, Nombre: "Sosias", habilidadUnica: "sosias", avatarURL: "https://ejemplo/sosias.png",
        HP: 777, Mana: 55, Elemento: "Umbra", tipo: "humano", stats: { hpMax: 777, fuerza: 42 }, ataques: [{ id: "a1" }],
    })
    try {
        const jefe = { _id: ANFITRION.PRUEBA.ID, Nombre: "El Anfitrión", habilidadUnica: "anfitrion", HP: 1, stats: { hpMax: 1 }, anfitrionDatos: { prueba: true } }
        const listo = await encuentros.prepararEnemigo(jefe, [{ ownerId: "u1", characterId: 1 }])
        assert.equal(listo._id, ANFITRION.PRUEBA.ID, "sigue siendo el jefe")
        assert.equal(listo.habilidadUnica, "anfitrion")
        assert.equal(listo.Nombre, "Sosias", "en la Fase I es un Sosias cualquiera")
        assert.equal(listo.HP, 777)
        assert.equal(listo.stats.fuerza, 42)
        assert.equal(listo.avatarURL, "https://ejemplo/sosias.png")
        assert.deepEqual(listo.ataques, [{ id: "a1" }])
        assert.equal(listo.anfitrionDatos.prueba, true, "la prueba de admin se conserva")
        assert.deepEqual(listo.anfitrionDatos.huidas, { 1: 0 })
    } finally { documentos.NPCs.clear() }
})

test("NPC de la base de datos: \"anfitrion\" es una habilidad guardable (el dashboard no la borra)", () => {
    const { HABILIDADES } = require("../../functions/Duelo/habilidadesNPC")
    assert.ok(HABILIDADES.includes("anfitrion"))
    assert.ok(!HABILIDADES.includes("anfitrion_eco"), "los señuelos no se asignan a mano")
})

test("IA: si vives lanzando hechizos, el jefe lanza hechizos (copia hábitos, no solo el puño)", async () => {
    const { pj, jefe, s } = montar()
    for (let i = 0; i < 5; i++) TurnProcessor._registrarAccion(pj, { tipo: "spell", id: "Aqua-001", categoria: "hechizo_dano", clave: "spell:Aqua-001" })
    A.ruptura(s, jefe)
    assert.ok((jefe.hechizos || []).some(h => String(h.ID ?? h.id ?? h) === "Aqua-001"), "copió tu kit")

    const lanzados = []
    const original = TurnProcessor.resolverHechizo
    TurnProcessor.resolverHechizo = async (sesion, caster, id, t) => { lanzados.push(id); return { success: true } }
    try {
        await conAzarAsync(0.9, () => A.contraatacar(s, jefe))
    } finally { TurnProcessor.resolverHechizo = original }
    assert.deepEqual(lanzados, ["Aqua-001"], "usa tu hechizo más repetido, no el golpe básico")
    assert.equal(jefe.anfitrion.ultimaAccion, "spell:Aqua-001")
    s.limpiarWatchdog()
})

test("Combo: mientras no te adivine, tus golpes y hechizos le entran al doble", async () => {
    const { pj, jefe, s } = montar()
    A.ruptura(s, jefe)
    const esperar = (cat) => { jefe.anfitrion.expectativa = { categoria: cat, pjId: pj.ID } }

    esperar("golpe"); A.alActuarJugador(s, pj, "guardia")
    assert.equal(A.bonusCombo(jefe, pj), 1, "una sola acción todavía no es combo")
    esperar("golpe"); A.alActuarJugador(s, pj, "hechizo_cura")
    assert.equal(A.bonusCombo(jefe, pj), ANFITRION.MULT_COMBO, "dos seguidas: el doble")

    // El bonus entra en el daño real, tanto en el golpe como en un hechizo
    const hp = jefe.HP
    await conAzarAsync(0.99, () => TurnProcessor.resolveAction(s, pj.ID, { tipo: "attack", targetId: jefe.ID }))   // sin esquivas ni críticos
    const conCombo = hp - jefe.HP
    assert.ok(textos(s).some(t => /no lo vio venir/.test(t)), textos(s).join(" | "))

    esperar("golpe"); A.alActuarJugador(s, pj, "golpe")
    assert.equal(A.bonusCombo(jefe, pj), 1, "te leyó: se corta el combo")
    delete jefe._bloqueaProximo
    const hp2 = jefe.HP
    await conAzarAsync(0.99, () => TurnProcessor.resolveAction(s, pj.ID, { tipo: "attack", targetId: jefe.ID }))
    const sinCombo = hp2 - jefe.HP
    assert.ok(conCombo > sinCombo, `con combo ${conCombo} > sin combo ${sinCombo}`)
    s.limpiarWatchdog()
})

test("Mochila: el selector de objetos lleva la sesión y el handler lee lo elegido", async () => {
    const { pj, s } = montar()
    const UseItem = require("../../interaction/selectMenus/Rol/UseItem")
    assert.equal(UseItem.customId, "UseItem")
    assert.deepEqual(UseItem.optionNames, ["seleccion"])

    // El customId sigue la convención del router: UseItem-<ownerId>-<characterId>-<sessionId>
    const { splitCustomId } = require("../../utils/constructores/customId")
    const partes = splitCustomId(`UseItem-${pj.ownerId}-${pj.ID}-${s.sessionId}`)
    assert.deepEqual(partes, ["UseItem", String(pj.ownerId), String(pj.ID), String(s.sessionId)])

    // Antes leía el valor de componentData (un objeto) y se quedaba callado: "Navi no ha respondido"
    const respuestas = []
    const interaction = { user: { id: pj.ownerId }, replied: false, deferred: false, reply: async (m) => respuestas.push(m), followUp: async (m) => respuestas.push(m) }
    await UseItem.ejecutar({
        client: null, interaction, character: null,
        componentData: { userId: pj.ownerId, characterId: pj.ID, extras: ["sesion-que-no-existe"] },
        options: { seleccion: "duelo*1029*TOB-01" },
    })
    assert.equal(respuestas.length, 1, "siempre responde la interacción")
    assert.match(String(respuestas[0].content), /duelo ya no es válido/)
    s.limpiarWatchdog()
})

test("Fase III: el selector de objetivos lleva la sesión (se podía elegir, pero no atacar)", async () => {
    const { pj, jefe, s } = montar()
    golpes(pj, 5)
    A.ruptura(s, jefe)
    A.fase3(s, jefe)
    const rivales = s.teams[1].filter(c => !c.defeated)
    assert.equal(rivales.length, 6, "el real y sus cinco reflejos")

    const { splitCustomId } = require("../../utils/constructores/customId")
    const componente = CombatUI.buildTarget(s, pj, rivales, "attack", null)
    const selector = componente[0].components.flatMap(c => c.components || []).find(c => c.type === 3)
    const [accion, userId, characterId, sesionId] = splitCustomId(selector.custom_id)
    assert.equal(accion, "UseSpell")
    assert.equal(userId, String(pj.ownerId))
    assert.equal(characterId, String(pj.ID), "sin el personaje, la sesión caía aquí")
    assert.equal(sesionId, String(s.sessionId), "el handler la lee de extras[0]")
    assert.equal(selector.options.length, 6)
    s.limpiarWatchdog()
})

test("Fase III: un reflejo apenas se cura (el original sí)", async () => {
    const { pj, jefe, s } = montar()
    golpes(pj, 5)
    A.ruptura(s, jefe)
    A.fase3(s, jefe)
    const senuelo = s.getCombatiente(jefe.anfitrion.senuelos[0])
    const tope = Math.max(1, Math.round(jefe.stats.hpMax * ANFITRION.CURA_SENUELO_PCT))

    senuelo.HP = 100
    senuelo.aplicarCuracion(500, true)
    assert.equal(senuelo.HP, 100 + tope, `el reflejo no se cura más de ${tope}`)

    jefe.HP = 100
    jefe.aplicarCuracion(300, true)
    assert.equal(jefe.HP, Math.min(jefe.stats.hpMax, 400), "el original se cura normal")
    s.limpiarWatchdog()
})

test("Fase III: los reflejos no repiten en bucle la misma acción ni se curan sanos", async () => {
    const { pj, jefe, s } = montar()
    for (let i = 0; i < 3; i++) TurnProcessor._registrarAccion(pj, { tipo: "spell", id: "Electro-002", categoria: "hechizo_dano", clave: "spell:Electro-002" })
    TurnProcessor._registrarAccion(pj, { tipo: "attack", categoria: "golpe", clave: "attack" })
    A.ruptura(s, jefe)
    A.fase3(s, jefe)
    const senuelos = jefe.anfitrion.senuelos.map(id => s.getCombatiente(id))

    const original = TurnProcessor.resolverHechizo
    const usadas = []
    TurnProcessor.resolverHechizo = async () => ({ success: true })
    try {
        for (let i = 0; i < 12; i++) {
            const eco = senuelos[i % senuelos.length]
            await A.turnoSenuelo(s, eco)
            usadas.push(jefe.anfitrion.ultimoEco)
        }
    } finally { TurnProcessor.resolverHechizo = original }

    assert.ok(new Set(usadas).size > 1, `varía lo que repiten: ${usadas.join(", ")}`)
    assert.ok(usadas.every((k, i) => i === 0 || k !== usadas[i - 1]), "nunca dos seguidas iguales")

    // La curación en bucle: con los reflejos enteros, nadie se cura (era lo que los volvía eternos)
    for (let i = 0; i < 4; i++) TurnProcessor._registrarAccion(pj, { tipo: "spell", id: "Aqua-001", categoria: "hechizo_cura", clave: "spell:Aqua-001" })
    const conCura = []
    TurnProcessor.resolverHechizo = async () => ({ success: true })
    try {
        for (let i = 0; i < 8; i++) {
            const eco = senuelos[i % senuelos.length]
            eco.HP = eco.stats.hpMax
            await A.turnoSenuelo(s, eco)
            conCura.push(jefe.anfitrion.ultimoEco)
        }
    } finally { TurnProcessor.resolverHechizo = original }
    assert.ok(!conCura.includes("spell:Aqua-001"), `un reflejo entero no se cura: ${conCura.join(", ")}`)
    s.limpiarWatchdog()
})

test("Grupo: no se enfocan siempre en el mismo jugador y se dice a quién vuelve lo robado", async () => {
    const { pjs, jefe, s } = montar(3)
    pjs.forEach(p => golpes(p, 5))
    A.ruptura(s, jefe)
    const copiado = String(jefe.anfitrion.copiadoId)
    const elegidos = new Set()
    for (let i = 0; i < 40; i++) elegidos.add(String(A.objetivo(s, jefe)?.ID))
    assert.ok(elegidos.size > 1, `reparte objetivos: ${[...elegidos]}`)
    assert.ok(elegidos.has(copiado), "pero insiste en el que copia")

    A.fase3(s, jefe)
    A.intentarRobo(s, jefe)
    const victima = s.getCombatiente(jefe.anfitrion.robos[0].pjId)
    await A.usarRobado(s, jefe)
    assert.ok(textos(s).some(t => /vuelve a /.test(t) && t.includes(victima.Nombre)), textos(s).filter(t => /vuelve/.test(t)).join(" | "))
    s.limpiarWatchdog()
})

test("Botones: mientras el turno de un jugador siga abierto, la interfaz lo sigue a él", async () => {
    const { pj, jefe, s } = montar()
    s.activeTurnActorId = pj.ID
    s.turnoQueue = [jefe]                     // la cola ya apunta a otro (un reflejo recompuesto, el jefe...)
    assert.equal(s.getCurrentActor()?.ID, jefe.ID)
    assert.equal(s.actorEnTurno()?.ID, pj.ID, "la interfaz y los botones siguen siendo suyos")

    s.resolverTurnoExitoso(pj.ID)             // ya actuó: el turno se cierra
    assert.equal(s.actorEnTurno()?.ID, jefe.ID)

    s.activeTurnActorId = pj.ID
    pj.defeated = true
    assert.equal(s.actorEnTurno()?.ID, jefe.ID, "si cae, deja de esperarlo")
    pj.defeated = false
    s.limpiarWatchdog()
})

test("Panel: la vida de tus aliados va bajo tus stats y el título distingue aliado de rival", () => {
    const { pjs, jefe, s } = montar(3)
    const [yo, companero, otro] = pjs
    companero.HP = Math.floor(companero.stats.hpMax / 2)
    otro.HP = 0
    otro.defeated = true

    const rivales = s.teams[1]
    const panel = () => JSON.stringify(CombatUI.buildActorMessages(s, null, false, yo, rivales))

    // Tus aliados, en pequeño, con la barra mini y vida actual/máxima
    const linea = CombatUI.lineaAliados(s, yo)
    assert.ok(linea.includes("-# **Tu equipo**"), linea)
    assert.ok(linea.includes(`- -# **${companero.Nombre}**: `), linea)
    assert.ok(linea.includes(`(${companero.HP}/${companero.stats.hpMax})`), linea)
    assert.ok(linea.includes(`- -# **${otro.Nombre}**: 💀`), "un aliado caído se ve caído")
    assert.equal((linea.match(/- -# /g) || []).length, 2, "solo los aliados, no tú")
    assert.ok(!linea.includes(`**${yo.Nombre}**`), "no te listas a ti mismo")
    assert.ok(panel().includes("Tu equipo"), "aparece en el panel del jugador")
    assert.equal(CombatUI.lineaAliados(s, jefe).includes(yo.Nombre), false, "los rivales no son tu equipo")

    // El título: si el turno es de un aliado, no estás esperando al rival
    const titulo = () => JSON.parse(panel())[0].components[0].components[0].content
    s.turnoQueue = [companero]
    assert.ok(titulo().includes(`Esperando a ${companero.Nombre}`), titulo())
    s.turnoQueue = [jefe]
    assert.ok(titulo().includes("acción del rival"), titulo())
    s.limpiarWatchdog()
})
