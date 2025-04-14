const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const soul = db2.collection("Soul")
const util = require(`util`);
const sleep = util.promisify(setTimeout)
const version = require("../../../config")
const magicSpell = db2.collection("global_spells")

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

module.exports = async(client, interaction) => {
    const Nombre = interaction.options.getString("nombre")
    const tipo = interaction.options.getInteger("tipo")
    const elementType = interactiln.options.getString("elemento")
    const rareza = interaction.options.getInteger("rareza")
    const minLevel = interaction.options.getInteger("nivel_minimo")
    const targets = [] || [1]
    const effects = null

    magicSpell.insertOne({
        _id: `${elementType}-${ID}`,
        ID: ID,
        Nombre: Nombre,
        descripcion: (descripcion || "Sin descripcion"),
        tipo: tipo,
        elemento: elementType,
        iconURL: iconURL || null,
        rareza: rareza,
        requerimentos: {
            minLevel: minLevel,
            stats: TypeStats || {},
            quest: false,

        },
        mecanicas: {
            damage: {
                base: damageBase || 10,
                scaling: statScaling || {},

            },
            target: {
                targets,
            },
            effects: {
                effects
            },
            castTime: timeCastCooldown,
            castProbabilidad: castProbabilidad
        },
        costos: {
            mana: manaCost,
            health: healtCost, 
            money: moneyCost,
            cooldown: cooldown,
        },
        isActive: activeSet,
        creado: ""
    })
}