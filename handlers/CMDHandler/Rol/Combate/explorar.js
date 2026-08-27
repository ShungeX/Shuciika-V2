const { SlashCommandSubcommandBuilder } = require("discord.js");
const clientdb = require("../../../../Server");
const db2 = clientdb.db("Rol_db");
const regiones = db2.collection("Regiones");
const configServer = require("../../../../config");
const transaccionCache = require("../../../../utils/cache");
const { recargarEnergia } = require("../../../../functions/dataCharacters.js");
const { barrasDeEnergia } = require("../../../../utils/utilidadesTexto.js");
const { v4: uuidv4 } = require('uuid');
const { construirOptions } = require("../../../../utils/constructores/construirOptions");
const { crearCustomId } = require("../../../../utils/constructores/customId");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("explorar")
    .setDescription("Explora una region para obtener recompensas.")
    .addStringOption(num =>
      num
        .setName("region")
        .setDescription("Selecciona la region a explorar")
        .addChoices(
          { name: "[🏫] Tobeya", value: "TOB-001" }
        )
        .setRequired(true)
    ),
    requirements: {
        character: { obtener: true, required: false },
        soul: { obtener: true, required: true },
        cachepj: { obtener: false },
    },
    isDevOnly: false,
    enMantenimiento: false,

  /**
   * @param {import('discord.js').Client} client 
   * @param {import('discord.js').ChatInputCommandInteraction} interaction 
   * @param {Object} param2 
   */
  ejecutar: async (client, interaction, { soul, character}) => {
    const areaExplorar = interaction.options.getString("region");
    const userCache = transaccionCache.getUser(interaction.user.id);

    if (userCache?.explorarID) {
      const messageData = transaccionCache.get(userCache.explorarID);
      let isValidMessage = false;

      if (messageData && messageData.message && messageData.message.channelId && messageData.message.id) {
        try {
          const getChannel = await client.channels.fetch(messageData.message.channelId);
          if (getChannel) {
            await getChannel.messages.fetch(messageData.message.id);
            isValidMessage = true;
            return interaction.reply({
              content: `Ya tienes una exploración activa ＞﹏＜\n-# [Haz click aquí para ir al mensaje](https://discord.com/channels/${messageData.message.guildId}/${messageData.message.channelId}/${messageData.message.id})`,
              flags: ["Ephemeral"]
            });
          }
        } catch (error) {
          console.log("No se pudo encontrar el mensaje activo [Exploración], limpiando caché usuario. Error:", error.code || error.message);
        }
      }

      if (!isValidMessage) {
        if (userCache?.explorarID) transaccionCache.delete(userCache.explorarID);
        transaccionCache.deleteUser(interaction.user.id);
      }
    }
    if (!soul) {
      return interaction.reply({
        content: "Tu personaje aún es muy vulnerable para explorar... Necesita despertar su poder interior",
        flags: ["Ephemeral"]
      });
    }

    const currentHP = soul.nucleo?.HP ?? soul.HP ?? 0;
    if (currentHP === 0) {
      return interaction.reply({
        content: "Te sientes muy débil para ir a explorar. =.=\n-# Recupera algo de **`HP`** usando `/rol usar_objeto [id]`",
        flags: ["Ephemeral"]
      });
    }

    // 1. Verificar primero si debe activarse el diálogo de primera exploración
    const dialogoManager = require("../../../../functions/dialogoManager");
    const charId = soul._id ?? character._id
    const triggeredFirst = await dialogoManager.checkFirstExploracion(interaction, soul, null, { areaExplorar, soul, charId });
    if (triggeredFirst) {
      return;
    }

    const region = await regiones.findOne({ _id: areaExplorar });
    if (!region) {
      return interaction.reply({ content: "Al parecer ese lugar ya no aparece en el mapa...", flags: ["Ephemeral"] });
    }

    // Recargar energía con el nuevo sistema centralizado
    const characterEnergy = await recargarEnergia(soul.nucleo?.energy ?? 0, soul);

    const components = [
      {
        "type": 10,
        "content": `# Sistema de exploración \n-# *Aventurero/a: \`${character.perfil.Nombre}\`*\n-# *Explorando:  \`${region.Nombre}\`* \n-# *Energia: ${barrasDeEnergia(characterEnergy, configServer.maxEnergy)}*`
      },
      {
        "type": 10,
        "content": "-# *¿Qué zona vamos a explorar hoy?* ( •̀ ω •́ )y"
      },
      {
        "type": 14,
        "divider": true,
        "spacing": 2
      }
    ];

    if (region.areas && typeof region.areas === 'object') {
      Object.keys(region.areas).forEach(key => {
        const area = region.areas[key];
        const isHabilitado = area.habilitado ? `(${area.energiaNecesaria} de energía)` : "[Deshabilitado]";
        let subzonasText = "";

        if (area.subzonas && Object.keys(area.subzonas).length > 0) {
          const nombresZonas = Object.values(area.subzonas).map(s => s.nombre);
          subzonasText = `-# - - *Sub-zonas: [${nombresZonas.join(", ")}]*`;
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
              "custom_id": crearCustomId({
                action: "exOp",
                userId: interaction.user.id,
                extras: ["zona", `${key}`]
              })
            },
            "components": [
              {
                "type": 10,
                "content": `-# - ***${area.Nombre}*** ${isHabilitado}\n-# ${area.descripcion ? `*${area.descripcion}*` : ""}\n${subzonasText}`
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
    }

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
        "content": "-# Tu energía se actualiza antes de iniciar una exploración. (10 min > 1 punto de energía.)"
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

    const util = require('util');
    const sleep = util.promisify(setTimeout);
    const personajes = db2.collection("Personajes");
    const updateInventario = require("../../../../functions/updateInventario");

    const inventario = character?.economia?.Inventario || [];
    const hasTalisman = inventario.some(item => Number(item.ID) === 83 || Number(item.ID) === 85);

    const transaccionId = uuidv4().replace(/-/g, "");
    let messageObj;

    if (!hasTalisman) {
      await interaction.reply({ content: "Tu Talismán anterior ya no responde. El Instituto te entrega uno nuevo antes de continuar." });
      await updateInventario(client, interaction, charId, { ID: 85, isItem: true, cantidad: 1 });
      await sleep(3000);
      await interaction.editReply({ content: null, components: v2Exploracion, flags: ["IsComponentsV2", "SuppressNotifications"] });
      const fetched = await interaction.fetchReply();
      messageObj = fetched.resource?.message || fetched;
    } else {
      const message = await interaction.reply({ components: v2Exploracion, withResponse: true, flags: ["IsComponentsV2", "SuppressNotifications"] });
      messageObj = message.resource?.message || message;
    }

    const obj = {
      regionSelect: areaExplorar,
      regionNombre: region.Nombre,
      message: messageObj,
      messageID: messageObj.id,
      characterId: charId,
      profundidad: 0,
      bloquearFaroSiguiente: true
    };

    const data = {
      explorarID: transaccionId
    };

    await transaccionCache.set(transaccionId, obj);
    await transaccionCache.setUser(interaction.user.id, data);
  }
};