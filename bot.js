require('dotenv').config();
require("./console-colors")
const {Client, EmbedBuilder, ButtonStyle, AttachmentBuilder, GatewayIntentBits, Partials, ActionRowBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ButtonBuilder, ActivityType} = require(`discord.js`);
const eventHandlers = require("./handlers/eventHandler");
const {User, Message, GuildMember, ThreadMember } = Partials;
const clientdb = require("./Server.js");
const cloudinary = require("cloudinary").v2
const { duelSystem } = require('./functions/Duelo/duelManager.js');
process.env.FORCE_COLOR = '1';
process.env.FORCE_COLOR_STDERR = '1';


const client = new Client({
    intents: [53608447],
    partials: [User, Message, GuildMember, ThreadMember],
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

client.login(process.env.TOKEN_BOT).then(async () => {
  client.user.setPresence({
  status: "idle",
  activities:  [{name: `Cargando...`, type: ActivityType.Playing}],
  })
  console.log(`[Version] ${client.config.version} `)
  console.log(`[Memoria] ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB Usado`) 
  console.log(`----------Cargando...-------------`)
  await clientdb.connect().then(() => console.log("📋 MongoDB conectado!")) 
  await client.config.cargarDesdeDB(clientdb);
  const catalogoObjetos = require('./functions/catalogoObjetos');
  await catalogoObjetos.cargarCatalogo(clientdb.db("Rol_db").collection("Objetos_globales"));
  const dialogoManager = require('./functions/dialogoManager');
  await dialogoManager.cargarDialogosDesdeDB(clientdb);
  await clientdb.iniciarServidorWeb();
  await clientdb.setDiscordClient(client)
  

  const cloudname = process.env.CLOUD_NAME
  const apikey = process.env.API_KEY
  const keysecret = process.env.API_SECRET

  await cloudinary.config({
  cloud_name: cloudname, 
  api_key: apikey,
  api_secret: keysecret
  })
  client.listo = true
  client.emit("cargaCompleta")
  console.log("--------Bot cargado correctamente (✿◡‿◡)-------------")
}).catch((err) => {
 console.error("¡Tuve problemas al iniciar sesion!  -", err)
});


module.exports = client 