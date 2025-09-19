const { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db2 = clientdb.db("Rol_db")
const souls = db2.collection("Soul")
const regiones = db2.collection("Regiones")
const configServer = require("../../../../config")
const transaccionCache = require("../../../../utils/cache")
const { v4: uuidv4 } = require('uuid')


module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("explorar")
    .setDescription("Explora una region para obtener recompensas.")
    .addStringOption(num =>
      num.setName("region")
        .setDescription("Selecciona la region a explorar")
        .addChoices(
          { name: "[🏫] Tobeya", value: "TOB-001" }
        )
        .setRequired(true)
    ),

  requireCharacter: false,
  requireSoul: true,
  requireCharacterCache: false,
  isDevOnly: false,
  enMantenimiento: false,
  requireEstrict: {
    Soul: true,
    Character: true,
    Cachepj: false
  },


  /**
   * 
   * @param {Client} client 
   * @param {ChatInputCommandInteraction} interaction 
   */

  ejecutar: async (client, interaction, { soul }) => {
    const areaExplorar = interaction.options.getString("region")
    const userCache = transaccionCache.getUser(interaction.user.id)

    if (userCache?.explorarID) {
      const message = transaccionCache.get(userCache.explorarID)
      try {
        const getChannel = await client.channels.fetch(message.message.channelId)
        await getChannel.messages.fetch(message.message.id)
        return interaction.reply({ content: `Ya tienes una exploración activa ＞﹏＜\n-# [Haz click aqui para ir al mensaje](https://discord.com/channels/${message.message.guildId}/${message.message.channelId}/${message.message.id})`, ephemeral: true })
      } catch (error) {
        console.log("No se pudo encontrar el mensaje [Exploración]")
        transaccionCache.delete(userCache)
        transaccionCache.deleteUser(interaction.user.id)
      }

    }

    if (!soul) {
      return interaction.reply({ content: "Tu personaje aun es muy vulnerable para explorar... Necesita despertar su poder interior", ephemeral: true })
    }

    if (soul.HP === 0) return interaction.reply({ content: "Te sientes muy debil para ir a explorar. =.=\n-# Recupera algo de **`HP`** usando `/rol usar_objeto [id]`", ephemeral: true })

    const region = await regiones.findOne({ _id: areaExplorar })


    if (!region) {
      return interaction.reply({ content: "Al parecer ese lugar ya no aparece en el mapa...", ephemeral: true })
    }


    let characterEnergy = soul?.energy ? await updateEnergy(soul.energy, configServer.maxEnergy, soul) : null


    const components = [
      {
        "type": 10,
        "content": "# Sistema de exploración \n-# *Explorando la región de: *`" + region.Nombre + "`" + `\n-# Energia: ${barrasDeEnergia((characterEnergy || 60), configServer.maxEnergy)}`
      },
      {
        "type": 10,
        "content": "*¿Qué zona vamos a explorar hoy?* ( •̀ ω •́ )y"
      },
      {
        "type": 14,
        "divider": true,
        "spacing": 2
      }
    ];


    Object.keys(region.areas).forEach(key => {
      const area = region.areas[key]
      const isHabilitado = area.habilitado ? `(${area.energiaNecesaria} de energía)` : "[Deshabilitado]"

      let subzonasText = "";

      if (area.subzonas && Object.keys(area.subzonas).length > 0) {
        const nombresZonas = Object.values(area.subzonas).map(s => s.nombre);

        subzonasText = `-# - - *Sub-zonas: [${nombresZonas.join(", ")}]*`
      }


      if (area.habilitado) {
        components.push({
          "type": 9,
          "accessory": {
            "type": 2,
            "style": 3,
            "label": "¡Explorar!",
            "emoji": area.emoji ? { name: area.emoji, id: null } : null,
            "disabled": false,
            "custom_id": `exOp-${interaction.user.id}-zona-${key}`
          },
          "components": [
            {
              "type": 10,
              "content": `-# - ***${area.Nombre}*** ${isHabilitado}\n-# ${`*${area.descripcion}*` || ""}\n${subzonasText}`
            }
          ]
        });
      } else {
        components.push({
          "type": 9,
          "accessory": {
            "type": 2,
            "style": 2,
            "label": "No disponible",
            "emoji": null,
            "disabled": true,
            "custom_id": `explorar_${key}`
          },
          "components": [
            {
              "type": 10,
              "content": `-# - ***${area.Nombre}*** ${isHabilitado}\n${subzonasText}`
            }
          ]
        });

      }


    });

    components.push(
      {
        "type": 14,
        "divider": true,
        "spacing": 1
      },
      {
        "type": 12,
        "items": [
          {
            "media": {
              "url": "https://c.tenor.com/OJ6jmNtTflcAAAAd/tenor.gif"
            },
            "description": null,
            "spoiler": false
          }
        ]
      },
      {
        "type": 10,
        "content": "-# Tu energía se actualiza antes de iniciar una exploración.  (10 min > 1 punto de energia.)"
      }
    );
    const v2Exploracion = [
      {
        "type": 17,
        "accent_color": null,
        "spoiler": false,
        "components": components
      }
    ];

    const transacciónId = uuidv4().replace(/-/g, "")


    const message = await interaction.reply({ components: v2Exploracion, withResponse: true, flags: ["IsComponentsV2"] })

    if (!characterEnergy) {
      await souls.updateOne({ _id: interaction.user.id },
        {
          $set: {
            energy: configServer.maxEnergy
          }
        }
      )
      interaction.followUp({ content: `Parece que es la primera vez que vas a explorar, ¿ansioso?. Ten **${configServer.maxEnergy} de energía** para comenzar tu aventura`, ephemeral: true })
    }

    const obj = {
      regionSelect: areaExplorar,
      regionNombre: region.Nombre,
      message: message.resource.message
    }

    const data = {
      explorarID: transacciónId
    }

    await transaccionCache.set(transacciónId, obj)
    await transaccionCache.setUser(interaction.user.id, data)

    function barrasDeEnergia(currentEnergy, maxEnergy) {
      const porcentaje = (currentEnergy / maxEnergy) * 100
      const maxbar = 5;

      let filledBars = Math.round(((currentEnergy > maxEnergy ? maxEnergy : currentEnergy) / maxEnergy) * maxbar)
      const emptyBars = maxbar - filledBars;

      let energyBars = "⚡".repeat(filledBars)
      let energyEmpty = ".".repeat(emptyBars)

      return "`" + `[${energyBars}${energyEmpty}]` + "`" + ` **(${currentEnergy}/${maxEnergy})**`

    }

    async function updateEnergy(currentEnergy, maxEnergy = 60, soul) {
      const ahora = Date.now();
      const regeneracionTime = 10 // Esto en minutos

      const lastUpdate = soul?.lastEnergyUpdate || ahora;


      const diferenciaMinutos = (ahora - lastUpdate) / (1000 * 60);

      const puntosRegenerados = Math.floor(diferenciaMinutos / regeneracionTime);

      const nuevaEnergia = Math.min(currentEnergy + puntosRegenerados, maxEnergy);

      const newLastUpdate = puntosRegenerados > 0 ? lastUpdate + (puntosRegenerados * 1000 * 60 * regeneracionTime) : lastUpdate;

      await souls.updateOne({ _id: interaction.user.id },
        {
          $set: {
            energy: nuevaEnergia, lastEnergyUpdate: newLastUpdate
          }
        }
      );

      return nuevaEnergia;
    }

  }
}