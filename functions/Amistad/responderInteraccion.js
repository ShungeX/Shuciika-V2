// ─────────────────────────────────────────────────────────────────────────────
// El receptor elige su respuesta en el menú de una interacción.
// custom_id: amistad*tipo*idEmisor*idReceptor*timestamp*cadena
//
// Se enruta desde eventos/interactionCreate/handleCommands.js ANTES de
// manejarComponente, porque ese router separa con "-" y este formato usa "*".
//
// Aquí (y no al enviar) es donde se aplican los puntos.
//
// Intercambio (respuestas con `continua`, hoy solo "Devolver" en las hostiles):
// el mismo mensaje se reutiliza con los roles invertidos. Quien devolvió pasa a
// ser el emisor (su foto, su gif) y se hace ping al otro, que puede volver a
// devolver. La `cadena` del custom_id sube en 1 cada vez. Cualquier otra
// respuesta ("No hacer nada", "Ofenderse"...) cierra el menú.
// ─────────────────────────────────────────────────────────────────────────────
const { getActiveCharacter } = require("../../utils/getDataCharacters")
const { menuInteraccion } = require("../../data/UI_ComponentsV2/menuInteraccion")
const { decodificarPendiente, codificarPendiente, estaExpirado } = require("./customIdAmistad")
const { resolverInteraccion, resultadoExpirado, lineaPuntos } = require("./amistades")
const { accionPorTipo, RESPUESTAS } = require("./accionesInteraccion")
const { nombrePj, gifRespuesta, opcionesMenu, programarExpiracion } = require("./vistaInteraccion")
const pendientes = require("./pendientes")
const duelo = require("./dueloAutomatico")
const cfg = require("../../config/amistad")
const { FIRMA, FIRMA_NEGATIVA } = require("./reglasAmistad")

// Evita que dos clics casi simultáneos sobre el mismo mensaje se procesen dos veces.
// (Después del primero el menú queda deshabilitado o cambia de dueño, pero eso tarda un instante.)
const enProceso = new Set()

const efimero = (interaction, content) => interaction.reply({ content, flags: ["Ephemeral"] })

/** Recupera del mensaje lo que no viaja en el custom_id: la primera línea, el gif y el avatar. */
function extraerBase(message) {
    const raw = message?.components?.[0]?.toJSON?.() ?? message?.components?.[0] ?? {}
    const hijos = raw.components || []
    const seccion = hijos.find(c => c.type === 9)
    const texto = seccion?.components?.[0]?.content ?? hijos.find(c => c.type === 10)?.content ?? ""
    return {
        lineaAccion: texto.split("\n")[0],
        avatar: seccion?.accessory?.media?.url ?? null,
        gif: hijos.find(c => c.type === 12)?.items?.[0]?.media?.url ?? null,
    }
}

/** Línea extra cuando el rango cambia (o se queda topado por el límite de Mejores amigos). */
function lineaRango(r) {
    if (r.limiteMejoresAmigos) return `-# Su lazo ya es de mejores amigos, pero alguno de los dos ya tiene el corazón lleno ${FIRMA}`
    if (!r.cambioRango || !r.rango) return null
    const n = r.rango.nombre
    if (r.rango.estado === "especial") return `-# Su lazo ahora es **${n}**... ¿qué les pasó? ${FIRMA_NEGATIVA}`
    if (r.rango.estado === "rival" || r.rango.estado === "enemigo") return `-# Su lazo ahora es **${n}** ${FIRMA_NEGATIVA}`
    if (r.subioRango) return `-# ¡Su lazo ahora es **${n}**! ${FIRMA}`
    return `-# Se han distanciado un poquito... su lazo ahora es **${n}**`
}

/**
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
module.exports = async function responderInteraccion(client, interaction) {
    const p = decodificarPendiente(interaction.customId)
    if (!p) return efimero(interaction, `Esta interacción ya no es válida ${FIRMA}`)

    // Solo responde el receptor actual. En un intercambio el receptor cambia en
    // cada vuelta (va en el custom_id), así que nadie puede responderse a sí mismo.
    const { character: pjClic } = await getActiveCharacter(interaction.user.id, { character: true })
    if (!pjClic || String(pjClic._id) !== p.a) {
        return efimero(interaction, `Esta respuesta le toca a otra persona, pero gracias por querer ayudar ${FIRMA}`)
    }

    const msgId = interaction.message?.id
    if (enProceso.has(msgId)) return interaction.deferUpdate().catch(() => { })
    enProceso.add(msgId)

    try {
        // Resolver lee/escribe en Mongo y busca un gif: puede pasar de los 3 s que
        // da Discord, así que se confirma el clic primero y luego se edita el mensaje.
        await interaction.deferUpdate()
        const avisar = (content) => interaction.followUp({ content, flags: ["Ephemeral"] })

        const accion = accionPorTipo(p.tipo)
        const base = extraerBase(interaction.message)
        const elegida = interaction.values?.[0]
        const opcion = RESPUESTAS[cfg.TIPOS[p.tipo].categoria].find(o => o.valor === elegida)

        const cerrar = ({ texto, placeholder, valor, avatar = base.avatar, gif = base.gif }) => interaction.editReply({
            components: menuInteraccion({
                texto,
                avatar,
                gif,
                customId: interaction.customId,
                opciones: opcionesMenu(p.tipo, valor),
                placeholder,
                deshabilitado: true,
            }),
            flags: ["IsComponentsV2"],
            allowedMentions: { parse: [] },
        })
        const expirar = () => {
            pendientes.liberar(p.tipo, p.de, p.a, p.ts)
            return cerrar({ texto: `${base.lineaAccion}\n${lineaPuntos(resultadoExpirado(p.tipo))}`, placeholder: "Se quedó en el aire" })
        }

        // Expiró: vale 0 y no es rechazo. No se escribe nada en la base de datos.
        if (estaExpirado(p)) return expirar()
        if (!opcion) return avisar(`No reconozco esa respuesta ${FIRMA}`)

        const { character: pjEmisor } = await getActiveCharacter(null, { character: true, characterID: p.de })
        if (!pjEmisor) return expirar()

        // HP = 0: quien está inconsciente no responde ni "rechaza" nada. Si alguno
        // cayó a 0 con el menú pendiente (p. ej. en un duelo), expira con valor 0.
        const [almaE, almaR] = await Promise.all([duelo.obtenerAlma(pjEmisor._id), duelo.obtenerAlma(pjClic._id)])
        if (duelo.hpCero(almaE) || duelo.hpCero(almaR)) return expirar()

        const res = await resolverInteraccion({ tipo: p.tipo, respuesta: opcion.valor, emisor: pjEmisor, receptor: pjClic })
        if (!res.ok) return avisar(res.texto || `Algo se me enredó, ¿lo intentas otra vez? ${FIRMA}`)

        pendientes.liberar(p.tipo, p.de, p.a, p.ts)
        const r = res.resultado
        const nE = nombrePj(pjEmisor)
        const nR = nombrePj(pjClic)

        // La foto pasa a quien respondió y el gif a su reacción.
        const avatar = pjClic.perfil?.avatarURL || null
        const gif = await gifRespuesta(accion, opcion, interaction.guildId)
        const reaccion = opcion.reaccion.replaceAll("{r}", nR).replaceAll("{e}", nE)
        const cuerpo = [
            lineaPuntos(r),
            lineaRango(r),
            r.resultado === "correspondida" && accion
                ? `-# ${accion.contador(r.historial.correspondidas, nE, nR)}`
                : null,
        ].filter(Boolean)

        // ── ¿Sigue el intercambio? ──────────────────────────────────────────
        const continua = !!cfg.TIPOS[p.tipo].respuestas[opcion.valor]?.continua
        if (continua) {
            const ts = Date.now()
            const de = p.a          // quien devolvió ahora es el emisor
            const a = p.de
            const cadena = p.cadena + 1

            // ── Easter egg: ¿escala a duelo? ────────────────────────────────
            // golpes = el original + cada devolución. Con umbral 3, al cuarto golpe.
            // No depende de los puntos: funciona aunque se haya llegado al tope diario.
            const umbral = cfg.UMBRAL_DUELO?.[p.tipo]
            const golpes = cadena + 1
            if (umbral && golpes > umbral) {
                const v = await duelo.verificarDuelo(client, pjEmisor, pjClic)
                if (!v.ok) {
                    return cerrar({ texto: [reaccion, ...cuerpo, `-# ${v.texto}`].join("\n"), placeholder: opcion.label, valor: opcion.valor, avatar, gif })
                }
                await interaction.editReply({
                    components: menuInteraccion({
                        texto: [reaccion, ...cuerpo, "", duelo.anuncioDuelo(pjClic, pjEmisor)].join("\n"),
                        avatar,
                        gif: duelo.gifDuelo(),
                        customId: interaction.customId,
                        opciones: opcionesMenu(p.tipo, opcion.valor),
                        placeholder: "¡A pelear!",
                        deshabilitado: true,
                        pie: `-# <@${pjClic.ownerID}> <@${pjEmisor.ownerID}>`,
                    }),
                    flags: ["IsComponentsV2"],
                    allowedMentions: { users: [String(pjClic.ownerID), String(pjEmisor.ownerID)] },
                })
                const ok = await duelo.iniciarDueloAmistoso(client, pjClic, pjEmisor, [almaR, almaE]).catch(e => {
                    console.error("[Amistad] No se pudo iniciar el duelo automático:", e)
                    return false
                })
                if (!ok) await avisar(`El duelo no logró arrancar, pero no se rompió nada ${FIRMA}`).catch(() => { })
                return
            }

            // Si ya hay una pendiente en ese sentido (p. ej. también usó /punch por
            // su cuenta), no se duplica: este mensaje se cierra normal.
            if (pendientes.reservar(p.tipo, de, a, ts)) {
                const customId = codificarPendiente({ tipo: p.tipo, de, a, ts, cadena })
                await interaction.editReply({
                    components: menuInteraccion({
                        texto: [reaccion, ...cuerpo, `-# ¿Qué hará **${nE}**?`].join("\n"),
                        avatar,
                        gif,
                        customId,
                        opciones: opcionesMenu(p.tipo),
                        pie: `-# <@${pjEmisor.ownerID}>`,
                    }),
                    flags: ["IsComponentsV2"],
                    allowedMentions: { users: [String(pjEmisor.ownerID)] },
                })
                programarExpiracion(interaction, { tipo: p.tipo, de, a, ts, lineaAccion: reaccion, avatar, gif, customId })
                return
            }
        }

        // ── Cierre ──────────────────────────────────────────────────────────
        return cerrar({ texto: [base.lineaAccion, reaccion, ...cuerpo].join("\n"), placeholder: opcion.label, valor: opcion.valor, avatar, gif })
    } catch (e) {
        console.error("[Amistad] Error al responder la interacción:", e)
        const content = `Algo se me enredó, ¿lo intentas otra vez? ${FIRMA}`
        if (interaction.deferred || interaction.replied) return interaction.followUp({ content, flags: ["Ephemeral"] }).catch(() => { })
        return efimero(interaction, content).catch(() => { })
    } finally {
        enProceso.delete(msgId)
    }
}
