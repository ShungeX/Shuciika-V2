// functions/Premium/apoyo.js
// Etiqueta de apoyo ("Support") del perfil: en qué estado está alguien y qué texto se muestra.
// Es solo cosmética. Nunca expone a otros el tipo de apoyo (boost, mensual, donación) ni montos.
//
// El estado es POR USUARIO (sale de sus roles de Discord y de usuarios_server), no por personaje:
// todos los personajes de alguien que apoya muestran la etiqueta. Todavía no existe el límite de
// "2 personajes elegidos" de los beneficios de apoyo.
//
// Datos en usuarios_server:
//   apoyo.primeraVez  segundos UNIX de la primera vez que el bot le vio apoyando (o su boost real, si es anterior)
//   apoyoEstilo       { modo, paleta, posicion, mostrarEtiqueta } → ver apoyoEstilo.js (valores por defecto al leer)
//
// Sin require de Server.js: quien llama pasa la colección, así Server.js y el bot pueden usarlo sin ciclos.

const premium = require("./premium")
const estilos = require("./apoyoEstilo")
const { MENSAJES_DUEÑO, MENSAJES_VISITANTE, ETIQUETA } = require("../../data/apoyo/mensajes")

// Tope total de caracteres de los text displays de Components V2 en un mensaje
const LIMITE_TEXTO_V2 = 4000
// Máximo de letras con degradado por línea: si el texto es más largo se usa texto normal (no se recorta)
const MAX_DEGRADADO_NOMBRE = 48
const MAX_DEGRADADO_PIE = 64

/**
 * 'activo'     → tiene el rol Boost (BoostMagico) o Support, o hace boost real al servidor
 * 'alguna_vez' → tiene el rol de ex-supporter, o el bot ya registró que apoyó (donación única o apoyo terminado)
 * 'ninguno'    → nunca apoyó
 * Staff y la ID autorizada NO cuentan: la etiqueta es solo para quienes apoyan.
 * @param {Object|null} usuario - documento de usuarios_server
 * @param {import("discord.js").GuildMember|null} member - miembro del servidor (sus roles son la fuente real)
 * @returns {'activo'|'alguna_vez'|'ninguno'}
 */
function estadoApoyo(usuario, member = null) {
    if (premium.esPremiumMiembro(member)) return "activo"
    const apoyo = usuario?.apoyo || {}
    if (member?.roles?.cache?.has(premium.ROL_EX_SUPPORT)) return "alguna_vez"
    if (apoyo.primeraVez || apoyo.slotEntregado || apoyo.slotPendiente) return "alguna_vez"
    return "ninguno"
}

/**
 * Estado de apoyo del dueño de un personaje, con su estilo y la fecha desde la que apoya.
 * Si apoya y aún no hay fecha (o su boost real es anterior), la guarda sin esperar. Nunca lanza.
 * @param {{ client: any, ownerID: string, usuarioServer?: Object|null, coleccion?: any }} p
 * @returns {Promise<{ estado: string, desde: number|null, estilo: Object, nombreDueño: string|null }>}
 */
async function obtenerApoyo({ client, ownerID, usuarioServer = null, coleccion = null }) {
    const vacio = { estado: "ninguno", desde: null, estilo: estilos.leerApoyoEstilo(usuarioServer), nombreDueño: null }
    if (!ownerID) return vacio
    try {
        const id = String(ownerID)
        const member = await premium.obtenerMiembro(client, id)
        const estado = estadoApoyo(usuarioServer, member)
        const guardada = Number(usuarioServer?.apoyo?.primeraVez) || null
        let desde = guardada

        if (estado === "activo") {
            const boostReal = member?.premiumSince ? Math.floor(member.premiumSince.getTime() / 1000) : null
            const candidata = boostReal ?? Math.floor(Date.now() / 1000)
            if (!guardada || candidata < guardada) {
                desde = candidata
                coleccion?.updateOne({ _id: id }, { $min: { "apoyo.primeraVez": candidata } }, { upsert: true })
                    ?.catch?.(err => console.warn("[apoyo] No se pudo guardar primeraVez:", err?.message || err))
            }
        }

        return { estado, desde: estado === "ninguno" ? null : desde, estilo: estilos.leerApoyoEstilo(usuarioServer), nombreDueño: member?.displayName || null }
    } catch (err) {
        console.warn("[apoyo] No se pudo resolver el estado de apoyo:", err?.message || err)
        return vacio
    }
}

/** Elige un mensaje no vacío del pool, o "" si no hay ninguno. */
function mensajeAlAzar(pool, azar = Math.random) {
    const validos = (pool || []).map(m => String(m ?? "").trim()).filter(Boolean)
    if (!validos.length) return ""
    return validos[Math.min(validos.length - 1, Math.floor(azar() * validos.length))]
}

/** Degradado con tope de letras: si el texto limpio es más largo que el tope, null (se usa texto normal). */
function degradadoSinRecorte(texto, paleta, max) {
    const limpio = estilos.sanitizarTexto(texto)
    if ([...limpio].length > max) return null
    return estilos.degradadoSeguro(limpio, paleta, max)
}

/**
 * Piezas de texto de la tarjeta de /rol perfil que dependen del apoyo. Función pura (sin Discord ni base).
 * @param {Object} p
 * @param {{ estado: string, estilo: Object, nombreDueño?: string|null }|null} p.apoyo
 * @param {boolean} p.esDueño - quien mira es el dueño del personaje
 * @param {string} p.nombre - título del personaje (Nombre | Apodo)
 * @param {string} p.ownerID
 * @param {number} [p.otrosCaracteres] - caracteres del resto de text displays de la tarjeta
 * @param {() => number} [p.azar]
 * @returns {{ titulo: string, lineaApoyo: string, pie: string, conDegradado: boolean }}
 */
function piezasApoyoPerfil({ apoyo, esDueño, nombre, ownerID, otrosCaracteres = 0, azar = Math.random }) {
    const estado = apoyo?.estado || "ninguno"
    const estilo = estilos.validarApoyoEstilo(apoyo?.estilo)
    const mensaje = estado === "ninguno" ? "" : mensajeAlAzar(esDueño ? MENSAJES_DUEÑO : MENSAJES_VISITANTE, azar)

    const construir = (conDegradado) => {
        const usar = conDegradado && estado === "activo" && estilo.modo !== "ninguno"
        const superior = usar && estilo.posicion === "superior"
        const inferior = usar && estilo.posicion === "inferior"
        let aplicado = false

        // Título
        let titulo = `# ${nombre}`
        if (superior && (estilo.modo === "nombre" || estilo.modo === "ambos")) {
            const g = degradadoSinRecorte(nombre, estilo.paleta, MAX_DEGRADADO_NOMBRE)
            if (g) { titulo = estilos.bloque(g); aplicado = true }
        }

        // Línea "Apoyo:" + mensaje (los visitantes no la ven si el dueño la ocultó; el dueño siempre la ve)
        let lineaApoyo = ""
        const visible = estado !== "ninguno" && (esDueño || estilo.mostrarEtiqueta)
        if (visible) {
            const clave = `\n-# *\`${ETIQUETA.clave}\`*`
            if (estado === "activo") {
                const { antes, palabra, despues } = ETIQUETA.activo
                const g = superior && (estilo.modo === "etiqueta" || estilo.modo === "ambos")
                    ? estilos.degradadoSeguro(palabra, estilo.paleta)
                    : null
                if (g) { lineaApoyo = `${clave}\n${estilos.bloque(antes + g + despues)}`; aplicado = true }
                else lineaApoyo = `${clave} ${antes}${palabra}${despues}`
            } else {
                lineaApoyo = `${clave} ${ETIQUETA.algunaVez}`
            }
            if (mensaje) lineaApoyo += `\n-# ${mensaje}`
        }

        // Pie: el degradado necesita el nombre en texto (una mención dentro del bloque se vería cruda)
        let pie = `-# Personaje de: <@!${ownerID}>\n-# Sistema de personaje | v1.5`
        if (inferior && apoyo?.nombreDueño) {
            const l1 = degradadoSinRecorte(`Personaje de: ${apoyo.nombreDueño}`, estilo.paleta, MAX_DEGRADADO_PIE)
            const l2 = degradadoSinRecorte("Sistema de personaje | v1.5", estilo.paleta, MAX_DEGRADADO_PIE)
            if (l1 && l2) { pie = estilos.bloque(`${l1}\n${l2}`); aplicado = true }
        }

        return { titulo, lineaApoyo, pie, conDegradado: aplicado }
    }

    const plano = construir(false)
    if (estado !== "activo") return plano
    try {
        const con = construir(true)
        const total = otrosCaracteres + con.titulo.length + con.lineaApoyo.length + con.pie.length
        return total <= LIMITE_TEXTO_V2 ? con : plano   // si no cabe, texto plano en vez de fallar
    } catch {
        return plano
    }
}

/** Suma los caracteres de todos los text displays (type 10) de unos componentes V2. */
function contarTextoV2(componentes) {
    let total = 0
    const recorrer = (lista) => {
        for (const c of lista || []) {
            if (!c || typeof c !== "object") continue
            if (c.type === 10 && typeof c.content === "string") total += c.content.length
            if (Array.isArray(c.components)) recorrer(c.components)
        }
    }
    recorrer(componentes)
    return total
}

module.exports = {
    LIMITE_TEXTO_V2,
    contarTextoV2,
    estadoApoyo,
    obtenerApoyo,
    mensajeAlAzar,
    piezasApoyoPerfil
}
