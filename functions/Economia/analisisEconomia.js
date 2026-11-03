// ─────────────────────────────────────────────────────────────────────────────
// Análisis del libro de Lumens para moderación y alertas.
//
// Todo lo de aquí es para OJO HUMANO: nada alimenta la Reputación Social ni
// dispara sanciones automáticas. Las señales de transferencias solo se muestran
// en el panel y en el resumen diario; quien decide es una persona (regla 13).
// ─────────────────────────────────────────────────────────────────────────────
const { EmbedBuilder } = require("discord.js")
const clientdb = require("../../Server")
const db_rol = clientdb.db("Rol_db")
const personajes = db_rol.collection("Personajes")
const movimientos = db_rol.collection("econ_movimientos")
const actividad = db_rol.collection("econ_actividad")
const diario = db_rol.collection("econ_diario")
const { OFFSET_MEXICO_MS } = require("./lumens")

// Ingreso de trabajo que se considera el techo diario (≈ 220; ×1.1 con el rango máximo)
const TECHO_TRABAJO = 220
const CANAL_ALERTAS = process.env.ECON_ALERTAS_CANAL || "851207674267959306"
// Crecimiento diario del dinero total que merece un aviso informativo (0.05 = 5 %)
const CRECIMIENTO_MAX = Number(process.env.ECON_CRECIMIENTO_MAX) || 0.05
const RECEPCION_24H = 1000        // Lumens recibidos en un día desde pocos emisores
const EMISORES_POCOS = 2
const RECEPCION_RELEVANTE = 200   // mínimo para aparecer en "nunca gastan" y "cuentas nuevas"
const DIAS_CUENTA_NUEVA = 14
const VECES_LO_NORMAL = 3         // recibe ≥ 3× la mediana de los receptores

/** Inicio y fin (UTC) del día "YYYY-MM-DD" de México, con el mismo corte que el libro. */
function rangoDia(fecha) {
    const inicio = new Date(Date.parse(`${fecha}T00:00:00Z`) + OFFSET_MEXICO_MS)
    return { inicio, fin: new Date(inicio.getTime() + 86400_000) }
}

function mediana(valores) {
    if (!valores.length) return 0
    const o = [...valores].sort((a, b) => a - b)
    const m = Math.floor(o.length / 2)
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

/** Fecha de creación en ms; en fichas viejas viene en segundos o como texto ISO. */
function creadoEnMs(pj) {
    const v = pj?.metadata?.fechaCreacion
    if (typeof v === "number") return v < 1e12 ? v * 1000 : v
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : t
}

async function datosPersonajes(ids) {
    const docs = await personajes.find({ _id: { $in: [...ids] } }, { projection: { "perfil.Nombre": 1, ownerID: 1, userId: 1, "metadata.fechaCreacion": 1 } }).toArray()
    return new Map(docs.map(d => [String(d._id), {
        nombre: d.perfil?.Nombre ?? null,
        dueño: String(d.ownerID ?? d.userId ?? ""),
        creado: creadoEnMs(d),
    }]))
}

/**
 * Señales de transferencias en un periodo.
 * @param {Date} desde
 * @param {Date} [hasta]
 */
async function analizarTransferencias(desde, hasta = new Date()) {
    // Solo la mitad que recibe: cada fila es una arista emisor → receptor
    const filas = await movimientos.find(
        { tipo: "transferencia", delta: { $gt: 0 }, ts: { $gte: desde, $lt: hasta } },
        { projection: { personajeId: 1, userId: 1, delta: 1, motivo: 1, "ref.contrapartePersonajeId": 1, ts: 1 } }
    ).toArray()

    const receptores = new Map()    // pj → { recibido, n, emisores:Set, motivos }
    const enviados = new Map()      // pj → total enviado
    const contrapartes = new Map()  // pj → Set de con quién movió dinero (en cualquier sentido)
    const aristas = new Map()       // "a|b" (a<b) → { a, b, aAb, bAa, n }

    for (const f of filas) {
        const r = String(f.personajeId), e = String(f.ref?.contrapartePersonajeId ?? "?")
        const rec = receptores.get(r) || { recibido: 0, n: 0, emisores: new Set(), motivos: {} }
        rec.recibido += f.delta; rec.n++; rec.emisores.add(e)
        rec.motivos[f.motivo] = (rec.motivos[f.motivo] || 0) + f.delta
        receptores.set(r, rec)
        enviados.set(e, (enviados.get(e) || 0) + f.delta)
        for (const [x, y] of [[r, e], [e, r]]) {
            if (!contrapartes.has(x)) contrapartes.set(x, new Set())
            contrapartes.get(x).add(y)
        }
        const [a, b] = r < e ? [r, e] : [e, r]
        const clave = `${a}|${b}`
        const ar = aristas.get(clave) || { a, b, aAb: 0, bAa: 0, n: 0 }
        if (e === a) ar.aAb += f.delta; else ar.bAa += f.delta
        ar.n++
        aristas.set(clave, ar)
    }

    const ids = new Set([...receptores.keys(), ...enviados.keys()].filter(x => x !== "?").map(x => Number.isNaN(Number(x)) ? x : Number(x)))
    const info = await datosPersonajes(ids)
    const nombre = (id) => info.get(String(id))?.nombre ?? null

    // Quién recibe más de lo normal
    const med = mediana([...receptores.values()].map(r => r.recibido))
    const listaReceptores = [...receptores].map(([id, r]) => ({
        personajeId: id, nombre: nombre(id), recibido: r.recibido, n: r.n, emisores: r.emisores.size,
        enviado: enviados.get(id) || 0, vecesLoNormal: med ? Number((r.recibido / med).toFixed(1)) : null, motivos: r.motivos,
        marcado: med > 0 && r.recibido >= VECES_LO_NORMAL * med,
    })).sort((a, b) => b.recibido - a.recibido)

    // Pares: los que solo se mueven dinero entre sí, o que comparten dueño
    const pares = [...aristas.values()].map(ar => {
        const soloEntreSi = contrapartes.get(ar.a)?.size === 1 && contrapartes.get(ar.b)?.size === 1
        const dA = info.get(ar.a)?.dueño, dB = info.get(ar.b)?.dueño
        return {
            a: { personajeId: ar.a, nombre: nombre(ar.a) }, b: { personajeId: ar.b, nombre: nombre(ar.b) },
            aAb: ar.aAb, bAa: ar.bAa, total: ar.aAb + ar.bAa, n: ar.n,
            soloEntreSi, mismoDueño: Boolean(dA && dA === dB),
        }
    }).sort((x, y) => (y.soloEntreSi + y.mismoDueño) - (x.soloEntreSi + x.mismoDueño) || y.total - x.total)

    // Reciben y nunca gastan (ni tienda, ni purificación, ni nada que saque dinero)
    const relevantes = listaReceptores.filter(r => r.recibido >= RECEPCION_RELEVANTE)
    const conGasto = new Set((await movimientos.distinct("personajeId", {
        personajeId: { $in: relevantes.map(r => Number.isNaN(Number(r.personajeId)) ? r.personajeId : Number(r.personajeId)) },
        delta: { $lt: 0 }, tipo: { $ne: "transferencia" }, ts: { $gte: desde, $lt: hasta },
    })).map(String))
    const sinGasto = relevantes.filter(r => !conGasto.has(String(r.personajeId)) && r.enviado === 0)

    // Cuentas nuevas que reciben mucho
    const limiteNueva = Date.now() - DIAS_CUENTA_NUEVA * 86400_000
    const nuevas = relevantes
        .filter(r => (info.get(String(r.personajeId))?.creado ?? 0) >= limiteNueva)
        .map(r => ({ ...r, creado: info.get(String(r.personajeId)).creado }))

    return {
        desde, hasta,
        totales: { transferencias: filas.length, lumens: filas.reduce((s, f) => s + f.delta, 0), receptores: receptores.size, medianaRecibida: med },
        umbrales: { vecesLoNormal: VECES_LO_NORMAL, recepcionRelevante: RECEPCION_RELEVANTE, diasCuentaNueva: DIAS_CUENTA_NUEVA },
        receptores: listaReceptores.slice(0, 25),
        pares: pares.slice(0, 25),
        sinGasto: sinGasto.slice(0, 25),
        nuevas: nuevas.slice(0, 25),
    }
}

/**
 * Alertas del día `fecha`, a partir de su foto (ya guardada por tomarSnapshot).
 * @returns {Promise<Array<{ nivel: "critico"|"aviso"|"info", texto: string }>>}
 */
async function calcularAlertas(fecha, foto) {
    const alertas = []
    const { inicio, fin } = rangoDia(fecha)

    for (const n of foto.negativos || []) {
        alertas.push({ nivel: "critico", texto: `Saldo negativo: ${n.nombre ?? "sin nombre"} (#${n.personajeId}) tiene ${n.saldo} Lumens.` })
    }
    if (foto.cuadre?.ok === false) {
        alertas.push({ nivel: "critico", texto: `El día no cuadra: el dinero cambió ${foto.cuadre.deltaM}, fuentes − sumideros = ${foto.cuadre.flujo} (diferencia ${foto.cuadre.diferencia}). Algo movió Lumens sin pasar por el registro.${foto.tardio ? " (Foto tardía: el bot estaba apagado en el corte.)" : ""}` })
    }

    const limite = Math.round(TECHO_TRABAJO * 1.2)
    const altos = await actividad.find({ fecha, ingresoTrabajo: { $gt: limite } }, { projection: { personajeId: 1, ingresoTrabajo: 1, turnos: 1 } }).toArray()
    if (altos.length) {
        const info = await datosPersonajes(altos.map(a => a.personajeId))
        for (const a of altos) {
            alertas.push({ nivel: "aviso", texto: `Ingreso de trabajo alto: ${info.get(String(a.personajeId))?.nombre ?? "sin nombre"} (#${a.personajeId}) ganó ${a.ingresoTrabajo} en ${a.turnos ?? "?"} turnos (techo × 1.2 = ${limite}).` })
        }
    }

    const t = await analizarTransferencias(inicio, fin)
    for (const r of t.receptores) {
        if (r.recibido > RECEPCION_24H && r.emisores <= EMISORES_POCOS) {
            alertas.push({ nivel: "aviso", texto: `Recepción concentrada: ${r.nombre ?? "sin nombre"} (#${r.personajeId}) recibió ${r.recibido} Lumens de ${r.emisores} emisor(es).` })
        }
    }

    if (foto.cuadre?.anterior > 0) {
        const crecimiento = (foto.total - foto.cuadre.anterior) / foto.cuadre.anterior
        if (crecimiento > CRECIMIENTO_MAX) {
            alertas.push({ nivel: "info", texto: `El dinero total creció ${(crecimiento * 100).toFixed(1)} % en el día (límite ${(CRECIMIENTO_MAX * 100).toFixed(0)} %).` })
        }
    }
    return alertas
}

const ICONO = { critico: "🔴", aviso: "🟡", info: "🔵" }

/** Manda el resumen diario al canal privado. Siempre se manda, haya o no alertas. */
async function enviarResumenDiario(client, fecha, foto, alertas) {
    if (!client) return
    const canal = client.channels.cache.get(CANAL_ALERTAS) || await client.channels.fetch(CANAL_ALERTAS).catch(() => null)
    if (!canal?.send) {
        console.warn(`[Economía] No encuentro el canal de alertas ${CANAL_ALERTAS}`)
        return
    }

    const contadores = await diario.findOne({ _id: fecha })
    const suma = (g) => Object.values(g || {}).reduce((s, x) => s + (x?.total || 0), 0)
    const fmt = (n) => (n ?? 0).toLocaleString("es-MX")
    const cuadre = foto.cuadre?.ok === true ? "✓ cuadra" : foto.cuadre?.ok === false ? `✕ no cuadra (diferencia ${fmt(foto.cuadre.diferencia)})` : "— sin día anterior"

    const hay = (nivel) => alertas.some(a => a.nivel === nivel)
    const color = hay("critico") ? 0xe66767 : hay("aviso") ? 0xc98500 : 0x3fb27f

    // El embed admite 4096 caracteres en la descripción; si hay muchas alertas se corta con aviso
    let lista = alertas.map(a => `${ICONO[a.nivel]} ${a.texto}`).join("\n")
    if (lista.length > 3800) lista = lista.slice(0, 3800) + "\n… (ver el resto en el panel Registro de Lumens)"

    const embed = new EmbedBuilder()
        .setTitle(`Economía · resumen del ${fecha}`)
        .setColor(color)
        .setDescription(lista || "Sin alertas. ✨")
        .addFields(
            { name: "Dinero total", value: `${fmt(foto.total)} (${foto.cuadre?.deltaM >= 0 ? "+" : ""}${fmt(foto.cuadre?.deltaM)})`, inline: true },
            { name: "Entró / salió", value: `+${fmt(suma(contadores?.fuentes))} / −${fmt(suma(contadores?.sumideros))}`, inline: true },
            { name: "Cuadre", value: cuadre, inline: true },
            { name: "Distribución", value: `mediana ${fmt(foto.mediana)} · media ${fmt(foto.media)} · Gini ${foto.gini}`, inline: false },
        )
        .setFooter({ text: "Solo informativo: ninguna alerta aplica sanciones ni toca la Reputación." })
        .setTimestamp()

    await canal.send({ embeds: [embed] })
}

module.exports = { analizarTransferencias, calcularAlertas, enviarResumenDiario, TECHO_TRABAJO, rangoDia }
