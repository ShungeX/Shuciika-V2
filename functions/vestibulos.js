// functions/vestibulos.js
// Vestíbulos: el punto de paso de cada área. Cada uno es un mensaje de Server_db.mensajes_servidor (tipo "vestibulo")
// con el rol de ubicación del área, los canales que ese rol deja ver y los destinos a los que se puede ir desde ahí.
// Moverse es cambiar de rol: el bot quita el rol del área anterior y pone el de la nueva, así no hay "teletransportes".
//
// La ubicación pertenece al personaje (Personajes.ubicacion), no al usuario de Discord: al cambiar de personaje activo
// se llama a sincronizarUbicacion para que el miembro lleve el rol del área donde quedó ese personaje.

const { PermissionFlagsBits } = require("discord.js")
const { crearCustomId } = require("../utils/constructores/customId")
const { ErrorEvento } = require("./eventosMensaje")

const COLECCION = "mensajes_servidor"
const ID_DISCORD = /^\d{17,20}$/
const ID_MENSAJE = /^[a-z0-9_]{3,40}$/
const MAX_CANALES = 40
const MAX_HILOS = 100            // hilos que se listan bajo cada canal
const MAX_DESTINOS = 25          // opciones que admite un select de Discord
const MAX_MENSAJES = 20
const MAX_TEXTO_V2 = 4000
const MODOS_LLEGADA = ["canal", "ninguno"]

const TEXTOS = {
    tituloCanales: "Lugares de esta área",
    tituloDestinos: "Desde aquí puedes ir a",
    placeholder: "¿A dónde quieres ir?",
    llegada: "Ya estás en {area}. Mira con calma a tu alrededor ♡( ◡‿◡ )",
    combate: "Primero termina lo que tienes enfrente, luego te acompaño a donde quieras ir ♡( ◡‿◡ )",
    cerrado: "Lo siento mucho, todavía no se puede pasar por ahí. Te aviso en cuanto se pueda, ¿sí? ♡( ◡‿◡ )",
    sinPersonaje: "Todavía no tienes un reflejo con el que caminar por aquí. Cuando lo tengas, te acompaño ♡( ◡‿◡ )",
    yaAhi: "Ya estás en {area} ♡( ◡‿◡ )",
    noListo: "Ese camino todavía se está preparando. Dame un poquito de tiempo ♡( ◡‿◡ )",
    sinCamino: "Desde aquí ya no se llega a ese lugar ♡( ◡‿◡ )"
}

const mismo = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase()
const texto = (v, max) => String(v ?? "").trim().slice(0, max)
const lineas = (v, max, n) => (Array.isArray(v) ? v : []).map(l => texto(l, max)).filter(Boolean).slice(0, n)
const idsDiscord = (v) => (Array.isArray(v) ? v : []).map(x => texto(x, 20)).filter(x => ID_DISCORD.test(x)).slice(0, 300)

/** Sustituye {personaje}, {area}, {origen} y {region} en un texto configurable. */
function rellenar(plantilla, datos) {
    return String(plantilla || "").replace(/\{(personaje|area|origen|region)\}/g, (_, k) => datos[k] ?? "")
}

/** "🚪" o "<a:nombre:id>" → emoji de componente de Discord; null si no es válido. */
function emojiDeComponente(valor) {
    const s = String(valor || "").trim()
    if (!s) return null
    const custom = s.match(/^<(a?):(\w{2,32}):(\d{17,20})>$/)
    if (custom) return { id: custom[3], name: custom[2], animated: custom[1] === "a" }
    return /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(s) && s.length <= 16 ? { name: s } : null
}

/** Valida y deja en forma canónica la parte `vestibulo` de la configuración que llega del dashboard. */
function normalizarVestibulo(entrada, idPropio) {
    const v = entrada && typeof entrada === "object" ? entrada : {}
    const area = texto(v.area, 60)
    if (!area) throw new ErrorEvento(400, "El vestíbulo necesita el nombre de su área.")

    const rolId = texto(v.rolId, 20)
    if (rolId && !ID_DISCORD.test(rolId)) throw new ErrorEvento(400, "El rol de ubicación debe ser un ID de Discord (17 a 20 cifras).")

    // Canal principal (raíz): casi siempre el canal donde no se puede escribir. Ahí se publica el vestíbulo
    // (salvo que se elija otro canal) y sus hilos son los lugares de la zona.
    const raizId = texto(v.raizId, 20)
    if (raizId && !ID_DISCORD.test(raizId)) throw new ErrorEvento(400, "El canal principal debe ser un ID de Discord (17 a 20 cifras).")

    const vistos = new Set(raizId ? [raizId] : [])
    const canales = (Array.isArray(v.canales) ? v.canales : [])
        .map(c => ({ id: texto(c?.id ?? c, 20), nota: texto(c?.nota, 120), listarHilos: c?.listarHilos !== false, hilos: c?.hilos, hilosExcluidos: c?.hilosExcluidos }))
        .filter(c => ID_DISCORD.test(c.id) && !vistos.has(c.id) && vistos.add(c.id))
        .slice(0, MAX_CANALES)
    // Los hilos de cada canal los lee el dashboard (GET .../canales/:id/hilos) y viajan en la configuración:
    // así el mensaje se construye igual en la vista previa y al publicar, sin consultar a Discord
    for (const c of canales) {
        c.hilosExcluidos = idsDiscord(c.hilosExcluidos)   // hilos que el admin quitó de la lista (el dashboard los recuerda al reabrir)
        const vistosHilos = new Set()
        c.hilos = (c.listarHilos && Array.isArray(c.hilos) ? c.hilos : [])
            .map(h => ({ id: texto(h?.id, 20), nombre: texto(h?.nombre, 100) }))
            .filter(h => ID_DISCORD.test(h.id) && !vistos.has(h.id) && !vistosHilos.has(h.id) && vistosHilos.add(h.id))
            .slice(0, MAX_HILOS)
    }

    const rz = v.raiz && typeof v.raiz === "object" ? v.raiz : {}
    const listarHilosRaiz = rz.listarHilos !== false
    const vistosRaiz = new Set()
    const hilosRaiz = (raizId && listarHilosRaiz && Array.isArray(rz.hilos) ? rz.hilos : [])
        .map(h => ({ id: texto(h?.id, 20), nombre: texto(h?.nombre, 100) }))
        .filter(h => ID_DISCORD.test(h.id) && !vistos.has(h.id) && !vistosRaiz.has(h.id) && vistosRaiz.add(h.id))
        .slice(0, MAX_HILOS)

    const d = v.destinos && typeof v.destinos === "object" ? v.destinos : {}
    const vistosDest = new Set()
    const extra = (Array.isArray(d.extra) ? d.extra : [])
        .map(e => ({
            id: texto(e?.id, 40).toLowerCase(),
            etiqueta: texto(e?.etiqueta, 80),
            descripcion: texto(e?.descripcion, 100),
            emoji: texto(e?.emoji, 60)
        }))
        .filter(e => ID_MENSAJE.test(e.id) && e.id !== idPropio && !vistosDest.has(e.id) && vistosDest.add(e.id))
        .slice(0, MAX_DESTINOS)

    const color = v.accent_color === null || v.accent_color === "" || v.accent_color === undefined ? null : Number(v.accent_color)
    const imagen = texto(v.imagen, 500)
    const ll = v.llegada && typeof v.llegada === "object" ? v.llegada : {}
    const canalLlegada = texto(ll.canalId, 20)
    const ce = v.cerrado && typeof v.cerrado === "object" ? v.cerrado : {}

    return {
        area,
        region: texto(v.region, 60),
        rolId: rolId || null,
        titulo: texto(v.titulo, 120) || `Vestíbulo · ${area}`,
        descripcion: texto(v.descripcion, 1500),
        imagen: /^https?:\/\/\S+$/i.test(imagen) ? imagen : null,
        nota: texto(v.nota, 300),
        accent_color: Number.isInteger(color) && color >= 0 && color <= 0xFFFFFF ? color : null,

        raizId: raizId || null,
        raiz: { listarHilos: listarHilosRaiz, hilos: hilosRaiz, hilosExcluidos: idsDiscord(rz.hilosExcluidos) },
        // Sin marcar, el vestíbulo se publica en el canal principal; marcado, en el canal que indique `canalId`
        canalPersonalizado: Boolean(v.canalPersonalizado),

        canales,
        mostrarCanales: v.mostrarCanales !== false,
        tituloCanales: texto(v.tituloCanales, 80) || TEXTOS.tituloCanales,

        destinos: { region: d.region !== false, extra },
        mostrarDestinos: v.mostrarDestinos !== false,
        tituloDestinos: texto(v.tituloDestinos, 80) || TEXTOS.tituloDestinos,
        placeholder: texto(v.placeholder, 100) || TEXTOS.placeholder,

        // Cómo se ve esta área cuando aparece como destino en el menú de otro vestíbulo
        emoji: texto(v.emoji, 60),
        descripcionDestino: texto(v.descripcionDestino, 100),

        llegada: {
            // Los modos «efimero» y «ambos» ya no existen: un efímero no llega a quien cambió de área (pierde el canal del menú).
            // «ambos» seguía anunciando en el canal; «efimero» no anunciaba nada.
            modo: MODOS_LLEGADA.includes(ll.modo) ? ll.modo : (ll.modo === "efimero" ? "ninguno" : "canal"),
            mensajes: lineas(ll.mensajes, 500, MAX_MENSAJES),
            canalId: ID_DISCORD.test(canalLlegada) ? canalLlegada : null
        },
        bloquearEnCombate: v.bloquearEnCombate !== false,
        mensajeCombate: texto(v.mensajeCombate, 500),
        cerrado: { activo: Boolean(ce.activo), mostrar: ce.mostrar !== false, mensaje: texto(ce.mensaje, 500) },
        inicial: Boolean(v.inicial)
    }
}

/**
 * Destinos a los que se puede ir desde un vestíbulo: primero los elegidos a mano (con sus textos propios)
 * y después, si está activo, el resto de áreas de su misma región.
 * @param {object} doc - Documento del vestíbulo de origen
 * @param {object[]} todos - Todos los documentos de mensajes_servidor (o solo los vestíbulos)
 */
function destinosDe(doc, todos) {
    const v = doc.vestibulo
    const otros = new Map(todos.filter(d => d.tipo === "vestibulo" && d.vestibulo && d._id !== doc._id).map(d => [d._id, d]))
    const lista = []
    const faltan = []
    const vistos = new Set()

    const agregar = (dest, enlace, origen) => {
        if (vistos.has(dest._id)) return
        vistos.add(dest._id)
        const dv = dest.vestibulo
        const cerrado = Boolean(dv.cerrado?.activo)
        if (cerrado && dv.cerrado.mostrar === false) return
        lista.push({
            id: dest._id,
            area: dv.area,
            region: dv.region || "",
            etiqueta: enlace.etiqueta || dv.area,
            descripcion: enlace.descripcion || dv.descripcionDestino || "",
            emoji: enlace.emoji || dv.emoji || "",
            otraRegion: Boolean(v.region && dv.region && !mismo(v.region, dv.region)),
            cerrado,
            mensajeCerrado: dv.cerrado?.mensaje || TEXTOS.cerrado,
            sinRol: !dv.rolId,
            origen
        })
    }

    for (const e of v.destinos?.extra || []) {
        const dest = otros.get(e.id)
        if (dest) agregar(dest, e, "manual")
        else faltan.push(e.id)
    }
    if (v.destinos?.region && v.region) {
        const deRegion = [...otros.values()]
            .filter(d => mismo(d.vestibulo.region, v.region))
            .sort((a, b) => a.vestibulo.area.localeCompare(b.vestibulo.area, "es"))
        for (const dest of deRegion) agregar(dest, {}, "region")
    }
    return { lista, faltan }
}

/** Componentes V2 del mensaje de un vestíbulo, con sus avisos y lo que impide publicarlo. */
function construirVestibulo(doc, todos) {
    const v = doc.vestibulo
    const avisos = []
    const bloqueantes = []
    const { lista: destinos, faltan } = destinosDe(doc, todos)

    const hijos = [{ type: 10, content: `# ${v.titulo}` }]
    if (v.descripcion) hijos.push({ type: 10, content: v.descripcion })
    if (v.imagen) hijos.push({ type: 12, items: [{ media: { url: v.imagen } }] })

    const hilosRaiz = v.raiz?.hilos || []
    if (v.mostrarCanales && (v.raizId || v.canales.length)) {
        // Cada línea va como subtexto («- -#») para no saturar el componente; el espacio final esquiva el bug de «-#» dentro de una lista en Discord Canary (Windows)
        // Primero el canal principal con sus hilos debajo (aunque el mensaje esté en él, también se lista) y después
        // cada canal con sus hilos (los vestíbulos guardados antes de que existieran no traen `hilos`)
        const filas = [...(v.raizId ? [`- -# <#${v.raizId}> `, ...hilosRaiz.map(h => `  - -# <#${h.id}> `)] : []), ...v.canales.flatMap(c => [
            `- -# <#${c.id}>${c.nota ? ` · *${c.nota}*` : ""} `,
            ...(c.hilos || []).map(h => `  - -# <#${h.id}> `)
        ])].join("\n")
        hijos.push({ type: 14, divider: true, spacing: 1 }, { type: 10, content: `### ${v.tituloCanales}\n${filas}` })
    }

    if (destinos.length) {
        if (v.mostrarDestinos) {
            const filas = destinos.map(d => {
                const icono = d.cerrado ? "🔒 " : (d.emoji ? `${d.emoji} ` : "")
                const region = d.otraRegion ? ` · ${d.region}` : ""
                const detalle = d.cerrado ? " — *cerrado por ahora*" : (d.descripcion ? ` — ${d.descripcion}` : "")
                return `- ${icono}**${d.etiqueta}**${region}${detalle}`
            }).join("\n")
            hijos.push({ type: 14, divider: true, spacing: 1 }, { type: 10, content: `### ${v.tituloDestinos}\n${filas}` })
        }
        if (v.nota) hijos.push({ type: 10, content: `-# ${v.nota}` })
        hijos.push({
            type: 1,
            components: [{
                type: 3,
                custom_id: crearCustomId({ action: "vestibulo_ir", extras: [doc._id] }),
                placeholder: v.placeholder,
                min_values: 1,
                max_values: 1,
                options: destinos.slice(0, MAX_DESTINOS).map(d => {
                    const opcion = { label: d.etiqueta.slice(0, 100), value: d.id }
                    const descripcion = d.cerrado ? "Cerrado por ahora" : [d.otraRegion ? d.region : null, d.descripcion].filter(Boolean).join(" · ")
                    if (descripcion) opcion.description = descripcion.slice(0, 100)
                    const emoji = d.cerrado ? { name: "🔒" } : emojiDeComponente(d.emoji)
                    if (emoji) opcion.emoji = emoji
                    return opcion
                })
            }]
        })
    } else {
        if (v.nota) hijos.push({ type: 10, content: `-# ${v.nota}` })
        avisos.push("Este vestíbulo no tiene destinos: no llevará a ningún sitio. Marca «Todas las áreas de mi región» o añade adyacentes.")
    }

    if (!v.rolId) avisos.push("Falta el rol de ubicación: sin él, entrar en esta área no cambia qué canales se ven.")
    if (!v.canales.length && !hilosRaiz.length) avisos.push("No has elegido canales visibles para esta área.")
    if (!v.raizId && !v.canalPersonalizado) avisos.push("Elige el canal principal del área: es donde se publica el vestíbulo.")
    else if (!doc.canalId) avisos.push("Falta el canal donde vive el vestíbulo.")
    else if (v.canales.some(c => c.id === doc.canalId)) avisos.push("El canal del vestíbulo también está en la lista de canales visibles; no hace falta, ya se trata aparte.")
    if (faltan.length) avisos.push(`Hay destinos que ya no existen y se ignoran: ${faltan.join(", ")}.`)
    if (destinos.length > MAX_DESTINOS) bloqueantes.push(`El menú admite ${MAX_DESTINOS} destinos y hay ${destinos.length}: quita adyacentes o desactiva «Todas las áreas de mi región».`)

    const vestibulos = todos.filter(d => d.tipo === "vestibulo" && d.vestibulo && d._id !== doc._id)
    const mismoRol = v.rolId ? vestibulos.filter(d => d.vestibulo.rolId === v.rolId).map(d => d.nombre) : []
    if (mismoRol.length) avisos.push(`El rol de ubicación también lo usa: ${mismoRol.join(", ")}. Cada área debería tener el suyo.`)
    const sinRol = destinos.filter(d => d.sinRol && !d.cerrado).map(d => d.etiqueta)
    if (sinRol.length) avisos.push(`Estos destinos aún no tienen rol y no se podrá entrar: ${sinRol.join(", ")}.`)
    // Un camino de solo ida suele ser un descuido: quien llega no puede volver por donde vino
    const sinVuelta = destinos
        .filter(d => !d.cerrado)
        .filter(d => !destinosDe(todos.find(x => x._id === d.id), [...vestibulos, doc]).lista.some(x => x.id === doc._id))
        .map(d => d.etiqueta)
    if (sinVuelta.length) avisos.push(`Camino de solo ida: desde ${sinVuelta.join(", ")} no se puede volver aquí.`)

    const container = { type: 17, components: hijos }
    if (v.accent_color !== null && v.accent_color !== undefined) container.accent_color = v.accent_color

    const total = hijos.filter(h => h.type === 10).reduce((n, h) => n + h.content.length, 0)
    if (total > MAX_TEXTO_V2) bloqueantes.push(`El texto suma ${total} caracteres y Discord admite ${MAX_TEXTO_V2} por mensaje: acorta la descripción o quita canales.`)

    return {
        components: [container],
        eleccion: {},
        objetos: null,
        destinos: destinos.map(({ id, etiqueta, origen, cerrado, otraRegion }) => ({ id, etiqueta, origen, cerrado, otraRegion })),
        hilos: v.mostrarCanales ? v.canales.reduce((n, c) => n + (c.hilos?.length || 0), hilosRaiz.length) : 0,
        avisos,
        bloqueantes
    }
}

/** Todos los vestíbulos guardados. Si se pasa un borrador, sustituye (o añade) al guardado con su mismo id. */
async function listarVestibulos(dbServer, borrador = null) {
    const docs = await dbServer.collection(COLECCION).find({ tipo: "vestibulo" }).toArray()
    if (!borrador) return docs
    return [...docs.filter(d => d._id !== borrador._id), borrador]
}

// ─── Servidor: canales y roles para los selectores del dashboard ─────────────

const TIPOS_CANAL = { 0: "texto", 2: "voz", 5: "anuncios", 13: "escenario", 15: "foro", 16: "galeria" }

async function listarServidor(client, guildId) {
    const guild = await client.guilds.fetch(guildId)
    const [canales, roles, yo] = await Promise.all([guild.channels.fetch(), guild.roles.fetch(), guild.members.fetchMe()])
    const techo = yo.roles.highest.position

    return {
        canales: [...canales.values()]
            .filter(c => c && TIPOS_CANAL[c.type])
            .sort((a, b) => ((a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1)) || (a.rawPosition - b.rawPosition))
            .map(c => ({ id: c.id, nombre: c.name, tipo: TIPOS_CANAL[c.type], categoriaId: c.parentId || null, categoria: c.parent?.name || "Sin categoría" })),
        roles: [...roles.values()]
            .filter(r => r.id !== guild.id && !r.managed)
            .sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, nombre: r.name, color: r.color || null, asignable: r.position < techo }))
    }
}

// ─── Hilos de un canal ───────────────────────────────────────────────────────

const HILOS_ACTIVOS_TTL = 15_000
let _hilosActivos = null         // { guildId, hasta, promesa }: una sola consulta aunque el dashboard pida varios canales a la vez

function hilosActivos(guild) {
    if (!_hilosActivos || _hilosActivos.guildId !== guild.id || _hilosActivos.hasta < Date.now()) {
        const promesa = guild.channels.fetchActiveThreads().then(r => [...r.threads.values()])
        promesa.catch(() => { if (_hilosActivos?.promesa === promesa) _hilosActivos = null })
        _hilosActivos = { guildId: guild.id, hasta: Date.now() + HILOS_ACTIVOS_TTL, promesa }
    }
    return _hilosActivos.promesa
}

/**
 * Hilos de un canal, activos y archivados (también las publicaciones de un foro), del más antiguo al más nuevo.
 * Los archivados privados solo salen si el bot tiene «Gestionar hilos» en el canal.
 * @returns {Promise<{ canalId: string, hilos: { id: string, nombre: string, archivado: boolean }[], hayMas: boolean }>}
 */
async function listarHilos(client, guildId, canalId) {
    if (!ID_DISCORD.test(String(canalId || ""))) throw new ErrorEvento(400, "El canal debe ser un ID de Discord (17 a 20 cifras).")
    const guild = await client.guilds.fetch(guildId)
    const canal = await guild.channels.fetch(canalId).catch(() => null)
    if (!canal) throw new ErrorEvento(404, "No encuentro ese canal en el servidor.")
    // Voz, escenario y categorías no tienen hilos
    if (typeof canal.threads?.fetchArchived !== "function") return { canalId, hilos: [], hayMas: false }

    const encontrados = new Map()
    for (const h of await hilosActivos(guild)) if (h.parentId === canalId) encontrados.set(h.id, h)

    let hayMas = false
    const archivados = async (opciones) => {
        let before
        for (let pagina = 0; pagina < 3; pagina++) {
            const r = await canal.threads.fetchArchived({ ...opciones, limit: 100, before }, false)
            for (const h of r.threads.values()) if (!encontrados.has(h.id)) encontrados.set(h.id, h)
            if (!r.hasMore || !r.threads.size) return
            before = r.threads.last()
        }
        hayMas = true
    }
    await archivados({ type: "public" })
    // Los foros no tienen hilos privados; en los demás puede faltar el permiso, y entonces simplemente no salen
    if (canal.type === 0) await archivados({ type: "private" }).catch(() => null)

    const hilos = [...encontrados.values()]
        .sort((a, b) => (a.createdTimestamp || 0) - (b.createdTimestamp || 0))
        .map(h => ({ id: h.id, nombre: h.name, archivado: Boolean(h.archived) }))
    return { canalId, hilos, hayMas }
}

// ─── Permisos de los canales ─────────────────────────────────────────────────

/**
 * Comprueba si cada canal del área está oculto para @everyone y visible para el rol de ubicación.
 * El canal del vestíbulo además debe ser de solo lectura para el rol.
 */
async function estadoPermisos(client, guildId, doc) {
    const v = doc.vestibulo
    const guild = await client.guilds.fetch(guildId)
    const yo = await guild.members.fetchMe()
    const rol = v.rolId ? await guild.roles.fetch(v.rolId).catch(() => null) : null

    const resultado = {
        rol: rol
            ? { id: rol.id, nombre: rol.name, asignable: rol.position < yo.roles.highest.position && !rol.managed }
            : null,
        botGestionaRoles: yo.permissions.has(PermissionFlagsBits.ManageRoles),
        canales: []
    }

    const objetivos = [
        ...(doc.canalId ? [{ id: doc.canalId, esVestibulo: true }] : []),
        // Con otro canal de publicación, el principal es un canal más del área: el rol debe verlo
        ...(v.raizId && v.raizId !== doc.canalId ? [{ id: v.raizId, esVestibulo: false }] : []),
        ...v.canales.filter(c => c.id !== doc.canalId && c.id !== v.raizId).map(c => ({ id: c.id, esVestibulo: false }))
    ]
    for (const obj of objetivos) {
        const canal = await guild.channels.fetch(obj.id).catch(() => null)
        if (!canal) { resultado.canales.push({ ...obj, nombre: null, ok: false, problemas: ["No encuentro el canal."] }); continue }
        if (canal.isThread()) {
            resultado.canales.push({ ...obj, nombre: canal.name, ok: true, hilo: true, problemas: [], nota: `Hilo: hereda los permisos de #${canal.parent?.name || "su canal"}.` })
            continue
        }
        const problemas = []
        if (canal.permissionsFor(guild.roles.everyone).has(PermissionFlagsBits.ViewChannel)) problemas.push("@everyone puede verlo")
        if (rol) {
            const delRol = canal.permissionsFor(rol)
            if (!delRol.has(PermissionFlagsBits.ViewChannel)) problemas.push("el rol del área no puede verlo")
            if (obj.esVestibulo && delRol.has(PermissionFlagsBits.SendMessages)) problemas.push("el rol puede escribir en el vestíbulo")
        }
        const delBot = canal.permissionsFor(yo)
        const botPuede = delBot.has(PermissionFlagsBits.ViewChannel) && delBot.has(PermissionFlagsBits.ManageRoles)
        resultado.canales.push({ ...obj, nombre: canal.name, categoria: canal.parent?.name || null, ok: problemas.length === 0, problemas, botPuede })
    }
    resultado.pendientes = resultado.canales.filter(c => !c.ok).length
    return resultado
}

/** Corrige los permisos que estadoPermisos marca como pendientes. Solo se llama desde el botón del dashboard. */
async function aplicarPermisos(client, guildId, doc, autor = "dashboard") {
    const v = doc.vestibulo
    if (!v.rolId) throw new ErrorEvento(400, "Elige primero el rol de ubicación del área.")
    const guild = await client.guilds.fetch(guildId)
    const yo = await guild.members.fetchMe()
    const rol = await guild.roles.fetch(v.rolId).catch(() => null)
    if (!rol) throw new ErrorEvento(404, "El rol de ubicación ya no existe en el servidor.")

    const estado = await estadoPermisos(client, guildId, doc)
    const motivo = `Vestíbulo «${v.area}» (${autor})`
    const aplicados = []
    const fallos = []
    for (const c of estado.canales.filter(x => !x.ok && x.nombre)) {
        if (!c.botPuede) { fallos.push(`#${c.nombre}: al bot le falta «Gestionar permisos» en ese canal.`); continue }
        try {
            const canal = await guild.channels.fetch(c.id)
            // Primero el bot: si no es administrador, ocultar el canal a @everyone lo dejaría fuera a él también
            await canal.permissionOverwrites.edit(yo.id, { ViewChannel: true, SendMessages: true }, { reason: motivo })
            await canal.permissionOverwrites.edit(rol.id, c.esVestibulo
                ? { ViewChannel: true, ReadMessageHistory: true, SendMessages: false, CreatePublicThreads: false, CreatePrivateThreads: false, AddReactions: false }
                : { ViewChannel: true }, { reason: motivo })
            await canal.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false }, { reason: motivo })
            aplicados.push(c.nombre)
        } catch (err) {
            fallos.push(`#${c.nombre}: ${err.message}`)
        }
    }
    return { aplicados, fallos, estado: await estadoPermisos(client, guildId, doc) }
}

// ─── Movimiento ──────────────────────────────────────────────────────────────

const nombreDe = (character) => character?.perfil?.Nombre || character?.Nombre || "Tu reflejo"

/** Deja al miembro con un único rol de ubicación: el del vestíbulo dado. */
async function ponerRolDeArea(member, destino, vestibulos, motivo) {
    const deUbicacion = new Set(vestibulos.map(d => d.vestibulo?.rolId).filter(Boolean))
    const actuales = [...member.roles.cache.keys()].filter(id => id !== member.guild.id)
    const nuevos = [...actuales.filter(id => !deUbicacion.has(id)), destino.vestibulo.rolId]
    const igual = nuevos.length === actuales.length && nuevos.every(id => actuales.includes(id))
    if (!igual) await member.roles.set(nuevos, motivo)
}

/**
 * Mueve al personaje activo de un vestíbulo a otro.
 * @returns {Promise<{ ok: boolean, texto: string, destino?: object, publico?: { canalId: string, texto: string } }>}
 */
async function moverPersonaje({ member, character, origenId, destinoId, dbServer, dbRol }) {
    const vestibulos = await listarVestibulos(dbServer)
    const origen = vestibulos.find(d => d._id === origenId)
    if (!origen) return { ok: false, texto: TEXTOS.sinCamino }
    if (!character) return { ok: false, texto: TEXTOS.sinPersonaje }

    const enlace = destinosDe(origen, vestibulos).lista.find(d => d.id === destinoId)
    const destino = vestibulos.find(d => d._id === destinoId)
    if (!enlace || !destino) return { ok: false, texto: TEXTOS.sinCamino }

    const datos = { personaje: nombreDe(character), area: destino.vestibulo.area, origen: origen.vestibulo.area, region: destino.vestibulo.region || "" }
    if (enlace.cerrado) return { ok: false, texto: rellenar(enlace.mensajeCerrado, datos) }
    if (!destino.vestibulo.rolId) return { ok: false, texto: TEXTOS.noListo }

    if (origen.vestibulo.bloquearEnCombate) {
        // Import diferido: duelManager arrastra todo el sistema de combate
        const { duelSystem } = require("./Duelo/duelManager")
        const peleando = duelSystem.estaEnCombate(character._id) || duelSystem.estaEnCombate(member.id) || await duelSystem.personajeEnDuelo(character._id)
        if (peleando) return { ok: false, texto: rellenar(origen.vestibulo.mensajeCombate || TEXTOS.combate, datos) }
    }

    try {
        await ponerRolDeArea(member, destino, vestibulos, `Vestíbulo: ${datos.personaje} va de ${datos.origen} a ${datos.area}`)
    } catch (err) {
        console.error(`[Vestíbulos] No se pudo cambiar el rol de ${member.id} hacia '${destinoId}':`, err.message)
        return { ok: false, texto: TEXTOS.noListo }
    }

    await dbRol.collection("Personajes").updateOne(
        { _id: character._id },
        { $set: { ubicacion: { vestibulo: destino._id, area: destino.vestibulo.area, region: destino.vestibulo.region || null, desde: new Date() } } }
    )

    const ll = destino.vestibulo.llegada || {}
    const pool = ll.mensajes?.length ? ll.mensajes : [TEXTOS.llegada]
    const mensaje = rellenar(pool[Math.floor(Math.random() * pool.length)], datos)
    // Sin canal elegido, el anuncio va al canal principal del área (el jugador ya lo ve: acaba de recibir su rol)
    const canalPublico = ll.canalId || destino.vestibulo.raizId || destino.canalId || destino.vestibulo.canales[0]?.id || null
    return {
        ok: true,
        destino,
        publico: ll.modo === "canal" && canalPublico ? { canalId: canalPublico, texto: mensaje } : null
    }
}

/**
 * Pone al miembro el rol del área donde está su personaje activo. Se llama al cambiar de personaje.
 * Un personaje que nunca se ha movido aparece en el vestíbulo marcado como punto de aparición, si hay uno.
 * Nunca lanza: un fallo aquí no debe impedir el cambio de personaje.
 */
async function sincronizarUbicacion(client, guildId, dbServer, dbRol, discordId, personajeId) {
    try {
        if (!client) return null
        const vestibulos = await listarVestibulos(dbServer)
        if (!vestibulos.some(d => d.vestibulo?.rolId)) return null

        const n = Number(personajeId)
        const filtro = Number.isNaN(n) ? { _id: String(personajeId) } : { $or: [{ _id: n }, { _id: String(personajeId) }] }
        const pj = await dbRol.collection("Personajes").findOne(filtro, { projection: { ubicacion: 1 } })
        if (!pj) return null

        let destino = vestibulos.find(d => d._id === pj.ubicacion?.vestibulo && d.vestibulo?.rolId)
        const eraNuevo = !destino
        if (!destino) destino = vestibulos.find(d => d.vestibulo?.inicial && d.vestibulo.rolId)
        if (!destino) return null

        const guild = await client.guilds.fetch(guildId)
        const member = await guild.members.fetch(String(discordId)).catch(() => null)
        if (!member) return null
        await ponerRolDeArea(member, destino, vestibulos, "Vestíbulo: cambio de personaje activo")
        if (eraNuevo) {
            await dbRol.collection("Personajes").updateOne(
                { _id: pj._id },
                { $set: { ubicacion: { vestibulo: destino._id, area: destino.vestibulo.area, region: destino.vestibulo.region || null, desde: new Date() } } }
            )
        }
        return destino._id
    } catch (err) {
        console.error(`[Vestíbulos] No se pudo sincronizar la ubicación de ${discordId}:`, err.message)
        return null
    }
}

module.exports = {
    TEXTOS,
    normalizarVestibulo,
    destinosDe,
    construirVestibulo,
    listarVestibulos,
    listarServidor,
    listarHilos,
    estadoPermisos,
    aplicarPermisos,
    moverPersonaje,
    sincronizarUbicacion
}
