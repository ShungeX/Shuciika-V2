require('dotenv').config();
const {Client, EmbedBuilder, ButtonStyle, AttachmentBuilder, GatewayIntentBits, Partials, ActionRowBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ButtonBuilder, ActivityType} = require(`discord.js`);
const eventHandlers = require("./handlers/eventHandler");
const {User, Message, GuildMember, ThreadMember } = Partials;
const clientdb = require("./Server.js");
const cloudinary = require("cloudinary").v2


const client = new Client({
    intents: [53608447],
    partials: [User, Message, GuildMember, ThreadMember],
  });

client.config = require(`./config.js`);


eventHandlers(client);

client.login(process.env.TOKEN_BOT).then(async () => {
  client.user.setPresence({
  status: "idle",
  activities:  [{name: `Cargando...`, type: ActivityType.Playing}],
  })
  console.log(`[Version] ${client.config.version} `)
  console.log(`[Memoria] ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB Usado`) 
  await clientdb.connect().then(() => console.log("[📋] MongoDB conectado!")) 
  
  

  const cloudname = process.env.CLOUD_NAME
  const apikey = process.env.API_KEY
  const keysecret = process.env.API_SECRET

  await cloudinary.config({
  cloud_name: cloudname, 
  api_key: apikey,
  api_secret: keysecret
})
}).catch((err) => {
 console.error("¡Tuve problemas al iniciar sesion!  -" + err)
});