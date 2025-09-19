const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, InteractionContextType, Embed, StringSelectMenuBuilder} = require(`discord.js`)
const clientdb = require("../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Region = db2.collection("RegionStatus")
const character = db2.collection("Personajes")
const soul = db2.collection("Soul")
const version = require("../config")

const { EventEmitter } = require('events');
class TemporadaEmitter extends EventEmitter {}

class Temporada {
    constructor() {
       
    }

    

    async actualizarTemporada(isSend, channel, messages) {
        this.statusLugar = await Region.findOne({_id: "TOB-001"})
        const nucleoCentral = this.statusLugar.nucleoCentral
        const barrera = this.statusLugar.barrera
        const veloMagico = this.statusLugar.veloMagico
        const archivoArcano = this.statusLugar.archivoArcano

        const v2 = [
            {
              "type": 17,    
              "accent_color": 4093403,
              "spoiler": false,
              "components": [
                {
                  "type": 10,
                  "content": "# **`🔰 Resistencia del Instituto Tobeya`**"
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                  },
                {
                  "type": 12,
                  "items": [
                    {
                      "media": { "url": "https://i.pinimg.com/736x/63/f0/c1/63f0c17695b63b3b8468a48bf9899bbf.jpg" },
                      "description": null,
                      "spoiler": false
                    }
                  ]
                },
                {
                  "type": 14,
                  "divider": true,
                  "spacing": 1
                },
                {
                    "type": 10,
                    "content": `${this.barraStatus(nucleoCentral.points, nucleoCentral.maxPoints, null, "yellow")} *Núcleo central*`
                },
                {
                  "type": 10,
                  "content": `${this.barraStatus(barrera.points, barrera.maxPoints, null, "green")} *Barrera*`
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                {
                  "type": 10,
                  "content": `${this.barraStatus(veloMagico.points, veloMagico.maxPoints, null, "blue")} *Estabilidad del Velo Mágico*`
                },
                {
                  "type": 10,
                  "content": `${this.barraStatus(archivoArcano.points, archivoArcano.maxPoints, null, "blue")} *Integridad del Archivo Arcano*`
                },
                {
                  "type": 10,
                  "content": "\n-# **Resonancia magica:**`" + `${this.statusLugar.status}` + "`"
                },
                {
                  "type": 14,
                  "divider": true,
                  "spacing": 2
                },
                {
                  "type": 10,
                  "content": "-# Últimas contribuciones: *En proceso...*"
                },
                {
                  "type": 14,
                  "divider": true,
                  "spacing": 2
                },
                {
                  "type": 1,             
                  "components": [
                    {
                      "type": 2,
                      "style": 2,
                      "label": "¿Qué es esto?",
                      "custom_id": `events-null-questionResistencia`
                    }
                  ]
                },
                {
                  "type": 1,              // ← Fila de select
                  "components": [
                    {
                      "type": 3,
                      "custom_id": "future_select",
                      "options": [
                        {
                          "label": "Bosque Encantado",
                          "value": "forest"
                        }
                      ],
                      "placeholder": "Próximamente",
                      "min_values": 1,
                      "max_values": 1,
                      "disabled": true
                    }
                  ]
                }
              ]
            }
          ];


        if(isSend) {
            const message = await channel.send({components: v2, flags: ["IsComponentsV2"],
                withResponse: true })
        }else {

            messages.edit({components: v2, flags: ["IsComponentsV2"],
                withResponse: true })
        }



    }

    barraStatus(current, max, mini, color) {
        const colorEmojis = {
            blue: "<:pblue:1367956892307034182>",
            orange: "<:porange:1367956781447516262>",
            yellow: "<:pyellow:1367956755950211205>",
            greenDark: "<:pgreen2:1367956565696712826>",
            green: "<:pgreen:1367956541226876969>"
        }


        const porcentaje = (current / max) * 100

        const totalBars = 6;
        let filledBars = Math.round((current / max) * totalBars);
        const emptyBars = totalBars - filledBars;

        if(current > 0 && filledBars === 0) {
            filledBars = 1
        }

        let barraLlena = `${colorEmojis[color] || "<:pgray:1367973935412416632>"}`.repeat(filledBars)
        const barraVacia = '<:emp:1367956432322040029>'.repeat(emptyBars)

        if(porcentaje < 10 && filledBars > 0) {
            barraLlena = barraLlena.slice(0, -2) + '<a:AttencionHeart:1345256576167968828>'
        }
        return  "**`" + `${porcentaje}%` +`** ${barraLlena}${barraVacia} `;
    }
}

const temporada = new Temporada()
module.exports = temporada