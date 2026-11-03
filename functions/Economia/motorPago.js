// functions/Economia/motorPago.js
// Motor de pago compartido de los trabajos. Todos los minijuegos pagan con la misma fórmula:
//   pago = floor(B · (0.75 + 0.5·c) · m_r) · d_n
// c ∈ [0, 1] es la calidad (aciertos / total), m_r el bono por antigüedad del rango en ese trabajo
// y d_n el factor del turno del día (retornos menguantes).
// Así el pago esperado es igual en todos los trabajos; solo cambia cómo se gana.
//
// Datos en el personaje (economia.trabajo):
//   jornada     { reinicio, turnosHoy }                → compartida entre todos los puestos; se reinicia a las 00:00 (México)
//   experiencia { [codigo]: { turnos } }               → por trabajo; se conserva al renunciar
//   (los puestos y la renuncia los maneja functions/Economia/minijuegosTrabajo.js)
//
// Flujo de un minijuego:
//   1. iniciarTurno()   → valida tope diario y energía; descuenta la energía y reserva el turno.
//   2. (el minijuego guarda el turnoId en el estado de su partida y se juega)
//   3. finalizarTurno() → calcula el pago con la calidad, paga, suma 1 turno de experiencia y cierra el registro.
//   Si el minijuego falla antes de jugarse: anularTurno() devuelve la energía y el turno.

const { ObjectId } = require("mongodb")
const clientdb = require("../../Server")
const db_rol = clientdb.db("Rol_db")
const personajes = db_rol.collection("Personajes")
const souls = db_rol.collection("Soul")
const registroPagos = db_rol.collection("Registro_pagos")
const { moverLumens } = require("./lumens")
const { recargarEnergia } = require("../dataCharacters")
const utilidadesTexto = require("../../utils/utilidadesTexto")

const CONFIG_PAGO = {
    base: 40,                                   // B: con c ∈ [0, 1] el pago bruto va de 30 a 50
    piso: 0.75,
    rango: 0.5,
    bonoPorRango: 0.025,                        // m_r = 1 + 0.025·(r − 1) → Insustituible ×1.10
    factoresTurno: [1, 1, 0.75, 0.5, 0.5, 0.5], // d_n por turno del día; del último en adelante se repite
    turnosMaxDia: 6,                            // Con c = 0.5: 40 · 4.25 = 170/día; techo con c = 1 y m_5: 232 (+50 del cofre)
}

// Rangos por turnos completados en un mismo trabajo
const RANGOS = [
    { nombre: "Novato", desde: 0 },
    { nombre: "Aprendiz", desde: 15 },
    { nombre: "Oficial", desde: 45, descuentoEnergia: 1 },
    { nombre: "Veterano", desde: 100, descuentoEnergia: 1 },
    { nombre: "Insustituible", desde: 180, descuentoEnergia: 1, titulo: true },
]

// Motivos con los que iniciarTurno() rechaza un turno (la UI los traduce en data/UI_ComponentsV2/trabajos.js)
const MOTIVOS = {
    SIN_PERSONAJE: "sin_personaje",
    TOPE_DIARIO: "tope_diario",
    SIN_ENERGIA: "sin_energia",
}

const ahoraSeg = () => Math.floor(Date.now() / 1000)

/** Identificador del día: el timestamp del próximo reinicio (00:00 hora México). Sirve también para mostrar <t:id:R>. */
const diaActual = (ahora = ahoraSeg()) => utilidadesTexto.reinicio24hrs(ahora)

/**
 * Rango de un trabajo según los turnos completados en él.
 * @param {number} turnos
 * @returns {{ r: number, nombre: string, desde: number, multiplicador: number, descuentoEnergia: number, titulo: boolean,
 *   turnos: number, siguiente: { nombre: string, desde: number, faltan: number } | null }}
 */
function rangoDe(turnos = 0) {
    const t = Math.max(0, Math.floor(turnos) || 0)
    const i = RANGOS.findLastIndex(r => t >= r.desde)
    const rango = RANGOS[i]
    const sig = RANGOS[i + 1]
    return {
        r: i + 1,
        nombre: rango.nombre,
        desde: rango.desde,
        multiplicador: 1 + CONFIG_PAGO.bonoPorRango * i,
        descuentoEnergia: rango.descuentoEnergia || 0,
        titulo: !!rango.titulo,
        turnos: t,
        siguiente: sig ? { nombre: sig.nombre, desde: sig.desde, faltan: sig.desde - t } : null,
    }
}

/** Energía que cuesta un turno de un trabajo para un rango. */
const costoEnergia = (energiaBase, rango) => Math.max(0, (energiaBase || 0) - (rango?.descuentoEnergia || 0))

/** d_n del turno n (1-indexado). */
function factorTurno(turnoDelDia) {
    const f = CONFIG_PAGO.factoresTurno
    const i = Math.min(Math.max(1, Math.floor(turnoDelDia) || 1), f.length) - 1
    return f[i]
}

/** Los turnos que lleva hoy el personaje (0 si su contador es de otro día). */
function turnosDeHoy(jornada, dia = diaActual()) {
    return jornada?.reinicio === dia ? (jornada.turnosHoy || 0) : 0
}

/**
 * Calcula el pago de un turno. Función pura: no toca la base de datos.
 * Los multiplicadores y bonos de eventos también pasan por d_n, para que ningún trabajo
 * escape de los retornos menguantes.
 * @param {number} calidad - c ∈ [0, 1]; se recorta al rango. Un turno sin minijuego es c = 0.
 * @param {number} turnoDelDia - 1 = primer turno del día
 * @param {Array<{ tipo: "mult"|"bono", valor: number, motivo?: string }>} [eventos]
 *   mult: multiplica el pago (evento x1.5). bono: suma fijo antes de d_n (propinas).
 * @param {number} [rango] - r ∈ {1..5} del trabajo (rangoDe(turnos).r)
 */
function calcularPago(calidad, turnoDelDia, eventos = [], rango = 1) {
    const { base, piso, rango: amplitud, bonoPorRango } = CONFIG_PAGO
    const c = Math.min(1, Math.max(0, Number(calidad) || 0))
    const r = Math.min(Math.max(1, Math.floor(rango) || 1), RANGOS.length)
    const multiplicadorRango = 1 + bonoPorRango * (r - 1)
    const bruto = Math.floor(base * (piso + amplitud * c) * multiplicadorRango)
    const dn = factorTurno(turnoDelDia)

    const validos = (Array.isArray(eventos) ? eventos : []).filter(e =>
        (e?.tipo === "mult" && Number.isFinite(e.valor) && e.valor > 0) ||
        (e?.tipo === "bono" && Number.isFinite(e.valor))
    )
    const multiplicador = validos.filter(e => e.tipo === "mult").reduce((m, e) => m * e.valor, 1)
    const bonos = validos.filter(e => e.tipo === "bono").reduce((s, e) => s + Math.floor(e.valor), 0)

    const pago = Math.max(0, Math.floor((bruto + bonos) * dn * multiplicador))

    return {
        calidad: c, base, rango: r, multiplicadorRango, bruto, bonos, factorTurno: dn, multiplicador, pago,
        turno: Math.floor(turnoDelDia) || 1, eventos: validos,
    }
}

/**
 * Estado de la jornada de un personaje (compartida entre sus puestos).
 * @param {Object} character - Documento de Personajes
 */
function estadoJornada(character, ahora = ahoraSeg()) {
    const dia = diaActual(ahora)
    const jornada = character?.economia?.trabajo?.jornada
    const turnosHoy = turnosDeHoy(jornada, dia)

    return {
        turnosHoy,
        turnosMax: CONFIG_PAGO.turnosMaxDia,
        siguienteFactor: factorTurno(turnosHoy + 1),
        reinicio: dia,
        topeAlcanzado: turnosHoy >= CONFIG_PAGO.turnosMaxDia,
    }
}

const PROYECCION_JORNADA = { projection: { "economia.trabajo.jornada": 1 } }

/**
 * Empieza un turno de trabajo. La energía se descuenta aquí, no al terminar, para que abandonar no salga gratis.
 * @param {Object} p
 * @param {string|number} p.characterId - _id del personaje activo (= _id del Soul)
 * @param {string} p.trabajo - Código del trabajo (bibliotecario, mensajero...)
 * @param {number} p.energia - Energía que cuesta el turno (ya con el descuento del rango)
 * @param {number} [p.rango] - r del trabajo al empezar; el pago usa este
 * @returns {Promise<{ ok: true, turnoId: string, turno: number, turnosMax: number, factorTurno: number, reinicio: number, energiaRestante: number }
 *   | { ok: false, motivo: string, reinicio?: number, energia?: number, energiaNecesaria?: number }>}
 */
async function iniciarTurno({ characterId, trabajo, energia = 0, rango = 1 }) {
    const ahora = ahoraSeg()
    const dia = diaActual(ahora)
    const { turnosMaxDia } = CONFIG_PAGO

    // ── Pre-validación (solo lectura) para dar el motivo exacto ──────────
    const character = await personajes.findOne({ _id: characterId }, PROYECCION_JORNADA)
    if (!character) return { ok: false, motivo: MOTIVOS.SIN_PERSONAJE }

    const jornada = estadoJornada(character, ahora)
    if (jornada.topeAlcanzado) return { ok: false, motivo: MOTIVOS.TOPE_DIARIO, reinicio: dia }

    // ── Energía: recargar y descontar de forma atómica ───────────────────
    const soul = await souls.findOne({ _id: characterId })
    const energiaActual = await recargarEnergia(soul)
    if (energia > 0) {
        const cobro = await souls.updateOne(
            { _id: characterId, "nucleo.energy": { $gte: energia } },
            { $inc: { "nucleo.energy": -energia } }
        )
        if (cobro.modifiedCount === 0) return { ok: false, motivo: MOTIVOS.SIN_ENERGIA, energia: energiaActual, energiaNecesaria: energia }
    }

    // ── Reservar el turno (atómico: dos comandos a la vez no pasan el tope) ──
    const filtroTurno = {
        _id: characterId,
        $or: [{ "economia.trabajo.jornada.reinicio": { $ne: dia } }, { "economia.trabajo.jornada.turnosHoy": { $lt: turnosMaxDia } }],
    }

    const previo = await personajes.findOneAndUpdate(filtroTurno, [{
        $set: {
            "economia.trabajo.jornada.turnosHoy": {
                $cond: [
                    { $eq: ["$economia.trabajo.jornada.reinicio", dia] },
                    { $add: [{ $ifNull: ["$economia.trabajo.jornada.turnosHoy", 0] }, 1] },
                    1,
                ]
            },
            "economia.trabajo.jornada.reinicio": dia,
        }
    }], { returnDocument: "before", ...PROYECCION_JORNADA })

    if (!previo) {
        // Otro turno se coló entre la lectura y la reserva y llegó al tope: devolver la energía
        if (energia > 0) await souls.updateOne({ _id: characterId }, { $inc: { "nucleo.energy": energia } })
        return { ok: false, motivo: MOTIVOS.TOPE_DIARIO, reinicio: dia }
    }

    const jornadaPrevia = previo.economia?.trabajo?.jornada ?? null
    const turno = turnosDeHoy(jornadaPrevia, dia) + 1

    const { insertedId } = await registroPagos.insertOne({
        characterId,
        trabajo,
        dia,
        turno,
        rango,
        energia,
        estado: "en_curso",
        inicio: ahora,
        // Para poder deshacer la reserva si el minijuego falla antes de jugarse
        previo: jornadaPrevia,
    })

    return {
        ok: true,
        turnoId: insertedId.toString(),
        turno,
        turnosMax: turnosMaxDia,
        factorTurno: factorTurno(turno),
        reinicio: dia,
        energiaRestante: Math.max(0, energiaActual - energia),
    }
}

/**
 * Cierra un turno, paga y suma 1 turno de experiencia en ese trabajo. El turno se reclama de forma atómica,
 * así que llamarlo dos veces (timeout + botón al mismo tiempo) solo paga una vez.
 * @param {Object} p
 * @param {string} p.turnoId - El que devolvió iniciarTurno (guárdalo en el estado de la partida, nunca en el custom_id)
 * @param {string|number} p.characterId
 * @param {number} p.calidad - c ∈ [0, 1]
 * @param {Array} [p.eventos] - Ver calcularPago
 * @param {Object} [p.detalle] - Datos del minijuego para el registro (aciertos, total, secuencia...)
 * @returns {Promise<{ ok: true, pago: number, desglose: Object, turno: number, turnosMax: number, reinicio: number,
 *   experiencia: { rango: Object, subioDeRango: boolean } } | { ok: false, motivo: "turno_invalido" }>}
 */
async function finalizarTurno({ turnoId, characterId, calidad, eventos = [], detalle = null }) {
    if (!ObjectId.isValid(turnoId)) return { ok: false, motivo: "turno_invalido" }
    const _id = new ObjectId(turnoId)

    const registro = await registroPagos.findOneAndUpdate(
        { _id, characterId, estado: "en_curso" },
        { $set: { estado: "procesando" } },
        { returnDocument: "after" }
    )
    if (!registro) return { ok: false, motivo: "turno_invalido" }

    const desglose = calcularPago(calidad, registro.turno, eventos, registro.rango)

    const pagado = desglose.pago > 0
        ? await moverLumens({
            personajeId: characterId, delta: desglose.pago, motivo: "trabajo", opId: `trabajo:${turnoId}`,
            ref: {
                trabajo: registro.trabajo, turno: registro.turno, calidad: desglose.calidad, base: desglose.bruto,
                bonusEvento: Math.max(0, desglose.pago - Math.floor(desglose.bruto * desglose.factorTurno)),
            },
        })
        : { ok: true }
    if (!pagado.ok) {
        // Dejarlo reclamable de nuevo en vez de perder el pago
        await registroPagos.updateOne({ _id }, { $set: { estado: "en_curso" } })
        throw new Error(`[motorPago] No se pudo pagar el turno ${turnoId}`)
    }

    const rutaExperiencia = `economia.trabajo.experiencia.${registro.trabajo}.turnos`
    const conExperiencia = await personajes.findOneAndUpdate(
        { _id: characterId },
        { $inc: { [rutaExperiencia]: 1 } },
        { returnDocument: "after", projection: { [rutaExperiencia]: 1 } }
    )
    const turnosTrabajo = conExperiencia?.economia?.trabajo?.experiencia?.[registro.trabajo]?.turnos ?? 0
    const rango = rangoDe(turnosTrabajo)

    await registroPagos.updateOne({ _id }, {
        $set: { estado: "pagado", fin: ahoraSeg(), calidad: desglose.calidad, pago: desglose.pago, desglose, detalle },
        $unset: { previo: "" },
    })

    return {
        ok: true,
        pago: desglose.pago,
        desglose,
        turno: registro.turno,
        turnosMax: CONFIG_PAGO.turnosMaxDia,
        reinicio: registro.dia,
        experiencia: { rango, subioDeRango: rango.r > rangoDe(turnosTrabajo - 1).r },
    }
}

/**
 * Deshace un turno que no llegó a jugarse (error al enviar el minijuego): devuelve la energía,
 * y el turno del día. No usar para abandonos: abandonar cuesta el turno.
 */
async function anularTurno({ turnoId, characterId }) {
    if (!ObjectId.isValid(turnoId)) return { ok: false }
    const _id = new ObjectId(turnoId)

    const registro = await registroPagos.findOneAndUpdate(
        { _id, characterId, estado: "en_curso" },
        { $set: { estado: "anulado", fin: ahoraSeg() } },
        { returnDocument: "before" }
    )
    if (!registro) return { ok: false }

    if (registro.energia > 0) await souls.updateOne({ _id: characterId }, { $inc: { "nucleo.energy": registro.energia } })

    // Solo restaurar si nadie ha reservado otro turno después (el contador sigue en este turno)
    await personajes.updateOne(
        { _id: characterId, "economia.trabajo.jornada.reinicio": registro.dia, "economia.trabajo.jornada.turnosHoy": registro.turno },
        registro.previo ? { $set: { "economia.trabajo.jornada": registro.previo } } : { $unset: { "economia.trabajo.jornada": "" } }
    )

    return { ok: true }
}

module.exports = {
    CONFIG_PAGO,
    RANGOS,
    MOTIVOS,
    rangoDe,
    costoEnergia,
    calcularPago,
    factorTurno,
    estadoJornada,
    iniciarTurno,
    finalizarTurno,
    anularTurno,
}
