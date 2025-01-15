const { prefix } = require("../config");

module.exports = async (client, message) => {
    console.log(prefix)
    console.log(client.config.prefix)
    if(!message.content.startsWith(client.config.prefix)) return;
    
    if(message.author.bot) return;

    const Discord = require(`discord.js`);
    const args = message.content.slice(client.config.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase()




    let cmd = client.comandos.get(command) || client.comandos.find(u => u.alias && u.alias.includes(command));
    if(!cmd) return;
   cmd.run(client, Discord, message, args);


    
}