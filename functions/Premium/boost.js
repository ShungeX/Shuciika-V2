// functions/Premium/boost.js
// Anuncio público de un boost nuevo (con botón "Agradecer · N") y carta de Kaelion por MD.
//
// Datos en Server_db.boost_mensajes (un documento por anuncio):
//   { _id: <ID del mensaje>, canalId, boosterId, frase, imagen, cartaFallida, agradecidos: [ids], creado }
//
// Reglas del botón Agradecer:
//   - Una vez por persona y por mensaje; quien boosteó no puede pulsarlo.
//   - Sin recompensa de ningún tipo: el único premio es ver el número subir.
// Si la persona quita el boost, sus anuncios se borran del canal y de la base de datos.

const { escapeMarkdown } = require("discord.js")
const clientdb = require("../../Server")
const { crearCustomId } = require("../../utils/constructores/customId")
const { getActiveCharacter } = require("../../utils/getDataCharacters")

const anuncios = clientdb.db("Server_db").collection("boost_mensajes")

const CANAL_ANUNCIOS = "1133282192554991717"
const CANAL_BENEFICIOS = "1572109585563525120"

const IMAGEN_CARTA = "https://res.cloudinary.com/dn1cubayf/image/upload/v1794867793/1a005b21-e685-4fcc-aec2-b61b7f8c3e4b-recortada_aflwex.jpg"
const IMAGEN_SOBRE ="https://res.cloudinary.com/dn1cubayf/image/upload/v1794980116/Sobre_m%C3%A1gico_morado_en_transparencia_ljcoh7.png"

// Miniatura del anuncio: se elige una al azar. Añade aquí más URLs.
const IMAGENES = [
    "https://i.pinimg.com/originals/39/4f/b1/394fb1bd8cf9e9521e74d4d23e3d8227.gif",
]

// Frases en primera persona (voz de Shuciika). {u} se reemplaza por la mención.
const FRASES = [
    "{u} acaba de hacer boost al servidor. Siento el instituto un poquito más cálido. ♡( ◡‿◡ )",
    "Algo cambió en el aire... fue {u}. Gracias por cuidar de este lugar.",
    "Cada luz que se enciende aquí tiene un nombre, y esta es la de {u}.",
    "El instituto brilla un poquito más hoy. Gracias, {u}.",
    "{u} aparece épicamente para dejar un boost (≧◡≦)♡",
]

const ACCION_AGRADECER = "boost_agradecer"
const ACCION_CARTA = "boost_carta"

const azar = (lista) => lista[Math.floor(Math.random() * lista.length)]
const LINEA = "┅".repeat(25)

// ── Vistas ────────────────────────────────────────────────────────────────

/** Componentes V2 del anuncio público, a partir de su documento. */
function construirAnuncio(doc) {
    const total = doc.agradecidos?.length || 0
    const componentes = [
        { type: 12, items: [{ media: { url: doc.imagen } }] },
        { type: 10, content: "# Una luz nueva se enciende en el instituto..." },
        { type: 10, content: doc.frase.replaceAll("{u}", `<@${doc.boosterId}>`) },
        { type: 14 },
        {
            type: 1,
            components: [{
                type: 2,
                style: 2,
                label: `Agradecer · ${total}`,
                custom_id: crearCustomId({ action: ACCION_AGRADECER })
            }]
        }
    ]
    if (doc.cartaFallida) componentes.push({ type: 10, content: "-# la carta no se pudo recibir ＞﹏＜" })

    return [{ type: 17, components: componentes }]
}

/** Sobre cerrado que llega al MD. */
function construirSobre(userId, unix) {
    return [{
        type: 17,
        components: [
            { type: 12, items: [{ media: { url: IMAGEN_SOBRE } }] },
            {
                type: 1,
                components: [{
                    type: 2,
                    style: 2,
                    label: "Abrir carta",
                    custom_id: crearCustomId({ action: ACCION_CARTA, userId, extras: [unix] })
                }]
            }
        ]
    }]
}

/** Carta de Kaelion ya abierta. */
function construirCarta(nombre, unix) {
    const contenido = [
        "-# ˚₊‧꒰ა INSTITUTO MÁGICO SHUCIIKA ໒꒱ ‧₊˚",
        "-# Dirección · Correspondencia oficial",
        LINEA,
        `**Para:** ${nombre}`,
        "**Asunto:** Agradecimiento por tu apoyo",
        `**Fecha:** <t:${unix}:D>`,
        LINEA,
        `# ${nombre}:`,
        "Hoy llegó a mis manos una noticia pequeña que no pasó desapercibida: apoyaste este lugar con un boost.",
        "",
        "Quienes cuidan el instituto rara vez lo hacen en voz alta, así que quise escribirte yo en persona. Cada luz que se enciende en estos pasillos lleva un nombre y el tuyo ya está entre ellas.",
        "",
        "*Gracias por cuidar de este lugar.*",
        "",
        "Con gratitud,",
        "**Kaelion**",
        "-# Director del Instituto Mágico Shuciika",
        LINEA,
        `-# P. D. Tus beneficios están en <#${CANAL_BENEFICIOS}>. Si sigues con nosotros dos semanas, también podrás reclamar un lugar más para tus personajes.`
    ].join("\n")

    return [{
        type: 17,
        components: [{
            type: 9,
            accessory: { type: 11, media: { url: IMAGEN_CARTA } },
            components: [{ type: 10, content: contenido }]
        }]
    }]
}

/** Nombre del personaje activo; si no tiene, su nombre de usuario. */
async function nombreDestinatario(user) {
    const { character } = await getActiveCharacter(user.id, { character: true }).catch(() => ({ character: null }))
    const nombre = character?.perfil?.Nombre || user.globalName || user.username
    return escapeMarkdown(String(nombre))
}

// ── Flujo del boost ───────────────────────────────────────────────────────

/**
 * Boost nuevo: manda el sobre por MD y luego el anuncio al canal.
 * @param {import("discord.js").Client} client
 * @param {import("discord.js").GuildMember} member
 */
async function anunciarBoost(client, member) {
    const unix = Math.floor(Date.now() / 1000)

    let cartaFallida = false
    try {
        await member.send({ components: construirSobre(member.id, unix), flags: ["IsComponentsV2"] })
    } catch (error) {
        cartaFallida = true
        console.warn(`[boost] No se pudo mandar la carta a ${member.id}: ${error?.message || error}`)
    }

    const canal = client.channels.cache.get(CANAL_ANUNCIOS) || await client.channels.fetch(CANAL_ANUNCIOS).catch(() => null)
    if (!canal) return console.error("[boost] No se encontró el canal de anuncios")

    const doc = {
        canalId: canal.id,
        boosterId: member.id,
        frase: azar(FRASES),
        imagen: azar(IMAGENES),
        cartaFallida,
        agradecidos: [],
        creado: unix,
    }

    const mensaje = await canal.send({
        components: construirAnuncio(doc),
        flags: ["IsComponentsV2"],
        allowedMentions: { users: [member.id] },
    })
    await anuncios.insertOne({ _id: mensaje.id, ...doc })
}

/**
 * Quitó el boost: borra sus anuncios del canal y de la base de datos.
 * @param {import("discord.js").Client} client
 * @param {string} userId
 */
async function retirarBoost(client, userId) {
    const docs = await anuncios.find({ boosterId: userId }).toArray()
    for (const doc of docs) {
        const canal = client.channels.cache.get(doc.canalId) || await client.channels.fetch(doc.canalId).catch(() => null)
        await canal?.messages.delete(doc._id).catch(err => {
            // 10008: el mensaje ya no existe
            if (err?.code !== 10008) console.warn(`[boost] No se pudo borrar el anuncio ${doc._id}:`, err?.message || err)
        })
    }
    if (docs.length) await anuncios.deleteMany({ _id: { $in: docs.map(d => d._id) } })
}

// ── Botón Agradecer ───────────────────────────────────────────────────────

// Ediciones en cola por mensaje: cada una relee el contador, así dos clics simultáneos
// nunca dejan un número viejo encima de uno nuevo.
const colaEdicion = new Map()

function refrescarAnuncio(mensaje) {
    const previa = colaEdicion.get(mensaje.id) || Promise.resolve()
    const siguiente = previa.then(async () => {
        const doc = await anuncios.findOne({ _id: mensaje.id })
        if (!doc) return
        await mensaje.edit({ components: construirAnuncio(doc), flags: ["IsComponentsV2"], allowedMentions: { parse: [] } })
    }).catch(err => console.warn(`[boost] No se pudo actualizar el contador de ${mensaje.id}:`, err?.message || err))

    colaEdicion.set(mensaje.id, siguiente)
    siguiente.finally(() => { if (colaEdicion.get(mensaje.id) === siguiente) colaEdicion.delete(mensaje.id) })
}

/**
 * Registra el agradecimiento (atómico) y responde en voz de Shuciika.
 * @param {import("discord.js").ButtonInteraction} interaction
 */
async function agradecer(interaction) {
    const userId = interaction.user.id
    const mensajeId = interaction.message.id

    const resultado = await anuncios.updateOne(
        { _id: mensajeId, boosterId: { $ne: userId }, agradecidos: { $ne: userId } },
        { $push: { agradecidos: userId } }
    )

    if (!resultado.modifiedCount) {
        const doc = await anuncios.findOne({ _id: mensajeId }, { projection: { boosterId: 1 } })
        let content = "Ya le diste las gracias, yo también te lo agradezco."
        if (!doc) content = "Esta luz ya se apagó, pero gracias por pasar. ♡"
        else if (doc.boosterId === userId) content = "Esta luz es tuya, no puedes agradecerte a ti mismo/a... pero yo sí te lo agradezco. ♡( ◡‿◡ )"
        return interaction.reply({ content, flags: ["Ephemeral"] })
    }

    await interaction.reply({ content: "Se lo haré saber. ♡( ◡‿◡ )", flags: ["Ephemeral"] })
    refrescarAnuncio(interaction.message)
}

module.exports = {
    ACCION_AGRADECER,
    ACCION_CARTA,
    anunciarBoost,
    retirarBoost,
    agradecer,
    construirAnuncio,
    construirCarta,
    nombreDestinatario,
}
