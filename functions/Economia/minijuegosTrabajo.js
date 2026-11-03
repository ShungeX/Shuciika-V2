// functions/Economia/minijuegosTrabajo.js
// Lógica del sistema de trabajos: el gafete (menú), puestos, renuncia y los minijuegos.
// El estado de cada partida vive aquí, en el servidor: las respuestas se validan contra él,
// nunca contra el custom_id (que solo dice qué botón se pulsó).
// Una sola partida activa por usuario; la partida queda atada al personaje activo que la empezó.
//
// Datos en el personaje (economia.trabajo):
//   puestos     { principal: { code, desde, renunciaEn? } | null, boost: {...} | null }
//   activo      "principal" | "boost"  → en qué puesto trabaja (el de boost solo cuenta con boost activo)
//   experiencia { [code]: { turnos } } → por trabajo, se conserva al renunciar (la suma motorPago.js)
//   jornada     { reinicio, turnosHoy } → la maneja motorPago.js
//
// Cada partida es un turno del motor de pago: iniciarTurno() al empezar (cobra energía) y
// finalizarTurno() al terminar con la calidad c = aciertos / total.

const clientdb = require("../../Server")
const db_rol = clientdb.db("Rol_db")
const personajes = db_rol.collection("Personajes")
const souls = db_rol.collection("Soul")
const { trabajos } = require("../../data/economia/economia")
const { AGENTES, MANCHAS, SALAS, PISTA_TUTORIAL } = require("../../data/economia/limpieza")
const { recargarEnergia } = require("../dataCharacters")
const motor = require("./motorPago")
const ui = require("../../data/UI_ComponentsV2/trabajos")
const menu = require("../../data/UI_ComponentsV2/menuTrabajo")

const ROL_BOOST = "796205038665072661"
const SLOTS = ["principal", "boost"]
const RUTA = "economia.trabajo"
const SEGUNDOS_RENUNCIA = 24 * 60 * 60  // Preaviso: la carta tarda un día en procesarse

const BIBLIOTECA = {
    colores: ["Rojo", "Morado", "Verde", "Azul", "Naranja", "Amarillo", "Rosa"],
    largo: 5,               // Libros a recordar
    segundosPorLibro: 10,
    esperaInicio: 6,        // Segundos para memorizar (fuera del tutorial)
}

const MENSAJERO = {
    letras: ["A", "B", "C", "D", "E", "F", "G", "H"],
    nombres: ["Kevin", "Sandra", "Milly", "Lucas", "Elena", "David", "Soledad", "Hikari", "Yume", "Miyu", "Kaito", "Emu", "Hinata", "Yuu", "Kumo"],
    paquetes: 4,
    segundosPrimera: 20,
    segundosEntrega: 15,
    esperaInicio: 12,
    pausaResultado: 5,
    segundosDecidir: 20,    // Para elegir "continuar" tras una ronda
}

const LIMPIEZA = {
    usosPorAgente: 2,       // 7 manchas, 8 usos: se puede jugar perfecto con un solo error de margen
    minutosInactividad: 3,  // Entre acciones. Se paga precisión, no velocidad: solo evitan abandonos
    minutosTotal: 10,
}

const SEGUNDOS_ABANDONO = 120   // Tutorial sin pulsar "Comenzar": se cierra el turno con calidad 0

/** userId → partida */
const partidas = new Map()

const ahoraSeg = () => Math.floor(Date.now() / 1000)
const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)]
function barajar(lista) {
    for (let i = lista.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lista[i], lista[j]] = [lista[j], lista[i]]
    }
    return lista
}

const efimero = (components) => ({ components, flags: ["IsComponentsV2", "Ephemeral"] })
const avisoEfimero = (interaction, titulo, cuerpo) => interaction.reply(efimero(ui.avisoTrabajo(titulo, cuerpo)))

const esBooster = (member) => member?.roles?.cache?.has(ROL_BOOST) ?? false
const estaTrabajando = (userId) => partidas.has(userId)
const nombreDe = (character) => character.perfil?.Nombre ?? "Empleado"

// ── Empleo: puestos, rango y renuncia perezosa ───────────────────────────

/**
 * Lee el empleo del personaje y procesa las renuncias vencidas (sin cron: se limpian al abrir).
 * @returns {Promise<{ puestos: { principal: Object|null, boost: Object|null }, activo: string, experiencia: Object, jornada: Object, procesadas: string[] }>}
 */
async function cargarEmpleo(character) {
    const t = character.economia?.trabajo || {}
    const puestos = { principal: t.puestos?.principal ?? null, boost: t.puestos?.boost ?? null }
    const procesadas = []
    const ahora = ahoraSeg()

    for (const slot of SLOTS) {
        const p = puestos[slot]
        if (!p?.renunciaEn || p.renunciaEn > ahora) continue
        // El filtro por renunciaEn evita borrar el puesto si la renuncia se retiró entretanto
        await personajes.updateOne(
            { _id: character._id, [`${RUTA}.puestos.${slot}.renunciaEn`]: p.renunciaEn },
            { $set: { [`${RUTA}.puestos.${slot}`]: null } }
        )
        procesadas.push(trabajos[p.code]?.nombre ?? p.code)
        puestos[slot] = null
    }

    return {
        puestos,
        activo: t.activo === "boost" ? "boost" : "principal",
        experiencia: t.experiencia || {},
        jornada: motor.estadoJornada(character),
        procesadas,
    }
}

/** El puesto en el que trabaja ahora: el elegido si se puede usar; si no, el otro. */
function puestoActivo(empleo, booster) {
    const usable = (slot) => !!empleo.puestos[slot] && (slot === "principal" || booster)
    const preferido = booster && empleo.activo === "boost" ? "boost" : "principal"
    const slot = usable(preferido) ? preferido : SLOTS.find(usable)
    return slot ? describirPuesto(empleo, slot) : null
}

function describirPuesto(empleo, slot) {
    const p = empleo.puestos[slot]
    const rango = motor.rangoDe(empleo.experiencia[p.code]?.turnos || 0)
    return {
        slot,
        code: p.code,
        nombre: trabajos[p.code]?.nombre ?? p.code,
        desde: p.desde,
        renunciaEn: p.renunciaEn || null,
        rango,
        costo: motor.costoEnergia(trabajos[p.code]?.energia, rango),
    }
}

const codigosOcupados = (empleo) => SLOTS.map(s => empleo.puestos[s]?.code).filter(Boolean)

async function energiaDe(character, soul) {
    const s = soul ?? await souls.findOne({ _id: character._id })
    return s ? await recargarEnergia(s) : 0
}

/** Responde editando el mensaje del componente o con un mensaje nuevo (comando). */
const responder = (interaction, components, actualizar) => actualizar
    ? interaction.update({ components })
    : interaction.reply({ components, flags: ["IsComponentsV2", "SuppressNotifications"] })

// ── Menú (gafete) ────────────────────────────────────────────────────────

/**
 * Abre el gafete del personaje activo; sin ningún puesto, la lista de empleos.
 * @param {{ actualizar?: boolean, aviso?: string }} [op]
 */
async function abrirMenu(interaction, character, soul, { actualizar = false, aviso } = {}) {
    const empleo = await cargarEmpleo(character)
    const booster = esBooster(interaction.member)
    const avisos = [aviso, ...empleo.procesadas.map(n => `Tu renuncia como **${n}** fue procesada. Recursos Humanos ya quitó tu foto del muro.`)].filter(Boolean)

    if (!empleo.puestos.principal && !empleo.puestos.boost) {
        return responder(interaction, ui.listaTrabajos({ userId: interaction.user.id, slot: "principal", excluir: [], aviso: avisos.join("\n") }), actualizar)
    }

    const activo = puestoActivo(empleo, booster)
    const otroSlot = SLOTS.find(s => s !== activo?.slot && empleo.puestos[s])
    const otro = otroSlot ? { ...describirPuesto(empleo, otroSlot), enPausa: otroSlot === "boost" && !booster } : null

    return responder(interaction, menu.gafete({
        userId: interaction.user.id,
        nombre: nombreDe(character),
        booster,
        energia: await energiaDe(character, soul),
        jornada: empleo.jornada,
        activo,
        otro,
        sinPrincipal: !empleo.puestos.principal,
        avisos,
    }), actualizar)
}

/** Lista de empleos para ocupar un puesto (principal o el de boost). */
async function mostrarLista(interaction, character, slot, pagina = 1, { actualizar = true } = {}) {
    if (slot === "boost" && !esBooster(interaction.member)) return avisoEfimero(interaction, "Sin boost activo", "El puesto extra es un beneficio para quienes boostean el servidor.")
    const empleo = await cargarEmpleo(character)
    const tienePuesto = !!(empleo.puestos.principal || empleo.puestos.boost)
    return responder(interaction, ui.listaTrabajos({
        userId: interaction.user.id, pagina, slot, excluir: codigosOcupados(empleo), volver: tienePuesto,
    }), actualizar)
}

/** Select del gafete. */
async function accionMenu(interaction, character, soul, accion) {
    const empleo = await cargarEmpleo(character)
    const booster = esBooster(interaction.member)
    const activo = puestoActivo(empleo, booster)

    switch (accion) {
        case "trabajar":
            if (!activo) return mostrarLista(interaction, character, "principal")
            return empezarTrabajo(interaction, character, { actualizar: true })

        case "aumento":
            await abrirMenu(interaction, character, soul, { actualizar: true })
            if (!activo) return interaction.followUp(efimero(ui.avisoTrabajo("Sin puesto", "Primero consigue un trabajo; luego hablamos de dinero.")))
            return interaction.followUp(efimero(menu.aumento({ puesto: activo })))

        case "renunciar": {
            const ocupados = SLOTS.filter(s => empleo.puestos[s]).map(s => describirPuesto(empleo, s))
            return interaction.update({ components: menu.renuncia({ userId: interaction.user.id, puestos: ocupados }) })
        }

        case "cambiar": {
            if (!booster) return avisoEfimero(interaction, "Sin boost activo", "Cambiar de puesto es un beneficio para quienes boostean el servidor.")
            if (!empleo.puestos.boost) return mostrarLista(interaction, character, "boost")
            const destino = activo?.slot === "boost" ? "principal" : "boost"
            if (!empleo.puestos[destino]) return mostrarLista(interaction, character, destino)
            if (estaTrabajando(interaction.user.id)) return avisoEfimero(interaction, "Estás trabajando", "Termina tu jornada actual antes de cambiar de puesto.")

            await personajes.updateOne({ _id: character._id }, { $set: { [`${RUTA}.activo`]: destino } })
            character.economia = { ...character.economia, trabajo: { ...character.economia?.trabajo, activo: destino } }
            return abrirMenu(interaction, character, soul, { actualizar: true, aviso: `Ahora trabajas como **${trabajos[empleo.puestos[destino].code]?.nombre}**.` })
        }

        case "buscar":
            return mostrarLista(interaction, character, "principal")

        default:
            return interaction.deferUpdate()
    }
}

/** Select de la lista de empleos: ocupa el puesto vacío. */
async function postular(interaction, character, soul, slot, codigo) {
    if (!SLOTS.includes(slot)) return interaction.deferUpdate()
    if (!trabajos[codigo]) return avisoEfimero(interaction, "Trabajo no disponible", "Este trabajo ya no está disponible. (┬┬﹏┬┬)")
    if (slot === "boost" && !esBooster(interaction.member)) return avisoEfimero(interaction, "Sin boost activo", "El puesto extra es un beneficio para quienes boostean el servidor.")

    const empleo = await cargarEmpleo(character)
    if (empleo.puestos[slot]) return avisoEfimero(interaction, "Puesto ocupado", "Ya tienes trabajo en ese puesto. Si quieres otro, primero renuncia (con dignidad).")
    if (codigosOcupados(empleo).includes(codigo)) return avisoEfimero(interaction, "Ya trabajas ahí", "Elige un trabajo distinto al que ya tienes.")

    const puesto = { code: codigo, desde: ahoraSeg() }
    // Atómico: si otro clic ocupó el puesto entretanto, no se pisa
    const r = await personajes.updateOne(
        { _id: character._id, $or: [{ [`${RUTA}.puestos.${slot}`]: null }, { [`${RUTA}.puestos.${slot}`]: { $exists: false } }] },
        { $set: { [`${RUTA}.puestos.${slot}`]: puesto, [`${RUTA}.activo`]: slot } }
    )
    if (r.modifiedCount === 0) return avisoEfimero(interaction, "Puesto ocupado", "Ya tienes trabajo en ese puesto.")

    const trabajo = { ...character.economia?.trabajo, puestos: { ...empleo.puestos, [slot]: puesto }, activo: slot }
    character.economia = { ...character.economia, trabajo }
    return abrirMenu(interaction, character, soul, {
        actualizar: true,
        aviso: `Bienvenido a tu nuevo trabajo, **${nombreDe(character)}**. Ahora trabajas en: **${trabajos[codigo].nombre}**`,
    })
}

/** Botones de la pantalla de renuncia. */
async function tramitarRenuncia(interaction, character, soul, op, slot) {
    if (!SLOTS.includes(slot)) return interaction.deferUpdate()
    const empleo = await cargarEmpleo(character)
    const puesto = empleo.puestos[slot]
    if (!puesto) return abrirMenu(interaction, character, soul, { actualizar: true, aviso: "Ese puesto ya estaba vacío." })
    const nombre = trabajos[puesto.code]?.nombre ?? puesto.code
    const ruta = `${RUTA}.puestos.${slot}.renunciaEn`

    if (op === "firmar") {
        if (puesto.renunciaEn) return abrirMenu(interaction, character, soul, { actualizar: true })
        const renunciaEn = ahoraSeg() + SEGUNDOS_RENUNCIA
        await personajes.updateOne({ _id: character._id, [`${RUTA}.puestos.${slot}.code`]: puesto.code }, { $set: { [ruta]: renunciaEn } })
        puesto.renunciaEn = renunciaEn
        return abrirMenu(interaction, { ...character, economia: { ...character.economia, trabajo: { ...character.economia?.trabajo, puestos: empleo.puestos } } }, soul, {
            actualizar: true,
            aviso: `Firmaste tu renuncia como **${nombre}**. Tu carta se procesa <t:${renunciaEn}:R>; mientras tanto puedes seguir trabajando o retirarla.`,
        })
    }

    if (op === "retirar") {
        await personajes.updateOne({ _id: character._id }, { $unset: { [ruta]: "" } })
        delete puesto.renunciaEn
        return abrirMenu(interaction, { ...character, economia: { ...character.economia, trabajo: { ...character.economia?.trabajo, puestos: empleo.puestos } } }, soul, {
            actualizar: true,
            aviso: `Retiraste tu renuncia como **${nombre}**. Recursos Humanos finge sorpresa.`,
        })
    }

    return interaction.deferUpdate()
}

// ── Utilidades de partida ────────────────────────────────────────────────

const ficha = (p) => ({ trabajo: p.codigo, empleado: p.nombrePj, rango: p.rango, energia: p.energia })

/**
 * Programa la siguiente acción de la partida; si la partida ya terminó o fue reemplazada, no hace nada.
 * @param {string} [campo] - Temporizador a usar ("timer" el normal, "timerTotal" el límite de la partida)
 */
function programar(p, segundos, accion, campo = "timer") {
    clearTimeout(p[campo])
    p[campo] = setTimeout(() => {
        if (partidas.get(p.userId) !== p) return
        accion().catch(e => console.error(`[trabajos] Error en ${p.tipo} (${p.userId}):`, e))
    }, segundos * 1000)
}

/** Saca la partida del mapa. Devuelve false si ya estaba cerrada (timeout y botón a la vez). */
function cerrar(p) {
    if (partidas.get(p.userId) !== p) return false
    clearTimeout(p.timer)
    clearTimeout(p.timerTotal)
    partidas.delete(p.userId)
    return true
}

/** Redibuja el mensaje del minijuego con la última interacción recibida. */
async function enviar(p, components) {
    const i = p.interaccion
    try {
        if (i.isMessageComponent() && !i.replied && !i.deferred) await i.update({ components })
        else await i.editReply({ components })
    } catch (e) {
        console.error(`[trabajos] No se pudo actualizar el minijuego de ${p.userId}:`, e.message)
    }
}

/** Reconoce la interacción antes de trabajo lento con la base de datos (Discord da 3 s); luego enviar() usa editReply. */
async function reconocer(p) {
    const i = p.interaccion
    if (i.isMessageComponent() && !i.replied && !i.deferred) await i.deferUpdate().catch(() => { })
}

/** Primer mensaje del minijuego. Lanza si falla, para anular el turno. */
async function mostrarInicio(p, components, actualizar) {
    if (actualizar) {
        await p.interaccion.update({ components })
        p.messageId = p.interaccion.message.id
    } else {
        const respuesta = await p.interaccion.reply({ components, flags: ["IsComponentsV2", "SuppressNotifications"], withResponse: true })
        p.messageId = respuesta.resource.message.id
    }
}

/** Tras pagar: el rango puede haber subido (afecta el pago y la energía del siguiente turno). */
function aplicarExperiencia(p, resultado) {
    p.rango = resultado.experiencia.rango
    p.costo = motor.costoEnergia(trabajos[p.codigo].energia, p.rango)
}

/**
 * La partida de este usuario, si la interacción le corresponde: mismo tipo de juego,
 * mismo personaje activo que la empezó y mismo mensaje.
 */
function partidaDe(interaction, character, tipo) {
    const p = partidas.get(interaction.user.id)
    if (!p || p.tipo !== tipo) return null
    if (String(p.characterId) !== String(character._id)) return null
    if (p.messageId && interaction.message?.id !== p.messageId) return null
    return p
}

const interaccionVencida = (interaction) => avisoEfimero(interaction,
    "Interacción vencida",
    "Esta jornada ya no está disponible. (┬┬﹏┬┬)\n-# Es posible que hayas intentado interactuar con otro mensaje de trabajo, o que hayas cambiado de personaje."
)

// ── Entrada común ────────────────────────────────────────────────────────

/**
 * Reserva el turno en el motor de pago y lanza el minijuego del puesto activo.
 * @param {{ actualizar?: boolean }} [op] - true si viene de un componente (se edita ese mensaje en vez de responder)
 */
async function empezarTrabajo(interaction, character, { actualizar = false } = {}) {
    const userId = interaction.user.id
    if (estaTrabajando(userId)) return avisoEfimero(interaction, "Ya estás trabajando", "Termina tu jornada actual antes de empezar otra. (┬┬﹏┬┬)")

    const empleo = await cargarEmpleo(character)
    const puesto = puestoActivo(empleo, esBooster(interaction.member))
    const trabajo = trabajos[puesto?.code]
    if (!puesto || !trabajo) return avisoEfimero(interaction, "Sin puesto", "No tienes un trabajo disponible. Usa `/rol trabajar` para buscar uno.")

    // Apartar el lugar antes de esperar a la base de datos, para que dos comandos seguidos no creen dos partidas
    const p = {
        userId, tipo: "iniciando", characterId: character._id, codigo: puesto.code, nombrePj: nombreDe(character),
        rango: puesto.rango, costo: puesto.costo, interaccion: interaction, tutorial: puesto.rango.turnos === 0,
    }
    partidas.set(userId, p)

    const turno = await motor.iniciarTurno({ characterId: character._id, trabajo: puesto.code, energia: puesto.costo, rango: puesto.rango.r })
        .catch(e => { partidas.delete(userId); throw e })
    if (!turno.ok) {
        partidas.delete(userId)
        return interaction.reply(efimero(ui.turnoRechazado(turno)))
    }
    p.turnoId = turno.turnoId
    p.energia = turno.energiaRestante

    try {
        if (puesto.code === "bibliotecario") return await iniciarBiblioteca(p, actualizar)
        if (puesto.code === "mensajero") return await iniciarMensajero(p, actualizar)
        if (puesto.code === "limpieza") return await iniciarLimpieza(p, actualizar)
        return await sinMinijuego(p, actualizar)
    } catch (error) {
        // El minijuego no llegó a mostrarse: devolver energía y turno
        cerrar(p)
        await motor.anularTurno({ turnoId: p.turnoId, characterId: p.characterId })
        throw error
    }
}

/** Trabajos que aún no tienen minijuego: cuentan como calidad 0 (el piso del pago). */
async function sinMinijuego(p, actualizar) {
    p.tipo = "sin_minijuego"
    const resultado = await motor.finalizarTurno({ turnoId: p.turnoId, characterId: p.characterId, calidad: 0, detalle: { minijuego: false } })
    cerrar(p)
    if (!resultado.ok) return

    const costo = p.costo
    aplicarExperiencia(p, resultado)
    await mostrarInicio(p, ui.marcoTrabajo(ficha(p), [
        ...ui.reciboPago({
            resultado,
            titulo: "Has trabajado arduamente",
            resumen: "-# Este trabajo aún no tiene minijuego, así que se paga el salario base.",
            imagen: trabajos[p.codigo].img,
            energiaGastada: costo,
        }),
        ui.volverAlGafete(p.userId),
    ]), actualizar)
}

// ── Biblioteca: recordar la secuencia de libros ──────────────────────────

async function iniciarBiblioteca(p, actualizar) {
    Object.assign(p, {
        tipo: "biblioteca",
        secuencia: Array.from({ length: BIBLIOTECA.largo }, () => alAzar(BIBLIOTECA.colores)),
        indice: 0,
        aciertos: 0,
        elegidos: [],
        fase: "memorizar",
    })

    await mostrarInicio(p, ui.marcoTrabajo(ficha(p), ui.bibliotecaIntro({
        userId: p.userId, secuencia: p.secuencia, segundosPorLibro: BIBLIOTECA.segundosPorLibro, tutorial: p.tutorial,
    })), actualizar)

    if (p.tutorial) programar(p, SEGUNDOS_ABANDONO, () => terminarBiblioteca(p, "Te fuiste sin empezar a ordenar los libros."))
    else programar(p, BIBLIOTECA.esperaInicio, () => tableroBiblioteca(p))
}

async function tableroBiblioteca(p, aviso) {
    p.fase = "jugando"
    await enviar(p, ui.marcoTrabajo(ficha(p), ui.bibliotecaTablero({
        userId: p.userId, colores: BIBLIOTECA.colores, elegidos: p.elegidos, aviso, finEn: ui.enSegundos(BIBLIOTECA.segundosPorLibro),
    })))
    programar(p, BIBLIOTECA.segundosPorLibro, () => terminarBiblioteca(p, "Se acabó el tiempo para acomodar el libro."))
}

/** Botón de la biblioteca: "start" (tutorial) o un color. */
async function pulsarBiblioteca(interaction, character, opcion) {
    const p = partidaDe(interaction, character, "biblioteca")
    if (!p) return interaccionVencida(interaction)
    p.interaccion = interaction

    if (opcion === "start") {
        if (p.fase !== "memorizar") return interaction.deferUpdate()
        return tableroBiblioteca(p)
    }
    if (p.fase !== "jugando" || !BIBLIOTECA.colores.includes(opcion)) return interaction.deferUpdate()

    const esperado = p.secuencia[p.indice]
    if (opcion !== esperado) {
        return terminarBiblioteca(p, `¡Incorrecto! Esperaba **${esperado}** pero elegiste **${opcion}**. El orden de los libros se ha perdido.`)
    }

    p.aciertos++
    p.indice++
    p.elegidos.push(opcion)
    if (p.indice < p.secuencia.length) return tableroBiblioteca(p, "¡Correcto! ¿Cual es el siguiente libro?")
    return terminarBiblioteca(p)
}

async function terminarBiblioteca(p, aviso) {
    if (!cerrar(p)) return
    await reconocer(p)

    const resultado = await motor.finalizarTurno({
        turnoId: p.turnoId,
        characterId: p.characterId,
        calidad: p.aciertos / p.secuencia.length,
        detalle: { aciertos: p.aciertos, total: p.secuencia.length, secuencia: p.secuencia, elegidos: p.elegidos },
    })
    if (!resultado.ok) return
    const costo = p.costo
    aplicarExperiencia(p, resultado)

    const logro = p.aciertos === p.secuencia.length
        ? "¡Increíble! Organizaste todos los libros perfectamente."
        : `Organizaste **${p.aciertos}** de **${p.secuencia.length}** libros.`

    await enviar(p, ui.marcoTrabajo(ficha(p), [
        ...ui.reciboPago({ resultado, titulo: "Mini-juego finalizado", resumen: aviso ? `-# ${aviso}\n${logro}` : logro, energiaGastada: costo }),
        { type: 10, content: `-# Orden correcto: ${p.secuencia.join(", ")}\n-# Tu secuencia: ${p.elegidos.length ? p.elegidos.join(", ") : "No acertaste ninguna"}` },
        ui.volverAlGafete(p.userId),
    ]))
}

// ── Mensajero: asociar paquetes con personas ─────────────────────────────

function nuevaRondaMensajero(p) {
    const nombres = barajar([...MENSAJERO.nombres]).slice(0, MENSAJERO.paquetes)
    const letras = barajar(MENSAJERO.letras.slice(0, MENSAJERO.paquetes))
    Object.assign(p, {
        paquetes: letras.map((letra, i) => ({ letra, nombre: nombres[i] })),
        letrasRestantes: [...letras],
        pendientes: [...nombres],
        aciertos: 0,
        persona: null,
        primera: true,
        fase: "memorizar",
    })
}

const pantallaIntroMensajero = (p) => ui.marcoTrabajo(ficha(p), ui.mensajeroIntro({
    userId: p.userId, paquetes: p.paquetes, segundosPorEntrega: MENSAJERO.segundosPrimera, tutorial: p.tutorial, empiezaEn: ui.enSegundos(MENSAJERO.esperaInicio),
}))

async function iniciarMensajero(p, actualizar) {
    Object.assign(p, { tipo: "mensajero", acumulado: 0, rondas: 0 })
    nuevaRondaMensajero(p)
    await mostrarInicio(p, pantallaIntroMensajero(p), actualizar)

    if (p.tutorial) programar(p, SEGUNDOS_ABANDONO, () => abandonarMensajero(p))
    else programar(p, MENSAJERO.esperaInicio, () => siguienteEntrega(p))
}

/** Botón "Comenzar" del tutorial del mensajero. */
async function comenzarMensajero(interaction, character) {
    const p = partidaDe(interaction, character, "mensajero")
    if (!p) return interaccionVencida(interaction)
    if (p.fase !== "memorizar") return interaction.deferUpdate()
    p.interaccion = interaction
    return siguienteEntrega(p)
}

async function siguienteEntrega(p) {
    p.fase = "entregando"
    p.persona = alAzar(p.pendientes)
    const segundos = p.primera ? MENSAJERO.segundosPrimera : MENSAJERO.segundosEntrega

    await enviar(p, ui.marcoTrabajo(ficha(p), ui.mensajeroEntrega({
        userId: p.userId, persona: p.persona, letras: p.letrasRestantes, finEn: ui.enSegundos(segundos), primera: p.primera,
    })))
    p.primera = false
    programar(p, segundos, () => resolverEntrega(p, null))
}

/** Select de paquetes del mensajero. */
async function entregarPaquete(interaction, character, letra) {
    const p = partidaDe(interaction, character, "mensajero")
    if (!p) return interaccionVencida(interaction)
    if (p.fase !== "entregando" || !p.letrasRestantes.includes(letra)) return interaction.deferUpdate()
    p.interaccion = interaction
    return resolverEntrega(p, letra)
}

/** letra = null si se acabó el tiempo. */
async function resolverEntrega(p, letra) {
    clearTimeout(p.timer)
    const correcto = p.paquetes.some(x => x.letra === letra && x.nombre === p.persona)

    let mensaje
    if (correcto) {
        p.aciertos++
        mensaje = `¡Entrega correcta! El paquete **${letra}** fue entregado a la persona correcta`
    } else if (letra === null) {
        mensaje = `No entregaste a tiempo el paquete de ${p.persona}`
    } else {
        mensaje = `¡Entrega incorrecta! El paquete **${letra}** no era para **${p.persona}.**`
    }

    p.pendientes = p.pendientes.filter(n => n !== p.persona)
    if (letra) p.letrasRestantes = p.letrasRestantes.filter(l => l !== letra)

    if (p.pendientes.length === 0) return terminarRondaMensajero(p, mensaje)

    p.fase = "pausa"
    await enviar(p, ui.marcoTrabajo(ficha(p), ui.mensajeroResultado({ persona: p.persona, mensaje, quedanUno: p.pendientes.length === 1 })))
    programar(p, MENSAJERO.pausaResultado, () => siguienteEntrega(p))
}

async function terminarRondaMensajero(p, ultimoMensaje) {
    p.fase = "fin_ronda"
    clearTimeout(p.timer)
    await reconocer(p)

    const resultado = await motor.finalizarTurno({
        turnoId: p.turnoId,
        characterId: p.characterId,
        calidad: p.aciertos / p.paquetes.length,
        detalle: { aciertos: p.aciertos, total: p.paquetes.length, ronda: p.rondas + 1 },
    })
    if (!resultado.ok) return void cerrar(p)

    const costoRonda = p.costo
    aplicarExperiencia(p, resultado)
    p.acumulado += resultado.pago
    p.rondas++

    const soul = await souls.findOne({ _id: p.characterId }, { projection: { "nucleo.energy": 1 } })
    p.energia = soul?.nucleo?.energy ?? 0
    const tope = resultado.turno >= resultado.turnosMax
    const deshabilitado = tope || p.energia < p.costo

    await enviar(p, ui.marcoTrabajo(ficha(p), [
        ...ui.reciboPago({
            resultado,
            titulo: "Entregas finalizadas",
            resumen: `-# ${ultimoMensaje}\nEntregaste **${p.aciertos}** de **${p.paquetes.length}** paquetes correctamente.`,
            imagen: ui.IMAGENES.mensajeroEntrega,
            energiaGastada: costoRonda,
        }),
        ...ui.mensajeroSeguir({
            userId: p.userId,
            energia: p.costo,
            deshabilitado,
            motivo: tope ? "Ya completaste los turnos de hoy." : "Te has quedado sin energía para trabajar.",
        }),
    ]))
    programar(p, deshabilitado ? 8 : MENSAJERO.segundosDecidir, () => cerrarSesionMensajero(p))
}

/** Select "¿seguir trabajando?" tras una ronda. Seguir es otro turno: cobra energía y cuenta para el tope diario. */
async function seguirMensajero(interaction, character, opcion) {
    const p = partidaDe(interaction, character, "mensajero")
    if (!p) return interaccionVencida(interaction)
    if (p.fase !== "fin_ronda") return interaction.deferUpdate()
    p.interaccion = interaction

    if (opcion !== "continuar") return cerrarSesionMensajero(p)

    clearTimeout(p.timer)
    await reconocer(p)
    const turno = await motor.iniciarTurno({ characterId: p.characterId, trabajo: p.codigo, energia: p.costo, rango: p.rango.r })
    if (!turno.ok) {
        programar(p, MENSAJERO.segundosDecidir, () => cerrarSesionMensajero(p))
        return interaction.followUp(efimero(ui.turnoRechazado(turno)))
    }

    p.turnoId = turno.turnoId
    p.energia = turno.energiaRestante
    p.tutorial = false
    nuevaRondaMensajero(p)

    try {
        await interaction.editReply({ components: pantallaIntroMensajero(p) })
    } catch (error) {
        cerrar(p)
        await motor.anularTurno({ turnoId: turno.turnoId, characterId: p.characterId })
        throw error
    }
    programar(p, MENSAJERO.esperaInicio, () => siguienteEntrega(p))
}

async function cerrarSesionMensajero(p) {
    if (!cerrar(p)) return
    await enviar(p, ui.marcoTrabajo(ficha(p), [...ui.sesionTerminada({ acumulado: p.acumulado, rondas: p.rondas }), ui.volverAlGafete(p.userId)]))
}

/** Tutorial sin empezar: el turno ya se cobró, se cierra con calidad 0. */
async function abandonarMensajero(p) {
    if (!cerrar(p)) return
    await reconocer(p)
    const resultado = await motor.finalizarTurno({ turnoId: p.turnoId, characterId: p.characterId, calidad: 0, detalle: { abandono: true } })
    if (!resultado.ok) return
    aplicarExperiencia(p, resultado)
    await enviar(p, ui.marcoTrabajo(ficha(p), [
        ...ui.reciboPago({ resultado, titulo: "Entregas sin repartir", resumen: "-# Te fuiste sin empezar a repartir los paquetes.", imagen: ui.IMAGENES.mensajeroEntrega }),
        ui.volverAlGafete(p.userId),
    ]))
}

// ── Limpieza: elegir el agente correcto para cada mancha ─────────────────

/**
 * Sala distinta en cada partida pero siempre resoluble: un agente se necesita 1 vez y los otros 3, 2 veces;
 * para cada necesidad se sortea una mancha cuyo agente perfecto es ese (con repetición). 7 manchas, 8 usos.
 */
function generarSala() {
    const claves = Object.keys(AGENTES)
    const unaVez = alAzar(claves)
    const necesidades = claves.flatMap(a => a === unaVez ? [a] : [a, a])
    const tipos = necesidades.map(a => alAzar(Object.keys(MANCHAS).filter(m => MANCHAS[m].perfecto === a)))
    return {
        manchas: barajar(tipos).map((tipo, id) => ({ id, tipo, estado: "pendiente" })),
        agentes: Object.fromEntries(claves.map(a => [a, LIMPIEZA.usosPorAgente])),
    }
}

const pantallaLimpieza = (p, resultado) => ui.marcoTrabajo(ficha(p), ui.limpiezaTablero({
    userId: p.userId, turnoId: p.turnoId, sala: p.sala, manchas: p.manchas, agentes: p.agentes, seleccion: p.seleccion, resultado,
}))

const vigilarInactividad = (p) => programar(p, LIMPIEZA.minutosInactividad * 60,
    () => terminarLimpieza(p, `Te ausentaste más de ${LIMPIEZA.minutosInactividad} minutos; la sala se cerró con lo que había.`))

async function iniciarLimpieza(p, actualizar) {
    Object.assign(p, {
        tipo: "limpieza",
        sala: alAzar(SALAS),
        ...generarSala(),
        seleccion: null,    // Mancha elegida, a la espera del agente
        liquidado: false,
        expira: Date.now() + LIMPIEZA.minutosTotal * 60_000,
        fase: p.tutorial ? "tutorial" : "jugando",
    })

    await mostrarInicio(p, p.tutorial
        ? ui.marcoTrabajo(ficha(p), ui.limpiezaIntro({ userId: p.userId, turnoId: p.turnoId, sala: p.sala, pista: PISTA_TUTORIAL, minutos: LIMPIEZA.minutosTotal }))
        : pantallaLimpieza(p), actualizar)

    vigilarInactividad(p)
    programar(p, LIMPIEZA.minutosTotal * 60, () => terminarLimpieza(p, `Pasaron ${LIMPIEZA.minutosTotal} minutos; la sala se cerró con lo que había.`), "timerTotal")
}

/**
 * Botones y selects de la limpieza. turnoId viene del custom_id solo para ignorar clics de un turno anterior;
 * todo lo demás se valida contra el estado del servidor.
 * @param {"start"|"fin"|"mancha"|"agente"} op
 */
async function accionLimpieza(interaction, character, op, turnoId, valor) {
    const p = partidaDe(interaction, character, "limpieza")
    if (!p || p.turnoId !== turnoId || p.liquidado) return interaccionVencida(interaction)
    p.interaccion = interaction

    if (op === "start") {
        if (p.fase !== "tutorial") return interaction.deferUpdate()
        p.fase = "jugando"
        vigilarInactividad(p)
        return enviar(p, pantallaLimpieza(p))
    }
    if (p.fase !== "jugando") return interaction.deferUpdate()
    vigilarInactividad(p)

    if (op === "fin") return terminarLimpieza(p, "Terminaste el turno; lo pendiente no suma.")

    if (op === "mancha") {
        const mancha = p.manchas.find(m => m.id === Number(valor) && m.estado === "pendiente")
        if (!mancha) return interaction.deferUpdate()
        p.seleccion = mancha.id
        const t = MANCHAS[mancha.tipo]
        return enviar(p, pantallaLimpieza(p, `Atiendes **${t.nombre}** (*${t.pista}*). ¿Con qué la limpias?`))
    }

    if (op === "agente") {
        const mancha = p.manchas.find(m => m.id === p.seleccion && m.estado === "pendiente")
        if (!mancha || !(p.agentes[valor] > 0)) return interaction.deferUpdate()

        p.agentes[valor]--     // Toda acción gasta un uso, acierte o no
        const t = MANCHAS[mancha.tipo]
        const a = AGENTES[valor]
        let resultado
        if (t.perfecto === valor) {
            mancha.estado = "limpia"
            p.seleccion = null
            resultado = `✔ ¡Impecable! ${a.emoji} ${a.corto} dejó ${t.nombre} como si nada.`
        } else if (t.parcial === valor) {
            mancha.estado = "parcial"
            p.seleccion = null
            resultado = `◐ ${t.nombre} quedó a medias. Si no miras de cerca, ni se nota.`
        } else {
            // Inútil: la mancha sigue elegida para intentar con otro agente
            resultado = `✗ ${a.emoji} ${a.corto} no le hizo nada a ${t.nombre}. Gastaste un uso.`
        }

        if (!p.manchas.some(m => m.estado === "pendiente")) return terminarLimpieza(p, "¡No queda ni una mancha pendiente!", resultado)
        if (Object.values(p.agentes).every(n => n === 0)) return terminarLimpieza(p, "Se acabaron los agentes de limpieza.", resultado)
        return enviar(p, pantallaLimpieza(p, resultado))
    }

    return interaction.deferUpdate()
}

/** Liquida una sola vez: c = Σp / N con p = 1 (limpia), 0.5 (parcial) o 0 (pendiente). */
async function terminarLimpieza(p, motivo, ultimaAccion) {
    if (p.liquidado || !cerrar(p)) return
    p.liquidado = true
    await reconocer(p)

    const puntos = p.manchas.reduce((s, m) => s + (m.estado === "limpia" ? 1 : m.estado === "parcial" ? 0.5 : 0), 0)
    const resultado = await motor.finalizarTurno({
        turnoId: p.turnoId,
        characterId: p.characterId,
        calidad: puntos / p.manchas.length,
        detalle: { sala: p.sala, puntos, manchas: p.manchas, agentesRestantes: p.agentes },
    })
    if (!resultado.ok) return
    const costo = p.costo
    aplicarExperiencia(p, resultado)

    const cuenta = (estado) => p.manchas.filter(m => m.estado === estado).length
    const resumen = (ultimaAccion ? `-# ${ultimaAccion}\n` : "") + `-# ${motivo}\n` +
        `**${cuenta("limpia")}** limpias · **${cuenta("parcial")}** a medias · **${cuenta("pendiente")}** sin limpiar`

    await enviar(p, ui.marcoTrabajo(ficha(p), [
        ...ui.reciboPago({ resultado, titulo: `${p.sala} · Turno terminado`, resumen, imagen: ui.IMAGENES.limpieza, energiaGastada: costo }),
        ui.limpiezaFinal(p.manchas),
        ui.volverAlGafete(p.userId),
    ]))
}

module.exports = {
    ROL_BOOST,
    esBooster,
    estaTrabajando,
    abrirMenu,
    mostrarLista,
    accionMenu,
    postular,
    tramitarRenuncia,
    empezarTrabajo,
    pulsarBiblioteca,
    comenzarMensajero,
    entregarPaquete,
    seguirMensajero,
    accionLimpieza,
}
