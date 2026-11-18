// ─── Maná: accesores únicos (Contenedores_y_Durabilidad.md, XI.B) ────────────
// Todo el combate lee y escribe el maná por aquí. En un afinado vive en el jugador; en un
// desafinado, en la carga de su contenedor equipado (Personaje expone esa carga como `Mana`,
// así que estas funciones sirven igual para jugadores, NPCs y dobles de prueba).

const { MANA } = require("../../Contenedores/config")
const { esDesafinado } = require("../../Contenedores/nucleo")

/** Tope de maná: la curva del personaje o, en desafinados, curva × factor del contenedor. */
function manaMaximo(pj) {
    const max = Number(pj?.stats?.manaMax)
    return Number.isFinite(max) ? Math.max(0, max) : Math.max(0, Number(pj?.Mana) || 0)
}

function manaActual(pj) {
    return Math.max(0, Number(pj?.Mana) || 0)
}

/** Gasta maná si alcanza. */
function gastarMana(pj, n) {
    const costo = Math.max(0, Number(n) || 0)
    if (manaActual(pj) < costo) return false
    pj.Mana = manaActual(pj) - costo
    return true
}

/** Fuentes externas (ítems, Concentrar...). Devuelve lo que realmente entró. */
function ganarMana(pj, n) {
    const antes = manaActual(pj)
    pj.Mana = Math.min(manaMaximo(pj), antes + Math.max(0, Number(n) || 0))
    return manaActual(pj) - antes
}

/** Drenajes (objetos que restan maná). Devuelve lo que realmente se perdió. */
function perderMana(pj, n) {
    const antes = manaActual(pj)
    pj.Mana = Math.max(0, antes - Math.max(0, Number(n) || 0))
    return antes - manaActual(pj)
}

/** Suma de los bonus temporales de regeneración ({ tipo: 'regen_mana', valor }). Sin techo. */
function bonusRegeneracion(pj) {
    return (pj?.statusEffect || [])
        .filter(e => e && e.tipo === "regen_mana" && (Number(e.duracion) || 0) > 0)
        .reduce((suma, e) => suma + (Number(e.valor ?? e.base) || 0), 0)
}

/** Regeneración por turno completo: +2 y bonus para afinados; un desafinado no regenera. */
function regenerarManaTurno(pj) {
    if (!pj || pj.defeated || esDesafinado(pj)) return 0
    return ganarMana(pj, MANA.REGEN_BASE + bonusRegeneracion(pj))
}

module.exports = { manaMaximo, manaActual, gastarMana, ganarMana, perderMana, bonusRegeneracion, regenerarManaTurno }
