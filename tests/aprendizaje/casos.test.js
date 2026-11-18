// Casos de prueba del aprendizaje con páginas y minijuegos (2.10) y de sus piezas.
const test = require("node:test")
const assert = require("node:assert/strict")
const { CATALOGO, jugador } = require("../hechizos/_entorno")

const N = require("../../functions/Aprendizaje/nucleo")
const P = require("../../functions/Aprendizaje/planes")
const sesiones = require("../../functions/Aprendizaje/sesiones")
const { PRACTICA, DIFICULTAD, JUEGOS, precioPagina, FUENTES } = require("../../functions/Aprendizaje/config")
const { juegoPara } = require("../../functions/Aprendizaje/minijuegos")

const H = (id) => CATALOGO.find(h => h._id === id)
const AHORA = Date.UTC(2026, 10, 9, 18)   // 9 nov 2026, 12:00 en Ciudad de México

/** Alma mínima para el aprendizaje. */
function alma({ id = 7000, elemento = "Aqua", desafinado = false, resplandor = "VII", hechizos = [], aprendizaje = {} } = {}) {
    return {
        _id: id,
        nucleo: { Elemento: elemento, ...(desafinado ? { artefactoMagico: true } : {}) },
        sendero: { resplandor },
        dominio: { hechizos: hechizos.map(ID => ({ ID })), equipo: [] },
        aprendizaje,
    }
}
const validar = (soul, id, o = {}) => N.validarPagina({ hechizo: H(id), tienePagina: true, soul, ahora: AHORA, paraPracticar: true, ...o })

// ─── 2.10 ────────────────────────────────────────────────────────────────────

test("1 · Página de un hechizo ya aprendido → aviso; la página no se consume", () => {
    const r = validar(alma({ hechizos: ["Aqua-002"] }), "Aqua-002")
    assert.deepEqual(r, { ok: false, motivo: "ya_aprendido" })
})

test("2 · Afinado usa una página de otro elemento → rechazado (universales sí)", () => {
    assert.equal(validar(alma({ elemento: "Aqua" }), "Pyro-001").motivo, "elemento")
    assert.equal(validar(alma({ elemento: "Aqua" }), "univ-003").ok, true)
    assert.equal(validar(alma({ elemento: "Aqua" }), "Aqua-001").ok, true)
})

test("3 · Desafinado practica cualquier elemento, sin contenedor funcional → permitido", () => {
    const soul = alma({ desafinado: true })
    assert.equal(soul.dominio.equipo.length, 0, "sin contenedor")
    for (const id of ["Pyro-001", "Kryo-002", "Lux-003", "univ-005"]) assert.equal(validar(soul, id).ok, true, id)
})

test("4 · Resplandor insuficiente → rechazado con el motivo", () => {
    assert.deepEqual(validar(alma({ resplandor: "II" }), "Aqua-002"), { ok: false, motivo: "resplandor", requerido: 3, actual: 2 })
    assert.deepEqual(validar(alma({ resplandor: "IV" }), "Aqua-003"), { ok: false, motivo: "resplandor", requerido: 5, actual: 4 })
    assert.equal(validar(alma({ resplandor: "I" }), "Aqua-001").ok, true)
    // El escalón manda aunque el dato del hechizo pida menos (Electro-002 tiene resplandor_min 1)
    assert.equal(N.resplandorRequerido({ ...H("Electro-002"), Req: { resplandor_min: 1 } }), 3)
})

test("4b · Notas de Resplandor I: la puerta son los Fragmentos GANADOS, no los disponibles", () => {
    const { NOTAS_RESPLANDOR_I } = require("../../functions/Duelo/hechizos/notasResplandor")
    const nota = (id) => NOTAS_RESPLANDOR_I.find(h => h._id === id)
    const conFE = (ganados, disponibles = ganados) => ({ ...alma({ resplandor: "I" }), sendero: { resplandor: "I", StelarFragments: disponibles, StelarFragmentsTotal: ganados } })
    const v = (soul, id) => N.validarPagina({ hechizo: nota(id), tienePagina: true, soul, ahora: AHORA })
    assert.deepEqual(v(conFE(2), "Aqua-101"), { ok: false, motivo: "fragmentos", requerido: 3, actual: 2 })
    assert.equal(v(conFE(3), "Aqua-101").ok, true)
    assert.equal(v(conFE(9), "Aqua-102").motivo, "fragmentos")
    // Gastar Fragmentos en stats (disponibles 0) no bloquea: cuenta el total histórico
    assert.equal(v(conFE(10, 0), "Aqua-102").ok, true)
    // Un alma nueva (0 Fragmentos) puede practicar una página sin fe_min
    assert.equal(validar(alma({ resplandor: "I" }), "Aqua-001").ok, true)
})

test("5 · Tercera práctica en el mismo día → rechazada", () => {
    const fecha = N.fechaLocal(AHORA)
    const soul = alma({ aprendizaje: { hoy: { fecha, n: PRACTICA.PRACTICAS_POR_DIA } } })
    assert.equal(validar(soul, "Aqua-001").motivo, "limite_diario")
    // El filtro de inicio exige el contador tal como se leyó: dos clics no pueden pasar a la vez
    const una = alma({ aprendizaje: { hoy: { fecha, n: 1 } } })
    const plan = P.planInicio(una, { id: "s1", hechizo: "Aqua-001", via: "hablado", instancia: "i", ahora: AHORA })
    assert.equal(plan.filtro["aprendizaje.hoy.n"], 1)
    assert.deepEqual(plan.update.$set["aprendizaje.hoy"], { fecha, n: 2 })
})

test("6 · Práctica tras un fallo, dentro del cooldown → rechazada con el tiempo restante", () => {
    const soul = alma({ aprendizaje: { cooldownHasta: AHORA + 12 * 60_000 } })
    assert.deepEqual(validar(soul, "Aqua-001"), { ok: false, motivo: "cooldown", restanteMs: 12 * 60_000 })
    assert.equal(validar(soul, "Aqua-001", { ahora: AHORA + 13 * 60_000 }).ok, true)
})

test("7 · Puntaje ≥ 0.80 → la vía queda al 100%", () => {
    assert.equal(N.aplicarPractica({}, "hablado", 0.8).hablado, 1)
    assert.equal(N.aplicarPractica({ hablado: 0.2 }, "hablado", 0.95).hablado, 1)
})

test("8 · Puntaje < 0.80 → progreso parcial proporcional, máx. 30%", () => {
    assert.ok(Math.abs(N.aplicarPractica({}, "hablado", 0.4).hablado - 0.15) < 1e-9)
    assert.ok(Math.abs(N.aplicarPractica({}, "hablado", 0.79).hablado - 0.30 * 0.79 / 0.8) < 1e-9)
    assert.ok(N.aplicarPractica({}, "hablado", 0.79).hablado <= PRACTICA.GANANCIA_MAX_FALLO)
    assert.equal(N.aplicarPractica({ hablado: 0.9 }, "hablado", 0.7).hablado, 1, "nunca pasa de 1")
    // Se guarda por vía y el fallo pone cooldown
    const soul = alma({ aprendizaje: { activa: { id: "s1" }, practicas: { "Aqua-002": { hablado: 0.3 } } } })
    const plan = P.planFin(soul, { sesionId: "s1", hechizo: H("Aqua-002"), via: "hablado", puntaje: 0.4, ahora: AHORA })
    assert.equal(plan.aprende, false)
    assert.ok(Math.abs(plan.progreso.update.$set["aprendizaje.practicas.Aqua-002.hablado"] - 0.45) < 1e-9)
    assert.equal(plan.progreso.update.$set["aprendizaje.cooldownHasta"], AHORA + PRACTICA.COOLDOWN_FALLO_MIN * 60_000)
})

test("9 · Nota (1 vía) completada → aprendida, página consumida, practicas[id] borrado", () => {
    assert.deepEqual(N.viasDe(H("Aqua-001")), ["hablado"])
    const soul = alma({ aprendizaje: { activa: { id: "s9" } } })
    const plan = P.planFin(soul, { sesionId: "s9", hechizo: H("Aqua-001"), via: "hablado", puntaje: 1, ahora: AHORA })
    assert.equal(plan.aprende, true)
    assert.deepEqual(plan.aprendizaje.update.$push, { "dominio.hechizos": { ID: "Aqua-001", InCombat: true, usos: 0, maestria: 1 } })
    assert.ok("aprendizaje.practicas.Aqua-001" in plan.aprendizaje.update.$unset)
    assert.ok("aprendizaje.activa" in plan.aprendizaje.update.$unset)
    assert.equal(plan.aprendizaje.update.$set, undefined, "aprobado: sin cooldown")
    const consumo = P.planConsumirPagina(7000, { ID: 1004, Region: "TOB-01", Cantidad: 2 })
    assert.deepEqual(consumo.update, { $inc: { "economia.Inventario.$.Cantidad": -1 } })
    assert.deepEqual(consumo.filtro["economia.Inventario"].$elemMatch, { ID: 1004, Region: "TOB-01", Cantidad: { $gte: 1 } })
})

test("10 · Cántico con 4 vías → necesita las 4; no se aprende con 3", () => {
    const vias = N.viasDe(H("Aqua-003"))
    assert.equal(vias.length, 4)
    const tres = Object.fromEntries(vias.slice(0, 3).map(v => [v, 1]))
    assert.equal(N.hechizoAprendido(tres, vias), false)
    const soul = alma({ aprendizaje: { activa: { id: "c" }, practicas: { "Aqua-003": tres } } })
    const ultimaFallida = P.planFin(soul, { sesionId: "c", hechizo: H("Aqua-003"), via: vias[3], puntaje: 0.5, ahora: AHORA })
    assert.equal(ultimaFallida.aprende, false)
    const ultima = P.planFin(soul, { sesionId: "c", hechizo: H("Aqua-003"), via: vias[3], puntaje: 0.9, ahora: AHORA })
    assert.equal(ultima.aprende, true)
})

test("11 · Abandonar o caducar → puntaje 0; el intento ya se contó", async () => {
    // El intento se cuenta al empezar
    const soul = alma()
    const inicio = P.planInicio(soul, { id: "a", hechizo: "Aqua-002", via: "hablado", instancia: "i", ahora: AHORA })
    assert.deepEqual(inicio.update.$set["aprendizaje.hoy"], { fecha: N.fechaLocal(AHORA), n: 1 })
    // Puntaje 0: sin progreso, con cooldown
    const fin = P.planFin(alma({ aprendizaje: { activa: { id: "a" } } }), { sesionId: "a", hechizo: H("Aqua-002"), via: "hablado", puntaje: 0, ahora: AHORA })
    assert.equal(fin.progreso.update.$set["aprendizaje.practicas.Aqua-002.hablado"], 0)
    assert.ok(fin.progreso.update.$set["aprendizaje.cooldownHasta"] > AHORA)
    // Abandonar cierra la sesión con 0 una sola vez
    const s = sesiones.crear({ id: "ab", soulId: 7111, characterId: 7111, userId: "u", hechizo: H("Aqua-002"), via: "hablado" })
    assert.equal(s.terminar(0, { abandonada: true }), true)
    assert.equal(s.terminar(1), false, "no se cierra dos veces")
    assert.deepEqual(await s.promesa, { puntaje: 0, abandonada: true })
    assert.equal(sesiones.deAlma(7111), null)
})

test("12 · Reinicio del bot con una práctica abierta → el intento se devuelve", () => {
    const fecha = N.fechaLocal(AHORA)
    const activa = { id: "viejo", fecha, instancia: "otro-arranque" }
    const soul = alma({ aprendizaje: { activa, hoy: { fecha, n: 2 } } })
    assert.equal(sesiones.sigueViva(soul._id, activa), false, "no está en la memoria de este arranque")
    const plan = P.planDevolucion(soul, activa)
    assert.equal(plan.devuelto, true)
    assert.deepEqual(plan.update, { $unset: { "aprendizaje.activa": "" }, $inc: { "aprendizaje.hoy.n": -1 } })
    assert.equal(plan.filtro["aprendizaje.activa.id"], "viejo")
    // De otro día: solo se suelta el bloqueo (el contador de hoy no es de ese intento)
    const ayer = P.planDevolucion(alma({ aprendizaje: { activa: { ...activa, fecha: "2026-11-08" }, hoy: { fecha, n: 1 } } }), { ...activa, fecha: "2026-11-08" })
    assert.equal(ayer.devuelto, false)
    assert.equal(ayer.update.$inc, undefined)
})

test("13 · Dos prácticas simultáneas del mismo jugador → la segunda es rechazada", () => {
    const s = sesiones.crear({ id: "x1", soulId: 7222, characterId: 7222, userId: "u", hechizo: H("Aqua-002"), via: "hablado" })
    try {
        assert.equal(sesiones.deAlma(7222), s, "bloqueo en memoria")
        const soul = alma({ id: 7222, aprendizaje: { activa: { id: "x1" } } })
        assert.equal(validar(soul, "Aqua-002", { practicaActiva: true }).motivo, "practica_activa")
        // Bloqueo en BD: el filtro exige que no haya otra práctica activa
        const plan = P.planInicio(alma({ id: 7222 }), { id: "x2", hechizo: "Aqua-002", via: "movimiento", instancia: "i", ahora: AHORA })
        assert.equal(plan.filtro["aprendizaje.activa"], null)
    } finally { s.terminar(0) }
})

test("14 · Aprender es atómico: no se aprende dos veces ni se consume dos veces la página", () => {
    const soul = alma({ aprendizaje: { activa: { id: "t" } } })
    const plan = P.planFin(soul, { sesionId: "t", hechizo: H("Pyro-001"), via: "escritura", puntaje: 1, ahora: AHORA })
    assert.equal(plan.aprendizaje.filtro["aprendizaje.activa.id"], "t", "solo la práctica activa")
    assert.deepEqual(plan.aprendizaje.filtro["dominio.hechizos.ID"], { $ne: "Pyro-001" }, "no si ya lo conoce")
})

test("15 · La práctica no suma Maestría", () => {
    const soul = alma({ aprendizaje: { activa: { id: "m" } } })
    const plan = P.planFin(soul, { sesionId: "m", hechizo: H("Aqua-001"), via: "hablado", puntaje: 1, ahora: AHORA })
    const texto = JSON.stringify(plan)
    assert.ok(!/usos":\s*[1-9]/.test(texto) && !texto.includes("$inc"), "nada incrementa usos ni maestría")
    assert.equal(plan.aprendizaje.update.$push["dominio.hechizos"].maestria, 1)
})

test("16 · Reinicio diario por fecha en la zona horaria configurada", () => {
    assert.equal(PRACTICA.ZONA_HORARIA, "America/Mexico_City")
    // 05:30 UTC del 10 de nov = 23:30 del 9 de nov en Ciudad de México
    assert.equal(N.fechaLocal(Date.UTC(2026, 10, 10, 5, 30)), "2026-11-09")
    assert.equal(N.fechaLocal(Date.UTC(2026, 10, 10, 6, 30)), "2026-11-10")
    const soul = alma({ aprendizaje: { hoy: { fecha: "2026-11-09", n: 2 } } })
    assert.equal(N.restantesHoy(soul, Date.UTC(2026, 10, 10, 5, 30)), 0, "misma fecha local: sin prácticas")
    assert.equal(N.restantesHoy(soul, Date.UTC(2026, 10, 10, 6, 30)), 2, "fecha nueva: se reinicia")
})

// ─── Minijuegos ──────────────────────────────────────────────────────────────

test("Hablado: puntaje = 1 − Levenshtein / longitud sobre texto normalizado", () => {
    const inv = "Eón, presta una chispa a mi mano."
    assert.equal(N.puntajeHablado(inv, "eon presta una chispa a mi mano"), 1, "sin acentos ni puntuación")
    assert.equal(N.puntajeHablado(inv, "  EÓN,   presta una CHISPA a mi mano!! "), 1)
    assert.ok(N.puntajeHablado(inv, "eon presta una chispa a mi mana") > 0.9)
    assert.ok(N.puntajeHablado(inv, "nada que ver") < 0.5)
    assert.equal(N.puntajeHablado(inv, ""), 0)
    assert.equal(N.levenshtein("gato", "pato"), 1)
})

test("Generación determinista: la misma semilla da la misma firma", () => {
    const h = H("Rakau-002")
    assert.deepEqual(N.secuenciaGestos(h, 6, 5), N.secuenciaGestos(h, 6, 5))
    assert.notDeepEqual(N.secuenciaGestos(h, 8, 5), N.secuenciaGestos(H("Lapis-002"), 8, 5))
    const sello = N.selloEscritura(h, 9, { filas: 4, columnas: 5 })
    assert.deepEqual(sello, N.selloEscritura(h, 9, { filas: 4, columnas: 5 }))
    assert.equal(new Set(sello).size, 9, "nodos distintos")
    assert.ok(sello.every(n => n >= 0 && n < 20))
})

test("Movimiento y escritura: aciertos en su posición / total (no termina al primer error)", () => {
    assert.equal(N.puntajePosicional([0, 1, 2, 3], [0, 1, 2, 3]), 1)
    assert.equal(N.puntajePosicional([0, 1, 2, 3], [1, 1, 2, 0]), 0.5)
    assert.equal(N.puntajePosicional([0, 1, 2, 3], [0]), 0.25)
})

test("Mental: cuadrículas de 3×3 a 4×4 (máx. 20 botones), un distinto dentro de la cuadrícula", () => {
    for (const esc of [1, 2, 3]) {
        const rondas = N.rondasMental(H("Lux-003"), DIFICULTAD[esc].mental.rondas, { pares: JUEGOS.MENTAL.PARES, cuadriculas: JUEGOS.MENTAL.CUADRICULAS })
        assert.equal(rondas.length, DIFICULTAD[esc].mental.rondas)
        for (const r of rondas) {
            assert.ok(r.filas * r.columnas <= 16 && r.filas >= 3 && r.columnas >= 3)
            assert.ok(r.filas + 1 <= 5, "cabe con la fila de Abandonar")
            assert.ok(r.distinto >= 0 && r.distinto < r.filas * r.columnas)
            assert.notEqual(r.par[0], r.par[1])
        }
    }
})

test("Dificultad según escalón; universales como Nota", () => {
    assert.deepEqual(N.dificultad(H("Aqua-001"), "movimiento"), { pasos: 4, segundos: 5 })
    assert.deepEqual(N.dificultad(H("Aqua-002"), "escritura"), { nodos: 6, segundos: 7 })
    assert.deepEqual(N.dificultad(H("Aqua-003"), "mental"), { rondas: 7 })
    assert.equal(N.escalonDe(H("univ-003")), 1)
})

test("Minijuego por vía: stub si la bandera está apagada o faltan datos", () => {
    const { MINIJUEGOS } = require("../../functions/Aprendizaje/config")
    assert.equal(juegoPara({ _id: "x", Invocacion: "Una invocación de prueba" }, "hablado").nombre, "hablado")
    assert.equal(juegoPara({ _id: "x" }, "hablado").nombre, "stub", "sin invocación → stub")
    const previo = MINIJUEGOS.escritura
    MINIJUEGOS.escritura = false
    try { assert.equal(juegoPara(H("Pyro-001"), "escritura").nombre, "stub") }
    finally { MINIJUEGOS.escritura = previo }
})

test("Precio de página: base × aprecio; solo la tienda tiene precio", () => {
    assert.equal(precioPagina({ fuente: "tienda", aprecio: 4 }), 750)
    assert.equal(precioPagina({ fuente: "tienda", aprecio: 3 }), 500)
    assert.equal(precioPagina({ fuente: "tienda", aprecio: 2 }), 400)
    assert.equal(precioPagina({ fuente: "tienda", aprecio: 1 }), 300)
    assert.equal(precioPagina({ fuente: "tienda", aprecio: 5 }), 1250)
    assert.equal(precioPagina({ fuente: "instituto", aprecio: 2 }), null)
    assert.equal(precioPagina({ fuente: "evento", aprecio: 5 }), null)
    // 28 originales + 16 Notas de Resplandor I
    assert.equal(Object.keys(FUENTES).length, 44)
    assert.equal(new Set(Object.values(FUENTES).map(f => f.id)).size, 44, "IDs de página únicos")
    assert.ok(!("default_001" in FUENTES) && !("univ-001" in FUENTES), "Golpe y Guardia no llevan página")
})

test("Afinado/desafinado se lee del alma (no del combate)", () => {
    assert.equal(N.esAfinado(alma()), true)
    assert.equal(N.esAfinado(alma({ desafinado: true })), false)
    assert.ok(jugador())   // el entorno de combate carga sin problemas junto al de aprendizaje
})

// ─── Fase 3: páginas en las tiendas ──────────────────────────────────────────

test("Fase 3 · Comprar una página que no podría usar → rechazado; si puede usarla, pasa", () => {
    const { motivoCompraPagina } = require("../../functions/Aprendizaje/tienda")
    const def = (hechizo, fuente = "tienda") => ({ ID: 1, Nombre: `Página: ${hechizo}`, Tipo: ["Consumible", "Página"], hechizo, fuente })
    // Ya la conoce
    assert.match(motivoCompraPagina(def("Aqua-002"), alma({ hechizos: ["Aqua-002"] }), H("Aqua-002")), /Ya conoces/)
    // Afinado de otro elemento
    assert.match(motivoCompraPagina(def("Pyro-002"), alma({ elemento: "Aqua" }), H("Pyro-002")), /otro elemento/)
    // Desafinado: cualquiera; afinado: la suya y universales
    assert.equal(motivoCompraPagina(def("Pyro-002"), alma({ desafinado: true }), H("Pyro-002")), null)
    assert.equal(motivoCompraPagina(def("univ-003"), alma({ elemento: "Kryo" }), H("univ-003")), null)
    // El Resplandor no se exige al comprar (se puede guardar para después)
    assert.equal(motivoCompraPagina(def("Aqua-003"), alma({ resplandor: "I" }), H("Aqua-003")), null)
    // Sin alma despierta
    assert.match(motivoCompraPagina(def("Aqua-001"), null, H("Aqua-001")), /despertar/)
    // Un objeto que no es página no se mira
    assert.equal(motivoCompraPagina({ ID: 2, Nombre: "Galleta", Tipo: ["Consumible"] }, null, null), null)
})

test("Fase 3 · Página del Instituto agotada → la excusa del Instituto", () => {
    const { motivoLimite } = require("../../functions/Tiendas/limitesCompra")
    const definicion = { Nombre: "Página: Ola Curativa", Tipo: ["Consumible", "Página"], hechizo: "Aqua-001", fuente: "instituto" }
    const obj = { region: "TOB-01", ID: 1004, Nombre: definicion.Nombre, stock: 0, porCompra: null, porPersona: 1, porInventario: 1, definicion }
    assert.match(motivoLimite(obj, 1, { economia: { Inventario: [] } }), /casualmente, no hay/)
    // Una por persona y una en el inventario
    const conStock = { ...obj, stock: 5 }
    assert.match(motivoLimite(conStock, 1, { social: { compras: { "TOB-01:1004": 1 } } }), /por persona/)
    assert.match(motivoLimite(conStock, 1, { economia: { Inventario: [{ ID: 1004, Region: "TOB-01", Cantidad: 1 }] } }), /Ya tienes/)
    assert.equal(motivoLimite(conStock, 1, { economia: { Inventario: [] } }), null)
    // Otros objetos agotados conservan su mensaje
    assert.match(motivoLimite({ ...obj, definicion: { Nombre: "Galleta" }, Nombre: "Galleta" }, 1, {}), /se agotó/)
})

test("Fase 3 · Configuración de tiendas", () => {
    const { TIENDA, FUENTES } = require("../../functions/Aprendizaje/config")
    assert.equal(TIENDA.LUGAR_TIENDA, "Magica")
    assert.equal(TIENDA.REPOSICION_CRON, "0 0 * * 1")
    assert.equal(Object.values(FUENTES).filter(f => f.fuente === "tienda").length, 24)
    assert.equal(Object.values(FUENTES).filter(f => f.fuente === "instituto").length, 11)
})
