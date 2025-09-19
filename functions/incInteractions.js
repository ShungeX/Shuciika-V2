const clientdb = require("../Server")
const db = clientdb.db("Interaccion")
const contadorS = db.collection("ContadorS")
const contadorC = db.collection("ContadorC")

/**
             * 
             * @param {Discord.client} client
             * @param {Discord.CommandInteraction} interaction
             * 
             * 
             */

module.exports = async(interaction, IdMember, nameInteraction, isCouple) => {

    const contadorIds = isCouple ? interaction.user.id < IdMember ? 
    `${interaction.user.id}-${IdMember}`:`${IdMember}-${interaction.user.id}`
    : interaction.user.id
    const DateNow = Date.now()

    var contador = {
        solo: null,
        couple: null,
    }

    const schema = {
        $setOnInsert: {created: DateNow},
        $inc: {[`interactions.${nameInteraction}`]: 1}
    }

    

    if(isCouple) {
        const usuarios = [interaction.user.id, IdMember]

        await contadorC.updateOne({_id: contadorIds}, 
            schema,
            {upsert: true}
        )
        const contadorCoup = await contadorC.findOne({_id: contadorIds})
        
        contador.couple = contadorCoup.interactions[nameInteraction]

        for (const contadorId of usuarios) {
            await contadorS.updateOne({_id: contadorId}, 
                schema,
                {upsert: true}
            )
        }
    
        return contador
    }else {

        await contadorS.updateOne({_id: interaction.user.id}, 
            schema,
            {upsert: true}
        )


        const lonelyCount = await contadorS.findOne({_id: interaction.user.id})

        contador.solo = lonelyCount.interactions[nameInteraction]

    }


    return contador
} 