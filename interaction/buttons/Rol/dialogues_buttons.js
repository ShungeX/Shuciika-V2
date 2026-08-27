const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const dialogueSystem = require('../../../functions/dialogoManager');

module.exports = {
    customId: "dialogue_button",
    buttonAuthor: true,

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, type, action, selectValue, code) => {
        const userData = dialogueSystem.activeDialogues.get(interaction.user.id);

        if(!userData) return interaction.reply({content: "Al parecer estos dialogos son muy antiguos y ya expiraron 〒▽〒", flags: "Ephemeral"})

        const dialogue = dialogueSystem.dialogues[userData.type].find(d => d.id === userData.dialogueId)
        const currentDialogue = dialogue.dialogos[userData.currentStep]
        if(code !== userData.datems) return interaction.reply({content: "Esta interacción corresponde a un dialogo diferente o antiguo. Ya no se puede responder 〒▽〒", flags: "Ephemeral"})
        const component = currentDialogue.components[Number(selectValue)]


        if(type === "i") {

            if(!component) return interaction.reply({content: "No se pudo seleccionar esta opcion, seguramente se trate de un error 〒▽〒", flags: "Ephemeral"});
                userData.currentStep = component.nextStep

                dialogueSystem.activeDialogues.set(interaction.user.id, userData);
                await interaction.deferUpdate();

                await dialogueSystem.processNextStep(interaction)
        }
        if(type === "despertar") {
            if(!component) return interaction.reply({content: "No se pudo seleccionar esta opcion, seguramente se trate de un error 〒▽〒", flags: "Ephemeral"});

            if(userData?.skipTimeout) {
                console.log("Limpiando...")
                clearTimeout(userData.skipTimeout);
                delete userData.skipTimeout;
                dialogueSystem.activeDialogues.set(interaction.user.id, userData);
            }


            userData.currentStep = component.nextStep
            dialogueSystem.activeDialogues.set(interaction.user.id, userData);
            await interaction.deferUpdate();
            await dialogueSystem.processNextStep(interaction)
        }
    }
}