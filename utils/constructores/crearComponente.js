// utils/constructores/crearComponente.js

/** @typedef {import('../types').ComponentConfig} ComponentConfig */

/**
 * @param {string} tipo - Solo para el texto de los errores ("Boton"|"SelectMenu"|"Modal")
 * @param {ComponentConfig} config
 * @returns {ComponentConfig}
 */
function crearComponenteBase(tipo, config) {
    if (!config.customId) throw new Error(`[crear${tipo}] Falta "customId".`)
    if (typeof config.ejecutar !== 'function') throw new Error(`[crear${tipo}] "${config.customId}" no tiene "ejecutar" válido.`)

    return {
        soloAutor: false,
        requirements: {},
        isDevOnly: false,
        enMantenimiento: false,
        ...config,
    }
}

/** @param {ComponentConfig} config @returns {ComponentConfig} */
const crearBoton = (config) => crearComponenteBase('Boton', config)

/** @param {ComponentConfig} config @returns {ComponentConfig} */
const crearStringSelectMenu = (config) => crearComponenteBase('StringSelectMenu', config)

/** @param {ComponentConfig} config @returns {ComponentConfig} */
const crearModal = (config) => crearComponenteBase('Modal', config)

module.exports = { crearBoton, crearStringSelectMenu, crearModal }