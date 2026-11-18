// ─── El Anfitrión: activación, cierre del encuentro y recompensas (BD) ────────
// Datos por CUENTA (Server_db.usuarios_server, _id = ID de Discord):
//   salonEspejos: { peleasSosias, invitacion, huidas, anfitrionVencido, vencidoEn, ultimaRepeticion, trofeos[] }
// Datos por PERSONAJE (Soul.salonEspejos.perfil): cómo te leyó el Salón en tu último combate
// (lo muestra el Espejo de Mano).

const { ANFITRION } = require("./config")

const usuarios = () => require("../../../../Server").db("Server_db").collection("usuarios_server")
const souls = () => require("../../../../Server").db("Rol_db").collection("Soul")
const DIA_MS = 24 * 60 * 60 * 1000

const npcs = () => require("../../../../Server").db("Rol_db").collection("NPCs")
const esSosias = (enemy) => enemy?.habilidadUnica === "sosias"
const esAnfitrion = (enemy) => enemy?.habilidadUnica === "anfitrion"

/**
 * El disfraz de la Fase I: El Anfitrión sale a la pista como un Sosias cualquiera, así que toma
 * las estadísticas (y el nombre, el aspecto y los ataques) del Sosias original de la base de datos.
 * Lo suyo solo aparece en la Ruptura. Si no está el NPC base, se queda con lo que tenga guardado.
 * @param {Object} enemy - documento del NPC del jefe
 * @returns {Promise<Object>}
 */
async function vestirDeSosias(enemy) {
    try {
        const base = await npcs().findOne({ _id: ANFITRION.NPC_BASE })
        if (!base) return enemy
        return { ...base, _id: enemy._id, habilidadUnica: "anfitrion", anfitrionDatos: enemy.anfitrionDatos }
    } catch (e) {
        console.error("[Anfitrión] No se pudo leer al Sosias base:", e.message)
        return enemy
    }
}

/** Huidas previas de cada personaje (las usa la voz del jefe). */
async function huidasDe(participantes = []) {
    const owners = [...new Set(participantes.map(p => String(p.ownerId)).filter(Boolean))]
    const huidas = {}
    if (!owners.length) return huidas
    const cuentas = await usuarios().find({ _id: { $in: owners } }, { projection: { salonEspejos: 1 } }).toArray()
    for (const p of participantes) {
        const c = cuentas.find(x => x._id === String(p.ownerId))
        huidas[p.characterId] = Number(c?.salonEspejos?.huidas) || 0
    }
    return huidas
}

/**
 * Antes de crear el combate: si algún integrante cumple la condición (10 peleas contra Sosias o una
 * Invitación aceptada), este Sosias es El Anfitrión. Sin aviso: conserva nombre y aspecto.
 * Si el NPC ya es El Anfitrión (el de la base de datos), sale vestido del Sosias original.
 * @param {Object} enemy - documento del NPC
 * @param {{ ownerId: string, characterId: number }[]} participantes
 * @returns {Promise<Object>} el mismo documento o su versión Anfitrión
 */
async function prepararEnemigo(enemy, participantes = []) {
    if (esAnfitrion(enemy)) {
        const jefe = await vestirDeSosias(enemy)
        const datos = { ...(enemy.anfitrionDatos || {}) }
        try { datos.huidas = await huidasDe(participantes) } catch { datos.huidas ??= {} }
        return { ...jefe, anfitrionDatos: datos }
    }
    if (!esSosias(enemy)) return enemy
    const owners = [...new Set(participantes.map(p => String(p.ownerId)).filter(Boolean))]
    if (!owners.length) return enemy
    try {
        const cuentas = await usuarios().find({ _id: { $in: owners } }, { projection: { salonEspejos: 1 } }).toArray()
        const cumple = (c) => (Number(c?.salonEspejos?.peleasSosias) || 0) >= ANFITRION.PELEAS_PARA_ACTIVAR || c?.salonEspejos?.invitacion === true
        if (!cuentas.some(cumple)) return enemy
        // La Invitación se gasta al forzar el encuentro
        const conInvitacion = cuentas.filter(c => c?.salonEspejos?.invitacion === true).map(c => c._id)
        if (conInvitacion.length) await usuarios().updateMany({ _id: { $in: conInvitacion } }, { $unset: { "salonEspejos.invitacion": "" } })
        const huidas = {}
        for (const p of participantes) {
            const c = cuentas.find(x => x._id === String(p.ownerId))
            huidas[p.characterId] = Number(c?.salonEspejos?.huidas) || 0
        }
        return { ...enemy, habilidadUnica: "anfitrion", anfitrionDatos: { huidas } }
    } catch (e) {
        console.error("[Anfitrión] No se pudo revisar la activación:", e.message)
        return enemy
    }
}

/** Polvo de un Heraldo del Resplandor del personaje (tabla "combate.heraldo"). */
function polvoHeraldo(resplandor) {
    const { POLVO_BASE } = require("../../../Economia/calculadorPVEstelar")
    const { resplandorANumero } = require("../../../Economia/progresionEstelar")
    const tabla = POLVO_BASE.combate.heraldo
    return tabla[Math.min(tabla.length, resplandorANumero(resplandor ?? "I")) - 1]
}

async function darObjeto(characterId, { ID, Region }) {
    const updateInventario = require("../../../updateInventario")
    const catalogo = require("../../../catalogoObjetos")
    const def = catalogo.getObjetoPorId(Region, ID)
    if (!def) return null
    const r = await updateInventario(null, null, characterId, { isItem: true, ID, Region, Nombre: def.Nombre, cantidad: 1 })
    return r?.success ? { nombre: def.Nombre, cantidad: 1 } : null
}

/** Recompensa del ganador: la primera vez por cuenta es especial; las repeticiones, reducidas y con cooldown. */
async function recompensar(pj, ownerId, ahora) {
    const soul = await souls().findOne({ _id: Number(pj.ID) }, { projection: { "sendero.resplandor": 1 } })
    const base = polvoHeraldo(soul?.sendero?.resplandor) * ANFITRION.POLVO_X_HERALDO
    const primera = await usuarios().updateOne(
        { _id: String(ownerId), "salonEspejos.anfitrionVencido": { $ne: true } },
        { $set: { "salonEspejos.anfitrionVencido": true, "salonEspejos.vencidoEn": ahora }, $addToSet: { "salonEspejos.trofeos": "anfitrion" } }
    )
    const out = { polvo: 0, objetos: [] }
    if (primera.modifiedCount === 1) {
        out.polvo = base
        const espejo = await darObjeto(Number(pj.ID), ANFITRION.OBJETOS.ESPEJO_DE_MANO)
        if (espejo) out.objetos.push(espejo)
        out.objetos.push({ nombre: "Trofeo: El Anfitrión", cantidad: 1 })
    } else {
        const desde = ahora - ANFITRION.COOLDOWN_REPETICION_DIAS * DIA_MS
        const rep = await usuarios().updateOne(
            { _id: String(ownerId), $or: [{ "salonEspejos.ultimaRepeticion": { $exists: false } }, { "salonEspejos.ultimaRepeticion": { $lte: desde } }] },
            { $set: { "salonEspejos.ultimaRepeticion": ahora } }
        )
        if (rep.modifiedCount === 1) {
            out.polvo = Math.round(base * ANFITRION.POLVO_REPETICION)
            const esquirla = await darObjeto(Number(pj.ID), ANFITRION.OBJETOS.ESQUIRLA)
            if (esquirla) out.objetos.push(esquirla)
        }
    }
    if (out.polvo > 0) await souls().updateOne({ _id: Number(pj.ID) }, { $inc: { "nucleo.polvoEstelar": out.polvo } })
    return out
}

/**
 * Fin de un combate contra Sosias o El Anfitrión. Cuenta la pelea, reinicia o reduce el
 * contador, entrega la Invitación a quien pierde y las recompensas a quien gana (sin AFK).
 * @returns {Promise<Map<number, { polvo: number, objetos: Object[] }>>} extras por personaje
 */
async function cerrarEncuentro(sesion, { ahora = Date.now() } = {}) {
    const extras = new Map()
    if (!sesion || sesion.modeTest) return extras
    const npcs = sesion.getAllCombatientes().filter(c => c.isNPC)
    const real = npcs.find(n => n.habilidadUnica === "anfitrion")
    const conSosias = npcs.some(n => n.habilidadUnica === "sosias")
    if (!real && !conSosias) return extras
    // Jefe de prueba de un administrador: no cuenta ni premia (por el dato o por ser el NPC de prueba)
    if (real?.anfitrionDatos?.prueba || String(real?.ID || "").startsWith(ANFITRION.PRUEBA.ID)) return extras
    const pjs = sesion.getAllCombatientes().filter(c => !c.isNPC && c.ownerId)

    // Lo que el Salón aprendió de cada personaje (Espejo de Mano)
    await Promise.all(pjs.map(p => souls().updateOne(
        { _id: Number(p.ID) },
        { $set: { "salonEspejos.perfil": { usos: p.usosCategoria || {}, fecha: ahora, rival: real ? "anfitrion" : "sosias" } } }
    ).catch(() => null)))

    if (!real) {
        await Promise.all(pjs.map(p => usuarios().updateOne({ _id: String(p.ownerId) }, { $inc: { "salonEspejos.peleasSosias": 1 } }).catch(() => null)))
        return extras
    }

    const rupturado = Boolean(sesion.anfitrion?.rupturado || real.anfitrion?.rupturado)
    const vencido = real.defeated === true && !real.surrender
    for (const p of pjs) {
        try {
            const afk = p.afk === true || Boolean(sesion.esAFK?.(p.ID))
            const huyo = !rupturado && p.surrender === true
            const cuenta = await usuarios().findOne({ _id: String(p.ownerId) }, { projection: { salonEspejos: 1 } })
            const peleas = Number(cuenta?.salonEspejos?.peleasSosias) || 0
            // Ganes o pierdas, vuelve a 0; huir a tiempo solo lo reduce a la mitad
            const update = { $set: { "salonEspejos.peleasSosias": huyo ? Math.floor(peleas * ANFITRION.FACTOR_HUIDA) : 0 } }
            if (huyo) update.$inc = { "salonEspejos.huidas": 1 }
            await usuarios().updateOne({ _id: String(p.ownerId) }, update)

            const extra = { polvo: 0, objetos: [] }
            if (vencido && !afk && !p.surrender) Object.assign(extra, await recompensar(p, p.ownerId, ahora))
            else if (!huyo) {
                // Quien pierde (o queda AFK: la inactividad cuenta como derrota) recibe la Invitación
                const inv = await darObjeto(Number(p.ID), ANFITRION.OBJETOS.INVITACION)
                if (inv) extra.objetos.push(inv)
            }
            if (extra.polvo || extra.objetos.length) extras.set(Number(p.ID), extra)
        } catch (e) {
            console.error(`[Anfitrión] Error al cerrar el encuentro de ${p.ID}:`, e.message)
        }
    }
    return extras
}

/** Suma los extras del Anfitrión al mapa de recompensas que pinta la pantalla final. */
function fusionarRecompensas(rewardsMap, extras) {
    if (!rewardsMap?.recompensas || !extras?.size) return rewardsMap
    for (const [id, extra] of extras) {
        const r = rewardsMap.recompensas.get(id) || { polvo: 0, lumens: 0, loot: null, isWinner: false }
        r.polvo = (Number(r.polvo) || 0) + (extra.polvo || 0)
        r.objetos = [...(r.objetos || []), ...extra.objetos]
        rewardsMap.recompensas.set(id, r)
    }
    return rewardsMap
}

/** Aceptar la Invitación: la próxima vez que te encuentres un Sosias, será El Anfitrión. */
async function aceptarInvitacion(userId) {
    const r = await usuarios().updateOne({ _id: String(userId) }, { $set: { "salonEspejos.invitacion": true } })
    return r.matchedCount === 1
}

module.exports = { prepararEnemigo, cerrarEncuentro, fusionarRecompensas, aceptarInvitacion, polvoHeraldo }
