const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const eventosDB = db.collection("Eventos")
const version = require("../../../config")
const eventosManager = require("../../../functions/eventosManager")


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const eventName = interaction.options.getString("evento")
    
    
    switch (eventName) {
        case "despertar":
            await DespertarEvent()
            break;
    
        default:
            break;
    }


    async function DespertarEvent() {
        const channel = client.channels.cache.get("1319810691099656224")
        const messageStaff = await interaction.deferReply({withResponse: true})

        const embed = new EmbedBuilder()
        .setTitle("Un evento se aproxima...")
        .setDescription("*El director y los maestros les han otrogado a cada estudiante distintos cristales.*\n-# Estos parecen reflejar varias versiones de ti mismo/a")
        .setImage("https://i.pinimg.com/736x/9a/43/b9/9a43b9fc7b64090fd21cea0f618182b0.jpg")
        .setFooter({text: "Registrados: 0 / ..."})
        .setColor("Purple")
        

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
            .setCustomId(`events_registers-null-despertar_TOB01`)
            .setEmoji("<a:ExclamationMarkBubble:1355437226447732746>")
            .setLabel("Tocar el cristal")
            .setStyle(ButtonStyle.Primary)

        )

        const staffButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
            .setCustomId(`events_registers-${interaction.user.id}-despertar_TOB01-staff_accept`)
            .setEmoji("✅")
            .setLabel("Iniciar evento")
            .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
            .setCustomId(`events_registers-${interaction.user.id}-despertar_TOB01-staff_alert`)
            .setEmoji("⚠️")
            .setLabel("Alertar del evento")
            .setStyle(ButtonStyle.Primary)

        )

        const message = await channel.send({embeds: [embed], components: [buttons]})

        const interval = setInterval(async () => {
            console.log("Actualizado")
            const eventInfo = await eventosManager.getEventParticipantCount("despertar_TOB01")
            if (!eventInfo.success) {
                console.error(`No se pudo actualizar el contador para el evento ${eventInfo.eventId}: ${eventInfo.reason}`);
                return false;
            }

            embed.setFooter({text: `Registrados: ${eventInfo.count} / ${eventInfo.maxParticipants === 0 ? "Sin limite" : `${eventInfo.maxParticipants}`}`})
            message.edit({embeds: [embed], components: [buttons]})
        }, 10000)
        
        const config = {
            messageInt: interval,
            messageOriginId: message.id,
            messageStaffId: messageStaff.resource.message.id,
            type: "events",
            Id: "despertar"
        }

        console.log(messageStaff.resource.message.id)


        await eventosManager.registerEvent("despertar_TOB01", config)

        await interaction.editReply({content: "Evento ejecutado correctamente", components: [staffButtons]})



        
    }
}