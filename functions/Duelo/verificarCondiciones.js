/**
 * Verifica si un jugador y su personaje pueden participar en combate
 * @param {object} characterData — documento Soul de MongoDB
 * @param {object} soul — documento Soul de MongoDB
 * @returns {{ puede: Boolean, razon: String|null }}
 */

const { duelSystem } = require("./duelManager")

function verificarCondiciones(characterData, soul) {
    if (duelSystem.estaEnCombate(characterData._id)) {
        return { puede: false, razon: "Ya estás en un combate activo ＞﹏＜" }
    }
    if (!soul) {
        return { puede: false, razon: "Tu personaje aún no puede combatir ＞﹏＜" }
    }
    if (soul.nucleo.HP <= 0) {
        console.log(soul.nucleo.HP, soul._id)
        return { puede: false, razon: "Tu personaje está fuera de combate. Necesita recuperar vida ＞﹏＜\n-# Usa un objeto con `/rol usar_objeto`" }
    }

    return { puede: true, razon: null }
}

module.exports = verificarCondiciones