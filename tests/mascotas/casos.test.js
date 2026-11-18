// Casos de prueba de mascotas y crianza de huevos (functions/Mascotas).
const test = require("node:test")
const assert = require("node:assert/strict")
const { servicio, tabla, reloj, consumidos, limpiar, personaje, alma, HUEVO, HUEVO_RAPIDO } = require("./_entorno")

const N = require("../../functions/Mascotas/nucleo")
const vista = require("../../functions/Mascotas/vista")
const pantallas = require("../../functions/Mascotas/pantallas")
const C = require("../../config/configPets")
const { splitCustomId } = require("../../utils/constructores/customId")

const T0 = Date.UTC(2026, 10, 15, 18, 0, 0)   // 12:00 en Ciudad de México
const huevoNuevo = (o = {}) => N.crearHuevo({ characterId: 52, def: HUEVO, ahora: T0, id: "h1", ...o }).huevo
const mascota = (o = {}) => ({
    _id: "m1", characterID: 52, Nombre: "Shiro", tipo: "Zorro", rareza: "Sencilla", etapa: "Adultez",
    lv: 1, xp: 0, xpRq: 100, hambre: 300, higiene: 300, felicidad: 230, energia: 100,
    penalizaciones: {}, lastSeen: T0, diasCuidado: 0, activePet: true, adoptada: Math.floor(T0 / 1000), ...o,
})
const cerca = (a, b, margen) => assert.ok(Math.abs(a - b) <= margen, `${a} no está a ±${margen} de ${b}`)

test.beforeEach(limpiar)

// ─── Huevo: tiempos ──────────────────────────────────────────────────────────

test("1 · El tiempo de eclosión sale del objeto huevo; sin la propiedad son 3 días", () => {
    assert.equal(N.horasEclosion(HUEVO), 72)
    assert.equal(N.horasEclosion(HUEVO_RAPIDO), 24)
    assert.equal(N.horasEclosion({ eclosion_horas: 0 }), 72)
    assert.equal(huevoNuevo().eclosionEn, T0 + 72 * N.HORA)
    assert.equal(N.crearHuevo({ characterId: 52, def: HUEVO_RAPIDO, ahora: T0 }).huevo.eclosionEn, T0 + 24 * N.HORA)
})

test("2 · En la incubadora tarda 25% más, no se desgasta y nunca se rompe", () => {
    const h = huevoNuevo({ incubadora: true })
    assert.equal(h.eclosionEn, T0 + 90 * N.HORA)
    assert.equal(N.estadoTotal(h, T0 + 80 * N.HORA), 100)
    assert.equal(N.momentoRotura(h), Infinity)
    assert.equal(N.resolverHuevo(h, T0 + 89 * N.HORA).estado, "incubando")
    assert.equal(N.resolverHuevo(h, T0 + 90 * N.HORA).estado, "eclosionado")
    assert.equal(N.cuidarHuevo(h, "calor", T0).motivo, "en_incubadora")
})

test("3 · Sin cuidados el estado total baja y al 10% el huevo se rompe (antes de nacer)", () => {
    const h = huevoNuevo()
    const rotura = N.momentoRotura(h)
    cerca((rotura - T0) / N.HORA, 37.8, 0.2)
    cerca(N.estadoTotal(h, rotura), C.HUEVO.ESTADO_ROTURA, 0.01)
    assert.equal(N.resolverHuevo(h, rotura - N.MINUTO).estado, "incubando")
    assert.equal(N.resolverHuevo(h, T0 + 48 * N.HORA).estado, "roto")
    // Aunque se mire después de la fecha de eclosión: se rompió antes
    assert.equal(N.resolverHuevo(h, T0 + 100 * N.HORA).estado, "roto")
})

test("4 · Un huevo de 24 h nace antes de llegar a romperse aunque nadie lo cuide", () => {
    const h = N.crearHuevo({ characterId: 52, def: HUEVO_RAPIDO, ahora: T0 }).huevo
    assert.equal(N.resolverHuevo(h, T0 + 30 * N.HORA).estado, "eclosionado")
})

// ─── Huevo: cuidado ──────────────────────────────────────────────────────────

test("5 · Cuidar sube la barra de esa acción y cuenta una interacción del día", () => {
    const h = huevoNuevo()
    const t = T0 + 12 * N.HORA   // calor: 100 - 72/2 = 64
    const r = N.cuidarHuevo(h, "calor", t)
    assert.equal(r.ok, true)
    assert.equal(r.sobrecuidado, false)
    cerca(r.antes, 64, 0.01)
    cerca(r.huevo.cuidado.calor, 84, 0.01)
    cerca(r.huevo.cuidado.limpieza, 76, 0.01)   // las demás solo se ponen al día
    assert.equal(r.huevo.eclosionEn, h.eclosionEn)
    assert.equal(r.huevo.totalCuidados, 1)
    assert.equal(N.claveDeAccion("calentar"), "calor")
    assert.equal(N.claveDeAccion("acariciar"), "carino")
    assert.equal(N.claveDeAccion("limpiar"), "limpieza")
})

test("6 · Con la barra llena el cuidado es sobrecuidado: acorta un poco la eclosión", () => {
    const h = huevoNuevo()
    const r = N.cuidarHuevo(h, "carino", T0 + N.MINUTO)
    assert.equal(r.ok, true)
    assert.equal(r.sobrecuidado, true)
    assert.equal(r.reduccionMs, 72 * N.HORA * C.HUEVO.SOBRECUIDADO_FRACCION)   // 21.6 min
    assert.equal(r.huevo.eclosionEn, h.eclosionEn - r.reduccionMs)
    assert.equal(r.huevo.sobrecuidados, 1)
})

test("7 · Máximo 15 interacciones por día; al día siguiente se reinicia", () => {
    let h = huevoNuevo()
    for (let i = 0; i < C.HUEVO.MAX_INTERACCIONES_DIA; i++) {
        const r = N.cuidarHuevo(h, "limpieza", T0 + i * N.MINUTO)
        assert.equal(r.ok, true, `interacción ${i + 1}`)
        h = r.huevo
    }
    assert.equal(N.interaccionesRestantes(h, T0 + N.HORA), 0)
    assert.equal(N.cuidarHuevo(h, "limpieza", T0 + N.HORA).motivo, "limite_diario")
    // 12:00 → 00:30 del día siguiente en Ciudad de México
    const mañana = T0 + 12.5 * N.HORA
    assert.equal(N.interaccionesRestantes(h, mañana), C.HUEVO.MAX_INTERACCIONES_DIA)
    assert.equal(N.cuidarHuevo(h, "limpieza", mañana).ok, true)
})

test("8 · El sobrecuidado tiene tope: al agotarlo la interacción no se gasta", () => {
    const h = huevoNuevo()
    h.reducidoMs = h.duracionMs * C.HUEVO.SOBRECUIDADO_TOPE
    assert.equal(N.cuidarHuevo(h, "calor", T0 + N.MINUTO).motivo, "sobrecuidado_tope")
    // Una barra que no está llena sí se puede cuidar
    assert.equal(N.cuidarHuevo(h, "calor", T0 + 10 * N.HORA).ok, true)
})

test("9 · Meter y sacar de la incubadora estira o encoge el tiempo que falta", () => {
    const h = huevoNuevo()
    const t = T0 + 24 * N.HORA   // faltan 48 h
    const dentro = N.cambiarIncubadora(h, true, t).huevo
    assert.equal(dentro.eclosionEn, t + 60 * N.HORA)
    cerca(dentro.cuidado.calor, 28, 0.01)                 // se congela como estaba
    assert.equal(N.momentoRotura(dentro), Infinity)
    const fuera = N.cambiarIncubadora(dentro, false, t + 10 * N.HORA).huevo   // faltaban 50 h
    assert.equal(fuera.eclosionEn, t + 10 * N.HORA + 40 * N.HORA)
    cerca(N.barrasEn(fuera, t + 10 * N.HORA).calor, 28, 0.01)
    assert.equal(N.cambiarIncubadora(dentro, true, t).motivo, "ya_en_incubadora")
})

test("10 · Al eclosionar se sortea la especie de la tabla del huevo y nace un Bebé", () => {
    const doc = N.crearHuevo({ characterId: 52, def: HUEVO, ahora: T0, id: "h1" })
    const primera = C.ESPECIES[C.TABLAS_HUEVO["TOB-01:336"][0].especie]
    const { set, unset } = N.eclosionar(doc, { ahora: T0 + 72 * N.HORA, activa: true, azar: () => 0 })
    assert.equal(set.tipo, primera.tipo)
    assert.equal(set.rareza, primera.rareza)
    assert.equal(set.etapa, "Bebé")
    assert.equal(set.hambre, C.petConfig.hambrestd)
    assert.equal(set.activePet, true)
    assert.equal(set.nacimiento.huevo.ID, 336)
    assert.deepEqual(unset, { huevo: "" })
    // El final de la tabla es la especie más rara; un huevo sin tabla usa la de por defecto
    const ultima = C.TABLAS_HUEVO["TOB-01:336"].at(-1).especie
    assert.equal(N.sortearEspecie(HUEVO, () => 0.999999).id, ultima)
    assert.ok(N.sortearEspecie(HUEVO_RAPIDO, () => 0.5).tipo)
    for (const tabla of Object.values(C.TABLAS_HUEVO)) {
        for (const e of tabla) assert.ok(C.ESPECIES[e.especie] && C.modificadoresLv[C.ESPECIES[e.especie].rareza], e.especie)
    }
})

// ─── Mascota ─────────────────────────────────────────────────────────────────

test("11 · La mascota se desgasta con el tiempo y las penalizaciones tardan en aplicarse", () => {
    const { pet, cambio } = N.avanzarMascota(mascota(), T0 + 10 * N.HORA)
    assert.equal(cambio, true)
    assert.equal(pet.hambre, 240)       // 1 punto cada 10 min
    assert.equal(pet.higiene, 180)      // 4 puntos cada 20 min
    assert.equal(pet.energia, 0)        // 2 puntos cada 5 min: se agota a las ~4 h
    assert.ok(pet.penalizaciones.somnoliento, "sin energía → somnolienta")
    assert.equal(pet.penalizaciones.enfermo, undefined)
    assert.deepEqual(N.estadosActivos(pet).map(e => e.clave), ["somnoliento"])
})

test("12 · Dormida recupera energía y despierta sola al llenarse", () => {
    const dormida = mascota({ energia: 40, penalizaciones: { dormido: { desde: Math.floor(T0 / 1000), tipo: "especial" } } })
    const medio = N.avanzarMascota(dormida, T0 + 30 * N.MINUTO)
    assert.equal(medio.pet.energia, 65)
    assert.equal(N.estaDormida(medio.pet), true)
    const despues = N.avanzarMascota(dormida, T0 + 3 * N.HORA)
    assert.equal(despues.desperto, true)
    assert.equal(N.estaDormida(despues.pet), false)
    assert.ok(despues.pet.energia < 100 && despues.pet.energia > 40)
})

test("13 · Cuidar a la mascota: sube la necesidad, da XP y cuenta el día una sola vez", () => {
    const hambrienta = mascota({ hambre: 100, xp: 96 })
    const r = N.cuidarMascota(hambrienta, "alimentar", { ahora: T0, azar: () => 0 })
    assert.equal(r.ok, true)
    assert.equal(r.pet.hambre, 190)
    assert.equal(r.pet.xp, 100)   // 3 de base ×1.25 por estar Entusiasmada (felicidad al 100%)
    assert.equal(N.cuidarMascota(mascota({ hambre: 100, felicidad: 100 }), "alimentar", { ahora: T0, azar: () => 0 }).pet.xp, 3)
    assert.equal(r.subioNivel, true)
    assert.equal(r.pet.lv, 2)
    assert.equal(r.pet.diasCuidado, 1)
    const otra = N.cuidarMascota(r.pet, "alimentar", { ahora: T0 + N.HORA, azar: () => 0 })
    assert.equal(otra.pet.diasCuidado, 1)
    // Llena no gasta nada; dormida solo se la puede despertar
    assert.equal(N.cuidarMascota(mascota(), "alimentar", { ahora: T0 }).motivo, "lleno")
    const dormida = N.cuidarMascota(mascota({ energia: 20 }), "dormir", { ahora: T0 }).pet
    assert.equal(N.estaDormida(dormida), true)
    assert.equal(N.cuidarMascota(dormida, "jugar", { ahora: T0 }).motivo, "dormida")
    assert.equal(N.cuidarMascota(dormida, "dormir", { ahora: T0 }).desperto, true)
})

// ─── Servicio (por personaje) ────────────────────────────────────────────────

test("14 · Usar un huevo lo saca del inventario y lo pone a criar en el PERSONAJE", async () => {
    const pj = personaje(52, [HUEVO])
    const r = await servicio.empezarHuevo({ character: pj, soul: alma(52), region: "TOB-01", id: 336, incubadora: false })
    assert.equal(r.ok, true)
    assert.deepEqual(consumidos, [{ characterId: 52, ID: 336, Region: "TOB-01", Nombre: "Huevo fragmentado" }])
    const [doc] = [...tabla("Mascotas").values()]
    assert.equal(doc.characterID, 52)
    assert.equal(doc.etapa, "Huevo")
    assert.equal(doc.huevo.incubadora, false)
    // Solo un huevo a mano a la vez; el segundo va a la incubadora si la tiene
    assert.equal((await servicio.empezarHuevo({ character: pj, soul: alma(52), region: "TOB-01", id: 336, incubadora: false })).motivo, "limite_manual")
    assert.equal((await servicio.empezarHuevo({ character: pj, soul: alma(52), region: "TOB-01", id: 336, incubadora: true })).motivo, "sin_incubadora")
    const conIncubadora = personaje(52, [HUEVO, { ID: 52, Region: "TOB-01" }])
    assert.equal((await servicio.empezarHuevo({ character: conIncubadora, soul: alma(52), region: "TOB-01", id: 336, incubadora: true })).ok, true)
    assert.equal((await servicio.empezarHuevo({ character: conIncubadora, soul: alma(52), region: "TOB-01", id: 336, incubadora: true })).motivo, "incubadora_ocupada")
})

test("15 · Sin alma no hay energía: solo puede criar en incubadora; un objeto que no es huevo no se cría", async () => {
    const pj = personaje(7, [HUEVO, { ID: 52, Region: "TOB-01" }, { ID: 483, Region: "SKY-02" }])
    assert.equal((await servicio.empezarHuevo({ character: pj, soul: null, region: "TOB-01", id: 336, incubadora: false })).motivo, "sin_alma")
    assert.equal((await servicio.empezarHuevo({ character: pj, soul: null, region: "SKY-02", id: 483, incubadora: true })).motivo, "no_es_huevo")
    assert.equal(consumidos.length, 0)
    assert.equal((await servicio.empezarHuevo({ character: pj, soul: null, region: "TOB-01", id: 336, incubadora: true })).ok, true)
})

test("16 · Cada cuidado del huevo cuesta 1 de energía del personaje; sin energía no pasa nada", async () => {
    const pj = personaje(52, [HUEVO])
    const soul = alma(52, 2)
    const { huevo } = await servicio.empezarHuevo({ character: pj, soul, region: "TOB-01", id: 336, incubadora: false })
    reloj.ahora += 12 * N.HORA

    const r = await servicio.cuidarHuevo({ character: pj, soul, huevoId: huevo._id, clave: "calor" })
    assert.equal(r.ok, true)
    assert.equal(r.energia, 1)
    assert.equal(tabla("Soul").get(52).nucleo.energy, 1)
    cerca(tabla("Mascotas").get(huevo._id).huevo.cuidado.calor, 84, 0.01)

    await servicio.cuidarHuevo({ character: pj, soul, huevoId: huevo._id, clave: "limpiar" })
    assert.equal(tabla("Soul").get(52).nucleo.energy, 0)
    const antes = JSON.stringify(tabla("Mascotas").get(huevo._id))
    const sin = await servicio.cuidarHuevo({ character: pj, soul, huevoId: huevo._id, clave: "carino" })
    assert.equal(sin.motivo, "sin_energia")
    assert.equal(JSON.stringify(tabla("Mascotas").get(huevo._id)), antes)

    // El huevo es del personaje 52: otro personaje no lo puede tocar
    const ajeno = await servicio.cuidarHuevo({ character: personaje(99), soul: alma(99), huevoId: huevo._id, clave: "calor" })
    assert.equal(ajeno.motivo, "huevo_no_encontrado")
    assert.equal(tabla("Soul").get(99).nucleo.energy, 140)
})

test("17 · Gastar energía estando al máximo reinicia el reloj de regeneración", async () => {
    const soul = alma(52, 140)
    tabla("Soul").get(52).nucleo.lastEnergyUpdate = 1
    soul.nucleo.lastEnergyUpdate = 1
    const r = await servicio.gastarEnergia(soul, 1)
    assert.deepEqual(r, { ok: true, energia: 139 })
    assert.equal(tabla("Soul").get(52).nucleo.lastEnergyUpdate, reloj.ahora)
})

test("18 · Al mirar el panel, el huevo que cumplió su tiempo nace y queda como mascota activa", async () => {
    const pj = personaje(52, [HUEVO, { ID: 52, Region: "TOB-01" }])
    const { huevo } = await servicio.empezarHuevo({ character: pj, soul: alma(52), region: "TOB-01", id: 336, incubadora: true })
    reloj.ahora += 91 * N.HORA

    const datos = await servicio.cargar(52, { reconocer: true })
    assert.equal(datos.huevos.length, 0)
    assert.equal(datos.mascotas.length, 1)
    assert.equal(datos.activa._id, huevo._id)
    assert.equal(datos.activa.etapa, "Bebé")
    assert.deepEqual(datos.avisos.map(a => a.tipo), ["nacio"])
    const doc = tabla("Mascotas").get(huevo._id)
    assert.equal(doc.huevo, undefined)
    assert.equal(doc.activePet, true)
    assert.equal(doc.nacimiento.visto, true)
    // La segunda vez ya no se anuncia
    assert.equal((await servicio.cargar(52, { reconocer: true })).avisos.length, 0)
})

test("19 · Un huevo roto se le avisa a su dueño una vez; si lo ve otro, queda marcado", async () => {
    const pj = personaje(52, [HUEVO])
    const { huevo } = await servicio.empezarHuevo({ character: pj, soul: alma(52), region: "TOB-01", id: 336, incubadora: false })
    reloj.ahora += 50 * N.HORA

    const ajeno = await servicio.leer(52, { reconocer: false })
    assert.equal(ajeno.huevos.length, 0)
    assert.equal(ajeno.avisos.length, 0)
    assert.ok(tabla("Mascotas").get(huevo._id).huevo.roto)
    assert.equal((await servicio.cuidarHuevo({ character: pj, soul: alma(52), huevoId: huevo._id, clave: "calor" })).motivo, "huevo_no_encontrado")

    const propio = await servicio.leer(52, { reconocer: true })
    assert.deepEqual(propio.avisos, [{ tipo: "roto", nombre: "Huevo fragmentado" }])
    assert.equal(tabla("Mascotas").has(huevo._id), false)
    // Roto ya no ocupa el hueco de crianza
    assert.equal((await servicio.opcionesDeCrianza({ character: pj, soul: alma(52) })).manual.ok, true)
})

test("20 · Las mascotas se cuidan por personaje: el objeto se gasta solo si la acción hace algo", async () => {
    await tabla("Mascotas").set("m1", mascota({ hambre: 100 }))
    const pj = personaje(52, [{ ID: 483, Region: "SKY-02" }])

    const ajeno = await servicio.cuidarMascota({ character: personaje(99, [{ ID: 483, Region: "SKY-02" }]), petId: "m1", accion: "alimentar" })
    assert.equal(ajeno.motivo, "mascota_no_encontrada")

    const sin = await servicio.cuidarMascota({ character: personaje(52), petId: "m1", accion: "alimentar" })
    assert.equal(sin.motivo, "sin_objeto")
    assert.equal(consumidos.length, 0)

    const r = await servicio.cuidarMascota({ character: pj, petId: "m1", accion: "alimentar" })
    assert.equal(r.ok, true)
    assert.equal(tabla("Mascotas").get("m1").hambre, 190)
    assert.deepEqual(consumidos, [{ characterId: 52, ID: 483, Region: "SKY-02" }])

    tabla("Mascotas").get("m1").hambre = 300
    assert.equal((await servicio.cuidarMascota({ character: pj, petId: "m1", accion: "alimentar" })).motivo, "lleno")
    assert.equal(consumidos.length, 1)

    // La cama es una herramienta: hace falta tenerla, no se gasta
    tabla("Mascotas").get("m1").energia = 10
    assert.equal((await servicio.cuidarMascota({ character: pj, petId: "m1", accion: "dormir" })).motivo, "sin_objeto")
    const conCama = personaje(52, [{ ID: 736, Region: "SKY-02" }])
    assert.equal((await servicio.cuidarMascota({ character: conCama, petId: "m1", accion: "dormir" })).ok, true)
    assert.ok(tabla("Mascotas").get("m1").penalizaciones.dormido)
    assert.equal(consumidos.length, 1)
})

test("21 · Cambiar de mascota activa y renombrarla", async () => {
    tabla("Mascotas").set("m1", mascota())
    tabla("Mascotas").set("m2", mascota({ _id: "m2", Nombre: "Kuro", activePet: false }))
    assert.equal((await servicio.activar({ character: personaje(52), petId: "m2" })).ok, true)
    assert.equal(tabla("Mascotas").get("m1").activePet, false)
    assert.equal(tabla("Mascotas").get("m2").activePet, true)
    assert.equal((await servicio.cargar(52)).activa._id, "m2")

    const r = await servicio.renombrar({ character: personaje(52), petId: "m2", nombre: "  @everyone **Luna**\n" })
    assert.equal(r.nombre, "everyone Luna")
    assert.equal((await servicio.renombrar({ character: personaje(52), petId: "m2", nombre: "*" })).motivo, "nombre_invalido")
    assert.equal((await servicio.renombrar({ character: personaje(99), petId: "m2", nombre: "Robada" })).motivo, "mascota_no_encontrada")
})

// ─── Paneles ─────────────────────────────────────────────────────────────────

/** Recorre un árbol de componentes V2. */
function recorrer(componentes, fn) {
    for (const c of componentes || []) {
        fn(c)
        recorrer(c.components, fn)
        if (c.accessory) fn(c.accessory)
    }
}
function revisar(componentes) {
    let total = 0
    const ids = []
    recorrer(componentes, (c) => {
        total++
        if (c.custom_id) ids.push(c.custom_id)
        if (c.type === 10) assert.ok(c.content.length > 0 && c.content.length <= 4000)
    })
    assert.ok(total <= 40, `el mensaje tiene ${total} componentes (máx. 40)`)
    assert.equal(new Set(ids).size, ids.length, "custom_id repetido")
    for (const id of ids) assert.ok(id.length <= 100, id)
    return ids
}

test("22 · Los paneles caben en un mensaje y sus botones resuelven el personaje activo", async () => {
    const pj = personaje(52, [HUEVO, { ID: 52, Region: "TOB-01" }])
    const soul = alma(52)
    tabla("Mascotas").set("m1", mascota())
    tabla("Mascotas").set("m2", mascota({ _id: "m2", Nombre: "Kuro", activePet: false }))
    await servicio.empezarHuevo({ character: pj, soul, region: "TOB-01", id: 336, incubadora: false })
    await servicio.empezarHuevo({ character: pj, soul, region: "TOB-01", id: 336, incubadora: true })
    const userId = "665421882694041630"

    const panelMascota = await pantallas.mascotas({ userId, character: pj, puedeCuidar: true, origen: "e", aviso: "aviso" })
    const panelHuevos = await pantallas.huevos({ userId, character: pj, soul, origen: "e", aviso: "aviso" })
    const nuevo = await pantallas.nuevoHuevo({ userId, character: pj, soul, def: HUEVO })
    const ids = [...revisar(panelMascota.components), ...revisar(panelHuevos.components), ...revisar(nuevo.components)]

    for (const id of ids) {
        const [accion, autor, characterId] = splitCustomId(id)
        assert.ok(["mascotas", "pets"].includes(accion), id)
        assert.equal(autor, userId)
        assert.equal(characterId, "", "el customId no fija personaje: se usa el activo")
    }
    assert.deepEqual(splitCustomId(ids.find(id => id.includes("-nuevo-"))).slice(3), ["nuevo", "TOB-01", "336", "manual"])
    assert.ok(ids.some(id => id.endsWith("-calor-e")))

    // Solo lectura cuando no es el personaje activo de quien mira: nada se puede pulsar
    const ajeno = await pantallas.mascotas({ userId, character: pj, puedeCuidar: false, origen: "e" })
    recorrer(ajeno.components, (c) => { if (c.type === 2 || c.type === 3) assert.equal(c.disabled, true, c.custom_id) })
})

test("23 · Los huevos y la incubadora se usan desde el inventario; el alimento de mascota no", () => {
    const catalogo = require("../../functions/catalogoObjetos")
    const { DEFINICIONES } = require("./_entorno")
    catalogo.getCatalogo().set("TOB-01", DEFINICIONES.filter(d => d.Region === "TOB-01"))
    catalogo.getCatalogo().set("SKY-02", DEFINICIONES.filter(d => d.Region === "SKY-02").map(d => ({ ...d, efectos: [] })))
    const { tipoDeUso } = require("../../functions/Objetos/usarObjeto")
    assert.equal(tipoDeUso({ ID: 336, Region: "TOB-01" }), "huevo")
    assert.equal(tipoDeUso({ ID: 900, Region: "TOB-01" }), "huevo")
    assert.equal(tipoDeUso({ ID: 52, Region: "TOB-01" }), "incubadora")
    assert.equal(tipoDeUso({ ID: 483, Region: "SKY-02" }), null)
})
