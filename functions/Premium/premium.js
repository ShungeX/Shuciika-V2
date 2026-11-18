// functions/Premium/premium.js
// Fuente única de verdad para las funciones premium (boost / support) del servidor.
// Cualquier función exclusiva debe preguntar aquí en vez de comparar IDs de rol por su cuenta.
//
// Es premium quien cumpla CUALQUIERA de estas condiciones:
//   - Tiene el rol Boost (BoostMagico) o el rol Support en el servidor
//   - Hace un boost real al servidor de Discord (premiumSince)
//   - Es la ID autorizada (dueño) o staff (admin/mod)
//   - Respaldo para datos antiguos: marca `isBooster` o `roles: ["booster"]` en usuarios_server

const GUILD_ID = "716342375303217285"

const ROL_BOOST = "796205038665072661"      // Boost: BoostMagico
const ROL_SUPPORT = "1572064242817957898"   // Support
const ROLES_PREMIUM = [ROL_BOOST, ROL_SUPPORT]

const ROL_EX_SUPPORT = "1572101786444234812" // "Si apoyaste alguna vez": se conserva para siempre

// Límites que dependen del premium (el dashboard usa los mismos números)
const LIMITES = {
    galeriaLibre: 3,       // imágenes visibles en la galería sin premium
    galeriaPremium: 10     // con premium; si se pierde, las extras se ocultan sin borrarse
}

const ROLES_ADMIN = ["737058095599058995", "746581152717865041"]
const ID_AUTORIZADA = "665421882694041630"

/** Rol premium (Boost o Support) o boost real de Discord, sobre un GuildMember ya obtenido. */
function esPremiumMiembro(member) {
    if (!member) return false
    if (member.premiumSince) return true
    const roles = member.roles?.cache
    return !!roles && ROLES_PREMIUM.some(id => roles.has(id))
}

/** Admin/mod por rol de Discord, sobre un GuildMember ya obtenido. */
function esAdminMiembro(member) {
    const roles = member?.roles?.cache
    return !!roles && ROLES_ADMIN.some(id => roles.has(id))
}

/** Respaldo con el documento de usuarios_server (datos antiguos o marcados a mano). */
function esPremiumPorDocumento(usuarioServer) {
    if (!usuarioServer) return false
    if (usuarioServer.isBooster === true) return true
    const roles = Array.isArray(usuarioServer.roles) ? usuarioServer.roles.map(String) : []
    return roles.includes("booster") || [...ROLES_PREMIUM, ...ROLES_ADMIN].some(id => roles.includes(id))
}

/** Miembro del servidor (caché primero, luego API). null si no está o no hay cliente. */
async function obtenerMiembro(client, discordID) {
    const guild = client?.guilds?.cache?.get(GUILD_ID)
    if (!guild || !discordID) return null
    const id = String(discordID)
    return guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null)
}

/**
 * ¿Esta persona tiene acceso a las funciones premium?
 * @param {import("discord.js").Client|null} client
 * @param {string} discordID
 * @param {{ usuarioServer?: Object|null, member?: Object|null }} [opciones] - si ya los tienes, evita consultas
 */
async function esPremium(client, discordID, { usuarioServer = null, member = null } = {}) {
    if (!discordID) return false
    const id = String(discordID)
    if (id === ID_AUTORIZADA) return true
    if (esPremiumPorDocumento(usuarioServer)) return true

    const miembro = member || await obtenerMiembro(client, id)
    return esPremiumMiembro(miembro) || esAdminMiembro(miembro)
}

// ── Límite de personajes de los beneficios "en rol" ─────────────────────────────────────────
// Los beneficios en rol (segundo puesto de trabajo, mejoras de sala, cartelera, galería ampliada)
// aplican hasta a 2 personajes que la persona elige y puede cambiar una vez cada 30 días.
// En los demás personajes esos beneficios se ocultan, no se pierden. Los beneficios fuera de rol
// (etiqueta, banner, perfil brillante) no tienen límite. El staff y la ID autorizada no tienen límite.
//
// Datos en usuarios_server:
//   apoyo.personajes        ids elegidos (strings)
//   apoyo.personajesCambio  segundos UNIX del último cambio (el primero no espera)

const MAX_PERSONAJES_BENEFICIO = 2
const DIAS_CAMBIO_PERSONAJES = 30

/** Ids (string) de los personajes que tiene registrados la persona, en orden de registro. */
function idsPersonajes(usuarioServer) {
    const lista = Array.isArray(usuarioServer?.nix?.personajes) ? usuarioServer.nix.personajes : []
    return lista.map(p => (p && typeof p === "object" ? p.id : p)).filter(id => id !== undefined && id !== null).map(String)
}

/**
 * Personajes con beneficios en rol. Si tiene 2 o menos, todos. Si eligió, su elección (solo los que aún tiene).
 * Si aún no eligió, los 2 primeros que registró.
 */
function personajesConBeneficio(usuarioServer) {
    const propios = idsPersonajes(usuarioServer)
    if (propios.length <= MAX_PERSONAJES_BENEFICIO) return propios
    const elegidos = (Array.isArray(usuarioServer?.apoyo?.personajes) ? usuarioServer.apoyo.personajes : [])
        .map(String).filter(id => propios.includes(id))
    const unicos = [...new Set(elegidos)].slice(0, MAX_PERSONAJES_BENEFICIO)
    return unicos.length ? unicos : propios.slice(0, MAX_PERSONAJES_BENEFICIO)
}

/** Cuándo podrá volver a cambiar su elección (segundos UNIX) o null si ya puede. */
function proximoCambioPersonajes(usuarioServer, ahora = Math.floor(Date.now() / 1000)) {
    const ultimo = Number(usuarioServer?.apoyo?.personajesCambio) || 0
    if (!ultimo) return null
    const siguiente = ultimo + DIAS_CAMBIO_PERSONAJES * 86400
    return siguiente > ahora ? siguiente : null
}

/** Staff o ID autorizada: tienen premium por su cargo y sin límite de personajes. */
function esStaffPremium(discordID, usuarioServer, member) {
    if (String(discordID) === ID_AUTORIZADA) return true
    if (esAdminMiembro(member)) return true
    const roles = Array.isArray(usuarioServer?.roles) ? usuarioServer.roles.map(String) : []
    return ROLES_ADMIN.some(id => roles.includes(id))
}

/**
 * ¿Este personaje recibe los beneficios en rol? Premium del dueño + personaje dentro de sus elegidos.
 * @param {any} client
 * @param {string} discordID - dueño del personaje
 * @param {string|number} characterId
 * @param {{ usuarioServer: Object|null, member?: Object|null }} opciones - usuarioServer con nix y apoyo
 */
async function esPremiumEnPersonaje(client, discordID, characterId, { usuarioServer = null, member = null } = {}) {
    if (!discordID || characterId === undefined || characterId === null) return false
    const miembro = member || await obtenerMiembro(client, discordID)
    if (!await esPremium(client, discordID, { usuarioServer, member: miembro })) return false
    if (esStaffPremium(discordID, usuarioServer, miembro)) return true
    return personajesConBeneficio(usuarioServer).includes(String(characterId))
}

module.exports = {
    GUILD_ID,
    MAX_PERSONAJES_BENEFICIO,
    DIAS_CAMBIO_PERSONAJES,
    idsPersonajes,
    personajesConBeneficio,
    proximoCambioPersonajes,
    esStaffPremium,
    esPremiumEnPersonaje,
    ROL_BOOST,
    ROL_SUPPORT,
    ROLES_PREMIUM,
    ROL_EX_SUPPORT,
    LIMITES,
    ROLES_ADMIN,
    ID_AUTORIZADA,
    esPremium,
    esPremiumMiembro,
    esAdminMiembro,
    esPremiumPorDocumento,
    obtenerMiembro
}
