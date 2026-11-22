// ─────────────────────────────────────────────────────────────────────────────
// Canales de estado: canales de voz cuyo NOMBRE muestra un dato vivo.
// Solo en Shuciika (en Navi los dos bots pelearían por el mismo nombre).
//
//   • ☀️ ⊱ 𝑆𝑜𝑙𝑒𝑎𝑑𝑜〃21:12 ⊰ |•        clima y hora del rol (Tobeya)     cada 5 min
//   • 🌎 ⊱ 𝐻𝑎𝑏𝑖𝑡𝑎𝑛𝑡𝑒𝑠: 120 ⊰ |•        miembros sin contar bots         cada 5 min
//   • 💌 ⊱ 𝐶𝑎𝑟𝑡𝑎𝑠: 17/30 ⊰ |•           inscritos / meta (dashboard)     cada 5 min
//   • 🌠 ⊱ 𝐸𝑠𝑡𝑎𝑑𝑜: 💚 (0.5) ⊰ |•        versión del bot                  solo al arrancar
//
// El texto va siempre en cursiva matemática (𝑁𝑜𝑐ℎ𝑒); los números y símbolos no.
// Discord deja renombrar un canal 2 veces cada 10 min: solo se edita si el nombre
// cambió y nunca se encola una edición sobre otra del mismo canal.
//
// Meta de cartas: Server_db.config { _id: "canalesEstado", metaCartas }.
// Inscritos: personas (ownerID distinto) con ficha verificada que no están Inactivo.
// ─────────────────────────────────────────────────────────────────────────────
const clientdb = require("../Server")
const entorno = require("../config/entorno")
const { guild: GUILD_ID } = require("../config/configslash.json")

const CANALES = {
    hora: "1573952890031050902",
    habitantes: "728072007857471559",
    cartas: "728072382031593553",
    estado: "717119494434324522",
}
const REGION = "TOB-001"
const CADA_MS = 5 * 60 * 1000
const META_POR_DEFECTO = 30
const ID_CONFIG = "canalesEstado"

const configCol = () => clientdb.db("Server_db").collection("config")
const personajes = () => clientdb.db("Rol_db").collection("Personajes")

// ─── Cursiva ─────────────────────────────────────────────────────────────────
// Mathematical Italic: A-Z desde U+1D434, a-z desde U+1D44E. La "h" no existe en
// ese bloque y se usa ℎ (U+210E). Las letras con acento se separan (NFD) y la
// tilde queda como marca combinada sobre la letra en cursiva: 𝐷𝑖́𝑎.
function cursiva(texto) {
    return [...String(texto).normalize("NFD")].map((ch) => {
        const c = ch.codePointAt(0)
        if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D434 + c - 65)
        if (c === 104) return "ℎ"
        if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D44E + c - 97)
        return ch
    }).join("").normalize("NFC")
}

const formato = (emoji, contenido) => `• ${emoji} ⊱ ${contenido} ⊰ |•`

// ─── Datos de cada canal ─────────────────────────────────────────────────────
const EMOJI_CLIMA = {
    Soleado: "☀️", Caluroso: "🔥", Ventoso: "🍃", Nublado: "☁️", Lluvioso: "🌧️",
    Granizada: "🧊", Tormenta: "⛈️", Nevada: "🌨️", Niebla: "🌫️",
}
const ES_DE_NOCHE = new Set(["Noche", "Madrugada"])

async function nombreHora() {
    const est = await require("./Clima").getEstado(REGION)
    const clima = est.estado || est.estadoNatural || "Soleado"
    let emoji = EMOJI_CLIMA[clima] || "🌤️"
    if (clima === "Soleado" && ES_DE_NOCHE.has(est.fase)) emoji = "🌙"
    const hora = `${String(est.horaDelDia).padStart(2, "0")}:${String(est.minuto ?? 0).padStart(2, "0")}`
    return formato(emoji, `${cursiva(clima)}〃${hora}`)
}

async function contarHabitantes(guild) {
    // Con la lista completa en caché se cuenta exacto; si no, se pide una vez
    if (guild.members.cache.size < guild.memberCount) await guild.members.fetch().catch(() => null)
    return guild.members.cache.filter((m) => !m.user.bot).size
}

async function nombreHabitantes(guild) {
    return formato("🌎", `${cursiva("Habitantes")}: ${await contarHabitantes(guild)}`)
}

async function leerMeta() {
    const doc = await configCol().findOne({ _id: ID_CONFIG })
    const n = Number(doc?.metaCartas)
    return Number.isInteger(n) && n > 0 ? n : META_POR_DEFECTO
}

async function contarInscritos() {
    const ids = await personajes().distinct("ownerID", { Inactivo: { $ne: true }, ownerID: { $exists: true, $ne: null } })
    return ids.length
}

async function nombreCartas() {
    const [inscritos, meta] = await Promise.all([contarInscritos(), leerMeta()])
    return formato("💌", `${cursiva("Cartas")}: ${inscritos}/${meta}`)
}

function nombreEstado() {
    const bruta = String(require("../config").version ?? "")
    const version = bruta.match(/\d+(?:\.\d+)*/)?.[0] || bruta.trim() || "?"
    return formato("🌠", `${cursiva("Estado")}: 💚 (${version})`)
}

// ─── Edición ─────────────────────────────────────────────────────────────────
const enCurso = new Set()

/** Renombra el canal si el nombre cambió. Devuelve el nombre puesto, o null. */
async function aplicar(client, clave, construir) {
    if (enCurso.has(clave)) return null
    enCurso.add(clave)
    try {
        const canal = await client.channels.fetch(CANALES[clave]).catch(() => null)
        if (!canal?.setName) return null
        const nombre = (await construir(canal.guild)).slice(0, 100)
        if (canal.name === nombre) return null
        await canal.setName(nombre, "Canal de estado")
        return nombre
    } catch (e) {
        console.warn(`[CanalesEstado] No se pudo actualizar «${clave}»:`, e?.message || e)
        return null
    } finally {
        enCurso.delete(clave)
    }
}

const CONSTRUCTORES = {
    hora: () => nombreHora(),
    habitantes: (guild) => nombreHabitantes(guild),
    cartas: () => nombreCartas(),
    estado: () => nombreEstado(),
}

/** Actualiza uno de los canales ya mismo (p. ej. al guardar la meta en el dashboard). */
function actualizar(client, clave) {
    if (!entorno.esShuciika || !client || !CONSTRUCTORES[clave]) return Promise.resolve(null)
    return aplicar(client, clave, CONSTRUCTORES[clave])
}

let intervalo = null
function iniciar(client) {
    if (!entorno.esShuciika) {
        console.log(`⏸️ [${entorno.etiqueta}] Canales de estado desactivados: solo los edita Shuciika.`)
        return
    }
    if (intervalo) return
    // Versión: solo al arrancar
    actualizar(client, "estado")
    const ciclo = () => {
        for (const clave of ["hora", "habitantes", "cartas"]) actualizar(client, clave)
    }
    ciclo()
    intervalo = setInterval(ciclo, CADA_MS)
    intervalo.unref?.()
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
async function resumen() {
    const [inscritos, meta] = await Promise.all([contarInscritos(), leerMeta()])
    return { metaCartas: meta, inscritos, activo: entorno.esShuciika, canales: CANALES }
}

async function guardarMeta(valor) {
    const n = Number(valor)
    if (!Number.isInteger(n) || n < 1 || n > 100000) throw Object.assign(new Error("La meta debe ser un número entero entre 1 y 100000."), { status: 400 })
    await configCol().updateOne({ _id: ID_CONFIG }, { $set: { metaCartas: n } }, { upsert: true })
    return n
}

module.exports = { iniciar, actualizar, resumen, guardarMeta, cursiva, nombreEstado, CANALES, GUILD_ID }
