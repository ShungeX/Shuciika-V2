// utils/customId.js
const SEPARATOR = "-" // usa el que ya tengas en tu splitCustomId actual

/**
 * @typedef {Object} CrearCustomIdParams
 * @property {string} action - Igual al customId del handler (ej. "inventario")
 * @property {string} userId - ID de Discord del autor, para soloAutor
 * @property {string|number} [characterId] - Se guarda vacío si se omite
 * @property {Array<string|number>} [extras] - Máximo 4, en el orden que los vas a leer del lado del handler
 */

/**
 * Construye un customId con el orden fijo: action-userId-characterId-extras...
 * @param {CrearCustomIdParams} params
 * @returns {string}
 */
function crearCustomId({ action, userId, characterId, extras = [] }) {
    if (!action) throw new Error("[crearCustomId] Falta 'action'")
    if (!userId) throw new Error("[crearCustomId] Falta 'userId'")
    if (extras.length > 4) throw new Error(`[crearCustomId] Máximo 4 extras, llegaron ${extras.length}`)

    const customId = [action, userId, characterId ?? "", ...extras].join(SEPARATOR)
    if (customId.length > 100) throw new Error(`[crearCustomId] Excede 100 chars: ${customId}`)
    return customId
}

/**
 * Separa un customId en sus partes crudas. No convierte tipos (todo string).
 * @param {string} customId
 * @returns {string[]} [action, userId, characterId, ...extras]
 */
function splitCustomId(customId) {
    if (!customId) return [];

    const parts = [];
    let current = "";
    let insideBrackets = false;

    for (let i = 0; i < customId.length; i++) {
        const char = customId[i];

        if (char === '[' && !insideBrackets) {
            insideBrackets = true;
            continue;
        } else if (char === ']' && insideBrackets) {
            insideBrackets = false;
            continue;
        }

        if (char === '-' && !insideBrackets) {
            parts.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    parts.push(current);

    return parts;
}

module.exports = { crearCustomId, splitCustomId, SEPARATOR }