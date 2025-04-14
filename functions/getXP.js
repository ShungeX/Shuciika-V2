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



module.exports = async(interaction, mentionId, Id1, Id2, interactionType) => {
    console.log("ID1:", interaction.id, "\nID2:", mentionId)
    const relationId = Id1 < Id2 ? `${Id1}-${Id2}`:`${Id2}-${Id1}`
    const result = {
        xp: null,
        levelUp: false,
        lv: 0,
    }
    

    var existingRelation = await rel.findOne({_id: relationId})

     if(!existingRelation) {
            const newRelation = {
                _id: relationId,
                ID1: Id1,
                ID2: Id2,
                amistad: "conocidos",
                xp: 0,
                xpnegative: 0,
                lv: 1,
                xptoLv: 41,
                hearts: 0,
                medallas: [""],
                logros: [""],
                recuerdos: [""],
                regalos: [""],
                lastinteraction: Date.now(),
                timeoutinteraction: 10000
            }
    
            await rel.insertOne(newRelation)
            existingRelation = newRelation
        }

    const xpCooldown =  Date.now() - existingRelation.lastinteraction < existingRelation.timeoutinteraction

    if(xpCooldown) {
            return result;
        }

    await calculateXPGain()

    await addXP()
   

    async function addXP(){

        if(interactionType >= 5) {
            const newXP = existingRelation.xpnegative  + result.xp
                    
            let updateData = {
                lastinteraction: Date.now(), 
                xp: newXP,
                xptoLv: existingRelation.xptoLv
            }

            await rel.updateOne({_id: relationId}, {$set: {lastinteraction: updateData.lastinteraction}, $inc: {xpnegative: result.xp}})

        }else {
            const newXP = existingRelation.xp  + result.xp
        
            let levelUp = false
    
            if((newXP - existingRelation.xpnegative) >= existingRelation.xptoLv) {
                levelUp = true
                result.levelUp = true
            }
    
            let updateData = {
                lastinteraction: Date.now(), 
                xp: newXP,
                xptoLv: existingRelation.xptoLv
            }
    
            if(levelUp) {
                updateData.xptoLv = ((existingRelation.lv + 1) ** 2) + ((existingRelation.lv + 1)* 40)
                result.lv = 1
            }
    
            await rel.updateOne({_id: relationId}, {$set: {lastinteraction: updateData.lastinteraction, xptoLv: updateData.xptoLv}, $inc: {xp: result.xp, lv: result.lv}})
            console.log(levelUp ? "Subio de nivel":"Gano XP")

        }


    }

    async function calculateXPGain(baseXP = 5) {
        const multiplicador = {
            1: 2,
            2: 5,
            3: 1.5,
            4: 1,
            5: 2,
            6: 5,
        }
       result.xp = Math.round(baseXP * (multiplicador[interactionType] || 1))
       console.log(baseXP * (multiplicador[interactionType] || 1))
    }
    
    return result
}
