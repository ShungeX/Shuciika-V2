const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed, StringSelectMenuBuilder} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const souls = db2.collection("Soul")
const character = db2.collection("Personajes")
const version = require("../../../config")
const dbobjetos = db2.collection("Objetos_globales")

module.exports = {
    customId: "selectPerfil",
    selectAutor: true,


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, char, characterId) => {
        const [action, key] = interaction.values[0].split("*")
        const personaje = await character.findOne({ID: Number(characterId)})
        const user = interaction.guild.members.resolve(personaje._id)
        const soul = await souls.findOne({_id: personaje._id})


        switch (action) {
            case "perfil":
                perfil(personaje)
                break;
            case "historia": 
                historia(personaje)
                break;
            case "alma": 
                await alma(personaje)
                break;
            case "mascota": 
                mascotas(personaje)
                break;
            case "stats": 
                stats(personaje)
                break;
            default:
                break;
        }


        function perfil(pjuser) {
            const descripcion = pjuser.Descripcion ? pjuser.Descripcion: "Sin descripcion"
            const reputacion = pjuser?.Reputacion ? pjuser.Reputacion: "0"
            const grado = pjuser?.DesmpAcademico?.Grado ? pjuser.DesmpAcademico.Grado: "Aun no calculado"
                const embed = new EmbedBuilder()
                .setTitle(pjuser.Nombre + ` [${pjuser.Apodo}]`)
                .setDescription("`Reputacion:` " + reputacion + "\n`Grado:` "+ grado +"\n\n" + descripcion)
                .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
                .addFields(
                  {name: "Informacion 1/2", value: "`🎎` **Sexo: **" + pjuser.Sexo + "\n`🍭` **Edad: **" + pjuser.Edad + "\n`🎂` **Cumple: **" + pjuser.Cumpleaños + "\n`🛫` **C/Org: **" + pjuser.CiudadOrg, inline: true},
                  {name: "Informacion 2/2", value: "`👑` **Origen: **" + pjuser.Familia +"\n`🎭` **Personalidad: **" + pjuser.Personalidad + "\n `🏈` **Especialidad: **" + pjuser.Especialidad, inline: true},
                  {name: "Extra", value: "`🔮` **Rol: **" + pjuser.Rol + "\n`💳` **ID: **" + pjuser.ID + "\n `🎉` **Fecha de creacion: **" + pjuser.FechaS, inline: false}
                )
                .setThumbnail(pjuser.avatarURL)
                .setColor(`Random`)
                .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});
                return interaction.update({embeds: [embed], components: [getComponents(pjuser)]})
        }

        function historia(pjuser) {

            if(key) {
                const historiaData = personaje.Capitulos.find(c => c.ID === key)
                if(!historiaData) return interaction.reply({content: "Hubo un error al intentar mostrar este capitulo. Intentalo de nuevo ＞﹏＜", flags: "Ephemeral"})

                const embed = new EmbedBuilder()
                .setTitle(historiaData.Titulo)
                .setDescription(historiaData.Historia)
                .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
                .setThumbnail(historiaData?.Imagen || null)
                .setColor(`Random`)
                .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});

                const historiasOrdenadas = personaje.Capitulos.sort((a, b) => {
                    if (a.Pin !== b.Pin) return b.Pin - a.Pin; // 
                    if (a.Orden !== b.Orden) return a.Orden - b.Orden;
                    return new Date(a.FechaCreacion) - new Date(b.FechaCreacion);
                });

                

                const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`selectPerfil-${interaction.user.id}-${pjuser.ID}-extras`)
                .setPlaceholder('Selecciona una historia para ver...');

                selectMenu.addOptions({
                    label: `Capitulo principal`,
                    value: `historia`,
                    description: `Esta es la historia principal de personaje`,
                    emoji: "✨",
                })

                historiasOrdenadas.slice(0, 24).forEach(historia => {
                    const numeroRomano = NumRomano(historia.NumeroCapitulo);
                    let emoji = historia.Pin ? '📌' : '📖'; 

                    selectMenu.addOptions({
                        label: `Capitulo ${numeroRomano}`,
                        value: `historia*${historia.ID}`, 
                        description: `Título: ${historia.Titulo.substring(0, 50)}...`,
                        emoji: emoji,
                        default: key === historia.ID
                    });
                });

                const rowse = new ActionRowBuilder().addComponents(selectMenu)

                console.log(rowse)

                return interaction.update({embeds: [embed], components: [rowse, getComponents(pjuser)]})


            }


            let row;
            let row2;
            const pincel = personaje.Inventario.find(i => i.ID === 120 && i.Region === "TOB-01")
            const embed = new EmbedBuilder()
            .setTitle(pjuser.Nombre + ` [${pjuser.Apodo}]`)
            .setDescription("**`Historia:`**\n" + pjuser.Historia || "In Rol")
            .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
            .setThumbnail(pjuser.avatarURL)
            .setColor(`Random`)
            .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});

            if(pincel?.Cantidad > 0 && personaje._id === interaction.user.id) {
                const regButton = new ButtonBuilder()
                .setCustomId(`perfil_options-${interaction.user.id}-${pjuser.ID}-addHistory`)
                .setStyle(ButtonStyle.Primary)
                .setLabel("Agregar nuevo capitulo")
                .setEmoji(`<:pencil:1356116580555296880>`)
                .setDisabled(false)
        
        
                row = new ActionRowBuilder().addComponents(regButton) 
            }

            if(personaje?.Capitulos?.length > 0) {
                const historiasOrdenadas = personaje.Capitulos.sort((a, b) => {
                    if (a.Pin !== b.Pin) return b.Pin - a.Pin; // 
                    if (a.Orden !== b.Orden) return a.Orden - b.Orden;
                    return new Date(a.FechaCreacion) - new Date(b.FechaCreacion);
                });

                const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`selectPerfil-${interaction.user.id}-${pjuser.ID}-extras`)
                .setPlaceholder('Selecciona una historia para ver...');

                selectMenu.addOptions({
                    label: `Capitulo principal`,
                    value: `historia`,
                    description: `Esta es la historia principal de personaje`,
                    emoji: "✨",
                    default: true
                })

                historiasOrdenadas.slice(0, 24).forEach(historia => {
                    const numeroRomano = NumRomano(historia.NumeroCapitulo);
                    let emoji = historia.Pin ? '📌' : '📖'; 

                    selectMenu.addOptions({
                        label: `Capitulo ${numeroRomano}`,
                        value: `historia*${historia.ID}`, 
                        description: `Título: ${historia.Titulo.substring(0, 50)}...`,
                        emoji: emoji
                    });
                });

                row2 = new ActionRowBuilder().addComponents(selectMenu)
            }



            const rows = [];

            if (row) rows.push(row);
            if (row2) rows.push(row2);
            rows.push(getComponents(pjuser))

            return interaction.update({embeds: [embed], components: rows.length > 0 ? rows : []})



        }

        function mascotas(pjuser) {
            const embed = new EmbedBuilder()
            .setTitle("Mascotas de " + pjuser.Nombre)
            .setDescription("Sin mascotas")
            .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
            .setThumbnail(pjuser.avatarURL)
            .setColor(`Random`)
            .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});
            return interaction.update({embeds: [embed], components: [getComponents(pjuser)]})

            
        }

       async function stats(pjuser) {
        console.log(interaction.values[0])
            if(key) {
                if(soul.StelarFragments < 1) return interaction.reply({content: "No puedes mejorar esta habilidad porque no tienes los fragmentos estelares suficientes", flags: "Ephemeral"})

                await souls.updateOne({_id: interaction.user.id}, {
                    $inc: {
                        [`stats.${key}`]: +1,
                        "StelarFragments": -1
                    }
                })

 
                soul.stats[key] += + 1
                soul.StelarFragments -= 1
            }


            const getst = getStats(soul.stats)

            const embed = new EmbedBuilder()
            .setTitle("Estadisticas de " + pjuser.Nombre)
            .setDescription("<a:PurpleCrystalHeart:1356497588131729458> `Fragmentos estelares:` " + soul.StelarFragments + 
                `\n-# **¡Una vez asignes los fragmentos no los podras cambiar a menos que compres el "item especial"!**
                 \n-# No todos los stats se pueden mejorar mediante fragmentos estelares`
            )
            .addFields(getst.fields)
            .setColor("DarkPurple")
            .setThumbnail("https://i.pinimg.com/originals/29/d5/c4/29d5c4bce4419d9a16d83dcf3d4a7b93.gif")
            .setFooter({text: "Los fragmentos estelares se pueden obtener al subir de nivel"})

            await interaction.update({embeds: [embed], components: [getst.selectMenu, getComponents(pjuser)]})
            if(key) {
                await interaction.followUp({content: "Puntos estelares aplicados correctamente", flags: "Ephemeral"})
            }

        }

        async function alma(pjuser) {
            if(interaction.user.id !== pjuser._id) {
                return interaction.reply({content: "No puedes revisar el alma de este personaje ＞﹏＜", ephemeral: true})
            }

            if(!soul) {
                return interaction.reply({content: "Este personaje aun no despierta su poder (´･ω･`)?", ephemeral: true})
            }

            const statsBase = "`[✨] LV:` " + soul.nivelMagico + "\n`[🍪] XP:` " + `${soul.XP} -> ${soul.xpRequired}` +
            "\n`[💜] HP:` " + `${soul.HP}/${soul.stats.hpMax}` + 
            "\n`[💧] Mana:` " + `${soul.Mana}/${soul?.stats?.manaMax}` +
            "\n`[🌱] Elemento:` " + soul.Elemento;


            const lumens = "\n\n<a:Lumens:1335709991130103910> " + pjuser.Dinero + " `Lumens`"

            const embed = new EmbedBuilder()
            .setTitle("Alma de " + pjuser.Nombre)
            .setDescription(statsBase + lumens)
            .setFields(
                {name: "[🪄] Tipo de magia", value: soul.artefactoMagico === true ? "Contenedor Elemental" : "Magia Elemental", inline: false},
                {name: "[🥊] Equipamiento", value: `${await getequipamiento()}`}
            )
            .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
            .setThumbnail(soul.artefactoMagico === true ? "https://res.cloudinary.com/dn1cubayf/image/upload/v1737346961/idk_db3mmo.jpg" : "https://res.cloudinary.com/dn1cubayf/image/upload/v1737346978/idk3_v2s9hr.jpg")
            .setColor('DarkPurple')
            .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});

                const components1 = new StringSelectMenuBuilder()
                .setCustomId(`selectPerfil-${interaction.user.id}-${personaje.ID}-extra`)
                .setPlaceholder("Opciones extras")
                .setMaxValues(1)

                components1.addOptions(
                    {
                        label: `Stats`,
                        value: `stats`,
                        emoji: `<:XP:1350575069113352265>`,
                    }
                    
                )
                
                const row2 = new ActionRowBuilder().addComponents(components1)
            
            return interaction.update({embeds: [embed], components: [row2, getComponents(pjuser)]})
        }
       

        async function getequipamiento() {

            if(!soul.equipo || soul.equipo.length === 0) {
                return "Sin equipamiento."
            }

            const Regiones = {}

            soul.equipo.forEach(equip => {
                if(!Regiones[equip.Region]) Regiones[equip.Region] = [];
                Regiones[equip.Region].push(equip.ID)
            })

            const objetosEncontrados = [];

            for (const region in Regiones) {
                const documentoRegion = await dbobjetos.findOne({ _id: region });


                if (documentoRegion) {
                    // Filtrar los objetos que coincidan en ID
                    const nombres = documentoRegion.Objetos
                        .filter(obj => Regiones[region].includes(obj.ID))
                        .map(obj => obj.Nombre);
        
                    objetosEncontrados.push(...nombres);
                }
            }

            

            if(objetosEncontrados.length === 0) return "[Desconocido]"


            

            return `${objetosEncontrados.join(", ")}`


        }

        function getComponents(pjuser) {
            let components = new StringSelectMenuBuilder()
            .setCustomId(`selectPerfil-${interaction.user.id}-${pjuser.ID}`)
            .setPlaceholder("¿Que quieres revisar? ( •̀ ω •́ )✧")
            .setMaxValues(1)

            components.addOptions(
                {
                    label: `Perfil principal`,
                    value: `perfil`,
                    emoji: `<:d9056043c1e148e38efd10e4515e33d2:1356111301859868823>`,
                    default: action === "perfil"
                },
                {
                    label: `Historia [Lore]`,
                    value: `historia`,
                    emoji: "<a:BunnyBook:1356111194997395496>",
                    default: action === "historia"
                },
                {
                    label: `Alma [Nucleo arcano]`,
                    value: `alma`,
                    emoji: "<a:KrisJojos:1350664814414004395>",
                    default: action === "alma"
                },
                {
                    label: `Mascota [Pets]`,
                    value: `mascota`,
                    emoji: "<:pets:1356111134758932510>",
                    default: action === "mascota"
                },
                
            )    
            
            return new ActionRowBuilder().addComponents(components)
        }

        function getStats(stats) {
            const nombresLegibles = {
                hpMax: "HP Máx",
                manaMax: "Mana Máx",
                fuerza: "Fuerza",
                resistenciaFisica: "Resistencia Física",
                agilidad: "Agilidad",
                sabiduria: "Sabiduría",
                inteligencia: "Inteligencia",
                resistenciaMagica: "Resistencia Mágica",
                poderElemental: "Poder Elemental",
                percepcion: "Percepción",
                voluntad: "Voluntad",
                regeneracion: "Regeneración",
                paradoja: "Paradoja",
                destino: "Destino"
              };

              

              const clavesMostrar = ["hpMax", "manaMax", "fuerza", "inteligencia", "agilidad", "sabiduria", "inteligencia", "resistenciaFisica", "resistenciaMagica", 
                "poderElemental", "voluntad"
              ];

              const clavesMejorar = ["fuerza", "inteligencia", "agilidad", "sabiduria", "inteligencia",
                "poderElemental"
              ];

              const fields = Object.entries(stats)
                .filter(([key]) => clavesMostrar.includes(key))
                .map(([key, value]) => ({
                  name: nombresLegibles[key] || key,
                  value: value.toString(),
                  inline: true
                }));    

                const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`selectPerfil-${interaction.user.id}-${personaje.ID}-extras`)
                .setPlaceholder('Selecciona un stats a mejorar')
                .setMaxValues(1);

                const optionsSelects = Object.entries(stats)
                .filter(([key]) => clavesMejorar.includes(key))
                .map(([key, value]) => {
                    selectMenu.addOptions({
                        label: `+ 1 ${nombresLegibles[key] || key}`,
                        value: `stats*${key}`,
                    });
                })

                const selectRow = new ActionRowBuilder().addComponents(selectMenu);
                
            return {
                fields: fields,
                selectMenu: selectRow
            }
        }


        function NumRomano(num) {
            const romanos = [
                'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
                'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
                'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV' // Hasta 25
            ];
            return romanos[num - 1] || num.toString();
        }


    }
}