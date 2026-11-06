// ─────────────────────────────────────────────────────────────────────────────
// Ejecutor común de /interact <acción> y /act dance.
//
// Casos:
//   • Sin objetivo                 → mensaje "solo" (no toca amistad)
//   • Objetivo = uno mismo         → mensaje "a sí mismo"
//   • Objetivo = Shuciika          → respuesta de Shuciika (contador casual)
//   • Personaje ↔ personaje        → SISTEMA DE AMISTAD: mensaje con menú para el
//                                    receptor; los puntos se aplican al responder
//                                    (functions/Amistad/responderInteraccion.js)
//   • Alguno sin personaje         → interacción casual entre cuentas (contador
//                                    viejo de Interaccion.ContadorC, sin puntos)
//
// El personaje del emisor es SIEMPRE su personajeActivo, nunca su ID de Discord.
// ─────────────────────────────────────────────────────────────────────────────
const getGifs = require("../getGifs")
const { getActiveCharacter } = require("../../utils/getDataCharacters")
const incInteractions = require("./incInteractions")
const { menuInteraccion } = require("../../data/UI_ComponentsV2/menuInteraccion")
const { ACCIONES, azar } = require("./accionesInteraccion")
const { codificarPendiente } = require("./customIdAmistad")
const { validarPareja } = require("./amistades")
const pendientes = require("./pendientes")
const { FIRMA } = require("./reglasAmistad")
const { nombrePj, obtenerGif, opcionesMenu, programarExpiracion } = require("./vistaInteraccion")
const { obtenerAlma, hpCero } = require("./dueloAutomatico")
const cfg = require("../../config/amistad")
const { evaluarPermisoPrivacidad } = require("../privacidad")
const dbRol = require("../../Server").db("Rol_db")

const efimero = (interaction, content) => interaction.reply({ content, flags: ["Ephemeral"] })

const sustituir = (texto, u) => (typeof texto === "function" ? texto() : texto).replaceAll("{u}", u)

/** Mensaje simple sin menú (solo, a sí mismo, Shuciika, casual). */
function responderSimple(interaction, { texto, gif, avatar }) {
    return interaction.reply({
        components: menuInteraccion({ texto, gif, avatar }),
        flags: ["IsComponentsV2"],
        allowedMentions: { parse: [] },
    })
}

/**
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} subcomando  clave de ACCIONES (hug, slap...)
 */
module.exports = async function ejecutarInteraccion(client, interaction, subcomando) {
    const accion = ACCIONES[subcomando]
    if (!accion) return efimero(interaction, `Esa acción todavía no está lista ${FIRMA}`)

    const usuarioObjetivo = interaction.options.getUser("usuario")
    const pjObjetivoId = interaction.options.getInteger("personaje")
    const yo = interaction.member?.displayName || interaction.user.username

    const { character: pjEmisor } = await getActiveCharacter(interaction.user.id, { character: true })

    // ── Sin objetivo ────────────────────────────────────────────────────────
    if (!usuarioObjetivo && !pjObjetivoId) {
        const gif = accion.solo.gifs ? azar(accion.solo.gifs) : await obtenerGif(accion, interaction.guildId)
        return responderSimple(interaction, { texto: sustituir(accion.solo.texto, pjEmisor ? nombrePj(pjEmisor) : yo), gif })
    }

    // ── Resolver al receptor ────────────────────────────────────────────────
    let pjReceptor = null
    if (pjObjetivoId) {
        if (!pjEmisor) {
            return efimero(interaction, "Esta opción solo está disponible con un **personaje registrado** (｡• ᵕ • ｡)\nSi quieres crear tu personaje usa **`/rol crear-personaje`**")
        }
        ;({ character: pjReceptor } = await getActiveCharacter(null, { character: true, characterID: pjObjetivoId }))
        if (!pjReceptor) {
            return efimero(interaction, `No encuentro a ningún alumno con el ID **${pjObjetivoId}** (・・ ) ?\n-# ¿Lo revisamos otra vez?`)
        }
        if (String(pjReceptor._id) === String(pjEmisor._id)) {
            const gif = accion.aSiMismo.gifs ? azar(accion.aSiMismo.gifs) : await obtenerGif(accion, interaction.guildId)
            return responderSimple(interaction, { texto: sustituir(accion.aSiMismo.texto, nombrePj(pjEmisor)), gif })
        }
    } else {
        if (usuarioObjetivo.id === interaction.user.id) {
            const gif = accion.aSiMismo.gifs ? azar(accion.aSiMismo.gifs) : await obtenerGif(accion, interaction.guildId)
            return responderSimple(interaction, { texto: sustituir(accion.aSiMismo.texto, yo), gif })
        }
        if (usuarioObjetivo.id === client.user.id) {
            const { couple: n } = await incInteractions(interaction, usuarioObjetivo.id, subcomando, true)
            const r = accion.bot(n, `${interaction.member}`)
            const gif = r.gif || (r.gifNekos ? (await getGifs(r.gifNekos)).url : await obtenerGif(accion, interaction.guildId))
            return responderSimple(interaction, { texto: r.texto, gif })
        }
        if (pjEmisor && !usuarioObjetivo.bot) {
            ;({ character: pjReceptor } = await getActiveCharacter(usuarioObjetivo.id, { character: true }))
        }
    }

    // ── Casual: alguno de los dos no tiene personaje ────────────────────────
    if (!pjEmisor || !pjReceptor) {
        const otro = interaction.guild.members.cache.get(usuarioObjetivo.id)?.displayName || usuarioObjetivo.username
        const { couple: n } = await incInteractions(interaction, usuarioObjetivo.id, subcomando, true)
        const gif = await obtenerGif(accion, interaction.guildId)
        return responderSimple(interaction, {
            texto: `**${yo}** ${azar(accion.textos)} **${otro}** ${azar(accion.caritas)}\n-# ${accion.contador(n, yo, otro)}`,
            gif,
        })
    }

    // ── Sistema de amistad (personaje ↔ personaje) ──────────────────────────
    const valida = validarPareja(pjEmisor, pjReceptor)
    if (!valida.ok) return efimero(interaction, valida.texto)

    const tipo = accion.tipo

    // HP = 0: quien está inconsciente no puede lanzar interacciones, y nadie
    // puede lanzarle una hostil. (Las afectuosas sí se envían; si sigue a 0 al
    // responder, la interacción expira con valor 0.)
    const [almaE, almaR] = await Promise.all([obtenerAlma(pjEmisor._id), obtenerAlma(pjReceptor._id)])
    if (hpCero(almaE)) {
        return efimero(interaction, `Ahora mismo te faltan fuerzas para esto. Primero recupérate un poquito ${FIRMA}
-# Puedes usar un objeto desde \`/rol inventario\``)
    }
    if (hpCero(almaR) && cfg.TIPOS[tipo].categoria === "hostil") {
        return efimero(interaction, `**${nombrePj(pjReceptor)}** está sin fuerzas ahora mismo, dejemos que descanse ${FIRMA}`)
    }

    // Privacidad "Interacciones" del receptor. El bloqueo se evalúa primero y
    // siempre gana (dentro de evaluarPermisoPrivacidad). Si no la configuró, se usa
    // el valor por defecto de la categoría (hostiles: Solo amigos).
    // El mensaje no dice si fue bloqueo o nivel: nadie debe enterarse de que lo bloquearon.
    const porDefecto = cfg.PRIVACIDAD_INTERACCIONES[cfg.TIPOS[tipo].categoria] || "todos"
    if (!await evaluarPermisoPrivacidad(pjReceptor, pjEmisor, "interacciones", dbRol, porDefecto)) {
        return efimero(interaction, `Parece que **${nombrePj(pjReceptor)}** prefiere no recibir esto ahora mismo. ¡Quizá más adelante! ${FIRMA}`)
    }

    const de = String(pjEmisor._id)
    const a = String(pjReceptor._id)
    const ts = Date.now()

    if (!pendientes.reservar(tipo, de, a, ts)) {
        return efimero(interaction, `Ya le enviaste algo así a **${nombrePj(pjReceptor)}**, dale tiempito para responder ${FIRMA}`)
    }

    try {
        const customId = codificarPendiente({ tipo, de, a, ts, cadena: 0 })
        const gif = await obtenerGif(accion, interaction.guildId)
        const lineaAccion = `**${nombrePj(pjEmisor)}** ${azar(accion.textos)} **${nombrePj(pjReceptor)}** ${azar(accion.caritas)}`
        const avatar = pjEmisor.perfil?.avatarURL

        await interaction.reply({
            components: menuInteraccion({
                texto: `${lineaAccion}\n-# ¿Qué hará **${nombrePj(pjReceptor)}**?`,
                avatar,
                gif,
                customId,
                opciones: opcionesMenu(tipo),
                pie: `-# <@${pjReceptor.ownerID}>`,
            }),
            flags: ["IsComponentsV2"],
            allowedMentions: { users: [String(pjReceptor.ownerID)] },
        })

        programarExpiracion(interaction, { tipo, de, a, ts, lineaAccion, avatar, gif, customId })
    } catch (e) {
        pendientes.liberar(tipo, de, a, ts)
        console.error("[Amistad] No se pudo enviar la interacción:", e)
        if (!interaction.replied) return efimero(interaction, `Algo se me enredó al enviarlo, ¿lo intentas otra vez? ${FIRMA}`).catch(() => { })
    }
}

