const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const soul = db2.collection("Soul")
const util = require(`util`);
const sleep = util.promisify(setTimeout)
const version = require("../../../config")
const magicSpell = db2.collection("Hechizos_globales")

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = {
    customId: "despertarOptions",
    selectAutor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction, character, nan, nan2, nan3, extras) => {
        const userf = await Cachedb.findOne({_id: interaction.user.id})
        const souls = await soul.findOne({_id: interaction.user.id})
        const [pregunta, respuesta] = extras.split("*")

        console.log(pregunta)

        const respuestas = {
            A: {valor: 0, corrupcion: 0, pecado: 5},
            B: {valor: 0, corrupcion: 5, pecado: 0},
            C: {valor: 5, corrupcion: 0, pecado: 0},
            

            A1: {valor: 0, corrupcion: 0, pecado: 5},
            B1: {valor: 0, corrupcion: 5, pecado: 0},
            C1: {valor: 5, corrupcion: 0, pecado: 0},
            
            A2: {valor: 5, corrupcion: 0, pecado: 0},
            B2: {valor: 0, corrupcion: 0, pecado: 5},
            C2: {valor: 0, corrupcion: 5, pecado: 0},

            A3: {valor: 3, corrupcion: 0, pecado: 0},
            B3: {valor: 0, corrupcion: 0, pecado: 3},
            C3: {valor: 0, corrupcion: 5, pecado: 0},

            A4: {valor: 0, corrupcion: 0, pecado: 7},
            B4: {valor: 7, corrupcion: 0, pecado: 0},
            C4: {valor: 0, corrupcion: 7, pecado: 0},

            A5: {valor: 0, corrupcion: 0, pecado: 4},
            B5: {valor: 0, corrupcion: 3, pecado: 0},
            C5: {valor: 4, corrupcion: 0, pecado: 0},

            A5: {valor: 0, corrupcion: 0, pecado: 4},
            B5: {valor: 0, corrupcion: 3, pecado: 0},
            C5: {valor: 4, corrupcion: 0, pecado: 0},

            A6: {valor: 0, corrupcion: 0, pecado: 4},
            B6: {valor: 4, corrupcion: 0, pecado: 0},
            C6: {valor: 0, corrupcion: 4, pecado: 0},

            A7: {valor: 6, corrupcion: 0, pecado: 0},
            B7: {valor: 3, corrupcion: 3, pecado: 3},
            C7: {valor: 0, corrupcion: 0, pecado: 6},
            D7: {valor: 0, corrupcion: 10, pecado: 0},
        }

        if(userf) {
            return interaction.reply({ content: "Tu personaje aun esta siendo verificado. Espera a que un moderador lo apruebe", ephemeral: true})
        }
        
        if(!character) {
            return interaction.reply({ content: "No puedes despertar un personaje que no existe\n Si crees que se trata de un error contacta con administracion."})
        }

        if(souls?.isFinish === true) {
            return interaction.reply({content: "Una estrella guarda aquello que resuena en tu alma.", ephemeral: true})
        }

        const md = await interaction.user.createDM()


        const message = await md.messages?.cache.get(souls?.messageTemp)

        if(!message) {
            return interaction.reply({content: "Esta interaccion no esta disponible. Intenta usar nuevamente el comando", ephemeral: true})
        }

        await asignarValor()
        await preguntas()

       

        async function asignarValor() {
            const data = respuestas[respuesta]

            if(data) {
                await soul.updateOne({_id: interaction.user.id}, {
                    $inc: {
                        Virtud: data.valor,
                        Corrupcion: data.corrupcion,
                        Pecado: data.pecado
                    }
                })
            }else if(pregunta === "Rf") {

                if(respuesta === "Crf") {
                    const random = Math.floor(Math.random() * 100)
                    
                    if(random <= 49) {
                        await soul.updateOne({_id: interaction.user.id}, 
                            {
                                $set: {
                                    artefactoMagico: true
                                }
                            }
                        )
                    }else {
                        await soul.updateOne({_id: interaction.user.id}, 
                            {
                                $set: {
                                    artefactoMagico: false
                                }
                            }
                        )
                    }
                }

                if(respuesta === "Arf") {
                    await soul.updateOne({_id: interaction.user.id}, 
                        {
                            $set: {
                                artefactoMagico: false
                            }
                        }
                    )
                }

                if(respuesta === "Brf") {
                    await soul.updateOne({_id: interaction.user.id}, 
                        {
                            $set: {
                                artefactoMagico: true
                            }
                        }
                    )
                }


                var valores = {
                    Valor: souls.Virtud,
                    Corrupcion: souls.Corrupcion,
                    Pecado: souls.Pecado,
                }

                if(!valores) {
                    return interaction.reply({content: "No se ha podido asignar los valores a tu personaje, intenta nuevamente. Si el error persiste contacta con administracion", ephemeral: true})
                }

                const maxAttribute = Object.entries(valores).reduce((max, current) =>  (current[1] > max[1]) ? current : max);

                const resultados = {
                    'Valor': {
                        title: "Tu personaje tiene algo especial, quizás es su bondad o valentia.",
                        description: "-# Tu personaje es un `Virtuoso`",
                    },
                    'Pecado': {
                        title: "Tu personaje tiene algo especial, quizás es la fuerza de cargar con sus pecados",
                        description: "-# Tu personaje es un `Pecador`"
                    },
                    'Corrupcion': {
                        title: "Dicen que los personajes son el reflejo de sus creadores. Quizás esto sea un reflejo de ti...",
                        description: "-# Tu personaje tiene `Corrupción`"
                    }
                }

                const maxValue = maxAttribute[1]
                const messages = resultados[maxAttribute[0]]

                const ties = Object.entries(valores).filter(([key, value]) => value === maxValue);


                if(ties.length > 1) { 
                    interaction.reply({content: "Tu personaje esta en equilibrio\n-# No obtuviste ninguna bendición o maldición"}).then(m => setTimeout(() => m.delete(), 10000))
                }else {
                    console.log(maxAttribute)
                    interaction.reply({content: `${messages.title}\n${messages.description}`}).then(m => setTimeout(() => m.delete(), 10000))
                }

            }else if(pregunta === "Rf2") {

                const element = {
                    Pyro: "Pyró",
                    Aqua: "Aqua",
                    Lapis: "Lapis",
                    Rakau: "Rakau",
                    Electro: "Electro",
                    Kryo: "Krýo",
                    Wind: "Wind",
                    Lux: "Lux",
                }

                const elementName = element[respuesta]

                if(!elementName) {
                    return interaction.reply({content: "No se ha podido asignar el elemento a tu personaje, intenta nuevamente. Si el error persiste contacta con administracion", ephemeral: true})
                }

                await soul.updateOne({_id: interaction.user.id}, {
                    $set: {
                        Elemento: elementName
                    }
                })

                message.edit({components: []})

                interaction.reply({content: `Tu personaje ha sido bendecido por el éon de la creacion. Ahora posee el elemento **${elementName}**`, ephemeral: true})

                await sleep(5000)

                endDialogo()

            }


        }

        async function preguntas() {

            if(pregunta === "R1") {
                const embed = new EmbedBuilder()
                .setAuthor({name: "Tu, solo tu.", iconURL: interaction.user.displayAvatarURL({dynamic: true})})
                .setTitle("Elige el destino de tu personaje")
                .setDescription("Un bosque sagrado está siendo devorado por la oscuridad. ¿Cómo actúas?")
                .setColor("NotQuiteBlack")
    
                const select = new StringSelectMenuBuilder()
                .setCustomId(`despertarOptions-${interaction.user.id}`)
                .setMaxValues(1)
                .setPlaceholder("Elige tu respuesta...")
                .addOptions([
                    {
                        label: "A) Purifico las raíces con Lux, aunque me debilite",
                        value: `R2*A2`,
    
                    },
                    {
                        label: "B) Dejo que el árbol crezca. El poder nuevo merece existir",
                        value: `R2*B2`,
                        
                    },
                    {
                        label: "C) Negocio con los seres kurayami para equilibrarlo",
                        value: `R2*C2`,
                        
                    },
            ])
    
            const row = new ActionRowBuilder() 
            .addComponents(select)
    
            interaction.reply({content: `Has seleccionado la respuesta ${respuesta}`, ephemeral: true})
            message.edit({content: " ", components: [row], embeds: [embed]})
            }

            if(pregunta === "R2") {
                const embed = new EmbedBuilder()
                .setAuthor({name: "Tu, solo tu.", iconURL: interaction.user.displayAvatarURL({dynamic: true})})
                .setTitle("Elige el destino de tu personaje")
                .setDescription("Cuando la oscuridad consuma todo a su alrededor y la luz titule en su último aliento, ¿que harás?")
                .setColor("NotQuiteBlack")
    
                const select = new StringSelectMenuBuilder()
                .setCustomId(`despertarOptions-${interaction.user.id}`)
                .setMaxValues(1)
                .setPlaceholder("Elige tu respuesta...")
                .addOptions([
                    {
                        label: "A) Extendere mi mano para proteger la luz",
                        value: `R3*A3`,
    
                    },
                    {
                        label: "B) La oscuridad realizara su trabajo. No todo necesita salvacion",
                        value: `R3*B3`,
                        
                    },
                    {
                        label: "C) No me importa solo quiero poder",
                        value: `R3*C3`,
                        
                    },
            ])
    
            const row = new ActionRowBuilder() 
            .addComponents(select)
            interaction.reply({content: `Has seleccionado la respuesta ${respuesta}`, ephemeral: true})
            message.edit({components: [row], embeds: [embed]})
            }

            if(pregunta === "R3") {
                const embed = new EmbedBuilder()
                .setAuthor({name: "Tu, solo tu.", iconURL: interaction.user.displayAvatarURL({dynamic: true})})
                .setTitle("Elige el destino de tu personaje")
                .setDescription("Se te ofrece un fragmento de sabiduria, pero el precio a pagar es alto. Tu **esencia** podria desvanecerse. ¿Que decision tomas?")
                .setColor("NotQuiteBlack")
    
                const select = new StringSelectMenuBuilder()
                .setCustomId(`despertarOptions-${interaction.user.id}`)
                .setMaxValues(1)
                .setPlaceholder("Elige tu respuesta...")
                .addOptions([
                    {
                        label: "A) Lo tomo. El conocimiento es poder",
                        value: `R4*A4`,
    
                    },
                    {
                        label: "B) Lo dejo, mi esencia es mi fortaleza",
                        value: `R4*B4`,
                        
                    },
                    {
                        label: "C) Ansío el conocimiento a como de lugar",
                        value: `R4*C4`,
                        
                    },
            ])
    
            const row = new ActionRowBuilder() 
            .addComponents(select)
            interaction.reply({content: `Has seleccionado la respuesta ${respuesta}`, ephemeral: true})
            message.edit({components: [row], embeds: [embed]})
            }

            if(pregunta === "R4") {
                const embed = new EmbedBuilder()
                .setAuthor({name: "Tu, solo tu.", iconURL: interaction.user.displayAvatarURL({dynamic: true})})
                .setTitle("Elige el destino de tu personaje")
                .setDescription("Debes sacrificar uno de estos aspectos de tu **ser** para obtener un poder inigualable. ¿Que opción eliges?")
                .setColor("NotQuiteBlack")
    
                const select = new StringSelectMenuBuilder()
                .setCustomId(`despertarOptions-${interaction.user.id}`)
                .setMaxValues(1)
                .setPlaceholder("Elige tu respuesta...")
                .addOptions([
                    {
                        label: "A) Mis recuerdos. El pasado no me define",
                        value: `R5*A5`,
    
                    },
                    {
                        label: "B) Mis emociones. La razón es mi guía",
                        value: `R5*B5`,
                        
                    },
                    {
                        label: "C) Mis amistades. La soledad es mi aliada",
                        value: `R5*C5`,
                        
                    },
            ])
    
            const row = new ActionRowBuilder() 
            .addComponents(select)
            interaction.reply({content: `Has seleccionado la respuesta ${respuesta}`, ephemeral: true})
            message.edit({components: [row], embeds: [embed]})
            }

            if(pregunta === "R5") {
                const embed = new EmbedBuilder()
                .setAuthor({name: "Tu, solo tu.", iconURL: interaction.user.displayAvatarURL({dynamic: true})})
                .setTitle("Elige el destino de tu personaje")
                .setDescription("Alcanzar tus sueños implicarian perder todo lo que tienes. ¿Estas dispuesto a sacrificar todo?")
                .setColor("NotQuiteBlack")
    
                const select = new StringSelectMenuBuilder()
                .setCustomId(`despertarOptions-${interaction.user.id}`)
                .setMaxValues(1)
                .setPlaceholder("Elige tu respuesta...")
                .addOptions([
                    {
                        label: "A) Si, mis sueños son mi unica razón de existir",
                        value: `R6*A6`,
    
                    },
                    {
                        label: "B) No, lo que he construido es más valioso",
                        value: `R6*B6`,
                        
                    },
                    {
                        label: "C) Destruire todo lo que me rodee para alcanzarlo",
                        value: `R6*C6`,
                        
                    },
            ])
    
            const row = new ActionRowBuilder() 
            .addComponents(select)
            interaction.reply({content: `Has seleccionado la respuesta ${respuesta}`, ephemeral: true})
            message.edit({components: [row], embeds: [embed]})
            }

            if(pregunta === "R6") {
                const embed = new EmbedBuilder()
                .setAuthor({name: "Tu, solo tu.", iconURL: interaction.user.displayAvatarURL({dynamic: true})})
                .setTitle("Elige el destino de tu personaje")
                .setDescription("¿Que piensas acerca de tu personaje?\n-# Tu personaje no se enterara de tu elección")
                .setColor("NotQuiteBlack")
    
                const select = new StringSelectMenuBuilder()
                .setCustomId(`despertarOptions-${interaction.user.id}`)
                .setMaxValues(1)
                .setPlaceholder("Elige tu respuesta...")
                .addOptions([
                    {
                        label: "A) Me gusta mi creacion",
                        value: `R7*A7`,
    
                    },
                    {
                        label: "B) No me agrada, pero tampoco me desagrada",
                        value: `R7*B7`,
                        
                    },
                    {
                        label: "C) No me agrada mi creacion",
                        value: `R7*C7`,
                        
                    },
                    {
                        label: "D) Odio a mi creacion",
                        value: `R7*D7`,
                        
                    },
            ])
    
            const row = new ActionRowBuilder() 
            .addComponents(select)
            interaction.reply({content: `Has seleccionado la respuesta ${respuesta}`, ephemeral: true})
            message.edit({components: [row], embeds: [embed]})
            }

            if(pregunta === "R7") {
                const embed = new EmbedBuilder()
                .setAuthor({name: "Tu, solo tu.", iconURL: interaction.user.displayAvatarURL({dynamic: true})})
                .setTitle("Ē̸͉s̴̭͂t̸̑ͅą̷́ ̶̱͝e̶̟̽s̵͍̏ ̸̨͂ṱ̷̌ů̷̹ ̶͔̽r̴̓ͅẹ̷̈́s̵̛̩p̶̲͋ù̷̯é̸̺s̸̢͒t̷̫͝ȧ̶̻")
                .setDescription("L̴a̴s̵ ̸r̶a̷i̵c̷e̴s̴ ̷p̵r̷o̶f̷u̸n̷d̸a̴s̶ ̸d̴e̵ ̸l̶a̵ ̸o̷s̴c̸u̵r̶i̵d̷a̴d̸ ̸s̸e̶ ̷a̴c̶e̷r̴c̴a̷n̸ ̷a̷ ̵t̴i̷ ̵p̵a̵r̷a̸ ̴o̷f̷r̴e̷c̷e̸r̷t̵e̶ ̸s̵e̷r̷ ̸p̵a̵r̶t̶e̵ ̵d̴e̶ ̴e̵l̴l̶a̷s̴.̸ ̴D̸e̸b̸e̷s̸ ̶t̸o̵m̸a̷r̶l̵a̸s̴")
                .setColor("NotQuiteBlack")
    
                const select = new StringSelectMenuBuilder()
                .setCustomId(`despertarOptions-${interaction.user.id}`)
                .setMaxValues(1)
                .setPlaceholder("Ē̸͉s̴̭͂t̸̑ͅą̷́ ̶̱͝e̶̟̽s̵͍̏ ̸̨͂ṱ̷̌ů̷̹ ̶͔̽r̴̓ͅẹ̷̈́s̵̛̩p̶̲͋ù̷̯é̸̺s̸̢͒t̷̫͝ȧ̶̻")
                .addOptions([
                    {
                        label: "A) Acepto. La oscuridad es parte de mi",
                        value: `R8*A8`,
    
                    },
                    {
                        label: "B) Acepto. La oscuridad es parte de mi",
                        value: `R8*B8`,
                        
                    },
                    {
                        label: "C) Acepto. La oscuridad es parte de mi",
                        value: `R8*C8`,
                        
                    },
                    {
                        label: "D) Acepto. La oscuridad es parte de mi",
                        value: `R8*D8`,
                        
                    },
                    {
                        label: "E) Acepto. La oscuridad es parte de mi",
                        value: `R8*E8`,
                        
                    },
                    {
                        label: "F) Acepto. La oscuridad es parte de mi",
                        value: `R8*F8`,
                        
                    },
                    {
                        label: "G) Acepto. La oscuridad es parte de mi",
                        value: `R8*G8`,
                        
                    },
                    {
                        label: "H) Acepto. La oscuridad es parte de mi",
                        value: `R8*H8`,
                        
                    },
            ])
    
            const row = new ActionRowBuilder() 
            .addComponents(select)
            interaction.reply({content: `has seleccionado la siguiente respuesta: ${respuesta}`, ephemeral: true})
            message.edit({components: [row], embeds: [embed]})
            }

            if(pregunta === "R8") {
                const embed = new EmbedBuilder()
                .setAuthor({name: "Tu, solo tu.", iconURL: interaction.user.displayAvatarURL({dynamic: true})})
                .setTitle("Es momento de maldecir a tu creación. Esta decision sera lo que defina tu destino")
                .setDescription("¿Tu personaje tendra el don de la magia? o ¿Necesitara ayuda de un contenedor elemental para usarla?" +
                    "\n\n No te preocupes, cualquiera de las dos opciones tiene su propio encanto, asi cómo su propia maldición (desventaja)" +
                    "\n\n Puedes obtener más informacion sobre cómo funcionan las magias y el artefacto en los siguientes foros <#1335122592251777125> - <#1339089897172107315>"
                )
                .setColor("NotQuiteBlack")
    
                const select = new StringSelectMenuBuilder()
                .setCustomId(`despertarOptions-${interaction.user.id}`)
                .setMaxValues(1)
                .setPlaceholder("Elige tu respuesta...")
                .addOptions([
                    {
                        label: "A) Mi personaje sera bendecido por el éon de la creacion.",
                        value: `Rf*Arf`,
    
                    },
                    {
                        label: "B) Mi personaje necesitara un contenedor elemental para usar la magia",
                        value: `Rf*Brf`,
                        
                    },
                    {
                        label: "C) Que el destino lo decida (aleatorio)",
                        value: `Rf*Crf`,
                        
                    },
            ])
            const row = new ActionRowBuilder() 
            .addComponents(select)
            interaction.reply({content: `H̷̡̧̼̲̳̺̹̩̹̳̗̙̼͖̯̱̭͚͎̊̍̃̃̿͐͆͒͗̕͠ͅả̴̡̢̧̛͎̝͓͙̜̞̠̞̼̹̳̹̯̂̔̑͑͆̅̋̇̃͂̉͊͌̿͐̐̓͋͊̿̕͝s̶̨̨̫͖̱̙̩̜̜͙̘̰̟̖̮̰̫̺͕̙̙̠͉̰̰̯̩̤̼͖̣̹̝̩̣͎̺͍̺̜̭͌̒̉̍̇͗̄͘͜͜ ̷̡̛̹̖̙͇̫͈͚̱̼̗͍̜̯̰̭͍͖̖̫͈̜̮͙̭̗͇̹͎̮͍̮̤͔̥͍̭͛̒̔́̉͑̑̈́͛̈́̄̅̅̚͜s̵͈͇̲̘̺͙̦̗̯̀́̑̆̋͜͠e̴̡͔̠̦̠̝̟̪̗̪͖̹̼̱͚̤̜̼̥̟͉͖̞̩͙̺̙̹̜̼̹̼͚̦͙͎͌́͂͑̿͜͜͝ͅl̶̨̡̰͚̰̟̱̺͈̲̻̥̩͕͍͙̥͎̩͉̤̤̠̫͖̋̍́̑̓̐̈͆̓̀̓̐̈́̀̆̾̃̕͘̚͜͠͝͝ȩ̸̡̡̛̛̛͚̗̤̫̠͎̱̻̮̰͎̦̠͕̺̫̮̺̘̼̥̥͉̠͚̬͖͔̱͍̬͍͇͙̻̀̎́̈́̄̾́̑̋͛͆̓̐̎̊́̊̍̀͆̑͘̕̚̕̕͠͝͝͝͝c̶̨̧̢̢̢̱̱̞̣̗̖̩̬̗̜̯̘̦͍̪͔̩̣͔̙̗̪̦͎͙̠̞̤͓͓̻͍̏͊͆͐̊̐̔̀̀̐̄̈́͆͌͘̚͘͝c̶̢̢̢̡̜̫̦̩̫̞̦͎̲͔̞͙͔̗̞̬̗͖͕̬͕͈̬͓̗̮̬̥̯̰͚̰̼̻͔̰̮̗̯̤̯̖̹̖̘͖̅̒̅̔̂̓̓̔̂͛̀̂̈́̊̔͊̓̑̓̂͆̈́͆̉́̔̆͋̅͑͑̋̀̃̽̆̈́͊̕͝͝į̴̧̨̢̧̨̨̧̢̡̥̦͕̘̻͔̝͓̠̠̖̥̙̥̹̺̦̗͓̣͙̫̩͍͚̯͔̫̲̮̳͎̦̞͇̼̯̭͚̈̈̍͌͂̃́̿͌̈́́͋̔͊͂̇̈́̃̍̋́̂̅̿͋̓̌͐̃̎͂̚̕̚͘͝ͅo̵̤͔̝͓͍͉̟͒͐ņ̸̨̨̢̢̢̛̛͇̣̙̺̤̟̮͎̝͉̗̬̤͙̰̩̘̝̹̟͙͉͙̼̺̰͙̖̀̓̐̉͌͗̾͐̀̊̉̍͋̾̇́̄͆̇̾͋̽̂̀̊͋̍̓͐̍́͋̒͂̕͘̚͜͠ͅą̶̢̧͔̮͓͈̦͔̬͙̫̮̬̥̦̗̳̤̞̠͍͎̘̻͖̝̬̫̤͓̟̪͌͑̑̎͋̑̌͒̄͆̈́͗̾̒͗̕̕͜͜͜͜͜͝͝d̶̨̢̬̻̦͔̮̲̗̞̤̳͔͎͈̬͎͙͎̺͓͉͕̯͔̙͓̼̦̀̽̍̈́̊̀͠ǫ̶̨̢̛͙̮͚͓͍͙̠̹͇̤͕̭̠͓̣͌͋̓̿̈́͋̐̎͌͑͂͌͂̉̏͘͘ ̸̢̨̗̱͚̬̼͉̗̯̪̫̮̰̯̤͎͎͍̰̞̝̯͎̦͐͐̀̚l̸̨̡̨̦͙͕̲̠̪̰͕̳̥̯̼̩̭̙̺̪͇̜̜̩̹̹̰̲̟̭̩̟͈̜̻̩͖̫͍͕̪͎̖̪̂̌͆͐̂̔̈͆͒̈́͗̀̾̾͂͒̄͌̂̒̆̽̏̒̈́͋͋̄̋͗͛̒̕̚͘̕̚͘͝͠͝ͅą̴̨̭̣̙̫͚̺͙͈̣̠͖̦͎́̒̏̉̏͑͂̇̐̑͋͆̀̽ ̴̡̢͎͎̻̯̼͖̘̹̳̪͔̙̻̲͎̣̠͓̦͓̺͙͔͔͖̭̺̯̺͈̖̟͓̭̣̌̑͋͗̔͜r̴̨̧̛͖̩͍͉̮̲̫͔̜̭̯͍̝̳̟̪̫̞͎͎̝̤̹̟͖͔͙̆́̏̊̌̋͋̍̌̓̉̒́̍͆͐̏̑̈̓ͅe̶̡̧̧̢̛̛̛̖̱̮̮̝͔̩̘͉̦̦̦̲͇̩̰̹͈̓̊̃̇́̉̈́̑͋͛͛́̃̄͐̀̉̀̀̄͋̉̓̌̑̆̽̿̽́͑̚͝ͅͅs̵̨̡̧̛̛̛̪̯͕̼̦̯̗̱̘͕̰̦̮̿̎̈́͐̊̿̓̍͑́̄̏̍͒̽̽͌̎̐́̌̈́͊̑̃̿͆̒͗́́̃̐̇̋̓͗̀͛̀͠͝p̵̧̙̟̮͈̹̲̱̫͈̎̓̎̅̀̀̀͐͐̈́̈́̑̈́̌̉̒̍̓̓̍́̓̅͗̒̎͊̊̾̚͠͝͝ủ̷̧̨̨̢̯̼̪͍͕̹̞̣̬͇͇͔̞͖̬̥̲͍̙͎͙͙̬͔̫̳̯̗̦͒͆̒̏̋̉̋̀͆͒̓̿͗̒̎̔̚͘͘͜͜͜͝ͅȩ̶̧̧̧̛̹͓̬͇̮̳͓͎̖̞͎͔̠͖̮͕͚̬̯̮̩̜̭̫̳̝͕̘͕̪̦͖̙̘̙̳̠̥̭͉͔̟̯̖̬̳̀̈͐̃̇̎̿̆́̒̂̍̇͐͛͋͒̀͘͘͘͝š̶̨̳̻͚̬̮̝͍͕͍̠̝̗͕͈̗̪͓̞̏̑̉̃́͋̂̾̊̒̆̅̀̍́̊͛̋̑̾̔͛̎̅͗̃͂́̈̈́̓͊̇̓̕̕͝͠͠͝ͅͅͅẗ̸̢̢̡̨̢̛̙̪̜̦̻̯̟͎̻̦͍̙̝͕̼̟̙͎̗̲̳̬̣͉́̾͗͋̍͌̍̂̅́̓͜͜ą̶̨̨̧̢̢̡̨͕̜̻̲͍̦̲̩͖̼̦̬͍̭͉̻̗̫͙̲̖͓͓͎͓͓̫͈̮̞͔̞͕̈̆͒̽͌̀͆͗͂͊̎̎̚ ${respuesta}`, ephemeral: true})
            message.edit({components: [row], embeds: [embed]})
            }

            if(pregunta === "Rf") {
                const embed = new EmbedBuilder()
                .setAuthor({name: "Tu, solo tu.", iconURL: interaction.user.displayAvatarURL({dynamic: true})})
                .setTitle("Bien, seguro esto te interesara.")
                .setDescription("¿Cual sera el elemento principal de tu personaje?\n" +
                        "[🔥] **`Pyrós (Rojo):`** Representa la fuerza y esperanza de la gente\n" + 
                        "[💧] **`Aqua (Azul):`** Representa la esperanza ahogada de la gente\n" + 
                        "[🌑] **`Lapis (Cafe):`** Representa el lavantamiento de tierras antiguas\n" + 
                        "[🌳] **`Rakau (Verde):`** Representa el nacimiento de nuevas estrellas\n" + 
                        "[⚡] **`Electro (Amarillo):`** Representa el parpadeo de la vida\n" + 
                        "[❄] **`Krýo (Blanco):`** Representa el frio eterno de los recuerdos\n" + 
                        "[🌪] **`Wind (Gris):`** Representa los deseos perdidos en el viento\n" +
                        "[✨] **`Lux (Amarillo claro):`** Representa el resplandor de las promesas\n" +
                        "\n Quieres saber más acerca de los elementos, puedes revisar el foro <#1335496371603509288>"
                    )
                .setColor("NotQuiteBlack")
    
                const select = new StringSelectMenuBuilder()
                .setCustomId(`despertarOptions-${interaction.user.id}`)
                .setMaxValues(1)
                .setPlaceholder("Elige tu respuesta...")
                .addOptions([
                    {
                        label: "Pyrós",
                        description: "La fuerza y esperanza",
                        value: `Rf2*Pyro`,
                        emoji: "🔥",
                    }, 
                    {
                        label: "Aqua", 
                        description: "Las esperanzas ahogadas",
                        value: `Rf2*Aqua`,
                        emoji: "💧"
                    }, 
                    {
                        label: "Lapis",
                        description: "El lavantamiento de tierras antiguas",
                        value: `Rf2*Lapis`,
                        emoji: "🌑"
                    }, 
                    {
                        label: "Rakau", 
                        description: "El nacimiento de nuevas estrellas",
                        value: `Rf2*Rakau`,
                        emoji: "🌳"
                    },
                    {
                      label: "Electro",
                      description: "El parpadeo de la vida",
                      value: `Rf2*Electro`,
                      emoji: "⚡"
                    },
                    {
                      label: "Krýo",
                      description: "El frio eterno de los recuerdos",
                      value: `Rf2*Kryo`,
                      emoji: "❄"
                    },
                    {
                      label: "Wind",
                      description: "Los deseos perdidos en el viento",
                      value: `Rf2*Wind`,
                      emoji: "🌪"
                    },
                    {
                        label: "Lux",
                        description: "El resplandor de las promesas",
                        value: `Rf2*Lux`,
                        emoji: "✨"
                    }

                    
            ])

            const row = new ActionRowBuilder() 
            .addComponents(select)
    
            message.edit({components: [row], embeds: [embed]})
            }


        }


        async function endDialogo() {
            message.edit({content: "...", components: [], embeds: []})
            await sleep(6000)

            const embedfirmamento = new EmbedBuilder()
            .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
            .setDescription("Todo aqui se siente tan vacio, ¿no crees?")
            .setColor("NotQuiteBlack")
            message.edit({content: "", embeds: [embedfirmamento]})
           await sleep(7000)

            const embedfirmamento2 = new EmbedBuilder()
            .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
            .setDescription("La soledad es un arma de doble filo. Puede ser tu mayor aliado o tu peor enemigo")
            .setImage("https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/cryinthedarkness_aalpit")
            .setColor("NotQuiteBlack")
            message.edit({content: "", embeds: [embedfirmamento2]})
            await sleep(9000)

            const embedfirmamento4 = new EmbedBuilder()
            .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
            .setDescription("Incluso las maldiciones pueden volverse bendiciones para algunos")
            .setImage("https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/randomname_jj9lwg")
            .setColor("NotQuiteBlack")
            await message.edit({content: "", embeds: [embedfirmamento4]})
            await sleep(9000)

            const embedfirmamento5 = new EmbedBuilder()
            .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
            .setDescription("Y el caos puede ser la destruccion de muchos,")
            .setImage("https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/dispair_hpomor")
            .setColor("NotQuiteBlack")
            await message.edit({content: "", embeds: [embedfirmamento5]})
            await sleep(7000)

            const embedfirmamento6 = new EmbedBuilder()
            .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
            .setDescription("Y el caos puede ser la destruccion de muchos, **pero la creación de otros**")
            .setImage("https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_qmhtav")
            .setColor("NotQuiteBlack")
            await message.edit({content: "", embeds: [embedfirmamento6]})
            await sleep(7000)

            const embedfirmamento7 = new EmbedBuilder()
            .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
            .setDescription("Cada elección deja una marca en el *cosmos.* Pequeñas huellas que nunca se borran")
            .setColor("NotQuiteBlack")
            message.edit({content: "", embeds: [embedfirmamento7]})
            await sleep(8000)


            const embedfirmamento8 = new EmbedBuilder()
            .setAuthor({name: "¿Firmamento?", iconURL: "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/darkpj_2_uhrvyj"})
            .setDescription("El *firmamento* observa, paciente, pero no eterno.")
            .setColor("NotQuiteBlack")
            message.edit({content: "", embeds: [embedfirmamento8]})
            await sleep(9000)

            message.edit({content: "Es suficiente, me he cansado de hablar contigo", components: [], embeds: []})
            await sleep(7000)

            message.edit({content: "Pero recuerda..."})
            await sleep(4000)

            message.edit({content: "Pero recuerda. ||Te estamos observando||"})

            let SpellId;



            const soulsactual = await soul.findOne({_id: interaction.user.id})

            const spellsSelect = {
                Pyró: "Pyro-001",
                Aqua: "Aqua-001",
                Lapis: "Lapis-001",
                Rakau: "Rakau-001",
                Electro: "Electro-001",
                Krýo: "Kryo-001",
                Wind: "Wind-001",
                Lux: "Lux-001",
            }

           SpellId = spellsSelect[soulsactual.Elemento]

            soul.updateOne({_id: interaction.user.id}, {
                $set: {
                        Despertado: Date.now(), 
                        isFinish: true,
                        equipo: [
                            {
                                "ID": 748,
                                "Region": "TOB-01",
                                "Type": 1
                              }
                        ],
                        hechizos: [
                            {
                                "ID": SpellId,
                                "InCombat": true
                            }
                        ]

                },
                $unset: {
                    "messageTemp": "",
                }
            })

            await sleep(6000)

            const typemagia = souls.Artefacto === true ? "Artefacto" : "Magia Natural"

            


            const embed = new EmbedBuilder()
            .setTitle("En busca de un lugar en las estrellas")
            .setDescription("Tu personaje ha despertado su poder y esta listo para enfrentarse al mundo. Lucha y esfuerzate por conseguir un lugar en las estrellas.")
            .addFields(
                {name: "Tipo de magia", value: `${typemagia}`, inline: true},
                {name: "Elemento Natural", value: `${soulsactual.Elemento}`, inline: true},
                {name: "Nivel Magico", value: `${souls.nivelMagico}`, inline: true},
            )
            .setImage("https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/lastwords2_mppz9u")
            .setColor("DarkPurple")
            .setFooter({text: "Se ha desbloqueado un nuevo apartado en tu perfil"})

            interaction.user.send({embeds: [embed]})
        }
    }
}