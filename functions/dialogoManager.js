const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle, ChatInputCommandInteraction } = require('discord.js');
const fs = require('fs');
const path = require('path');

class DialogueSystem {
    constructor() {
        try {
            this.dialogues = {
                general: require('./../dialogos/generales.json'),
                missions: require('./../dialogos/misiones.json'),
                events: require('./../dialogos/eventos.json')
            };
        } catch (error) {
            console.log(error)
        }


        this.activeDialogues = new Map();
    }

    /**
     * Inicia un diálogo con un usuario
     * @param {string} type - Tipo de diálogo ('general', 'missions', 'events')
     * @param {string} dialogueId - ID del diálogo
     * @param {ChatInputCommandInteraction} interaction - Interacción de Discord
     * @param {Object} options - Opciones adicionales
     */


    async startDialogue(type, dialogueId, interaction, options = {}) {

        const dialogue = this.dialogues[type].find(d => d.id === dialogueId);

        if(!dialogue) {
            console.error(`Dialogo no encontrado: ${dialogueId} en ${type}`)
            return false;
        }

        if(this.activeDialogues.get(interaction.user.id)) return interaction.reply({content: "Ya hay un dialogo activo", flags: ["Ephemeral"]})

        if(dialogue?.requisitos && !this.checkRequirements(dialogue?.requisitos, interaction.user.id, options)) {
            return false;
        }

        this.activeDialogues.set(interaction.user.id, {
            type,
            dialogueId,
            currentStep: 0,
            messageIds: [],
            context: options.context || {},
            datems: options.context?.code
        });

        console.log(options.context.code)

        await this.processNextStep(interaction)
        return true;
    }

    /**
     * @param {ChatInputCommandInteraction} interaction 
     */

    async processNextStep(interaction) {
        const userData = this.activeDialogues.get(interaction.user.id)

        if(!userData) return false;

        const dialogue = this.dialogues[userData.type].find(d => d.id === userData.dialogueId)
        const currentDialogue = dialogue.dialogos[userData.currentStep]

        if(!currentDialogue) {
            this.activeDialogues.delete(interaction.user.id)
            if(dialogue.onComplete) {
                this.executeActions(dialogue.onComplete, interaction. userData.context)
            }
            return true;
        }

        if(currentDialogue.delay && currentDialogue.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, currentDialogue.delay));
        }

        if(currentDialogue.multipleMessages) {
            await this.processMultipleMessages(currentDialogue.multipleMessages, interaction, userData)
        }else {
            await this.sendEditMessage(currentDialogue, interaction, userData);   
        }

        if(!currentDialogue.components || currentDialogue.components.length === 0) {
            userData.currentStep++;
            this.activeDialogues.set(interaction.user.id, userData);

            if(currentDialogue.nextStep) userData.currentStep = currentDialogue.nextStep
            await this.processNextStep(interaction);
        }

        return true;
    }


    /**
     * Procesa y envía múltiples mensajes en paralelo
     * @param {Array} messages 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Object} userData - Datos del usuario
     */

    async processMultipleMessages(messages, interaction, userData) {
        const processPromises = messages.map((msg, index) => {
            return this.sendEditMessage(msg, interaction, userData, index)
        });

        await Promise.all(processPromises);
    }

    /**
     * Envía o edita un mensaje según corresponda
     * @param {Object} dialogueData - Datos del diálogo
     * @param {ChatInputCommandInteraction} interaction - Interacción de Discord
     * @param {Object} userData - Datos del usuario
     * @param {number} messageIndex - Índice del mensaje (para múltiples mensajes)
     */

    async sendEditMessage(dialogueData, interaction, userData, messageIndex = 0) {
        const messageOptions = this.buildMessageOptions(dialogueData, userData.context);

        let messageId = userData.messageIds[messageIndex];
        let message;

        switch (dialogueData.type) {
            case "edit":
                try {
                    const md = await interaction.user.createDM()
                    message = await md.messages.fetch(messageId)
                    await message.edit(messageOptions);
                } catch (error) {
                    console.error(`Error al editar mensaje: ${error}`)
                    message = await interaction.followUp({ ...messageOptions, fetchReply: true}),
                    userData.messageIds[messageIndex] = message.id;
                    this.activeDialogues.set(interaction.user.id, userData)
                }
                break;
                case "send":
                        if(interaction.replied || interaction.deferred) {
                            message = await interaction.followUp({ ...messageOptions, fetchReply: true})
                        }else {
                            await interaction.deferReply({ ephemeral:dialogueData.ephemeral})
                            message= await interaction.editReply(messageOptions)
                        }
                        
                        console.log("Mensaje", message.id)
                        userData.messageIds[messageIndex] = message.id;
                        this.activeDialogues.set(interaction.user.id, userData)
                    break;
                    case "parallel":

                        break;
                        case "delete":
                            try {
                                const md = await interaction.user.createDM()
                                message = await md.messages.fetch(messageId)
                                await message.delete(messageOptions);
                            } catch (error) {
                                console.error(`Error al intentar borrar el mensaje: ${error}`)
                                await interaction.followUp({content: "-# Se supone que se deberia borrar el mensaje, pero no puedo.\n-# Shh, no le digas a nadie (>ᴗ•)", flags: "Ephemeral"})
                            }

                            break;
        
            default:
                break;
        }



        return message;
    }

    /**
     * Construye las opciones del mensaje
     * @param {Object} dialogueData - Datos del diálogo
     * @param {Object} context - Contexto del diálogo
     */
       buildMessageOptions(dialogueData, context) {
        const messageOptions = {};
        
        
        if (dialogueData.content) {
            messageOptions.content = this.parseText(dialogueData.content, context);
        }

        if(dialogueData.embeds) {
            messageOptions.embeds = dialogueData.embeds.map(embed => {
                const embedBuilder = new EmbedBuilder();

                if (embed.title) embedBuilder.setTitle(this.parseText(embed.title, context));
                if (embed.description) embedBuilder.setDescription(this.parseText(embed.description, context));
                if (embed.color) embedBuilder.setColor(embed.color);
                if (embed.footer) embedBuilder.setFooter({ text: this.parseText(embed.footer.text, context), iconURL: embed.footer.iconURL });
                if (embed.thumbnail) embedBuilder.setThumbnail(this.parseText(embed.thumbnail, context));
                if (embed.image) embedBuilder.setImage(embed.image);
                if (embed.author) embedBuilder.setAuthor({ name: this.parseText(embed.author.name, context), iconURL: embed.author.iconURL, url: embed.author.url });

                if (embed.fields) {
                    embedBuilder.addFields(embed.fields.map(field => ({
                        name: this.parseText(field.name, context),
                        value: this.parseText(field.value, context),
                        inline: field.inline
                    })));
                }

                return embedBuilder;

            });
        }

        // Componentes (botones, selectmenus)
        if (dialogueData.components) {
            messageOptions.components = this.buildComponents(dialogueData.components, context);
        }
        
        // Archivos adjuntos
        if (dialogueData.files) {
            messageOptions.files = dialogueData.files;
        }
        
        return messageOptions;
    }


    /**
     * Construye los componentes interactivos
     * @param {Array} components - Componentes a construir
     * @param {Object} context - Contexto del diálogo
     */
        buildComponents(components, context) {
            const rows = [];
            let currentRow = new ActionRowBuilder();
            let currentComponents = 0;
            
            for (const component of components) {
                // Si la fila actual tiene 5 componentes (máximo), crear una nueva
                if (currentComponents >= 5) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                    currentComponents = 0;
                }
                
                if (component.type === 'BUTTON') {
                    const button = new ButtonBuilder()
                        .setCustomId(this.parseText(component.customId, context))
                        .setLabel(this.parseText(component.label, context))
                        .setStyle(ButtonStyle[component.style] || ButtonStyle.Secondary);
                    
                    if (component.emoji) button.setEmoji(component.emoji);
                    if (component.disabled) button.setDisabled(true);
                    if (component.url) {
                        button.setURL(component.url);
                        button.setStyle(ButtonStyle.Link);
                    }

                    currentRow.addComponents(button);
                    currentComponents++;
                } else if (component.type === 'SELECT_MENU') {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(component.customId)
                        .setPlaceholder(this.parseText(component.placeholder, context))
                        .setMinValues(component.minValues || 1)
                        .setMaxValues(component.maxValues || 1);
                    
                    // Opciones del menú
                    if (component.options) {
                        selectMenu.addOptions(component.options.map(option => ({
                            label: this.parseText(option.label, context),
                            value: option.value,
                            description: option.description ? this.parseText(option.description, context) : undefined,
                            emoji: option.emoji,
                            default: option.default || false
                        })));
                    }
                    
                    // Un select menu ocupa todo el ancho de la fila
                    currentRow.addComponents(selectMenu);
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                    currentComponents = 0;
                }
            }
            
            // Agregar la última fila si tiene componentes
            if (currentComponents > 0) {
                rows.push(currentRow);
            }
            
            return rows;
        }

    
    /**
     * Ejecuta acciones especificadas
     * @param {Array|Object} actions - Acciones a ejecutar
     * @param {Object} interaction - Interacción de Discord
     * @param {Object} context - Contexto del diálogo
     */
    async executeActions(actions, interaction, context) {
        if (!actions) return;
        
        // Si actions es un objeto, convertirlo a array
        const actionsList = Array.isArray(actions) ? actions : [actions];
        
        for (const action of actionsList) {
            switch (action.type) {
                case 'SET_VARIABLE':
                    context[action.variable] = this.parseValue(action.value, context);
                    break;
                    
                case 'GIVE_ITEM':
                    // Implementa tu sistema de inventario aquí
                    break;
                    
                case 'START_MISSION':
                    // Implementa tu sistema de misiones aquí
                    break;
                    
                case 'COMPLETE_MISSION':
                    // Implementa tu sistema de misiones aquí
                    break;
                    
                case 'PLAY_SOUND':
                    // Puedes implementar esto con algún bot de música
                    break;
                    
                case 'EXECUTE_COMMAND':
                    // Ejecutar comandos de bot personalizados
                    break;
                    
                // Añade más tipos de acciones según necesites
            }
        }
    }
    


       /**
     * Verifica requisitos para iniciar un diálogo
     * @param {Object} requirements - Requisitos a verificar
     * @param {string} userId - ID del usuario
     * @param {Object} options - Opciones adicionales
     */
       checkRequirements(requirements, userId, options = {}) {
        // Implementa la lógica para verificar requisitos
        // Por ejemplo: nivel, misiones completadas, ítems en inventario, etc.
        return true; // Por defecto, permite todos los diálogos
    }

    
/**
 * Salta a un paso específico en el diálogo actual del usuario
 * @param {string} userId - ID del usuario
 * @param {number} step - Paso al que saltar
 * @param {Object} interaction - Interacción para procesar el siguiente paso
 * @returns {boolean} - Éxito de la operación
 */
    
    async jumpToStep(userId, step, interaction) {
        const userData = this.activeDialogues.get(userId);
        
        if (!userData) {
            console.error(`No hay diálogo activo para el usuario: ${userId}`);
            return false;
        }
        
        // Verificar que el paso sea válido
        const dialogue = this.dialogues[userData.type].find(d => d.id === userData.dialogueId);
        if (!dialogue || step >= dialogue.dialogos.length || step < 0) {
            console.error(`Paso inválido: ${step} para diálogo: ${userData.dialogueId}`);
            return false;
        }
        
        // Actualizar el paso
        userData.currentStep = step;
        this.activeDialogues.set(userId, userData);
        
        // Procesar el siguiente paso si se proporciona una interacción
        if (interaction) {
            await this.processNextStep(interaction);
        }
        
        return true;
    }
    
    /**
     * Parsea texto con variables del contexto
     * @param {string} text - Texto a parsear
     * @param {Object} context - Contexto del diálogo
     */
    parseText(text, context) {
        if (!text) return '';
        // Reemplazar variables con formato {variable}
        return text.replace(/\{(\w+)\}/g, (match, variable) => {
            return context[variable] !== undefined ? context[variable] : match;
        });
    }
    
    /**
     * Parsea un valor que puede contener referencias a variables
     * @param {any} value - Valor a parsear
     * @param {Object} context - Contexto del diálogo
     */
    parseValue(value, context) {
        if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
            const variable = value.slice(1, -1);
            return context[variable] !== undefined ? context[variable] : value;
        }
        return value;
    }


    
    /**
     * Termina un diálogo activo
     * @param {string} userId - ID del usuario
     */
    endDialogue(userId) {
        this.activeDialogues.delete(userId);
    }



}

module.exports = new DialogueSystem();