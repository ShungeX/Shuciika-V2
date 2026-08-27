const clientdb = require('../Server');
const db2 = clientdb.db('Rol_db');
const db  = clientdb.db('Server_db');

const userdbs    = db.collection('usuarios_server');
const Character  = db2.collection('Personajes');
const souls      = db2.collection('Soul');
const Cachedb    = db2.collection('CachePJ');

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

/**
 * Construye el filtro de MongoDB para buscar un personaje/soul por su _id.
 * Soporta _id numérico o string, manejando ambas posibilidades con $or
 * cuando el valor puede ser interpretado como número.
 *
 * @param {string|number} characterID - El _id del personaje
 * @returns {{ _id: string|number } | { $or: object[] } | null}
 */
function buildPjFilter(characterID) {
    if (characterID === undefined || characterID === null) return null;
    const asNumber = Number(characterID);
    if (isNaN(asNumber)) return { _id: String(characterID) };
    return { $or: [{ _id: asNumber }, { _id: String(characterID) }] };
}

// ─────────────────────────────────────────────
// Funciones exportadas
// ─────────────────────────────────────────────

/**
 * Resuelve el filtro de personaje activo a partir de un usuario de Discord.
 * Consulta `usuarios_server` para leer `nix.personajeActivo` y devuelve
 * tanto el filtro listo para usar como el documento de usuario.
 *
 * @param {string} discordId - ID de Discord del usuario
 * @returns {Promise<{ userdb: object|null, pjFilter: object|null }>}
 */
async function resolveActivePjFilter(discordId) {
    const userdb = await userdbs.findOne({ _id: String(discordId) });
    const activePjId = userdb?.usuario?.nix?.personajeActivo ?? userdb?.nix?.personajeActivo;
    const pjFilter = buildPjFilter(activePjId);
    return { userdb, pjFilter };
}

/**
 * Busca el personaje activo (y/o su soul y caché) de un usuario dado su ID de Discord.
 *
 * Si ya conoces el characterID (p. ej. lo tienes de una consulta previa), pásalo
 * directamente: se omite la consulta a `usuarios_server` y solo se busca en
 * `Personajes`/`Soul`/`CachePJ`.
 *
 * @param {string}  discordId              - ID de Discord del usuario
 * @param {object}  [options={}]           - Qué datos obtener
 * @param {boolean} [options.character]    - Buscar en colección Personajes
 * @param {boolean} [options.soul]         - Buscar en colección Soul
 * @param {boolean} [options.cachepj]      - Buscar en colección CachePJ
 * @param {string|number} [options.characterID] - (Opcional) _id ya conocido; omite consulta a userdb
 * @returns {Promise<{ userdb: object|null, character: object|null, soul: object|null, cachepj: object|null }>}
 */
async function getActiveCharacter(discordId, options = {}) {
    const { character: needCharacter, soul: needSoul, cachepj: needCache, characterID } = options;

    let userdb    = null;
    let pjFilter  = null;

    if (characterID !== undefined && characterID !== null) {
        // Corto circuito: ya tenemos el ID → no se consulta usuarios_server
        pjFilter = buildPjFilter(characterID);
    } else {
        // Flujo completo: Discord ID → usuarios_server → personajeActivo
        ({ userdb, pjFilter } = await resolveActivePjFilter(discordId));
    }

    const promises = [];
    if (needCharacter) promises.push(pjFilter ? Character.findOne(pjFilter) : Promise.resolve(null));
    if (needSoul)      promises.push(pjFilter ? souls.findOne(pjFilter)     : Promise.resolve(null));
    if (needCache)     promises.push(Cachedb.findOne({ _id: String(discordId) }));

    const results = await Promise.all(promises);

    let idx = 0;
    return {
        userdb,
        character: needCharacter ? results[idx++] ?? null : null,
        soul:      needSoul      ? results[idx++] ?? null : null,
        cachepj:   needCache     ? results[idx++] ?? null : null,
    };
}

/**
 * Wrapper principal. Busca personaje, soul y/o caché según el objeto `requirements`
 * que define cada subcomando de Rol. Internamente llama a `getActiveCharacter`.
 *
 * Equivalente al bloque de consultas que vivía en `01-navi-central.js`, ahora
 * centralizado para ser reutilizable en cualquier categoría de comando.
 *
 * @param {string}  discordId          - ID de Discord del usuario (`interaction.user.id`)
 * @param {object}  requirements       - Objeto `subcommand.requirements` del subcomando
 * @param {object}  [requirements.character]  - { obtener, required }
 * @param {object}  [requirements.soul]       - { obtener, required }
 * @param {object}  [requirements.cachepj]    - { obtener, required }
 * @param {string|number} [characterID]       - (Opcional) _id ya conocido; omite consulta a userdb
 * @returns {Promise<{ userdb: object|null, character: object|null, soul: object|null, cachepj: object|null }>}
 */
async function getCharacterData(discordId, requirements = {}, characterID = undefined) {
    return getActiveCharacter(discordId, {
        character:   !!(requirements.character?.obtener),
        soul:        !!(requirements.soul?.obtener),
        cachepj:     !!(requirements.cachepj?.obtener),
        characterID,
    });
}

module.exports = {
    buildPjFilter,
    resolveActivePjFilter,
    getActiveCharacter,
    getCharacterData,
    // Colecciones expuestas por si algún módulo externo las necesita sin reimportar
    Character,
    souls,
    Cachedb,
    userdbs,
};
