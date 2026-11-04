// ─── Menú del alma (Components V2) ───────────────────────────────────────────
// Vistas: principal (núcleo + efectos + convertir polvo), stats (mejora con FE)
// y equipamiento. Solo construyen JSON: los datos y la BD los resuelve quien llama.
const { crearCustomId } = require("../../utils/constructores/customId")
const {
    leerProgreso, costoFragmento, simularConversion, techoStatPorResplandor,
    STATS_MOSTRAR, STATS_MEJORABLES, COSTO_FE_POR_PUNTO, valorStat, mejorasCompradas,
} = require("../../functions/Economia/progresionEstelar")
const { esBeneficioso } = require("../../functions/Duelo/efectosPersistentes")

const IMAGEN_ALMA = "https://res.cloudinary.com/dn1cubayf/image/upload/v1737346978/idk3_v2s9hr.jpg?format=webp"
const MAX_SENDERO = 50       // resonancia/disonancia llegan hasta 50 (dialogoVinculos)
const MAX_EFECTOS_VISIBLES = 10

const texto = (content) => ({ type: 10, content })
const divisor = () => ({ type: 14, divider: true, spacing: 1 })
const miniatura = () => ({ type: 11, media: { url: IMAGEN_ALMA }, description: null, spoiler: false })

// ─── ANSI ────────────────────────────────────────────────────────────────────

const ESC = "\u001b"
const color = ([r, g, b]) => `${ESC}[38;2;${r};${g};${b}m`

/** Texto con degradado de color letra por letra (como la plantilla original). */
function degradado(cadena, desde, hasta) {
    const letras = [...cadena]
    const pasos = Math.max(1, letras.length - 1)
    return letras.map((l, i) => {
        const t = i / pasos
        const rgb = desde.map((c, k) => Math.round(c + (hasta[k] - c) * t))
        return color(rgb) + l
    }).join("") + `${ESC}[0m`
}

const VERDE = [[138, 200, 141], [126, 215, 222]]
const ROJO = [[232, 126, 140], [214, 150, 214]]

/** Bloque ```ansi``` con los efectos activos del personaje (o "Sin Efectos"). */
function bloqueEfectos(efectos = []) {
    const activos = (efectos || []).filter(e => (Number(e?.duracion) || 0) > 0)
    if (!activos.length) return "```ansi\n" + degradado("Sin Efectos", ...VERDE) + "\n```"

    const lineas = activos.slice(0, MAX_EFECTOS_VISIBLES).map(e => {
        const nombre = e.Nombre || e.nombre || e.id || "Efecto"
        const turnos = Math.floor(Number(e.duracion))
        const paleta = esBeneficioso(e) ? VERDE : ROJO
        return degradado(`✦ ${nombre}`, ...paleta) + `${ESC}[2;37m — ${turnos} turno${turnos === 1 ? "" : "s"}${ESC}[0m`
    })
    if (activos.length > MAX_EFECTOS_VISIBLES) lineas.push(`${ESC}[2;37m… y ${activos.length - MAX_EFECTOS_VISIBLES} más${ESC}[0m`)
    return "```ansi\n" + lineas.join("\n") + "\n```"
}

// ─── Selector "Otros menus..." ───────────────────────────────────────────────

function selectorOtrosMenus(userId, characterId, activo = null) {
    const opcion = (label, value, emoji) => ({ label, value, description: null, emoji: { name: emoji }, default: activo === value })
    return {
        type: 1,
        components: [{
            type: 3,
            custom_id: crearCustomId({ action: "selectPerfil", userId, characterId, extras: ["alma"] }),
            options: [
                opcion("Núcleo del alma", "alma", "✨"),
                opcion("Equipamiento", "equipamiento", "🥊"),
                opcion("Heraldo", "heraldo", "🌠"),
                opcion("Stats", "stats", "📊"),
            ],
            placeholder: "Otros menus...",
            min_values: 1,
            max_values: 1,
            disabled: false,
        }],
    }
}

// ─── Fila de navegación del perfil ───────────────────────────────────────────

/** Selector principal del perfil (perfil, galería, historia, alma, mascotas), con "alma" activo. */
function filaNavegacionPerfil(userId, characterId) {
    const opcion = (label, value, emoji) => ({ label, value, description: null, emoji, default: value === "alma", disabled: false })
    return {
        type: 1,
        components: [{
            type: 3,
            custom_id: crearCustomId({ action: "selectPerfil", userId, characterId }),
            options: [
                opcion("Perfil principal", "perfil", { name: "d9056043c1e148e38efd10e4515e33d2", id: "1356111301859868823" }),
                opcion("Apariencia [Galeria]", "galeria", { name: "EmuNui", id: "1370631281028890727" }),
                opcion("Historia [Lore]", "historia", { name: "BunnyBook", id: "1356111194997395496" }),
                opcion("Alma [Núcleo]", "alma", { name: "KrisJojos", id: "1350664814414004395" }),
                opcion("Mascotas [Nuevo]", "mascota", { name: "pets", id: "1356111134758932510" }),
            ],
            placeholder: "Selecciona una opción",
            min_values: 1,
            max_values: 1,
            disabled: false,
        }],
    }
}

// ─── Vista principal ─────────────────────────────────────────────────────────

/**
 * @param {Object} p
 * @param {Object} p.character - documento Personajes
 * @param {Object} p.soul - documento Soul
 * @param {String} p.userId - ID de Discord del dueño (para los customId)
 * @param {Object} [p.filaNavegacion] - action row del perfil, se agrega debajo del contenedor
 */
function construirAlmaMain({ character, soul, userId, filaNavegacion = null }) {
    const prog = leerProgreso(soul)
    const costo = costoFragmento(prog.ganados)
    const posibles = simularConversion(prog.polvo, prog.ganados).fragmentos
    const sendero = soul.sendero || {}
    const nucleo = soul.nucleo || {}
    const stats = soul.stats || {}

    const resonancia = Number(sendero.resonancia) || 0
    const disonancia = Number(sendero.disonancia) || 0
    const disonanciaPct = Math.round(Math.min(1, disonancia / MAX_SENDERO) * 100)
    const afinado = resonancia >= disonancia ? "Afinado" : "Desafinado"
    const heraldo = sendero.heraldo?.Nombre || sendero.heraldo?.nombre || (typeof sendero.heraldo === "string" ? sendero.heraldo : null)

    const contenedor = {
        type: 17,
        accent_color: null,
        spoiler: false,
        components: [
            {
                type: 9,
                accessory: miniatura(),
                components: [
                    texto(`### Alma de ${character.perfil?.Nombre || "Personaje"} [${prog.resplandorRomano}]`),
                    texto("-# 𝑻𝒖 𝒕𝒓𝒂𝒚𝒆𝒄𝒕𝒐 𝒉𝒂𝒄𝒊𝒂 𝒍𝒂𝒔 𝒆𝒔𝒕𝒓𝒆𝒍𝒍𝒂𝒔 . *. ⋆"),
                    texto(
                        `-# \`[✨]\`  FE: ${prog.disponibles}  ̸   Polvo Estelar: ${prog.polvo}\n` +
                        `-# \`[💫]\` Siguiente FE: ${costo} de polvo${posibles > 0 ? ` (puedes condensar ${posibles})` : ""}\n\n` +
                        `-# \`[🌠]\` Heraldo: ${heraldo || "No elegido"}\n` +
                        `-# \`[🏛️]\` Pilar: ${nucleo.Elemento || "Ninguno"}\n` +
                        `-# \`[🔮]\` Resonancia: ${afinado}`
                    ),
                ],
            },
            divisor(),
            {
                type: 9,
                accessory: {
                    type: 2,
                    style: 2,
                    label: "Convertir polvo",
                    emoji: null,
                    disabled: posibles === 0,
                    custom_id: crearCustomId({ action: "alma", userId, characterId: character._id, extras: ["convertir"] }),
                },
                components: [
                    texto(
                        `\n\n-# \`[💜]\` HP: ${nucleo.HP ?? 0}/${stats.hpMax ?? 0}   ̸   \`[💧]\` Mana: ${nucleo.Mana ?? 0}/${stats.manaMax ?? 0}\n` +
                        `-# \`[🖤]\` Disonancia: ${disonanciaPct}%\n\n` +
                        bloqueEfectos(nucleo.efectos)
                    ),
                ],
            },
            divisor(),
            selectorOtrosMenus(userId, character._id, "alma"),
        ],
    }

    return filaNavegacion ? [contenedor, filaNavegacion] : [contenedor]
}

// ─── Vista de stats ──────────────────────────────────────────────────────────

function construirAlmaStats({ character, soul, userId, filaNavegacion = null }) {
    const prog = leerProgreso(soul)
    const stats = soul.stats || {}
    const techo = techoStatPorResplandor(prog.resplandor)
    const puedeMejorar = prog.disponibles >= COSTO_FE_POR_PUNTO
        && STATS_MEJORABLES.some(c => mejorasCompradas(soul, c) < techo)

    const lineas = STATS_MOSTRAR.map(({ clave, nombre, emoji }) => {
        const valor = valorStat(stats, clave)
        if (!STATS_MEJORABLES.includes(clave)) return `- \`${emoji}\` ${nombre}: ${valor}`
        return `- \`${emoji}\` ${nombre}: ${valor}  \`[${mejorasCompradas(soul, clave)}/${techo}]\``
    })

    const contenedor = {
        type: 17,
        accent_color: null,
        spoiler: false,
        components: [
            {
                type: 9,
                accessory: miniatura(),
                components: [
                    texto(`### Estadísticas de ${character.perfil?.Nombre || "Personaje"}`),
                    texto(
                        `<a:PurpleCrystalHeart:1356497588131729458> \`FE:\` ${prog.disponibles}\n\n` +
                        "-# Los fragmentos estelares se obtienen convirtiendo polvo estelar. Los costos cambian de acuerdo a tu cantidad acumulativa total\n\n" +
                        `-# Mejorar **1** punto cuesta **${COSTO_FE_POR_PUNTO} FE**. Con Resplandor ${prog.resplandorRomano} puedes comprar hasta **${techo}** mejoras por stat \`[compradas/máximo]\`\n\n` +
                        "-# **¡Una vez asignes los fragmentos no los podrás cambiar [Temporalmente]**\n\n" +
                        "-# No todos los stats se pueden mejorar mediante fragmentos estelares."
                    ),
                ],
            },
            divisor(),
            {
                type: 9,
                accessory: {
                    type: 2,
                    style: 2,
                    label: "Mejorar stats",
                    emoji: null,
                    disabled: !puedeMejorar,
                    custom_id: crearCustomId({ action: "alma", userId, characterId: character._id, extras: ["mejorar"] }),
                },
                components: [texto("### Stats Principales:\n" + lineas.join("\n"))],
            },
            divisor(),
            texto(`-# Stats consultados hace: <t:${Math.floor(Date.now() / 1000)}:R>`),
            selectorOtrosMenus(userId, character._id, "stats"),
        ],
    }

    return filaNavegacion ? [contenedor, filaNavegacion] : [contenedor]
}

// ─── Vista de equipamiento ───────────────────────────────────────────────────

function construirAlmaEquipamiento({ character, userId, textoEquipamiento, filaNavegacion = null }) {
    const contenedor = {
        type: 17,
        accent_color: null,
        spoiler: false,
        components: [
            {
                type: 9,
                accessory: miniatura(),
                components: [
                    texto(`### Equipamiento de ${character.perfil?.Nombre || "Personaje"}`),
                    texto("-# Lo que el alma lleva consigo al combate."),
                ],
            },
            divisor(),
            texto(textoEquipamiento),
            divisor(),
            selectorOtrosMenus(userId, character._id, "equipamiento"),
        ],
    }
    return filaNavegacion ? [contenedor, filaNavegacion] : [contenedor]
}

/** Opciones del select de stats del modal "Mejorar stats" (solo los que no llegaron al techo). */
function opcionesMejora(soul) {
    const techo = techoStatPorResplandor(leerProgreso(soul).resplandor)
    return STATS_MOSTRAR
        .filter(s => STATS_MEJORABLES.includes(s.clave) && mejorasCompradas(soul, s.clave) < techo)
        .map(s => ({
            label: s.nombre,
            value: s.clave,
            description: `Actual: ${valorStat(soul.stats || {}, s.clave)} · Mejoras ${mejorasCompradas(soul, s.clave)}/${techo}`,
            emoji: { name: s.emoji },
        }))
}

module.exports = {
    filaNavegacionPerfil,
    construirAlmaMain,
    construirAlmaStats,
    construirAlmaEquipamiento,
    opcionesMejora,
    bloqueEfectos,
}
