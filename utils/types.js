// utils/types.js
// Typedefs JSDoc compartidos para todo el proyecto Navi.
// No exporta nada en runtime — solo existe para que VS Code los indexe.

/**
 * @typedef {Object} RequirementConfig
 * @property {boolean} [obtener] - Si true, se consulta ese documento en la DB
 * @property {boolean} [required] - Si true y no se encontró, la interacción se corta con un mensaje de error
 */

/**
 * Contexto que recibe `ejecutar` cuando el componente se construye con crearComponente().
 * @typedef {Object} EjecutarComponenteContext
 * @property {import('discord.js').Client} client
 * @property {import('discord.js').ButtonInteraction|import('discord.js').ModalSubmitInteraction|import('discord.js').StringSelectMenuInteraction} interaction
 * @property {Object|null} character
 * @property {Object|null} soul
 * @property {Object|null} cachepj
 * @property {{userId: string, characterId: string|number|null, extras: string[]}} componentData
 * @property {Object} options
 */

/**
 * Config genérica usada por crearComponente.js (selectMenu/modal/botón nuevo estilo).
 * @typedef {Object} ComponentConfig
 * @property {string}      customId
 * @property {boolean}     [soloAutor=false]
 * @property {Requirements} [requirements]
 * @property {boolean}     [isDevOnly=false]
 * @property {boolean}     [enMantenimiento=false]
 * @property {string[]}    [optionNames]
 * @property {Object<string,string>} [fieldNames]
 * @property {(ctx: EjecutarComponenteContext) => Promise<void>} ejecutar
 */

/**
 * @typedef {Object} Requirements
 * @property {RequirementConfig} [character]
 * @property {RequirementConfig} [soul]
 * @property {RequirementConfig} [cachepj]
 */

/**
 * Datos de personaje resueltos por getCharacterData y pasados a los handlers.
 * @typedef {Object} DatosPersonaje
 * @property {Object|null} character  - Documento de Personajes (Rol_db)
 * @property {Object|null} soul       - Documento de Soul (Rol_db)
 * @property {Object|null} cachepj    - Documento de CachePJ (Rol_db)
 */

/**
 * Metadata del componente extraída del customId, pasada a ejecutar por manejarComponente.
 * @typedef {Object} ComponentData
 * @property {string} userId                - ID de Discord de quien generó el componente
 * @property {string|number|null} characterId
 * @property {string[]} extras              - Los segmentos restantes del customId (longitud variable)
 */

// ─── Configuraciones de handlers ─────────────────────────────────────────────

/**
 * @typedef {Object} BotonConfig
 * @property {string}      customId                   - Primer segmento del customId (action)
 * @property {boolean}     [buttonAuthor=false]        - Solo el autor puede usar el botón
 * @property {Requirements} [requirements]
 * @property {boolean}     [isDevOnly=false]
 * @property {boolean}     [enMantenimiento=false]
 * @property {(client: import('discord.js').Client, interaction: import('discord.js').ButtonInteraction, characterId: string|number, extras1: string, extras2: string, extras3: string, extras4: string, datos: DatosPersonaje) => Promise<void>} ejecutar
 */

/**
 * @typedef {Object} ModalConfig
 * @property {string}      customId                   - Primer segmento del customId (action)
 * @property {Requirements} [requirements]
 * @property {boolean}     [isDevOnly=false]
 * @property {boolean}     [enMantenimiento=false]
 * @property {Object<string,string>} [fieldNames]     - Mapeo { idCampoEnModal: alias }
 * @property {(client: import('discord.js').Client, interaction: import('discord.js').ModalSubmitInteraction, options: string, options2: string, options3: string, datos: DatosPersonaje) => Promise<void>} ejecutar
 */

/**
 * @typedef {Object} SelectMenuConfig
 * @property {string}      customId                   - Primer segmento del customId
 * @property {boolean}     [selectAutor=false]
 * @property {Requirements} [requirements]
 * @property {boolean}     [isDevOnly=false]
 * @property {boolean}     [enMantenimiento=false]
 * @property {string[]}    [optionNames]              - Nombres para interaction.values en orden
 * @property {(ctx: { client: import('discord.js').Client, interaction: import('discord.js').StringSelectMenuInteraction, character: Object|null, componentData: string, options: Object<string,string> }) => Promise<void>} ejecutar
 */


/**
 * @typedef {"boton"|"selectMenu"|"modal"} TipoComponente
 */

module.exports = {}