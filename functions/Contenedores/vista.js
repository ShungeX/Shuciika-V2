// ─── Contenedores: vista de Equipamiento (/rol perfil → Alma → Equipamiento) ──
// El perfil es un mensaje público, así que la vista de Equipamiento solo nombra el contenedor
// (forma y nombre: lo que se vería a simple vista). El estado real —cristal, carga y elemento
// activo— y las acciones van en un panel efímero que solo ve el dueño.

const catalogoObjetos = require("../catalogoObjetos")
const { crearCustomId } = require("../../utils/constructores/customId")
const { construirAlmaEquipamiento, filaNavegacionPerfil } = require("../../data/UI_ComponentsV2/menuAlma")
const { TIPOS, REPARACION, ARTESANO, ADVERTENCIA } = require("./config")
const N = require("./nucleo")
const { estadoContenedor } = require("./servicio")

const LUMENS = "<a:Lumens:1335709991130103910>"
const ACCION = "contenedor"
const EMOJI_ELEMENTO = { "Pyrós": "🔥", Aqua: "💧", Lux: "✨", Rakau: "🌳", Lapis: "🪨", Electro: "⚡", Wind: "🍃", Kryo: "❄️" }

const TIPOS_EQUIPAMIENTO = {
    Arma: { nombre: "Arma", emoji: "🪄" },
    Armadura: { nombre: "Armadura", emoji: "🧤" },
    Artefacto: { nombre: "Artefactos", emoji: "💍" },
}

const divisor = () => ({ type: 14, divider: true, spacing: 1 })
const texto = (content) => ({ type: 10, content })

/** Texto del equipo que el alma lleva puesto (un objeto por tipo). */
function textoEquipamiento(soul) {
    const porTipo = {}
    for (const e of (soul?.dominio?.equipo || [])) {
        if (N.esContenedor(e) && e.equipado === false) continue   // guardado, no puesto
        const def = catalogoObjetos.getObjetoPorId(e.Region, e.ID)
        if (!def) continue
        const nombre = N.esContenedor(e) ? N.nombreVisible(e) : def.Nombre
        for (const tipo of (Array.isArray(def.Tipo) ? def.Tipo : [def.Tipo])) {
            if (TIPOS_EQUIPAMIENTO[tipo] && !porTipo[tipo]) porTipo[tipo] = nombre
        }
    }
    return "**🥊 Equipamiento**\n\n" + Object.entries(TIPOS_EQUIPAMIENTO)
        .map(([tipo, info]) => `-# \`[${info.emoji}]\` **${info.nombre}**: ${porTipo[tipo] || `Sin ${info.nombre.toLowerCase()}`}`)
        .join("\n")
}

/** Estado completo del contenedor. Privado: solo para el panel efímero del dueño. */
function textoContenedor(estado) {
    const lineas = ["### 🔮 Tu contenedor", ""]
    const e = estado.entrada
    if (!e) {
        lineas.push("-# No llevas ningún contenedor: sin él no puedes usar magia elemental.")
    } else {
        const def = TIPOS[estado.tipo]
        lineas.push(
            `-# **${estado.nombre}** · ${e.forma || "sin forma"}${def.esRespaldo ? " · *respaldo del Instituto*" : ""}`,
            `-# Cristal: ${N.barraDurabilidad(estado.durabilidad)}`,
            `-# Carga: **${estado.carga}/${estado.capacidad}** de maná`,
            `-# Elemento activo: **${estado.elementoActivo}**`,
        )
        if (e.diseno?.descripcion) lineas.push(`-# *${e.diseno.descripcion}*`)
        if (!estado.funciona) lineas.push("", "-# *Está roto: solo te quedan Golpe, Guardia e ítems. Tus hechizos siguen en tu alma.*")
        if (def.esRespaldo) lineas.push("", `-# ${def.aspecto}. No se repara: si se rompe, el Instituto te da otro.`)
    }
    if (estado.artesanal && estado.artesanal !== e) {
        lineas.push("", `-# Guardado: **${N.nombreVisible(estado.artesanal)}** (${N.etapaEntrada(estado.artesanal)}). El Taller puede restaurarlo.`)
    }
    if (estado.respaldoAgotado) lineas.push("", "-# El Instituto ya te entregó un respaldo hoy. Vuelve mañana.")
    return lineas.join("\n")
}

const boton = (userId, characterId, label, accion, { emoji, disabled = false, style = 2 } = {}) => ({
    type: 2, style, label, disabled,
    ...(emoji ? { emoji: { name: emoji } } : {}),
    custom_id: crearCustomId({ action: ACCION, userId, characterId, extras: [accion] }),
})

function botonesContenedor(estado, userId, characterId) {
    const b = (...args) => boton(userId, characterId, ...args)
    return {
        type: 1,
        components: [
            b(`Usar kit (+${REPARACION.KIT_PUNTOS})`, "kit", { emoji: "🧰", disabled: !estado.puedeKit }),
            b(estado.tallerObjetivo ? `Taller (${estado.costoTaller})` : "Taller", "taller", { emoji: "🛠️", disabled: !estado.tallerObjetivo }),
            b("Pedir respaldo", "respaldo", { emoji: "🎒", disabled: !estado.puedeRespaldo }),
            b(`Artesano (${ARTESANO.PRECIO})`, "artesano", { emoji: "💎", disabled: !estado.puedeArtesano }),
        ],
    }
}

/** Select para cambiar el elemento activo fuera de combate (inmediato y gratis). */
function filaElemento(estado, userId, characterId) {
    return {
        type: 1,
        components: [{
            type: 3,
            custom_id: crearCustomId({ action: "contenedorElemento", userId, characterId }),
            placeholder: "Cambiar de elemento activo (gratis fuera de combate)",
            min_values: 1, max_values: 1,
            options: N.ELEMENTOS_JUGABLES
                .filter(e => e !== estado.elementoActivo)
                .map(e => ({ label: e, value: e, emoji: { name: EMOJI_ELEMENTO[e] || "🌟" } })),
        }],
    }
}

/**
 * Vista pública de Equipamiento. Del contenedor solo dice qué es (forma y nombre); el botón
 * abre el panel privado.
 * @param {{ character: Object, soul: Object, userId: string }} p
 */
function construirVistaEquipamiento({ character, soul, userId }) {
    const estado = estadoContenedor(soul)
    const resumen = !estado ? null
        : estado.entrada ? `-# **${estado.nombre}** · ${estado.entrada.forma || "sin forma"}`
            : "-# Sin contenedor"
    return construirAlmaEquipamiento({
        character,
        userId,
        textoEquipamiento: textoEquipamiento(soul),
        filaNavegacion: filaNavegacionPerfil(userId, character._id),
        extras: estado ? [
            divisor(),
            {
                type: 9,
                accessory: boton(userId, character._id, "Mi contenedor", "panel", { emoji: "🔮" }),
                components: [texto(`**🔮 Contenedor elemental**\n\n${resumen}`)],
            },
        ] : [],
    })
}

/**
 * Panel privado del contenedor (mensaje efímero): cristal, carga, elemento activo y acciones.
 * @param {{ character: Object, soul: Object, userId: string, aviso?: string }} p
 * @returns {Object[] | null} null si el alma no usa contenedor
 */
function construirPanelContenedor({ character, soul, userId, aviso = null }) {
    const estado = estadoContenedor(soul)
    if (!estado) return null
    return [{
        type: 17,
        components: [
            texto(textoContenedor(estado)),
            ...(aviso ? [divisor(), texto(aviso)] : []),
            divisor(),
            ...(estado.funciona ? [filaElemento(estado, userId, character._id)] : []),
            botonesContenedor(estado, userId, character._id),
        ],
    }]
}

/** Mensajes de las operaciones (códigos de servicio.js). */
const MENSAJES = {
    en_combate: "No puedes hacer eso en medio de un combate ＞﹏＜",
    no_desafinado: "Solo un Alma Desafinada lleva contenedor.",
    sin_contenedor: "No llevas ningún contenedor. Pide tu respaldo al Instituto.",
    contenedor_roto: "Necesitas un contenedor que funcione.",
    roto: "El kit no puede con un cristal roto: llévalo al Taller de contenedores.",
    no_reparable: "El Contenedor de Cortesía no se repara: si se rompe, el Instituto te da otro.",
    intacto: "Tu contenedor no necesita reparación.",
    sin_kit: "No tienes ningún **Kit de reparación** en tu inventario.",
    conflicto: "Tu contenedor cambió mientras lo atendían. Vuelve a intentarlo.",
    sin_lumens: (r) => `No te alcanzan los Lumens: cuesta **${r.costo}** ${LUMENS}.`,
    pago: "No se pudo cobrar. Vuelve a intentarlo.",
    ya_funciona: "Tu contenedor todavía funciona: el Instituto solo repone los que se rompen.",
    limite_diario: "El Instituto ya te entregó un respaldo hoy. Vuelve mañana.",
    ya_tiene_artesanal: "Ya tienes un contenedor forjado a tu nombre. Si se dañó, el Taller puede restaurarlo.",
    forma_vacia: "Elige una forma para tu contenedor.",
    nombre_vacio: "Tu contenedor necesita un nombre.",
    mismo_elemento: "Tu contenedor ya traduce ese elemento.",
    elemento_invalido: "Ese elemento no existe.",
}

function mensajeDe(resultado) {
    const m = MENSAJES[resultado?.motivo]
    return (typeof m === "function" ? m(resultado) : m) || "No se pudo completar la acción (╥﹏╥)"
}

/** Advertencia que se lee antes de elegir ser un Alma Desafinada (voz oficial + resumen mecánico). */
function textoAdvertencia() {
    return `${ADVERTENCIA.TEXTO}\n\n**Lo que significa: ** \n${ADVERTENCIA.RESUMEN.map(l => `- -# ${l}`).join("\n")}`
}

module.exports = {
    LUMENS, textoEquipamiento, textoContenedor, construirVistaEquipamiento, construirPanelContenedor,
    MENSAJES, mensajeDe, textoAdvertencia,
}
