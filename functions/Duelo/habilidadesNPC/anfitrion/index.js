// ─── El Anfitrión: el jefe oculto detrás de Sosias ───────────────────────────
// Referencia: Anfitrion_Jefe_Sosias.md. Sosias castiga ser predecible; El Anfitrión copia tus
// hábitos y juega contra ellos. La única forma de ganar es variar de verdad.
//
//   I   El Reflejo     disfraz de Sosias: no ataca, solo "Te observa". Al 1% no muere: Ruptura.
//   II  La Bienvenida  100% → 65%: copia al jugador más predecible, Miedo, juega contra tu patrón.
//   III Los Invitados  65% → 35%: seis reflejos (1 real), roba lo que más usas.
//   IV  La Despedida   35% → 0%: usa lo que nunca hiciste.
//
// Estado en el NPC (npc.anfitrion) y en la sesión (session.anfitrion, session.sinRendicion).
// La "cinta" del documento es el compás del combate: el jefe actúa una vez por turno, cuando el
// compás se lo da, como cualquier combatiente.

const { ANFITRION } = require("./config")
const P = require("./perfil")
const V = require("./voz")
const R = require("../robos")
const { aplicarEfecto, logSistema, filtrarProvocados } = require("../../hechizos/efectos")
const { ESTADOS } = require("../../hechizos/estados")
const cacheHechizos = require("../../hechizos/cache")

const tp = () => require("../../turnProcessor")
const azar = (l) => l[Math.floor(Math.random() * l.length)]
const barajar = (l) => l.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x)

const estado = (npc) => (npc.anfitrion ??= { fase: 1, turnos: 0, turnosFase: 0, rupturado: false, robos: [], caidos: {}, senuelos: [], dijo: {}, expectativa: null, fallos: 0, combos: {}, ultimaAccion: null })

function bandos(session, npc) {
    const esEquipo1 = session.teams[0].some(c => c.ID === npc.ID)
    return { aliados: esEquipo1 ? session.teams[0] : session.teams[1], rivales: esEquipo1 ? session.teams[1] : session.teams[0] }
}
const jugadores = (session, npc) => bandos(session, npc).rivales.filter(c => !c.isNPC)
const vivos = (lista) => lista.filter(c => !c.defeated)

/** "Adicionales" = jugadores además del primero; un bloque cada 2 (VI). */
const bloquesDe = (n) => Math.floor(Math.max(0, n - 1) / 2)

function sesionAnfitrion(session, npc) {
    session.anfitrion ??= {
        realId: npc.ID, rupturado: false, solo: jugadores(session, npc).length === 1,
        huidas: { ...(npc.anfitrionDatos?.huidas || {}) },   // por personaje, desde la cuenta (voz)
        dichos: new Set(),                                    // frases ya dichas en este combate
    }
    return session.anfitrion
}

const dialogo = () => require("../../dialogoCombate")

/**
 * En solitario habla con tu voz; en grupo nunca habla. En Fase III solo habla el real.
 * Las voces no van al log: llegan como diálogo aparte (embed efímero), con una pausa.
 */
function hablar(session, npc, texto, { cambio = false } = {}) {
    const info = sesionAnfitrion(session, npc)
    if (!texto || !info.solo || info.dichos.has(texto)) return   // nunca repite una frase
    info.dichos.add(texto)
    dialogo().decir(session, { autor: npc.Nombre, avatarURL: npc.avatarURL, texto, cambio })
}
/** Mecánicas visibles (robos, pilar, recomposición, "Te observa"): sí van al log de acciones. */
const narrar = (session, npc, texto) => texto && logSistema(session, texto, { autor: npc.Nombre })
/** Narración de un cambio de fase: diálogo aparte, con pausa de suspenso. */
const narrarCambio = (session, texto, extra = {}) => texto && dialogo().decir(session, { autor: "✦", texto: `*${texto}*`, cambio: true, ...extra })

// ─── Copia ───────────────────────────────────────────────────────────────────

function copiar(npc, jugador, { vida = null, bloques = 0 } = {}) {
    const st = estado(npc)
    const { normalizarStats } = require("../../combatientes")
    const vidaActual = npc.HP
    npc.stats = normalizarStats({ ...jugador.stats })
    npc.stats.manaMax = Number(jugador.stats?.manaMax) || npc.stats.manaMax
    npc.Mana = npc.stats.manaMax
    npc.tempo = npc.stats.agilidad || npc.tempo
    npc.elemento = jugador.elemento ?? npc.elemento
    npc.Elemento = npc.elemento
    npc.nivel = Number(jugador.nivelCombate) || npc.nivel
    // La copia no tiene bendición de Heraldo (no se copia jugador.heraldo)
    Object.defineProperty(npc, "multiplicadorDanio", {
        value: (Number(jugador.multiplicadorDanio) || 1) * (1 + ANFITRION.DANIO_POR_BLOQUE * bloques),
        configurable: true, writable: true,
    })
    npc.maestrias = { ...(jugador.maestrias || {}) }
    npc.hechizos = [...(jugador.hechizos || [])]
    npc.esHumano = true
    npc.cooldowns = {}
    npc.avatarURL = jugador.avatarURL || npc.avatarURL
    if (vida !== null) {
        npc.stats.hpMax = vida
        npc.HP = vida
    } else {
        npc.stats.hpMax = st.vidaJefe
        npc.HP = vidaActual
    }
    st.copiadoId = jugador.ID
}

const copiado = (session, npc) => session.getCombatiente(estado(npc).copiadoId)

/** Getter de tempo de la clase (antes de cualquier ajuste del jefe). */
function tempoBase(obj) {
    for (let p = Object.getPrototypeOf(obj); p; p = Object.getPrototypeOf(p)) {
        const d = Object.getOwnPropertyDescriptor(p, "effectiveTempo")
        if (d?.get) return d.get
    }
    return null
}

/**
 * Cinta = compás. Su tempo sale de las stats copiadas (la misma forma que tu cinta) y, en grupo,
 * gana CASILLAS_POR_BLOQUE casillas por cada 2 jugadores adicionales: su valorCompas baja hasta
 * caber en más escalones de compasMax, así actúa más veces en la misma ronda. Lentitud y demás
 * modificadores siguen aplicando sobre la base.
 */
function instalarCompas(session, npc) {
    const st = estado(npc)
    const extra = (st.bloques || 0) * ANFITRION.CASILLAS_POR_BLOQUE
    const base = tempoBase(npc)
    if (!base) return
    const niveles = P.nivelesCompas(Number(session?.decayFactor) || 0.57, 1000)
    st.casillasExtra = extra
    Object.defineProperty(npc, "effectiveTempo", {
        configurable: true,
        get() {
            const t = base.call(this)
            const v = Math.floor(1000 / t)
            const v2 = P.valorConExtra(v, extra, niveles)
            return v2 < v ? 1000 / v2 : t
        },
    })
}

/** El "invitado" es el más predecible del grupo (el que mejor conoce), no quien dio el último golpe. */
function masPredecible(lista) {
    const orden = barajar(lista).sort((a, b) => P.confianzaEn(b) - P.confianzaEn(a))
    return orden[0] ?? null
}

// ─── Daño y acciones ─────────────────────────────────────────────────────────

/** Elemento que contrarresta al del jugador (inversión de pilar). */
function elementoContra(elemento) {
    const { TABLA_ELEMENTAL } = tp()
    const { normalizarElemento } = require("../../hechizos/elementos")
    const e = normalizarElemento(elemento)
    const candidatos = Object.entries(TABLA_ELEMENTAL || {}).filter(([k, t]) => k !== "Neutro" && t.fuerteContra.includes(e)).map(([k]) => k)
    return candidatos.length ? azar(candidatos) : null
}

/**
 * A quién ataca. Insiste en el jugador que está copiando, pero no siempre: en grupo repartir
 * objetivos evita que los seis reflejos se enfoquen en la misma persona toda la pelea.
 * @param {String|null} foco - personaje preferido (null = cualquiera)
 */
function objetivo(session, npc, { foco = undefined } = {}) {
    const lista = filtrarProvocados(vivos(jugadores(session, npc)))
    if (!lista.length) return null
    if (lista.length === 1) return lista[0]
    const preferido = foco === undefined ? estado(npc).copiadoId : foco
    if (preferido != null && Math.random() < ANFITRION.PROB_FOCO) {
        const p = lista.find(c => String(c.ID) === String(preferido))
        if (p) return p
    }
    return azar(lista)
}

/** ¿Puede el jefe usar ahora esta clave de acción? (solo golpe, guardia y hechizos suyos) */
function puedeUsarClave(npc, clave) {
    if (clave === "attack" || clave === "defend") return !R.estaRobado(npc, clave)
    if (!clave?.startsWith("spell:")) return false   // tus objetos solo los usa si te los roba
    const h = cacheHechizos.obtenerSync(clave.slice(6))
    if (!h || h.isActive === false) return false
    const { evaluarCasteo } = require("../../hechizos/casteo")
    return evaluarCasteo(npc, h, { ignorarKit: true }).ok
}

/**
 * Lo que haría el jugador en su lugar: copia hábitos, no solo el puño. Si tú vives lanzando
 * hechizos, él lanza hechizos. Nunca repite su acción anterior si tiene otra a mano.
 * @returns {String|null} clave de acción ("attack", "spell:ID"...) o null si no hay nada que imitar
 */
function claveEspejo(session, npc) {
    const st = estado(npc)
    const victima = copiado(session, npc)
    if (!victima) return null
    const usables = P.masUsadas(victima).filter(k => k !== "defend" && puedeUsarClave(npc, k))
    if (!usables.length) return null
    return usables.find(k => k !== st.ultimaAccion) ?? usables[0]
}

/** Ataca imitándote: con tu hechizo más usado si puede, y si no, a puño. El factor también escala el hechizo. */
async function atacarComo(session, npc, target, clave, { factor = 1, elemento = null } = {}) {
    if (!clave || clave === "attack") return golpear(session, npc, target, { factor, elemento })
    const base = Number(npc.multiplicadorDanio) || 1
    try {
        if (factor !== 1) Object.defineProperty(npc, "multiplicadorDanio", { value: base * factor, configurable: true, writable: true })
        return await ejecutarClave(session, npc, clave, target, { factor })
    } finally {
        if (factor !== 1) Object.defineProperty(npc, "multiplicadorDanio", { value: base, configurable: true, writable: true })
    }
}

/** Golpe del jefe con un factor de daño y, si toca, el pilar invertido. */
async function golpear(session, npc, target, { factor = 1, elemento = null } = {}) {
    const TurnProcessor = tp()
    if (!target) return null
    const hechizo = TurnProcessor._generarAtaqueBasico(npc)
    if (elemento) hechizo.Elemento = elemento
    const r = TurnProcessor._aplicarDaño({ ...hechizo.Mecanicas.damage, factor }, npc, target, hechizo, session)
    if (!r.esquivado && !r.inmune) session.addLog("ataque", { atacante: npc.Nombre, defensor: target.Nombre, daño: r.cantidad || 0 })
    TurnProcessor._verificarYRegistrarDerrotas(session, npc)
    return r
}

/** Ejecuta una clave de acción del jugador (lo robado, lo evitado o lo que repiten los señuelos). */
async function ejecutarClave(session, npc, clave, target, { factor = 1 } = {}) {
    const TurnProcessor = tp()
    if (clave === "defend") return TurnProcessor.resolveAction(session, npc.ID, { tipo: "defend" })
    if (clave?.startsWith("spell:")) {
        const id = clave.slice(6)
        const h = cacheHechizos.obtenerSync(id)
        if (h) {
            if (npc.cooldowns) delete npc.cooldowns[h._id]
            const r = await TurnProcessor.resolverHechizo(session, npc, h._id, { damage: target ? [target.ID] : [], healing: [npc.ID] })
            if (r?.success && !r.requiresInteraction) return r
        }
        return golpear(session, npc, target, { factor })
    }
    if (clave?.startsWith("item:")) return simularObjeto(session, npc, clave, target)
    return golpear(session, npc, target, { factor })
}

/** El jefe "usa" un objeto: aplica sus efectos sobre sí mismo (o sobre ti si son ofensivos). No gasta nada tuyo. */
async function simularObjeto(session, npc, clave, target) {
    const [, region, id] = clave.split(":")
    const def = require("../../../catalogoObjetos").getObjetoPorId(region, Number(id))
    if (!def?.efectos?.length) return golpear(session, npc, target)
    const { aplicarEfectoObjeto } = require("../../efectosObjeto")
    const sobre = def.uso?.objetivo?.tipo === "enemigos" && target ? target : npc
    for (const efecto of def.efectos) aplicarEfectoObjeto({ session, caster: npc, target: sobre, efecto, objeto: def })
    narrar(session, npc, `${npc.Nombre} usa ${def.Nombre}.`)
    return { success: true }
}

/**
 * Contraataque previsto (Fase II y el real de la III).
 * Cuando te lee no gasta el turno en cubrirse: apunta lo que vas a hacer (`st.expectativa`) y, si
 * aciertas, te bloquea el golpe en el acto. Nunca repite su acción anterior dos veces seguidas:
 * si lo último fue cubrirse, esta vez golpea.
 */
async function contraatacar(session, npc) {
    const st = estado(npc)
    const info = sesionAnfitrion(session, npc)
    const target = objetivo(session, npc)
    const todos = jugadores(session, npc)
    const historial = info.solo ? (copiado(session, npc)?.perfilTurnos || []) : P.historialConjunto(todos)
    const { prediccion, confianza } = P.predecir(historial)
    const inversion = st.turnosFase % ANFITRION.INVERSION_CADA === 0
    const elemento = inversion ? elementoContra(target?.elemento) : null
    if (inversion && elemento) narrar(session, npc, `${npc.Nombre} cambia de pilar: su golpe sabe a ${elemento}.`)

    const hacer = (clave, accion) => { st.ultimaAccion = clave; return accion() }

    if (prediccion && confianza >= ANFITRION.UMBRAL_CONFIANZA) {
        st.expectativa = { categoria: prediccion, pjId: info.solo ? (copiado(session, npc)?.ID ?? null) : null }
        if (prediccion === "guardia" && target && st.ultimaAccion !== "confundir") {
            aplicarEfecto({ sesion: session, caster: npc, target, efecto: { tipo: "degradacion", nombre: ESTADOS.confusion.nombre, degrada: { ...ESTADOS.confusion.degrada }, duracion: 2 } })
            return hacer("confundir", () => narrar(session, npc, `${npc.Nombre} no golpea tu guardia: te desorienta.`))
        }
        const ofensiva = prediccion === "golpe" || prediccion === "hechizo_dano"
        if (ofensiva && st.ultimaAccion !== "defend" && Math.random() < ANFITRION.PROB_DEFENDER) {
            return hacer("defend", () => tp().resolveAction(session, npc.ID, { tipo: "defend" }))
        }
        const clave = claveEspejo(session, npc) ?? "attack"
        return hacer(clave, () => atacarComo(session, npc, target, clave, { factor: ANFITRION.FACTOR_CASTIGO, elemento }))
    }
    // Aún no te lee: ataca con menos fuerza (la frase de duda sale tras varias acciones inesperadas)
    st.expectativa = null
    const clave = claveEspejo(session, npc) ?? "attack"
    return hacer(clave, () => atacarComo(session, npc, target, clave, { factor: ANFITRION.FACTOR_DUDA, elemento }))
}

/**
 * El jugador acaba de actuar: ¿era lo que El Anfitrión esperaba? Lo llama el TurnProcessor al
 * registrar la acción, antes de aplicar el daño. Quedarse AFK no registra acción: no cuenta.
 * @param {Object} session
 * @param {Object} pj - el personaje que actuó
 * @param {String} categoria - categoría de la acción (golpe, guardia, hechizo_dano...)
 */
function alActuarJugador(session, pj, categoria) {
    const npc = session?.getCombatiente?.(session?.anfitrion?.realId)
    if (!npc || npc.defeated || npc.habilidadUnica !== "anfitrion") return
    const st = estado(npc)
    if (!st.rupturado) return
    // Sin predicción en pie tampoco te adivinó: el combo crece, pero no cuenta como fallo de lectura
    if (!st.expectativa) return sumarCombo(npc, pj)
    const { categoria: esperada, pjId } = st.expectativa
    if (pjId && String(pjId) !== String(pj.ID)) return
    st.expectativa = null

    if (categoria === esperada) {
        st.fallos = 0
        st.combos ??= {}
        st.combos[pj.ID] = 0                   // te leyó: se corta el combo
        // Lo esperaba: el siguiente golpe que le llegue lo para en seco
        if (esperada === "golpe" || esperada === "hechizo_dano") npc._bloqueaProximo = String(pj.ID)
        return
    }
    sumarCombo(npc, pj)
    st.fallos = (st.fallos || 0) + 1
    if (st.fallos < ANFITRION.FALLOS_PARA_DUDA) return
    st.fallos = 0                              // la frase se gasta; el combo sigue vivo
    hablar(session, npc, V.frase("duda", copiado(session, npc), { dichos: sesionAnfitrion(session, npc).dichos }))
}

/** Una acción más que no vio venir. */
function sumarCombo(npc, pj) {
    const st = estado(npc)
    st.combos ??= {}
    st.combos[pj.ID] = (st.combos[pj.ID] || 0) + 1
}

/**
 * Daño que recibe por el combo de quien le pega: mientras encadenes acciones que no adivina,
 * tus golpes Y tus hechizos entran al doble. En cuanto te lee, se corta.
 * @returns {Number} multiplicador (1 = sin bonus)
 */
function bonusCombo(npc, pj) {
    const st = npc?.anfitrion
    if (!st?.rupturado || npc.esSenuelo) return 1
    return (st.combos?.[pj.ID] || 0) >= ANFITRION.COMBO_PARA_BONUS ? ANFITRION.MULT_COMBO : 1
}

/** Acaba de bloquear el golpe que ya esperaba: ahora sí lo dice. */
function trasBloquear(session, npc, pj) {
    if (npc?.habilidadUnica !== "anfitrion") return
    hablar(session, npc, V.frase("repite", pj, { dichos: sesionAnfitrion(session, npc).dichos }))
}

// ─── Fases ───────────────────────────────────────────────────────────────────

/** Piso de vida: en la Fase I no baja del 1% (ahí ocurre la Ruptura). */
function pisoVida(npc) {
    const st = estado(npc)
    if (st.fase !== 1 || st.rupturado) return 0
    return Math.max(1, Math.ceil((Number(npc.stats?.hpMax) || 1) * ANFITRION.RUPTURA_PCT))
}

function ruptura(session, npc) {
    const st = estado(npc)
    const info = sesionAnfitrion(session, npc)
    if (st.rupturado) return
    st.rupturado = true
    info.rupturado = true
    session.sinRendicion = true

    const todos = jugadores(session, npc)
    const invitado = masPredecible(vivos(todos)) ?? todos[0]
    if (!invitado) return
    const vida = info.solo
        ? Math.round((Number(invitado.stats?.hpMax) || 1) * ANFITRION.ESCALADO)
        : Math.round(todos.reduce((s, j) => s + (Number(j.stats?.hpMax) || 0), 0) * ANFITRION.ESCALADO_GRUPO)
    st.vidaJefe = Math.max(1, vida)
    st.bloques = bloquesDe(todos.length)
    npc.nombreDisfraz ??= npc.Nombre
    npc.Nombre = "El Anfitrión"
    copiar(npc, invitado, { vida: st.vidaJefe, bloques: st.bloques })
    instalarCompas(session, npc)
    npc.defeated = false
    npc.statusEffect = (npc.statusEffect || []).filter(e => e.interno)

    narrarCambio(session, V.NARRACION.ruptura)
    const asustados = ANFITRION.MIEDO_SOLO_COPIADO ? [invitado] : vivos(todos)
    for (const j of asustados) {
        aplicarEfecto({ sesion: session, caster: npc, target: j, efecto: { tipo: "degradacion", nombre: ESTADOS.miedo.nombre, degrada: { ...ESTADOS.miedo.degrada }, duracion: ANFITRION.MIEDO_TURNOS } })
    }
    hablar(session, npc, V.frase("ruptura", invitado, { huidas: info.huidas?.[invitado.ID], heraldo: invitado.heraldo, dichos: info.dichos }), { cambio: true })
    st.fase = 2
    st.turnosFase = 0
}

function crearSenuelos(session, npc) {
    const st = estado(npc)
    const { NPC } = require("../../combatientes")
    const nombres = barajar([...ANFITRION.REFLEJOS])
    npc.Nombre = nombres[0]
    const equipo = bandos(session, npc).aliados
    // Todos los reflejos muestran la misma vida que el real (si no, se sabría cuál es); los señuelos
    // reciben un daño exagerado: golpearlos los delata, pero hay que golpear para saberlo
    st.senuelos = nombres.slice(1).map((nombre, i) => {
        const s = new NPC(`${npc.ID}eco${i + 1}`, {
            Nombre: nombre, HP: npc.HP, Mana: npc.Mana, Elemento: npc.elemento, avatarURL: npc.avatarURL,
            Type: "Enemigo", tipo: "humano", stats: { ...npc.stats, hpMax: npc.stats.hpMax }, nivel: npc.nivel,
            permiteAtaqueBasico: true, permiteDefensaBasica: true,
        })
        s.habilidadUnica = "anfitrion_eco"
        s.esSenuelo = true
        s.multDanioRecibido = ANFITRION.DANIO_RECIBIDO_SENUELO
        // Un reflejo no es el original: por mucho que se cure, apenas se recompone
        s.curaMaxima = Math.max(1, Math.round((npc.stats.hpMax || 1) * ANFITRION.CURA_SENUELO_PCT))
        s.anfitrionRealId = npc.ID
        s.hechizos = [...(npc.hechizos || [])]
        s.maestrias = { ...(npc.maestrias || {}) }
        s.esHumano = true
        Object.defineProperty(s, "multiplicadorDanio", { value: (Number(npc.multiplicadorDanio) || 1) * ANFITRION.DANIO_SENUELO, configurable: true, writable: true })
        s.valorCompas = Math.floor(1000 / s.effectiveTempo)
        s.bolitaPos = s.valorCompas
        equipo.push(s)
        return s.ID
    })
}

function fase3(session, npc) {
    const st = estado(npc)
    st.fase = 3
    st.turnosFase = 0
    narrarCambio(session, V.NARRACION.reflejos)
    crearSenuelos(session, npc)
    hablar(session, npc, V.frase("fase3", copiado(session, npc), { dichos: sesionAnfitrion(session, npc).dichos }), { cambio: true })
    // El Sol (Ojos solares): pista tenue, nunca la respuesta
    const sol = jugadores(session, npc).filter(j => /\bsol\b/i.test(String(j.heraldo || "")))
    if (sol.length) {
        const senuelo = session.getCombatiente(azar(st.senuelos))
        const par = barajar([npc.Nombre, senuelo?.Nombre].filter(Boolean))
        if (par.length === 2) {
        // Pista solo para quien sigue a El Sol
        dialogo().decir(session, { autor: "☀", texto: `*${V.NARRACION.solar(par[0], par[1])}*`, destinatarios: sol.map(j => j.ownerId).filter(Boolean), cambio: true })
    }
    }
}

function retirarSenuelos(session, npc) {
    for (const id of estado(npc).senuelos) {
        const s = session.getCombatiente(id)
        if (!s) continue
        s.HP = 0
        s.defeated = true
        s._alreadyLoggedDefeat = true
        s.sinRecomponer = true
        delete s.activeCast
    }
}

function fase4(session, npc) {
    const st = estado(npc)
    st.fase = 4
    st.turnosFase = 0
    retirarSenuelos(session, npc)
    npc.Nombre = "El Anfitrión"
    narrarCambio(session, V.NARRACION.despedida)
    hablar(session, npc, V.frase("fase4", copiado(session, npc), { dichos: sesionAnfitrion(session, npc).dichos }), { cambio: true })
}

function final(session, npc) {
    const st = estado(npc)
    if (st.terminado) return
    st.terminado = true
    retirarSenuelos(session, npc)
    for (const j of jugadores(session, npc)) R.devolverTodo(j)
    narrarCambio(session, V.NARRACION.final(npc.Nombre), { final: true })
}

/** Gancho del daño recibido (lo llama NPC.alRecibirDanioEfectivo). */
function alRecibirDanio(npc, efectivo, origen = {}) {
    const session = origen.sesion
    if (!session || npc.esSenuelo) return
    const st = estado(npc)
    if (!st.rupturado) {
        if (npc.HP <= pisoVida(npc)) ruptura(session, npc)
        return
    }
    if (npc.defeated) return final(session, npc)
    const pct = npc.HP / (Number(npc.stats?.hpMax) || 1)
    if (st.fase === 2 && pct <= ANFITRION.FASE_III_PCT) fase3(session, npc)
    if (st.fase === 3 && pct <= ANFITRION.FASE_IV_PCT) fase4(session, npc)
}

// ─── Robos (Fase III) ────────────────────────────────────────────────────────

function nombreRobo(clave) {
    if (clave.startsWith("spell:")) return R.nombreClave(clave, { hechizo: cacheHechizos.obtenerSync(clave.slice(6)) })
    if (clave.startsWith("item:")) {
        const [, region, id] = clave.split(":")
        return R.nombreClave(clave, { objeto: require("../../../catalogoObjetos").getObjetoPorId(region, Number(id)) })
    }
    return R.nombreClave(clave)
}

function intentarRobo(session, npc) {
    const st = estado(npc)
    if (st.robos.length >= ANFITRION.MAX_ROBOS) return
    const victima = copiado(session, npc)
    if (!victima || victima.defeated) return
    const ya = st.robos.filter(r => String(r.pjId) === String(victima.ID)).map(r => r.clave)
    const clave = P.masUsadas(victima, ya).find(k => k === "attack" || k === "defend" || k.startsWith("spell:") || k.startsWith("item:"))
    if (!clave || !R.robar(victima, clave, npc.ID)) return
    st.robos.push({ pjId: victima.ID, clave })
    narrar(session, npc, V.NARRACION.robo(nombreRobo(clave), sesionAnfitrion(session, npc).solo ? null : victima.Nombre))
}

async function usarRobado(session, npc) {
    const st = estado(npc)
    const robo = st.robos.shift()
    if (!robo) return false
    const victima = session.getCombatiente(robo.pjId)
    await ejecutarClave(session, npc, robo.clave, objetivo(session, npc))
    R.devolver(victima, robo.clave)
    // Con varios jugadores hay que decir a quién se le devuelve, o nadie sabe que ya puede usarlo
    narrar(session, npc, V.NARRACION.devolucion(nombreRobo(robo.clave), sesionAnfitrion(session, npc).solo ? null : victima?.Nombre))
    return true
}

function recomponerSenuelos(session, npc) {
    const st = estado(npc)
    for (const id of st.senuelos) {
        const s = session.getCombatiente(id)
        if (!s || !s.defeated || s.sinRecomponer) { if (s && !s.defeated) delete st.caidos[id]; continue }
        st.caidos[id] ??= st.turnos
        if (st.turnos - st.caidos[id] >= ANFITRION.RECOMPONER_TURNOS) {
            // Se recompone con la vida que el real tenga ahora: siguen viéndose iguales
            s.stats.hpMax = npc.stats.hpMax
            s.HP = npc.HP
            s.defeated = false
            s._alreadyLoggedDefeat = false
            s.statusEffect = []
            delete st.caidos[id]
            narrar(session, npc, V.NARRACION.recompone(s.Nombre))
        }
    }
}

// ─── Fase IV: lo que nunca hiciste ───────────────────────────────────────────

/**
 * Lo que nunca fuiste: hechizos de la base que el jugador no tiene. Solo los que sirven (activos,
 * con mecánicas de verdad) y que el jefe puede lanzar ahora mismo (maná, estados, enfriamiento).
 * @returns {Object[]} hechizos normalizados
 */
function repertorioAjeno(npc, jugador) {
    const { evaluarCasteo } = require("../../hechizos/casteo")
    const mios = new Set((jugador?.hechizos || []).map(h => String(typeof h === "object" ? (h.ID ?? h.id) : h)))
    return cacheHechizos.todos().filter(h => {
        const id = String(h?._id ?? "")
        if (!h || h.isActive === false || !id) return false
        if (mios.has(id) || /^(univ-|default_|basic_|inline_)/.test(id)) return false
        if ((Number(h.Escalon) || 1) > ANFITRION.ESCALON_MAX_AJENO) return false
        const m = h.Mecanicas || {}
        // Un hechizo sin daño, sin cura y sin efectos no hace nada: no lo usa
        if (!m.damage && !m.healing && !(m.Efectos?.length)) return false
        return evaluarCasteo(npc, h, { ignorarKit: true }).ok
    })
}

/** Cambia de pilar de verdad: su elemento pasa a ser el del hechizo que va a usar. */
function cambiarPilar(session, npc, elemento) {
    const { normalizarElemento } = require("../../hechizos/elementos")
    const e = normalizarElemento(elemento)
    if (!e || e === npc.elemento) return
    npc.elemento = e
    npc.Elemento = e
    narrar(session, npc, `${npc.Nombre} cambia de pilar: ahora es ${e}.`)
}

/**
 * Fase IV. Ya no te copia: usa lo que nunca usaste. Sobre todo hechizos ajenos a tu camino
 * (cambiando de pilar para lanzarlos), y si no, la acción tuya que menos tocas. Tus objetos no:
 * los usaba por ser lo que menos usas, y no hacían nada.
 */
async function accionEvitada(session, npc) {
    const jugador = copiado(session, npc)
    const target = objetivo(session, npc)
    if (!jugador) return golpear(session, npc, target)

    const ajenos = repertorioAjeno(npc, jugador)
    if (ajenos.length && Math.random() < ANFITRION.PROB_AJENO) {
        // Prefiere el pilar que contrarresta al tuyo; si no hay, cualquiera que no sea el suyo
        const contra = elementoContra(target?.elemento)
        const { normalizarElemento } = require("../../hechizos/elementos")
        const preferidos = contra ? ajenos.filter(h => normalizarElemento(h.Elemento) === contra) : []
        const otros = ajenos.filter(h => normalizarElemento(h.Elemento) !== npc.elemento)
        const h = azar(preferidos.length ? preferidos : (otros.length ? otros : ajenos))
        cambiarPilar(session, npc, h.Elemento)
        return ejecutarClave(session, npc, R.claveHechizo(h._id), target)
    }

    const hechizos = (jugador.hechizos || []).map(h => (typeof h === "object" ? (h.ID ?? h.id) : h))
        .filter(id => id && id !== "default_001" && id !== "univ-001" && cacheHechizos.obtenerSync(id)?.isActive !== false && cacheHechizos.obtenerSync(id))
        .map(R.claveHechizo)
        .filter(k => puedeUsarClave(npc, k))
    const opciones = ["attack", "defend", ...hechizos]
    const clave = azar(P.menosUsadas(opciones, jugador.usosClave || {}))
    return ejecutarClave(session, npc, clave, target)
}

// ─── Turnos ──────────────────────────────────────────────────────────────────

/** En grupo cambia de jugador cada cierto tiempo (nunca el mismo dos veces seguidas). */
function cambiarPerspectiva(session, npc) {
    const st = estado(npc)
    if (sesionAnfitrion(session, npc).solo || st.turnosFase === 0 || st.turnos % ANFITRION.CAMBIO_JUGADOR_TURNOS !== 0) return
    const candidatos = vivos(jugadores(session, npc)).filter(j => String(j.ID) !== String(st.copiadoId))
    if (!candidatos.length) return
    const nuevo = azar(candidatos)
    copiar(npc, nuevo, { bloques: st.bloques })
    narrar(session, npc, V.NARRACION.perspectiva(nuevo.Nombre))
}

function vozDelTurno(session, npc) {
    const st = estado(npc)
    const j = copiado(session, npc)
    if (!j) return
    if (!st.dijo[`vida${st.fase}`] && j.HP / (Number(j.stats?.hpMax) || 1) < ANFITRION.VIDA_BAJA_PCT) {
        st.dijo[`vida${st.fase}`] = true
        return hablar(session, npc, V.frase("vidaBaja", j, { dichos: sesionAnfitrion(session, npc).dichos }))
    }
    // La frase de "ya lo sabía" no se suelta porque sí: solo cuando bloquea el golpe que esperaba
}

/** Turno del Anfitrión (siempre usa el turno: no tiene IA normal). */
async function turno(session, npc) {
    const st = estado(npc)
    sesionAnfitrion(session, npc)
    st.turnos++
    st.turnosFase++

    if (st.fase === 1) {
        // El disfraz: no ataca. En el turno 3 un Sosias normal se clonaría; este solo observa
        narrar(session, npc, V.observa())
        return true
    }

    cambiarPerspectiva(session, npc)
    vozDelTurno(session, npc)
    if (st.fase === 3) recomponerSenuelos(session, npc)

    // Una acción por turno: cuándo vuelve a actuar lo decide el compás, como a cualquier combatiente
    if (!npc.defeated && session.state !== "FINALIZADO" && vivos(jugadores(session, npc)).length) {
        if (st.fase === 2) await contraatacar(session, npc)
        else if (st.fase === 3) { if (!(await usarRobado(session, npc))) await contraatacar(session, npc) }
        else if (!(await usarRobado(session, npc))) await accionEvitada(session, npc)
    }
    if (st.fase === 3 && !npc.defeated) intentarRobo(session, npc)
    return true
}

/** ¿Esa clave es un hechizo de curación? (para que los reflejos no se curen en bucle) */
function esCura(clave) {
    if (!clave?.startsWith("spell:")) return false
    const h = cacheHechizos.obtenerSync(clave.slice(6))
    return Boolean(h) && P.categoriaHechizo(h) === "hechizo_cura"
}

/**
 * Qué repite un reflejo. Tu última acción pesa mucho (ECO_PESO_ULTIMA), pero no es siempre la
 * elegida: si no, los seis hacen lo mismo en bucle. Nunca dos reflejos seguidos la misma, y nadie
 * se cura si está casi entero.
 */
function claveEco(session, senuelo, real, jugador) {
    const st = estado(real)
    const recientes = [...new Set((jugador?.clavesTurnos || []).slice(-ANFITRION.VENTANA).flat())]
    const ultima = (jugador?.clavesTurnos || []).at(-1)?.[0]
    const sano = senuelo.HP >= (Number(senuelo.stats?.hpMax) || 1) * 0.9
    const usable = (k) => k && !k.startsWith("item:") && puedeUsarClave(senuelo, k) && !(sano && esCura(k))
    const pool = [...new Set(["attack", ...recientes])].filter(usable)
    if (!pool.length) return "attack"
    if (usable(ultima) && ultima !== st.ultimoEco && Math.random() < ANFITRION.ECO_PESO_ULTIMA) return ultima
    const otras = pool.filter(k => k !== st.ultimoEco)
    return azar(otras.length ? otras : pool)
}

/** Turno de un señuelo: un eco de lo que sueles hacer, con un turno de retraso. Nunca habla. */
async function turnoSenuelo(session, s) {
    const real = session.getCombatiente(s.anfitrionRealId)
    if (!real || real.defeated) return true
    const st = estado(real)
    const jugador = session.getCombatiente(st.copiadoId) ?? azar(vivos(jugadores(session, s)))
    const clave = claveEco(session, s, real, jugador)
    st.ultimoEco = clave
    await ejecutarClave(session, s, clave, objetivo(session, s, { foco: null }))
    return true
}

module.exports = {
    turno, turnoSenuelo, pisoVida, alRecibirDanio, alActuarJugador, trasBloquear, bonusCombo,
    // expuestos para pruebas
    estado, ruptura, fase3, instalarCompas, objetivo, claveEspejo, accionEvitada, repertorioAjeno, fase4, final, elementoContra, bloquesDe, intentarRobo, usarRobado, contraatacar,
}
