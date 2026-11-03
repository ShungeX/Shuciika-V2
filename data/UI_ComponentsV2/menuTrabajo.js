// data/UI_ComponentsV2/menuTrabajo.js
// Gafete de empleado (menú de /rol trabajar), pantalla de renuncia y "pedir un aumento".
// Solo construyen componentes; los datos los arma functions/Economia/minijuegosTrabajo.js.

const { crearCustomId } = require("../../utils/constructores/customId")
const config = require("../../config/config")

const IMAGEN_GAFETE = "https://i.pinimg.com/1200x/c1/69/1c/c1691cd6b840ba962533cfa8bccb9f0c.jpg"
const IMAGEN_RENUNCIA = "https://c.tenor.com/Hehsl_icRLIAAAAC/tenor.gif"
const DORADO = 0xD4AF37

const separador = { type: 14, divider: true, spacing: 1 }
const texto = (content) => ({ type: 10, content })
const boton = (custom_id, label, style = 2) => ({ type: 2, custom_id, label, style })

// characterId vacío a propósito: el router resuelve el personaje activo desde usuarios_server
const idTrabajo = (userId, ...extras) => crearCustomId({ action: "trabajar", userId, extras })

const barraJornada = (turno, max) => "●".repeat(Math.min(turno, max)) + "○".repeat(Math.max(0, max - turno))

function antiguedad(desde) {
    const dias = Math.floor((Date.now() / 1000 - (desde || 0)) / 86_400)
    if (dias < 1) return "Recién llegado (todavía sonríes)"
    return `${dias} ${dias === 1 ? "día" : "días"} (y sigues aquí)`
}

/** "Aprendiz · 27/45 turnos" o "Insustituible · 190 turnos" en el último rango. */
const lineaRango = (rango) => `${rango.nombre} · ${rango.siguiente ? `${rango.turnos}/${rango.siguiente.desde}` : rango.turnos} turnos`

/** Frase al pie según el estado del día. */
function fraseDelDia({ jornada, energia, costo }) {
    if (jornada.topeAlcanzado) return "Jornada completa. Por favor, ve a tocar pasto."
    if (energia < Math.max(costo || 0, config.maxEnergy * 0.1)) return "Tu energía está por los suelos. El Instituto lo llama 'motivación'."
    if (jornada.turnosHoy === 0) return "Hoy no has trabajado. La productividad del Instituto te extraña (poquito)."
    if (jornada.turnosHoy >= 3) return "Ya vas por la mitad. El café se enfrió hace rato."
    return "Vas calentando motores. El reloj checador te observa."
}

/**
 * Gafete de empleado con el menú de acciones.
 * @param {Object} v
 * @param {string} v.userId
 * @param {string} v.nombre
 * @param {boolean} v.booster
 * @param {number} v.energia
 * @param {Object} v.jornada - estadoJornada()
 * @param {Object|null} v.activo - Puesto en el que trabaja { slot, nombre, desde, renunciaEn, rango, costo }
 * @param {Object|null} v.otro - El otro puesto, con enPausa si es de boost y no hay boost activo
 * @param {boolean} v.sinPrincipal
 * @param {string[]} [v.avisos]
 */
function gafete({ userId, nombre, booster, energia, jornada, activo, otro, sinPrincipal, avisos = [] }) {
    const titulo = activo?.rango.titulo ? ` ✦ ${activo.rango.nombre} ✦` : ""
    const lineas = [
        "-# Oficina de Labores Voluntarias · Instituto Shuciika",
        `-# Empleado: **${nombre}**${titulo}\n`,
    ]

    if (activo) {
        lineas.push(
            `-# \`Puesto:\` *${activo.nombre}*`,
            `-# \`Antigüedad:\` *${antiguedad(activo.desde)}*`,
            `-# \`Rango:\` *${lineaRango(activo.rango)}*\n`,
        )
        if (activo.renunciaEn) lineas.push(`-# Renuncia en trámite: se procesa <t:${activo.renunciaEn}:R>`)
    } else {
        lineas.push("-# Puesto: ninguno por ahora")
    }

    lineas.push(`-# Jornada: ${barraJornada(jornada.turnosHoy, jornada.turnosMax)}`)

    if (otro) {
        const estado = otro.enPausa ? " (en pausa hasta que vuelvas a boostear)" : ""
        lineas.push(`-# ${otro.slot === "boost" ? "Puesto de boost" : "Puesto principal"}: ${otro.nombre} · ${otro.rango.nombre}${estado}`)
        if (otro.renunciaEn) lineas.push(`-# Renuncia en trámite: se procesa <t:${otro.renunciaEn}:R>`)
    }

    lineas.push("", `-# \`Energía\`: ${energia}⚡`)

    const opciones = [
        { label: "Trabajar", value: "trabajar", description: activo ? `Realiza tu jornada del día (-${activo.costo}⚡)` : "Busca un trabajo primero" },
        { label: "Pedir un aumento", value: "aumento", description: "Es tu momento" },
        { label: "Renunciar (con dignidad)", value: "renunciar", description: "Hazlo" },
    ]
    if (sinPrincipal) opciones.push({ label: "Buscar trabajo", value: "buscar", description: "Ocupa tu puesto principal" })
    if (booster) opciones.push({ label: "Cambiar trabajo", value: "cambiar", description: "Solo boost" })

    return [{
        type: 17,
        accent_color: activo?.rango.titulo ? DORADO : null,
        components: [
            {
                type: 9,
                components: [texto("# Gafete de empleado"), texto(lineas.join("\n"))],
                accessory: { type: 11, media: { url: IMAGEN_GAFETE } },
            },
            ...(avisos.length ? [separador, texto(avisos.map(a => `-# ${a}`).join("\n"))] : []),
            separador,
            {
                type: 1,
                components: [{
                    type: 3,
                    custom_id: idTrabajo(userId, "accion"),
                    options: opciones,
                    placeholder: "¿Hora de chambear?",
                    min_values: 1,
                    max_values: 1,
                }],
            },
            texto(`-# *${fraseDelDia({ jornada, energia, costo: activo?.costo })}*`),
        ],
    }]
}

/**
 * Confirmación de renuncia. Un bloque por puesto ocupado, cada uno con su botón
 * (con boost hay que elegir cuál se deja).
 * @param {{ userId: string, puestos: Array<{ slot: string, nombre: string, renunciaEn: number|null }> }} p
 */
function renuncia({ userId, puestos }) {
    const varios = puestos.length > 1
    const bloques = puestos.map(p => ({
        type: 9,
        components: [texto(
            `**${p.nombre}**${varios ? ` · ${p.slot === "boost" ? "puesto de boost" : "puesto principal"}` : ""}\n` +
            (p.renunciaEn ? `-# Tu carta se procesa <t:${p.renunciaEn}:R>.` : "-# Sin renuncia en trámite.")
        )],
        accessory: p.renunciaEn
            ? boton(idTrabajo(userId, "renuncia", "retirar", p.slot), "Retirar renuncia", 3)
            : boton(idTrabajo(userId, "renuncia", "firmar", p.slot), "Firmar renuncia", 4),
    }))

    return [{
        type: 17,
        accent_color: null,
        components: [
            {
                type: 9,
                components: [
                    texto("# Renuncia (con dignidad)"),
                    texto("Has solicitado dejar de ser útil. Tu carta será procesada en 24 horas. Durante ese tiempo puedes seguir trabajando, se agradece." +
                        (varios ? "\n\n-# ¿Cuál puesto dejas?" : "")),
                ],
                accessory: { type: 11, media: { url: IMAGEN_RENUNCIA } },
            },
            separador,
            ...bloques,
            separador,
            { type: 1, components: [boton(idTrabajo(userId, "gafete"), "Mejor me quedo")] },
        ],
    }]
}

/** Respuesta a "Pedir un aumento": no da nada, pero muestra el progreso al siguiente rango. */
function aumento({ puesto }) {
    const { rango } = puesto
    let cuerpo
    if (rango.siguiente) {
        const tramo = rango.siguiente.desde - rango.desde
        const progreso = Math.min(10, Math.max(0, Math.floor(10 * (rango.turnos - rango.desde) / tramo)))
        cuerpo = "Tu solicitud fue archivada con mucho cariño en un cajón sin fondo. Mientras tanto: " +
            `te faltan **${rango.siguiente.faltan}** ${rango.siguiente.faltan === 1 ? "turno" : "turnos"} para **${rango.siguiente.nombre}**.\n\n` +
            `-# ${"▰".repeat(progreso)}${"▱".repeat(10 - progreso)} ${lineaRango(rango)} como ${puesto.nombre}`
    } else {
        cuerpo = `Ya eres **${rango.nombre}**. Tu solicitud fue enmarcada y colgada en la sala de juntas. No hay aumento, pero hay marco.\n\n-# ${lineaRango(rango)} como ${puesto.nombre}`
    }

    return [{
        type: 17,
        accent_color: rango.titulo ? DORADO : null,
        components: [{
            type: 9,
            components: [texto("# Solicitud de aumento"), texto(cuerpo)],
            accessory: { type: 11, media: { url: IMAGEN_GAFETE } },
        }],
    }]
}

module.exports = { gafete, renuncia, aumento, fraseDelDia, DORADO }
