// functions/Mascotas/vista.js
// Paneles de mascotas y huevos (Components V2). Solo construyen JSON: los datos los trae ./pantallas.js.
//
// customId de los botones: mascotas-{userId}--{accion}-{...}-{origen}
//   El characterId va vacío a propósito: el router resuelve el personaje ACTIVO de quien pulsa.
//   origen: "p" → el panel vive dentro de /rol perfil (lleva la fila de navegación del perfil)
//           "e" → mensaje efímero propio (se abrió desde el inventario)

const { crearCustomId } = require("../../utils/constructores/customId")
const config = require("../../config")
const C = require("../../config/configPets")
const N = require("./nucleo")

const texto = (content) => ({ type: 10, content })
const divisor = () => ({ type: 14, divider: true, spacing: 1 })
const fila = (...components) => ({ type: 1, components })
const boton = (label, custom_id, { style = 2, emoji = null, disabled = false } = {}) => ({
    type: 2, style, label, custom_id, disabled, ...(emoji ? { emoji } : {}),
})
const seccion = (contenido, accessory) => ({ type: 9, components: [texto(contenido)], accessory })
const miniatura = (url) => ({ type: 11, media: { url }, description: null, spoiler: false })

const idBoton = (userId, ...extras) => crearCustomId({ action: "mascotas", userId, characterId: "", extras })
const emojiTexto = (e) => (!e ? "" : e.id ? `<:${e.name}:${e.id}>` : e.name)
const nombreDe = (character) => character?.perfil?.Nombre || character?.Nombre || "tu personaje"
const rarezaTexto = (rareza) => (C.RAREZAS[rareza] ? `${C.RAREZAS[rareza].etiqueta} ${C.RAREZAS[rareza].estrellas}` : (rareza || "Desconocida"))

/** Fila de navegación del perfil con "Mascotas" marcado (solo cuando el panel vive en /rol perfil). */
function navegacion(userId, character, origen) {
    if (origen !== "p") return []
    const { filaNavegacionPerfil } = require("../../data/UI_ComponentsV2/menuAlma")
    return [filaNavegacionPerfil(userId, character._id, "mascota")]
}

const pie = () => texto(`-# *Sistema de mascotas [v${config.versionPETS}]* | Actualizado: <t:${Math.floor(Date.now() / 1000)}:R>`)

// ─── Barras ──────────────────────────────────────────────────────────────────

/** Barra con los emojis del servidor para las necesidades de la mascota. */
function barraMascota(pct) {
    const total = 8
    const llenas = Math.round((pct / 100) * total)
    const inicio = pct > 1 ? "<:PI:1374224204253237258>" : "<:EI:1374227001950601266>"
    const fin = pct >= 98 ? "<:PE:1374224322943647744>" : "<:EE:1374224348289699985>"
    const medio = "<:PM:1374224241708240947>".repeat(llenas) + "<:EM:1374224400819294219>".repeat(total - llenas)
    return `**\`${String(Math.round(pct)).padStart(3, " ")}%\`** | ${inicio}${medio}${fin}`
}

/** Barra de texto para los huevos. */
function barraHuevo(pct, largo = 10) {
    const llenas = Math.max(0, Math.min(largo, Math.round((pct / 100) * largo)))
    return `${"▰".repeat(llenas)}${"▱".repeat(largo - llenas)} \`${String(Math.round(pct)).padStart(3, " ")}%\``
}

// ─── Panel de mascota ────────────────────────────────────────────────────────

/**
 * @param {Object} p
 * @param {string} p.userId - quien mira el panel (dueño de los botones)
 * @param {Object} p.character - personaje dueño de las mascotas
 * @param {Object} p.pet - mascota activa, ya puesta al día
 * @param {Object[]} p.mascotas - todas las mascotas del personaje
 * @param {Object[]} p.huevos - huevos en crianza
 * @param {boolean} p.puedeCuidar - false si mira el panel de otro personaje (solo lectura)
 * @param {string|null} [p.aviso]
 * @param {"p"|"e"} [p.origen]
 */
function panelMascota({ userId, character, pet, mascotas, huevos, puedeCuidar, aviso = null, origen = "p" }) {
    const dormida = N.estaDormida(pet)
    const estados = N.estadosActivos(pet)
    const componentes = []
    if (aviso) componentes.push(texto(aviso), divisor())

    componentes.push(
        seccion(
            `# **${pet.Nombre}** ${emojiTexto(pet.emoji)}\n` +
            `-# *Nivel:* ${pet.lv ?? 1} [${pet.etapa}]\n` +
            `-# *Experiencia:* ${pet.xp ?? 0}/${pet.xpRq ?? C.PROGRESION.XP_BASE_NIVEL}\n` +
            `-# *Personalidad:* ${pet.personalidad || "Sin determinar"}\n` +
            `-# *Especie:* ${pet.tipo || "Desconocida"} · ${rarezaTexto(pet.rareza)}`,
            miniatura(pet.avatarURL || C.IMAGENES.MASCOTA)
        ),
        divisor()
    )

    const NOMBRES = { hambre: "Hambre", higiene: "Higiene", felicidad: "Felicidad", energia: "Energía" }
    for (const [accion, cfg] of Object.entries(C.ACCIONES_MASCOTA)) {
        const esDormir = accion === "dormir"
        const etiqueta = esDormir && dormida ? "Despertar" : cfg.etiqueta
        componentes.push(seccion(
            `${barraMascota(N.porcentajeDe(pet, cfg.stat))} ${NOMBRES[cfg.stat]}`,
            boton(etiqueta, idBoton(userId, "cuidar", pet._id, accion, origen), {
                emoji: cfg.emoji,
                // Dormida solo se la puede despertar
                disabled: !puedeCuidar || (dormida && !esDormir),
            })
        ))
    }

    const listaEstados = estados.length
        ? "\n" + estados.map(e => `- -# ${e.nombre}${e.desde ? ` <t:${e.desde}:R>` : ""} · ${e.descripcion}`).join("\n")
        : "Ninguno"
    componentes.push(
        divisor(),
        texto(
            `**${pet.nacimiento ? "Nació" : "Adoptada"}:** <t:${pet.adoptada}:R>\n` +
            `-# **Días de cuidado:** ${pet.diasCuidado ?? 0}\n` +
            `-# **Estados:** ${listaEstados}`
        ),
        divisor()
    )

    if (mascotas.length > 1) {
        componentes.push(fila({
            type: 3,
            custom_id: crearCustomId({ action: "pets", userId, characterId: "", extras: ["activar", origen] }),
            placeholder: "Cambia de mascota activa",
            min_values: 1,
            max_values: 1,
            disabled: !puedeCuidar,
            options: mascotas.slice(0, 25).map(m => ({
                label: `${m.Nombre} [lv: ${m.lv ?? 1}]`.slice(0, 100),
                description: `${m.tipo || "Mascota"} | ${m.etapa}`.slice(0, 100),
                value: String(m._id),
                default: String(m._id) === String(pet._id),
                ...(m.emoji?.name ? { emoji: m.emoji.id ? { name: m.emoji.name, id: m.emoji.id } : { name: m.emoji.name } } : {}),
            })),
        }))
    }

    if (puedeCuidar) {
        componentes.push(fila(
            boton(`Huevos (${huevos.length})`, idBoton(userId, "huevos", origen), { emoji: { name: "🥚" } }),
            boton("Renombrar", idBoton(userId, "renombrar", pet._id, origen), { emoji: { name: "✏️" } }),
            boton("Actualizar", idBoton(userId, "ver", origen), { emoji: { name: "🔄" } }),
        ))
    } else {
        componentes.push(texto("-# *Solo su cuidador puede atenderla, y con este personaje activo.*"))
    }
    componentes.push(divisor(), pie())

    return [{ type: 17, accent_color: 15703927, spoiler: false, components: componentes }, ...navegacion(userId, character, origen)]
}

/** Panel cuando el personaje todavía no tiene ninguna mascota. */
function panelSinMascotas({ userId, character, huevos, puedeCuidar, aviso = null, origen = "p" }) {
    const componentes = []
    if (aviso) componentes.push(texto(aviso), divisor())
    componentes.push(texto(
        `# Mascotas de ${nombreDe(character)}\n` +
        (huevos.length && puedeCuidar
            ? "Todavía no ha nacido ninguna, pero hay un huevo esperando 〒▽〒"
            : "Aún no hay ninguna mascota por aquí... 〒▽〒") +
        (puedeCuidar ? "\n-# Consigue un **huevo** y úsalo desde `/rol inventario` para empezar a criarlo." : "")
    ))
    if (puedeCuidar) {
        componentes.push(divisor(), fila(
            boton(`Huevos (${huevos.length})`, idBoton(userId, "huevos", origen), { emoji: { name: "🥚" }, style: huevos.length ? 1 : 2 }),
            boton("Actualizar", idBoton(userId, "ver", origen), { emoji: { name: "🔄" } }),
        ))
    }
    componentes.push(divisor(), pie())
    return [{ type: 17, accent_color: 15703927, spoiler: false, components: componentes }, ...navegacion(userId, character, origen)]
}

// ─── Panel de huevos ─────────────────────────────────────────────────────────

function bloqueHuevo({ userId, doc, origen, ahora, tieneIncubadora, incubadoraOcupada, tieneAlma }) {
    const h = doc.huevo
    const nombre = h.objeto?.Nombre || doc.Nombre
    const eclosion = Math.floor(h.eclosionEn / 1000)
    const componentes = [divisor()]

    if (h.incubadora) {
        componentes.push(
            texto(
                `### ${nombre} · 🏠 En la incubadora\n` +
                `-# Eclosiona <t:${eclosion}:R> (<t:${eclosion}:f>)\n` +
                "-# La incubadora lo cuida por ti: no necesita nada más."
            ),
            fila(boton("Sacar de la incubadora", idBoton(userId, "incubar", doc._id, "sacar", origen), { emoji: { name: "🤲" }, disabled: !tieneAlma }))
        )
        return componentes
    }

    const barras = N.barrasEn(h, ahora)
    const estado = N.estadoTotal(h, ahora)
    const restantes = N.interaccionesRestantes(h, ahora)
    const rotura = N.momentoRotura(h)
    const peligro = rotura < h.eclosionEn
    const lineas = [
        `### ${nombre} · 🤲 A tu cuidado`,
        `-# Eclosiona <t:${eclosion}:R> (<t:${eclosion}:f>)`,
        `-# **Estado:** ${barraHuevo(estado)} · se rompe al ${C.HUEVO.ESTADO_ROTURA}%`,
        `-# **Cuidados de hoy:** ${C.HUEVO.MAX_INTERACCIONES_DIA - restantes}/${C.HUEVO.MAX_INTERACCIONES_DIA}` +
        (h.reducidoMs ? ` · **Sobrecuidado:** −${N.formatoDuracion(h.reducidoMs)}` : ""),
    ]
    if (peligro) lineas.push(`-# ⚠️ Si nadie lo cuida se romperá <t:${Math.floor(rotura / 1000)}:R>`)
    componentes.push(texto(lineas.join("\n")))

    for (const clave of N.CLAVES_CUIDADO) {
        const cfg = C.HUEVO.CUIDADOS[clave]
        const llena = barras[clave] >= C.HUEVO.BARRA_LLENA_DESDE
        // Con la barra llena el cuidado es sobrecuidado: acorta la eclosión mientras quede margen
        const sinEfecto = llena && N.reduccionDisponible(h) <= 0
        componentes.push(seccion(
            `${cfg.emoji} ${barraHuevo(barras[clave])} ${clave === "carino" ? "Cariño" : clave[0].toUpperCase() + clave.slice(1)}${llena ? " ✨" : ""}`,
            boton(llena ? `${cfg.etiqueta} ✨` : cfg.etiqueta, idBoton(userId, "huevo", doc._id, clave, origen), {
                style: llena ? 3 : 2,
                disabled: restantes <= 0 || sinEfecto || !tieneAlma,
            })
        ))
    }

    componentes.push(fila(boton("Meter en la incubadora", idBoton(userId, "incubar", doc._id, "meter", origen), {
        emoji: { name: "🏠" }, disabled: !tieneIncubadora || incubadoraOcupada,
    })))
    return componentes
}

/**
 * @param {Object} p
 * @param {Object[]} p.huevos - huevos en crianza (ya resueltos)
 * @param {number|null} p.energia - energía actual del personaje, o null si no ha despertado
 * @param {number} p.maxEnergia
 * @param {boolean} p.tieneIncubadora
 */
function panelHuevos({ userId, character, huevos, energia, maxEnergia, tieneIncubadora, aviso = null, origen = "p", ahora = Date.now() }) {
    const tieneAlma = energia !== null
    const incubadoraOcupada = huevos.some(h => h.huevo.incubadora)
    const componentes = []
    if (aviso) componentes.push(texto(aviso), divisor())

    componentes.push(texto(
        `# 🥚 Huevos de ${nombreDe(character)}\n` +
        (tieneAlma
            ? `-# **Energía:** \`${energia}/${maxEnergia}⚡\` · cada cuidado cuesta \`${C.HUEVO.COSTO_ENERGIA}⚡\``
            : "-# Tu personaje aún no despierta su alma: sin energía solo puede criar huevos en una incubadora.") +
        `\n-# **Incubadora:** ${!tieneIncubadora ? "no tienes" : incubadoraOcupada ? "ocupada" : "libre"}`
    ))

    if (!huevos.length) {
        componentes.push(divisor(), texto(
            "No tienes ningún huevo en crianza.\n-# Usa un **huevo** desde `/rol inventario` → **Usar item** para empezar."
        ))
    }
    for (const doc of huevos) {
        componentes.push(...bloqueHuevo({ userId, doc, origen, ahora, tieneIncubadora, incubadoraOcupada, tieneAlma }))
    }

    if (huevos.some(h => !h.huevo.incubadora)) {
        componentes.push(texto(
            `-# Limpia, acaricia y calienta el huevo para que no baje su estado. Con una barra llena (✨) el cuidado extra acorta un poco la eclosión.`
        ))
    }
    componentes.push(divisor(), fila(
        boton("Mascotas", idBoton(userId, "ver", origen), { emoji: { name: "🐾" } }),
        boton("Actualizar", idBoton(userId, "huevos", origen), { emoji: { name: "🔄" } }),
    ))

    return [{ type: 17, accent_color: 16771770, spoiler: false, components: componentes }, ...navegacion(userId, character, origen)]
}

/**
 * Pregunta cómo criar un huevo recién usado desde el inventario.
 * @param {Object} p
 * @param {Object} p.def - definición del objeto huevo
 * @param {{ manual: { ok: boolean, motivo?: string }, incubadora: { ok: boolean, motivo?: string } }} p.opciones
 */
function panelNuevoHuevo({ userId, def, opciones }) {
    const horas = N.horasEclosion(def)
    const duracion = N.formatoDuracion(horas * N.HORA)
    const duracionIncubadora = N.formatoDuracion(horas * N.HORA * C.HUEVO.INCUBADORA_MULTIPLICADOR)
    const region = `[${def.Region}]`   // los corchetes protegen el guion de la región en el customId
    const motivos = [opciones.manual, opciones.incubadora]
        .filter(o => !o.ok)
        .map(o => MENSAJES[o.motivo])
        .filter(Boolean)

    const cabecera = `### 🥚 ${def.Nombre}\n-# ${def.Descripcion || "¿Qué criatura nacerá?"}`
    return [{
        type: 17,
        accent_color: 16771770,
        components: [
            def.imagenURL ? seccion(cabecera, miniatura(def.imagenURL)) : texto(cabecera),
            divisor(),
            texto(
                "**¿Cómo quieres criarlo?**\n" +
                `- 🤲 **Cuidarlo tú** · nace en ~${duracion}\n` +
                `-# Hay que limpiarlo, acariciarlo y calentarlo: cada cuidado cuesta \`${C.HUEVO.COSTO_ENERGIA}⚡\` (máx. ${C.HUEVO.MAX_INTERACCIONES_DIA} al día). ` +
                `Si su estado baja al ${C.HUEVO.ESTADO_ROTURA}% se rompe. Cuidarlo de más acorta un poco la espera.\n` +
                `- 🏠 **Incubadora** · nace en ~${duracionIncubadora}\n` +
                "-# Lo cuida por ti: no hace falta hacer nada, pero tarda más."
            ),
            fila(
                boton("Cuidarlo yo", idBoton(userId, "nuevo", region, def.ID, "manual"), { emoji: { name: "🤲" }, style: 1, disabled: !opciones.manual.ok }),
                boton("Usar incubadora", idBoton(userId, "nuevo", region, def.ID, "incubadora"), { emoji: { name: "🏠" }, disabled: !opciones.incubadora.ok }),
            ),
            ...(motivos.length ? [texto([...new Set(motivos)].map(m => `-# ${m}`).join("\n"))] : []),
        ],
    }]
}

// ─── Avisos ──────────────────────────────────────────────────────────────────

function tarjeta({ titulo, cuerpo, imagen, gif = C.IMAGENES.CAMBIO }) {
    return [{
        type: 17,
        accent_color: null,
        spoiler: false,
        components: [
            seccion(`# ${titulo}\n${cuerpo}`, miniatura(imagen || C.IMAGENES.MASCOTA)),
            divisor(),
            { type: 12, items: [{ media: { url: gif }, description: null, spoiler: false }] },
        ],
    }]
}

/** Mensaje de subida de nivel o de etapa. */
function mensajeCambio({ pet, subioNivel, subioEtapa }) {
    const partes = []
    if (subioNivel) partes.push(`ha subido al nivel **${pet.lv}**`)
    if (subioEtapa) partes.push(`ha trascendido de su antigua forma y ha entrado en la etapa de **${pet.etapa}**`)
    return tarjeta({
        titulo: "¡Tu mascota ha tenido un cambio!",
        cuerpo:
            `${subioEtapa ? "Una nueva etapa florece bajo la mirada de las estrellas..." : "Un nuevo resplandor envuelve a tu mascota..."}\n` +
            `-# ¡Felicidades, cuidador! **${pet.Nombre}** ${partes.join(" y ")}.\n` +
            (subioEtapa
                ? "-# *Sigan caminando juntos, pues aún quedan muchos secretos por descubrir...*"
                : "-# *Los sabios dicen que el crecimiento es una danza entre el tiempo, el alma y el amor.*"),
        imagen: pet.avatarURL,
    })
}

/** Mensaje de nacimiento de una mascota. */
function mensajeNacimiento(pet) {
    const huevo = pet.nacimiento?.huevo?.Nombre || "huevo"
    return tarjeta({
        titulo: "¡El cascarón se ha roto!",
        cuerpo:
            `De tu **${huevo}** ha nacido **${pet.tipo}** ${emojiTexto(pet.emoji)}\n` +
            `-# *Rareza:* ${rarezaTexto(pet.rareza)}\n` +
            "-# *Te mira por primera vez. A partir de hoy, su mundo eres tú.*",
        imagen: pet.avatarURL,
    })
}

const MENSAJES = {
    accion_invalida: "Interacción de mascota no válida (´･ω･`)?",
    mascota_no_encontrada: "No encontré esa mascota entre las de tu personaje activo 〒▽〒",
    huevo_no_encontrado: "Ese huevo ya no está en crianza con tu personaje activo 〒▽〒",
    lleno: "Tu mascota no necesita más de eso ＞﹏＜",
    dormida: "Shh... está durmiendo. Despiértala primero (｡-ω-)zzz",
    nombre_invalido: "Ese nombre no es válido: usa al menos 2 letras, sin símbolos raros (╥﹏╥)",
    no_es_huevo: "Ese objeto no es un huevo (´･ω･`)?",
    sin_huevo: "Ya no tienes ese huevo en tu inventario (╥﹏╥)",
    sin_alma: "Tu personaje necesita despertar su alma para tener energía con la que cuidar un huevo. Mientras tanto, usa una incubadora.",
    sin_incubadora: "No tienes una incubadora en tu inventario.",
    incubadora_ocupada: "Tu incubadora ya está ocupada con otro huevo.",
    limite_manual: `Ya estás cuidando ${C.HUEVO.MAX_SIN_INCUBADORA === 1 ? "un huevo" : `${C.HUEVO.MAX_SIN_INCUBADORA} huevos`} a mano: espera a que nazca o usa la incubadora.`,
    limite_mascotas: `Tu personaje ya tiene el máximo de compañeros (${C.LIMITES.MAX_MASCOTAS}).`,
    limite_diario: `Ya lo cuidaste ${C.HUEVO.MAX_INTERACCIONES_DIA} veces hoy. Déjalo descansar hasta mañana (｡-ω-)`,
    sobrecuidado_tope: "Esa barra ya está llena y el huevo no puede nacer más rápido de lo que ya va ＞﹏＜",
    en_incubadora: "La incubadora ya lo cuida por ti: no necesita nada más.",
    ya_en_incubadora: "Ese huevo ya está en la incubadora.",
    no_en_incubadora: "Ese huevo no está en la incubadora.",
    error: "Ha ocurrido un error con tu mascota (╥﹏╥) Inténtalo de nuevo.",
}

/** Texto para el jugador de un resultado fallido del servicio. */
function mensajeDe(r) {
    if (r.motivo === "sin_objeto") {
        const nombre = r.objeto?.Nombre ? `**${r.objeto.Nombre}**` : `**${r.cfg?.nombre || "ese objeto"}**`
        return r.cfg?.consume === false
            ? `Necesitas una ${nombre} para eso =.=\n-# ¿Por qué no pasas por la tienda?`
            : `No te queda ${nombre} para tu mascota =.=\n-# ¿Por qué no pasas por la tienda?`
    }
    if (r.motivo === "sin_energia") return `No te queda energía para cuidarlo (tienes \`${r.energia ?? 0}⚡\`) (╥﹏╥)`
    return MENSAJES[r.motivo] || MENSAJES.error
}

module.exports = {
    panelMascota, panelSinMascotas, panelHuevos, panelNuevoHuevo,
    mensajeCambio, mensajeNacimiento, mensajeDe, barraMascota, barraHuevo, rarezaTexto,
}
