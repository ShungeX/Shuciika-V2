const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const cloudinary = require("cloudinary").v2
const Discord = require("discord.js")
const db = clientdb.db("rol_db")
var intervalo = require("../../../activbd")

     /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */


module.exports = async(client, interaction) => {
    const db = clientdb.db("Rol_db")
    const climadb = db.collection("Clima_Hora")
    const idb = clientdb.db("img_clima")
    const imgdb = idb.collection("soleadoC")
    const nubdb = idb.collection("nubladoC")

    const timedb = await climadb.findOne({_id: interaction.guild.id})


    const channel = await interaction.guild.channels.cache.get("717140034834268162");
    const clima = interaction.options.getString('clima') || (timedb?.climaActual ?? null);
    const temp = interaction.options.getInteger('temperatura') || (timedb?.temperatura ?? 20);
    const interactionchannel = interaction.channel

    let hora = interaction.options.getInteger('hora') || (timedb?.hora ?? 0);
    let minutos = interaction.options.getInteger("minutos") || (timedb?.minutos ?? 0);

    var t = ""
    var timetext = ""
    var climactual = clima
    var imglink = ""
    var hcorrect = ""
    var mcorrect = ""

    if(intervalo) {

      setTimeout(() => interaction.deleteReply(), 5000 ) 
      return interaction.reply("¡Ya hay un comando de clima activo!. Deten el comando anterior para iniciar otro <( . . )>")
    }

    if(!timedb) {
      await climadb.insertMany([{
        dia: 0,
        mes: 0,
        hora: 6,
        minutos: 0,
        timeactu: 0,
        climaActual: "",
        estacion: "Invierno",
        temperatura: 20,
        _id: interaction.guild.id
    }])
    }

    
    const matrizTransicion = {
      "Soleado": {"Soleado": 0.6, "Caluroso": 0.2, "Ventoso": 0.1, "Nublado": 0.1, "Lluvioso": 0, "Granizada": 0, "Tormenta": 0, "Nevada": 0},
      // Caluroso
      "Caluroso": {"Soleado": 0.5, "Caluroso": 0.2, "Ventoso": 0.2, "Nublado": 0.1, "Lluvioso": 0, "Granizada": 0, "Tormenta": 0, "Nevada": 0},
      // Ventoso
      "Ventoso": {"Soleado":0.4, "Caluroso": 0, "Ventoso": 0.2, "Nublado": 0.4, "Lluvioso": 0, "Granizada": 0, "Tormenta": 0, "Nevada": 0},
      // Nublado
      "Nublado": {"Soleado":0.2, "Caluroso": 0, "Ventoso": 0.3, "Nublado": 0.2, "Lluvioso": 0.2, "Granizada": 0.05, "Tormenta": 0.05, "Nevada": 0},
      // Lluvioso
      "Lluvioso": {"Soleado":0, "Caluroso": 0, "Ventoso": 0.1, "Nublado": 0.3, "Lluvioso": 0.4, "Granizada": 0.1, "Tormenta": 0.1, "Nevada": 0},
      // Granizada
      "Granizada": {"Soleado":0, "Caluroso": 0, "Ventoso": 0.1, "Nublado": 0.1, "Lluvioso": 0.2, "Granizada": 0.3, "Tormenta": 0.2, "Nevada":0},
      // Tormenta
     "Tormenta": {"Soleado":0, "Caluroso": 0, "Ventoso": 0, "Nublado": 0.2,  "Lluvioso": 0.3, "Granizada": 0.2, "Tormenta": 0.3, "Nevada": 0},
       // Nevada
      "Nevada": {"Soleado":0, "Caluroso": 0, "Ventoso": 0, "Nublado": 0.3,  "Lluvioso": 0.1,  "Granizada": 0.2, "Tormenta": 0, "Nevada": 0.4}
    }

    if(!clima) {
      climactual = "Soleado"
      await obtenerclima()
    }



  async function getinfo() {
            //Noche (19hrs)
            if(hora >= 19) {
              timetext = "Noche"
            }else if(hora >= 18) { //Atardecer (18hrs)
              timetext = "Atardecer"
            }else if(hora >= 12) {
              timetext = "Tarde"
            }else if(hora >= 7) {
              timetext = "Día"
            }else if(hora >= 6) { //Amanecer (6hrs)
              timetext = "Amanecer"
            }else if(hora >= 0) {
              timetext = "Madrugada"
            }

            if(hora >= 18 || hora <= 5) {
              t = "Noche"
            }else if(hora >= 6) {
              t = "Día"
            }

           const { resources } = await cloudinary.search.expression(`folder:Rol/Clima/${t}/${climactual}/${timetext}`)
           .sort_by("public_id", "desc")
           .execute()
           const random = Math.floor(Math.random() * resources.length);
           imglink = resources[random]
  }









  async function obtenerclima() {
console.log("Clima Actual:", climactual)
const probabilidad = matrizTransicion[climactual]
console.log(probabilidad)
const random = Math.random();
let acumulado = 0;

for (const [climate, probability] of Object.entries(probabilidad)) {
    acumulado += probability;
    if (random <= acumulado) {
        climactual = climate
        await climadb.updateMany({_id: interaction.guild.id}, {
          $set: {climaActual: climactual} 
        })
        await getinfo()
        return climate;
    }
}



return climate; // Por seguridad, mantener el clima actual si algo falla
}
  async function selecttexto(clima, time) {
const weatherInfo = {
    "Soleado": {
      "Amanecer": {
        text: "Es un amanecer hermoso...",
        descrip: [
         "El sol asoma suavemente por el horizonte.",
         "Que tal si hacemos algo interesante hoy.",
         "¡Despierta!",
         "Al parecer hoy hara un bonito dia",
         "¿Sigues dormido/a?",
         "La alarma sonara pronto",
        ],
        color: "#f3c471",
      },
      "Día": {
        text: "Es de mañana en Tobeya",
        descrip: [
        "Es un dia hermoso", "Dia perfecto para cosas perfectas", "Deberias salir a que te den los primeros rayos de sol", "¡A desayunar!", "Vamos, hay que hacer ejercicio", "Dudo que llueva mas tarde", "El sol es hermoso"
        ],
        color: "f7de3f"
      },
      "Tarde": {
        text: "Es de tarde en Tobeya",
        descrip: [
        "Es una hermosa tarde", "Al parecer... hace bastante calor", "¿Salimos hoy?", "Al parecer todo va bien", "Cielos despejados"
        ],
        color: "#e59f09"
      },
      "Atardecer": {
        text: "Esta atardeciendo en Tobeya",
        descrip: [
       "Hace un hermoso atardecer", "Deberiamos mirar el atardecer", "Pronto anochecera", "Me gustan los atardeceres"
        ],
        
        color: "#fb6316"
      },
      "Noche": {
        text: "Es de noche en Tobeya",
        descrip: [
        "Deberias tener cuidado", "¿Compramos algo de cenar?", "Deberias cenar algo", "A dormir", "Que buen dia", "Cielos estrellados", "Podemos observar la luna", "Deberias mirar la luna", "Me da miedo la oscuridad..."
        ],
        
        color: "#fb6316"
      },
      "Madrugada": {
        text: "Es de madrugada en Tobeya.",
        descrip: [
        "Esta tranquila la madrugada...", "zzz...", "¿Que haces despierto a esta hora?", "El que madruga al mago ayuda", "Es de madrugada, ¿que esperas?", "Ve a dormir", "#Miedo"
        ],
        
        color: "#614327"
      },
    },
    "Nublado": {
      "Amanecer": {
        text: "Es un amanecer nublado en Tobeya.",
        descrip: ["Oh... Puede que llueva el dia de hoy", "de preferencia lleva un paraguas para cualquier cosa", "Las nubes no dejan ver el hermoso amanecer"],
        
        color: "#201000",
      },
      "Día": {
        text: "Es una mañana nublada en Tobeya.",
        descrip: ["Tal vez... no sea adecuado lavar hoy", "Si vas a salir lleva un paraguas", "¿Y si mejor nos quedamos en casa?", "Asi no dan ganas de hacer nada", "..."],
        
        color: "#201000"
      },
      "Tarde": {
        text: "Es una tarde nublada en Tobeya.",
        descrip: ["¿Metiste la ropa?", "Las nubes cubren el azul del cielo", "Parece que va a llover...", "El cielo se esta nublando", "Ay ma... Espera ese no es el texto"],
        
        color: "#422203"
      },
      "Atardecer": {
        text: "Es un atardecer nublado en Tobeya.",
        descrip: ["Esta vez no es posible observar el atardecer...", "Las nubles cubren el atardecer de hoy", "Es posible que llueva para la noche"],
        
        color: "#915c28"
      },
      "Noche": {
        text: "Es una noche nublada en Tobeya.",
        descrip: ["Espero no llueva en la madrugada", "Dudo que salgas a esta hora", "La ropa de nuevo..."],
        
        color: "#111111"
      },
      "Madrugada": {
        text: "Es de madrugada y esta nublado en Tobeya.",
        descrip: [
        "zzz...", "¿Que haces despierto a esta hora?", "El que madruga al mago ayuda", "#Miedo"
        ],
        
        color: "#1a1a19"
      },
    },
    "Lluvioso": {
      "Amanecer": {
        text: "Amanecio lloviendo en Tobeya.",
        descrip: ["Al parecer hoy amanecio lloviendo", "Deberiamos quedarnos mas tarde en cama"],
        
        color: "#6a8ba9",
      },
      "Día": {
        text: "Es una mañana lluviosa en Tobeya.",
        descrip: ["Al parecer esta lloviendo bastante...", "Procura no mojarte, te puedes enfermar", "Recuerda llevar un paraguas para no mojarte", '"¿Salimos a correr bajo la lluvia?"', "Ten cuidado con los charcos de agua", "Ehm... ¿deberias salir si esta lloviendo?", "¿Y-y la ropa?"],
        
        color: "#6a8ba9"
      },
      "Tarde": {
        text: "Es una tarde lluviosa en Tobeya.",
        descrip: [
        "Es una hermosa tarde", "Al parecer... hace bastante calor", "¿Salimos hoy?", "Al parecer todo va bien", "Cielos despejados"
        ],
        
        color:"#6a8ba9"
      },
      "Atardecer": {
        text: "Es un atardecer lluvioso en Tobeya.",
        descrip: ["La lluvia no deja ver el atardecer"],
        
        color: "#6a8ba9"
      },
      "Noche": {
        text: "Es una noche lluviosa en Tobeya",
        descrip: ["Puedes oir las gotas de lluvia caer", ""],
        
        color: "#6a8ba9"
      },
      "Madrugada": {
        text: "Es una madrugada lluviosa.",
        descrip: ["A estas horas se pueden escuchar como caen las gotas"],
        
        color: "#6a8ba9"
      },
    },
    "Tormenta": {
      "Amanecer": {
        text: "Amanecio con tormenta en Tobeya",
        descrip: ["Truenos y relámpagos anuncian un amanecer tormentoso.", "El cielo se ilumina con relámpagos."],
        
        color: "#1a0101",
      },
      "Día": {
        text: "",
        descrip: ["El día es oscuro y la tormenta continúa.", "El viento y la lluvia golpean con fuerza."],
        
        color: "#1a0101"
      },
      "Tarde": {
        text: "",
        descrip: ["La tarde se siente peligrosa con esta tormenta.", "Los relámpagos no paran de iluminar el cielo."],
        
        color: "#1a0101"
      },
      "Atardecer": {
        text: "",
        descrip: ["Hoy no se vera el sol..."
        ],
        
        color: "#1a0101"
      },
      "Noche": {
        text: "",
        descrip: ["La tormenta arrecia durante la noche.", "Truenos rompen el silencio de la noche."],
        
        color: "#1a0101"
      },
      "Madrugada": {
        text: "",
        descrip: ["¿Puedes dormir con todo ese ruido?"],
        color: "#1a0101"
      },
    }
  };

    const data = weatherInfo[clima]?.[time]


    if(!data) {
      return {
        text: "(¿?)",
        descrip: "Informacion no disponible",
        img: "https://media1.tenor.com/m/ryqRI04AQtMAAAAC/%D8%B3%D8%A4%D8%A7%D9%84-%D8%B3%D8%A4%D8%A7%D9%84-%D9%88%D8%AC%D9%88%D8%A7%D8%A8.gif",
        color: "#000000"
      };
    }

    const descripcion = data.descrip[Math.floor(Math.random()* data.descrip.length)]
    const img = imglink?.secure_url ??"https://media1.tenor.com/m/ryqRI04AQtMAAAAC/%D8%B3%D8%A4%D8%A7%D9%84-%D8%B3%D8%A4%D8%A7%D9%84-%D9%88%D8%AC%D9%88%D8%A7%D8%A8.gif"

    return {
      text: data.text,
      descrip: descripcion,
      img: img, 
      color: data.color
  }
}






//Resultado final (embed)
    await getinfo()
    const info = await selecttexto(climactual, timetext)
    console.log(`Texto fijo: ${info.text}`);
    console.log(`Descripción: ${info.descrip}`);
    console.log(`Imagen: ${info.img}`);
    console.log(`Color: ${info.color}`);

    
    hcorrect = hora < 10 ? `0${hora}`: `${hora}` 
    mcorrect = minutos < 10 ? `0${minutos}`: `${minutos}`

    const clima1 = new EmbedBuilder() 
    .setTitle("Informacion del clima | Ciudad Tobeya")
    .setDescription(`${info.text}. \n-# ${info.descrip}`)
    .addFields(
        { name: "`🗓️` Día", value: "0", inline: true },
        { name: "`⌚` Hora", value: `${hcorrect}:${mcorrect}`, inline: true },
        { name: "`🌤️` Tiempo", value: `${climactual}`, inline: true},
        { name: "`🌡️` temperatura", value: `${temp}`, inline: true},
    )
    .setImage(info.img)
    .setColor(`${info.color}`)
    .setFooter({ text: "El tiempo se actualiza cada 30 minutos in rol (Beta)"})

    const msg = await channel.send({embeds: [clima1]})
    .catch(e => {
      interaction.editReply("Tuve un error al intentar enviar el embed ☆⌒(>。<)")
    })

    await climadb.updateOne({_id: interaction.guild.id}, {
      $set: {hora: hora}
    })
    await interaction.reply({ content: "He enviado el mensaje al canal correspondiente" + ` ${msg.channel}`})
    
    await actualizarClima()



async function actualizarClima() {
intervalo = setInterval(async () => {

minutos ++
if(minutos % 15 === 0) {
  await climadb.updateOne({_id: interaction.guild.id}, 
    {$set: {minutos: minutos}}
  )

}

if(minutos % 30 === 0) {
  await obtenerclima()
  await selecttexto(climactual, timetext)
}

if(minutos >= 60) {
  minutos = 0

  
  await climadb.updateOne({_id: interaction.guild.id}, {
    $inc: {hora: +1}, $set: {minutos: 0}
  })
  
}

hora = await climadb.findOne({_id: interaction.guild.id})

if(hora.hora >= 24) {
  await climadb.updateOne({_id: interaction.guild.id}, {
    $set: {hora: 0}
  })
  minutos = 0
  
  const end = new EmbedBuilder()
  .setTitle("El día ha acabado / Resultados del día")
  .setDescription(`A continuacion se muestran que valores se quedaran para el proximo día`)
  .addFields(
    { name: "`🗓️` Día", value: `${timedb.dia}`, inline: true },
    { name: "`⌚` Hora", value: `${hcorrect}:${mcorrect}`, inline: true },
    { name: "`🌤️` Tiempo", value: `${climactual}`, inline: true},
    { name: "`🌡️` temperatura", value: `${temp}`, inline: true},
  )
  .setImage("https://media1.tenor.com/m/Cj0YvuE94eoAAAAd/onimai-anime-sleep.gif")
  .setColor(`${info.color}`)
  .setFooter({ text: "Un administrador tiene que iniciar otro día"})
  msg.edit({embeds: [end]}).catch(e => {
    channel.send({embeds: [end]})
  })

  clearInterval(intervalo) 
  intervalo = null
  return
}


     hcorrect = hora.hora < 10 ? `0${hora.hora}`: `${hora.hora}` 
     mcorrect = minutos < 10 ? `0${minutos}`: `${minutos}`


const embedtime = new EmbedBuilder()
.setTitle("Informacion del clima | Ciudad Tobeya")
.setDescription(`${info.text}. \n-# ${info.descrip}`)
.addFields(
    { name: "`🗓️` Día", value: `${timedb.dia}`, inline: true },
    { name: "`⌚` Hora", value: `${hcorrect}:${mcorrect}`, inline: true },
    { name: "`🌤️` Tiempo", value: `${climactual}`, inline: true},
    { name: "`🌡️` temperatura", value: `${temp}`, inline: true},
)
.setImage(info.img)
.setColor(`${info.color}`)
.setFooter({ text: "El tiempo se actualiza cada 30 minutos in rol (Beta)"})

msg.edit({embeds: [embedtime]}).catch(e => {
  console.log("El mensaje de clima fue borrado")
  interactionchannel.send({ content: "¡Hey, no borres el mensaje por que asi no puedo editarlo! ｡ﾟ･ (>﹏<) ･ﾟ｡ \n-# El comando **`clima`** se ha detenido"})
  clearInterval(intervalo)
  intervalo = null
})

await eventscanal()
}, 8000) //Actualiza el intervalo cada 8 segundos
}

async function eventscanal() {
const everuser = interaction.guild.roles.cache.find(aus => aus.name === '@everyone');
const audiochannel = interaction.guild.channels.cache.get("976719553943965726")
const sendcerrado = interaction.guild.channels.cache.get("717140034834268162")
const entradas = ["1197248829288894495", "1197248899467976884", "1340430809710203012"] //Pasillo y canal de entrada
const ciudadAC = client.channels.cache.get("976971589109309450")


const inreceso = [
"1197249012756131870", //SalonB1
"1197249036508467200", //SalonB2
"838796633356501053", //SalonA1
"1197249241505075291", //Biblioteca
]
const outreceso = [
"813862405163581521", //SalonProfesores
"1197249316461477989", //Azotea 1
"1197249269795659866", //Patio
"995113872971268206", //Gimnacio
"1319809705996189807", //Comedor
]

const arrayChannelSc = [
"813862746202177536", //Baño H
"813862815202803712", //Baño M
]

const arrayChannelCt = [
"1197249820067373146", //Parque
"1197249723820671027", //Centro
"1197249862127865907", //E. Policia
"1197249937537241239", //Cafeteria
"1197249970143768576" //Restaurante Iny
]


try {
//Abren la puertas (6:30)
if(hora.hora === 6 && minutos === 30) {
for(const canalId of entradas) {
const channel = await interaction.guild.channels.cache.get(canalId)

  if(!channel) {
  console.log(`No se encontro el canal con el id ${canalId}`)
  continue
  }

 

  await channel.permissionOverwrites.edit(everuser, {
    SendMessages: true
  })
}
const EMabierto = new EmbedBuilder() 
.setTitle("🚪 Las puertas de la escuela se han abierto")
.setDescription(`Puedes escribir ahora en los siguientes canales: \n <#1197248829288894495> -- <#1197248899467976884> -- <#1340430809710203012> \n \n **¡Espera mientras llegan los profesores para entrar a demas areas!**`)
.setColor("Green")
.setFooter({text: "La entrada a la escuela cierra a las 7:30"})
sendcerrado.send({content: `<@&727341415582924812>`,embeds: [EMabierto]}).then(m => setTimeout(() => m.delete(), 60000))
audiochannel.edit({name: "[🔓] Escuela Abierta"})
}

//Inician las clases (7:30)
if(hora.hora === 7 && minutos === 30) {
 //Se abren los salones
for(const CanalId of inreceso) {
  const channel = await interaction.guild.channels.cache.get(CanalId)

  if(!channel) {
    console.log(`No se encontro el canal con el ID: ${CanalId}`)
    continue
  }

  await channel.permissionOverwrites.edit(everuser, {
    SendMessages: true
  })


}

//Se cierran las puertas de la escuela
for(const canalId of entradas) {
  const channel = await interaction.guild.channels.cache.get(canalId)

  await channel.permissionOverwrites.edit(everuser, {
    SendMessages: false
  })
}

const embedC = new EmbedBuilder()
.setTitle("⏰ ¡Las clases han iniciado!")
.setDescription("- Los alumnos ya pueden ingresar a sus salones correspondientes \n" +
"- La entrada se ha cerrado. Lo sentimos por los que se quedaron afuera. \n" + "- Las areas de azotea y patio estan cerradas hasta receso.\n" +
"- La Biblioteca se ha abierto. Si necesitas un libro accede a ella.")
.setColor("Green")
.setFooter({text: "El receso comienza a las 10:00"})
sendcerrado.send({content: "<@&727341415582924812>", embeds: [embedC]}).then(m => setTimeout(() => m.delete(), 60000))
}

//Inicia el receso (10:00)
if(hora.hora === 10 && minutos < 1) {
for(const canalId of outreceso) {
const channel = await interaction.guild.channels.cache.get(canalId)

  if(!channel) {
  console.log(`No se encontro el canal con el id ${canalId}`)
  continue
  }
  await channel.permissionOverwrites.edit(everuser, {
    SendMessages: true
  })
}

for(const CanalId of inreceso) {
const channel = await interaction.guild.channels.cache.get(CanalId)

if(!channel) {
  console.log(`No se encontro el canal con el ID: ${CanalId}`)
  continue
}

await channel.permissionOverwrites.edit(everuser, {
  SendMessages: false
})
}


const recesoemb = new EmbedBuilder()
.setTitle("🏃🏻‍♂️ Es hora del receso")
.setDescription("- Aprovecha para respirar y consumir tus alimentos 🍚\n- Todos los `salones` se han cerrado por seguridad")
.setFooter({text: "El receso acaba a las 11:00am"})
.setColor("Green")
sendcerrado.send({content: `<@&727341415582924812>`, embeds: [recesoemb]}).then(m => setTimeout(() => m.delete(), 60000))
}

//Acaba el receso (11:00)
if(hora.hora === 11 && minutos < 1) {
for(const canalId of outreceso) {
const channel = await interaction.guild.channels.cache.get(canalId)

  if(!channel) {
  console.log(`No se encontro el canal con el id ${canalId}`)
  continue
  }
  await channel.permissionOverwrites.edit(everuser, {
    SendMessages: false
  })
}

for(const CanalId of inreceso) {
const channel = await interaction.guild.channels.cache.get(CanalId)

if(!channel) {
  console.log(`No se encontro el canal con el ID: ${CanalId}`)
  continue
}

await channel.permissionOverwrites.edit(everuser, {
  SendMessages: true
})
}


const recesoend = new EmbedBuilder()
.setTitle("⏰ El receso ha terminado")
.setDescription("- Todos los alumnos deberan regresar a sus salones correspondientes. \n- Recuerden no ingresar con alimentos a los salones")
.setFooter({text: "La hora de salida es a las 1:00pm"})
.setColor("Red")
sendcerrado.send({content: `<@&727341415582924812>`, embeds: [recesoend]}).then(m => setTimeout(() => m.delete(), 60000))
}

//Acaban las clases (13:00)
if(hora.hora === 13 && minutos < 1) {
for(const CanalId of inreceso) {
const channel = await interaction.guild.channels.cache.get(CanalId)

if(!channel) {
  console.log(`[School] No se encontro el canal con el ID: ${CanalId}`)
  continue
}

await channel.permissionOverwrites.edit(everuser, {
  SendMessages: false
})
}

for(const canalId of arrayChannelCt) {
const channel = await interaction.guild.channels.cache.get(canalId)

if(!channel) {
  console.log(`[Ciudad] No se encontro el canal con el ID: ${canalId}`)
  continue
}

await channel.permissionOverwrites.edit(everuser, {
  SendMessages: true
})
}

const escuelalock = new EmbedBuilder()
.setTitle("⏰ Se acabaron las horas de clase")
.setDescription("- Se han acabado las clases\n- La ciudad se ha abierto.")
.setFooter({text: "..."})
.setColor("Green")
sendcerrado.send({content: `<@&727341415582924812>`, embeds: [escuelalock]}).then(m => setTimeout(() => m.delete(), 60000))

audiochannel.edit({
name: "[🔐] Escuela Cerrada"
}).then(console.log("Audio Clima: //Cambie correctamente el nombre")).catch(e => {
console.log(e)
})

ciudadAC.edit({
name: "[🔓] Ciudad Abierta"
}).then(console.log("Audio Clima: //Cambie correctamente el nombre del canal Ciudad")).catch(e => {
console.log(e)
})
}

if(hora.hora === 23 && minutos === 30) {
for(const canalId of arrayChannelCt) {
const channel = await interaction.guild.channels.cache.get(canalId)

if(!channel) {
  console.log(`[Ciudad] No se encontro el canal con el ID: ${canalId}`)
  continue
}

await channel.permissionOverwrites.edit(everuser, {
  SendMessages: false
})

ciudadAC.edit({
  name: "[🔓] Ciudad Cerrada"
}).then(console.log("Audio Clima: //Cambie correctamente el nombre del canal Ciudad")).catch(e => {
  console.log(e)
})
}


const escuelalock = new EmbedBuilder()
.setTitle("⏰ Todos los locales de la ciudad han cerrado...")
.setDescription("- La noche oscurece todo a su alrededor.\n- La ciudad se ha cerrado.")
.setFooter({text: "..."})
.setColor("Red")
sendcerrado.send({embeds: [escuelalock]}).then(m => setTimeout(() => m.delete(), 60000))



}

}catch(e) {
console.log(e)
}
}


}