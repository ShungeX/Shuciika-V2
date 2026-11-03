// data/UI_ComponentsV2/trabajos.js
// Componentes V2 del sistema de trabajos: lista de empleos, pantallas de cada minijuego, recibo de pago y avisos.
// El gafete (menú) está en menuTrabajo.js. Solo construyen componentes; la lógica vive en
// functions/Economia/minijuegosTrabajo.js y los números en motorPago.js.

const { crearCustomId } = require("../../utils/constructores/customId")
const { EMOJI_LUMENS } = require("../../functions/mensajesServidor")
const { MOTIVOS, CONFIG_PAGO, calcularPago } = require("../../functions/Economia/motorPago")
const { trabajos } = require("../economia/economia")
const { AGENTES, MANCHAS } = require("../economia/limpieza")
const { DORADO } = require("./menuTrabajo")
const config = require("../../config/config")

const IMAGENES = {
    empleado: "https://c.tenor.com/AaxsbDWIIL0AAAAC/tenor.gif",
    lista: "https://i.pinimg.com/736x/3b/17/b1/3b17b11f0291089a8b36228dee3e5c56.jpg",
    trabajoDefecto: "https://i.pinimg.com/736x/bb/ae/02/bbae027f086f24fefc0f0de3904a8e7d.jpg",
    biblioteca: "https://i.pinimg.com/736x/89/9a/c0/899ac0f1bb6f33a1add7c1f70ea17cdc.jpg",
    mensajeroIntro: "https://c.tenor.com/LMp0mDmKsjYAAAAd/tenor.gif",
    mensajeroEntrega: "https://i.pinimg.com/736x/00/a2/47/00a247725f88c9fcf5f53f4ab464e998.jpg",
    descanso: "https://c.tenor.com/Hehsl_icRLIAAAAC/tenor.gif",
    limpieza: "https://i.pinimg.com/736x/d2/98/2e/d2982e988f5864c5115b093c6f33ed32.jpg",
}

const TRABAJOS_POR_PAGINA = 3

// Lo que gana cada rango además del bono de pago
const BENEFICIOS_RANGO = {
    Oficial: "Ahora gastas 1⚡ menos por turno.",
    Insustituible: "Tu gafete ahora luce título dorado.",
}

const separador = { type: 14, divider: true, spacing: 1 }
const texto = (content) => ({ type: 10, content })
const seccion = (imagen, ...contenidos) => ({ type: 9, components: contenidos.map(texto), accessory: { type: 11, media: { url: imagen } } })
const contenedor = (...components) => [{ type: 17, accent_color: null, components }]
const fila = (...components) => ({ type: 1, components })
const boton = (custom_id, label, style = 2, disabled = false) => ({ type: 2, custom_id, label, style, disabled })
const select = (custom_id, placeholder, options, disabled = false) => ({
    type: 1,
    components: [{ type: 3, custom_id, placeholder, options, min_values: 1, max_values: 1, disabled }]
})

// characterId vacío a propósito: el router resuelve el personaje activo desde usuarios_server
const idTrabajo = (userId, ...extras) => crearCustomId({ action: "trabajar", userId, extras })

const enSegundos = (s) => Math.floor(Date.now() / 1000) + s

/** ●●●○○○ — turnos usados del día. */
const barraJornada = (turno, max) => "●".repeat(Math.min(turno, max)) + "○".repeat(Math.max(0, max - turno))

const porcentaje = (c) => `${Math.round(c * 100)}%`

// ── Marco común ──────────────────────────────────────────────────────────

/**
 * Envuelve las pantallas de un minijuego: encabezado del empleado, contenido y pie de versión.
 * @param {{ trabajo: string, empleado: string, rango: Object, energia: number }} ficha - rango = rangoDe()
 * @param {Array} contenido - Componentes sueltos (secciones, textos, filas)
 */
function marcoTrabajo(ficha, contenido) {
    const { rango } = ficha
    const [c] = contenedor(
        seccion(IMAGENES.empleado,
            `# Estas trabajando de ${trabajos[ficha.trabajo]?.nombre || ficha.trabajo}`,
            `-# **Empleado:** ${ficha.empleado}${rango.titulo ? ` ✦ ${rango.nombre} ✦` : ""}\n-# **Rango:** ${rango.nombre} · ${rango.turnos} turnos\n-# **Energía:** \`${ficha.energia}⚡\``
        ),
        separador,
        ...contenido,
        texto(`-# Sistema de economia [Trabajos] | Version: ${config.versionEc}`),
    )
    c.accent_color = rango.titulo ? DORADO : null
    return [c]
}

// ── Elegir trabajo ───────────────────────────────────────────────────────

/**
 * Lista paginada de trabajos para ocupar un puesto.
 * @param {Object} p
 * @param {string} p.userId
 * @param {number} [p.pagina]
 * @param {"principal"|"boost"} p.slot - Puesto que se va a ocupar
 * @param {string[]} [p.excluir] - Códigos que ya tiene en otro puesto
 * @param {boolean} [p.volver] - Botón para regresar al gafete
 * @param {string} [p.aviso]
 */
function listaTrabajos({ userId, pagina = 1, slot = "principal", excluir = [], volver = false, aviso }) {
    const claves = Object.keys(trabajos).filter(c => !excluir.includes(c))
    const totalPaginas = Math.max(1, Math.ceil(claves.length / TRABAJOS_POR_PAGINA))
    const actual = Math.min(Math.max(1, pagina), totalPaginas)
    const enPagina = claves.slice((actual - 1) * TRABAJOS_POR_PAGINA, actual * TRABAJOS_POR_PAGINA)
    const { pago: minimo } = calcularPago(0, 1)
    const { pago: maximo } = calcularPago(1, 1)

    const fichas = enPagina.map(clave => {
        const t = trabajos[clave]
        return seccion(t.img || IMAGENES.trabajoDefecto,
            `- **${t.nombre}:**\n-# ${t.descripcion}\n\n` +
            `- - -# **Salario: **${minimo}-${maximo} Lumens según tu desempeño\n` +
            `- - -# **Energia Req: ** ${t.energia} puntos\n` +
            `- - -# **Mortal: ** ${t.mortal ? "Sí" : "No"}`
        )
    })

    const botones = []
    if (totalPaginas > 1) {
        botones.push(
            boton(idTrabajo(userId, "lista", actual - 1, slot), "Anterior", 2, actual === 1),
            boton(idTrabajo(userId, "lista", actual + 1, slot), "Siguiente", 2, actual === totalPaginas),
        )
    }
    if (volver) botones.push(boton(idTrabajo(userId, "gafete"), "Volver al gafete"))

    const opciones = enPagina.map(clave => ({
        label: trabajos[clave].nombre,
        value: clave,
        description: `Salario: ${minimo}-${maximo} L, Energía: ${trabajos[clave].energia} E`,
    }))

    const subtitulo = slot === "boost"
        ? "-# **Puesto extra por boost** ♡( ◡‿◡ )\n-# Este puesto solo se puede usar mientras tu boost esté activo. Si lo pierdes, tus datos se conservan para cuando vuelvas a boostear."
        : "-# ¡Oh, noble usuario! Ante ti se despliega el sagrado abanico de...\n\n-# **¡El trabajo forzado voluntario!**\n-# ¡Elige sabiamente! Renunciar toma 24 horas de trámite."

    return contenedor(
        seccion(IMAGENES.lista, slot === "boost" ? "# Selecciona un trabajo adicional" : "# ¡Trabajo Voluntario!", subtitulo),
        ...(aviso ? [texto(aviso.split("\n").map(a => `-# ${a}`).join("\n"))] : []),
        separador,
        ...fichas,
        separador,
        ...(botones.length ? [fila(...botones)] : []),
        ...(opciones.length
            ? [select(idTrabajo(userId, "postular", slot), "Selecciona un trabajo...", opciones)]
            : [texto("-# No quedan trabajos disponibles para este puesto.")]),
    )
}

// ── Biblioteca ───────────────────────────────────────────────────────────

/** Pantalla de memorizar: muestra la secuencia; en el tutorial espera al botón "Comenzar". */
function bibliotecaIntro({ userId, secuencia, segundosPorLibro, tutorial }) {
    const cuerpo = `Bienvenido/a cuidador de la biblioteca.\n\n-# Al inicio de tu jornada los libros se encontraban ordenados de la siguiente manera:\n` +
        `-# **${secuencia.join(", ")}**\n\n-# Hasta que un grupo de estudiantes entro y los dejo desordenados. Tienes que volver a ordenarlos antes de terminar tu jornada.\n\n` +
        `Memoriza el orden y presiona los botones en el orden correcto.\n¡Tienes ${segundosPorLibro} segundos por cada libro!` +
        (tutorial ? "" : "\n\n**El juego comenzara en unos segundos...**")

    return [
        seccion(IMAGENES.biblioteca, "# Mini-juego del bibliotecario", cuerpo),
        ...(tutorial ? [fila(boton(idTrabajo(userId, "biblio", "start"), "Comenzar", 3))] : []),
        separador,
    ]
}

/** Tablero de botones de colores. */
function bibliotecaTablero({ userId, colores, elegidos, aviso, finEn }) {
    const botones = colores.map(color => boton(idTrabajo(userId, "biblio", color), color))
    return [
        seccion(IMAGENES.biblioteca,
            "# Mini-juego del bibliotecario",
            `<t:${finEn}:R>` + (elegidos.length ? `\n\n-# Tu secuencia: ${elegidos.join(", ")}` : "") + (aviso ? `\n\n-# ${aviso}` : "")
        ),
        separador,
        fila(...botones.slice(0, 5)),
        ...(botones.length > 5 ? [fila(...botones.slice(5))] : []),
    ]
}

// ── Mensajero ────────────────────────────────────────────────────────────

function mensajeroIntro({ userId, paquetes, segundosPorEntrega, tutorial, empiezaEn }) {
    const saludo = tutorial
        ? "-# ¡Hola! parece ser que es tu primera vez trabajando... No te preocupes, te explicare lo escencial\n-# Recibirás paquetes etiquetados con letras del abecedario, Cada letra representa a una persona diferente. Por ejemplo: \n\n A = Axel.\n\n-# Cuando te toque entregar un paquete a alguien, solo busca la letra que le corresponde y entrégaselo.\n\n"
        : "Hola, es bueno verte de nuevo por aqui. Aqui estan los pedidos de hoy:\n\n"
    const lista = paquetes.map(p => `- -# **Paquete ${p.letra}** para **${p.nombre}**`).join("\n")

    return [
        seccion(IMAGENES.mensajeroIntro,
            "# Minijuego del mensajero mágico",
            `${saludo}${lista}\n\nMemoriza quién recibe cada paquete. ¡Tienes ${segundosPorEntrega} segundos por entrega!` +
            (tutorial ? "" : `\n\n-# El juego comenzara **<t:${empiezaEn}:R>**`)
        ),
        ...(tutorial ? [fila(boton(idTrabajo(userId, "envio", "start"), "Comenzar", 3))] : []),
        separador,
    ]
}

function mensajeroEntrega({ userId, persona, letras, finEn, primera }) {
    return [
        seccion(IMAGENES.mensajeroEntrega,
            `# Paquete para ${persona}`,
            `${primera ? "-# Primera entrega del día, ¿Qué paquete entregas?" : "¿Que paquete vas a entregar?"}\n\nPaquetes disponibles: ${letras.map(l => `\n- -# ${l}`).join("")}\nEntrega tardía: <t:${finEn}:R>`
        ),
        select(idTrabajo(userId, "envio"), "Selecciona el paquete a entregar", letras.map(l => ({ label: l, value: l }))),
    ]
}

function mensajeroResultado({ persona, mensaje, quedanUno }) {
    return [
        seccion(IMAGENES.mensajeroEntrega,
            `# Paquete para ${persona}`,
            `-# ${mensaje}\n\n-# ${quedanUno ? "Ya casi acabas. Este es el ultimo paquete" : "Preparate, entregaras el siguiente paquete pronto..."}`
        ),
    ]
}

/** Selector de "¿seguir trabajando?" tras una ronda del mensajero. */
function mensajeroSeguir({ userId, energia, deshabilitado, motivo }) {
    return [
        texto(`-# ${deshabilitado ? `${motivo} En unos momentos se dara tu resultado...` : `¿Deseas continuar trabajando? \`(-${energia}⚡ · cuenta como otro turno)\``}`),
        select(idTrabajo(userId, "seguir"), "¿Deseas continuar trabajando?", [
            { label: "Continuar", value: "continuar" },
            { label: "Dejar de trabajar", value: "terminar" },
        ], deshabilitado),
    ]
}

function sesionTerminada({ acumulado, rondas }) {
    return [
        seccion(IMAGENES.descanso,
            "# Has terminado de trabajar",
            `**Resultado:**\n\n- -# **Lumens totales:** ${acumulado} ${EMOJI_LUMENS} \n- -# **Trabajaste un total de ${rondas} ${rondas === 1 ? "vez" : "veces"}**`,
            "¡Bien hecho, ahora puedes descansar!"
        ),
    ]
}

// ── Limpieza ─────────────────────────────────────────────────────────────

const ICONO_MANCHA = { pendiente: "○", limpia: "✔", parcial: "◐" }

function listaManchas(manchas) {
    return manchas.map((m, i) => {
        const t = MANCHAS[m.tipo]
        const nombre = m.estado === "pendiente" ? `**${t.nombre}**` : `~~${t.nombre}~~`
        return `${ICONO_MANCHA[m.estado]} \`${i + 1}\` ${nombre} · *${t.pista}*`
    }).join("\n")
}

const lineaAgentes = (agentes) => "Agentes: " + Object.entries(AGENTES)
    .map(([clave, a]) => `${a.emoji} ${a.corto} ×${agentes[clave]}`).join(" · ")

/** Pantalla 0 (solo la primera vez): tutorial corto con pista gratuita. */
function limpiezaIntro({ userId, turnoId, sala, pista, minutos }) {
    return [
        seccion(IMAGENES.limpieza,
            `# ${sala} · Encargado de limpieza`,
            "¡Bienvenido, héroe no reconocido! La sala está llena de suciedad mágica.\n\n" +
            "-# Elige una mancha en el primer menú y el agente con el que la limpias en el segundo.\n" +
            "-# **Perfecto:** queda limpia. **Parcial:** queda a medias, pero cuenta como cerrada. **Inútil:** sigue ahí y gastaste un uso.\n" +
            "-# Los agentes alcanzan justo, con un solo error de margen.\n\n" +
            `**Pista gratuita:** *${pista}*\n\n` +
            `-# Tienes ${minutos} minutos, pero se paga la precisión, no la velocidad.`
        ),
        fila(boton(idTrabajo(userId, "limpia", "start", turnoId), "Comenzar", 3)),
        separador,
    ]
}

/**
 * Pantalla de juego: lista de manchas, agentes y los dos selects.
 * @param {Object} p
 * @param {Array<{ id: number, tipo: string, estado: string }>} p.manchas
 * @param {Object<string, number>} p.agentes - Usos restantes
 * @param {number|null} p.seleccion - id de la mancha elegida
 * @param {string} [p.resultado] - Línea con el resultado de la última acción
 */
function limpiezaTablero({ userId, turnoId, sala, manchas, agentes, seleccion, resultado }) {
    const cerradas = manchas.filter(m => m.estado !== "pendiente").length
    const pendientes = manchas.filter(m => m.estado === "pendiente")
    const elegida = manchas.find(m => m.id === seleccion)

    const opcionesMancha = pendientes.map(m => ({
        label: `${m.id + 1}. ${MANCHAS[m.tipo].nombre}`,
        value: String(m.id),
        description: MANCHAS[m.tipo].pista,
        default: m.id === seleccion,
    }))
    const opcionesAgente = Object.entries(AGENTES)
        .filter(([clave]) => agentes[clave] > 0)
        .map(([clave, a]) => ({ label: `${a.nombre} ×${agentes[clave]}`, value: clave, emoji: { name: a.emoji } }))

    return [
        seccion(IMAGENES.limpieza,
            `# ${sala} · Manchas ${cerradas}/${manchas.length}`,
            resultado ? `-# ${resultado}` : "-# ¿Por dónde empiezas?"
        ),
        separador,
        texto(listaManchas(manchas)),
        texto(`-# ${lineaAgentes(agentes)}`),
        separador,
        select(idTrabajo(userId, "limpia", "mancha", turnoId), "¿Qué mancha atiendes?", opcionesMancha),
        // Discord no permite un select sin opciones: si no hay mancha elegida queda desactivado
        elegida
            ? select(idTrabajo(userId, "limpia", "agente", turnoId), `¿Con qué limpias ${MANCHAS[elegida.tipo].nombre}?`, opcionesAgente)
            : select(idTrabajo(userId, "limpia", "agente", turnoId), "¿Con qué la limpias?", [{ label: "Primero elige una mancha", value: "ninguno" }], true),
        fila(boton(idTrabajo(userId, "limpia", "fin", turnoId), "Terminar turno", 4)),
    ]
}

/** Sala al terminar: revela el agente perfecto de cada mancha que no quedó limpia. */
function limpiezaFinal(manchas) {
    return texto(manchas.map((m, i) => {
        const t = MANCHAS[m.tipo]
        const pista = m.estado === "limpia" ? "" : ` → era ${AGENTES[t.perfecto].emoji} ${AGENTES[t.perfecto].corto}`
        return `-# ${ICONO_MANCHA[m.estado]} \`${i + 1}\` ${t.nombre}${pista}`
    }).join("\n"))
}

// ── Pago ─────────────────────────────────────────────────────────────────

/**
 * Recibo de un turno pagado (componentes sueltos para meterlos en marcoTrabajo).
 * @param {Object} p
 * @param {Object} p.resultado - Lo que devolvió finalizarTurno()
 * @param {string} [p.titulo]
 * @param {string} [p.resumen] - Una línea del minijuego ("Organizaste 4 de 5 libros")
 * @param {string} [p.imagen]
 * @param {number} [p.energiaGastada]
 */
function reciboPago({ resultado, titulo = "Jornada terminada", resumen = "", imagen = IMAGENES.biblioteca, energiaGastada }) {
    const d = resultado.desglose
    const { rango, subioDeRango } = resultado.experiencia

    const lineas = [`-# Calidad del trabajo: **${porcentaje(d.calidad)}** ── ${d.bruto} ${EMOJI_LUMENS} `]
    if (d.multiplicadorRango !== 1) lineas.push(`-# Antigüedad: **×${d.multiplicadorRango.toFixed(3).replace(/0+$/, "")}** (incluido arriba)`)
    if (d.bonos) lineas.push(`-# Propinas y bonos: **+${d.bonos}** ${EMOJI_LUMENS} `)
    if (d.factorTurno !== 1) lineas.push(`-# Cansancio del ${d.turno}.º turno: **×${d.factorTurno}**`)
    for (const e of d.eventos.filter(e => e.tipo === "mult")) lineas.push(`-# ${e.motivo || "Evento"}: **×${e.valor}**`)
    if (energiaGastada) lineas.push(`-# Energía gastada: \`${energiaGastada}⚡\``)

    const experiencia = subioDeRango
        ? `**¡Ascendiste a ${rango.nombre}!** ${BENEFICIOS_RANGO[rango.nombre] || "Tu antigüedad ahora paga un poco más."}`
        : `-# Experiencia: +1 turno · ${rango.nombre} ${rango.siguiente ? `${rango.turnos}/${rango.siguiente.desde} para ${rango.siguiente.nombre}` : `· ${rango.turnos} turnos`}`

    return [
        seccion(imagen, `# ${titulo}`, `${resumen ? `${resumen}\n\n` : ""}Te pagaron **\`${resultado.pago}\`** ${EMOJI_LUMENS} `),
        separador,
        texto(lineas.join("\n")),
        texto(experiencia),
        texto(`-# Jornada de hoy: ${barraJornada(resultado.turno, resultado.turnosMax)} (${resultado.turno}/${resultado.turnosMax}) · se reinicia <t:${resultado.reinicio}:R>`),
        separador,
    ]
}

/**
 * Aviso completo (con contenedor) cuando iniciarTurno() rechaza el turno.
 * Se manda con flags ["IsComponentsV2", "Ephemeral"].
 */
function turnoRechazado(rechazo) {
    const textos = {
        [MOTIVOS.TOPE_DIARIO]: ["Jornada completa", `Ya trabajaste los ${CONFIG_PAGO.turnosMaxDia} turnos de hoy. Por favor, ve a tocar pasto. (✿◡‿◡)\n-# Los turnos se reinician <t:${rechazo.reinicio}:R>`],
        [MOTIVOS.SIN_ENERGIA]: ["Sin energía", `No tienes suficiente energía para este trabajo.\n-# Tu energía: \`${rechazo.energia}⚡\` · Necesaria: \`${rechazo.energiaNecesaria}⚡\``],
        [MOTIVOS.SIN_PERSONAJE]: ["Sin personaje", "No encontré a tu personaje activo. (┬┬﹏┬┬)"],
    }
    const [titulo, cuerpo] = textos[rechazo.motivo] || ["No puedes trabajar ahora", "Intenta de nuevo en un momento. (┬┬﹏┬┬)"]
    return contenedor(seccion(IMAGENES.descanso, `# ${titulo}`, cuerpo))
}

/** Fila con el botón para regresar al gafete (pantallas finales de cada turno). */
const volverAlGafete = (userId) => fila(boton(idTrabajo(userId, "gafete"), "Volver al gafete", 1))

/** Aviso corto (con contenedor) para interacciones que ya no valen o errores. */
function avisoTrabajo(titulo, cuerpo) {
    return contenedor(seccion(IMAGENES.descanso, `# ${titulo}`, cuerpo))
}

module.exports = {
    IMAGENES,
    enSegundos,
    barraJornada,
    marcoTrabajo,
    listaTrabajos,
    bibliotecaIntro,
    bibliotecaTablero,
    mensajeroIntro,
    mensajeroEntrega,
    mensajeroResultado,
    mensajeroSeguir,
    sesionTerminada,
    limpiezaIntro,
    limpiezaTablero,
    limpiezaFinal,
    reciboPago,
    turnoRechazado,
    avisoTrabajo,
    volverAlGafete,
}
