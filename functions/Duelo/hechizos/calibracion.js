// ─── Script de calibración (VIII.E) ──────────────────────────────────────────
// Herramienta de BALANCE, no lógica de combate: nunca se llama durante un casteo.
// Índice de eficiencia:  I = p·(D + C + E) / (M + 2·max(0, CD−1) + 0.5·V)

const { CALIBRACION, MANA, ESCALONES } = require("./config")
const { normalizarHechizo } = require("./adaptador")

const { CFG, COBERTURA, BANDAS, PESOS } = CALIBRACION

function factorObjetivos(alcance, objetivo, c = CFG) {
    if (alcance === "todos") return PESOS.TODOS_POR_OBJETIVO * (objetivo === "aliados" ? c.aliados : c.enemigos)
    if (alcance === "cadena") return PESOS.CADENA
    return 1
}

function valorEfecto(e, c = CFG) {
    const f = factorObjetivos(e.alcance, e.objetivo, c)
    const dur = Number(e.duracion) || 0
    switch (e.tipo) {
        case "control": return c.T * dur * (e.probabilidad ?? 1) * (COBERTURA[e.nombre] ?? PESOS.CONTROL_DEFECTO) * f
        case "degradacion": return c.T * dur * (e.probabilidad ?? 1) * (COBERTURA[e.nombre] ?? PESOS.DEGRADACION_DEFECTO) * f
        case "buff":
        case "debuff": return c.T * (e.peso ?? PESOS.BUFF) * dur * f
        case "dot": return (Number(e.base) || 0) * dur * PESOS.DOT * f
        case "hot": return ((Number(e.base) || 0) + (Number(e.multi) || 0) * c.INT) * dur * PESOS.HOT * f
        case "escudo": {
            const escudo = ((Number(e.base) || 0) + (Number(e.multi) || 0) * c.INT) * f
            return escudo + (e.defensa ? c.T * PESOS.BUFF * dur * f : 0)
        }
        case "cleanse": return PESOS.CLEANSE * c.T
        case "revive": return PESOS.REVIVE
        case "estasis": return c.T * (COBERTURA.Estasis ?? 1) * f
        default: return 0
    }
}

function indiceEficiencia(hechizo, c = CFG) {
    const h = normalizarHechizo(hechizo)
    const m = h.Mecanicas, k = h.Costos
    const monto = (x) => x ? ((Number(x.base) || 0) + (Number(x.scaling?.multi) || 0) * c.INT) * factorObjetivos(x.alcance, x.objetivo, c) : 0
    const dmg = monto(m.damage)
    const heal = monto(m.healing)
    const efec = (m.Efectos ?? []).reduce((s, e) => s + valorEfecto(e, c), 0)
    const costo = (k.mana || 0) + 2 * Math.max(0, (k.Cooldown || 0) - 1) + 0.5 * (k.Vida || 0)
    if (costo <= 0) return null
    return (m.cast.probabilidad * (dmg + heal + efec)) / costo
}

/** Marca todo hechizo fuera de banda. */
function auditar(hechizos, c = CFG) {
    return hechizos
        .map(normalizarHechizo)
        .filter(h => h && h.Escalon && (h.Costos.mana || 0) > 0)
        .map(h => {
            const I = indiceEficiencia(h, c)
            const [a, b] = BANDAS[h.Escalon] ?? [0, Infinity]
            return { id: h._id, nombre: h.Nombre, escalon: h.Escalon, I: I === null ? null : +I.toFixed(2), banda: [a, b], fuera: I === null || I < a || I > b }
        })
}

/**
 * Regla de maná (VII): al desbloquearse un escalón, su costo debe ser 5–25% del maná máximo
 * objetivo de ese Resplandor.
 */
function auditarMana(hechizos) {
    const [min, max] = MANA.COSTO_PCT
    return hechizos
        .map(normalizarHechizo)
        .filter(h => h && h.Escalon && (h.Costos.mana || 0) > 0)
        .map(h => {
            const resplandor = ESCALONES[h.Escalon]?.resplandor ?? 1
            const objetivos = Object.entries(MANA.OBJETIVO_POR_RESPLANDOR).map(([r, v]) => [Number(r), v]).sort((x, y) => x[0] - y[0])
            const manaMax = (objetivos.filter(([r]) => r <= resplandor).pop() ?? objetivos[0])[1]
            const pct = h.Costos.mana / manaMax
            return { id: h._id, escalon: h.Escalon, mana: h.Costos.mana, manaMax, pct: +pct.toFixed(3), fuera: pct < min || pct > max }
        })
}

module.exports = { factorObjetivos, valorEfecto, indiceEficiencia, auditar, auditarMana }
