const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const relacion = db2.collection("Relaciones_pj")
const version = require("../../../config")
const {registerFont, createCanvas, Image} = require("canvas")
const canvas = require("canvas")


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = {
    requireCharacter: true,
    requireSoul: false,
    requireCharacterCache: false,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: false,
        Character: true,
        Cachepj: false
    },

    ejecutar: async(client, interaction, { character }) => {
    const inter = interaction.options.getInteger("personaje")
    const pj2 = await characters.findOne({ID: inter})

    if(inter) {
        if(!pj2) {
            return interaction.reply({content: "No encontre ningun personaje con esa ID. revisa que la ID proporcionada sea la correcta", ephemeral: true})
        }else if(character._id === pj2._id) {
            return interaction.reply({content: "**cof, cof.** Esa ID parece ser la tuya... (・・ )?", ephemeral: true})
        }

        await personaje2()
    }
    


    if(!inter) {
        lista()
    }

    async function lista() {
        await interaction.deferReply()
        const relaciones = await relacion.find({
            $or: [{ ID1: character.ID}, {ID2: character.ID}]
        }).toArray()

        if(!relaciones.length) {
            return interaction.editReply({content: "Tu personaje aun no ha formado ninguna relación...\n-# ¿Porque no intentas formar una?"})
        }

        const relacionesId = relaciones.map((rel) =>  rel.ID1 === character.ID ? rel.ID2 : rel.ID1)

        const pjrelacionados = await characters.find({
            ID: {$in: relacionesId}
        }).toArray()

       

        const mappj = pjrelacionados.reduce((mapa, personaje) => {
            mapa[personaje.ID] = personaje.Nombre
            return mapa;
        }, {});


        const relacionesget = await Promise.all(
            relaciones.map(async (rel) => {
                const relacionado = rel.ID1 === character.ID ? rel.ID2 : rel.ID1;
                const namerel = mappj[relacionado] || "Desconocido";
                
                const tituloAmistad = await obtenerEtiqueta(rel)
    
                console.log(tituloAmistad.nombre)
                console.log(namerel)
    
                return "- **`" + namerel + ":`** " + tituloAmistad.nombre + ` *(Nivel Amistad: ${rel.amistad.nivel} | Enemistad: ${rel.enemistad.nivel})*`;
            })
        )
        


        const totalPag = Math.ceil(relacionesget.length / 10);

        const obtenerpagina = (pagina) => {
            const inic = (pagina - 1) * 10;
            const end = inic + 10;
            return relacionesget.slice(inic, end).join("\n");
        }


        const embed = new EmbedBuilder()
        .setTitle(`Relaciones de ${character.Nombre}`)
        .setDescription(obtenerpagina(1))
        .setThumbnail(character.avatarURL)
        .setTimestamp()
        .setFooter({ text: `Mostrando pagina 1`})
        .setColor("Random")

        interaction.editReply({ embeds: [embed]})
        
    }

    async function personaje() {
        await interaction.deferReply()
        const relationId = character.ID < inter ? `${character.ID}-${inter}`:`${inter}-${character.ID}`
        const relaciones = await relacion.findOne({_id: relationId})
        const avatarURL = character.avatarURL.replace('/upload/', '/upload/q_auto,f_auto,w_337,h_337,c_fill/')
        const avatarURL2 = pj2.avatarURL.replace('/upload/', '/upload/q_auto,f_auto,w_337,h_337,c_fill/')

        if(!relaciones) {
            return interaction.editReply({content: "No encontre ninguna relación con ese personaje"})
        }

        const puntos = relaciones.xp
        const puntosreq = relaciones.xptoLv





        const lienzo = createCanvas(1638, 752)
        const ctx = lienzo.getContext("2d")
        const linecenter = await canvas.loadImage("https://res.cloudinary.com/dn1cubayf/image/upload/v1727048527/Resources/hn1309a4msly4x4pc1jc.png")


        const background = new Image();
        background.src = "https://res.cloudinary.com/dn1cubayf/image/upload/v1736921711/skynight-transformed_a7cluu.jpg"

        background.onload = async function() {
            var porx = puntos * 100 / puntosreq //50
            var porx2 = porx * 619 / 100
            var porcentaje = porx2 

            //ID izquierdo (ID1)
            ctx.drawImage(background, 0, 0, lienzo.width, lienzo.height);
            ctx.textAlign = "center"
            ctx.font = '42px Century'
            ctx.strokeStyle = "#000000"
            ctx.lineWidth = 12
            ctx.strokeText(`ID: ${character.ID}`, 295.37, 145)
            ctx.fillStyle = "#ffffff"
            ctx.fillText(`ID: ${character.ID}`, 295.37, 145)
            //Nombre izquierdo (ID1)
            ctx.lineWidth = 13
            ctx.fillStyle = "#ffffff"
            ctx.font = '52px Alegreya Sans Black'
            ctx.strokeStyle = "#000000"
            ctx.textAlign = "center"
            ctx.strokeText(`${character.Nombre}`, 295, 575, 320)
            ctx.fillStyle = "#ffffff"
            ctx.fillText(`${character.Nombre}`, 295, 575, 320)

            //Nombre Derecho (ID2)
            ctx.textAlign = "center"
            ctx.font = '42px Century'
            ctx.strokeStyle = "#000000"
            ctx.lineWidth = 12
            ctx.strokeText(`ID: ${pj2.ID}`, 1355, 145)
            ctx.fillStyle = "#ffffff"
            ctx.fillText(`ID: ${pj2.ID}`, 1355, 145)
            //Nombre Derecho (ID2)
            ctx.fillStyle = "#ffffff"
            ctx.font = '52px Alegreya Sans Black'
            ctx.strokeStyle = "#000000"
            ctx.textAlign = "center"
            ctx.strokeText(`${pj2.Nombre}`, 1348, 575, 320)
            ctx.fillStyle = "#ffffff"
            ctx.fillText(`${pj2.Nombre}`, 1348, 575, 320)

            //Puntos en medio (Rango de amistad)
            ctx.textAlign = "center"
            ctx.font = '50px Alegreya Sans Black'
            ctx.strokeStyle = "#000000"
            ctx.lineWidth = 12
            ctx.strokeText(`Conocidos`, 840, 270)
            ctx.fillStyle = "#ffffff"
            ctx.fillText(`Conocidos`, 840, 270)
            
            ctx.textAlign = "center"
            ctx.font = '50px Harlow Solid'
            ctx.strokeStyle = "#000000"
            ctx.lineWidth = 12
            ctx.strokeText(`Total: ${puntos}`, 837, 430)
            ctx.fillStyle = "#ffffff"
            ctx.fillText(`Total: ${puntos}`, 837, 430)
    
            
            ctx.textAlign = "center"
            ctx.font = '50px Harlow Solid'
            ctx.strokeStyle = "#000000"
            ctx.lineWidth = 13
            ctx.strokeText(`Puntos de Amistad`, 837, 490)
            ctx.fillStyle = "#ffffff"
            ctx.fillText(`Puntos de Amistad`, 837, 490)
            //Concluye el rango
            ctx.strokeRect(130, 172, 345, 345)
            ctx.fillStyle = ""
            ctx.strokeRect(1180, 171, 345, 345)
            ctx.lineWidth = 13
            const avatar1 = await canvas.loadImage(avatarURL)
            const avatar2 = await canvas.loadImage(avatarURL2)
            ctx.drawImage(avatar1, 131, 175, 337, 337)
            ctx.drawImage(avatar2, 1183, 175, 337, 337)

            ctx.lineWidth = 5
            ctx.fillStyle = "#f7db44"
            ctx.fillRect(519, 305, porx2, 75)
            ctx.drawImage(linecenter, 0, 0)
    
            ctx.textAlign = "center"
            ctx.font = '50px Harlow Solid'
            ctx.strokeStyle = "#000000"
            ctx.lineWidth = 12
            ctx.strokeText(`${puntos}/${puntosreq}`, 837, 357)
            ctx.fillStyle = "#ffffff"
            ctx.fillText(`${puntos}/${puntosreq}`, 837, 357)
            console.log("Imagen terminada, obteniendo imagen... / Line: 196")

            const buffer = lienzo.toBuffer("image/png");
            await interaction.editReply({files: [buffer]})

            background.onerror = function() {
                console.log("Error al cargar la imagen")
            }
        }
            
    } 

    async function personaje2() {
        await interaction.deferReply();

        const relationId = character.ID < inter ? `${character.ID}-${inter}`:`${inter}-${character.ID}`
        const amistad = await relacion.findOne({_id: relationId})

        if(!amistad) {
            return interaction.editReply({content: "No encontre ninguna relación con ese personaje"})
        }
        const avatarURL = character.avatarURL.replace('/upload/', '/upload/q_auto,f_auto,w_337,h_337,c_fill/')
        const avatarURL2 = pj2.avatarURL.replace('/upload/', '/upload/q_auto,f_auto,w_337,h_337,c_fill/')

        try {

            const xpNet = amistad.amistad.XP - amistad.enemistad.XP

            const simbol1 = xpNet > 0 ? "✿" : "❀"
            const simbol2 = xpNet > 0 ? "❀" : "✿"

            const amistadField = `-# Nivel: ${amistad.amistad.nivel}\n` +
            `-# XP: ${amistad.amistad.XP}\n`

            const enemistadField = `-# Nivel: ${amistad.enemistad.nivel}\n` +
            `-# XP: ${amistad.enemistad.XP}\n`

            const etiqueta = await obtenerEtiqueta(amistad)
            console.log(etiqueta)

            const embed = new EmbedBuilder()
                .setAuthor({name: `${character.Nombre}`, iconURL: `${avatarURL}`})
                .setTitle(`${character.Nombre} & ${pj2.Nombre} `)
                .setDescription(`**${etiqueta.nombre}**\n*"${etiqueta.descripcion}"*`)
                .setThumbnail(`${avatarURL2}`)
                .setColor(xpNet > 0 ? '#3498db' : '#e74c3c') // Azul para positivo, rojo para negativo
                .addFields(
                    { name: 'Amistad', value: amistadField, inline: true },
                    { name: 'Enemistad', value: enemistadField, inline: true },
                    { name: 'Puntos netos', value: `${xpNet}`, inline: true}
                );
            
            // Agregar corazones si hay
            if (amistad.amistad.hearts > 0) {
                const corazones = '❤️'.repeat(amistad.amistad.hearts);
                embed.addFields({ name: 'Corazones [Amistad]', value: "`" +`${corazones} - ${amistad.amistad.hearts}` + "`" });
            }

            if (amistad.enemistad.roses > 0) {
                const roses = '🌹'.repeat(amistad.enemistad.roses);
                embed.addFields({ name: 'Rosas [Enemistad]', value: "`" +`${roses} - ${amistad.enemistad.roses}` + "`" });
            }
            // Agregar logros si hay
            if (amistad.logros.length > 0) {
                const logrosTexto = amistad.logros.map(logro => `• ${logro}`).join('\n');
                embed.addFields({ name: 'Logros Desbloqueados', value: logrosTexto });
            } else {
                embed.addFields({ name: 'Logros Desbloqueados', value: 'Ninguno por ahora' });
            }
            
            // Enviar el embed
            await interaction.editReply({ embeds: [embed] });
        } catch (e) {
            console.log(e)
        }
    }

    async function obtenerEtiqueta(relacion) {
        const netXP = relacion.amistad.XP - relacion.enemistad.XP

        const etiquetas = [
            {
                nombre: "Almas Gemelas",
                descripcion: "Se han encontrado. luego de tanto tiempo...",
                minNetXP: 6000,
                requisitos: () => true,
                prioridad: 51
            },
            {
                nombre: "Hermandad Eterna",
                descripcion: "Un vínculo mágico inquebrantable forjado en mil batallas.",
                maxNetXP: 5999,
                minNetXP: 5000,
                requisitos: () => true,
                prioridad: 30
            },
            {
                nombre: "Compañeros de aventura",
                descripcion: "Para aquellos que se acompañan mutuamente",
                maxNetXP: 4999,
                minNetXP: 4000,
                requisitos: () => true,
                prioridad: 17
            },
            {
                nombre: "Aliados Mágicos",
                descripcion: "No solo te acompaña en la vida, si no te apoya mutuamente",
                maxNetXP: 3999,
                minNetXP: 3000,
                requisitos: () => true,
                prioridad: 15
            },
            {
                nombre: "Mejores Amigos",
                descripcion: "Un vínculo mágico inquebrantable",
                maxNetXP: 2999,
                minNetXP: 2000,
                requisitos: () => true,
                prioridad: 13
            },
            {
                nombre: "Amistad sincera",
                descripcion: "En las buenas y en las malas",
                maxNetXP: 1999,
                minNetXP: 1500,
                requisitos: () => true,
                prioridad: 11
            },
            {
                nombre: "Amistad cercana",
                descripcion: "Alguien a quien puedes confiar",
                maxNetXP: 1499,
                minNetXP: 1000,
                requisitos: () => true,
                prioridad: 9
            },
            {
                nombre: "Amistad",
                descripcion: "...",
                maxNetXP: 999,
                minNetXP: 500,
                requisitos: () => true,
                prioridad: 7
            },
            {
                nombre: "Compañeros de clase",
                descripcion: "Posiblemente se conocieron por que van en el mismo salon",
                maxNetXP: 499,
                minNetXP: 250,
                requisitos: () => true,
                prioridad: 5
            },
            {
                nombre: "Conocidos del instituto",
                descripcion: "Alguna vez se toparon en el instituto",
                maxNetXP: 249,
                minNetXP: 100,
                requisitos: () => true,
                prioridad: 3
            },
            {
                nombre: "Neutro",
                descripcion: "No se conocen lo suficiente para definir una relación",
                maxNetXP: 99,
                minNetXP: 50,
                requisitos: () => true,
                prioridad: 1
            },
            {
                nombre: "Extraños",
                descripcion: "Posiblemente se conozcan por terceras personas",
                maxNetXP: 49,
                minNetXP: 10,
                requisitos: () => true,
                prioridad: 2
            },
            {
                nombre: "Recuerdos confusos",
                descripcion: "A veces los conflictos nublan nuestra vista y no dejan ver con claridad lo que alguna vez significó para nosotros esa amistad",
                minNetXP: 0,
                requisitos: (relacion) => relacion.amistad.nivel >= 10 && relacion.enemistad.nivel >= 10,
                prioridad: 50
            },
            {
                nombre: "Tension leve",
                descripcion: "De las cosas pequeñas a lo grande",
                maxNetXP: -10,
                minNetXP: -99,
                requisitos: () => true,
                prioridad: 4
            },
            {
                nombre: "Antipatia",
                descripcion: "Lo contrario a la empatía",
                maxNetXP: -100,
                minNetXP: -499,
                requisitos: () => true,
                prioridad: 6
            },
            {
                nombre: "Rivales académicos",
                descripcion: "Seguramente su ego los consume en el combate",
                maxNetXP: -500,
                minNetXP: -1499,
                requisitos: () => true,
                prioridad: 8
            },
            {
                nombre: "Enemigos del Instituto",
                descripcion: "Han pasado suficientes cosas negativas cómo para tener este titulo",
                maxNetXP: -1500,
                minNetXP: -2999,
                requisitos: () => true,
                prioridad: 10
            },
            {
                nombre: "Sombras Opuestas",
                descripcion: "Su odio es grande.",
                maxNetXP: -3000,
                minNetXP: -4999,
                requisitos: () => true,
                prioridad: 12
            },
            {
                nombre: "Némesis",
                descripcion: "Has encontrado a tu alma opuesta.",
                maxNetXP: -5000,
                minNetXP: -5999,
                requisitos: () => true,
                prioridad: 14
            },
            {
                nombre: "Vendetta Ancestral",
                descripcion: "Su odio se transimte a traves de las generaciónes",
                maxNetXP: -6000,
                minNetXP: -9999,
                requisitos: () => true,
                prioridad: 16
            },
            {
                nombre: "Eterno Odio",
                descripcion: "Su nivel de odio es indescriptible",
                minNetXP: -Infinity,
                maxNetXP: -9999,
                requisitos: () => true,
                prioridad: 50
            },
            {
                nombre: "Desconocidos",
                descripcion: "Sin ningun vínculo especifico. Un paso antes de una posible amistad o enemistad",
                minNetXP: 0,
                requisitos: () => true,
                prioridad: 0
            }
        ]

        const etiquetasFiltradas = etiquetas.filter(etiqueta => {
            const cumpleMin = etiqueta.minNetXP === undefined || netXP >= etiqueta.minNetXP;
            const cumpleMax = etiqueta.maxNetXP === undefined || netXP <= etiqueta.maxNetXP;
            return cumpleMin && cumpleMax;
          });

        etiquetasFiltradas.sort((a, b) => b.prioridad - a.prioridad);

        for (const etiqueta of etiquetasFiltradas) {
            const cumpleRequisitos = await etiqueta.requisitos(relacion);
            if (cumpleRequisitos) {
              return etiqueta;
            }
          }
        
          return etiquetas.find(e => e.prioridad === 0);


    }

    }

}