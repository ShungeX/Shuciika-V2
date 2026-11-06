// ─────────────────────────────────────────────────────────────────────────────
// Easter egg: cuando dos personajes se devuelven golpes más veces que
// UMBRAL_DUELO[tipo] en el mismo mensaje, la cosa escala a un DUELO AMISTOSO.
//
// Reglas del duelo automático:
//   • Amistoso: tipo "amistoso" del sistema de duelos (los efectos no se quedan),
//     PvP sin apuestas → rewardCalculator no da Polvo, Fragmentos ni nada.
//   • Nunca admite apuestas (los Lumens no se congelan en un duelo que nadie armó).
//   • Rendirse está disponible como en cualquier duelo.
//   • Reutiliza duelSystem / sesionesCombate; no hay un sistema nuevo.
//
// Si algo lo impide, la cadena termina con un cierre amable de Shuciika. Los
// textos NO dicen cuál fue el motivo cuando es privado (privacidad, bloqueo):
// el otro jugador no debe enterarse de que lo bloquearon.
// ─────────────────────────────────────────────────────────────────────────────
const clientdb = require("../../Server")
const cfg = require("../../config/amistad")
const transaccionCache = require("../../utils/cache")
const { duelSystem } = require("../Duelo/duelManager")
const { evaluarPermisoPrivacidad } = require("../privacidad")
const { buildPjFilter } = require("../../utils/getDataCharacters")
const { coleccion: amistades, idPareja } = require("./amistades")
const { FIRMA, FIRMA_NEGATIVA } = require("./reglasAmistad")

const dbRol = clientdb.db("Rol_db")
const souls = dbRol.collection("Soul")
const clases = dbRol.collection("Clases")

const nombrePj = (pj) => pj?.perfil?.Nombre || "Alguien"
const ownerDe = (pj) => String(pj?.ownerID ?? pj?.ownerId ?? "")

const CIERRES = {
    // Genérico: también cubre privacidad y bloqueos, sin delatarlos.
    no_es_momento: `Se miran con ganas, pero no es el momento ${FIRMA_NEGATIVA}`,
    hp0: `Se miran con ganas, pero alguien necesita recuperar fuerzas primero ${FIRMA}`,
    ocupado: `Se miran con ganas, pero alguno de los dos tiene otros asuntos ahora mismo ${FIRMA}`,
    sin_alma: `Se miran con ganas, pero alguno de los dos aún no ha despertado su poder ${FIRMA}`,
    enfriamiento: `Se miran con ganas, pero ya pelearon hace nada. Mejor un respiro ${FIRMA}`,
    md_cerrados: `Se miran con ganas, pero no logro mandarle los detalles del duelo a alguno de los dos ${FIRMA_NEGATIVA}\n-# Revisen que tengan los mensajes directos abiertos`,
}

const GIFS_DUELO = [
    "https://c.tenor.com/OFsN3R89BIEAAAAd/tenor.gif",
    "https://c.tenor.com/cYSjqD3730UAAAAd/tenor.gif",
    "https://c.tenor.com/dpyPyzrwXzYAAAAd/tenor.gif",
    "https://c.tenor.com/jCA_9r3vL6EAAAAC/tenor.gif",
]

const hpCero = (soul) => !!soul && (Number(soul.nucleo?.HP) || 0) <= 0

async function obtenerAlma(pjId) {
    const filtro = buildPjFilter(pjId)
    return filtro ? souls.findOne(filtro) : null
}

/** ¿Está en exploración, en clase, en una sala o ya peleando? */
async function estaOcupado(pj) {
    const id = pj._id
    if (duelSystem.estaEnCombate(id) || await duelSystem.personajeEnDuelo(id)) return true
    if (transaccionCache.getStatus(id)) return true   // sala de duelo en espera

    const userCache = transaccionCache.getUser?.(ownerDe(pj))
    if (userCache?.explorarID && transaccionCache.get(userCache.explorarID)) return true

    const ids = [Number(id), String(id)]
    const enClase = await clases.findOne(
        { estado: "en_curso", $or: [{ profesorId: { $in: ids } }, { "inscritos.personajeId": { $in: ids } }] },
        { projection: { _id: 1 } }
    ).catch(() => null)
    return !!enClase
}

/** Confirma que se le pueden mandar MD (la UI de combate va por MD). Igual que el reto directo. */
async function puedeRecibirMD(client, ownerId) {
    try {
        const user = await client.users.fetch(ownerId)
        const m = await user.send({ content: "-# Mensaje de comprobación para el duelo\n-# **Se borra en unos segundos**", flags: ["SuppressNotifications"] })
        setTimeout(() => m.delete().catch(() => { }), 3000)
        return true
    } catch {
        return false
    }
}

/**
 * Revisa TODO lo que impide el duelo. El orden importa poco: cualquiera corta.
 * @returns {Promise<{ ok: true, almas: object[] } | { ok: false, motivo: string, texto: string }>}
 */
async function verificarDuelo(client, pjA, pjB, ahora = Date.now()) {
    const no = (motivo) => ({ ok: false, motivo, texto: CIERRES[motivo] || CIERRES.no_es_momento })

    // 1. HP = 0 (y sin alma no hay con qué pelear)
    const [almaA, almaB] = await Promise.all([obtenerAlma(pjA._id), obtenerAlma(pjB._id)])
    if (!almaA || !almaB) return no("sin_alma")
    if (hpCero(almaA) || hpCero(almaB)) return no("hp0")

    // 2. Ya en combate, exploración o clase
    if (await estaOcupado(pjA) || await estaOcupado(pjB)) return no("ocupado")

    // 3 y 4. Privacidad de Combate (pvp) en AMBOS sentidos. evaluarPermisoPrivacidad
    // revisa primero los bloqueados (el bloqueo gana siempre). El duelo automático
    // no puede ser la puerta trasera de esa configuración.
    const [aPermiteB, bPermiteA] = await Promise.all([
        evaluarPermisoPrivacidad(pjA, pjB, "pvp", dbRol),
        evaluarPermisoPrivacidad(pjB, pjA, "pvp", dbRol),
    ])
    if (!aPermiteB || !bPermiteA) return no("no_es_momento")

    // 5. Cooldown de duelos recientes entre la misma pareja
    const pareja = await amistades.findOne({ _id: idPareja(pjA._id, pjB._id) }, { projection: { ultimoDuelo: 1 } })
    const ultimo = pareja?.ultimoDuelo ? new Date(pareja.ultimoDuelo).getTime() : 0
    if (ultimo && ahora - ultimo < cfg.ENFRIAMIENTO_DUELO_MS) return no("enfriamiento")

    // La UI del combate se manda por MD: sin MD el duelo no podría jugarse.
    const [mdA, mdB] = await Promise.all([puedeRecibirMD(client, ownerDe(pjA)), puedeRecibirMD(client, ownerDe(pjB))])
    if (!mdA || !mdB) return no("md_cerrados")

    return { ok: true, almas: [almaA, almaB] }
}

/**
 * Crea la sesión de combate (mismo camino que el reto directo de duelStart.js).
 * @returns {Promise<boolean>}
 */
async function iniciarDueloAmistoso(client, pjA, pjB, [almaA, almaB], ahora = Date.now()) {
    const { Personaje } = require("../Duelo/combatientes")
    const combateUI = require("../Duelo/combateUI")
    const TurnProcessor = require("../Duelo/turnProcessor")

    const crear = (pj, alma) => new Personaje(Number(pj._id), {
        ownerId: ownerDe(pj),
        perfil: pj.perfil,
        nucleo: alma.nucleo,
        stats: alma.stats,
        dominio: alma.dominio,
        sendero: alma.sendero,
    })

    const sesion = duelSystem.crearSesion({
        duelType: "amistoso",
        teams: [[crear(pjA, almaA)], [crear(pjB, almaB)]],
        apuestas: null,          // nunca: ver cabecera
        tipoApuesta: null,
    })
    if (!sesion) return false

    // Se marca antes de arrancar para que un doble disparo no abra dos duelos.
    await amistades.updateOne({ _id: idPareja(pjA._id, pjB._id) }, { $set: { ultimoDuelo: new Date(ahora) } }).catch(() => { })

    sesion.state = "ACTIVO"
    sesion.addLog("inicio", "El duelo amistoso ha comenzado")
    await combateUI.update(sesion, client)

    const primero = sesion.getCurrentActor()
    if (primero && (primero.isNPC || primero.activeCast)) await TurnProcessor.advanceCompas(sesion, null)
    else sesion.iniciarWatchdogTurno(client)
    return true
}

/** Texto del anuncio que reemplaza al menú de la interacción. */
function anuncioDuelo(pjA, pjB) {
    return [
        `**Creo que la cosa ya se calentó...** (ง •̀_•́)ง`,
        `¡**${nombrePj(pjA)}** y **${nombrePj(pjB)}** van a resolverlo en un duelo amistoso!`,
        `-# Sin recompensas ni apuestas; si alguien quiere parar, puede rendirse cuando quiera ＞﹏＜`,
        `-# Pueden espectear en <#${cfg.CANAL_DUELOS}>`,
    ].join("\n")
}

const gifDuelo = () => GIFS_DUELO[Math.floor(Math.random() * GIFS_DUELO.length)]

/** Hook para el futuro bonus entre Rivales (no implementado). */
// TODO(decisión): bonus de duelo entre Rivales → ver reglasAmistad.bonusDueloRivales.

module.exports = { verificarDuelo, iniciarDueloAmistoso, anuncioDuelo, gifDuelo, obtenerAlma, hpCero, CIERRES }
