// functions/Mascotas/servicio.js
// Operaciones de mascotas y huevos contra la base de datos. Las reglas viven en ./nucleo.js.
// Todo se resuelve por PERSONAJE (characterID = Personajes._id), nunca por ID de Discord:
// quien llama pasa el personaje activo (el que inyecta el router).

const clientdb = require("../../Server")
const rol = clientdb.db("Rol_db")
const mascotas = rol.collection("Mascotas")
const souls = rol.collection("Soul")
const catalogoObjetos = require("../catalogoObjetos")
const N = require("./nucleo")
const C = require("../../config/configPets")

// Dependencias externas en un objeto para poder sustituirlas en las pruebas
const deps = {
    ahora: () => Date.now(),
    azar: Math.random,
    maxEnergia: () => require("../../config/config").maxEnergy,
    recargarEnergia: (soul) => require("../dataCharacters").recargarEnergia(soul.nucleo?.energy ?? 0, soul),
    consumirObjeto: (characterId, obj) => require("../updateInventario")(null, null, characterId, {
        isItem: true, ID: obj.ID, Region: obj.Region, consumir: true, cantidad: 1,
    }),
    devolverObjeto: (characterId, obj) => require("../updateInventario")(null, null, characterId, {
        isItem: true, ID: obj.ID, Region: obj.Region, Nombre: obj.Nombre, cantidad: 1,
    }),
    definicion: (region, id) => catalogoObjetos.getObjetoPorId(region, id),
}

const fallo = (motivo, extra = {}) => ({ ok: false, motivo, ...extra })
const idDe = (character) => Number(character?._id)
const inventarioDe = (character) => character?.economia?.Inventario || []

/** Entrada del inventario con al menos una unidad de ese objeto. */
function itemEnInventario(character, obj) {
    return inventarioDe(character).find(i =>
        Number(i.ID) === Number(obj.ID) && (!i.Region || !obj.Region || i.Region === obj.Region) && Number(i.Cantidad ?? 1) > 0
    ) || null
}

const tieneIncubadora = (character) => Boolean(itemEnInventario(character, C.HUEVO.INCUBADORA))

/** _id del personaje activo de un usuario de Discord (para saber si el panel que ve es el suyo). */
async function idPersonajeActivo(discordId) {
    const { userdb } = await require("../../utils/getDataCharacters").resolveActivePjFilter(discordId)
    return userdb?.usuario?.nix?.personajeActivo ?? userdb?.nix?.personajeActivo ?? null
}

/** Energía actual del personaje (con la regeneración aplicada), o null si no ha despertado su alma. */
async function energiaDe(soul) {
    if (!soul) return null
    return Number(await deps.recargarEnergia(soul)) || 0
}

/** Cobra energía al personaje. Devuelve la energía que le queda. */
async function gastarEnergia(soul, cantidad) {
    const actual = await energiaDe(soul)
    if (actual === null || actual < cantidad) return fallo("sin_energia", { energia: actual ?? 0 })

    // Si estaba al máximo el reloj de regeneración empieza ahora (si no, la recarga la devolvería entera)
    const reiniciaReloj = actual >= deps.maxEnergia() || !Number(soul.nucleo?.lastEnergyUpdate)
    const res = await souls.updateOne(
        { _id: soul._id, "nucleo.energy": { $gte: cantidad } },
        { $inc: { "nucleo.energy": -cantidad }, ...(reiniciaReloj ? { $set: { "nucleo.lastEnergyUpdate": deps.ahora() } } : {}) }
    )
    if (!res.modifiedCount) return fallo("sin_energia", { energia: actual })
    if (soul.nucleo) soul.nucleo.energy = actual - cantidad
    return { ok: true, energia: actual - cantidad }
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

const CAMPOS_MASCOTA = [
    ...N.STATS, "penalizaciones", "critico", "lastSeen", "xp", "xpRq", "lv", "etapa",
    "crecimiento", "personalidad", "diasCuidado", "diaCuidado", "lastDay",
]

async function guardarMascota(pet) {
    const set = {}
    for (const campo of CAMPOS_MASCOTA) if (pet[campo] !== undefined) set[campo] = pet[campo]
    // saveStats: copia que usaba el motor de estados anterior
    await mascotas.updateOne({ _id: pet._id }, { $set: set, $unset: { saveStats: "" } })
}

/**
 * Mascotas y huevos de un personaje, con los huevos ya resueltos (los que tocaba eclosionan o se rompen).
 * @param {number|string} characterId
 * @param {Object} [o]
 * @param {boolean} [o.reconocer] - true si lo mira su dueño: se le avisa de nacimientos y roturas y se dan por vistos
 * @returns {Promise<{ mascotas: Object[], huevos: Object[], avisos: Array<{ tipo: "nacio"|"roto", pet?: Object, nombre?: string }> }>}
 */
async function leer(characterId, { reconocer = false } = {}) {
    const ahora = deps.ahora()
    const docs = await mascotas.find({ characterID: Number(characterId) }).toArray()
    const pets = docs.filter(d => !N.esHuevo(d))
    const huevos = []
    const avisos = []
    let hayActiva = pets.some(p => p.activePet)

    // Nacimientos que se resolvieron cuando miraba otra persona
    for (const pet of pets) {
        if (reconocer && pet.nacimiento && pet.nacimiento.visto === false) {
            avisos.push({ tipo: "nacio", pet })
            await mascotas.updateOne({ _id: pet._id }, { $set: { "nacimiento.visto": true } })
            pet.nacimiento.visto = true
        }
    }

    for (const doc of docs.filter(N.esHuevo)) {
        const nombre = doc.huevo?.objeto?.Nombre || doc.Nombre || "Huevo"
        const estado = doc.huevo?.roto ? { estado: "roto" } : N.resolverHuevo(doc.huevo, ahora)

        if (estado.estado === "roto") {
            if (reconocer) {
                await mascotas.deleteOne({ _id: doc._id })
                avisos.push({ tipo: "roto", nombre })
            } else if (!doc.huevo.roto) {
                // Queda marcado hasta que su dueño lo vea
                await mascotas.updateOne({ _id: doc._id }, { $set: { "huevo.roto": { en: estado.en } } })
            }
            continue
        }

        if (estado.estado === "eclosionado") {
            const { set, unset } = N.eclosionar(doc, { ahora, activa: !hayActiva, azar: deps.azar })
            hayActiva = true
            if (reconocer) set.nacimiento.visto = true
            await mascotas.updateOne({ _id: doc._id, etapa: N.ETAPA_HUEVO }, { $set: set, $unset: unset })
            const pet = { ...doc, ...set }
            delete pet.huevo
            pets.push(pet)
            if (reconocer) avisos.push({ tipo: "nacio", pet })
            continue
        }

        huevos.push(doc)
    }

    return { mascotas: pets, huevos, avisos }
}

/**
 * Todo lo que necesita el panel: listas + la mascota activa puesta al día.
 * Si ninguna está marcada como activa, lo queda la primera.
 */
async function cargar(characterId, opciones = {}) {
    const datos = await leer(characterId, opciones)
    let activa = datos.mascotas.find(p => p.activePet) || datos.mascotas[0] || null
    if (activa) {
        if (!activa.activePet) {
            await mascotas.updateOne({ _id: activa._id }, { $set: { activePet: true } })
            activa.activePet = true
        }
        const { pet, cambio } = N.avanzarMascota(activa, deps.ahora())
        if (cambio) await guardarMascota(pet)
        datos.mascotas[datos.mascotas.indexOf(activa)] = pet
        activa = pet
    }
    return { ...datos, activa }
}

async function mascotaDe(character, petId) {
    const doc = await mascotas.findOne({ _id: String(petId), characterID: idDe(character) })
    return doc && !N.esHuevo(doc) ? doc : null
}

async function huevoDe(character, huevoId) {
    const doc = await mascotas.findOne({ _id: String(huevoId), characterID: idDe(character) })
    return doc && N.esHuevo(doc) && !doc.huevo?.roto ? doc : null
}

// ─── Mascotas ────────────────────────────────────────────────────────────────

/**
 * Alimentar, limpiar, jugar o dormir/despertar a una mascota del personaje.
 * El objeto se gasta solo si la acción hace algo.
 */
async function cuidarMascota({ character, petId, accion }) {
    const cfg = C.ACCIONES_MASCOTA[accion]
    if (!cfg) return fallo("accion_invalida")
    const doc = await mascotaDe(character, petId)
    if (!doc) return fallo("mascota_no_encontrada")

    const ahora = deps.ahora()
    const { pet } = N.avanzarMascota(doc, ahora)
    const despertar = accion === "dormir" && N.estaDormida(pet)
    const def = deps.definicion(cfg.objeto.Region, cfg.objeto.ID)

    if (!despertar && !itemEnInventario(character, cfg.objeto)) {
        await guardarMascota(pet)
        return fallo("sin_objeto", { cfg, objeto: def })
    }

    const r = N.cuidarMascota(pet, accion, { def, ahora, azar: deps.azar })
    if (!r.ok) {
        await guardarMascota(pet)
        return { ...r, cfg, objeto: def }
    }

    if (cfg.consume && !despertar) {
        const consumo = await deps.consumirObjeto(character._id, cfg.objeto)
        if (!consumo?.success) return fallo("sin_objeto", { cfg, objeto: def })
    }
    await guardarMascota(r.pet)
    return { ...r, cfg, objeto: def, accion }
}

/** Deja una mascota como la activa del personaje (la que lo acompaña). */
async function activar({ character, petId }) {
    const doc = await mascotaDe(character, petId)
    if (!doc) return fallo("mascota_no_encontrada")
    await mascotas.updateMany({ characterID: idDe(character), activePet: true, _id: { $ne: doc._id } }, { $set: { activePet: false } })
    await mascotas.updateOne({ _id: doc._id }, { $set: { activePet: true } })
    return { ok: true, pet: doc }
}

/** Nombre limpio: sin menciones, formato ni saltos de línea. */
function limpiarNombre(texto) {
    return String(texto ?? "")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[@#`*_~|<>\\[\]()]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, C.LIMITES.NOMBRE_MAX)
}

async function renombrar({ character, petId, nombre }) {
    const limpio = limpiarNombre(nombre)
    if (limpio.length < 2) return fallo("nombre_invalido")
    const doc = await mascotaDe(character, petId)
    if (!doc) return fallo("mascota_no_encontrada")
    await mascotas.updateOne({ _id: doc._id }, { $set: { Nombre: limpio } })
    return { ok: true, nombre: limpio }
}

// ─── Huevos ──────────────────────────────────────────────────────────────────

/**
 * Qué formas de criar un huevo tiene disponibles el personaje ahora mismo.
 * @returns {Promise<{ manual: { ok: boolean, motivo?: string }, incubadora: { ok: boolean, motivo?: string }, lleno: boolean }>}
 */
async function opcionesDeCrianza({ character, soul }) {
    const { mascotas: pets, huevos } = await leer(character._id)
    const lleno = pets.length + huevos.length >= C.LIMITES.MAX_MASCOTAS
    const aMano = huevos.filter(h => !h.huevo.incubadora).length
    const enIncubadora = huevos.some(h => h.huevo.incubadora)

    const manual = lleno ? fallo("limite_mascotas")
        : !soul ? fallo("sin_alma")
            : aMano >= C.HUEVO.MAX_SIN_INCUBADORA ? fallo("limite_manual")
                : { ok: true }
    const incubadora = lleno ? fallo("limite_mascotas")
        : !tieneIncubadora(character) ? fallo("sin_incubadora")
            : enIncubadora ? fallo("incubadora_ocupada")
                : { ok: true }
    return { manual, incubadora, lleno }
}

/**
 * Saca un huevo del inventario y lo pone a criar, a mano o en la incubadora.
 * @param {Object} p
 * @param {string} p.region - región del objeto huevo
 * @param {number|string} p.id - ID del objeto huevo
 * @param {boolean} p.incubadora
 */
async function empezarHuevo({ character, soul, region, id, incubadora }) {
    const def = deps.definicion(region, id)
    if (!def || !N.esObjetoHuevo(def)) return fallo("no_es_huevo")
    const objeto = { ID: Number(def.ID), Region: def.Region || region, Nombre: def.Nombre }
    if (!itemEnInventario(character, objeto)) return fallo("sin_huevo", { objeto: def })

    const opciones = await opcionesDeCrianza({ character, soul })
    const opcion = incubadora ? opciones.incubadora : opciones.manual
    if (!opcion.ok) return { ...opcion, objeto: def }

    const consumo = await deps.consumirObjeto(character._id, objeto)
    if (!consumo?.success) return fallo("sin_huevo", { objeto: def })

    const doc = N.crearHuevo({ characterId: character._id, def: { ...def, Region: objeto.Region }, incubadora, ahora: deps.ahora() })
    try {
        await mascotas.insertOne(doc)
    } catch (error) {
        console.error("[Mascotas] No se pudo guardar el huevo, se devuelve al inventario:", error)
        await deps.devolverObjeto(character._id, objeto)
        return fallo("error")
    }
    return { ok: true, huevo: doc, objeto: def }
}

/**
 * Una interacción de cuidado sobre un huevo: limpiar, acariciar o calentar. Cuesta energía del personaje.
 * @param {Object} p
 * @param {string} p.clave - "limpieza" | "carino" | "calor" (o el nombre de la acción)
 */
async function cuidarHuevo({ character, soul, huevoId, clave }) {
    const doc = await huevoDe(character, huevoId)
    if (!doc) return fallo("huevo_no_encontrado")
    const ahora = deps.ahora()
    const estado = N.resolverHuevo(doc.huevo, ahora)
    if (estado.estado !== "incubando") return fallo(estado.estado)
    if (!soul) return fallo("sin_alma")

    const r = N.cuidarHuevo(doc.huevo, N.claveDeAccion(clave), ahora)
    if (!r.ok) return r

    const cobro = await gastarEnergia(soul, C.HUEVO.COSTO_ENERGIA)
    if (!cobro.ok) return cobro

    // El filtro por cuidadoEn evita aplicar dos veces la misma lectura
    const res = await mascotas.updateOne({ _id: doc._id, "huevo.cuidadoEn": doc.huevo.cuidadoEn }, { $set: { huevo: r.huevo } })
    if (!res.modifiedCount) return fallo("error")
    return { ...r, energia: cobro.energia, clave: N.claveDeAccion(clave), nombre: doc.huevo.objeto?.Nombre || doc.Nombre }
}

/** Mete un huevo en la incubadora o lo saca para cuidarlo a mano. */
async function moverIncubadora({ character, soul, huevoId, meter }) {
    const doc = await huevoDe(character, huevoId)
    if (!doc) return fallo("huevo_no_encontrado")
    const ahora = deps.ahora()
    const estado = N.resolverHuevo(doc.huevo, ahora)
    if (estado.estado !== "incubando") return fallo(estado.estado)

    const { huevos } = await leer(character._id)
    const otros = huevos.filter(h => h._id !== doc._id)
    if (meter) {
        if (!tieneIncubadora(character)) return fallo("sin_incubadora")
        if (otros.some(h => h.huevo.incubadora)) return fallo("incubadora_ocupada")
    } else {
        if (!soul) return fallo("sin_alma")
        if (otros.filter(h => !h.huevo.incubadora).length >= C.HUEVO.MAX_SIN_INCUBADORA) return fallo("limite_manual")
    }

    const r = N.cambiarIncubadora(doc.huevo, meter, ahora)
    if (!r.ok) return r
    await mascotas.updateOne({ _id: doc._id }, { $set: { huevo: r.huevo } })
    return { ...r, nombre: doc.huevo.objeto?.Nombre || doc.Nombre }
}

module.exports = {
    deps,
    itemEnInventario, tieneIncubadora, idPersonajeActivo, energiaDe, gastarEnergia,
    leer, cargar, cuidarMascota, activar, renombrar, limpiarNombre,
    opcionesDeCrianza, empezarHuevo, cuidarHuevo, moverIncubadora,
}
