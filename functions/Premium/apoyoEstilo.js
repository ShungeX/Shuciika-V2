// functions/Premium/apoyoEstilo.js
// Estilo cosmético de la etiqueta de apoyo: paletas, degradado ANSI y validación de la configuración.
//
// SIN dependencias (ni discord.js ni Mongo): el mismo archivo funciona en Node (require) y en el
// navegador (<script src> → window.ApoyoEstilo, o copiado tal cual en el dashboard para la vista previa).
// Solo es estética: no toca energía, lumens, combate ni nada del juego.
;(function (raiz, fabrica) {
    const api = fabrica()
    if (typeof module === "object" && module.exports) module.exports = api
    else raiz.ApoyoEstilo = api
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict"

    const ESC = "\u001b"

    // Paletas cerradas: el usuario elige un id, nunca un color libre. Los ids son estables (se guardan en la base).
    const PALETAS = [
        { id: "brisa", nombre: "Brisa", desde: [164, 236, 187], hasta: [209, 97, 162] },
        { id: "amanecer", nombre: "Amanecer", desde: [255, 214, 153], hasta: [240, 128, 160] },
        { id: "crepusculo", nombre: "Crepúsculo", desde: [170, 150, 255], hasta: [255, 150, 200] },
        { id: "cielo", nombre: "Cielo", desde: [140, 200, 255], hasta: [190, 150, 255] },
        { id: "miel", nombre: "Miel", desde: [255, 230, 150], hasta: [240, 170, 90] }
    ]
    const PALETA_DEFECTO = "brisa"

    const MODOS = ["ninguno", "etiqueta", "nombre", "ambos"]
    // superior: el degradado va en el nombre y/o la etiqueta (según el modo)
    // inferior: el degradado va solo en las últimas líneas de la tarjeta (Personaje de / Sistema de personaje)
    const POSICIONES = ["superior", "inferior"]

    const APOYO_ESTILO_DEFECTO = Object.freeze({
        modo: "etiqueta",
        paleta: PALETA_DEFECTO,
        posicion: "superior",
        mostrarEtiqueta: true
    })

    const MAX_CARACTERES = 32

    function paletaPorId(id) {
        return PALETAS.find(p => p.id === id) || PALETAS.find(p => p.id === PALETA_DEFECTO)
    }

    /**
     * Limpia texto del usuario para meterlo en un bloque ANSI: quita menciones de usuario/rol/canal y emojis
     * personalizados (dentro de un bloque se verían como texto crudo). Los emojis Unicode se conservan.
     */
    function sanitizarTexto(texto) {
        return String(texto ?? "")
            .replace(/<(?:@[!&]?|#)\d+>/g, "")         // <@id> <@!id> <@&id> <#id>
            .replace(/<a?:[A-Za-z0-9_~]+:\d+>/g, "")    // <:nombre:id> <a:nombre:id>
            .replace(/\s+/g, " ")
            .trim()
    }

    /**
     * Degradado ANSI de 24 bits letra por letra (función base ya probada en Discord de escritorio; mismo comportamiento).
     * Cuenta por code points, así que nunca parte un emoji. Los espacios no se colorean.
     */
    function degradado(texto, desde, hasta, max = MAX_CARACTERES) {
        const chars = [...String(texto)
            .replace(/[\u0000-\u001f\u007f]/g, " ")    // quita ESC y saltos de línea
            .replace(/`/g, "'")                         // los backticks cerrarían el bloque
            .trim()].slice(0, max)
        const visibles = chars.filter(c => c.trim()).length
        let k = 0
        const out = chars.map(c => {
            if (!c.trim()) return c
            const t = visibles > 1 ? k++ / (visibles - 1) : 0
            const [r, g, b] = desde.map((v, i) => Math.round(v + (hasta[i] - v) * t))
            return `${ESC}[38;2;${r};${g};${b}m${c}`
        })
        return out.join("") + `${ESC}[0m`
    }

    const bloque = (ansi) => "```ansi\n" + ansi + "\n```"

    /**
     * Degradado de un texto de usuario con una paleta. Devuelve null si tras limpiar no queda nada
     * (quien llama usa entonces el texto normal). Nunca lanza.
     */
    function degradadoSeguro(texto, paletaId, max = MAX_CARACTERES) {
        try {
            const limpio = sanitizarTexto(texto)
            if (!limpio || ![...limpio].some(c => c.trim())) return null
            const p = paletaPorId(paletaId)
            return degradado(limpio, p.desde, p.hasta, max)
        } catch {
            return null
        }
    }

    /**
     * Sanea apoyoEstilo antes de guardarlo (el dashboard lo usa; nunca confiar en el cliente).
     * Lo inválido se corrige al valor por defecto. Devuelve siempre un objeto completo y nuevo.
     */
    function validarApoyoEstilo(obj) {
        const o = obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {}
        return {
            modo: MODOS.includes(o.modo) ? o.modo : APOYO_ESTILO_DEFECTO.modo,
            paleta: PALETAS.some(p => p.id === o.paleta) ? o.paleta : APOYO_ESTILO_DEFECTO.paleta,
            posicion: POSICIONES.includes(o.posicion) ? o.posicion : APOYO_ESTILO_DEFECTO.posicion,
            mostrarEtiqueta: typeof o.mostrarEtiqueta === "boolean" ? o.mostrarEtiqueta : APOYO_ESTILO_DEFECTO.mostrarEtiqueta
        }
    }

    /** apoyoEstilo del registro del usuario con los valores por defecto aplicados al leer (sin migraciones). */
    function leerApoyoEstilo(usuario) {
        return validarApoyoEstilo(usuario?.apoyoEstilo)
    }

    return {
        ESC,
        PALETAS,
        PALETA_DEFECTO,
        MODOS,
        POSICIONES,
        APOYO_ESTILO_DEFECTO,
        MAX_CARACTERES,
        paletaPorId,
        sanitizarTexto,
        degradado,
        degradadoSeguro,
        bloque,
        validarApoyoEstilo,
        leerApoyoEstilo
    }
})
