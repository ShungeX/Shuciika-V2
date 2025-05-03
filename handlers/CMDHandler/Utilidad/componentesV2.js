const {ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    ChatInputCommandInteraction,
    ComponentType,
    SeparatorSpacingSize,
    ThumbnailBuilder,} = require("discord.js") 

const Builders = require("@discordjs/builders")
const Enums = require("discord-api-types/v10")
    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const v2 = [
        {
          "type": 17,                  // ← Container V2
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
                "content": "**`100%`** <:pyellow:1367956755950211205><:pyellow:1367956755950211205><:pyellow:1367956755950211205><:pyellow:1367956755950211205> *Núcleo central*"
            },
            {
              "type": 10,
              "content": "**`100%`** <:pgreen:1367956541226876969><:pgreen:1367956541226876969><:pgreen:1367956541226876969><:pgreen:1367956541226876969> *Barrera*"
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
              "type": 10,
              "content": "**`100%`** <:pblue:1367956892307034182><:pblue:1367956892307034182><:pblue:1367956892307034182><:pblue:1367956892307034182> *Estabilidad del Velo Mágico*"
            },
            {
              "type": 10,
              "content": "**`100%`** <:pblue:1367956892307034182><:pblue:1367956892307034182><:pblue:1367956892307034182><:pblue:1367956892307034182> *Integridad del Archivo Arcano*"
            },
            {
              "type": 10,
              "content": "\n-# **Resonancia Magica:** `Estable`"
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
                  "custom_id": `events-${interaction.user.id}-questionResistencia`
                  
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
                      "value": "forest",

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


    const channel = await client.channels.fetch("1368013029165240390")

    

  
  const message = await channel.send({
    components: v2,
    flags: ["IsComponentsV2"],
    withResponse: true,
    files: [],
  });
  
}