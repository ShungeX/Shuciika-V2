const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const character = db2.collection("Personajes")
const souls = db2.collection("Soul")
const eventosDB = db.collection("Eventos")
const version = require("../../../config")
const eventosManager = require("../../../functions/eventosManager")


module.exports = {
    customId: "events_registers",
    buttonAuthor: false,

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */


    ejecutar: async(client, interaction, idEvent, StaffActions) => {

        if(StaffActions === "staff_accept") {
            const channel = client.channels.cache.get("1319810691099656224")
           await interaction.deferReply({flags: ["Ephemeral"]})


           const evento = await eventosManager.events.get(idEvent)

           if(!evento) return interaction.editReply({content: "Este evento ya no es valido. Seguramente caducó"})
            console.log(evento.config.messageStaffId)


            const messageStaff = await interaction.channel.messages.fetch(evento.config.messageStaffId)

            const iniciar = await eventosManager.startEvent(idEvent, null, client)

            messageStaff.edit({content: "Evento iniciado", components: []})

            try {
                const message = await channel.messages.cache.get(evento.config.messageOriginId)

                message.edit({components: []})
            } catch (error) {
                console.log("no pude actualizar el mensaje")
            }
            


            return await interaction.editReply({content: "Evento iniciado\n" + `${iniciar.stats.totalParticipants} / ${iniciar.stats.failed} / ${iniciar.success} / ${iniciar.message}`})
        }


        const personaje = await character.findOne({_id: interaction.user.id})

        if(!personaje) return interaction.reply({content: "No puedes registrarte porque tu personaje no es valido o no existe aun\n-# ¿Porque no intentas registrar un personaje?",
            flags: ["Ephemeral"]
        })

        const soul = await souls.findOne({_id: interaction.user.id})

        if(soul) return interaction.reply({content: "Una estrella guarda aquello que resuena en tu alma.\n-# Ya has despertado el poder de tu personaje...", flags: ["Ephemeral"]})

        const register = await eventosManager.registerParticipant(idEvent, personaje.ID, client, interaction.user.id)

        if(!register.success) {
            console.log(register?.error)
            return interaction.reply({content: `No te has podido registrar...\n${register.reason}`, flags: ["Ephemeral"]})
        }else {
            interaction.reply({content: `*Has tocado el cristal*. Sientes una gran energia provenir de el...\n-# **${personaje.Nombre} se ha registrado correctamente al evento.** Espera a que un administrador lo inicie ( •̀ ω •́ )y`, flags: ["Ephemeral"]})
        }

        

    }
}