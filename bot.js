require('dotenv').config();
require("./console-colors")
process.env.FORCE_COLOR = '1';
process.env.FORCE_COLOR_STDERR = '1';

// La barra de carga arranca antes de los require pesados (discord.js y Server.js tardan ~1.5 s)
const progreso = require("./utils/progresoCarga");
const entorno = require("./config/entorno");
progreso.iniciar(
  ["Módulos", "Discord", "MongoDB", "Configuración", "Catálogo", "Diálogos", "Servidor web", "Interacciones", "Comandos"],
  { alTerminar: () => `v${client.config.version} · ${entorno.etiqueta}` }
);
progreso.comenzar("Módulos");

const { Client, GatewayIntentBits, Partials, ActivityType, Options, Events } = require(`discord.js`);
const eventHandlers = require("./handlers/eventHandler");
const {User, Message, GuildMember, ThreadMember } = Partials;
const clientdb = require("./Server.js");
const cloudinary = require("cloudinary").v2
const { duelSystem } = require('./functions/Duelo/duelManager.js');
const { guild: guildPrincipal } = require("./config/configslash.json");

// Miembros que se precargan como máximo (ver precargarMiembros)
const MAX_MIEMBROS_PRECARGA = 5000;

const client = new Client({
    // Solo lo que el bot usa. Antes se pedían TODOS los intents (53608447): reacciones, voz, automod,
    // invitaciones, webhooks… Discord enviaba esos eventos sin parar sin que ningún sistema los leyera.
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageTyping,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageTyping,
      GatewayIntentBits.GuildExpressions,
    ],
    partials: [User, Message, GuildMember, ThreadMember],
    // Límites de caché: lo que no se usa no se guarda; de mensajes los últimos 100 por canal
    // (el monitor de clases los revisa), más los del propio bot (crafteos, interacciones y eventos).
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: {
        maxSize: 100,
        keepOverLimit: (message) => message.author?.id === message.client.user?.id,
      },
      ReactionManager: 0,
      ReactionUserManager: 0,
      VoiceStateManager: 0,
      StageInstanceManager: 0,
      GuildScheduledEventManager: 0,
      GuildBanManager: 0,
      GuildInviteManager: 0,
      GuildStickerManager: 0,
      AutoModerationRuleManager: 0,
    }),
    // Los mensajes en caché caducan a las 3 h (lo mismo que dura una transacción en utils/cache.js)
    sweepers: {
      ...Options.DefaultSweeperSettings,
      messages: { interval: 30 * 60, lifetime: 3 * 60 * 60 },
    },
  });

client.config = require(`./config/config.js`);

eventHandlers(client);
duelSystem.client = client


// Evita crasheos por errores generales en el código
process.on('uncaughtException', (error) => {
  console.error('⚠️ [ANTI-CRASH] Excepción no capturada:', error.stack || error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [ANTI-CRASH] Promesa rechazada no manejada:', reason);
});

//Captura los errores de red del cliente de Discord para que reconecte solo
client.on('error', (error) => {
  console.error('🔌 [CLIENTE DISCORD] Error de conexión:', error.message);
});

client.listo = false;
progreso.paso("Módulos");

// Carga en memoria los comandos, botones, menús y modales para que la primera interacción no pague
// la lectura de disco. Va después de clientReady: algunos módulos leen el gremio al cargarse.
function precargarInteracciones() {
  const comandos = require("./utils/getLocalCommands")().length;
  const botones = require("./utils/getLocalButtons")().length;
  const menus = require("./utils/getLocalSelectMenus")().length;
  const modales = require("./utils/getLocalModals")().length;
  return `${comandos} comandos, ${botones + menus + modales} componentes`;
}

// Sin el intent de presencias Discord ya no envía la lista de miembros conectados al arrancar.
// Se piden una vez (en segundo plano) para que guildMemberUpdate conozca el estado anterior de cada miembro.
function precargarMiembros() {
  const guild = client.guilds.cache.get(guildPrincipal);
  if (!guild || guild.memberCount > MAX_MIEMBROS_PRECARGA) return;
  guild.members.fetch().catch((err) => console.warn("[Miembros] No se pudo precargar la lista de miembros:", err.message));
}

async function arrancar() {
  // Discord y MongoDB se conectan a la vez; antes iban uno detrás de otro.
  const discordListo = progreso.medir("Discord", () => new Promise((resolve, reject) => {
    client.once(Events.ClientReady, () => resolve());
    client.login(entorno.token).catch(reject);
  })).then(() => {
    client.user.setPresence({
      status: "idle",
      activities: [{ name: `Cargando...`, type: ActivityType.Playing }],
    });
  });

  const mongoListo = progreso.medir("MongoDB", async () => { await clientdb.connect(); });

  // Config, catálogo, diálogos y servidor web solo dependen de MongoDB: van en paralelo.
  const datosListos = mongoListo.then(() => Promise.all([
    progreso.medir("Configuración", async () => { await client.config.cargarDesdeDB(clientdb); }),
    progreso.medir("Catálogo", async () => {
      const catalogo = await require('./functions/catalogoObjetos').cargarCatalogo(clientdb.db("Rol_db").collection("Objetos_globales"));
      return catalogo ? `${catalogo.size} regiones` : '';
    }),
    progreso.medir("Diálogos", async () => {
      const dialogoManager = require('./functions/dialogoManager');
      await dialogoManager.cargarDialogosDesdeDB(clientdb);
      return `${dialogoManager.dbDialogues.size} eventos`;
    }),
    progreso.medir("Servidor web", async () => `puerto ${await clientdb.iniciarServidorWeb()}`),
  ]));

  await Promise.all([discordListo, datosListos]);
  clientdb.setDiscordClient(client)

  cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
  })

  await progreso.medir("Interacciones", precargarInteracciones);

  client.listo = true
  client.emit("cargaCompleta")
  // Apertura: aviso de 1 hora, diálogos de servidor programados y reanudar cartas
  require('./functions/Apertura/apertura').iniciar(client, clientdb);
  precargarMiembros();
}

arrancar().catch((err) => {
  console.error("¡Tuve problemas al iniciar! -", err)
  progreso.finalizar();
});


module.exports = client
