// functions/Duelo/efectosObjeto.js
// Efectos de objeto en el formato del dashboard (Server.js → normalizarEfectosObjeto):
//   suma / resta  { stat: "nucleo.HP" | "nucleo.mana" | fuerza | resFisica | resMagica | agilidad | sabiduria
//                          | inteligencia | regeneracion | "turnos", valor, duracion, efectos? }
//   limpia        { efectos: [clave] }
//   aplica        { efecto: clave, valor?, duracion }
//   inmuniza      { efectos: [clave], duracion }
// Todos admiten { Nombre, condicion } (condicion: JSON tipo { hpPercent: { $lt: 50 } }).
// Se aplican sobre un Combatiente (en combate o uno temporal creado del alma fuera de combate).

const TIPOS_NUEVOS = new Set(["suma", "resta", "limpia", "aplica", "inmuniza"])

const normalizar = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

const NOMBRE_EFECTO = {
    veneno: "Veneno", quemadura: "Quemadura", congelamiento: "Congelamiento", mojado: "Mojado",
    aturdimiento: "Aturdimiento", confusion: "Confusión", miedo: "Miedo", ceguera: "Ceguera",
    lentitud: "Lentitud", vulnerabilidad: "Vulnerabilidad", stasis: "Stasis", furia: "Furia",
    speed: "Velocidad", clonacion: "Clonación", curacion: "Curación",
}

// Otras formas con las que el combate y los hechizos nombran el mismo estado
const ALIAS_EFECTO = {
    aturdimiento: ["aturd", "stun"],
    congelamiento: ["congel", "freeze"],
    stasis: ["stasis", "estasis"],
    lentitud: ["lentitud", "slowed"],
    speed: ["speed", "velocidad", "hasted", "acelerado"],
    curacion: ["curacion", "heal", "healing"],
    confusion: ["confusion"],
}

const NOMBRE_STAT = {
    "nucleo.HP": "HP", "nucleo.mana": "Maná", fuerza: "Fuerza", resFisica: "Res. física", resMagica: "Res. mágica",
    agilidad: "Agilidad", sabiduria: "Sabiduría", inteligencia: "Inteligencia", regeneracion: "Regeneración",
}

const nombreEfecto = (clave) => NOMBRE_EFECTO[clave] || clave
const turnosTxt = (n) => `${n} turno(s)`
const listaTxt = (claves) => claves.map(nombreEfecto).join(", ")

const esFormatoNuevo = (efecto) => TIPOS_NUEVOS.has(normalizar(efecto?.tipo))

/** Clave normalizada de un estado activo del combatiente. */
function claveDeEstado(estado) {
    return normalizar(estado?.id || estado?.Nombre || estado?.nombre)
}

/** ¿El estado activo corresponde a la clave de efecto (veneno, stasis...)? */
function coincideEstado(estado, clave) {
    if (estado?.inmuneA || estado?.modStat) return false   // inmunidades y buffs no son "estados" que se limpien
    const id = claveDeEstado(estado)
    const nombre = normalizar(estado?.Nombre || estado?.nombre)
    const formas = ALIAS_EFECTO[clave] || [clave]
    return formas.some(f => id === f || id.includes(f) || nombre.includes(f))
}

/** ¿El combatiente es inmune a esa clave de efecto? (las claves de hechizos a veces llevan prefijos) */
function esInmune(combatiente, clave) {
    const k = normalizar(clave)
    if (!k) return false
    return (combatiente?.statusEffect || []).some(e =>
        Array.isArray(e.inmuneA) && e.inmuneA.some(i => {
            const formas = ALIAS_EFECTO[i] || [i]
            return formas.some(f => k === f || k.includes(f))
        })
    )
}

/** Deshace el cambio de stat de un buff temporal (al expirar o al quitarlo). */
function revertirModStat(combatiente, estado) {
    if (!estado?.modStat || !combatiente?.stats) return
    const { stat, delta } = estado.modStat
    combatiente.stats[stat] = (Number(combatiente.stats[stat]) || 0) - delta
    if (stat === "agilidad") combatiente.tempo = combatiente.stats.agilidad || 10
}

/** Quita un estado del combatiente deshaciendo su efecto si era un buff de stat. */
function quitarEstado(combatiente, indice) {
    const [estado] = combatiente.statusEffect.splice(indice, 1)
    revertirModStat(combatiente, estado)
    return estado
}

// ─── Condiciones ─────────────────────────────────────────────────────────────

function valorCampo(target, campo) {
    const hpMax = target.stats?.hpMax || target.HP || 1
    const manaMax = target.stats?.manaMax || target.Mana || 1
    switch (campo) {
        case "hpPercent": return (target.HP / hpMax) * 100
        case "manaPercent": return (target.Mana / manaMax) * 100
        case "HP": case "hp": return target.HP
        case "Mana": case "mana": return target.Mana
        case "estados": return (target.statusEffect || []).length
        default: return target.stats?.[campo]
    }
}

function cumpleOperadores(valor, regla) {
    if (regla === null || typeof regla !== "object") return valor == regla
    return Object.entries(regla).every(([op, esperado]) => {
        switch (op) {
            case "$lt": return valor < esperado
            case "$lte": return valor <= esperado
            case "$gt": return valor > esperado
            case "$gte": return valor >= esperado
            case "$eq": return valor == esperado
            case "$ne": return valor != esperado
            default: return true
        }
    })
}

/** Evalúa la condición de un efecto. Sin condición, siempre se cumple. */
function cumpleCondicion(condicion, caster, target) {
    if (condicion === null || condicion === undefined || condicion === "") return true
    try {
        if (typeof condicion === "string") {
            // Formato antiguo: expresión JS
            return Boolean(new Function("caster", "target", `return ${condicion}`)(caster, target))
        }
        if (typeof condicion === "object") {
            return Object.entries(condicion).every(([campo, regla]) => cumpleOperadores(valorCampo(target, campo), regla))
        }
    } catch (e) {
        console.error("[efectosObjeto] Error al evaluar condición:", e)
        return false
    }
    return true
}

// ─── Aplicación ─────────────────────────────────────────────────────────────

/**
 * Aplica un efecto (formato nuevo) sobre un objetivo.
 * Devuelve las entradas para buildActionMessage; [] si no pasó nada.
 * @param {Object} p
 * @param {Object|null} p.session - Sesión de combate, o null fuera de combate
 * @param {Object} p.caster
 * @param {Object} p.target - Combatiente
 * @param {Object} p.efecto
 * @param {Object} p.objeto - Definición del objeto (para nombres por defecto)
 */
function aplicarEfectoObjeto({ session, caster, target, efecto, objeto }) {
    const tipo = normalizar(efecto.tipo)
    const enCombate = Boolean(session)
    const base = { objetivos: [target.Nombre], targetId: target.ID }
    const frase = (clausula) => [{ ...base, tipo: "custom", clausula }]
    target.statusEffect ??= []

    if (tipo === "suma" || tipo === "resta") {
        const signo = tipo === "suma" ? 1 : -1
        const valor = Math.abs(Number(efecto.valor) || 0)
        const stat = efecto.stat
        if (!valor || !stat) return []

        if (stat === "nucleo.HP") {
            const antes = target.HP
            if (signo > 0) target.aplicarCuracion ? target.aplicarCuracion(valor, true) : (target.HP = Math.min(target.stats?.hpMax ?? 99999, target.HP + valor))
            else target.aplicarDaño ? target.aplicarDaño(valor) : (target.HP = Math.max(0, target.HP - valor))
            const delta = target.HP - antes
            if (!delta) return []
            return [{ ...base, tipo: delta > 0 ? "curacion" : "danio", valor: Math.abs(delta), stat: "HP" }]
        }

        if (stat === "nucleo.mana") {
            const antes = target.Mana
            const max = target.stats?.manaMax ?? 99999
            target.Mana = Math.max(0, Math.min(max, target.Mana + signo * valor))
            const delta = target.Mana - antes
            if (!delta) return []
            return delta > 0
                ? [{ ...base, tipo: "mana", valor: delta, stat: "Mana" }]
                : frase(`perdido ${Math.abs(delta)} de maná`)
        }

        // Lo que sigue dura rondas: solo tiene sentido dentro de un combate
        if (!enCombate) return []

        if (stat === "turnos") {
            const claves = (efecto.efectos || []).map(normalizar)
            const afectados = []
            for (let i = target.statusEffect.length - 1; i >= 0; i--) {
                const e = target.statusEffect[i]
                if (e.inmuneA || e.modStat) {
                    if (claves.length) continue   // con selección explícita solo se tocan estados
                } else if (claves.length && !claves.some(c => coincideEstado(e, c))) continue
                e.duracion = (Number(e.duracion) || 0) + signo * valor
                afectados.push(e.Nombre || e.nombre || e.id)
                if (e.duracion <= 0) quitarEstado(target, i)
            }
            if (!afectados.length) return []
            const verbo = signo > 0 ? `alargado ${turnosTxt(valor)}` : `acortado ${turnosTxt(valor)}`
            return frase(`${verbo} la duración de ${afectados.join(", ")}`)
        }

        const duracion = Number(efecto.duracion) || 0
        if (duracion <= 0) return []

        if (stat === "regeneracion") {
            // Curación (o daño) al final de cada acción del objetivo durante X turnos
            const id = signo > 0 ? "regeneracion" : "degeneracion"
            const nombre = efecto.Nombre || (signo > 0 ? "Regeneración" : "Degeneración")
            const existente = target.statusEffect.find(e => e.id === id)
            if (existente) {
                existente.base = Math.max(Number(existente.base) || 0, valor)
                existente.duracion = Math.max(Number(existente.duracion) || 0, duracion)
            } else {
                target.statusEffect.push({ id, Nombre: nombre, nombre, base: valor, duracion, fuente: caster.ID })
            }
            return [{ ...base, tipo: "estado", Nombre: `${nombre} (${signo > 0 ? "+" : "−"}${valor} HP)`, duracion }]
        }

        if (!target.stats) return []
        const delta = signo * valor
        target.stats[stat] = (Number(target.stats[stat]) || 0) + delta
        if (stat === "agilidad") target.tempo = target.stats.agilidad || 10
        const etiqueta = `${signo > 0 ? "+" : "−"}${valor} ${NOMBRE_STAT[stat] || stat}`
        target.statusEffect.push({
            id: `mod_${stat}_${objeto?.ID ?? "x"}`,
            Nombre: efecto.Nombre || etiqueta,
            nombre: efecto.Nombre || etiqueta,
            modStat: { stat, delta },
            duracion,
            fuente: caster.ID,
        })
        return frase(`${signo > 0 ? "ganado" : "perdido"} ${valor} de ${NOMBRE_STAT[stat] || stat} durante ${turnosTxt(duracion)}`)
    }

    if (tipo === "limpia") {
        const claves = (efecto.efectos || []).map(normalizar).filter(Boolean)
        const quitados = []
        for (let i = target.statusEffect.length - 1; i >= 0; i--) {
            if (claves.some(c => coincideEstado(target.statusEffect[i], c))) {
                const e = quitarEstado(target, i)
                quitados.push(e.Nombre || e.nombre || e.id)
            }
        }
        // Lo que iba a caerle al cerrar la ronda también se limpia
        if (session?.pendingEffects) {
            session.pendingEffects = session.pendingEffects.filter(p => {
                if (p.objetivo !== target.ID) return true
                if (String(p.id).endsWith("_damage") || String(p.id).endsWith("_healing")) return true
                const limpiar = claves.some(c => coincideEstado(p, c))
                if (limpiar) quitados.push(p.Nombre || p.nombre || p.id)
                return !limpiar
            })
        }
        if (!quitados.length) return []
        return frase(`quedado libre de ${[...new Set(quitados)].join(", ")}`)
    }

    // aplica / inmuniza solo existen dentro de un combate
    if (!enCombate) return []

    if (tipo === "aplica") {
        const clave = normalizar(efecto.efecto)
        const duracion = Number(efecto.duracion) || 0
        if (!clave || duracion <= 0) return []
        const nombre = efecto.Nombre || nombreEfecto(clave)
        if (esInmune(target, clave)) return frase(`resistido ${nombre} gracias a la inmunidad`)

        const valor = efecto.valor !== null && efecto.valor !== undefined ? Number(efecto.valor) || 0 : 0
        const existente = target.statusEffect.find(e => coincideEstado(e, clave))
        if (existente) {
            existente.duracion = Math.max(Number(existente.duracion) || 0, duracion)
            if (typeof existente.base !== "object") existente.base = Math.max(Number(existente.base) || 0, valor)
        } else {
            target.statusEffect.push({ id: clave, Nombre: nombre, nombre, base: valor, duracion, fuente: caster.ID })
        }
        return [{ ...base, tipo: "estado", Nombre: nombre, duracion }]
    }

    if (tipo === "inmuniza") {
        const claves = (efecto.efectos || []).map(normalizar).filter(Boolean)
        const duracion = Number(efecto.duracion) || 0
        if (!claves.length || duracion <= 0) return []
        target.statusEffect.push({
            id: `inmunidad_${objeto?.ID ?? "x"}`,
            Nombre: efecto.Nombre || `Inmunidad (${listaTxt(claves)})`,
            nombre: efecto.Nombre || "Inmunidad",
            inmuneA: claves,
            duracion,
            fuente: caster.ID,
        })
        return frase(`quedado inmune a ${listaTxt(claves)} durante ${turnosTxt(duracion)}`)
    }

    return []
}

module.exports = {
    esFormatoNuevo,
    aplicarEfectoObjeto,
    cumpleCondicion,
    esInmune,
    revertirModStat,
    coincideEstado,
}
