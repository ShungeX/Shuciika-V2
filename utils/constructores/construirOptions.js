// utils/constructores/construirOptions.js

/** @typedef {import('../types').TipoComponente} TipoComponente */
/** @typedef {import('../types').ComponentConfig} ComponentConfig */

/**
 * @param {import('discord.js').Interaction} interaction
 * @param {TipoComponente} tipo
 * @param {ComponentConfig} handler
 * @returns {Object<string, string>}
 */
function construirOptions(interaction, tipo, handler) {
  if (tipo === "selectMenu") {

        const nombre = handler.optionNames?.[0] || "values"
        const valores = interaction.values || []
        return { [nombre]: handler.multiSelect ? valores : valores[0] }
    }

    if (tipo === "modal") {
        const mapeo = handler.fieldNames || {}              // { "campoIDEnElModal": "sesionID" }
        const resultado = {}
        if (!mapeo || Object.keys(mapeo).length === 0) {
            console.warn("construirOptions - No se proporcionó un mapeo de campos. Se devolverá el valor por defecto.")
            return { "defaultField": "sin_mapeo"}
        }

        for (const [campoId, alias] of Object.entries(mapeo)) {
            resultado[campoId] = interaction.fields.getTextInputValue(alias)
        }
        return resultado
    }

    return {} // botones
}

module.exports = { construirOptions }