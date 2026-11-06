// ─────────────────────────────────────────────────────────────────────────────
// Contenido de la tarjeta de /rol amistad (la arma construirMenuAmistad en
// data/UI_ComponentsV2/menuInteraccion.js). Todo se calcula al leer.
//
// A propósito NO se muestra: el tope diario ni cuánto llevan "hoy" (invita a
// optimizar justo hasta el tope), quién inició cada interacción, ni el desglose
// de rechazadas por tipo.
// ─────────────────────────────────────────────────────────────────────────────
const { estadoAmistad, FIRMA } = require("./reglasAmistad")
const { RIVALIDAD_ALTA } = require("../../config/rangosAmistad")

// Por tipo: [singular, plural, artículo del plural, nombre en "Última vez"]
const NOMBRE_TIPO = {
    abrazo: ["abrazo", "abrazos", "los", "Abrazo"],
    mimo: ["mimo", "mimos", "los", "Mimo"],
    beso: ["beso", "besos", "los", "Beso"],
    baile: ["baile", "bailes", "los", "Baile"],
    poke: ["poke", "pokes", "los", "Poke"],
    mordida: ["mordida", "mordidas", "las", "Mordida"],
    bofetada: ["bofetada", "bofetadas", "las", "Bofetada"],
    disparo: ["disparo", "disparos", "los", "Disparo"],
    punch: ["golpe", "golpes", "los", "Golpe"],
}
const nombreTipo = (tipo) => NOMBRE_TIPO[tipo] || [tipo, tipo, "los", tipo]

// Color del acento por estado. El Compañero tiene prioridad sobre los demás.
const COLORES = {
    conocido: 0x95a5a6,
    amigo: 0x2ecc71,
    mejor_amigo: 0xf1c40f,
    companero: 0xff6fa5,
    rival: 0xe67e22,
    enemigo: 0xe74c3c,
    especial: 0x9b59b6,
}

const LARGO_BARRA = 10
const unix = (f) => Math.floor(new Date(f).getTime() / 1000)
const valida = (f) => f && !Number.isNaN(new Date(f).getTime())

function barra(frac) {
    const llenos = Math.round(Math.min(1, Math.max(0, frac)) * LARGO_BARRA)
    return "▰".repeat(llenos) + "▱".repeat(LARGO_BARRA - llenos)
}

/** Tipos ordenados por uso (más usado primero), solo los que tienen al menos uno. */
function tiposPorUso(historial = {}) {
    return Object.entries(historial)
        .filter(([, h]) => (h?.total || 0) > 0)
        .sort((a, b) => b[1].total - a[1].total)
}

function dinamica(estado) {
    const rivalidadAlta = estado.rivalidad >= RIVALIDAD_ALTA
    const altos = estado.tier === "amigo" || estado.tier === "mejor_amigo"
    const negativos = estado.etiqueta === "rival" || estado.etiqueta === "enemigo"
    if (altos && !rivalidadAlta) return "Se llevan de maravilla"
    if (altos && rivalidadAlta) return "Se pelean con cariño"
    if (negativos && rivalidadAlta) return "Rivales de toda la vida"
    if (negativos) return "Se evitan"
    return "Aún se están conociendo"
}

/**
 * @param {object|null} pareja  Documento de `amistades` (null = aún no hay intercambios)
 * @param {object} otro         Personaje consultado
 * @returns {{ titulo: string, bloques: string[], avatar?: string, color: number }}
 *   `bloques` van como TextDisplay separados, en el orden de la tarjeta.
 */
function contenidoTarjeta(pareja, otro, ahora = Date.now()) {
    const estado = estadoAmistad(pareja, ahora)
    const { rango } = estado
    const esCompanero = estado.esCompanero

    // ── Rango, puntos y rivalidad ───────────────────────────────────────────
    // Orden: 1) frase del rango, 2) nombre | estado (barra de avance y, si hay,
    // barra de rivalidad), 3) valor de amistad.
    const estadoLinea = []
    if (rango.frac !== null && !esCompanero) estadoLinea.push(`${barra(rango.frac)} ${Math.round(rango.frac * 100)}%`)
    if (estado.rivalidad > 0) estadoLinea.push(`Rivalidad: ${barra(estado.rivalidad / RIVALIDAD_ALTA)}`)
    const lineaRango = `-# ${esCompanero ? "💞 Compañero · " : ""}${rango.nombre}${estadoLinea.length ? ` | ${estadoLinea.join(" | ")}` : ""}`
    const cabecera = [`-# *${rango.descripcion}*\n`, lineaRango, `-# Valor de amistad: ${estado.puntos}`]
    const bloques = [cabecera.join("\n")]

    // ── Fechas ──────────────────────────────────────────────────────────────
    const creado = pareja?.creadoEn ?? pareja?.creado   // `creado`: documentos del modelo anterior
    const fechas = []
    if (valida(creado)) fechas.push(`-# **Se conocen desde** <t:${unix(creado)}:R>`)
    if (pareja?.ultima && valida(pareja.ultima.fecha)) {
        fechas.push(`-# **Última interacción:** ${nombreTipo(pareja.ultima.tipo)[3]} · <t:${unix(pareja.ultima.fecha)}:R>`)
    }
    if (fechas.length) bloques.push(fechas.join("\n"))

    // ── Historial y dinámica ────────────────────────────────────────────────
    const usos = tiposPorUso(pareja?.historial)
    if (!usos.length) {
        bloques.push(`-# Aún no han compartido nada. ¿Quién da el primer paso? ${FIRMA}`)
    } else {
        const compartido = usos.slice(0, 3)
            .map(([tipo, h]) => { const [s, p] = nombreTipo(tipo); return `${h.total} ${h.total === 1 ? s : p}` })
            .join(" · ")
        bloques.push(`**Lo que han compartido**\n-# ${compartido}`)

        const total = usos.reduce((n, [, h]) => n + (h.total || 0), 0)
        const correspondidas = usos.reduce((n, [, h]) => n + (h.correspondidas || 0), 0)
        const [, plural, articulo] = nombreTipo(usos[0][0])
        const pct = total ? Math.round((correspondidas / total) * 100) : 0
        bloques.push(`**Dinámica:** ${dinamica(estado)}\n-# Lo suyo son ${articulo} ${plural} · se corresponden el ${pct}% de las veces`)
    }

    const color = esCompanero ? COLORES.companero : (COLORES[rango.estado] ?? COLORES.conocido)
    return {
        titulo: `### Amistad con ${otro?.perfil?.Nombre || "Alguien"}`,
        bloques,
        avatar: otro?.perfil?.avatarURL,
        color,
    }
}

module.exports = { contenidoTarjeta, barra, dinamica, COLORES, NOMBRE_TIPO }
