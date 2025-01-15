const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const character = db2.collection("Personajes")
const relacion = db2.collection("Relaciones_pj")
const version = require("../../../config")
const {registerFont, createCanvas, Image} = require("canvas")
const canvas = require("canvas")


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const inter = interaction.options.getInteger("personaje")
    const user = interaction.user;
    const pj1 = await character.findOne({_id: user.id})
    const pj2 = await character.findOne({ID: inter})

    if(!pj1) {
        return interaction.reply({ content: "¡Todavia no tienes un personaje para usar este comando!", ephemeral: true})
    }else if(inter) {
        if(!pj2) {
            return interaction.reply({content: "No encontre ningun personaje con esa ID. revisa que la ID proporcionada sea la correcta", ephemeral: true})
        }else if(pj1._id === pj2._id) {
            return interaction.reply({content: "**cof, cof.** Esa ID parece ser la tuya... (・・ )?", ephemeral: true})
        }

        await personaje()
    }
    


    if(!inter) {
        lista()
    }

    async function lista() {
        await interaction.deferReply()
        const relaciones = await relacion.find({
            $or: [{ ID1: pj1.ID}, {ID2: pj1.ID}]
        }).toArray()

        if(!relaciones.length) {
            return interaction.editReply({content: "Tu personaje aun no ha formado ninguna relación...\n-# ¿Porque no intentas formar una?"})
        }

        const relacionesId = relaciones.map((rel) =>  rel.ID1 === pj1.ID ? rel.ID2 : rel.ID1)

        const pjrelacionados = await character.find({
            ID: {$in: relacionesId}
        }).toArray()

       

        const mappj = pjrelacionados.reduce((mapa, personaje) => {
            mapa[personaje.ID] = personaje.Nombre
            return mapa;
        }, {});


        const relacionesget = relaciones.map((rel) => {
            const relacionado = rel.ID1 === pj1.ID ? rel.ID2 : rel.ID1;
            const namerel = mappj[relacionado] || "Desconocido";

            return "- **` " + namerel + ":`** *" + rel.amistad + ` (Nivel: ${rel.lv})*`;
        })

        const totalPag = Math.ceil(relacionesget.length / 10);

        const obtenerpagina = (pagina) => {
            const inic = (pagina - 1) * 10;
            const end = inic + 10;
            return relacionesget.slice(inic, end).join("\n");
        }


        const embed = new EmbedBuilder()
        .setTitle(`Relaciones de ${pj1.Nombre}`)
        .setDescription(obtenerpagina(1))
        .setThumbnail(pj1.avatarURL)
        .setTimestamp()
        .setFooter({ text: `Mostrando pagina 1`})
        .setColor("Random")

        interaction.editReply({ embeds: [embed]})
        
    }

    async function personaje() {
        await interaction.deferReply()
        const relationId = pj1.ID < inter ? `${pj1.ID}-${inter}`:`${inter}-${pj1.ID}`
        const relaciones = await relacion.findOne({_id: relationId})

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
            ctx.strokeText(`ID: ${pj1.ID}`, 295.37, 145)
            ctx.fillStyle = "#ffffff"
            ctx.fillText(`ID: ${pj1.ID}`, 295.37, 145)
            //Nombre izquierdo (ID1)
            ctx.lineWidth = 13
            ctx.fillStyle = "#ffffff"
            ctx.font = '52px Alegreya Sans Black'
            ctx.strokeStyle = "#000000"
            ctx.textAlign = "center"
            ctx.strokeText(`${pj1.Nombre}`, 295, 575, 320)
            ctx.fillStyle = "#ffffff"
            ctx.fillText(`${pj1.Nombre}`, 295, 575, 320)

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
            const avatar1 = await canvas.loadImage(pj1.avatarURL)
            const avatar2 = await canvas.loadImage(pj2.avatarURL)
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

}