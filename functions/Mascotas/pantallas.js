// functions/Mascotas/pantallas.js
// Junta datos (./servicio.js) y paneles (./vista.js). Cada pantalla devuelve:
//   { components, anuncios }  → `components` reemplaza el mensaje; `anuncios` son tarjetas efímeras
//   que se mandan aparte (nacimientos) con anunciar().

const servicio = require("./servicio")
const vista = require("./vista")
const config = require("../../config/config")

const V2_EFIMERO = ["Ephemeral", "IsComponentsV2"]

/** Roturas como texto para la cabecera del panel; nacimientos como tarjetas aparte. */
function repartirAvisos(avisos, aviso) {
    const lineas = aviso ? [aviso] : []
    const anuncios = []
    for (const a of avisos) {
        if (a.tipo === "roto") lineas.push(`\`[💔]\` Tu **${a.nombre}** se quedó sin cuidados y el cascarón se rompió...`)
        if (a.tipo === "nacio") {
            lineas.push(`\`[🐣]\` ¡Tu **${a.pet.nacimiento?.huevo?.Nombre || "huevo"}** ha eclosionado! Nació **${a.pet.tipo}** (${vista.rarezaTexto(a.pet.rareza)}).`)
            anuncios.push(vista.mensajeNacimiento(a.pet))
        }
    }
    return { aviso: lineas.length ? lineas.join("\n") : null, anuncios }
}

/**
 * Panel de mascotas de un personaje.
 * @param {Object} p
 * @param {string} p.userId - quien lo mira
 * @param {Object} p.character - personaje dueño de las mascotas
 * @param {boolean} p.puedeCuidar - true solo si es el personaje activo de quien mira
 * @param {"p"|"e"} [p.origen]
 * @param {string|null} [p.aviso]
 */
async function mascotas({ userId, character, puedeCuidar, origen = "p", aviso = null }) {
    const datos = await servicio.cargar(character._id, { reconocer: puedeCuidar })
    const r = repartirAvisos(datos.avisos, aviso)
    const comun = { userId, character, huevos: datos.huevos, puedeCuidar, aviso: r.aviso, origen }
    const components = datos.activa
        ? vista.panelMascota({ ...comun, pet: datos.activa, mascotas: datos.mascotas })
        : vista.panelSinMascotas(comun)
    return { components, anuncios: r.anuncios }
}

/** Panel de huevos del personaje activo (siempre lo mira su dueño). */
async function huevos({ userId, character, soul, origen = "p", aviso = null }) {
    const datos = await servicio.leer(character._id, { reconocer: true })
    const r = repartirAvisos(datos.avisos, aviso)
    const components = vista.panelHuevos({
        userId, character, origen,
        huevos: datos.huevos,
        energia: await servicio.energiaDe(soul),
        maxEnergia: config.maxEnergy,
        tieneIncubadora: servicio.tieneIncubadora(character),
        aviso: r.aviso,
    })
    return { components, anuncios: r.anuncios }
}

/** Pregunta cómo criar un huevo del inventario (todavía no se consume nada). */
async function nuevoHuevo({ userId, character, soul, def }) {
    const opciones = await servicio.opcionesDeCrianza({ character, soul })
    return { components: vista.panelNuevoHuevo({ userId, def, opciones }), anuncios: [] }
}

/** Manda las tarjetas pendientes de una pantalla como mensajes efímeros. */
async function anunciar(interaction, pantalla) {
    for (const components of pantalla?.anuncios || []) {
        await interaction.followUp({ components, flags: V2_EFIMERO, allowedMentions: { parse: [] } }).catch(() => { })
    }
}

module.exports = { mascotas, huevos, nuevoHuevo, anunciar, V2_EFIMERO }
