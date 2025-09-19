const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, StringSelectMenuBuilder, } = require(`discord.js`)
const clientdb = require("../Server")
const db2 = clientdb.db("Rol_db")
const rel = db2.collection("Relaciones_pj")
const personajes = db2.collection("Personajes")
            /**
             * 
             * @param {Client} client
             * @param {ChatInputCommandInteraction} interaction
             * 
             * 
             */

/*  
"InteractionFriends": 1,
"InteractionCouple": 2,
"InteractionFriendly": 3,
"InteractionNeutral": 4
"InteractionNegative": 5
"InteractionNegativeX2": 6
//** */



module.exports = async(client, interaction, author, Id1, Id2, bonusType, extras ) => {
    console.log("ID1:", interaction.id, "\nID2:", Id2)
    const relationId = Id1 < Id2 ? `${Id1}-${Id2}`:`${Id2}-${Id1}`
    const result = {
        xp: null,
        levelUp: false,
        lv: 0,
        reward: null,
        reducido: null
    }
    

    var existingRelation = await rel.findOne({_id: relationId})

     if(!existingRelation) {
            const newRelation = {
                _id: relationId,
                ID1: Id1,
                ID2: Id2,
                amistad: {
                    nivel: 0,
                    XP: 0,
                    hearts: 0,
                    xptoLv: 0
                },
                enemistad: {
                    nivel: 0,
                    XP: 0,
                    roses: 0,
                    xptoLv: 0
                },
                couple: {
                    isCouple: false,
                },
                medallas: [],
                logros: [],
                recuerdos: [],
                regalos: [],
                lastinteraction: 0,
                timeoutinteraction: 10000
            }
    
            await rel.insertOne(newRelation)
            existingRelation = newRelation
    }

    const timeoutinteraction = 20000

    const xpCooldown =  Date.now() - existingRelation.lastinteraction < timeoutinteraction

    if(xpCooldown) {
            return result;
    }

    const xpValues = {
        1: { type: "amistad", base: 2, variabilidad: 0.5, esTraicion: false},
        2: { type: "amistad", base: 5, variabilidad: 1, esTraicion: false},
        3: { type: "amistad", base: 1.5, variabilidad: 0.8, esTraicion: false},
        4: { type: "enemistad", base: 2, variabilidad: 0.5, esTraicion: false},
        5: { type: "enemistad", base: 5, variabilidad: 1, esTraicion: false},
        6: { type: "enemistad", base: 10, variabilidad: 0.2, esTraicion: false},
    }

    const config = xpValues[bonusType] || {type: "amistad", base: 1};
   


    await subirNivel()
   

    async function addXP(){
        const {interact, base, variabilidad} = config
        const aleatorio = 1 + (Math.random() * variabilidad)
        const factorNivel = 1 + (existingRelation[`${config.type}`].nivel * 0.15)

        const xpNet = existingRelation.amistad.XP - existingRelation.enemistad.XP
        const xpGet = (base * aleatorio * factorNivel * 4)

       if(config.esTraicion) return Math.floor(xpGet)

        if(config.type === "enemistad" && existingRelation.amistad.nivel > 5 && xpNet >= 500) {
            const reduct =  Math.max(0.2, 1 - (xistingRelation.amistad.nivel * 0.04)); 
            result.reducido = true
            return Math.floor(xpGet * reduct) 
        }

        if(config.type === "amistad" && existingRelation.enemistad.nivel > 5  && xpNet <= -500) {
            const reduct =  Math.max(0.2, 1 - (xistingRelation.enemistad.nivel * 0.04)); 
            result.reducido = true
            return Math.floor(xpGet * reduct) 
        }

        return Math.floor(xpGet)
    }

    function calculateXPGain(config) {
       const xpParasubir =  Math.floor(50 * (Math.pow(2.2, existingRelation[`${config.type}`].nivel)))

       return xpParasubir
    }

    async function subirNivel() {

        const nivelMagico = existingRelation[`${config.type}`].nivel;
        const xpRequerido = calculateXPGain(config)

        
        const xp = await addXP()

        await rel.updateOne({_id: relationId}, {
            $inc: { [`${config.type}.XP`]: xp},
            $set: { lastinteraction: Date.now()}
        })

        const xpActual = (existingRelation[`${config.type}`].XP) + xp;

        console.log("Xp Requerido", xpRequerido, "\nXp", xpActual)
        
        if(xpActual >= xpRequerido) {
            await rel.updateOne({_id: relationId}, {
                $inc:{ [`${config.type}.nivel`]: 1},
            })

            const character1 = await personajes.findOne({ID: existingRelation.ID1})
            const character2 = await personajes.findOne({ID: existingRelation.ID2})

            const embed = new EmbedBuilder()
            .setTitle(`${character1.Nombre} & ${character2.Nombre} subieron su nivel de ${config.type === "amistad" ? "amistad" : "enemistad"} (>'-'<)`)
            .setDescription("`Nuevo nivel:` *" + (nivelMagico + 1) + "*\n" + 
            `-# ${config.type === "amistad" ? `Ahora tu magia, junto a la de ${character2.Nombre} brillan un poco más juntas.` : `La tensión crece. ${character2.Nombre} ha cruzado la línea, y tú no olvidas.`}`)
            .setColor(config.type === "amistad" ? "Blue" : "DarkRed")
            .setTimestamp()
            .setImage(config.type === "amistad" ? "https://c.tenor.com/ToIYYj1O2_gAAAAC/tenor.gif" : "https://c.tenor.com/sC6ejZCNXdIAAAAC/tenor.gif")

            const channel = client.channels.cache.get("1351768577627394141")

            await channel.send({content: `${interaction.user}`, embeds: [embed]})
            result.levelUp = true
            result.lv = nivelMagico + 1
        }

        result.xp = xp
    }

    async function obtenerEtiqueta(relacion) {
        const etiquetasRelaciones = [
            {
                nombre: "Almas Gemelas",
                descripcion: "Se han encontrado. luego de tanto tiempo...",
                minNetXP: 6000,
                requisitos: () => true,
                prioridad: 51
            },
            {
                nombre: "Hermandad Eterna",
                descripcion: "Un vínculo mágico inquebrantable forjado en mil batallas.",
                minNetXP: 5000,
                requisitos: () => true,
                prioridad: 30
            },
            {
                nombre: "Compañeros de aventura",
                descripcion: "Para aquellos que se acompañan mutuamente",
                minNetXP: 4000,
                requisitos: () => true,
                prioridad: 17
            },
            {
                nombre: "Aliados Mágicos",
                descripcion: "No solo te acompaña en la vida, si no te apoya mutuamente",
                minNetXP: 3000,
                requisitos: () => true,
                prioridad: 15
            },
            {
                nombre: "Mejores Amigos",
                descripcion: "Un vínculo mágico inquebrantable",
                minNetXP: 2000,
                requisitos: () => true,
                prioridad: 13
            },
            {
                nombre: "Amistad sincera",
                descripcion: "En las buenas y en las malas",
                minNetXP: 1500,
                requisitos: () => true,
                prioridad: 11
            },
            {
                nombre: "Amistad cercana",
                descripcion: "Alguien a quien puedes confiar",
                minNetXP: 1000,
                requisitos: () => true,
                prioridad: 9
            },
            {
                nombre: "Amistad",
                descripcion: "...",
                minNetXP: 500,
                requisitos: () => true,
                prioridad: 7
            },
            {
                nombre: "Compañeros de clase",
                descripcion: "Posiblemente se conocieron por que van en el mismo salon",
                minNetXP: 250,
                requisitos: () => true,
                prioridad: 5
            },
            {
                nombre: "Conocidos del instituto",
                descripcion: "Alguna vez se toparon en el instituto",
                minNetXP: 100,
                requisitos: () => true,
                prioridad: 3
            },
            {
                nombre: "Neutro",
                descripcion: "No se conocen lo suficiente para definir una relación",
                minNetXP: 50,
                requisitos: () => true,
                prioridad: 1
            },
            {
                nombre: "Extraños",
                descripcion: "Posiblemente se conozcan por terceras personas",
                minNetXP: 10,
                requisitos: (relacion) => relacion.amistad.nivel >= 10 && relacion.enemistad.nivel >= 10,
                prioridad: 2
            },
            {
                nombre: "Recuerdos confusos",
                descripcion: "A veces los conflictos nublan nuestra vista y no dejan ver con claridad lo que alguna vez significó para nosotros esa amistad",
                minNetXP: 0,
                requisitos: () => true,
                prioridad: 50
            },
            {
                nombre: "Tension leve",
                descripcion: "De las cosas pequeñas a lo grande",
                minNetXP: -10,
                requisitos: () => true,
                prioridad: 4
            },
            {
                nombre: "Antipatia",
                descripcion: "Lo contrario a la empatía",
                minNetXP: -100,
                requisitos: () => true,
                prioridad: 6
            },
            {
                nombre: "Rivales académicos",
                descripcion: "Seguramente su ego los consume en el combate",
                minNetXP: -500,
                requisitos: () => true,
                prioridad: 8
            },
            {
                nombre: "Enemigos del Instituto",
                descripcion: "Han pasado suficientes cosas negativas cómo para tener este titulo",
                minNetXP: -1500,
                requisitos: () => true,
                prioridad: 10
            },
            {
                nombre: "Sombras Opuestas",
                descripcion: "Su odio es grande.",
                minNetXP: -3000,
                requisitos: () => true,
                prioridad: 12
            },
            {
                nombre: "Némesis",
                descripcion: "Has encontrado a tu alma opuesta.",
                minNetXP: -5000,
                requisitos: () => true,
                prioridad: 14
            },
            {
                nombre: "Vendetta Ancestral",
                descripcion: "Su odio se transimte a traves de las generaciónes",
                minNetXP: -6000,
                requisitos: () => true,
                prioridad: 16
            },
            {
                nombre: "Eterno Odio",
                descripcion: "Su nivel de odio es indescriptible",
                minNetXP: -9999,
                requisitos: () => true,
                prioridad: 50
            },
            {
                nombre: "Desconocidos",
                descripcion: "Sin ningun vínculo especifico. Un paso antes de una posible amistad o enemistad",
                minNetXP: 0,
                requisitos: () => true,
                prioridad: 0
            }
        ]
    }
    
    return result
}
