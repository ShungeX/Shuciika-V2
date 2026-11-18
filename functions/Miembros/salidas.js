// functions/Miembros/salidas.js
// Despedida (Components V2) y qué pasa con los personajes cuando alguien sale o vuelve.
// Los personajes ya NO se borran: se marcan con `Inactivo: true` y se reactivan al volver. Solo se borra la ficha en caché (CachePJ).

const { EmbedBuilder, escapeMarkdown } = require("discord.js")
const cloudinary = require("cloudinary").v2
const clientdb = require("../../Server")

const userdb = clientdb.db("Server_db").collection("usuarios_server")
const rolDb = clientdb.db("Rol_db")
const personajesDb = rolDb.collection("Personajes")
const cacheDb = rolDb.collection("CachePJ")

const CANAL_DESPEDIDA = "716342375743488052"
const AVATAR_POR_DEFECTO = "https://res.cloudinary.com/dn1cubayf/image/upload/v1727127018/Resources/unknowncharacter.png"

const GIFS_ADIOS = [
    "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/09/62/BeE5PrcxNso1LTw00OE.gif",
    "https://static2.klipy.com/ii/71b2873e478b9d8d0482ea3ec777ba7f/f2/68/SN3aiEvR.gif",
    "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/43/ca/YlypFFOcgMlyr64RNf.gif",
    "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/d0/49/5q3X0UeQMpNoEOUFa.gif",
]

// Sin culpar ni pedir que vuelva
const FRASES_ADIOS = [
    "Esperamos que su tiempo aquí haya sido tan mágico como lo imaginaba.",
    "Las puertas del Instituto seguirán abiertas, por si algún día quiere volver.",
    "Que los caminos que siga le lleven a buenas historias.",
    "Se lleva un poco de este lugar, y deja un poco de sí aquí.",
    "Cada quien escribe su propia historia; la suya pasó por aquí.",
]

// ─── Aleatorio sin repetir el anterior ─────────────────────────────────────────

const ultimos = new Map()
function elegir(lista, clave) {
    if (lista.length <= 1) return lista[0]
    let i
    do { i = Math.floor(Math.random() * lista.length) } while (i === ultimos.get(clave))
    ultimos.set(clave, i)
    return lista[i]
}

// ─── Límite de despedidas por minuto (salidas masivas) ─────────────────────────

const LIMITE_POR_MINUTO = 4
const enviadas = []

/** Reserva un hueco en la ventana del último minuto. false si ya se enviaron 4. */
function reservarDespedida() {
    const ahora = Date.now()
    while (enviadas.length && ahora - enviadas[0] >= 60_000) enviadas.shift()
    if (enviadas.length >= LIMITE_POR_MINUTO) return false
    enviadas.push(ahora)
    return true
}

// ─── Mensaje ───────────────────────────────────────────────────────────────────

function construirDespedida(member) {
    const nombre = escapeMarkdown(member.displayName ?? member.user.globalName ?? member.user.username)
    const contador = member.guild?.memberCount ?? "?"

    return [
        {
            type: 17,
            accent_color: 613239,
            spoiler: false,
            components: [
                {
                    type: 9,
                    accessory: {
                        type: 11,
                        media: { url: member.user.displayAvatarURL({ extension: "png", size: 256 }) },
                        description: null,
                        spoiler: false
                    },
                    components: [
                        { type: 10, content: "# Hasta pronto <:TSH_Nokotansigma:1329921474810875934>" },
                        {
                            type: 10,
                            content: `-# Instituto Mágico Shuciika · シュシカ ・ NIX\n\n**${nombre}** recogió sus cosas y cruzó las puertas del Instituto... (｡•́︿•̀｡)\n\n${elegir(FRASES_ADIOS, "frase")}`
                        }
                    ]
                },
                { type: 14, divider: true, spacing: 1 },
                {
                    type: 12,
                    items: [{ media: { url: elegir(GIFS_ADIOS, "gif") }, description: null, spoiler: false }]
                },
                { type: 14, divider: true, spacing: 1 },
                { type: 10, content: `-# Sin esa persona ahora somos ${contador} magos (╥_╥)` }
            ]
        }
    ]
}

/** Publica la despedida respetando el límite por minuto. Devuelve false si se omitió. */
async function enviarDespedida(client, member) {
    if (!reservarDespedida()) {
        console.log(`[despedida] Límite de ${LIMITE_POR_MINUTO}/min alcanzado: se omite la despedida de ${member.id}`)
        return false
    }
    const canal = client.channels.cache.get(CANAL_DESPEDIDA) ?? await client.channels.fetch(CANAL_DESPEDIDA).catch(() => null)
    if (!canal) return false

    await canal.send({ components: construirDespedida(member), flags: ["IsComponentsV2"], allowedMentions: { parse: [] } })
    return true
}

// ─── Personajes ────────────────────────────────────────────────────────────────

/** Filtro de Personajes de un usuario: los ids de su nix.personajes (número o texto) y, de respaldo, su ownerID. */
function filtroPersonajes(userId, usuario) {
    const ids = (usuario?.nix?.personajes ?? [])
        .map(p => p?.id ?? p?._id)
        .filter(id => id !== undefined && id !== null)
    const variantes = ids.flatMap(id => {
        const n = Number(id)
        return isNaN(n) ? [String(id)] : [n, String(id)]
    })
    return { $or: [{ _id: { $in: variantes } }, { ownerID: String(userId) }] }
}

/**
 * Marca todos los personajes del usuario como inactivos (usuarios_server.nix.personajes y Rol_db.Personajes).
 * @returns {Promise<object[]>} Los personajes marcados (para el registro del staff)
 */
async function marcarInactivos(userId) {
    const id = String(userId)
    const usuario = await userdb.findOne({ _id: id })

    if (usuario?.nix?.personajes?.length) {
        await userdb.updateOne({ _id: id }, { $set: { "nix.personajes.$[].Inactivo": true } })
    }

    const filtro = filtroPersonajes(id, usuario)
    const personajes = await personajesDb.find(filtro, { projection: { Nombre: 1, Apodo: 1, ID: 1 } }).toArray()
    if (personajes.length) await personajesDb.updateMany(filtro, { $set: { Inactivo: true } })
    return personajes
}

/** Al volver al servidor: quita el flag Inactivo de todos sus personajes. Devuelve cuántos se reactivaron en Personajes. */
async function reactivarPersonajes(userId) {
    const id = String(userId)
    const usuario = await userdb.findOne({ _id: id })

    if (usuario?.nix?.personajes?.some(p => p?.Inactivo)) {
        await userdb.updateOne({ _id: id }, { $unset: { "nix.personajes.$[].Inactivo": "" } })
    }

    const res = await personajesDb.updateMany(
        { ...filtroPersonajes(id, usuario), Inactivo: { $exists: true } },
        { $unset: { Inactivo: "" } }
    )
    return res.modifiedCount
}

/** Public ID de Cloudinary a partir de la URL (quita la versión "v123" y la extensión). */
function publicIdDe(url) {
    const partes = url?.split("/upload/")[1]?.split("/")
    if (!partes?.length) return null
    if (/^v\d+$/.test(partes[0])) partes.shift()
    return partes.join("/").replace(/\.[^/.]+$/, "")
}

/** La ficha en proceso (CachePJ) sí se borra, con su avatar. Devuelve la ficha borrada o null. */
async function borrarFichaEnCache(userId) {
    const id = String(userId)
    const ficha = await cacheDb.findOne({ _id: id })
    if (!ficha) return null

    if (ficha.avatarURL && ficha.avatarURL !== AVATAR_POR_DEFECTO) {
        const publicId = publicIdDe(ficha.avatarURL)
        if (publicId) await cloudinary.uploader.destroy(publicId).catch(e => console.error("[despedida] No se pudo borrar el avatar de la ficha:", e))
    }
    await cacheDb.deleteOne({ _id: id })
    // El mensaje temporal de la ficha ya no existe
    await userdb.updateOne({ _id: id }, { $unset: { fichaStatus: "" } }).catch(() => { })
    return ficha
}

/** Registro para el staff de lo que pasó con los personajes de quien salió. */
function embedPersonajesInactivos(member, personajes) {
    const lista = personajes.map(p => `・ **${p.Nombre ?? "Sin nombre"}**${p.Apodo ? ` [${p.Apodo}]` : ""} · ID ${p.ID ?? p._id}`).join("\n")
    return new EmbedBuilder()
        .setTitle("Personajes marcados como inactivos")
        .setDescription(`<@${member.id}> salió del servidor. Sus personajes se conservan con \`Inactivo: true\` y se reactivan si vuelve.\n\n${lista}`.slice(0, 4096))
        .setColor("Orange")
        .setTimestamp()
}

module.exports = {
    construirDespedida,
    enviarDespedida,
    marcarInactivos,
    reactivarPersonajes,
    borrarFichaEnCache,
    embedPersonajesInactivos,
}
