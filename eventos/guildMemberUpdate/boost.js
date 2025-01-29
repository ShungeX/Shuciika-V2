const {Client} = require('discord.js')
    /**
     * 
     * @param {Client} client 
     * 
     */

module.exports = async(client, oldMember, newMember) => {
    const guild = client.guilds.cache.get("716342375303217285")
    const boosterRoleId = guild.roles.cache.find(role => role.id === '796205038665072661')?.id;





    const oldStatus = oldMember.roles.cache.has(boosterRoleId)
    const newStatus = newMember.roles.cache.has(boosterRoleId)
    const message = [`Gracias ${newMember.user} por boostear el servidor (´,,•ω•,,)♡`, `Gracias ${newMember.user} por el boost (≧◡≦)♡`, `Toca celebrar por que ${newMember.user} boosteo el servidor (≧◡≦)♡`, `${newMember.user} cayo del cielo y dejo un boost 🌠`, `${newMember.user} Aparece epicamente para dejar un boost (≧◡≦)♡`, `${newMember.user} Dejo una gema preciada en el servidor (≧◡≦)♡`]
    const respond = message[Math.floor(Math.random() * message.length)]
  
    if(!oldStatus && newStatus) {
        const channel = client.channels.cache.get("1133282192554991717")
        channel.send("✨ **Un brillo mágico ilumina el Instituto Mágico Shuciika...** ✨\n\n" + `${respond}}`)
        channel.send("https://i.pinimg.com/originals/39/4f/b1/394fb1bd8cf9e9521e74d4d23e3d8227.gif")

        newMember.send({content: `Querido/a ${newMember.user}...\n 🌟 Tu contribución es un destello de magia que no pasa desapercibido.
Como agradecimiento, invocamos en tu honor una estrella brillante en el firmamento del Shuciika, que simboliza tu valiosa aportación.\n-# Con gratitud eterna, Shuciika.`})
    }
  
    if(!newStatus && oldStatus) {
      client.channels.cache.get("1133282192554991717").send(`Alguien ha quitado un boost del server (╥﹏╥)`)
    }
}