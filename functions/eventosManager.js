const { EventEmitter } = require('events');
const clientdb = require("../Server");
const dialogueSystem  = require('./dialogoManager');
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const eventosDB = db.collection("Eventos")


class eventosManager {
      /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    constructor() {
        this.events  = new Map()
    }


    async registerEvent(eventId, eventConfig) {
        const event = await eventosDB.findOne({_id: eventId})

        if(!event) {
            console.error(`El evento con la ID ${eventId} no existe`)
            return {success: false}
        }
        this.events.set(eventId, {
          ...event,
          enabled: event.enabled !== false,
          message: eventConfig?.message, 
          participants: new Set(),
          config: eventConfig || {}
        });
        return this.events.get(eventId);
      }

      /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    async isEventAvailable(eventId, mdID, client) {
        const event = this.events.get(eventId);
        
        if (!event) return { available: false, reason: 'EVENTO_NO_ENCONTRADO' };
        if (!event.enabled) return { available: false, reason: 'EVENTO_DESHABILITADO' };
        
        // Verificar restricciones de tiempo si existen
        if (event.startTime && new Date() < new Date(event.startTime)) {
          return { available: false, reason: 'EVENTO_NO_INICIADO' };
        }
        
        if (event.endTime && new Date() > new Date(event.endTime)) {
          return { available: false, reason: 'EVENTO_FINALIZADO' };
        }

        if (event?.started) {
          return { available: false, reason: "El evento ya ha iniciado..."}
        }

        try {
          const user = await client.users.fetch(mdID);
          const md = await user.createDM()

          await md.send({content: "-# Verificación de mensajes al MD... (Se borra automaticamente en unos segundos)"}).then(m => {
            setTimeout(() => m.delete(), 3000)
          })
        } catch (error) {
          console.error(error)
          return { available: false, reason: "\n -# No se pueden enviar mensajes a tu MD. Esto es necesario para el evento..." + "```"
            + `Error especifico: ${error}` + "```"
          }
        }
        
        return { available: true };
      }


        // Registrar participación de un usuario en un evento
    async registerParticipant(eventId, userId, client, userID2) {
    const availability = await this.isEventAvailable(eventId, userID2, client,);
    
    if (!availability.available) {
      return {
        success: false,
        reason: availability.reason
      };
    }
    
    const event = this.events.get(eventId);
    
    // Verificar si el usuario ya está registrado
    if (event.participants.has(userId)) {
      return {
        success: false,
        reason: 'ACTUALMENTE_REGISTRADO'
      };
    }
    
    // Agregar usuario al set de participantes en memoria
    event.participants.add(userId);
    
    // Registrar en la base de datos
    try {
      await eventosDB.updateOne(
        { eventId },
        { 
          $addToSet: { participants: userId },
          $setOnInsert: { 
            eventId,
            createdAt: new Date()
          }
        },
        { upsert: true }
      )
      
      return {
        success: true,
        event
      };
    } catch (error) {
      console.error(`Error al registrar al personaje ${userId} en el evento ${eventId}:`, error);
      return {
        success: false,
        reason: 'ERROR_REGISTRAR_PERSONAJE',
        error
      };
    }
      }


      async startEvent(eventId, dialogSystemConfig = {}, client) {
        const event = this.events.get(eventId);
        
        try {
          // Marcar el evento como iniciado
          await eventosDB.updateOne(
            { eventId },
            { 
              $set: { 
                started: true,
                startedAt: new Date()
              }
            }
          );
          
          // Actualizar en memoria
          event.started = true;
          event.startedAt = new Date();

          await clearInterval(event.config.messageInt)
          
          // Procesar cada participante e iniciar el sistema de diálogos para cada uno
          const participantResults = await Promise.all(
            Array.from(event.participants).map(characterId => 
              this.initiateDialogForParticipant(eventId, characterId, event?.config, client)
            )
          );
          
          // Contar éxitos y fallos
          const successful = participantResults.filter(r => r.success).length;
          const failed = participantResults.filter(r => !r.success).length;
          
          return {
            success: true,
            message: `Evento "${event.Nombre}" iniciado con éxito.`,
            stats: {
              totalParticipants: event.participants.size,
              successful,
              failed
            }
          };
        } catch (error) {
          console.error(`Error starting event ${eventId}:`, error);
          return {
            success: false,
            reason: 'ERROR_STARTING_EVENT',
            error
          };
        }
      }

      async initiateDialogForParticipant(eventId, characterId, dialogSystemConfig, client) {
        try {
          
          const character = await characters.findOne({ ID: characterId });
          
          if (!character) {
            console.log("Personaje no encontrado", characterId)
            return { success: false, reason: 'PERSONAJE_NO_ENCONTRADO' };
          }
          
          // Obtener el usuario de Discord
          const user = await client.users.fetch(character._id);
          
          if (!user) {
            console.log("Usuario no encontrado")
            return { success: false, reason: 'USUARIO_NO_ENCONTRADO' };
          }
          const { v4: uuidv4} = require('uuid')
          const options = {
            context: {
              character_Nombre: character.Nombre,
              user: user,
              user_id: user.id,
              code: uuidv4().replace(/-/g, "")
            }
          }


          dialogueSystem.startDialogue(dialogSystemConfig.type, dialogSystemConfig.Id, null, user, options)

          return { success: true, characterId, userId: character.userId };
        }catch(e) {
            console.error(`Error al iniciar el dialogo para el personaje ${characterId} en el evento ${eventId}:`, e);
            return { success: false, characterId, reason: 'ERROR_INITIATING_DIALOG', e };
        }
      }

      async disableRegistration(eventId) {
        await eventosDB('events').updateOne(
          { eventId },
          { $set: { registrationEnabled: false } }
        );
        
        await this.getEvent(eventId);
        return { success: true };
      }


      async getEventParticipantCount(eventId) {
        try {
          const event = this.events.get(eventId);
          
          if (!event) {
            return {
              success: false,
              reason: 'EVENT_NOT_FOUND'
            };
          }
          
          
          return {
            success: true,
            count: event.participants.size,
            eventName: event.Nombre,
            eventId: event.eventId,
            maxParticipants: event.maxParticipants || 0,
            isFull: event.maxParticipants > 0 && 
                    event.participants.size >= event.maxParticipants
          };
        } catch (error) {
          console.error(`Error getting participant count for event ${eventId}:`, error);
          return {
            success: false,
            reason: 'DATABASE_ERROR',
            error
          };
        }
      }

  
    
}

const eventsManager = new eventosManager

module.exports = eventsManager