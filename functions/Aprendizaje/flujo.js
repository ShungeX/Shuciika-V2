// ─── Aprendizaje: flujo de interacción ───────────────────────────────────────
// Usar una página → pantalla → Practicar <vía> → minijuego → resultado sobre la pantalla.
const servicio = require("./servicio")
const vista = require("./vista")
const { iniciarPractica } = require("./minijuegos")

const V2_EFIMERO = ["Ephemeral", "IsComponentsV2"]

/**
 * Pantalla de una página (al pulsar Usar). Nada se consume aquí.
 * @returns {Promise<{ ok: boolean, componentesV2?: Object[], mensaje?: string }>}
 */
async function abrirPagina({ character, soul, hechizoId, userId, aviso = null }) {
    if (!soul) return { ok: false, mensaje: vista.mensajeDe({ motivo: "sin_alma" }) }
    const estado = await servicio.estadoPagina({ character, soul, hechizoId })
    if (!estado.ok) return { ok: false, mensaje: vista.mensajeDe(estado) }
    return { ok: true, componentesV2: vista.construirPantalla(estado, { userId, aviso }) }
}

/**
 * Botón "Practicar <vía>": valida, consume el intento y arranca el minijuego. El resultado se
 * aplica cuando el minijuego termina (sin bloquear este handler).
 */
async function practicar(interaction, { character, soul, hechizoId, via }) {
    const userId = interaction.user.id
    const r = await servicio.iniciarIntento({ character, soulId: soul._id, userId, hechizoId, via })
    if (!r.ok) {
        // Repinta la pantalla con el motivo (o avisa si la página ya no está)
        const p = await abrirPagina({ character, soul: await refrescarAlma(soul), hechizoId, userId, aviso: `-# ${vista.mensajeDe(r)}` })
        if (p.ok) return interaction.update({ components: p.componentesV2, allowedMentions: { parse: [] } })
        return interaction.reply({ content: vista.mensajeDe(r), flags: ["Ephemeral"] })
    }

    const { sesion, hechizo } = r
    iniciarPractica(interaction, soul, hechizo, via)
        .then(res => cerrar(sesion, res))
        .catch(e => console.error(`[Aprendizaje] Error en la práctica ${sesion.id}:`, e))
}

async function refrescarAlma(soul) {
    const souls = require("../../Server").db("Rol_db").collection("Soul")
    return (await souls.findOne({ _id: soul._id })) || soul
}

/** El minijuego terminó: guarda el resultado y vuelve a pintar la pantalla de la página. */
async function cerrar(sesion, res) {
    let resultado
    if (res.error) {
        await servicio.devolverHuerfana(await refrescarAlma({ _id: sesion.soulId }))
        resultado = { error: true }
    } else {
        const fin = await servicio.terminarIntento({ sesion, puntaje: res.puntaje })
        resultado = { ...res, ...fin }
        if (!fin.ok && fin.motivo === "sesion_perdida") {
            return editar(sesion, { components: [{ type: 17, components: [{ type: 10, content: `-# ${vista.mensajeDe(fin)}` }] }] })
        }
    }

    const aviso = vista.textoResultado(resultado, sesion.via)
    if (resultado.aprendido) return editar(sesion, { components: vista.construirAprendido(sesion.hechizo, aviso) })

    const personajes = require("../../Server").db("Rol_db").collection("Personajes")
    const character = await personajes.findOne({ _id: sesion.characterId })
    const extra = resultado.aviso ? `\n-# ${vista.mensajeDe({ motivo: resultado.aviso })}` : ""
    const p = await abrirPagina({ character, soul: await refrescarAlma({ _id: sesion.soulId }), hechizoId: sesion.hechizo._id, userId: sesion.userId, aviso: aviso + extra })
    return editar(sesion, p.ok
        ? { components: p.componentesV2 }
        : { components: [{ type: 17, components: [{ type: 10, content: `${aviso}\n-# ${p.mensaje}` }] }] })
}

async function editar(sesion, payload) {
    try { await sesion.interaccion?.editReply({ ...payload, allowedMentions: { parse: [] } }) }
    catch (e) { console.error(`[Aprendizaje] No se pudo mostrar el resultado de ${sesion.id}:`, e.message) }
}

module.exports = { abrirPagina, practicar, cerrar, V2_EFIMERO }
