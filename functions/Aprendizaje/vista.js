// ─── Aprendizaje: pantalla de la página (mensaje efímero, Components V2) ─────
// Tono del Instituto: oficial, amable, dogmático. Sin "hilo" ni términos reservados.
const { crearCustomId } = require("../../utils/constructores/customId")
const { PRACTICA, UI } = require("./config")
const N = require("./nucleo")

const ACCION = "pagina"
const EMOJI_ELEMENTO = { "Pyrós": "🔥", Aqua: "💧", Lux: "✨", Rakau: "🌳", Lapis: "🪨", Electro: "⚡", Wind: "🍃", Kryo: "❄️" }
const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII"]

const texto = (content) => ({ type: 10, content })
const divisor = () => ({ type: 14, divider: true, spacing: 1 })

/** custom_id: pagina-{userId}--practicar-[Aqua-002]-{via}. Los corchetes protegen el guion del ID. */
const idPracticar = (userId, hechizoId, via) =>
    crearCustomId({ action: ACCION, userId, characterId: "", extras: ["practicar", `[${hechizoId}]`, via] })

function lineaVia(via, valor) {
    const nombre = UI.NOMBRE_VIA[via] || via
    return valor >= 1 ? `✅ **${nombre}**` : `${UI.EMOJI_VIA[via] || "•"} **${nombre}** \`${N.barraProgreso(valor)}\``
}

/** Motivo por el que no se puede practicar ahora (o null). */
function motivoBloqueo(estado) {
    if (estado.practicaActiva) return "Ya tienes una práctica en curso."
    if (estado.restantes <= 0) return "Has agotado tus prácticas de hoy. El Instituto te espera mañana."
    if (estado.cooldownMs > 0) return `Descansa antes de volver a intentarlo: ${N.formatoDuracion(estado.cooldownMs)}.`
    return null
}

/**
 * Pantalla de la página: nombre, escalón, elemento, progreso por vía, prácticas restantes,
 * cooldown y un botón "Practicar <vía>" por cada vía incompleta.
 * @param {Object} estado - servicio.estadoPagina (ok: true)
 * @param {{ userId: string, aviso?: string }} p
 */
function construirPantalla(estado, { userId, aviso = null }) {
    const h = estado.hechizo
    const elemento = h.Elemento ? `${EMOJI_ELEMENTO[h.Elemento] || "🌟"} ${h.Elemento}` : "🌟 Universal"
    const bloqueo = motivoBloqueo(estado)
    const lineas = [
        `### 📜 ${h.Nombre}`,
        `-# ${N.nombreEscalon(h)} · ${elemento}`,
        "",
        "-# *Esta página guarda la forma del hechizo. Practica cada vía que exige: cuando todas estén dominadas, el hechizo quedará grabado en tu alma.*",
        "",
        ...estado.vias.map(v => lineaVia(v, Number(estado.progreso[v]) || 0)),
        "",
        `-# Prácticas restantes hoy: **${estado.restantes}/${PRACTICA.PRACTICAS_POR_DIA}**` +
        (estado.cooldownMs > 0 ? ` · En reposo: **${N.formatoDuracion(estado.cooldownMs)}**` : ""),
    ]
    if (bloqueo) lineas.push(`-# ${bloqueo}`)

    const pendientes = estado.vias.filter(v => (Number(estado.progreso[v]) || 0) < 1)
    const botones = pendientes.slice(0, 5).map(v => ({
        type: 2, style: 1, disabled: Boolean(bloqueo),
        label: `Practicar ${UI.NOMBRE_VIA[v] || v}`,
        emoji: { name: UI.EMOJI_VIA[v] || "📜" },
        custom_id: idPracticar(userId, h._id, v),
    }))

    return [{
        type: 17,
        components: [
            texto(lineas.join("\n")),
            ...(aviso ? [divisor(), texto(aviso)] : []),
            ...(botones.length ? [divisor(), { type: 1, components: botones }] : []),
        ],
    }]
}

/** Pantalla final: el hechizo quedó aprendido y la página se consumió. */
function construirAprendido(hechizo, aviso) {
    return [{
        type: 17,
        components: [
            texto(`### ✨ ${hechizo.Nombre}\n-# ${N.nombreEscalon(hechizo)}${hechizo.Elemento ? ` · ${hechizo.Elemento}` : ""}`),
            divisor(),
            texto(`${aviso ? `${aviso}\n\n` : ""}-# *"El Instituto registra tu dominio de «${hechizo.Nombre}». La página ha cumplido su propósito y se retira. Lo aprendido en el alma no se olvida."*`),
        ],
    }]
}

/** Resultado de un intento (aviso sobre la pantalla). */
function textoResultado(r, via) {
    const nombre = UI.NOMBRE_VIA[via] || via
    if (r.error) return "-# El ejercicio no pudo prepararse. El intento te fue devuelto."
    if (r.caducada) return `-# La práctica de **${nombre}** caducó sin respuesta. El intento ya se había contado.`
    if (r.abandonada) return `-# Abandonaste la práctica de **${nombre}**. El intento ya se había contado.`
    const pct = Math.round((Number(r.puntaje) || 0) * 100)
    if (r.aprobo) return `-# \`[✅]\` **${nombre}**: ${pct}%. Vía dominada.`
    const ganado = Math.max(0, Math.round(((Number(r.despues?.[via]) || 0) - (Number(r.antes?.[via]) || 0)) * 100))
    return `-# \`[📖]\` **${nombre}**: ${pct}%. Aprendes una parte (+${ganado}%). Necesitas ${Math.round(PRACTICA.UMBRAL_APROBADO * 100)}% para dominarla.`
}

/** Mensajes de las validaciones y operaciones. */
const MENSAJES = {
    sin_pagina: "Ya no tienes esa página en tu inventario.",
    hechizo_inexistente: "Esta página no corresponde a ningún hechizo vigente del Instituto.",
    ya_aprendido: "Ya conoces este hechizo. Guarda la página: no se ha consumido.",
    resplandor: (r) => `Tu Resplandor aún no alcanza para esta página: necesitas **${ROMANOS[r.requerido - 1] ?? r.requerido}** (tienes **${ROMANOS[r.actual - 1] ?? r.actual}**).`,
    fragmentos: (r) => `Aún no reúnes los Fragmentos Estelares para esta página: necesitas **${r.requerido}** ganados (llevas **${r.actual}**).`,
    elemento: (r) => `Tu alma está afinada a otro elemento: no puede practicar una página de **${r.elemento}**.`,
    sin_vias: "Esta página no exige ninguna vía que pueda practicarse.",
    practica_activa: "Ya tienes una práctica en curso. Termínala antes de empezar otra.",
    limite_diario: "Has agotado tus prácticas de hoy. El Instituto te espera mañana.",
    cooldown: (r) => `Descansa antes de volver a intentarlo: faltan **${N.formatoDuracion(r.restanteMs)}**.`,
    via_invalida: "Esta página no exige esa vía.",
    via_completa: "Ya dominas esa vía.",
    conflicto: "Tu registro cambió mientras lo atendían. Vuelve a intentarlo.",
    sin_alma: "Este personaje necesita despertar su poder para esto 〒▽〒",
    sesion_perdida: "No se encontró la práctica en curso.",
}

function mensajeDe(r) {
    const m = MENSAJES[r?.motivo]
    return (typeof m === "function" ? m(r) : m) || "No se pudo completar la acción (╥﹏╥)"
}

module.exports = { ACCION, idPracticar, construirPantalla, construirAprendido, textoResultado, mensajeDe, MENSAJES }
