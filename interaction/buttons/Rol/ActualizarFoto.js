const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const { updateMessage } = require("../../modals/Rol/Modal crearFicha");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const dbconfig = db.collection("usuarios_server")
const cloudinary = require("cloudinary").v2

module.exports = {
    customId: "configurar_personaje",
    buttonAuthor: true,

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async function(client, interaction, act, messageId) {

             await interaction.deferReply({ flags: ["Ephemeral"]})

            await interaction.editReply({content: "Por favor, envía tu imagen (archivo/desde tu galeria o URL) en este canal en los próximos dos minutos"})
    
            const filter = msg => msg.author.id === interaction.user.id && 
            ( msg.attachments.size > 0 ||
                /^https?:\/\/.+\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i.test(msg.content) );
    
            const collector = interaction.channel.createMessageCollector({
                filter,
                max: 1,
                time: 120_000
            });
    
            collector.on('collect', async msg => {
                let imageUrl;
                if (msg.attachments.size > 0) {
                  imageUrl = msg.attachments.first().url;
                } else {
                  imageUrl = msg.content.trim();
                }
      

                await this.procesarFoto(interaction, imageUrl)  
      


                try {
                    const message = await interaction.channel.messages.fetch(messageId)

                    await msg.delete()

                    await updateMessage(interaction, message, "character", true);
                } catch (error) {
                    console.log("No se pudo borrar el mensaje del autor (foto)", error)
                }
                await interaction.editReply('✅ Tu foto de perfil ha sido actualizada.');
            });
    
            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                  interaction.editReply('⏰ Se acabó el tiempo. Vuelve a pulsar “Establecer foto” para intentarlo de nuevo.');
                }
              });


    },

    resolverURLReal,
    esHostDiscord,
    procesarFoto: procesarFoto

}

function resolverURLReal(imgURL) {
    if (!imgURL) return imgURL;
    const match = imgURL.match(/\/external\/[^\/]+\/(https?)\/(.+)$/i);
    if (match) {
        return `${match[1]}://${match[2]}`;
    }
    return imgURL;
}

function esHostDiscord(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        return (
            host === "cdn.discordapp.com" ||
            host === "media.discordapp.net" ||
            /^images-ext-\d+\.discordapp\.net$/i.test(host)
        );
    } catch {
        return false;
    }
}

async function procesarFoto(interaction, imgURL, ignore, user) {
    if (!user) user = interaction?.user;
    if (!imgURL) return null;

    // 1. Desenvolver proxy externo si aplica
    const urlDesenrollada = resolverURLReal(imgURL);

    // 2. Determinar si proviene de la red de Discord
    const esDiscord = esHostDiscord(urlDesenrollada);

    var img = "";

    async function isValidImage(urlAValidar) {
        const xprsn = /^https?:\/\/.*\.(?:png|jpe?g|svg|webp|gif)(\?.*)?$/i;

        if (!xprsn.test(urlAValidar)) {
            console.log("isValidImage regex falló para:", urlAValidar);
            return false;
        }

        try {
            const response = await fetch(urlAValidar, { method: 'HEAD' });
            const contentType = response.headers.get('content-type');
            if (response.ok && contentType && contentType.startsWith('image/')) {
                return true;
            }

            // Fallback ligero con GET si HEAD es rechazado por el servidor remoto (ej. 403 o 405)
            if (response.status === 403 || response.status === 405) {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 4000);
                try {
                    const getResp = await fetch(urlAValidar, {
                        method: 'GET',
                        headers: { Range: 'bytes=0-1024' },
                        signal: controller.signal
                    });
                    clearTimeout(timeout);
                    const ct = getResp.headers.get('content-type');
                    return getResp.ok && ct && ct.startsWith('image/');
                } catch (e) {
                    clearTimeout(timeout);
                }
            }
            return false;
        } catch (e) {
            console.log("Error al validar imagen:", e);
            return false;
        }
    }

    if (await isValidImage(urlDesenrollada) === false) {
        if (!ignore) {
            return interaction.editReply({
                content: "Tu link parece no ser valido, verifica que contenga una imagen valida. Si tienes dudas revisa el foro <#1330769969428041822>",
                flags: ["Ephemeral"]
            });
        } else {
            return null;
        }
    }

    const targetId = (typeof user === 'object' && user !== null) ? (user.id || user._id) : user;
    const discordUserId = (typeof user === 'object' && user !== null && user.id) ? user.id : (interaction?.user?.id || null);

    if (esDiscord) {
        // Proviene de la red de Discord -> subir a Cloudinary
        try {
            const getResponse = await fetch(urlDesenrollada);
            if (!getResponse.ok) throw new Error("Error al descargar la imagen para Cloudinary");

            const buff = await getResponse.arrayBuffer();
            const resource = Buffer.from(buff);

            const uploadCloudinary = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: "auto",
                        folder: "Rol/Avatars",
                        public_id: `${targetId}_AvatarRol`
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                uploadStream.end(resource);
            });

            console.log("Imagen subida correctamente a Cloudinary!\n Link:", uploadCloudinary.secure_url);
            img = uploadCloudinary.secure_url;
        } catch (e) {
            console.error("Error al subir a Cloudinary:", e);
            img = urlDesenrollada;
        }
    } else {
        // Proviene de un servicio externo diferente a Discord (Pinterest, etc.) -> usar directamente
        img = urlDesenrollada;
    }

    if (img) {
        if (discordUserId) {
            await dbconfig.updateOne(
                { _id: discordUserId },
                { $set: { "time.pjFoto": Date.now() } }
            ).catch(() => {});
        }

        if (targetId) {
            const updateRes = await character.updateOne(
                { _id: targetId },
                { $set: { "perfil.avatarURL": img, avatarURL: img } }
            ).catch(() => {});

            if (updateRes?.matchedCount === 0 && discordUserId) {
                await character.updateOne(
                    { ownerID: discordUserId },
                    { $set: { "perfil.avatarURL": img, avatarURL: img } }
                ).catch(() => {});
            }
        }
    }

    return img;
}