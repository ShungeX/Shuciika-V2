const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed, StringSelectMenuBuilder } = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const souls = db2.collection("Soul")
const character = db2.collection("Personajes")
const version = require("../../../config");
const { petConfig, petDesgaste, modificadoresLv, modifEtapa, pesosEstados } = require("../../../config/configPets");
const { duelSystem } = require("../../../functions/Duelo/duelManager");
const estadosMascota = require("../../../functions/petsStatus");
const dbobjetos = db2.collection("Objetos_globales")
const pets = db2.collection("Mascotas")


module.exports = {
    customId: "pets",
    selectAutor: true,


    ejecutar: async (client, interaction, char, action) => {
        const id = interaction.values[0]


        console.log(id, action)

        if (action === "incubar") {
            petsJson = {
                "_id": "randomEgg",
                "characterID": char.ID,
                "etapa": "Huevo",
                "adoptada": Math.floor(Date.now() / 1000),
                "rareza": dataegg.Rareza,
                "activePet": null,
                "emoji": {
                    "name": "lemon_fox",
                    "id": "1374263466034200616"
                },
                "diasCuidado": 0,
                "lastDay": 0,
                "crecimiento": 0,
                "inIncubadora": true,
            }

            petsJson2 = {
                "_id": "randomEgg",
                "characterID": char.ID,
                "nombre": null,
                "tipo": "Huevo",
                "etapa": "Huevo",               // Solo huevo
                "vitalidad": 5, //Representado en corazones
                "nacimientoEn": 1720905600,      // epoch si está en incubadora
                "puntosRequeridos": 100,
                "ProgresoIncubación": 5,
                "creadoEn": 1720627200, //Epoch para fecha
                "registroCuidado": {
                    "ultimoCuidado": x, //ms date.Now para calcular el ultimo cuidado,
                    "ciclosFallidos": 0 //En caso de que el usuario falle
                },
                "historial": [], //¿Deberia agregarlo?
                "flags": {
                    "incubadora": false,
                    "fragmentado": false, //Roto / muerto
                    //¿Deberia incluir más flags aqui?
                },
                 "emoji": {
                    "name": "lemon_fox",
                    "id": "1374263466034200616"
                },
            }


            pets.updateOne()
        }
    }
}